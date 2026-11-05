import { prisma } from '../config/prisma.js';
import { config } from '../config/env.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { runCodeSchema, submitCodeSchema, autoSubmitSchema } from '../utils/testValidation.js';
import { generateWrapper } from '../utils/wrapperGenerator.js';
import * as executionService from '../services/executionService.js';
import { evaluateSubjectiveAnswer } from '../services/aiEvaluationService.js';
import { downloadAttemptDetail } from './studentController.js';

const MAX_SUBMISSIONS_PER_QUESTION = 100;

// Slack for network latency and client/server clock skew when enforcing
// time limits on submissions.
const SUBMIT_GRACE_MS = 2 * 60 * 1000;

const SAMPLE_CASES = { where: { isSample: true }, orderBy: { order: 'asc' } };
const ATTEMPT_WITH_ASSIGNMENTS = {
  attemptAssignments: {
    orderBy: { order: 'asc' },
    include: { poolQuestion: { include: { testCases: SAMPLE_CASES, category: true } } },
  },
};

// IP used for the "same network" anti-cheat lock. Behind a proxy we take
// the left-most X-Forwarded-For entry (the original client as seen by the
// first proxy). This is a heuristic, not an authentication factor.
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (config.trustProxy && forwarded) return String(forwarded).split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

function getFingerprint(req) {
  const fp = req.headers['x-browser-fingerprint'];
  return typeof fp === 'string' && fp.length <= 128 ? fp : null;
}

function assertFingerprintMatch(req, attempt) {
  if (attempt.browserFingerprint && getFingerprint(req) !== attempt.browserFingerprint) {
    throw new HttpError(403, 'This test must be taken from the same browser where it was started. If you believe this is an error, contact your instructor.');
  }
  if (config.enforceAttemptIpLock && attempt.ipAddress && getClientIp(req) !== attempt.ipAddress) {
    throw new HttpError(403, 'This test must be taken from the same network where it was started. If you believe this is an error, contact your instructor.');
  }
}

function isPoolBased(test) {
  return test.poolLinks.length > 0;
}

// The questions a student actually sees: their randomly assigned pool
// questions, or the test's own questions for manual tests.
function attemptQuestionIds(test, attempt) {
  return isPoolBased(test)
    ? attempt.attemptAssignments.map((a) => a.poolQuestionId)
    : test.questions.map((q) => q.id);
}

// Time a student gets for their attempt — the sum of the per-question
// allowances, exactly as the exam page's countdown computes it.
function attemptDurationMs(test, attempt) {
  const minutes = isPoolBased(test)
    ? attempt.attemptAssignments.reduce((sum, a) => sum + (a.poolQuestion?.timeAllottedMinutes ?? 0), 0)
    : test.questions.reduce((sum, q) => sum + (q.timeAllottedMinutes ?? 0), 0);
  return (minutes > 0 ? minutes : test.durationMinutes) * 60 * 1000;
}

// Checks the student is in the test's audience and that the test (or
// their individually reopened window) is currently open. `graceMs` only
// relaxes the closing edge of the window.
function assertStudentHasAccess(test, student, attempt, durationMs, graceMs = 0) {
  const institutionMatch = test.institutionLinks.some((l) => l.institutionId === student.institutionId);
  const departmentMatch = test.departmentLinks.some((l) => l.departmentId === student.departmentId);
  const batchMatch = test.batchLinks.some((l) => l.batchId === student.batchId);
  if (!institutionMatch || !departmentMatch || !batchMatch) {
    throw new HttpError(403, 'You do not have access to this test.');
  }

  const now = Date.now();

  // An attempt reopened with a custom window uses that window.
  if (attempt?.reopenStartTime && attempt?.reopenEndTime) {
    if (now < attempt.reopenStartTime.getTime()) throw new HttpError(403, 'Your reopened attempt has not started yet.');
    if (now <= attempt.reopenEndTime.getTime() + graceMs) return;
    // Started inside the reopen window → may finish their full duration.
    if (attempt.startedAt >= attempt.reopenStartTime && now <= attempt.startedAt.getTime() + durationMs + graceMs) return;
    // Otherwise fall through to the test-level window (the whole test may
    // have been reopened again from "All tests").
  }

  if (now < test.startTime.getTime()) throw new HttpError(403, 'This test has not started yet.');
  if (now > test.endTime.getTime() + graceMs) throw new HttpError(403, 'This test has already closed.');
  if (test.status !== 'SCHEDULED') throw new HttpError(403, 'This test is not currently active.');
}

function assertWithinPersonalDeadline(attempt, durationMs) {
  if (Date.now() > attempt.startedAt.getTime() + durationMs + SUBMIT_GRACE_MS) {
    throw new HttpError(403, 'Your time for this test is up.');
  }
}

