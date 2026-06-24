import asyncHandler from 'express-async-handler';
import Organization, { slugify } from '../models/Organization.js';
import User from '../models/User.js';
import Template from '../models/Template.js';
import Asset from '../models/Asset.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import { uploadBuffer, deleteFile } from '../config/storage.js';
import { APPROVAL_STATUS } from '../config/constants.js';

// @route GET /api/organizations  — list all (ADMIN). Includes quick member/post counts.
export const getOrganizations = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const query = {};
  if (search) query.name = { $regex: search, $options: 'i' };
  const orgs = await Organization.find(query).sort({ createdAt: -1 }).lean();

  // Attach lightweight stats per org
  const withStats = await Promise.all(
    orgs.map(async (o) => {
      const [members, posts] = await Promise.all([
        User.countDocuments({ organization: o._id }),
        ApprovalRequest.countDocuments({ organization: o._id, status: APPROVAL_STATUS.POSTED }),
      ]);
      return { ...o, memberCount: members, postCount: posts };
    })
  );
  res.json({ success: true, count: withStats.length, organizations: withStats });
});

// @route GET /api/organizations/:id
export const getOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id).lean();
  if (!org) { res.status(404); throw new Error('Organization not found'); }
  const [members, templates, assets, posts] = await Promise.all([
    User.countDocuments({ organization: org._id }),
    Template.countDocuments({ organization: org._id }),
    Asset.countDocuments({ organization: org._id }),
    ApprovalRequest.countDocuments({ organization: org._id, status: APPROVAL_STATUS.POSTED }),
  ]);
  res.json({ success: true, organization: { ...org, stats: { members, templates, assets, posts } } });
});

// @route POST /api/organizations  (ADMIN)
export const createOrganization = asyncHandler(async (req, res) => {
  const { name, description, website, color } = req.body;
  if (!name) { res.status(400); throw new Error('Organization name is required'); }

  let slug = slugify(name);
  if (!slug) { res.status(400); throw new Error('Invalid organization name'); }
  // Ensure unique slug
  if (await Organization.findOne({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const exists = await Organization.findOne({ name: name.trim() });
  if (exists) { res.status(400); throw new Error('An organization with this name already exists'); }

  let logo = '', logoPublicId = '';
  if (req.file) {
    const up = await uploadBuffer(req.file.buffer, { folder: 'organizations', originalName: req.file.originalname });
    logo = up.url; logoPublicId = up.publicId;
  }

  const org = await Organization.create({
    name: name.trim(), slug, description: description || '', website: website || '',
    color: color || '#6366f1', logo, logoPublicId, createdBy: req.user._id,
  });
  res.status(201).json({ success: true, organization: org });
});

// @route PUT /api/organizations/:id  (ADMIN)
export const updateOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) { res.status(404); throw new Error('Organization not found'); }

  const { name, description, website, color, isActive } = req.body;
  if (name && name.trim() !== org.name) {
    const dup = await Organization.findOne({ name: name.trim(), _id: { $ne: org._id } });
    if (dup) { res.status(400); throw new Error('An organization with this name already exists'); }
    org.name = name.trim();
  }
  if (description !== undefined) org.description = description;
  if (website !== undefined) org.website = website;
  if (color) org.color = color;
  if (typeof isActive === 'boolean') org.isActive = isActive;

  if (req.file) {
    if (org.logoPublicId) await deleteFile(org.logoPublicId);
    const up = await uploadBuffer(req.file.buffer, { folder: 'organizations', originalName: req.file.originalname });
    org.logo = up.url; org.logoPublicId = up.publicId;
  }
  await org.save();
  res.json({ success: true, organization: org });
});

// @route DELETE /api/organizations/:id  (ADMIN) — blocked if it still has members
export const deleteOrganization = asyncHandler(async (req, res) => {
  const org = await Organization.findById(req.params.id);
  if (!org) { res.status(404); throw new Error('Organization not found'); }
  const members = await User.countDocuments({ organization: org._id });
  if (members > 0) {
    res.status(400);
    throw new Error(`Cannot delete: ${members} user(s) still belong to this organization. Reassign or remove them first.`);
  }
  if (org.logoPublicId) await deleteFile(org.logoPublicId);
  await org.deleteOne();
  res.json({ success: true, message: 'Organization deleted' });
});
