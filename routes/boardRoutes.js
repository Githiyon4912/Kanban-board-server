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
import { getActivities } from '../controllers/activityController.js';

const router = Router();
router.use(protect);
router.get('/', getBoards);
router.post('/', createBoard);
router.post('/join', joinBoard);
router.get('/:id/activities', getActivities);
router.get('/:id', getBoardById);
router.patch('/:id', updateBoard);
router.delete('/:id', deleteBoard);

export default router;
