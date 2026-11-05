import { Router } from 'express';
import {
  createTest,
  addQuestion,
  updateQuestion,
  removeQuestion,
  updateAudience,
  scheduleTest,
  reopenTest,
  deleteTest,
  deleteAllTests,
  listTests,
  getTestDetails,
  getTestAnalysis,
  getTestStats,
} from '../controllers/testAdminController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', listTests);
router.post('/', createTest);
router.get('/:testId', getTestDetails);
router.get('/:testId/analysis', getTestAnalysis);
router.get('/:testId/stats', getTestStats);
router.patch('/:testId/audience', updateAudience);
router.post('/:testId/questions', addQuestion);
router.patch('/:testId/questions/:questionId', updateQuestion);
router.delete('/:testId/questions/:questionId', removeQuestion);
router.post('/:testId/schedule', scheduleTest);
router.post('/:testId/reopen', reopenTest);
router.delete('/', deleteAllTests);
router.delete('/:testId', deleteTest);

export default router;
