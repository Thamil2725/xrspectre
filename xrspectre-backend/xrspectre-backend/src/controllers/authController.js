import { prisma } from '../config/prisma.js';
import { hashPassword, verifyPassword, signToken } from '../utils/auth.js';
import { studentSignupSchema, loginSchema } from '../utils/validation.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';

export const getMe = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
  if (!user) throw new HttpError(404, 'User not found.');
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

export const signupStudent = asyncHandler(async (req, res) => {
  const data = studentSignupSchema.parse(req.body);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'An account with this email already exists.');

  const [institution, department, batch] = await Promise.all([
    prisma.institution.findUnique({ where: { id: data.institutionId } }),
    prisma.department.findUnique({ where: { id: data.departmentId } }),
    prisma.batch.findUnique({ where: { id: data.batchId } }),
  ]);

  if (!institution) throw new HttpError(400, 'The selected institution does not exist.');
  if (!department) throw new HttpError(400, 'The selected department does not exist.');
  if (!batch) throw new HttpError(400, 'The selected batch does not exist.');
  if (department.institutionId !== data.institutionId) {
    throw new HttpError(400, 'The selected department does not belong to the chosen institution.');
  }
  if (batch.institutionId !== data.institutionId || batch.departmentId !== data.departmentId) {
    throw new HttpError(400, 'The selected batch does not belong to the chosen institution and department.');
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'STUDENT',
      student: {
        create: {
          institutionId: data.institutionId,
          departmentId: data.departmentId,
          batchId: data.batchId,
        },
      },
    },
  });

  const token = signToken({ userId: user.id, role: 'STUDENT' });
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);

  // Case-insensitive lookup so accounts created before e-mails were
  // normalised can still sign in.
  const user = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
  });

  // Always run bcrypt (against a dummy hash when the user is unknown) so
  // response timing does not reveal which e-mails are registered.
  const validPassword = await verifyPassword(data.password, user?.passwordHash);
  if (!user || !validPassword) throw new HttpError(401, 'Invalid email or password.');

  const token = signToken({ userId: user.id, role: user.role });

  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});