function isWithinAllowedTime(test, student, attempt, durationMs) {
  try {
    assertStudentHasAccess(test, student, attempt, durationMs, SUBMIT_GRACE_MS);
    assertWithinPersonalDeadline(attempt, durationMs);
    return true;
  } catch {
    return false;
  }
}

// Loads everything needed to act on the student's in-progress attempt.
async function loadOpenAttempt(req, testId) {
  const studentId = req.user.studentId;

  const attempt = await prisma.testAttempt.findUnique({
    where: { testId_studentId: { testId, studentId } },
    include: {
      attemptAssignments: {
        select: { poolQuestionId: true, poolQuestion: { select: { timeAllottedMinutes: true } } },
      },
    },
  });
  if (!attempt) throw new HttpError(404, 'No active attempt for this test.');
  if (attempt.submittedAt) throw new HttpError(403, 'This test has already been submitted.');

  assertFingerprintMatch(req, attempt);

  const [test, student] = await Promise.all([
    prisma.test.findUnique({
      where: { id: testId },
      include: {
        institutionLinks: true,
        departmentLinks: true,
        batchLinks: true,
        poolLinks: true,
        questions: { select: { id: true, timeAllottedMinutes: true } },
      },
    }),
    prisma.student.findUnique({ where: { id: studentId } }),
  ]);
  if (!test) throw new HttpError(404, 'Test not found.');
  if (!student) throw new HttpError(404, 'Student profile not found.');

  const allowedQuestionIds = new Set(attemptQuestionIds(test, attempt));
  const durationMs = attemptDurationMs(test, attempt);
  return { attempt, test, student, allowedQuestionIds, durationMs };
}

function assertQuestionAccess(allowedQuestionIds, questionId) {
  if (!allowedQuestionIds.has(questionId)) {
    throw new HttpError(403, 'This question is not assigned to you.');
  }
}

// Resolves a question from either the test's own questions or the pool.
// Callers must check assertQuestionAccess first.
async function resolveQuestion(questionId, testId, includeAllTestCases = false) {
  const testCaseInclude = includeAllTestCases ? { orderBy: { order: 'asc' } } : SAMPLE_CASES;

  const question = await prisma.question.findFirst({
    where: { id: questionId, testId },
    include: { testCases: testCaseInclude },
  });
  if (question) return { ...question, source: 'manual' };

  const poolQuestion = await prisma.poolQuestion.findUnique({
    where: { id: questionId },
    include: { testCases: testCaseInclude },
  });
  if (poolQuestion) return { ...poolQuestion, source: 'pool' };

  return null;
}

function prepareCode(code, question, language) {
  if (!question.functionSignature?.name) return code;
  const wrapper = generateWrapper(question.functionSignature, language);
  if (!wrapper) return code;
  return code + '\n' + wrapper;
}

function scoreResults(results, points) {
  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;
  const allPassed = totalCount > 0 && passedCount === totalCount;
  const pointsAwarded = allPassed ? points : totalCount > 0 ? Math.round((passedCount / totalCount) * points) : 0;
  const status = allPassed ? 'PASSED' : passedCount > 0 ? 'PARTIAL' : 'FAILED';
  return { passedCount, totalCount, pointsAwarded, status };
}

function questionLink(question) {
  return question.source === 'pool' ? { poolQuestionId: question.id } : { questionId: question.id };
}

