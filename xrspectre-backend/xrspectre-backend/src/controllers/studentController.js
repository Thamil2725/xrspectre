import PDFDocument from 'pdfkit';
import { prisma } from '../config/prisma.js';
import { hashPassword } from '../utils/auth.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';
import { bulkStudentRowSchema } from '../utils/validation.js';

const MAX_BULK_ROWS = 2000;

// Quote a CSV cell and neutralise spreadsheet formulas (=, +, -, @, tab,
// CR) so exported names/e-mails can't execute when opened in Excel.
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const listStudents = asyncHandler(async (req, res) => {
  const { institutionId, departmentId, batchId, search } = req.query;

  const where = {};
  if (institutionId) where.institutionId = institutionId;
  if (departmentId) where.departmentId = departmentId;
  if (batchId) where.batchId = batchId;

  const students = await prisma.student.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      institution: { select: { name: true } },
      department: { select: { name: true } },
      batch: { select: { name: true } },
      attempts: {
        select: {
          id: true, testId: true, startedAt: true, submittedAt: true, totalScore: true,
          disqualifiedAt: true, reopenedAt: true, reopenStartTime: true, reopenEndTime: true,
          test: { select: { title: true, startTime: true, endTime: true } },
          submissions: { select: { needsReview: true } },
        },
      },
    },
  });

  const result = students.map((s) => ({
    id: s.id,
    name: s.user.name,
    email: s.user.email,
    institution: s.institution.name,
    department: s.department.name,
    batch: s.batch.name,
    institutionId: s.institutionId,
    departmentId: s.departmentId,
    batchId: s.batchId,
    attempts: s.attempts.map((a) => ({
      id: a.id,
      testId: a.testId,
      testTitle: a.test.title,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      totalScore: a.totalScore,
      disqualifiedAt: a.disqualifiedAt,
      reopenedAt: a.reopenedAt,
      reopenStartTime: a.reopenStartTime,
      reopenEndTime: a.reopenEndTime,
      testStartTime: a.test.startTime,
      testEndTime: a.test.endTime,
      hasNeedsReview: a.submissions?.some((s) => s.needsReview) || false,
    })),
  }));

  let filtered = result;
  if (search) {
    if (typeof search !== 'string' || search.length > 100) {
      throw new HttpError(400, 'Invalid search parameter.');
    }
    const q = search.toLowerCase();
    filtered = filtered.filter((s) => s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
  }

  // For each student find tests assigned to their org but not yet attempted
  if (filtered.length > 0) {
    const orgInstIds = [...new Set(filtered.map((s) => s.institutionId))];
    const orgDeptIds = [...new Set(filtered.map((s) => s.departmentId))];
    const orgBatchIds = [...new Set(filtered.map((s) => s.batchId))];

    const assignedTests = await prisma.test.findMany({
      where: {
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        OR: [
          { institutionLinks: { some: { institutionId: { in: orgInstIds } } } },
          { departmentLinks: { some: { departmentId: { in: orgDeptIds } } } },
          { batchLinks: { some: { batchId: { in: orgBatchIds } } } },
        ],
      },
      select: {
        id: true, title: true, status: true, startTime: true, endTime: true,
        institutionLinks: { select: { institutionId: true } },
        departmentLinks: { select: { departmentId: true } },
        batchLinks: { select: { batchId: true } },
      },
    });

    const testIds = assignedTests.map((t) => t.id);

    // Detect globally reopened tests: a test is globally reopened if it has
    // attempts where reopenStartTime/reopenEndTime match the test's own times
    // (set by the admin "reopen test" flow).
    const candidateReopenAttempts = await prisma.testAttempt.findMany({
      where: { testId: { in: testIds }, reopenedAt: { not: null } },
      select: { testId: true, reopenStartTime: true, reopenEndTime: true },
    });
    const globallyReopenedTestIds = new Set();
    for (const ra of candidateReopenAttempts) {
      const test = assignedTests.find((t) => t.id === ra.testId);
      if (test && ra.reopenStartTime && ra.reopenEndTime &&
          ra.reopenStartTime.getTime() === test.startTime.getTime() &&
          ra.reopenEndTime.getTime() === test.endTime.getTime()) {
        globallyReopenedTestIds.add(ra.testId);
      }
    }

    for (const s of filtered) {
      const pending = [];
      for (const t of assignedTests) {
        if (s.attempts.some((a) => a.testId === t.id)) continue;
        const matchesInst = t.institutionLinks.some((l) => l.institutionId === s.institutionId);
        const matchesDept = t.departmentLinks.some((l) => l.departmentId === s.departmentId);
        const matchesBatch = t.batchLinks.some((l) => l.batchId === s.batchId);
        // Same rule as the student's access check: all three must match.
        if (matchesInst && matchesDept && matchesBatch) {
          pending.push({ id: t.id, title: t.title, startTime: t.startTime, endTime: t.endTime, isGloballyReopened: globallyReopenedTestIds.has(t.id) });
        }
      }
      s.pendingTests = pending;
    }
  }

  res.json(filtered);
});

