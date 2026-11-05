import { Router } from 'express';
import {
  listInstitutions,
  listDepartments,
  listBatches,
  createInstitution,
  createDepartment,
  createBatch,
  deleteInstitution,
  deleteDepartment,
  deleteBatch,
} from '../controllers/orgController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Public read access — needed for signup forms before a user has an account.
router.get('/institutions', listInstitutions);
router.get('/departments', listDepartments);
router.get('/batches', listBatches);

// Only admins can add or remove org entries.
router.post('/institutions', requireAuth, requireRole('ADMIN'), createInstitution);
router.post('/departments', requireAuth, requireRole('ADMIN'), createDepartment);
router.post('/batches', requireAuth, requireRole('ADMIN'), createBatch);

router.delete('/institutions/:id', requireAuth, requireRole('ADMIN'), deleteInstitution);
router.delete('/departments/:id', requireAuth, requireRole('ADMIN'), deleteDepartment);
router.delete('/batches/:id', requireAuth, requireRole('ADMIN'), deleteBatch);

export default router;
