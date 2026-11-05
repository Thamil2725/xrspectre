import { prisma } from '../config/prisma.js';
import { asyncHandler, HttpError } from '../middleware/errorHandler.js';
import { mentorSignupSchema } from '../utils/validation.js';
import { hashPassword } from '../utils/auth.js';

export const listMentors = asyncHandler(async (req, res) => {
  const mentors = await prisma.mentor.findMany({
    where: { user: { role: 'MENTOR' } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      institution: { select: { id: true, name: true } },
      departments: { select: { id: true, name: true } },
      batches: { select: { id: true, name: true, departmentId: true } },
    },
    orderBy: { user: { createdAt: 'asc' } },
  });

  res.json(mentors.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    email: m.user.email,
    institution: m.institution.name,
    departments: m.departments.map((d) => ({ id: d.id, name: d.name })),
    batches: m.batches.map((b) => ({ id: b.id, name: b.name, departmentId: b.departmentId })),
    institutionId: m.institutionId,
  })));
});

export const createMentor = asyncHandler(async (req, res) => {
  const data = mentorSignupSchema.parse(req.body);
  const departmentIds = [...new Set(data.departmentIds)];
  const batchIds = [...new Set(data.batchIds)];

  const existing = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'An account with this email already exists.');

  // Every department/batch must belong to the mentor's institution —
  // otherwise a mentor could be scoped to students they shouldn't see.
  const [institution, departments, batches] = await Promise.all([
    prisma.institution.findUnique({ where: { id: data.institutionId }, select: { id: true } }),
    prisma.department.findMany({ where: { id: { in: departmentIds } }, select: { id: true, institutionId: true } }),
    prisma.batch.findMany({ where: { id: { in: batchIds } }, select: { id: true, institutionId: true, departmentId: true } }),
  ]);
  if (!institution) throw new HttpError(400, 'The selected institution does not exist.');
  if (departments.length !== departmentIds.length || departments.some((d) => d.institutionId !== data.institutionId)) {
    throw new HttpError(400, 'Every department must belong to the selected institution.');
  }
  if (batches.length !== batchIds.length || batches.some((b) => b.institutionId !== data.institutionId || !departmentIds.includes(b.departmentId))) {
    throw new HttpError(400, 'Every batch must belong to one of the selected departments.');
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'MENTOR',
      mentor: {
        create: {
          institutionId: data.institutionId,
          departments: { connect: departmentIds.map((id) => ({ id })) },
          batches: { connect: batchIds.map((id) => ({ id })) },
        },
      },
    },
    include: {
      mentor: {
        include: {
          institution: { select: { name: true } },
          departments: { select: { id: true, name: true } },
          batches: { select: { id: true, name: true } },
        },
      },
    },
  });

  res.status(201).json({
    id: user.mentor.id,
    userId: user.id,
    name: user.name,
    email: user.email,
    institution: user.mentor.institution.name,
    departments: user.mentor.departments.map((d) => ({ id: d.id, name: d.name })),
    batches: user.mentor.batches.map((b) => ({ id: b.id, name: b.name })),
  });
});

export const deleteMentor = asyncHandler(async (req, res) => {
  const { mentorId } = req.params;

  const mentor = await prisma.mentor.findUnique({ where: { id: mentorId } });
  if (!mentor) throw new HttpError(404, 'Mentor not found.');

  await prisma.user.delete({ where: { id: mentor.userId } });

  res.json({ message: 'Mentor deleted.' });
});
