import asyncHandler from 'express-async-handler';
import Template from '../models/Template.js';
import { uploadBuffer, deleteFile } from '../config/storage.js';
import { logActivity } from '../utils/logActivity.js';
import { requireOrgId } from '../utils/org.js';
import { ACTIVITY_ACTIONS } from '../config/constants.js';

const extOf = (name = '') => (name.split('.').pop() || '').toUpperCase();

// @route GET /api/templates  — search + filter + paginate (org-scoped)
export const getTemplates = asyncHandler(async (req, res) => {
  const { search, category, page = 1, limit = 12 } = req.query;
  const query = { organization: requireOrgId(req, res) };
  if (category && category !== 'All') query.category = category;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
  ];

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    Template.find(query).populate('uploadedBy', 'name avatar').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Template.countDocuments(query),
  ]);
  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), templates: items });
});

// @route GET /api/templates/:id
export const getTemplate = asyncHandler(async (req, res) => {
  const tpl = await Template.findById(req.params.id).populate('uploadedBy', 'name avatar');
  if (!tpl) { res.status(404); throw new Error('Template not found'); }
  res.json({ success: true, template: tpl });
});

// @route POST /api/templates
export const createTemplate = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const { name, description, category } = req.body;
  if (!name || !category) { res.status(400); throw new Error('Name and category are required'); }
  if (!req.files?.file?.[0]) { res.status(400); throw new Error('Template file is required'); }

  const file = req.files.file[0];
  const { url, publicId } = await uploadBuffer(file.buffer, { folder: 'templates', originalName: file.originalname });

  let thumbnail = '', thumbnailPublicId = '';
  if (req.files?.thumbnail?.[0]) {
    const t = req.files.thumbnail[0];
    const up = await uploadBuffer(t.buffer, { folder: 'templates', originalName: t.originalname });
    thumbnail = up.url; thumbnailPublicId = up.publicId;
  } else if (file.mimetype.startsWith('image/')) {
    thumbnail = url; // image templates are their own thumbnail
  }

  const tpl = await Template.create({
    organization: orgId,
    name, description, category,
    fileUrl: url, filePublicId: publicId, fileName: file.originalname,
    fileType: extOf(file.originalname), fileSize: file.size,
    thumbnail, thumbnailPublicId,
    uploadedBy: req.user._id,
  });
  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.TEMPLATE_UPLOAD, description: `Uploaded template "${name}"`, entityType: 'Template', entityId: tpl._id });
  res.status(201).json({ success: true, template: tpl });
});

// @route PUT /api/templates/:id
export const updateTemplate = asyncHandler(async (req, res) => {
  const tpl = await Template.findById(req.params.id);
  if (!tpl || String(tpl.organization) !== String(requireOrgId(req, res))) { res.status(404); throw new Error('Template not found'); }
  // Only owner or CEO can edit
  if (String(tpl.uploadedBy) !== String(req.user._id) && req.user.role !== 'CEO') {
    res.status(403); throw new Error('Not allowed to edit this template');
  }
  const { name, description, category } = req.body;
  if (name) tpl.name = name;
  if (description !== undefined) tpl.description = description;
  if (category) tpl.category = category;

  if (req.files?.file?.[0]) {
    if (tpl.filePublicId) await deleteFile(tpl.filePublicId);
    const file = req.files.file[0];
    const up = await uploadBuffer(file.buffer, { folder: 'templates', originalName: file.originalname });
    tpl.fileUrl = up.url; tpl.filePublicId = up.publicId; tpl.fileName = file.originalname;
    tpl.fileType = extOf(file.originalname); tpl.fileSize = file.size;
  }
  if (req.files?.thumbnail?.[0]) {
    if (tpl.thumbnailPublicId) await deleteFile(tpl.thumbnailPublicId);
    const t = req.files.thumbnail[0];
    const up = await uploadBuffer(t.buffer, { folder: 'templates', originalName: t.originalname });
    tpl.thumbnail = up.url; tpl.thumbnailPublicId = up.publicId;
  }
  await tpl.save();
  res.json({ success: true, template: tpl });
});

// @route DELETE /api/templates/:id
export const deleteTemplate = asyncHandler(async (req, res) => {
  const tpl = await Template.findById(req.params.id);
  if (!tpl || String(tpl.organization) !== String(requireOrgId(req, res))) { res.status(404); throw new Error('Template not found'); }
  if (String(tpl.uploadedBy) !== String(req.user._id) && req.user.role !== 'CEO') {
    res.status(403); throw new Error('Not allowed to delete this template');
  }
  if (tpl.filePublicId) await deleteFile(tpl.filePublicId);
  if (tpl.thumbnailPublicId && tpl.thumbnailPublicId !== tpl.filePublicId) await deleteFile(tpl.thumbnailPublicId);
  await tpl.deleteOne();
  res.json({ success: true, message: 'Template deleted' });
});

// @route POST /api/templates/:id/download  — increments counter, returns url
export const downloadTemplate = asyncHandler(async (req, res) => {
  const tpl = await Template.findByIdAndUpdate(req.params.id, { $inc: { downloads: 1 } }, { new: true });
  if (!tpl) { res.status(404); throw new Error('Template not found'); }
  res.json({ success: true, url: tpl.fileUrl, fileName: tpl.fileName });
});
