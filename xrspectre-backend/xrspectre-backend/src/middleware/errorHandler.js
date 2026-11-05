// Catches errors thrown (or passed to next()) from any route handler.
// Keeps controllers free of repetitive try/catch boilerplate.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const isClientError = err.name === 'ZodError' || ['P2002', 'P2025', 'P2003'].includes(err.code);
  const status = err.status || err.statusCode || (isClientError ? 400 : 500);
  if (status >= 500) console.error(`[${req.id ?? '-'}]`, err);

  // A streaming response (SSE, PDF, XLSX) may already have started.
  if (res.headersSent) {
    try { res.end(); } catch { /* ignore */ }
    return;
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation failed.', details: err.issues });
  }

  if (err.code === 'P2002') {
    // Prisma unique constraint violation
    return res.status(409).json({ error: 'A record with these details already exists.' });
  }

  if (err.code === 'P2025') {
    // Prisma record not found
    return res.status(404).json({ error: 'Record not found.' });
  }

  if (err.code === 'P2003') {
    // Foreign key violation — e.g. deleting something still in use.
    const text = String(err.meta?.constraint ?? err.meta?.field_name ?? err.message ?? '').toLowerCase();
    let detail = 'other data';
    if (text.includes('attempt')) detail = 'student attempts';
    else if (text.includes('submission')) detail = 'submissions';
    else if (text.includes('department')) detail = 'departments';
    else if (text.includes('batch')) detail = 'batches';
    else if (text.includes('student')) detail = 'students';
    else if (text.includes('mentor')) detail = 'mentors';
    else if (text.includes('test')) detail = 'tests';
    else if (text.includes('institution')) detail = 'institutions';
    else if (text.includes('pool')) detail = 'question pools';
    return res.status(409).json({ error: `This record is still referenced by ${detail} and cannot be deleted.` });
  }

  if (status >= 500) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
  res.status(status).json({ error: err.expose === false ? 'Request failed.' : (err.message || 'Request failed.') });
}

// Wraps an async route handler so thrown errors reach errorHandler
// without needing try/catch in every controller.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
