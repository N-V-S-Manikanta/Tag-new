import express from 'express';
import { aiStatus, aiChat } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Any authenticated user can chat — tools scope personal data by role.
router.get('/status', aiStatus);
router.post('/chat', aiChat);

export default router;
