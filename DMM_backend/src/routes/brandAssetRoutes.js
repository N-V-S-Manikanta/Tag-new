import express from 'express';
import {
  listBrandAssets,
  createBrandAsset,
  updateBrandAsset,
  deleteBrandAsset,
} from '../controllers/brandAssetController.js';
import { protect, authorize } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();
router.use(protect);

router.get('/', listBrandAssets);                                              // org members can view/download
router.post('/', authorize(ROLES.ADMIN), upload.single('file'), createBrandAsset);
router.put('/:id', authorize(ROLES.ADMIN), updateBrandAsset);
router.delete('/:id', authorize(ROLES.ADMIN), deleteBrandAsset);

export default router;
