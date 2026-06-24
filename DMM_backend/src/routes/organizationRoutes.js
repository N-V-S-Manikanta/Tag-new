import express from 'express';
import {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../controllers/organizationController.js';
import { protect, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
router.use(protect);

// All organization management is ADMIN-only.
router.route('/')
  .get(authorize(ROLES.ADMIN), getOrganizations)
  .post(authorize(ROLES.ADMIN), upload.single('logo'), createOrganization);
router.route('/:id')
  .get(authorize(ROLES.ADMIN), getOrganization)
  .put(authorize(ROLES.ADMIN), upload.single('logo'), updateOrganization)
  .delete(authorize(ROLES.ADMIN), deleteOrganization);

export default router;
