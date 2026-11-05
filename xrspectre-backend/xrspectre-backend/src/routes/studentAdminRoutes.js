import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { listStudents, bulkUploadStudents, reopenAttempt, getAttemptDetails, downloadAttemptDetail, deleteStudent, exportStudents } from '../controllers/studentController.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/export', exportStudents);
router.get('/', listStudents);
router.post('/bulk-upload', bulkUploadStudents);
router.post('/reopen-attempt/:testId', reopenAttempt);
router.get('/:studentId/attempts/:attemptId', getAttemptDetails);
router.get('/:studentId/attempts/:attemptId/download', downloadAttemptDetail);
router.delete('/:studentId', deleteStudent);

export default router;
