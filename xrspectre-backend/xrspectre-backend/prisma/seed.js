// Creates (or updates) the single administrator account.
//
//   ADMIN_EMAIL     login e-mail            (default: admin@xrspectre.com)
//   ADMIN_PASSWORD  login password, ≥ 12 characters
//   ADMIN_NAME      display name            (default: Administrator)
//
// Safe to run on every deploy: it is idempotent, and changing
// ADMIN_PASSWORD and redeploying rotates the admin's password.
// If ADMIN_PASSWORD is not set and no admin exists yet, a strong random
// password is generated and printed once to the log.
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/config/prisma.js';
import { hashPassword, verifyPassword, normalizeEmail } from '../src/utils/auth.js';

async function main() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || 'admin@xrspectre.com');
  const name = (process.env.ADMIN_NAME || 'Administrator').trim();
  let password = process.env.ADMIN_PASSWORD || '';

  if (password && password.length < 12) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters long.');
  }
  if (password.length > 72) {
    throw new Error('ADMIN_PASSWORD must be at most 72 characters long.');
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { admin: true },
  });

  if (existing && existing.role !== 'ADMIN') {
    throw new Error(`${email} already belongs to a ${existing.role.toLowerCase()} account; choose a different ADMIN_EMAIL.`);
  }

  if (existing) {
    if (!existing.admin) {
      await prisma.admin.create({ data: { userId: existing.id } });
    }
    if (password && !(await verifyPassword(password, existing.passwordHash))) {
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: await hashPassword(password) } });
      console.log(`Admin password updated for ${email}.`);
    } else {
      console.log(`Admin account ${email} already exists.`);
    }
    return;
  }

  let generated = false;
  if (!password) {
    password = randomBytes(18).toString('base64url');
    generated = true;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role: 'ADMIN',
      admin: { create: {} },
    },
  });

  console.log(`Created admin account: ${email}`);
  if (generated) {
    console.log('┌───────────────────────────────────────────────────────────────┐');
    console.log(`  Generated admin password: ${password}`);
    console.log('  Store it now — it will not be shown again. Set ADMIN_PASSWORD');
    console.log('  and redeploy to choose your own.');
    console.log('└───────────────────────────────────────────────────────────────┘');
  }
}

main()
  .catch((err) => {
    console.error('Seeding the admin account failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
