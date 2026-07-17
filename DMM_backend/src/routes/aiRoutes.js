import express from 'express';
import { aiStatus, aiChat, aiDraft, aiInsights, aiReview } from '../controllers/aiController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

// Any authenticated user can chat — tools scope personal data by role.
router.get('/status', aiStatus);
router.post('/chat', aiChat);
// Draft on-brand post copy from a short brief (used by the approval composer).
router.post('/draft', aiDraft);
// Plain-English read-out of an organization's live analytics (cached 6h).
router.post('/insights', aiInsights);
// Pre-approval quality review of a post's copy (approvers only).
router.post('/review', aiReview);

export default router;
