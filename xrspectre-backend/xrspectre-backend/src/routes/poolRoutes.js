import { Router } from 'express';
import {
  listPools, getPoolDetails, createPool, updatePool, deletePool,
  listCategories, createCategory, deleteCategory,
  listQuestions, createQuestion, updateQuestion, deleteQuestion,
} from '../controllers/poolController.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('ADMIN'));

router.get('/', listPools);
router.post('/', createPool);
router.get('/:poolId', getPoolDetails);
router.patch('/:poolId', updatePool);
router.delete('/:poolId', deletePool);

router.get('/:poolId/categories', listCategories);
router.post('/:poolId/categories', createCategory);
router.delete('/categories/:categoryId', deleteCategory);

router.get('/:poolId/questions', listQuestions);
router.post('/:poolId/questions', createQuestion);
router.patch('/questions/:questionId', updateQuestion);
router.delete('/questions/:questionId', deleteQuestion);

export default router;