function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Lists tests the logged-in student is eligible for across all states.
export const listAvailableTests = asyncHandler(async (req, res) => {
  const student = await prisma.student.findUnique({ where: { id: req.user.studentId } });
  if (!student) throw new HttpError(404, 'Student profile not found.');
  const now = new Date();

  const tests = await prisma.test.findMany({
    where: {
      status: { not: 'DRAFT' },
      institutionLinks: { some: { institutionId: student.institutionId } },
      departmentLinks: { some: { departmentId: student.departmentId } },
      batchLinks: { some: { batchId: student.batchId } },
    },
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
      durationMinutes: true,
      questionsPerStudent: true,
      questions: { select: { timeAllottedMinutes: true } },
      poolLinks: { select: { poolId: true } },
      attempts: {
        where: { studentId: student.id },
        select: {
          id: true, submittedAt: true, disqualifiedAt: true, reopenedAt: true,
          reopenStartTime: true, reopenEndTime: true, warningCount: true, totalScore: true,
          submissions: { select: { needsReview: true } },
          attemptAssignments: { select: { poolQuestion: { select: { timeAllottedMinutes: true } } } },
        },
        take: 1,
      },
    },
    orderBy: { startTime: 'desc' },
  });

  const result = tests.map((t) => {
    const attempt = t.attempts[0] ?? null;
    // Time the student actually gets: the sum of their questions' allowances
    // (pool tests only know this once questions have been assigned).
    const minutes = t.poolLinks.length > 0
      ? (attempt?.attemptAssignments ?? []).reduce((sum, a) => sum + a.poolQuestion.timeAllottedMinutes, 0)
      : t.questions.reduce((sum, q) => sum + q.timeAllottedMinutes, 0);
    const isActive = now >= t.startTime && now <= t.endTime;
    const isFuture = now < t.startTime;

    let status;
    if (attempt?.disqualifiedAt) {
      status = 'DISQUALIFIED';
    } else if (attempt?.reopenEndTime && now > attempt.reopenEndTime) {
      // Reopen window expired: an existing submission stands, otherwise ended.
      status = attempt?.submittedAt ? 'SUBMITTED' : 'ENDED';
    } else if (attempt?.submittedAt && attempt?.reopenedAt && new Date(attempt.reopenedAt) > new Date(attempt.submittedAt)) {
      status = 'REOPEN_ATTEMPT';
    } else if (attempt?.submittedAt) {
      status = 'SUBMITTED';
    } else if (attempt?.reopenStartTime && attempt?.reopenEndTime && now >= attempt.reopenStartTime && now <= attempt.reopenEndTime) {
      status = 'ACTIVE';
    } else if (attempt?.reopenStartTime && now < attempt.reopenStartTime) {
      status = 'REOPENED';
    } else if (attempt?.reopenedAt && !attempt?.submittedAt) {
      status = 'ACTIVE';
    } else if (isActive) {
      status = 'ACTIVE';
    } else if (isFuture) {
      status = 'SCHEDULED';
    } else {
      status = 'ENDED';
    }

    return {
      id: t.id,
      title: t.title,
      startTime: t.startTime,
      endTime: t.endTime,
      reopenStartTime: attempt?.reopenStartTime ?? null,
      reopenEndTime: attempt?.reopenEndTime ?? null,
      durationMinutes: minutes > 0 ? minutes : null,
      status,
      submitted: !!attempt?.submittedAt,
      submittedAt: attempt?.submittedAt ?? null,
      disqualified: !!attempt?.disqualifiedAt,
      attemptId: attempt?.id ?? null,
      warningCount: attempt?.warningCount ?? 0,
      totalScore: attempt?.totalScore ?? null,
      hasNeedsReview: attempt?.submissions?.some((s) => s.needsReview) || false,
    };
  });

  res.json(result);
});

