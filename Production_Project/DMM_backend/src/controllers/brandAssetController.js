import asyncHandler from 'express-async-handler';
import BrandAsset from '../models/BrandAsset.js';
import { uploadBuffer, deleteFile } from '../config/storage.js';
import { requireOrgId } from '../utils/org.js';

export const BRAND_CATEGORIES = ['Flyer', 'Brochure', 'Branding Video', 'Image', 'Document', 'Other'];

const mediaTypeFromMime = (mime = '') => {
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('image/')) return 'image';
  return 'document';
};

// @route GET /api/brand — list brand library items for the active org
export const listBrandAssets = asyncHandler(async (req, res) => {
  // Shared workspace: brand assets from every organization are visible. An
  // optional ?organizationId narrows to one org.
  const { category, search } = req.query;
  const query = {};
  if (req.query.organizationId) query.organization = req.query.organizationId;
  if (category && category !== 'All') query.category = category;
  if (search) query.$or = [
    { title: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
  ];
  const items = await BrandAsset.find(query).populate('uploadedBy', 'name').populate('organization', 'name color').sort({ createdAt: -1 }).lean();
  res.json({ success: true, categories: BRAND_CATEGORIES, items });
});

// @route POST /api/brand  (ADMIN) — upload a file OR save an external link
export const createBrandAsset = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const { title, category, description, link } = req.body;
  if (!title?.trim()) { res.status(400); throw new Error('A title is required'); }

  let doc = { organization: orgId, title: title.trim(), category: category || 'Other', description: description || '', uploadedBy: req.user._id };

  if (req.file) {
    const up = await uploadBuffer(req.file.buffer, { folder: 'brand', originalName: req.file.originalname });
    doc = { ...doc, kind: 'file', url: up.url, publicId: up.publicId, mediaType: mediaTypeFromMime(req.file.mimetype) };
  } else if (link?.trim()) {
    doc = { ...doc, kind: 'link', url: link.trim(), mediaType: 'link' };
  } else {
    res.status(400); throw new Error('Provide a file to upload or an external link');
  }

  const asset = await BrandAsset.create(doc);
  res.status(201).json({ success: true, asset });
});

// @route PUT /api/brand/:id  (ADMIN) — edit metadata (title/category/description)
export const updateBrandAsset = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const asset = await BrandAsset.findOne({ _id: req.params.id, organization: orgId });
  if (!asset) { res.status(404); throw new Error('Item not found'); }
  const { title, category, description } = req.body;
  if (title !== undefined) asset.title = title;
  if (category !== undefined) asset.category = category;
  if (description !== undefined) asset.description = description;
  await asset.save();
  res.json({ success: true, asset });
});

// @route DELETE /api/brand/:id  (ADMIN)
export const deleteBrandAsset = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const asset = await BrandAsset.findOne({ _id: req.params.id, organization: orgId });
  if (!asset) { res.status(404); throw new Error('Item not found'); }
  if (asset.kind === 'file' && asset.publicId) await deleteFile(asset.publicId);
  await asset.deleteOne();
  res.json({ success: true, id: req.params.id });
});
