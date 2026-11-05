import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { HttpError } from '../middleware/errorHandler.js';
import { generateTemplates } from '../utils/templateGenerator.js';
import {
  createTestSchema,
  addQuestionSchema,
  updateAudienceSchema,
  updateQuestionSchema,
  scheduleTestSchema,
  reopenTestSchema,
} from '../utils/testValidation.js';

async function assertOwnsTest(testId, adminId) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { institutionLinks: true },
  });
  if (!test) throw new HttpError(404, 'Test not found.');
  if (test.adminId !== adminId) throw new HttpError(403, 'You do not own this test.');
  return test;
}

// Step 1: create the test shell with title + audience (institutions/
// departments/batches). Status starts as DRAFT until scheduled.
export const createTest = asyncHandler(async (req, res) => {
  const data = createTestSchema.parse(req.body);
  const adminId = req.user.adminId;

  const poolConfig = data.questionSource === 'pool' ? {
    questionsPerStudent: data.questionsPerStudent,
    selectedCategoryIds: data.selectedCategoryIds,
    selectedQuestionIds: data.selectedQuestionIds,
    questionsPerCategory: data.questionsPerCategory,
    poolLinks: { create: (data.selectedPoolIds || []).map((poolId) => ({ poolId })) },
  } : {};

  const test = await prisma.test.create({
    data: {
      title: data.title,
      adminId,
      startTime: new Date(),
      endTime: new Date(),
      ...poolConfig,
      institutionLinks: { create: data.institutionIds.map((institutionId) => ({ institutionId })) },
      departmentLinks: { create: data.departmentIds.map((departmentId) => ({ departmentId })) },
      batchLinks: { create: data.batchIds.map((batchId) => ({ batchId })) },
    },
    include: {
      institutionLinks: { include: { institution: true } },
      departmentLinks: { include: { department: true } },
      batchLinks: { include: { batch: true } },
      poolLinks: { include: { pool: true } },
    },
  });

  res.status(201).json(serializeTestDetails(test));
});

// Step 2: add a question + its test cases to a draft test. The first
// test case marked isSample (or the first overall) is shown to students;
// the rest are used only for grading.
export const addQuestion = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const data = addQuestionSchema.parse(req.body);

  await assertOwnsTest(testId, req.user.adminId);

  const currentCount = await prisma.question.count({ where: { testId } });

  const functionTemplates = data.functionSignature
    ? generateTemplates(data.functionSignature)
    : undefined;

  const question = await prisma.question.create({
    data: {
      testId,
      order: currentCount,
      title: data.title,
      statement: data.statement,
      points: data.points,
      timeAllottedMinutes: data.timeAllottedMinutes,
      difficulty: data.difficulty,
      constraints: data.constraints,
      type: data.type,
      modelAnswer: data.type === 'SUBJECTIVE' ? data.modelAnswer : undefined,
      timeLimitSecs: data.timeLimitSecs,
      memoryLimitMB: data.memoryLimitMB,
      functionSignature: data.functionSignature || undefined,
      functionTemplates: functionTemplates || undefined,
      ...(data.type !== 'SUBJECTIVE' && data.testCases.length > 0 ? {
        testCases: {
          create: data.testCases.map((tc, i) => ({
            input: tc.input,
            output: tc.output,
            isSample: tc.isSample,
            order: i,
          })),
        },
      } : {}),
    },
    include: { testCases: true },
  });

  res.status(201).json(question);
});