// Starts (or resumes) an attempt and returns the test with questions
// and sample test cases — internal test cases are withheld.
export const startOrResumeAttempt = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const studentId = req.user.studentId;

  const [test, student] = await Promise.all([
    prisma.test.findUnique({
      where: { id: testId },
      include: {
        institutionLinks: true,
        departmentLinks: true,
        batchLinks: true,
        poolLinks: true,
        questions: { orderBy: { order: 'asc' }, include: { testCases: SAMPLE_CASES } },
      },
    }),
    prisma.student.findUnique({ where: { id: studentId } }),
  ]);
  if (!test) throw new HttpError(404, 'Test not found.');
  if (!student) throw new HttpError(404, 'Student profile not found.');

  const poolBased = isPoolBased(test);
  const poolIds = test.poolLinks.map((l) => l.poolId);
  const fetchAttempt = (where) => prisma.testAttempt.findUnique({ where, include: ATTEMPT_WITH_ASSIGNMENTS });

  let attempt = await fetchAttempt({ testId_studentId: { testId, studentId } });

  if (!attempt) {
    // Check access BEFORE creating anything, so students outside the
    // audience (or outside the window) can't leave attempt rows behind.
    assertStudentHasAccess(test, student, null, 0);
    try {
      const created = await prisma.testAttempt.create({
        data: { testId, studentId, ipAddress: getClientIp(req), browserFingerprint: getFingerprint(req) },
      });
      attempt = await fetchAttempt({ id: created.id });
    } catch (err) {
      // Race: a concurrent request already created the attempt.
      if (err.code !== 'P2002') throw err;
      attempt = await fetchAttempt({ testId_studentId: { testId, studentId } });
      if (!attempt) throw err;
      assertFingerprintMatch(req, attempt);
    }
  } else {
    // An attempt is "stale" after a reopen when the previous try is over:
    // it was submitted before the reopen, or it was started before the
    // reopen and its time has already run out. Stale attempts start fresh
    // (possibly from a different machine, e.g. after a crash).
    const durationMs = attemptDurationMs(test, attempt);
    const reopenedAfterSubmit = attempt.reopenedAt && attempt.submittedAt && attempt.reopenedAt > attempt.submittedAt;
    const reopenedAfterTimeout = attempt.reopenedAt && !attempt.submittedAt
      && attempt.startedAt < attempt.reopenedAt
      && Date.now() > attempt.startedAt.getTime() + durationMs;

    if (reopenedAfterSubmit || reopenedAfterTimeout) {
      assertStudentHasAccess(test, student, attempt, durationMs);
      await prisma.$transaction([
        prisma.attemptPoolQuestion.deleteMany({ where: { attemptId: attempt.id } }),
        prisma.submission.deleteMany({ where: { attemptId: attempt.id } }),
        prisma.testAttempt.update({
          where: { id: attempt.id },
          data: {
            submittedAt: null,
            totalScore: null,
            runCount: 0,
            startedAt: new Date(),
            ipAddress: getClientIp(req),
            browserFingerprint: getFingerprint(req),
          },
        }),
      ]);
      attempt = await fetchAttempt({ id: attempt.id });
    } else {
      if (attempt.submittedAt) throw new HttpError(403, 'You have already submitted this test.');
      assertFingerprintMatch(req, attempt);
      assertStudentHasAccess(test, student, attempt, durationMs);
    }
  }

  if (attempt.submittedAt) {
    throw new HttpError(403, 'You have already submitted this test.');
  }

  // For pool-based tests, assign questions if not already assigned.
  if (poolBased && attempt.attemptAssignments.length === 0) {
    let selected = [];

    if (test.questionsPerCategory.length > 0) {
      // Per-category selection: each entry is "categoryId:count".
      for (const entry of test.questionsPerCategory) {
        const [categoryId, countStr] = entry.split(':');
        const count = parseInt(countStr, 10) || 1;
        const catQuestions = await prisma.poolQuestion.findMany({
          where: {
            poolId: { in: poolIds },
            categoryId,
            ...(test.selectedQuestionIds.length > 0 ? { id: { in: test.selectedQuestionIds } } : {}),
          },
          select: { id: true },
        });
        selected.push(...shuffle(catQuestions).slice(0, count));
      }
    } else {
      const poolQuestions = await prisma.poolQuestion.findMany({
        where: {
          poolId: { in: poolIds },
          ...(test.selectedCategoryIds.length > 0 ? { categoryId: { in: test.selectedCategoryIds } } : {}),
          ...(test.selectedQuestionIds.length > 0 ? { id: { in: test.selectedQuestionIds } } : {}),
        },
        select: { id: true },
      });
      selected = shuffle(poolQuestions).slice(0, test.questionsPerStudent || 5);
    }

    // De-duplicate (a question can't be assigned twice).
    selected = [...new Map(selected.map((q) => [q.id, q])).values()];
    if (selected.length === 0) {
      throw new HttpError(400, 'No pool questions match the selected criteria.');
    }

    try {
      await prisma.attemptPoolQuestion.createMany({
        data: selected.map((q, i) => ({ attemptId: attempt.id, poolQuestionId: q.id, order: i })),
        skipDuplicates: true,
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
    }

    attempt = await fetchAttempt({ id: attempt.id });
  }

  const questions = poolBased
    ? attempt.attemptAssignments.map((a) => ({
      id: a.poolQuestion.id,
      title: a.poolQuestion.title,
      statement: a.poolQuestion.statement,
      constraints: a.poolQuestion.constraints,
      points: a.poolQuestion.points,
      timeAllottedMinutes: a.poolQuestion.timeAllottedMinutes,
      difficulty: a.poolQuestion.difficulty,
      category: a.poolQuestion.category?.name ?? '',
      type: a.poolQuestion.type,
      timeLimitSecs: a.poolQuestion.timeLimitSecs,
      memoryLimitMB: a.poolQuestion.memoryLimitMB,
      sampleTests: a.poolQuestion.testCases.map((tc) => ({ input: tc.input, output: tc.output })),
      functionSignature: a.poolQuestion.functionSignature,
      functionTemplates: a.poolQuestion.functionTemplates,
    }))
    : test.questions.map((q) => ({
      id: q.id,
      title: q.title,
      statement: q.statement,
      constraints: q.constraints,
      points: q.points,
      timeAllottedMinutes: q.timeAllottedMinutes,
      difficulty: q.difficulty,
      type: q.type,
      timeLimitSecs: q.timeLimitSecs,
      memoryLimitMB: q.memoryLimitMB,
      sampleTests: q.testCases.map((tc) => ({ input: tc.input, output: tc.output })),
      functionSignature: q.functionSignature,
      functionTemplates: q.functionTemplates,
    }));

  res.json({
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    warningCount: attempt.warningCount,
    reopenedAt: attempt.reopenedAt ?? null,
    test: {
      id: test.id,
      title: test.title,
      startTime: attempt.reopenStartTime || test.startTime,
      durationMinutes: test.durationMinutes,
      endTime: attempt.reopenEndTime || test.endTime,
      questionSource: poolBased ? 'pool' : 'manual',
      maxWarnings: test.maxWarnings,
      securityEnabled: test.securityEnabled,
      questions,
    },
  });
});