export const bulkUploadStudents = asyncHandler(async (req, res) => {
  const { students } = req.body ?? {};
  if (!Array.isArray(students) || students.length === 0) {
    throw new HttpError(400, 'students array is required and must not be empty.');
  }
  if (students.length > MAX_BULK_ROWS) {
    throw new HttpError(400, `At most ${MAX_BULK_ROWS} students can be uploaded at once.`);
  }

  const results = { success: 0, errors: [] };

  const norm = (s) => s.toLowerCase().replace(/\s+/g, '');

  const allInstitutions = await prisma.institution.findMany();
  const allDepartments = await prisma.department.findMany();
  const allBatches = await prisma.batch.findMany();

  const seenEmails = new Set();
  for (let i = 0; i < students.length; i++) {
    const raw = students[i] ?? {};
    const rowNum = i + 2;

    try {
      const parsed = bulkStudentRowSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(parsed.error.issues.map((issue) => issue.message).join(' '));
      }
      const row = parsed.data;

      if (seenEmails.has(row.email)) throw new Error(`Email "${row.email}" appears more than once in this file.`);
      seenEmails.add(row.email);

      const existing = await prisma.user.findFirst({
        where: { email: { equals: row.email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) {
        throw new Error(`Email "${row.email}" is already in use.`);
      }

      const institution = allInstitutions.find((i) => norm(i.name) === norm(row.institution));
      if (!institution) throw new Error(`Institution "${row.institution}" not found.`);

      const department = allDepartments.find(
        (d) => norm(d.name) === norm(row.department) && d.institutionId === institution.id
      );
      if (!department) throw new Error(`Department "${row.department}" not found under "${row.institution}".`);

      const batch = allBatches.find(
        (b) => norm(b.name) === norm(row.batch) && b.institutionId === institution.id && b.departmentId === department.id
      );
      if (!batch) throw new Error(`Batch "${row.batch}" not found under "${row.department}".`);

      const passwordHash = await hashPassword(row.password);

      await prisma.user.create({
        data: {
          name: row.name,
          email: row.email,
          passwordHash,
          role: 'STUDENT',
          student: {
            create: {
              institutionId: institution.id,
              departmentId: department.id,
              batchId: batch.id,
            },
          },
        },
      });

      results.success++;
    } catch (err) {
      results.errors.push({ row: rowNum, email: typeof raw.email === 'string' ? raw.email : '', message: err.message });
    }
  }

  res.json(results);
});

export const reopenAttempt = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const { studentId, startTime, endTime } = req.body ?? {};
  const adminId = req.user.adminId;

  if (typeof studentId !== 'string' || !studentId) throw new HttpError(400, 'studentId is required.');
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (!startTime || !endTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new HttpError(400, 'Valid startTime and endTime are required.');
  }
  if (end <= start) throw new HttpError(400, 'endTime must be after startTime.');
  if (end.getTime() <= Date.now()) throw new HttpError(400, 'endTime must be in the future.');

  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) throw new HttpError(404, 'Test not found.');
  if (test.adminId !== adminId) throw new HttpError(403, 'You do not own this test.');

  const attempt = await prisma.testAttempt.findUnique({
    where: { testId_studentId: { testId, studentId } },
  });
  if (!attempt) throw new HttpError(404, 'No attempt found for this student on this test.');
  if (!attempt.submittedAt) throw new HttpError(400, 'This attempt has not been submitted yet.');

  await prisma.testAttempt.update({
    where: { id: attempt.id },
    data: {
      warningCount: 0,
      disqualifiedAt: null,
      reopenedAt: new Date(),
      reopenStartTime: start,
      reopenEndTime: end,
    },
  });

  res.json({ message: 'Attempt reopened successfully.' });
});

