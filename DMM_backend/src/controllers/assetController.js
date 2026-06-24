import asyncHandler from 'express-async-handler';
import Asset from '../models/Asset.js';
import { uploadBuffer, deleteFile } from '../config/storage.js';
import { logActivity } from '../utils/logActivity.js';
import { requireOrgId } from '../utils/org.js';
import { ACTIVITY_ACTIONS } from '../config/constants.js';

const extOf = (name = '') => (name.split('.').pop() || '').toUpperCase();

// @route GET /api/assets (org-scoped)
export const getAssets = asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 12 } = req.query;
  const query = { organization: requireOrgId(req, res) };
  if (category && category !== 'All') query.category = category;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
  ];
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Asset.find(query).populate('uploadedBy', 'name avatar').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Asset.countDocuments(query),
  ]);
  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), assets: items });
});

// @route GET /api/assets/:id
export const getAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id).populate('uploadedBy', 'name avatar');
  if (!asset) { res.status(404); throw new Error('Asset not found'); }
  res.json({ success: true, asset });
});

// @route POST /api/assets
export const createAsset = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const { name, description, category } = req.body;
  if (!name || !category) { res.status(400); throw new Error('Name and category are required'); }
  if (!req.files?.file?.[0]) { res.status(400); throw new Error('Asset file is required'); }

  const file = req.files.file[0];
  const { url, publicId } = await uploadBuffer(file.buffer, { folder: 'assets', originalName: file.originalname });

  let previewImage = '', previewPublicId = '';
  if (req.files?.preview?.[0]) {
    const p = req.files.preview[0];
    const up = await uploadBuffer(p.buffer, { folder: 'assets', originalName: p.originalname });
    previewImage = up.url; previewPublicId = up.publicId;
  } else if (file.mimetype.startsWith('image/')) {
    previewImage = url;
  }

  const asset = await Asset.create({
    organization: orgId,
    name, description, category,
    fileUrl: url, filePublicId: publicId, fileName: file.originalname,
    fileType: extOf(file.originalname), fileSize: file.size,
    previewImage, previewPublicId,
    uploadedBy: req.user._id,
  });
  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.ASSET_UPLOAD, description: `Uploaded asset "${name}"`, entityType: 'Asset', entityId: asset._id });
  res.status(201).json({ success: true, asset });
});

// @route PUT /api/assets/:id
export const updateAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset || String(asset.organization) !== String(requireOrgId(req, res))) { res.status(404); throw new Error('Asset not found'); }
  if (String(asset.uploadedBy) !== String(req.user._id) && req.user.role !== 'CEO') {
    res.status(403); throw new Error('Not allowed to edit this asset');
  }
  const { name, description, category } = req.body;
  if (name) asset.name = name;
  if (description !== undefined) asset.description = description;
  if (category) asset.category = category;

  if (req.files?.file?.[0]) {
    if (asset.filePublicId) await deleteFile(asset.filePublicId);
    const file = req.files.file[0];
    const up = await uploadBuffer(file.buffer, { folder: 'assets', originalName: file.originalname });
    asset.fileUrl = up.url; asset.filePublicId = up.publicId; asset.fileName = file.originalname;
    asset.fileType = extOf(file.originalname); asset.fileSize = file.size;
  }
  if (req.files?.preview?.[0]) {
    if (asset.previewPublicId) await deleteFile(asset.previewPublicId);
    const p = req.files.preview[0];
    const up = await uploadBuffer(p.buffer, { folder: 'assets', originalName: p.originalname });
    asset.previewImage = up.url; asset.previewPublicId = up.publicId;
  }
  await asset.save();
  res.json({ success: true, asset });
});

// @route DELETE /api/assets/:id
export const deleteAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findById(req.params.id);
  if (!asset || String(asset.organization) !== String(requireOrgId(req, res))) { res.status(404); throw new Error('Asset not found'); }
  if (String(asset.uploadedBy) !== String(req.user._id) && req.user.role !== 'CEO') {
    res.status(403); throw new Error('Not allowed to delete this asset');
  }
  if (asset.filePublicId) await deleteFile(asset.filePublicId);
  if (asset.previewPublicId && asset.previewPublicId !== asset.filePublicId) await deleteFile(asset.previewPublicId);
  await asset.deleteOne();
  res.json({ success: true, message: 'Asset deleted' });
});

// @route POST /api/assets/:id/download
export const downloadAsset = asyncHandler(async (req, res) => {
  const asset = await Asset.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } }, { new: true });
  if (!asset) { res.status(404); throw new Error('Asset not found'); }
  res.json({ success: true, url: asset.fileUrl, fileName: asset.fileName });
});
