import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { z } from 'zod';

export const listInstitutions = asyncHandler(async (req, res) => {
  const institutions = await prisma.institution.findMany({ orderBy: { name: 'asc' } });
  res.json(institutions);
});

export const listDepartments = asyncHandler(async (req, res) => {
  const { institutionId } = req.query;
  const where = {};
  if (institutionId) where.institutionId = institutionId;
  const departments = await prisma.department.findMany({ where, orderBy: { name: 'asc' } });
  res.json(departments);
});

export const listBatches = asyncHandler(async (req, res) => {
  const { institutionId, departmentId } = req.query;
  const where = {};
  if (institutionId) where.institutionId = institutionId;
  if (departmentId) where.departmentId = departmentId;
  const batches = await prisma.batch.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { institution: true, department: true },
  });
  res.json(batches);
});

const orgName = z.string().trim().min(1).max(150);

const createInstitutionSchema = z.object({ name: orgName });
export const createInstitution = asyncHandler(async (req, res) => {
  const { name } = createInstitutionSchema.parse(req.body);
  const institution = await prisma.institution.create({ data: { name } });
  res.status(201).json(institution);
});

const createDepartmentSchema = z.object({ name: orgName, institutionId: z.string().min(1) });
export const createDepartment = asyncHandler(async (req, res) => {
  const { name, institutionId } = createDepartmentSchema.parse(req.body);
  const institution = await prisma.institution.findUnique({ where: { id: institutionId }, select: { id: true } });
  if (!institution) throw new HttpError(400, 'The selected institution does not exist.');
  const department = await prisma.department.create({ data: { name, institutionId } });
  res.status(201).json(department);
});

// Batches must hang off a department: student signup only accepts a
// batch whose institution AND department match the student's choice, so a
// batch without them could never be used.
const createBatchSchema = z.object({
  name: orgName,
  institutionId: z.string().min(1),
  departmentId: z.string().min(1),
});
export const createBatch = asyncHandler(async (req, res) => {
  const { name, institutionId, departmentId } = createBatchSchema.parse(req.body);
  const department = await prisma.department.findUnique({ where: { id: departmentId }, select: { institutionId: true } });
  if (!department || department.institutionId !== institutionId) {
    throw new HttpError(400, 'The selected department does not belong to the chosen institution.');
  }
  const duplicate = await prisma.batch.findFirst({ where: { name, institutionId, departmentId }, select: { id: true } });
  if (duplicate) throw new HttpError(409, 'A batch with this name already exists in this department.');
  const batch = await prisma.batch.create({ data: { name, institutionId, departmentId } });
  res.status(201).json(batch);
});

