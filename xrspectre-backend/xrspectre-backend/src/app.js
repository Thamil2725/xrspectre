import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import crypto from 'node:crypto';
import { join } from 'node:path';
import { config } from './config/env.js';
import { prisma } from './config/prisma.js';
import { errorHandler } from './middleware/errorHandler.js';
import { verifyToken } from './utils/auth.js';

import authRoutes from './routes/authRoutes.js';
import orgRoutes from './routes/orgRoutes.js';
import testAdminRoutes from './routes/testAdminRoutes.js';
import testStudentRoutes from './routes/testStudentRoutes.js';
import poolRoutes from './routes/poolRoutes.js';
import studentAdminRoutes from './routes/studentAdminRoutes.js';
import adminManagementRoutes from './routes/adminManagementRoutes.js';
import mentorRoutes from './routes/mentorRoutes.js';
import mentorManagementRoutes from './routes/mentorManagementRoutes.js';

// Rate-limit authenticated traffic per user rather than per IP: during an
// exam a whole lab usually sits behind one NAT address, and an IP-keyed
// limit would throttle every student in the room together.
function userOrIpKey(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice('Bearer '.length));
      if (payload?.userId) return `user:${payload.userId}`;
    } catch { /* fall back to IP */ }
  }
  return `ip:${ipKeyGenerator(req.ip)}`;
}

export function createApp() {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  if (config.clientOrigin.length > 0) {
    app.use(cors({ origin: config.clientOrigin }));
  }
  app.use(express.json({ limit: '2mb' }));

  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
  });

  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: userOrIpKey,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use('/api/', globalLimiter);

  // Brute-force protection per (IP, account), plus a looser per-IP cap
  // that still lets a full lab of students log in at the same time.
  const loginPerAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email ?? '').trim().toLowerCase()}`,
    message: { error: 'Too many login attempts for this account. Try again later.' },
  });
  const loginPerIpLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again later.' },
  });
  app.use('/api/auth/login', loginPerIpLimiter, loginPerAccountLimiter);

  const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 150,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many signup attempts. Try again later.' },
  });
  app.use('/api/auth/signup', signupLimiter);

  const health = async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok', executionProvider: config.executionProvider, db: 'connected' });
    } catch {
      res.status(503).json({ status: 'degraded', executionProvider: config.executionProvider, db: 'disconnected' });
    }
  };
  app.get('/health', health);
  app.get('/api/health', health);

  app.use('/api/auth', authRoutes);
  app.use('/api/org', orgRoutes);
  app.use('/api/admin/tests', testAdminRoutes);
  app.use('/api/student/tests', testStudentRoutes);
  app.use('/api/admin/pools', poolRoutes);
  app.use('/api/admin/students', studentAdminRoutes);
  app.use('/api/admin/admins', adminManagementRoutes);
  app.use('/api/admin/mentors', mentorManagementRoutes);
  app.use('/api/mentor', mentorRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // Serve the built single-page app (same origin as the API).
  if (config.staticDir) {
    const assetsDir = join(config.staticDir, 'assets');
    app.use(express.static(config.staticDir, {
      index: false,
      setHeaders(res, filePath) {
        // Vite assets are content-hashed, so they can be cached forever.
        if (filePath.startsWith(assetsDir)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(join(config.staticDir, 'index.html'));
    });
  }

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use(errorHandler);

  return app;
}