// "Run" — executes against sample test cases only (or a custom input),
// and is never persisted as a graded submission.
export const runCode = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const data = runCodeSchema.parse(req.body);

  const { attempt, test, student, allowedQuestionIds, durationMs } = await loadOpenAttempt(req, testId);
  assertStudentHasAccess(test, student, attempt, durationMs);
  assertWithinPersonalDeadline(attempt, durationMs);
  assertQuestionAccess(allowedQuestionIds, data.questionId);

  const question = await resolveQuestion(data.questionId, testId);
  if (!question) throw new HttpError(404, 'Question not found on this test.');

  if (question.type === 'SUBJECTIVE') {
    return res.json({ mode: 'subjective', message: 'No test cases to run for subjective questions.' });
  }
  if (!data.language || data.code === undefined) {
    throw new HttpError(400, 'Language and code are required.');
  }

  await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: { runCount: { increment: 1 } },
  }).catch((err) => console.error(`[${req.id}] Failed to increment run count:`, err.message));

  const timeLimitSecs = question.timeLimitSecs ?? 5;
  const memoryLimitMB = question.memoryLimitMB ?? 256;
  const preparedCode = prepareCode(data.code, question, data.language);

  if (data.customInput !== undefined && data.customInput !== '') {
    const result = await executionService.executeCode({
      languageId: data.language, code: preparedCode, stdin: data.customInput, timeLimitSecs, memoryLimitMB,
    });
    return res.json({ mode: 'custom', stdout: result.stdout, stderr: result.stderr, timedOut: result.timedOut });
  }

  const results = await executionService.runAgainstTestCases({
    languageId: data.language,
    code: preparedCode,
    testCases: question.testCases,
    timeLimitSecs,
    memoryLimitMB,
  });

  res.json({ mode: 'sample', results });
});

// "Submit (question)" — grades against ALL test cases and persists a
// Submission with the score. Subjective answers are stored as PENDING and
// evaluated when the whole test is submitted.
export const submitQuestion = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const data = submitCodeSchema.parse(req.body);
  const studentId = req.user.studentId;

  const { attempt, test, student, allowedQuestionIds, durationMs } = await loadOpenAttempt(req, testId);
  assertStudentHasAccess(test, student, attempt, durationMs);
  assertWithinPersonalDeadline(attempt, durationMs);
  assertQuestionAccess(allowedQuestionIds, data.questionId);

  const question = await resolveQuestion(data.questionId, testId, true);
  if (!question) throw new HttpError(404, 'Question not found on this test.');

  const subCount = await prisma.submission.count({
    where: { attemptId: attempt.id, OR: [{ questionId: data.questionId }, { poolQuestionId: data.questionId }] },
  });
  if (subCount >= MAX_SUBMISSIONS_PER_QUESTION) {
    throw new HttpError(429, 'Submission limit reached for this question.');
  }

  if (question.type === 'SUBJECTIVE') {
    if (!data.answer || !data.answer.trim()) throw new HttpError(400, 'An answer is required.');
    const sub = await prisma.submission.create({
      data: {
        attemptId: attempt.id, studentId, answer: data.answer,
        status: 'PENDING', passedCount: 0, totalCount: 1, pointsAwarded: 0,
        ...questionLink(question),
      },
    });
    return res.json({ submissionId: sub.id, status: sub.status, passedCount: 0, totalCount: 1, pointsAwarded: 0 });
  }

  if (!data.language || data.code === undefined) {
    throw new HttpError(400, 'Language and code are required.');
  }

  const results = await executionService.runAgainstTestCases({
    languageId: data.language,
    code: prepareCode(data.code, question, data.language),
    testCases: question.testCases,
    timeLimitSecs: question.timeLimitSecs ?? 5,
    memoryLimitMB: question.memoryLimitMB ?? 256,
  });
  const { passedCount, totalCount, pointsAwarded, status } = scoreResults(results, question.points);

  // Re-check after the (possibly slow) execution: the attempt may have been
  // finalized meanwhile, and a late submission must not change the score.
  const fresh = await prisma.testAttempt.findUnique({ where: { id: attempt.id }, select: { submittedAt: true } });
  if (fresh?.submittedAt) throw new HttpError(403, 'This test has already been submitted.');

  const sub = await prisma.submission.create({
    data: {
      attemptId: attempt.id, studentId, language: data.language, code: data.code,
      status, passedCount, totalCount, pointsAwarded,
      ...questionLink(question),
    },
  });
  res.json({ submissionId: sub.id, status: sub.status, passedCount, totalCount, pointsAwarded });
});

