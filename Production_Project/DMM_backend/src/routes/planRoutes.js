import express from 'express';
import {
  getPlans, getPlan, createPlan, updatePlan, approvePlan, rejectPlan, deletePlan,
} from '../controllers/postPlanController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Role scoping lives in the controller (ADMIN all orgs, CEO own org, USER own plans).
router.route('/').get(getPlans).post(createPlan);
router.route('/:id').get(getPlan).put(updatePlan).delete(deletePlan);
router.put('/:id/approve', approvePlan);
router.put('/:id/reject', rejectPlan);

export default router;