// Edit a question in place — replaces its content and its full test
// case list (existing test cases are deleted and recreated, simpler
// and safer than trying to diff/patch individual rows).
export const updateQuestion = asyncHandler(async (req, res) => {
  const { testId, questionId } = req.params;
  const data = updateQuestionSchema.parse(req.body);

  const test = await assertOwnsTest(testId, req.user.adminId);
  if (test.status !== 'DRAFT') throw new HttpError(400, 'Cannot edit questions on a published test. Only new questions can be added.');

  const existing = await prisma.question.findFirst({ where: { id: questionId, testId } });
  if (!existing) throw new HttpError(404, 'Question not found on this test.');

  const updateData = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.statement !== undefined) updateData.statement = data.statement;
  if (data.points !== undefined) updateData.points = data.points;
  if (data.timeAllottedMinutes !== undefined) updateData.timeAllottedMinutes = data.timeAllottedMinutes;
  if (data.difficulty !== undefined) updateData.difficulty = data.difficulty;
  if (data.constraints !== undefined) updateData.constraints = data.constraints;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.modelAnswer !== undefined) updateData.modelAnswer = data.modelAnswer;
  if (data.timeLimitSecs !== undefined) updateData.timeLimitSecs = data.timeLimitSecs;
  if (data.memoryLimitMB !== undefined) updateData.memoryLimitMB = data.memoryLimitMB;
  if (data.functionSignature !== undefined) {
    updateData.functionSignature = data.functionSignature;
    updateData.functionTemplates = generateTemplates(data.functionSignature);
  }

  if (data.testCases) {
    updateData.testCases = {
      deleteMany: {},
      create: data.testCases.map((tc, i) => ({
        input: tc.input,
        output: tc.output,
        isSample: tc.isSample,
        order: i,
      })),
    };
  }

  // Replacing test cases happens inside the same update, so a failure
  // can't leave the question with its test cases deleted.
  const question = await prisma.question.update({
    where: { id: questionId },
    data: updateData,
    include: { testCases: true },
  });

  res.json(question);
});

export const removeQuestion = asyncHandler(async (req, res) => {
  const { testId, questionId } = req.params;

  const test = await assertOwnsTest(testId, req.user.adminId);
  if (test.status !== 'DRAFT') throw new HttpError(400, 'Cannot remove questions from a published test.');

  // Scope the delete to THIS test — the question id alone could belong to
  // another (possibly published) test.
  const { count } = await prisma.question.deleteMany({ where: { id: questionId, testId } });
  if (count === 0) throw new HttpError(404, 'Question not found on this test.');
  res.status(204).send();
});

// Edit audience (and optionally title) on an existing test — replaces
// the institution/department/batch links entirely. Allowed regardless
// of test status; if the test already has attempts, the response
// includes a warning the frontend can surface, but the edit still goes
// through (per product decision: edits mostly happen before the test
// window opens, so we don't hard-block here).
export const updateAudience = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const data = updateAudienceSchema.parse(req.body);

  await assertOwnsTest(testId, req.user.adminId);

  const attemptCount = await prisma.testAttempt.count({ where: { testId } });

  const [, , , , updated] = await prisma.$transaction([
    prisma.testInstitution.deleteMany({ where: { testId } }),
    prisma.testDepartment.deleteMany({ where: { testId } }),
    prisma.testBatch.deleteMany({ where: { testId } }),
    prisma.testPool.deleteMany({ where: { testId } }),
    prisma.test.update({
      where: { id: testId },
      data: {
        ...(data.title ? { title: data.title } : {}),
        ...(data.questionSource === 'pool' ? {
          questionsPerStudent: data.questionsPerStudent,
          selectedCategoryIds: data.selectedCategoryIds,
          selectedQuestionIds: data.selectedQuestionIds,
          questionsPerCategory: data.questionsPerCategory,
          poolLinks: { create: (data.selectedPoolIds || []).map((poolId) => ({ poolId })) },
        } : data.questionSource === 'manual' ? {
          questionsPerStudent: 0,
          selectedCategoryIds: [],
          selectedQuestionIds: [],
          questionsPerCategory: [],
        } : {}),
        institutionLinks: { create: data.institutionIds.map((institutionId) => ({ institutionId })) },
        departmentLinks: { create: data.departmentIds.map((departmentId) => ({ departmentId })) },
        batchLinks: { create: data.batchIds.map((batchId) => ({ batchId })) },
      },
      include: {
        institutionLinks: { include: { institution: true } },
        departmentLinks: { include: { department: true } },
        batchLinks: { include: { batch: true } },
        poolLinks: { include: { pool: true } },
      },
    }),
  ]);

  res.json({ ...serializeTestDetails(updated), attemptCount });
});

