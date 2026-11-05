import { z } from 'zod';
import { normalizeEmail } from './auth.js';

const email = z.string().trim().max(254).email().transform(normalizeEmail);
const name = z.string().trim().min(1).max(100);
// bcrypt only uses the first 72 bytes, so cap passwords well below
// anything that would silently be truncated.
const password = z.string().min(8).max(72);
const id = z.string().trim().min(1).max(64);

export const studentSignupSchema = z.object({
  name,
  email,
  password,
  institutionId: id,
  departmentId: id,
  batchId: id,
});

export const adminSignupSchema = z.object({
  name,
  email,
  password,
});

export const mentorSignupSchema = z.object({
  name,
  email,
  password,
  institutionId: id,
  departmentIds: z.array(id).min(1),
  batchIds: z.array(id).min(1),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

// Spreadsheet cells can arrive as numbers; missing cells must stay empty
// (z.coerce.string() would turn undefined into the string "undefined").
const cell = (schema) => z.preprocess((v) => (v == null ? '' : String(v)), schema);

export const bulkStudentRowSchema = z.object({
  name: cell(z.string().trim().min(1, 'Name is required.').max(100)),
  email: cell(z.string().trim().max(254).email('Invalid e-mail address.').transform(normalizeEmail)),
  password: cell(z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be at most 72 characters.')),
  institution: cell(z.string().trim().min(1, 'Institution is required.')),
  department: cell(z.string().trim().min(1, 'Department is required.')),
  batch: cell(z.string().trim().min(1, 'Batch is required.')),
});
