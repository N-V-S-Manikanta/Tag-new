import express from 'express';
import { exportReport, approvalAnalytics } from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/summary/approval-analytics', approvalAnalytics);
router.get('/:type', exportReport); // type: approval | posting | template | asset | activity

export default router;
