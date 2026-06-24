import express from 'express';
import {
  getUsers,
  createUser,
  getUser,
  updateUser,
  deleteUser,
  adminResetPassword,
  updateProfile,
  changePassword,
  updateSettings,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
router.use(protect);

// Self-service (any authenticated user)
router.put('/profile', upload.single('avatar'), updateProfile);
router.put('/password', changePassword);
router.put('/settings', updateSettings);

// Admin user management
router.route('/').get(authorize(ROLES.ADMIN), getUsers).post(authorize(ROLES.ADMIN), createUser);
router.put('/:id/reset-password', authorize(ROLES.ADMIN), adminResetPassword);
router
  .route('/:id')
  .get(authorize(ROLES.ADMIN), getUser)
  .put(authorize(ROLES.ADMIN), updateUser)
  .delete(authorize(ROLES.ADMIN), deleteUser);

export default router;
