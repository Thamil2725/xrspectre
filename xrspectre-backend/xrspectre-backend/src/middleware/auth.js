import { verifyToken } from '../utils/auth.js';
import { prisma } from '../config/prisma.js';

// Verifies the bearer token AND re-loads the account from the database,
// so a deleted (or demoted) user loses access immediately instead of
// keeping it until their 12h token expires. Role-specific profile IDs
// come from the database, never from the token.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  let payload;
  try {
    payload = verifyToken(header.slice('Bearer '.length));
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        role: true,
        student: { select: { id: true } },
        admin: { select: { id: true } },
        mentor: { select: { id: true } },
      },
    });
    if (!user || user.role !== payload.role) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    req.user = {
      userId: user.id,
      role: user.role,
      studentId: user.student?.id,
      adminId: user.admin?.id,
      mentorId: user.mentor?.id,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: `This action requires the ${role} role.` });
    }
    const profileId = { ADMIN: req.user.adminId, STUDENT: req.user.studentId, MENTOR: req.user.mentorId }[role];
    if (!profileId) {
      return res.status(403).json({ error: `No ${role.toLowerCase()} profile is linked to this account.` });
    }
    next();
  };
}
