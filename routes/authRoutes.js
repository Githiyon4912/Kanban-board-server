import { Router } from 'express';
import {
  signup,
  login,
  logout,
  me,
  updateProfile,
  deleteAccount,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = Router();
router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', protect, logout);
router.get('/me', protect, me);
router.patch('/me', protect, updateProfile);
router.delete('/me', protect, deleteAccount);

export default router;
