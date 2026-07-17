import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { createWorkAssignment, listWorkAssignments } from '../controllers/workAssignmentController.js';

const router = express.Router();

router.use(protect);
router.use(authorize(ROLES.ADMIN, ROLES.CEO, ROLES.USER));

router.route('/').get(listWorkAssignments).post(createWorkAssignment);

export default router;