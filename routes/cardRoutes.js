import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  createCard,
  updateCard,
  deleteCard,
  moveCard,
} from '../controllers/cardController.js';

const router = Router();
router.use(protect);
router.post('/', createCard);
router.put('/move', moveCard);
router.patch('/:id', updateCard);
router.delete('/:id', deleteCard);

export default router;