// Evaluates pending subjective answers and returns the total score.
// Only submissions for questions actually shown to this student count.
async function finalizeAttempt(attemptId, testId, allowedQuestionIds) {
  const submissions = await prisma.submission.findMany({
    where: { attemptId },
    orderBy: { createdAt: 'asc' },
  });

  const byQuestion = new Map();
  for (const s of submissions) {
    const key = s.questionId || s.poolQuestionId;
    if (!key || !allowedQuestionIds.has(key)) continue;
    if (!byQuestion.has(key)) byQuestion.set(key, []);
    byQuestion.get(key).push(s);
  }

  // Grade the student's LATEST pending subjective answer for each question
  // (earlier drafts are superseded).
  for (const [questionId, subs] of byQuestion) {
    const latestPending = [...subs].reverse().find((s) => s.status === 'PENDING' && s.answer);
    if (!latestPending) continue;

    const question = await resolveQuestion(questionId, testId);
    if (!question || question.type !== 'SUBJECTIVE') continue;

    let evaluation;
    try {
      evaluation = await evaluateSubjectiveAnswer({
        modelAnswer: question.modelAnswer || '',
        studentAnswer: latestPending.answer,
        maxPoints: question.points,
        questionTitle: question.title,
        questionStatement: question.statement,
      });
    } catch {
      evaluation = { score: 0, reason: 'Evaluation failed.', needsReview: true };
    }

    const pointsAwarded = evaluation.needsReview ? 0 : Math.min(Math.max(0, Math.round(evaluation.score)), question.points);
    const status = evaluation.needsReview
      ? 'PENDING'
      : pointsAwarded >= question.points ? 'PASSED' : pointsAwarded > 0 ? 'PARTIAL' : 'FAILED';

    const updated = await prisma.submission.update({
      where: { id: latestPending.id },
      data: {
        status,
        passedCount: !evaluation.needsReview && pointsAwarded > 0 ? 1 : 0,
        totalCount: 1,
        pointsAwarded,
        feedback: evaluation.reason || null,
        needsReview: evaluation.needsReview || false,
      },
    });
    subs[subs.indexOf(latestPending)] = updated;
  }

  let totalScore = 0;
  for (const subs of byQuestion.values()) {
    totalScore += Math.max(0, ...subs.map((s) => s.pointsAwarded));
  }
  return totalScore;
}

// Locks the attempt (so concurrent submits can't double-finalize), then
// scores it. If scoring fails the lock is released so the student can retry.
async function lockAndFinalize(attempt, testId, allowedQuestionIds, extraData = {}) {
  const lock = await prisma.testAttempt.updateMany({
    where: { id: attempt.id, submittedAt: null },
    data: { submittedAt: new Date(), ...extraData },
  });
  if (lock.count === 0) return { alreadySubmitted: true };

  try {
    const totalScore = await finalizeAttempt(attempt.id, testId, allowedQuestionIds);
    const updated = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { totalScore },
      select: { submittedAt: true, totalScore: true },
    });
    return updated;
  } catch (err) {
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { submittedAt: null, totalScore: null, ...(extraData.disqualifiedAt ? { disqualifiedAt: null } : {}) },
    }).catch(() => {});
    throw err;
  }
}