export const deleteInstitution = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const force = req.query.force === 'true';

  const counts = await prisma.$transaction([
    prisma.student.count({ where: { institutionId: id } }),
    prisma.testInstitution.count({ where: { institutionId: id } }),
    prisma.department.count({ where: { institutionId: id } }),
    prisma.batch.count({ where: { institutionId: id } }),
    prisma.mentor.count({ where: { institutionId: id } }),
  ]);
  const [studentCount, testLinkCount, deptCount, batchCount, mentorCount] = counts;
  const total = studentCount + testLinkCount + deptCount + batchCount + mentorCount;

  if (total > 0 && !force) {
    const details = [];
    if (deptCount > 0) details.push(`${deptCount} department${deptCount !== 1 ? 's' : ''}`);
    if (batchCount > 0) details.push(`${batchCount} batch${batchCount !== 1 ? 'es' : ''}`);
    if (studentCount > 0) details.push(`${studentCount} student${studentCount !== 1 ? 's' : ''}`);
    if (mentorCount > 0) details.push(`${mentorCount} mentor${mentorCount !== 1 ? 's' : ''}`);
    if (testLinkCount > 0) details.push(`${testLinkCount} test link${testLinkCount !== 1 ? 's' : ''}`);
    throw new HttpError(409,
      `This institution is referenced by ${details.join(', ')}. ` +
      'Delete again to confirm and cascade-delete all associated records.'
    );
  }

  await prisma.$transaction(async (tx) => {
    if (studentCount > 0) {
      const students = await tx.student.findMany({ where: { institutionId: id }, select: { id: true, userId: true } });
      const ids = students.map((s) => s.id);
      await tx.submission.deleteMany({ where: { studentId: { in: ids } } });
      await tx.testAttempt.deleteMany({ where: { studentId: { in: ids } } });
      // Deleting the user cascades to the student profile and frees the e-mail
      // (deleting only the Student row used to leave orphaned login accounts).
      await tx.user.deleteMany({ where: { id: { in: students.map((s) => s.userId) } } });
    }
    if (mentorCount > 0) {
      const mentors = await tx.mentor.findMany({ where: { institutionId: id }, select: { userId: true } });
      await tx.user.deleteMany({ where: { id: { in: mentors.map((m) => m.userId) } } });
    }
    if (testLinkCount > 0) await tx.testInstitution.deleteMany({ where: { institutionId: id } });
    if (deptCount > 0) await tx.department.deleteMany({ where: { institutionId: id } });
    if (batchCount > 0) await tx.batch.deleteMany({ where: { institutionId: id } });
    await tx.institution.delete({ where: { id } });
  });
  res.status(204).send();
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const force = req.query.force === 'true';

  const counts = await prisma.$transaction([
    prisma.student.count({ where: { departmentId: id } }),
    prisma.testDepartment.count({ where: { departmentId: id } }),
    prisma.batch.count({ where: { departmentId: id } }),
  ]);
  const [studentCount, testLinkCount, batchCount] = counts;
  const total = studentCount + testLinkCount + batchCount;

  if (total > 0 && !force) {
    const details = [];
    if (batchCount > 0) details.push(`${batchCount} batch${batchCount !== 1 ? 'es' : ''}`);
    if (studentCount > 0) details.push(`${studentCount} student${studentCount !== 1 ? 's' : ''}`);
    if (testLinkCount > 0) details.push(`${testLinkCount} test link${testLinkCount !== 1 ? 's' : ''}`);
    throw new HttpError(409,
      `This department is referenced by ${details.join(', ')}. ` +
      'Delete again to confirm and cascade-delete all associated records.'
    );
  }

  await prisma.$transaction(async (tx) => {
    if (studentCount > 0) {
      const students = await tx.student.findMany({ where: { departmentId: id }, select: { id: true, userId: true } });
      const ids = students.map((s) => s.id);
      await tx.submission.deleteMany({ where: { studentId: { in: ids } } });
      await tx.testAttempt.deleteMany({ where: { studentId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: students.map((s) => s.userId) } } });
    }
    if (testLinkCount > 0) await tx.testDepartment.deleteMany({ where: { departmentId: id } });
    if (batchCount > 0) await tx.batch.deleteMany({ where: { departmentId: id } });
    await tx.department.delete({ where: { id } });
  });

  res.status(204).send();
});

export const deleteBatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const force = req.query.force === 'true';

  const counts = await prisma.$transaction([
    prisma.student.count({ where: { batchId: id } }),
    prisma.testBatch.count({ where: { batchId: id } }),
  ]);
  const [studentCount, testLinkCount] = counts;
  const total = studentCount + testLinkCount;

  if (total > 0 && !force) {
    const details = [];
    if (studentCount > 0) details.push(`${studentCount} student${studentCount !== 1 ? 's' : ''}`);
    if (testLinkCount > 0) details.push(`${testLinkCount} test link${testLinkCount !== 1 ? 's' : ''}`);
    throw new HttpError(409,
      `This batch is referenced by ${details.join(', ')}. ` +
      'Delete again to confirm and cascade-delete all associated records.'
    );
  }

  await prisma.$transaction(async (tx) => {
    if (studentCount > 0) {
      const students = await tx.student.findMany({ where: { batchId: id }, select: { id: true, userId: true } });
      const ids = students.map((s) => s.id);
      await tx.submission.deleteMany({ where: { studentId: { in: ids } } });
      await tx.testAttempt.deleteMany({ where: { studentId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: students.map((s) => s.userId) } } });
    }
    if (testLinkCount > 0) await tx.testBatch.deleteMany({ where: { batchId: id } });
    await tx.batch.delete({ where: { id } });
  });

  res.status(204).send();
});