export const getAttemptDetails = asyncHandler(async (req, res) => {
  const { studentId, attemptId } = req.params;

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
          selectedQuestionIds: true,
          selectedCategoryIds: true,
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
        },
      },
    },
  });

  if (!attempt) throw new HttpError(404, 'Attempt not found.');
  if (attempt.studentId !== studentId) throw new HttpError(403, 'This attempt does not belong to this student.');

  // Build question list from actual assigned questions, not all pool questions
  const attemptPoolIds = attempt.test.poolLinks.map((l) => l.poolId);
  let questions;
  if (attemptPoolIds.length > 0 && attempt.attemptAssignments.length > 0) {
    questions = attempt.attemptAssignments.map((a) => ({
      id: a.poolQuestion.id,
      title: a.poolQuestion.title,
      points: a.poolQuestion.points,
      type: a.poolQuestion.type,
    }));
  } else {
    questions = attempt.test.questions;
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  // Group submissions by question
  const subsByQuestion = new Map();
  for (const sub of attempt.submissions) {
    const key = sub.questionId || sub.poolQuestionId;
    if (!subsByQuestion.has(key)) subsByQuestion.set(key, []);
    subsByQuestion.get(key).push(sub);
  }

  const questionDetails = questions.map((q) => {
    const subs = subsByQuestion.get(q.id) || [];

    // Best submission by points
    const best = subs.reduce((b, s) => (!b || s.pointsAwarded > b.pointsAwarded ? s : b), null);

    // Deduplicate submissions by code, keeping the best-scoring one per unique code
    const bestByCode = new Map();
    for (const s of subs) {
      const codeKey = s.code || s.answer || '';
      if (!codeKey) { bestByCode.set(s.id, s); continue; }
      const existing = bestByCode.get(codeKey);
      if (!existing || s.pointsAwarded > existing.pointsAwarded) {
        if (existing) bestByCode.delete(existing.id);
        bestByCode.set(codeKey, s);
      }
    }
    const uniqueSubs = Array.from(bestByCode.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    // Time spent: from first to last submission for this question
    const firstSub = subs.length > 0 ? subs[0].createdAt : null;
    const lastSub = subs.length > 0 ? subs[subs.length - 1].createdAt : null;
    const timeSpentMs = firstSub && lastSub ? new Date(lastSub).getTime() - new Date(firstSub).getTime() : 0;
    const timeSpentSecs = Math.floor(timeSpentMs / 1000);

    return {
      questionId: q.id,
      title: q.title,
      points: q.points,
      type: q.type,
      bestScore: best?.pointsAwarded ?? 0,
      bestPassedCount: best?.passedCount ?? 0,
      bestTotalCount: best?.totalCount ?? 0,
      bestStatus: best?.status ?? null,
      totalSubmissions: subs.length,
      uniqueSubmissions: uniqueSubs.length,
      timeSpentSecs,
      submissions: uniqueSubs.map((s) => ({
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
      runCount: attempt.runCount,
      warningCount: attempt.warningCount,
      disqualifiedAt: attempt.disqualifiedAt,
    },
    testTitle: attempt.test.title,
    student: {
      name: attempt.student.user.name,
      email: attempt.student.user.email,
      institution: attempt.student.institution?.name ?? '',
      department: attempt.student.department?.name ?? '',
      batch: attempt.student.batch?.name ?? '',
    },
    questionDetails,
  });
});

export const downloadAttemptDetail = asyncHandler(async (req, res) => {
  const { studentId, attemptId } = req.params;

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
          questions: { orderBy: { order: 'asc' }, select: { id: true, title: true, points: true, type: true } },
          poolLinks: { select: { poolId: true } }, selectedQuestionIds: true, selectedCategoryIds: true,
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
        },
      },
    },
  });

  if (!attempt) throw new HttpError(404, 'Attempt not found.');
  if (attempt.studentId !== studentId) throw new HttpError(403, 'This attempt does not belong to this student.');

  let questions;
  const attemptPoolIds2 = attempt.test.poolLinks.map((l) => l.poolId);
  if (attemptPoolIds2.length > 0 && attempt.attemptAssignments.length > 0) {
    questions = attempt.attemptAssignments.map((a) => ({
      id: a.poolQuestion.id,
      title: a.poolQuestion.title,
      points: a.poolQuestion.points,
      type: a.poolQuestion.type,
    }));
  } else {
    questions = attempt.test.questions;
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
  const totalScore = attempt.totalScore ?? 0;
  const pct = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;

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
    const timeSpentMs = firstSub && lastSub ? new Date(lastSub).getTime() - new Date(firstSub).getTime() : 0;
    const timeSpentSecs = Math.floor(timeSpentMs / 1000);
    const qpct = q.points > 0 ? Math.round(((best?.pointsAwarded ?? 0) / q.points) * 100) : 0;

    const bestByCode = new Map();
    for (const s of subs) {
      const codeKey = s.code || s.answer || '';
      if (!codeKey) { bestByCode.set(s.id, s); continue; }
      const existing = bestByCode.get(codeKey);
      if (!existing || s.pointsAwarded > existing.pointsAwarded) {
        if (existing) bestByCode.delete(existing.id);
        bestByCode.set(codeKey, s);
      }
    }
    const uniqueSubs = Array.from(bestByCode.values()).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    return {
      questionId: q.id, title: q.title, points: q.points, type: q.type,
      bestScore: best?.pointsAwarded ?? 0, bestPassedCount: best?.passedCount ?? 0,
      bestTotalCount: best?.totalCount ?? 0, bestStatus: best?.status ?? null,
      totalSubmissions: subs.length, uniqueSubmissions: uniqueSubs.length,
      timeSpentSecs, pct: qpct,
      submissions: uniqueSubs.map((s) => ({
        id: s.id, language: s.language, code: s.code, answer: s.answer,
        status: s.status, passedCount: s.passedCount, totalCount: s.totalCount,
        pointsAwarded: s.pointsAwarded, createdAt: s.createdAt,
      })),
    };
  });

  const passedCount = questionDetails.filter(q => q.bestScore > 0 && q.bestScore >= q.points).length;
  const durationSecs = attempt.startedAt && attempt.submittedAt
    ? Math.floor((new Date(attempt.submittedAt).getTime() - new Date(attempt.startedAt).getTime()) / 1000)
    : 0;
  const durMin = Math.floor(durationSecs / 60);
  const durSec = durationSecs % 60;
  const durStr = durMin > 0 ? `${durMin}m ${durSec}s` : `${durSec}s`;

  const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attempt_${attempt.id}.pdf"`);
  doc.pipe(res);

  const ACCENT = '#e8a317',
    DARK = '#1a1a1a',
    MUTED = '#888888',
    WHITE = '#ffffff',
    PAGE_BG = '#f7f5f2',
    CARD_BG = '#ffffff',
    LINE = '#e8e5e0',
    ST_BG0 = '#e8f5e9', ST_FG0 = '#2e7d32',
    ST_BG1 = '#fff3e0', ST_FG1 = '#e65100',
    ST_BG2 = '#ffebee', ST_FG2 = '#c62828';
  const X = 44, W = doc.page.width - 88;
  const R = 8;
  const Y_LIMIT = 740;

  function fmtDur(s) {
    if (!s || s < 0) return '0s';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
  }
  function ensureSpace(n) { if (doc.y + n > Y_LIMIT) doc.addPage(); }

  // Page background
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(PAGE_BG);

  // ── Accent bar ──
  doc.rect(0, 0, doc.page.width, 4).fill(ACCENT);

  // ── Header ──
  doc.fontSize(18).fillColor(DARK).font('Helvetica-Bold').text(attempt.test.title, X, 30);
  doc.fontSize(8).fillColor(MUTED).font('Helvetica')
    .text(attempt.student.user.name + '  \u2022  ' +
      (attempt.student.institution?.name ?? '') + '  \u2022  ' +
      (attempt.student.department?.name ?? '') + '  \u2022  ' +
      (attempt.student.batch?.name ?? ''),
      X, doc.y + 2, { width: W });
  doc.moveDown(0.8);

  // ── Summary row cards ──
  var summaryY = doc.y;
  var cardW = (W - 16) / 3;
  function summaryCard(value, label, color, cx) {
    var cy = summaryY;
    doc.roundedRect(X + cx, cy, cardW, 48, R).fill(CARD_BG);
    doc.fontSize(16).font('Helvetica-Bold').fillColor(color)
      .text(value, X + cx, cy + 8, { width: cardW, align: 'center' });
    doc.fontSize(7).font('Helvetica').fillColor(MUTED)
      .text(label.toUpperCase(), X + cx, cy + 30, { width: cardW, align: 'center' });
  }
  summaryCard(totalScore + ' / ' + totalPoints, 'Score', ACCENT, 0);
  summaryCard(passedCount + ' / ' + questionDetails.length, 'Solved', '#3b8a3b', cardW + 8);
  summaryCard(durStr, 'Duration', DARK, (cardW + 8) * 2);
  doc.y = summaryY + 60;

  // ── Warnings badge (if any) ──
  if (attempt.warningCount > 0) {
    var warnY = doc.y - 4;
    doc.fontSize(7).font('Helvetica-Bold').fillColor(ST_FG2);
    doc.text('\u26A0 ' + attempt.warningCount + ' warning' + (attempt.warningCount !== 1 ? 's' : ''), X, warnY, { width: W, align: 'right' });
  }

  doc.moveDown(0.3);

  // ── Divider ──
  var divY = doc.y;
  doc.moveTo(X, divY).lineTo(X + W, divY).strokeColor(LINE).lineWidth(0.5).stroke();
  doc.y = divY + 10;

  // ── Per-question cards ──
  for (var qi = 0; qi < questionDetails.length; qi++) {
    var q = questionDetails[qi];
    var qPct = q.points > 0 ? Math.round((q.bestScore / q.points) * 100) : 0;

    var failedSubs = q.submissions.filter(function(s) { return s.status !== 'PASSED'; });
    var hasNotes = failedSubs.length > 0 && q.bestScore < q.points;

    // Measure card
    var rowsH = Math.max(q.submissions.length, 1) * 20;
    var notesH = hasNotes ? 18 + failedSubs.length * 28 : 0;
    var qCardH = 26 + 18 + rowsH + notesH + 14;
    ensureSpace(qCardH + 12);

    var qCardY = doc.y;
    doc.roundedRect(X, qCardY, W, qCardH, R).fill(CARD_BG);

    // Question header row
    var qTopY = qCardY + 6;
    doc.fontSize(9).font('Helvetica-Bold').fillColor(DARK)
      .text('Q' + (qi + 1) + '. ' + q.title, X + 14, qTopY + 2, { width: W - 160 });

    // Score badge
    var badgeX = X + W - 72;
    var badgeW = 60;
    var badgeH = 20;
    var badgeBg = qPct === 100 ? ST_BG0 : qPct > 0 ? ST_BG1 : ST_BG2;
    var badgeFg = qPct === 100 ? ST_FG0 : qPct > 0 ? ST_FG1 : ST_FG2;
    doc.roundedRect(badgeX, qTopY, badgeW, badgeH, 5).fill(badgeBg);
    doc.fontSize(8).font('Helvetica-Bold').fillColor(badgeFg)
      .text(q.bestScore + ' / ' + q.points, badgeX, qTopY + 4, { width: badgeW, align: 'center' });

    // Meta line
    doc.fontSize(7).font('Helvetica').fillColor(MUTED)
      .text(fmtDur(q.timeSpentSecs) + '  \u2022  ' + q.uniqueSubmissions + ' submission' + (q.uniqueSubmissions !== 1 ? 's' : ''), X + 14, qTopY + 18, { width: W - 72 });

    // Table
    var tblX = X + 10;
    var tblW = W - 20;
    var tblY = qTopY + 32;
    var colW = tblW / 4;
    var rowH = 20;
    var rowR = 4;

    // Header row
    doc.roundedRect(tblX, tblY, tblW, rowH, rowR).fill(ACCENT);
    doc.fontSize(6.5).font('Helvetica-Bold').fillColor(WHITE);
    doc.text('Language', tblX + 6, tblY + 6, { width: colW - 6 });
    doc.text('Tests', tblX + colW + 6, tblY + 6, { width: colW - 6 });
    doc.text('Score', tblX + colW * 2 + 6, tblY + 6, { width: colW - 6 });
    doc.text('Status', tblX + colW * 3 + 6, tblY + 6, { width: colW - 6 });

    var dataStartY = tblY + rowH;

    for (var si = 0; si < q.submissions.length; si++) {
      var sub = q.submissions[si];
      var rowY = dataStartY + si * rowH;
      var isLast = si === q.submissions.length - 1;
      var rowBg = si % 2 === 0 ? CARD_BG : '#f5f3ef';

      if (isLast) {
        doc.roundedRect(tblX, rowY, tblW, rowH, rowR).fill(rowBg);
      } else {
        doc.rect(tblX, rowY, tblW, rowH).fill(rowBg);
      }

      doc.fontSize(6.5).font('Courier').fillColor(DARK);
      doc.text(sub.language || '-', tblX + 6, rowY + 6, { width: colW - 6 });

      doc.font('Helvetica').fillColor(MUTED);
      var tc = sub.totalCount > 0 ? sub.passedCount + ' / ' + sub.totalCount : '—';
      doc.text(tc, tblX + colW + 6, rowY + 6, { width: colW - 6 });

      doc.font('Helvetica-Bold').fillColor(DARK);
      doc.text(String(sub.pointsAwarded), tblX + colW * 2 + 6, rowY + 6, { width: colW - 6 });

      // Status badge
      var st = sub.status || '-';
      var sBg = st === 'PASSED' ? ST_BG0 : st === 'PARTIAL' ? ST_BG1 : ST_BG2;
      var sFg = st === 'PASSED' ? ST_FG0 : st === 'PARTIAL' ? ST_FG1 : ST_FG2;
      var sLabel = st === 'PASSED' ? 'PASS' : st === 'PARTIAL' ? 'PARTIAL' : st === 'FAILED' ? 'FAIL' : st;
      var sw = doc.widthOfString(sLabel, { font: 'Helvetica-Bold', fontSize: 6 }) + 12;
      var sx = tblX + colW * 3 + (colW - sw) / 2;
      doc.roundedRect(sx, rowY + 3, sw, 14, 3).fill(sBg);
      doc.fontSize(6).font('Helvetica-Bold').fillColor(sFg)
        .text(sLabel, sx, rowY + 4, { width: sw, align: 'center' });
    }

    doc.y = dataStartY + q.submissions.length * rowH + 4;

    // Notes/errors
    if (hasNotes) {
      doc.moveDown(1);
      var ny = doc.y;
      var nw = tblW;
      var nh = 14 + failedSubs.length * 26;

      doc.roundedRect(tblX, ny, nw, nh, 5).fill(PAGE_BG);
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#bf6f00')
        .text('Notes', tblX + 8, ny + 4, { width: nw });

      for (var ni = 0; ni < failedSubs.length; ni++) {
        var ns = failedSubs[ni];
        var code = ns.code || ns.answer || null;
        var ny2 = ny + 14 + ni * 26;

        doc.fontSize(6).font('Helvetica').fillColor(MUTED)
          .text((ns.language || '?') + ' \u2014 ' + (ns.status || '?'), tblX + 10, ny2, { width: nw - 16 });

        if (code) {
          var codeLines = code.split('\n').slice(0, 2);
          var preview = codeLines.join('\n');
          var ch = Math.min(doc.heightOfString(preview, { width: nw - 28, font: 'Courier', fontSize: 5 }) + 4, 24);
          doc.roundedRect(tblX + 10, ny2 + 8, nw - 20, ch, 3).fill(WHITE);
          doc.fontSize(5).font('Courier').fillColor(MUTED)
            .text(preview, tblX + 14, ny2 + 10, { width: nw - 28, height: ch - 4, ellipsis: true });
        }
      }
      doc.y = ny + nh + 4;
    }

    doc.y = qCardY + qCardH + 8;
  }

  // ── Footer ──
  ensureSpace(14);
  doc.moveDown(0.3);
  doc.fontSize(6).font('Helvetica').fillColor(MUTED)
    .text('Generated on ' + new Date().toLocaleString(), X, doc.y, { width: W, align: 'center' });

  doc.end();
});

