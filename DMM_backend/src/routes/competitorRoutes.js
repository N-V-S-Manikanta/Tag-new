import express from 'express';
import {
  listCompetitors,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
} from '../controllers/competitorController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
router.use(protect);

// CEO/USER can view their org's competitor benchmark; only ADMIN edits.
router.get('/', listCompetitors);
router.post('/', authorize(ROLES.ADMIN), createCompetitor);
router.put('/:id', authorize(ROLES.ADMIN), updateCompetitor);
router.delete('/:id', authorize(ROLES.ADMIN), deleteCompetitor);

export default router;
