import { Router } from 'express';
import { listAdmins, createAdmin, deleteAdmin } from '../controllers/adminManagementController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

router.get('/', listAdmins);
router.post('/', createAdmin);
router.delete('/:adminId', deleteAdmin);

export default router;
