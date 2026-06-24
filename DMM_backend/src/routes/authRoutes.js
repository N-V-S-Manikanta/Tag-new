import express from 'express';
import {
  setupStatus,
  setup,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  emailStatus,
} from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/setup-status', setupStatus);
router.post('/setup', setup);
router.get('/email-status', emailStatus);
router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.get('/me', protect, getMe);

export default router;