// Step 3: set the access window and publish (move out of DRAFT).
export const scheduleTest = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const data = scheduleTestSchema.parse(req.body);

  const test = await assertOwnsTest(testId, req.user.adminId);

  const startTime = new Date(data.startTime);
  const endTime = new Date(data.endTime);
  if (endTime <= startTime) throw new HttpError(400, 'End time must be after start time.');
  if (endTime.getTime() <= Date.now()) throw new HttpError(400, 'End time must be in the future.');
  // A start time in the past is only allowed when it is unchanged — e.g.
  // extending the end time of a test that is already running. The edit
  // forms work at minute precision, hence the one-minute tolerance.
  const startUnchanged = test.status !== 'DRAFT' && Math.abs(startTime.getTime() - test.startTime.getTime()) < 60 * 1000;
  if (!startUnchanged && startTime.getTime() < Date.now() - 5 * 60 * 1000) {
    throw new HttpError(400, 'Start time cannot be more than 5 minutes in the past.');
  }

  // Preserve existing status if already published (SCHEDULED / ACTIVE / ENDED)
  const newStatus = test.status === 'DRAFT' ? 'SCHEDULED' : test.status;

  const updated = await prisma.test.update({
    where: { id: testId },
    data: {
      startTime,
      endTime,
      status: newStatus,
      ...(data.durationMinutes ? { durationMinutes: data.durationMinutes } : {}),
      ...(data.maxWarnings !== undefined ? { maxWarnings: data.maxWarnings } : {}),
      ...(data.securityEnabled !== undefined ? { securityEnabled: data.securityEnabled } : {}),
    },
  });

  res.json(updated);
});

// Reopen an ended test with a new time window and optionally
// different batch/department audience. Institution stays the same.
// Existing submitted attempts are un-submitted so students can retry,
// and their reopenStartTime/reopenEndTime is set to the new window.
export const reopenTest = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const data = reopenTestSchema.parse(req.body);

  const test = await assertOwnsTest(testId, req.user.adminId);

  const now = new Date();
  const newStart = new Date(data.startTime);
  const newEnd = new Date(data.endTime);
  if (newEnd <= newStart) throw new HttpError(400, 'End time must be after start time.');

  // Derive institutions from existing links (immutable on reopen)
  const institutionIds = test.institutionLinks.map((l) => l.institutionId);
  if (institutionIds.length === 0) throw new HttpError(400, 'Test has no institution links.');

  // Reset COMPLETED → SCHEDULED so computeDisplayStatus returns a
  // proper status. Display logic will show ACTIVE if window is live,
  // SCHEDULED if in future.
  const newStatus = 'SCHEDULED';

  const [updated] = await prisma.$transaction(async (tx) => {
    // Replace department/batch links (institution stays immutable)
    await tx.testDepartment.deleteMany({ where: { testId } });
    await tx.testBatch.deleteMany({ where: { testId } });

    // Update test times and status
    const upd = await tx.test.update({
      where: { id: testId },
      data: {
        startTime: newStart,
        endTime: newEnd,
        status: newStatus,
        departmentLinks: { create: data.departmentIds.map((id) => ({ departmentId: id })) },
        batchLinks: { create: data.batchIds.map((id) => ({ batchId: id })) },
      },
      include: {
        institutionLinks: { include: { institution: true } },
        departmentLinks: { include: { department: true } },
        batchLinks: { include: { batch: true } },
        questions: { orderBy: { order: 'asc' } },
        poolLinks: true,
      },
    });

    // Reset attempts only for students still in the new audience scope
    const allAttempts = await tx.testAttempt.findMany({
      where: { testId },
      include: { student: { select: { departmentId: true, batchId: true } } },
    });
    const newDeptSet = new Set(data.departmentIds);
    const newBatchSet = new Set(data.batchIds);
    const inScopeAttempts = allAttempts.filter(
      (a) => newDeptSet.has(a.student.departmentId) && newBatchSet.has(a.student.batchId),
    );
    for (const attempt of inScopeAttempts) {
      await tx.testAttempt.update({
        where: { id: attempt.id },
        data: {
          warningCount: 0,
          disqualifiedAt: null,
          reopenedAt: now,
          reopenStartTime: newStart,
          reopenEndTime: newEnd,
        },
      });
    }

    return [upd];
  });

  res.json(serializeTestDetails(updated));
});