// Auto-submit — used when a student leaves the exam page (navigation,
// reload, disqualification). Saves any unsaved answers that are still
// within the allowed time, then finalizes the attempt.
export const autoSubmit = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const studentId = req.user.studentId;
  const { answers } = autoSubmitSchema.parse(req.body ?? {});

  const { attempt, test, student, allowedQuestionIds, durationMs } = await loadOpenAttempt(req, testId);

  // Answers arriving after the student's time is up are ignored (the
  // attempt is still finalized with what was submitted in time).
  if (answers.length > 0 && isWithinAllowedTime(test, student, attempt, durationMs)) {
    const seen = new Set();
    for (const ans of answers) {
      if (!allowedQuestionIds.has(ans.questionId) || seen.has(ans.questionId)) continue;
      seen.add(ans.questionId);

      const existing = await prisma.submission.findFirst({
        where: { attemptId: attempt.id, OR: [{ questionId: ans.questionId }, { poolQuestionId: ans.questionId }] },
        select: { id: true },
      });
      if (existing) continue; // only fill in questions that were never submitted

      const question = await resolveQuestion(ans.questionId, testId, true);
      if (!question) continue;

      if (question.type === 'SUBJECTIVE') {
        const text = ans.answer ?? ans.code ?? '';
        if (!text.trim()) continue;
        await prisma.submission.create({
          data: {
            attemptId: attempt.id, studentId, answer: text,
            status: 'PENDING', passedCount: 0, totalCount: 1, pointsAwarded: 0,
            ...questionLink(question),
          },
        });
        continue;
      }

      if (!ans.language || !ans.code) continue;
      try {
        const results = await executionService.runAgainstTestCases({
          languageId: ans.language,
          code: prepareCode(ans.code, question, ans.language),
          testCases: question.testCases,
          timeLimitSecs: question.timeLimitSecs ?? 5,
          memoryLimitMB: question.memoryLimitMB ?? 256,
        });
        const { passedCount, totalCount, pointsAwarded, status } = scoreResults(results, question.points);
        await prisma.submission.create({
          data: {
            attemptId: attempt.id, studentId, language: ans.language, code: ans.code,
            status, passedCount, totalCount, pointsAwarded,
            ...questionLink(question),
          },
        });
      } catch (err) {
        // Best-effort: keep finalizing even if one answer couldn't be run.
        console.error(`[${req.id}] Auto-submit execution failed:`, err.message);
      }
    }
  }

  const result = await lockAndFinalize(attempt, testId, allowedQuestionIds);
  if (result.alreadySubmitted) {
    return res.json({ submittedAt: null, totalScore: null, alreadySubmitted: true });
  }
  res.json({ submittedAt: result.submittedAt, totalScore: result.totalScore });
});

// Submits the entire test via SSE — locks the attempt so no further
// submissions are accepted, and totals the score across questions.
// Progress events are streamed while subjective answers are evaluated.
// Finalizing never adds new answers, so it is allowed even after the
// test window has closed (otherwise a student whose timer ran out at the
// very end of the window could never submit).
export const submitTest = asyncHandler(async (req, res) => {
  const { testId } = req.params;

  const { attempt, allowedQuestionIds } = await loadOpenAttempt(req, testId);

  const pending = await prisma.submission.findMany({
    where: { attemptId: attempt.id, status: 'PENDING', answer: { not: null } },
    select: { questionId: true, poolQuestionId: true },
  });
  const totalToEval = new Set(
    pending.map((s) => s.questionId || s.poolQuestionId).filter((k) => allowedQuestionIds.has(k)),
  ).size;

  // Claim the attempt before streaming so concurrent submits get a clean 403.
  const lock = await prisma.testAttempt.updateMany({
    where: { id: attempt.id, submittedAt: null },
    data: { submittedAt: new Date() },
  });
  if (lock.count === 0) throw new HttpError(403, 'This test has already been submitted.');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    if (res.destroyed || res.writableEnded) return;
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { /* client disconnected */ }
  };

  sendEvent('progress', { current: 0, total: totalToEval, message: 'Finalizing test…' });

  try {
    const totalScore = await finalizeAttempt(attempt.id, testId, allowedQuestionIds);
    const updated = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { totalScore },
      select: { submittedAt: true, totalScore: true },
    });
    sendEvent('progress', { current: totalToEval, total: totalToEval, message: 'Done!' });
    sendEvent('complete', updated);
  } catch (err) {
    console.error(`[${req.id}] Finalizing attempt failed:`, err);
    // Release the lock so the student can submit again.
    await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: { submittedAt: null, totalScore: null },
    }).catch(() => {});
    sendEvent('error', { error: 'Submitting the test failed. Please try again.' });
  }
  res.end();
});

export const recordWarning = asyncHandler(async (req, res) => {
  const { testId } = req.params;

  const { attempt, test, student, allowedQuestionIds, durationMs } = await loadOpenAttempt(req, testId);

  if (!test.securityEnabled) {
    return res.json({ warningCount: attempt.warningCount, maxWarnings: test.maxWarnings, disqualified: false });
  }

  // Don't record warnings once the student's time / the window is over.
  if (!isWithinAllowedTime(test, student, attempt, durationMs)) {
    throw new HttpError(403, 'Test window has closed.');
  }

  // Atomic increment so concurrent violations are all counted.
  const updated = await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: { warningCount: { increment: 1 } },
    select: { warningCount: true },
  });
  const actualCount = updated.warningCount;

  if (actualCount >= test.maxWarnings) {
    const result = await lockAndFinalize(attempt, testId, allowedQuestionIds, { disqualifiedAt: new Date() });
    if (result.alreadySubmitted) {
      return res.json({ warningCount: actualCount, maxWarnings: test.maxWarnings, disqualified: false, alreadySubmitted: true });
    }
    return res.json({ warningCount: actualCount, maxWarnings: test.maxWarnings, disqualified: true });
  }

  res.json({ warningCount: actualCount, maxWarnings: test.maxWarnings, disqualified: false });
});

