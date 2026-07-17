import express from 'express';
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from '../controllers/eventController.js';
import { protect } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();
router.use(protect);

// Any authenticated user can view and add events (shared workspace). Editing and
// deleting are restricted to the creator or an Admin (enforced in the controller).
router.get('/', listEvents);
router.post('/', upload.single('cover'), createEvent);
router.put('/:id', upload.single('cover'), updateEvent);
router.delete('/:id', deleteEvent);

export default router;
