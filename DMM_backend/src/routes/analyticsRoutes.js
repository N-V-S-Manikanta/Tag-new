import express from 'express';
import {
  getAnalytics,
  getPlatformReport,
  getPlatformHistory,
  compareOrganizations,
  recordAnalytics,
} from '../controllers/analyticsController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
router.use(protect);

router.get('/', getAnalytics);
router.get('/compare', authorize(ROLES.ADMIN), compareOrganizations); // before /:platform
router.post('/', authorize(ROLES.ADMIN, ROLES.CEO), recordAnalytics);
router.get('/:platform/report', getPlatformReport);
router.get('/:platform/history', getPlatformHistory);

export default router;
