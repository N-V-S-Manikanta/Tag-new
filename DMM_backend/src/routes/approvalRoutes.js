import express from 'express';
import {
  getApprovals,
  getApproval,
  createApproval,
  approveRequest,
  rejectRequest,
  resubmitRequest,
  markPosted,
  deleteApproval,
} from '../controllers/approvalController.js';
import { protect, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
router.use(protect);

router.route('/').get(getApprovals).post(upload.array('images', 10), createApproval);
router.route('/:id').get(getApproval).delete(deleteApproval);

// ADMIN is the global approver (head of all organizations), so they can
// approve/reject alongside the per-organization CEO.
router.put('/:id/approve', authorize(ROLES.CEO, ROLES.ADMIN), approveRequest);
router.put('/:id/reject', authorize(ROLES.CEO, ROLES.ADMIN), rejectRequest);
router.put('/:id/resubmit', upload.array('images', 10), resubmitRequest);
router.put('/:id/posted', markPosted);

export default router;