// Student views their own attempt details (read-only).
export const getMyAttemptDetails = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const studentId = req.user.studentId;

  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      student: {
        include: {
          user: { select: { name: true, email: true } },
          institution: { select: { name: true } },
          department: { select: { name: true } },
          batch: { select: { name: true } },
        },
      },
      test: {
        select: {
          id: true, title: true, startTime: true, endTime: true, durationMinutes: true,
          questions: { orderBy: { order: 'asc' }, select: { id: true, title: true, points: true, type: true, timeAllottedMinutes: true } },
          poolLinks: { select: { poolId: true } },
        },
      },
      attemptAssignments: {
        include: { poolQuestion: { select: { id: true, title: true, points: true, type: true } } },
        orderBy: { order: 'asc' },
      },
      submissions: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, questionId: true, poolQuestionId: true, language: true, code: true, answer: true,
          status: true, passedCount: true, totalCount: true, pointsAwarded: true, createdAt: true,
          feedback: true, needsReview: true,
        },
      },
    },
  });

  // Same 404 for "missing" and "not yours" so attempt IDs can't be probed.
  if (!attempt || attempt.studentId !== studentId) throw new HttpError(404, 'Attempt not found.');

  const questions = attempt.test.poolLinks.length > 0 && attempt.attemptAssignments.length > 0
    ? attempt.attemptAssignments.map((a) => ({
      id: a.poolQuestion.id, title: a.poolQuestion.title, points: a.poolQuestion.points, type: a.poolQuestion.type,
    }))
    : attempt.test.questions;

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  const subsByQuestion = new Map();
  for (const sub of attempt.submissions) {
    const key = sub.questionId || sub.poolQuestionId;
    if (!subsByQuestion.has(key)) subsByQuestion.set(key, []);
    subsByQuestion.get(key).push(sub);
  }

  const questionDetails = questions.map((q) => {
    const subs = subsByQuestion.get(q.id) || [];
    const best = subs.reduce((b, s) => (!b || s.pointsAwarded > b.pointsAwarded ? s : b), null);
    const firstSub = subs.length > 0 ? subs[0].createdAt : null;
    const lastSub = subs.length > 0 ? subs[subs.length - 1].createdAt : null;
    const timeSpentSecs = firstSub && lastSub ? Math.floor((new Date(lastSub) - new Date(firstSub)) / 1000) : 0;

    const bestByCode = new Map();
    for (const s of subs) {
      const codeKey = s.code || s.answer || '';
      if (!codeKey) { bestByCode.set(s.id, s); continue; }
      const existing = bestByCode.get(codeKey);
      if (!existing || s.pointsAwarded > existing.pointsAwarded) bestByCode.set(codeKey, s);
    }
    const deduped = [...bestByCode.values()].sort((a, b) => b.pointsAwarded - a.pointsAwarded);

    return {
      questionId: q.id,
      title: q.title,
      points: q.points,
      type: q.type,
      bestScore: best?.pointsAwarded ?? 0,
      bestPassedCount: best?.passedCount ?? 0,
      bestTotalCount: best?.totalCount ?? 0,
      totalSubmissions: subs.length,
      uniqueSubmissions: deduped.length,
      timeSpentSecs,
      submissions: deduped.map((s) => ({
        id: s.id,
        language: s.language,
        code: s.code,
        answer: s.answer,
        status: s.status,
        passedCount: s.passedCount,
        totalCount: s.totalCount,
        pointsAwarded: s.pointsAwarded,
        createdAt: s.createdAt,
      })),
    };
  });

  res.json({
    attempt: {
      id: attempt.id,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      totalScore: attempt.totalScore,
      totalPoints,
      warningCount: attempt.warningCount,
      disqualifiedAt: attempt.disqualifiedAt,
    },
    testTitle: attempt.test.title,
    student: {
      name: attempt.student.user.name,
      email: attempt.student.user.email,
      institution: attempt.student.institution.name,
      department: attempt.student.department.name,
      batch: attempt.student.batch.name,
    },
    questionDetails,
  });
});

// Student downloads their own attempt as PDF.
export const downloadMyAttemptDetail = asyncHandler(async (req, res, next) => {
  const { attemptId } = req.params;
  const studentId = req.user.studentId;

  const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId }, select: { studentId: true } });
  if (!attempt || attempt.studentId !== studentId) throw new HttpError(404, 'Attempt not found.');

  req.params.studentId = studentId;
  return downloadAttemptDetail(req, res, next);
});
