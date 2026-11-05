import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { loadMentorScope } from '../utils/mentorScope.js';

// A test is pending for a student when it is published, they haven't
// started it, and they are in its audience (institution AND department
// AND batch — the same rule the exam access check uses).
function pendingTestsFor(student, tests, attemptedTestIds) {
  return tests
    .filter((t) => !attemptedTestIds.has(t.id)
      && t.institutionLinks.some((l) => l.institutionId === student.institutionId)
      && t.departmentLinks.some((l) => l.departmentId === student.departmentId)
      && t.batchLinks.some((l) => l.batchId === student.batchId))
    .map((t) => ({ id: t.id, title: t.title, startTime: t.startTime, endTime: t.endTime }));
}

const PUBLISHED_TEST_SELECT = {
  id: true, title: true, startTime: true, endTime: true,
  institutionLinks: { select: { institutionId: true } },
  departmentLinks: { select: { departmentId: true } },
  batchLinks: { select: { batchId: true } },
};

// Mentor lists all students in their department + batch scope.
export const listStudents = asyncHandler(async (req, res) => {
  const scope = await loadMentorScope(req.user.mentorId);

  const students = await prisma.student.findMany({
    where: {
      institutionId: scope.institutionId,
      departmentId: { in: scope.deptIds },
      batchId: { in: scope.batchIds },
    },
    include: {
      user: { select: { name: true, email: true } },
      institution: { select: { name: true } },
      department: { select: { name: true } },
      batch: { select: { name: true } },
      attempts: {
        select: {
          id: true, testId: true, startedAt: true, submittedAt: true,
          totalScore: true, disqualifiedAt: true, reopenedAt: true,
          reopenStartTime: true, reopenEndTime: true,
          test: { select: { title: true, startTime: true, endTime: true } },
        },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  const assignedTests = await prisma.test.findMany({
    where: {
      status: { in: ['SCHEDULED', 'COMPLETED'] },
      institutionLinks: { some: { institutionId: scope.institutionId } },
      departmentLinks: { some: { departmentId: { in: scope.deptIds } } },
      batchLinks: { some: { batchId: { in: scope.batchIds } } },
    },
    select: PUBLISHED_TEST_SELECT,
  });

  res.json(students.map((s) => ({
    id: s.id,
    name: s.user.name,
    email: s.user.email,
    institution: s.institution.name,
    department: s.department.name,
    batch: s.batch.name,
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
    })),
    pendingTests: pendingTestsFor(s, assignedTests, new Set(s.attempts.map((a) => a.testId))),
  })));
});

// Mentor views a specific student's attempts. Scope is enforced by the
// requireMentorStudentAccess route middleware.
export const getStudentAttempts = asyncHandler(async (req, res) => {
  const { studentId } = req.params;

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      user: { select: { name: true, email: true } },
      department: { select: { name: true } },
      batch: { select: { name: true } },
    },
  });
  if (!student) throw new HttpError(404, 'Student not found.');

  const [attempts, assignedTests] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { studentId },
      include: {
        test: { select: { id: true, title: true, startTime: true, endTime: true, durationMinutes: true } },
      },
      orderBy: { startedAt: 'desc' },
    }),
    prisma.test.findMany({
      where: {
        status: { in: ['SCHEDULED', 'COMPLETED'] },
        institutionLinks: { some: { institutionId: student.institutionId } },
        departmentLinks: { some: { departmentId: student.departmentId } },
        batchLinks: { some: { batchId: student.batchId } },
      },
      select: PUBLISHED_TEST_SELECT,
    }),
  ]);

  res.json({
    student: {
      id: student.id,
      name: student.user.name,
      email: student.user.email,
      department: student.department.name,
      batch: student.batch.name,
    },
    attempts: attempts.map((a) => ({
      id: a.id,
      testId: a.testId,
      testTitle: a.test.title,
      testStartTime: a.test.startTime,
      testEndTime: a.test.endTime,
      startedAt: a.startedAt,
      submittedAt: a.submittedAt,
      disqualifiedAt: a.disqualifiedAt,
      totalScore: a.totalScore,
      warningCount: a.warningCount,
    })),
    pendingTests: pendingTestsFor(student, assignedTests, new Set(attempts.map((a) => a.testId))),
  });
});
