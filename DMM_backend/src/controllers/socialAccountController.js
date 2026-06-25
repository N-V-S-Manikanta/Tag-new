import asyncHandler from 'express-async-handler';
import SocialAccount from '../models/SocialAccount.js';
import { requireOrgId, resolveOrgId } from '../utils/org.js';
import { ROLES, PLATFORMS } from '../config/constants.js';

const cleanHandlers = (raw) => {
  let arr = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { arr = []; } }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((h) => ({ name: (h.name || '').trim(), email: (h.email || '').trim(), phone: (h.phone || '').trim(), role: (h.role || '').trim() }))
    .filter((h) => h.name || h.email || h.phone);
};
const cleanEmails = (raw) => {
  const arr = Array.isArray(raw) ? raw : String(raw || '').split(/[,\n]/);
  return arr.map((e) => String(e).trim()).filter(Boolean);
};

const apply = (doc, body) => {
  ['platform', 'accountName', 'profileUrl', 'ownerName', 'ownerEmail', 'notes'].forEach((f) => {
    if (body[f] !== undefined) doc[f] = body[f];
  });
  if (body.rating !== undefined) doc.rating = Math.max(0, Math.min(5, Number(body.rating) || 0));
  if (body.accessCount !== undefined) doc.accessCount = Math.max(0, Number(body.accessCount) || 0);
  if (body.linkedEmails !== undefined) doc.linkedEmails = cleanEmails(body.linkedEmails);
  if (body.handlers !== undefined) doc.handlers = cleanHandlers(body.handlers);
};

// @route GET /api/social-accounts — ADMIN sees all orgs (so they can find any
// org's handler contacts); CEO/USER see only their own org. Optional filters.
export const listSocialAccounts = asyncHandler(async (req, res) => {
  const query = {};
  if (req.user.role === ROLES.ADMIN) {
    const id = resolveOrgId(req);
    if (req.query.organizationId) query.organization = req.query.organizationId;
    else if (id && req.query.scope !== 'all') query.organization = id;
    // scope=all (or no active org) → every organization
  } else {
    query.organization = requireOrgId(req, res);
  }
  if (req.query.platform && req.query.platform !== 'All') query.platform = req.query.platform;
  if (req.query.search) {
    const rx = { $regex: req.query.search, $options: 'i' };
    query.$or = [{ accountName: rx }, { ownerName: rx }, { ownerEmail: rx }, { 'handlers.name': rx }, { 'handlers.email': rx }];
  }
  const accounts = await SocialAccount.find(query).populate('organization', 'name color').sort({ platform: 1 }).lean();
  res.json({ success: true, accounts });
});

// @route POST /api/social-accounts  (ADMIN)
export const createSocialAccount = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  if (!PLATFORMS.includes(req.body.platform)) { res.status(400); throw new Error('Valid platform is required'); }
  const doc = new SocialAccount({ organization: orgId });
  apply(doc, req.body);
  await doc.save();
  res.status(201).json({ success: true, account: doc });
});

// @route PUT /api/social-accounts/:id  (ADMIN)
export const updateSocialAccount = asyncHandler(async (req, res) => {
  const doc = await SocialAccount.findById(req.params.id);
  if (!doc) { res.status(404); throw new Error('Account not found'); }
  apply(doc, req.body);
  await doc.save();
  res.json({ success: true, account: doc });
});

// @route DELETE /api/social-accounts/:id  (ADMIN)
export const deleteSocialAccount = asyncHandler(async (req, res) => {
  const doc = await SocialAccount.findByIdAndDelete(req.params.id);
  if (!doc) { res.status(404); throw new Error('Account not found'); }
  res.json({ success: true, id: req.params.id });
});
