import { Router } from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getBoards,
  createBoard,
  getBoardById,
  joinBoard,
  updateBoard,
  deleteBoard,
} from '../controllers/boardController.js';

const router = Router();
router.use(protect);
router.get('/', getBoards);
router.post('/', createBoard);
router.post('/join', joinBoard);
router.get('/:id', getBoardById);
router.patch('/:id', updateBoard);
router.delete('/:id', deleteBoard);

export default router;
