import { prisma } from '../config/prisma.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';

// A mentor may only see students in their institution AND one of their
// departments AND one of their batches.
export async function loadMentorScope(mentorId) {
  const mentor = await prisma.mentor.findUnique({
    where: { id: mentorId },
    select: {
      institutionId: true,
      departments: { select: { id: true } },
      batches: { select: { id: true } },
    },
  });
  if (!mentor) throw new HttpError(404, 'Mentor profile not found.');
  return {
    institutionId: mentor.institutionId,
    deptIds: mentor.departments.map((d) => d.id),
    batchIds: mentor.batches.map((b) => b.id),
  };
}

export function mentorCanSeeStudent(scope, student) {
  return student.institutionId === scope.institutionId
    && scope.deptIds.includes(student.departmentId)
    && scope.batchIds.includes(student.batchId);
}

// Route middleware: rejects requests for students outside the mentor's scope.
export const requireMentorStudentAccess = asyncHandler(async (req, res, next) => {
  const scope = await loadMentorScope(req.user.mentorId);
  const student = await prisma.student.findUnique({
    where: { id: req.params.studentId },
    select: { institutionId: true, departmentId: true, batchId: true },
  });
  if (!student) throw new HttpError(404, 'Student not found.');
  if (!mentorCanSeeStudent(scope, student)) throw new HttpError(403, 'You do not have access to this student.');
  next();
});
