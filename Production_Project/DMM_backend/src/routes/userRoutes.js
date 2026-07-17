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
  completeProfile,
  myProfileRequest,
  requestProfileUpdate,
  listProfileRequests,
  reviewProfileRequest,
} from '../controllers/userController.js';
import { protect, authorize, requireSuperAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
router.use(protect);

// Self-service (any authenticated user)
router.put('/profile', upload.single('avatar'), updateProfile);
router.put('/profile/complete', completeProfile);
router.route('/profile/update-request').get(myProfileRequest).post(requestProfileUpdate);
router.put('/password', changePassword);
router.put('/settings', updateSettings);

// Profile update review queue (ADMIN). Registered before '/:id' so the path
// isn't swallowed by the param route.
router.get('/profile-requests', authorize(ROLES.ADMIN), listProfileRequests);
router.put('/profile-requests/:id', authorize(ROLES.ADMIN), reviewProfileRequest);

// Admins can VIEW users; only the super admin can create / edit / delete them.
router.route('/').get(authorize(ROLES.ADMIN), getUsers).post(requireSuperAdmin, createUser);
router.put('/:id/reset-password', requireSuperAdmin, adminResetPassword);
router
  .route('/:id')
  .get(authorize(ROLES.ADMIN), getUser)
  .put(requireSuperAdmin, updateUser)
  .delete(requireSuperAdmin, deleteUser);

export default router;
