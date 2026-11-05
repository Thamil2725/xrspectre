import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  listAvailableTests,
  startOrResumeAttempt,
  runCode,
  submitQuestion,
  autoSubmit,
  submitTest,
  recordWarning,
  getMyAttemptDetails,
  downloadMyAttemptDetail,
} from '../controllers/testStudentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('STUDENT'));

// Code execution is the expensive part of the platform; limit it per
// student (not per IP — a whole exam hall often shares one address).
const executionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `student:${req.user.userId}`,
  message: { error: 'Too many execution requests. Please slow down.' },
});

router.get('/', listAvailableTests);
router.get('/attempts/:attemptId', getMyAttemptDetails);
router.get('/attempts/:attemptId/download', downloadMyAttemptDetail);
router.post('/:testId/attempt', startOrResumeAttempt);
router.post('/:testId/run', executionLimiter, runCode);
router.post('/:testId/submit-question', executionLimiter, submitQuestion);
router.post('/:testId/auto-submit', executionLimiter, autoSubmit);
router.post('/:testId/warning', recordWarning);
router.post('/:testId/submit', submitTest);

export default router;