export const deleteStudent = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, userId: true } });
  if (!student) throw new HttpError(404, 'Student not found.');

  await prisma.$transaction(async (tx) => {
    await tx.submission.deleteMany({ where: { studentId } });
    await tx.testAttempt.deleteMany({ where: { studentId } });
    await tx.user.delete({ where: { id: student.userId } }); // cascades to the student profile
  });

  res.json({ ok: true });
});

export const exportStudents = asyncHandler(async (req, res) => {
  const { institutionId, departmentId, batchId, count } = req.query;

  const where = {};
  if (institutionId) where.institutionId = institutionId;
  if (departmentId) where.departmentId = departmentId;
  if (batchId) where.batchId = batchId;

  if (count === 'true') {
    const total = await prisma.student.count({ where });
    return res.json({ count: total });
  }

  const students = await prisma.student.findMany({
    where,
    include: {
      user: { select: { name: true, email: true } },
      institution: { select: { name: true } },
      department: { select: { name: true } },
      batch: { select: { name: true } },
    },
    orderBy: [{ department: { name: 'asc' } }, { batch: { name: 'asc' } }, { user: { name: 'asc' } }],
  });

  const header = 'Name,Email,Institution,Department,Batch';
  const rows = students.map((s) =>
    [s.user.name, s.user.email, s.institution?.name, s.department?.name, s.batch?.name].map(csvCell).join(','),
  );

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
  res.send([header, ...rows].join('\n'));
});
