import express from 'express';
import {
  listSocialAccounts,
  createSocialAccount,
  updateSocialAccount,
  deleteSocialAccount,
} from '../controllers/socialAccountController.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
router.use(protect);

router.get('/', listSocialAccounts);
router.post('/', authorize(ROLES.ADMIN), createSocialAccount);
router.put('/:id', authorize(ROLES.ADMIN), updateSocialAccount);
router.delete('/:id', authorize(ROLES.ADMIN), deleteSocialAccount);

export default router;
