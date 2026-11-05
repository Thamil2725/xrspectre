import { Router } from 'express';
import { listMentors, createMentor, deleteMentor } from '../controllers/mentorManagementController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', listMentors);
router.post('/', createMentor);
router.delete('/:mentorId', deleteMentor);

export default router;