// Delete a test — only allowed if still in DRAFT status.
export const deleteTest = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const test = await assertOwnsTest(testId, req.user.adminId);

  if (test.status !== 'DRAFT') {
    throw new HttpError(400, 'Only draft tests can be deleted.');
  }

  await prisma.test.delete({ where: { id: testId } });
  res.status(204).send();
});

// Force-delete all tests owned by the admin, regardless of status.
export const deleteAllTests = asyncHandler(async (req, res) => {
  const { count } = await prisma.test.deleteMany({
    where: { adminId: req.user.adminId },
  });
  res.json({ deleted: count });
});

// "All tests" landing page — every test created by this admin (or,
// if you want org-wide visibility, drop the adminId filter).
export const listTests = asyncHandler(async (req, res) => {
  const tests = await prisma.test.findMany({
    where: { adminId: req.user.adminId },
    include: {
      institutionLinks: { include: { institution: true } },
      departmentLinks: { include: { department: true } },
      batchLinks: { include: { batch: { include: { department: true } } } },
      _count: { select: { questions: true } },
      poolLinks: {
        include: {
          pool: {
            include: {
              categories: { include: { questions: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const testIds = tests.map((t) => t.id);
  const now = new Date();
  const activeAttempts = await prisma.testAttempt.findMany({
    where: {
      testId: { in: testIds },
      submittedAt: null,
      OR: [
        { reopenedAt: { not: null }, reopenStartTime: { not: null }, reopenEndTime: { gte: now } },
        { reopenedAt: null },
      ],
    },
    select: { testId: true, startedAt: true, reopenStartTime: true },
  });
  const activeCountMap = {};
  for (const a of activeAttempts) {
    const test = tests.find((t) => t.id === a.testId);
    if (!test) continue;
    if (a.reopenStartTime && a.startedAt >= a.reopenStartTime) {
      activeCountMap[a.testId] = (activeCountMap[a.testId] ?? 0) + 1;
    } else if (!a.reopenStartTime && now >= test.startTime && now <= test.endTime) {
      activeCountMap[a.testId] = (activeCountMap[a.testId] ?? 0) + 1;
    }
  }

  res.json(
    tests.map((t) =>
      serializeTestSummary(t, activeCountMap[t.id] ?? 0),
    ),
  );
});

// "Details" button on the add-questions page — re-shows the audience
// selections made in step 1. Also used as the source of truth when
// opening the "edit test" flow on an already-created test.
export const getTestDetails = asyncHandler(async (req, res) => {
  const { testId } = req.params;

  await assertOwnsTest(testId, req.user.adminId);

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      institutionLinks: { include: { institution: true } },
      departmentLinks: { include: { department: true } },
      batchLinks: { include: { batch: true } },
      questions: { include: { testCases: true }, orderBy: { order: 'asc' } },
      poolLinks: {
        include: {
          pool: {
            include: {
              categories: { include: { questions: true } },
            },
          },
        },
      },
    },
  });

  const attemptCount = await prisma.testAttempt.count({ where: { testId } });

  res.json({ ...serializeTestDetails(test), attemptCount });
});

// Generates and downloads an Excel file with per-student scores
// for every question and their total score.
export const getTestAnalysis = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const sortOrder = req.query.sort === 'asc' ? 'asc' : 'desc';

  await assertOwnsTest(testId, req.user.adminId);

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      questions: { orderBy: { order: 'asc' } },
      poolLinks: true,
    },
  });
  if (!test) throw new HttpError(404, 'Test not found.');

  const isPoolBased = test.poolLinks.length > 0;
  const poolIds = test.poolLinks.map((l) => l.poolId);

  let questions;
  if (isPoolBased) {
    const poolQuestions = await prisma.poolQuestion.findMany({
      where: {
        poolId: { in: poolIds },
        ...(test.selectedCategoryIds.length > 0 ? { categoryId: { in: test.selectedCategoryIds } } : {}),
        ...(test.selectedQuestionIds.length > 0 ? { id: { in: test.selectedQuestionIds } } : {}),
      },
      orderBy: { order: 'asc' },
    });
    questions = poolQuestions;
  } else {
    questions = test.questions;
  }

  const attempts = await prisma.testAttempt.findMany({
    where: { testId },
    include: {
      student: {
        include: {
          user: true,
          institution: true,
          department: true,
          batch: true,
        },
      },
      submissions: true,
      attemptAssignments: { include: { poolQuestion: true }, orderBy: { order: 'asc' } },
    },
    orderBy: { startedAt: 'asc' },
  });

  if (attempts.length === 0) {
    throw new HttpError(400, 'No submissions yet for this test.');
  }

  function formatDate(d) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}  ${hours}:${mins} ${ampm}`;
  }

  function formatDuration(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    if (mins === 0) return `${secs} secs`;
    return `${mins} mins ${secs} secs`;
  }

  // Compute score & duration for each attempt to enable sorting
  const attemptMeta = attempts.map((attempt) => {
    const bestByQ = new Map();
    for (const s of attempt.submissions) {
      const key = s.questionId || s.poolQuestionId;
      const current = bestByQ.get(key);
      if (!current || s.pointsAwarded > current.pointsAwarded) {
        bestByQ.set(key, s);
      }
    }
    let total = 0;
    let studentMax = 0;
    if (isPoolBased) {
      for (const a of attempt.attemptAssignments) {
        studentMax += a.poolQuestion.points;
        total += bestByQ.get(a.poolQuestionId)?.pointsAwarded ?? 0;
      }
    } else {
      for (const q of questions) {
        studentMax += q.points;
        total += bestByQ.get(q.id)?.pointsAwarded ?? 0;
      }
    }
    return { attempt, total, studentMax, durationMs: attempt.submittedAt
      ? new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()
      : Infinity };
  });

  // For pool-based tests, maxScore is the highest per-student max (since
  // different students get different question subsets). For manual tests,
  // all students share the same set so the sum is correct.
  const maxScore = isPoolBased
    ? Math.max(...attemptMeta.map((m) => m.studentMax), 0)
    : questions.reduce((sum, q) => sum + q.points, 0);

  attemptMeta.forEach((m) => { m.pct = maxScore > 0 ? m.total / maxScore : 0; });

  attemptMeta.sort((a, b) => {
    const scoreCmp = sortOrder === 'asc' ? a.pct - b.pct : b.pct - a.pct;
    if (scoreCmp !== 0) return scoreCmp;
    // Same score: faster completion ranks higher (lower duration = better)
    return a.durationMs - b.durationMs;
  });

  const sortedAttempts = attemptMeta.map((m) => m.attempt);

  // For pool-based tests, each student gets a different subset, so we use
  // generic Q1/Q2/… headers and per-student "x/y" scores.
  const maxAssignments = isPoolBased
    ? Math.max(...attempts.map((a) => a.attemptAssignments?.length ?? 0), 0)
    : questions.length;

  const qHeaders = isPoolBased
    ? Array.from({ length: maxAssignments }, (_, i) => `Q${i + 1}`)
    : questions.map((q, i) => `Q. ${i + 1} /${q.points}`);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Analysis');
  const headers = [
    'First name', 'Email address', 'Institution', 'Department', 'Batch',
    'Status', 'Started', 'Completed', 'Duration',
    ...qHeaders,
    'Grade',
    'Warnings',
    'Disqualified At',
  ];
  sheet.addRow(headers);

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD89B4A' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 24;

  for (const attempt of sortedAttempts) {
    const { student, submissions, attemptAssignments, startedAt, submittedAt, warningCount, disqualifiedAt } = attempt;

    const bestByQ = new Map();
    for (const s of submissions) {
      const key = s.questionId || s.poolQuestionId;
      const current = bestByQ.get(key);
      if (!current || s.pointsAwarded > current.pointsAwarded) {
        bestByQ.set(key, s);
      }
    }

    const firstName = student.user.name;
    const isDisqualified = !!disqualifiedAt;
    const status = isDisqualified ? 'Disqualified' : submittedAt ? 'Finished' : 'In Progress';
    const startedStr = formatDate(new Date(startedAt));
    const completedStr = submittedAt ? formatDate(new Date(submittedAt)) : '';
    const duration = submittedAt
      ? formatDuration(new Date(submittedAt) - new Date(startedAt))
      : '';

    let total = 0;
    const scores = isPoolBased
      ? attemptAssignments.map((a) => {
          const sub = bestByQ.get(a.poolQuestionId);
          if (sub?.needsReview) return `Review Manually`;
          const pts = sub?.pointsAwarded ?? 0;
          total += pts;
          return `${pts}/${a.poolQuestion.points}`;
        })
      : questions.map((q) => {
          const sub = bestByQ.get(q.id);
          if (sub?.needsReview) return `Review Manually`;
          const pts = sub?.pointsAwarded ?? 0;
          total += pts;
          return pts;
        });

    // Pad pool-based rows so every student has the same column count
    if (isPoolBased) {
      while (scores.length < maxAssignments) scores.push('');
    }

    const disqualifiedStr = disqualifiedAt ? formatDate(new Date(disqualifiedAt)) : '';

    const row = sheet.addRow([
      firstName, student.user.email, student.institution.name, student.department.name, student.batch.name,
      status, startedStr, completedStr, duration,
      ...scores,
      `${total}/${maxScore}`,
      warningCount,
      disqualifiedStr,
    ]);

    if (isDisqualified) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEBEE' } };
      });
    } else if (submittedAt) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };
      });
    }
  }

  sheet.columns = headers.map((h) => ({
    width: Math.max(12, h.length + 4),
  }));

  sheet.eachRow((row) => {
    row.alignment = { vertical: 'middle' };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${test.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 100)}_analysis.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
});

export const getTestStats = asyncHandler(async (req, res) => {
  const { testId } = req.params;

  await assertOwnsTest(testId, req.user.adminId);

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      institutionLinks: true,
      departmentLinks: true,
      batchLinks: true,
      poolLinks: true,
    },
  });
  if (!test) throw new HttpError(404, 'Test not found.');

  const isPoolBased = test.poolLinks.length > 0;
  const poolIds = test.poolLinks.map((l) => l.poolId);

  const instIds = test.institutionLinks.map((l) => l.institutionId);
  const deptIds = test.departmentLinks.map((l) => l.departmentId);
  const batchIds = test.batchLinks.map((l) => l.batchId);

  const [attempts, targetAudienceCount] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { testId },
      include: {
        student: {
          include: {
            user: { select: { name: true, email: true } },
            department: true,
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    }),
    prisma.student.count({
      where: {
        institutionId: { in: instIds },
        departmentId: { in: deptIds },
        batchId: { in: batchIds },
      },
    }),
  ]);

  const submittedAttempts = attempts.filter((a) => a.submittedAt);
  const totalAttempted = submittedAttempts.length;

  const scores = submittedAttempts.map((a) => a.totalScore ?? 0);
  const overallAvg = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;

  const deptMap = {};
  for (const a of submittedAttempts) {
    const deptName = a.student.department.name;
    if (!deptMap[deptName]) deptMap[deptName] = { scores: [], count: 0 };
    deptMap[deptName].scores.push(a.totalScore ?? 0);
    deptMap[deptName].count++;
  }
  const avgByDept = Object.entries(deptMap).map(([name, data]) => ({
    department: name,
    averageScore: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
    count: data.count,
  }));

  let maxPossibleScore = 0;
  if (isPoolBased) {
    // For pool tests, maxPossibleScore is the highest per-student max
    const submittedWithAssignments = await prisma.testAttempt.findMany({
      where: { testId, submittedAt: { not: null } },
      include: { attemptAssignments: { include: { poolQuestion: { select: { points: true } } } } },
    });
    maxPossibleScore = Math.max(
      ...submittedWithAssignments.map((a) =>
        a.attemptAssignments.reduce((s, ap) => s + ap.poolQuestion.points, 0)
      ),
      0
    );
  } else {
    const questions = await prisma.question.findMany({
      where: { testId },
      select: { points: true },
    });
    maxPossibleScore = questions.reduce((s, q) => s + q.points, 0);
  }

  const pcts = maxPossibleScore > 0 ? scores.map((s) => Math.round((s / maxPossibleScore) * 100)) : [];
  const buckets = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const distribution = buckets.map((bin) => {
    const label = `${bin}-${bin + 10}`;
    const count = pcts.filter((p) => p >= bin && p < bin + 10).length;
    return { range: label, count };
  });

  const allFinished = computeDisplayStatus(test) === 'ENDED';

  res.json({
    targetAudience: targetAudienceCount,
    totalAttempted,
    overallAverageScore: overallAvg,
    maxPossibleScore,
    averageByDepartment: avgByDept,
    distribution,
    allFinished,
  });
});

function computeDisplayStatus(test) {
  if (test.status === 'DRAFT') return 'DRAFT';
  if (test.status === 'COMPLETED') return 'ENDED';
  const now = new Date();
  if (now < test.startTime) return 'SCHEDULED';
  if (now > test.endTime) return 'ENDED';
  return 'ACTIVE';
}

function computeQuestionCount(test) {
  if (test.poolLinks && test.poolLinks.length > 0) {
    return test.questionsPerStudent ?? 0;
  }
  return test._count?.questions ?? 0;
}

function serializeTestSummary(test, activeAttemptCount = 0) {
  const batchesByDept = {};
  for (const link of test.batchLinks) {
    const deptId = link.batch.departmentId;
    if (!batchesByDept[deptId]) batchesByDept[deptId] = [];
    batchesByDept[deptId].push(link.batch.name);
  }

  const deptsByInst = {};
  for (const link of test.departmentLinks) {
    const instId = link.department.institutionId;
    if (!deptsByInst[instId]) deptsByInst[instId] = [];
    deptsByInst[instId].push(link.department);
  }

  const audience = test.institutionLinks.map((il) => {
    const instId = il.institution.id;
    const departments = (deptsByInst[instId] || []).map((dept) => ({
      name: dept.name,
      batches: batchesByDept[dept.id] || [],
    }));
    return { institution: il.institution.name, departments };
  });

  return {
    id: test.id,
    title: test.title,
    status: test.status,
    displayStatus: computeDisplayStatus(test),
    startTime: test.startTime,
    endTime: test.endTime,
    questionCount: computeQuestionCount(test),
    audience,
    institutions: test.institutionLinks.map((l) => l.institution.name),
    departments: test.departmentLinks.map((l) => l.department.name),
    batches: test.batchLinks.map((l) => l.batch.name),
    selectedPoolIds: (test.poolLinks || []).map((l) => l.poolId),
    activeAttemptCount,
  };
}

function serializeTestDetails(test) {
  return {
    id: test.id,
    title: test.title,
    status: test.status,
    displayStatus: computeDisplayStatus(test),
    startTime: test.startTime,
    endTime: test.endTime,
    durationMinutes: test.durationMinutes,
    maxWarnings: test.maxWarnings,
    securityEnabled: test.securityEnabled,
    questionCount: computeQuestionCount(test),
    institutions: test.institutionLinks.map((l) => l.institution),
    departments: test.departmentLinks.map((l) => l.department),
    batches: test.batchLinks.map((l) => l.batch),
    questions: test.questions ?? [],
    questionSource: (test.poolLinks && test.poolLinks.length > 0) ? 'pool' : 'manual',
    selectedPoolIds: (test.poolLinks || []).map((l) => l.poolId),
    questionsPerStudent: test.questionsPerStudent,
    selectedCategoryIds: test.selectedCategoryIds,
    selectedQuestionIds: test.selectedQuestionIds,
    questionsPerCategory: test.questionsPerCategory,
  };
}
