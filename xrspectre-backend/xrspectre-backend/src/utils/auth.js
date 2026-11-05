import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/env.js';

const SALT_ROUNDS = 10;
const JWT_ALGORITHM = 'HS256';

// Pre-computed hash used to keep login timing constant when the email
// does not exist, so response times don't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('xrspectre-timing-equaliser', SALT_ROUNDS);

export function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

export function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash ?? DUMMY_HASH);
}

export function signToken(payload) {
  // payload: { userId, role }
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '12h', algorithm: JWT_ALGORITHM });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret, { algorithms: [JWT_ALGORITHM] });
}

// E-mail addresses are stored lower-cased so "Jane@x.com" and
// "jane@x.com" can't become two different accounts.
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}
