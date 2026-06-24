import express from 'express';
import { getActivityLogs } from '../controllers/activityController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);
router.get('/', getActivityLogs);

export default router;
