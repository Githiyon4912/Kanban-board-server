import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createList,
  updateList,
  deleteList,
  reorderLists,
} from '../controllers/listController.js';

const router = Router();
router.use(protect);
router.post('/', createList);
router.put('/reorder', reorderLists);
router.patch('/:id', updateList);
router.delete('/:id', deleteList);

export default router;
