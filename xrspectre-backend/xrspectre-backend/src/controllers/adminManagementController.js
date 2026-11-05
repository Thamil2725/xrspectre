import { prisma } from '../config/prisma.js';
import { hashPassword } from '../utils/auth.js';
import { adminSignupSchema } from '../utils/validation.js';
import { HttpError, asyncHandler } from '../middleware/errorHandler.js';

export const listAdmins = asyncHandler(async (req, res) => {
  const users = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(users);
});

export const createAdmin = asyncHandler(async (req, res) => {
  const data = adminSignupSchema.parse(req.body);

  const existing = await prisma.user.findFirst({
    where: { email: { equals: data.email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) throw new HttpError(409, 'An account with this email already exists.');

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      role: 'ADMIN',
      admin: { create: {} },
    },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  res.status(201).json(user);
});

export const deleteAdmin = asyncHandler(async (req, res) => {
  const { adminId } = req.params;

  if (req.user.userId === adminId) {
    throw new HttpError(400, 'You cannot delete your own account.');
  }

  const user = await prisma.user.findUnique({
    where: { id: adminId },
    include: { admin: { select: { id: true, _count: { select: { testsCreated: true } } } } },
  });
  if (!user || user.role !== 'ADMIN') {
    throw new HttpError(404, 'Admin not found.');
  }

  const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
  if (adminCount <= 1) throw new HttpError(400, 'At least one admin account must remain.');

  if ((user.admin?._count.testsCreated ?? 0) > 0) {
    throw new HttpError(409, 'This admin still owns tests. Delete their tests before removing the account.');
  }

  await prisma.user.delete({ where: { id: adminId } });
  res.status(204).end();
});
