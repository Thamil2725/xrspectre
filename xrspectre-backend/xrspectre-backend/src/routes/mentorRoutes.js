import { Router } from 'express';
import { listStudents, getStudentAttempts } from '../controllers/mentorController.js';
import { getAttemptDetails, downloadAttemptDetail } from '../controllers/studentController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireMentorStudentAccess } from '../utils/mentorScope.js';

const router = Router();

router.use(requireAuth, requireRole('MENTOR'));

router.get('/students', listStudents);

// The attempt detail/PDF handlers are shared with admins, so the mentor's
// student scope must be enforced here before delegating to them.
router.get('/students/:studentId/attempts', requireMentorStudentAccess, getStudentAttempts);
router.get('/students/:studentId/attempts/:attemptId', requireMentorStudentAccess, getAttemptDetails);
router.get('/students/:studentId/attempts/:attemptId/download', requireMentorStudentAccess, downloadAttemptDetail);

export default router;
