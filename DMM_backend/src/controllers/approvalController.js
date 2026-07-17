import mongoose from 'mongoose';
import asyncHandler from 'express-async-handler';
import ApprovalRequest from '../models/ApprovalRequest.js';
import ApprovalImage from '../models/ApprovalImage.js';
import ApprovalComment from '../models/ApprovalComment.js';
import { uploadBuffer, deleteFile } from '../config/storage.js';
import { logActivity } from '../utils/logActivity.js';
import { createNotification } from '../utils/notify.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { requireOrgId, resolveOrgId } from '../utils/org.js';
import {
  APPROVAL_STATUS,
  APPROVAL_TYPES,
  ACTIVITY_ACTIONS,
  NOTIFICATION_TYPES,
  ROLES,
  USER_TYPES,
  PLATFORMS,
  FEEDBACK_CATEGORIES,
} from '../config/constants.js';

// Legacy requests predate the type field — anything without one is a POST.
const typeFilter = (type) =>
  type === APPROVAL_TYPES.DESIGN ? APPROVAL_TYPES.DESIGN : { $in: [APPROVAL_TYPES.POST, null] };

const parseHashtags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw)
    .split(/[,\s]+/)
    .map((h) => h.replace(/^#/, '').trim())
    .filter(Boolean);
};

// Notify super admins (the only approval authority).
const notifyApprovers = async (type, title, message, request) => {
  const recipients = await User.find({ isActive: true, isSuperAdmin: true }).select('_id');
  const seen = new Set();
  await Promise.all(
    recipients
      .filter((u) => { const k = String(u._id); if (seen.has(k)) return false; seen.add(k); return true; })
      .map((c) =>
        createNotification({
          recipient: c._id, organization: request.organization, type, title, message,
          link: `/approvals/${request._id}`, relatedRequest: request._id,
        })
      )
  );
};

const isSuperApprover = (user) => user?.role === ROLES.ADMIN && !!user?.isSuperAdmin;

const isForwardedHandler = (request, userId) =>
  Array.isArray(request.forwardedHandlers) && request.forwardedHandlers.some((id) => String(id) === String(userId));

// Access guard for a single request:
//  - ADMIN / Super Admin: any organization (global).
//  - The request's creator: their own request, in ANY organization (users can
//    submit for any org in the shared workspace).
//  - The assigned handler of an approved design (may sit in another org).
//  - CEO ("Admin" of an org): requests targeting their own organization.
const assertOrgAccess = (req, res, request) => {
  if (req.user.role === ROLES.ADMIN) return;
  if (String(request.createdBy) === String(req.user._id)) return;
  if (request.assignedTo && String(request.assignedTo) === String(req.user._id)) return;
  if (isForwardedHandler(request, req.user._id)) return;
  const orgId = resolveOrgId(req);
  if (orgId && String(request.organization) === String(orgId)) return;
  res.status(404); throw new Error('Request not found');
};

// Aggregation pipelines don't auto-cast strings to ObjectIds the way find()
// does, so id filters coming from query params need an explicit cast.
const toObjectId = (v) => (mongoose.isValidObjectId(v) ? new mongoose.Types.ObjectId(String(v)) : v);

// Attach images (from approvalImages collection) to a list of plain request objects.
const attachImages = async (requests) => {
  if (!requests.length) return requests;
  const ids = requests.map((r) => r._id);
  const images = await ApprovalImage.find({ request: { $in: ids } }).sort({ order: 1 }).lean();
  const byReq = images.reduce((acc, img) => {
    (acc[img.request] = acc[img.request] || []).push(img);
    return acc;
  }, {});
  return requests.map((r) => ({ ...r, images: byReq[r._id] || [] }));
};

// Best-effort activity-feed write. The status transition is already persisted
// when these run, so a failed feed row must never fail the whole request.
const recordFeed = async (docs) => {
  try { await ApprovalComment.insertMany(Array.isArray(docs) ? docs : [docs]); }
  catch (err) { console.error('approval feed error:', err.message); }
};

// @route GET /api/approvals  — CEO sees their org, USER sees own, ADMIN sees
// ALL organizations (head of all orgs). Supports filters.
export const getApprovals = asyncHandler(async (req, res) => {
  const { status, type, platform, search, user, from, to, page = 1, limit = 12 } = req.query;
  const query = {};
  const and = [];
  // ADMIN / Super Admin span every organization (optional ?organizationId narrows).
  // CEO ("Admin") sees every request targeting their own organization.
  // USER sees their own requests across ALL organizations they submitted to,
  // PLUS any approved designs assigned to them for publishing.
  if (req.user.role === ROLES.ADMIN) {
    if (req.query.organizationId) query.organization = req.query.organizationId;
    if (user) query.createdBy = user;
  } else if (req.user.role === ROLES.CEO) {
    query.organization = requireOrgId(req, res);
    if (user) query.createdBy = user;
  } else {
    and.push({ $or: [{ createdBy: req.user._id }, { assignedTo: req.user._id }, { forwardedHandlers: req.user._id }] });
    if (req.query.organizationId) query.organization = req.query.organizationId;
  }

  if (platform && platform !== 'All') query.platform = platform;
  if (search) and.push({
    $or: [
      { title: { $regex: search, $options: 'i' } },
      { caption: { $regex: search, $options: 'i' } },
    ],
  });
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }
  if (and.length) query.$and = and;

  // Per-status tab counts use the SAME scope minus the status filter, so the
  // numbers stay stable while the user switches tabs. Ids must be cast for
  // the aggregate (see toObjectId).
  const countsQuery = { ...query };
  if (countsQuery.organization) countsQuery.organization = toObjectId(countsQuery.organization);
  if (countsQuery.createdBy) countsQuery.createdBy = toObjectId(countsQuery.createdBy);

  // "REVIEW" is a convenience filter for everything awaiting a decision.
  if (status === 'REVIEW') query.status = { $in: [APPROVAL_STATUS.PENDING, APPROVAL_STATUS.RESUBMITTED] };
  else if (status && status !== 'All') query.status = status;
  if (type) query.type = typeFilter(type);

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total, statusCounts, typeCountsAgg] = await Promise.all([
    ApprovalRequest.find(query)
      .populate('createdBy', 'name avatar email')
      .populate('assignedTo', 'name avatar')
      .populate('organization', 'name color')
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    ApprovalRequest.countDocuments(query),
    // Status tab counts, scoped to the current type view when one is selected.
    ApprovalRequest.aggregate([
      { $match: type ? { ...countsQuery, type: typeFilter(type) } : countsQuery },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    // Post/Design sub-tab badges: same scope, ignoring both status and type.
    ApprovalRequest.aggregate([
      { $match: countsQuery },
      { $group: { _id: { $ifNull: ['$type', APPROVAL_TYPES.POST] }, count: { $sum: 1 } } },
    ]),
  ]);
  const counts = { ALL: 0 };
  Object.values(APPROVAL_STATUS).forEach((s) => { counts[s] = 0; });
  statusCounts.forEach(({ _id, count }) => {
    if (counts[_id] !== undefined) counts[_id] = count;
    counts.ALL += count;
  });
  const typeCounts = { [APPROVAL_TYPES.POST]: 0, [APPROVAL_TYPES.DESIGN]: 0 };
  typeCountsAgg.forEach(({ _id, count }) => { if (typeCounts[_id] !== undefined) typeCounts[_id] += count; });
  const withImages = await attachImages(items);
  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), counts, typeCounts, requests: withImages });
});

// @route GET /api/approvals/:id
export const getApproval = asyncHandler(async (req, res) => {
  const reqDoc = await ApprovalRequest.findById(req.params.id)
    .populate('createdBy', 'name avatar email')
    .populate('approvedBy', 'name')
    .populate('postedBy', 'name')
    .populate('assignedTo', 'name avatar email')
    .populate('assignedBy', 'name')
    .populate('forwardedBy', 'name')
    .populate('forwardedTargets.organization', 'name color')
    .populate('forwardedTargets.handlers', 'name avatar email')
    .populate('linkedPost', 'title status type')
    .populate('sourceDesign', 'title status type')
    .populate('organization', 'name color')
    .populate('reviews.reviewedBy', 'name avatar')
    .lean();
  if (!reqDoc) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, {
    ...reqDoc,
    organization: reqDoc.organization?._id || reqDoc.organization,
    assignedTo: reqDoc.assignedTo?._id || reqDoc.assignedTo,
  });
  const privileged = [ROLES.ADMIN, ROLES.CEO].includes(req.user.role);
  const isAssignee = reqDoc.assignedTo && String(reqDoc.assignedTo._id || reqDoc.assignedTo) === String(req.user._id);
  if (!privileged && !isAssignee && String(reqDoc.createdBy._id) !== String(req.user._id)) {
    res.status(403); throw new Error('Not allowed to view this request');
  }
  const [images, comments] = await Promise.all([
    ApprovalImage.find({ request: reqDoc._id }).sort({ order: 1 }).lean(),
    // _id tiebreaker keeps same-millisecond rows (reject event + its feedback batch) in insert order.
    ApprovalComment.find({ request: reqDoc._id }).populate('author', 'name avatar').sort({ createdAt: 1, _id: 1 }).lean(),
  ]);
  res.json({ success: true, request: { ...reqDoc, images, comments } });
});

// @route POST /api/approvals  — create new request (status PENDING)
export const createApproval = asyncHandler(async (req, res) => {
  const { title, platform, caption, description, hashtags, order, aspectRatio, organization, type, sourceDesign } = req.body;
  if (!title || !platform) { res.status(400); throw new Error('Title and platform are required'); }
  const reqType = type === APPROVAL_TYPES.DESIGN ? APPROVAL_TYPES.DESIGN : APPROVAL_TYPES.POST;

  // Any user can submit a request for ANY organization. The target org comes
  // from the form (organization); falls back to the user's own org if omitted.
  const orgId = organization || resolveOrgId(req);
  if (!orgId) { res.status(400); throw new Error('Please choose the organization this post is for'); }
  const org = await Organization.findById(orgId).select('_id isActive');
  if (!org || !org.isActive) { res.status(400); throw new Error('Selected organization does not exist'); }

  // A POST raised from an approved design: verify the link and the assignee.
  let design = null;
  if (reqType === APPROVAL_TYPES.POST && sourceDesign) {
    design = await ApprovalRequest.findById(sourceDesign);
    if (!design || design.type !== APPROVAL_TYPES.DESIGN) { res.status(400); throw new Error('Source design not found'); }
    if (design.status !== APPROVAL_STATUS.APPROVED) { res.status(400); throw new Error('The source design is not approved yet'); }
    if (design.linkedPost) { res.status(400); throw new Error('A post request already exists for this design'); }
    const isAssignee = design.assignedTo && String(design.assignedTo) === String(req.user._id);
    const isForwarded = isForwardedHandler(design, req.user._id);
    if (!isAssignee && !isForwarded && ![ROLES.ADMIN, ROLES.CEO].includes(req.user.role)) {
      res.status(403); throw new Error('This design is not assigned to you');
    }

    // Social handlers can only raise posts for org/platform pairs forwarded to them.
    if (req.user.role === ROLES.USER && req.user.userType === USER_TYPES.SOCIAL_HANDLER && Array.isArray(design.forwardedTargets)) {
      const target = design.forwardedTargets.find((t) =>
        String(t.organization) === String(orgId)
        && t.platform === platform
        && (t.handlers || []).some((h) => String(h) === String(req.user._id))
      );
      if (!target) {
        res.status(403);
        throw new Error('You are not assigned to publish this design for the selected organization/platform');
      }
    }
  }

  const request = await ApprovalRequest.create({
    organization: orgId,
    title, platform, caption, description,
    type: reqType,
    sourceDesign: design ? design._id : null,
    aspectRatio: aspectRatio || '',
    hashtags: parseHashtags(hashtags),
    status: APPROVAL_STATUS.PENDING,
    createdBy: req.user._id,
  });

  if (design) {
    design.linkedPost = request._id;
    await design.save();
    await recordFeed({ request: design._id, kind: 'event', author: req.user._id, text: `created the post request "${title}" from this design` });
  }

  // `order` (optional) is a parallel array of indices matching the uploaded files,
  // letting the client control gallery order. Falls back to upload order.
  const orderArr = Array.isArray(order) ? order.map(Number) : null;
  const files = req.files || [];
  const imageDocs = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const up = await uploadBuffer(f.buffer, { folder: 'approvals', originalName: f.originalname });
    const mediaType = f.mimetype?.startsWith('video/') ? 'video' : 'image';
    imageDocs.push({ request: request._id, url: up.url, publicId: up.publicId, mediaType, order: orderArr?.[i] ?? i });
  }
  if (imageDocs.length) await ApprovalImage.insertMany(imageDocs);
  request.imageCount = imageDocs.length;
  await request.save();

  const kindLabel = reqType === APPROVAL_TYPES.DESIGN ? 'design' : 'post';
  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.APPROVAL_SUBMISSION, description: `Submitted ${kindLabel} approval request "${title}"`, entityType: 'ApprovalRequest', entityId: request._id });
  await notifyApprovers(NOTIFICATION_TYPES.NEW_REQUEST, `New ${kindLabel} approval request`, `${req.user.name} submitted "${title}"`, request);

  const images = await ApprovalImage.find({ request: request._id }).sort({ order: 1 }).lean();
  res.status(201).json({ success: true, request: { ...request.toObject(), images } });
});

// @route PUT /api/approvals/:id/approve  (CEO)
export const approveRequest = asyncHandler(async (req, res) => {
  if (!isSuperApprover(req.user)) { res.status(403); throw new Error('Only super admin can approve requests'); }
  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);

  request.status = APPROVAL_STATUS.APPROVED;
  request.approvedAt = new Date();
  request.approvedBy = req.user._id;
  await request.save();

  // Durable status-change marker in the request's activity feed.
  await recordFeed({ request: request._id, kind: 'event', author: req.user._id, text: 'approved this request' });

  logActivity({ user: req.user._id, organization: request.organization, action: ACTIVITY_ACTIONS.APPROVAL_APPROVED, description: `Approved "${request.title}"`, entityType: 'ApprovalRequest', entityId: request._id });
  await createNotification({
    recipient: request.createdBy, organization: request.organization, type: NOTIFICATION_TYPES.CONTENT_APPROVED,
    title: 'Content approved', message: `Your request "${request.title}" was approved`,
    link: `/approvals/${request._id}`, relatedRequest: request._id,
  });
  res.json({ success: true, request });
});

// @route PUT /api/approvals/:id/reject  (CEO) — body: { feedbackPoints: [] }
export const rejectRequest = asyncHandler(async (req, res) => {
  if (!isSuperApprover(req.user)) { res.status(403); throw new Error('Only super admin can reject requests'); }
  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);

  // Each feedback point can be a plain string (legacy) or { text, category },
  // where category says what to change: Image | Content | Other | Reject.
  const feedbackPoints = (req.body.feedbackPoints || [])
    .map((p) => {
      const text = String(typeof p === 'string' ? p : p?.text || '').trim();
      const category = FEEDBACK_CATEGORIES.includes(p?.category) ? p.category : 'Other';
      return { text, category };
    })
    .filter((p) => p.text);
  if (feedbackPoints.length === 0) { res.status(400); throw new Error('At least one feedback point is required'); }

  const reviewRound = request.reviews.length + 1;
  request.status = APPROVAL_STATUS.REJECTED;
  request.rejectedAt = new Date();
  request.reviews.push({ reviewedBy: req.user._id, feedbackPoints });
  await request.save();

  // Durable status-change marker, then each feedback point, into the
  // approvalComments collection (the event precedes its feedback rows).
  await recordFeed({ request: request._id, kind: 'event', author: req.user._id, text: 'requested changes', reviewRound });
  await recordFeed(
    feedbackPoints.map((p) => ({ request: request._id, kind: 'feedback', text: p.text, category: p.category, author: req.user._id, reviewRound }))
  );

  logActivity({ user: req.user._id, organization: request.organization, action: ACTIVITY_ACTIONS.APPROVAL_REJECTED, description: `Rejected "${request.title}"`, entityType: 'ApprovalRequest', entityId: request._id });
  await createNotification({
    recipient: request.createdBy, organization: request.organization, type: NOTIFICATION_TYPES.CONTENT_REJECTED,
    title: 'Content needs revision', message: `Your request "${request.title}" was rejected with ${feedbackPoints.length} note(s)`,
    link: `/approvals/${request._id}`, relatedRequest: request._id,
  });
  res.json({ success: true, request });
});

// @route PUT /api/approvals/:id/resubmit  (owner) — update content + images, status RESUBMITTED
export const resubmitRequest = asyncHandler(async (req, res) => {
  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);
  if (String(request.createdBy) !== String(req.user._id)) { res.status(403); throw new Error('Not allowed'); }
  if (request.status !== APPROVAL_STATUS.REJECTED) { res.status(400); throw new Error('Only rejected requests can be resubmitted'); }

  const { title, caption, description, hashtags, keepImageIds, order } = req.body;
  if (title) request.title = title;
  if (caption !== undefined) request.caption = caption;
  if (description !== undefined) request.description = description;
  if (hashtags !== undefined) request.hashtags = parseHashtags(hashtags);

  // Remove images the user dropped on resubmit
  if (keepImageIds !== undefined) {
    const keep = Array.isArray(keepImageIds) ? keepImageIds : keepImageIds ? [keepImageIds] : [];
    const removed = await ApprovalImage.find({ request: request._id, _id: { $nin: keep } });
    await Promise.all(removed.map((img) => deleteFile(img.publicId)));
    await ApprovalImage.deleteMany({ request: request._id, _id: { $nin: keep } });
    // Re-apply order to kept images (preserves drag order from the client)
    const keepOrder = Array.isArray(order) ? order : null;
    if (keepOrder) {
      await Promise.all(keep.map((id, i) => ApprovalImage.updateOne({ _id: id }, { order: Number(keepOrder[i] ?? i) })));
    }
  }
  // Append any newly uploaded images after the kept ones
  const existingCount = await ApprovalImage.countDocuments({ request: request._id });
  const files = req.files || [];
  const newDocs = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const up = await uploadBuffer(f.buffer, { folder: 'approvals', originalName: f.originalname });
    const mediaType = f.mimetype?.startsWith('video/') ? 'video' : 'image';
    newDocs.push({ request: request._id, url: up.url, publicId: up.publicId, mediaType, order: existingCount + i });
  }
  if (newDocs.length) await ApprovalImage.insertMany(newDocs);

  request.imageCount = await ApprovalImage.countDocuments({ request: request._id });
  request.status = APPROVAL_STATUS.RESUBMITTED;
  request.resubmittedAt = new Date();
  request.resubmitCount += 1;
  await request.save();

  // Durable status-change marker in the request's activity feed.
  await recordFeed({ request: request._id, kind: 'event', author: req.user._id, text: 'resubmitted with updates' });

  logActivity({ user: req.user._id, organization: request.organization, action: ACTIVITY_ACTIONS.APPROVAL_RESUBMITTED, description: `Resubmitted "${request.title}"`, entityType: 'ApprovalRequest', entityId: request._id });
  await notifyApprovers(NOTIFICATION_TYPES.CONTENT_RESUBMITTED, 'Content resubmitted', `${req.user.name} resubmitted "${request.title}"`, request);

  res.json({ success: true, request });
});

// @route PUT /api/approvals/:id/posted  (owner) — mark as posted
export const markPosted = asyncHandler(async (req, res) => {
  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);
  if (String(request.createdBy) !== String(req.user._id)) { res.status(403); throw new Error('Not allowed'); }
  if (request.type === APPROVAL_TYPES.DESIGN) { res.status(400); throw new Error('Designs are published through their linked post request'); }
  if (request.status !== APPROVAL_STATUS.APPROVED) { res.status(400); throw new Error('Only approved content can be marked as posted'); }

  request.status = APPROVAL_STATUS.POSTED;
  request.postedAt = new Date();
  request.postedBy = req.user._id;
  await request.save();

  // Durable status-change marker in the request's activity feed.
  await recordFeed({ request: request._id, kind: 'event', author: req.user._id, text: `marked as posted on ${request.platform}` });

  // Publishing the post completes its source design's lifecycle too.
  if (request.sourceDesign) {
    const design = await ApprovalRequest.findById(request.sourceDesign);
    if (design && design.status !== APPROVAL_STATUS.POSTED) {
      design.status = APPROVAL_STATUS.POSTED;
      design.postedAt = request.postedAt;
      design.postedBy = req.user._id;
      await design.save();
      await recordFeed({ request: design._id, kind: 'event', author: req.user._id, text: `the linked post went live on ${request.platform}` });
    }
  }

  logActivity({ user: req.user._id, organization: request.organization, action: ACTIVITY_ACTIONS.POST_COMPLETION, description: `Marked "${request.title}" as posted`, entityType: 'ApprovalRequest', entityId: request._id });
  await notifyApprovers(NOTIFICATION_TYPES.CONTENT_POSTED, 'Content posted', `${req.user.name} posted "${request.title}" on ${request.platform}`, request);

  res.json({ success: true, request });
});

// @route PUT /api/approvals/:id/assign  (CEO/ADMIN) — hand an approved design
// to a social-media handler. Body: { userId }. Re-assignment is allowed until
// the handler has raised the linked post request.
export const assignRequest = asyncHandler(async (req, res) => {
  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);
  if (request.type !== APPROVAL_TYPES.DESIGN) { res.status(400); throw new Error('Only design requests can be assigned'); }
  if (request.status !== APPROVAL_STATUS.APPROVED) { res.status(400); throw new Error('Approve the design before assigning it'); }
  if (request.linkedPost) { res.status(400); throw new Error('A post request was already created from this design'); }

  const assignee = await User.findOne({ _id: req.body.userId, isActive: true }).select('name');
  if (!assignee) { res.status(400); throw new Error('Selected user not found'); }

  request.assignedTo = assignee._id;
  request.assignedBy = req.user._id;
  request.assignedAt = new Date();
  await request.save();

  await recordFeed({ request: request._id, kind: 'event', author: req.user._id, text: `assigned this design to ${assignee.name} for ${request.platform}` });
  logActivity({ user: req.user._id, organization: request.organization, action: ACTIVITY_ACTIONS.DESIGN_ASSIGNED, description: `Assigned design "${request.title}" to ${assignee.name}`, entityType: 'ApprovalRequest', entityId: request._id });
  await createNotification({
    recipient: assignee._id, organization: request.organization, type: NOTIFICATION_TYPES.DESIGN_ASSIGNED,
    title: 'Design assigned to you', message: `${req.user.name} assigned "${request.title}" to you — raise the ${request.platform} post request when ready`,
    link: `/approvals/${request._id}`, relatedRequest: request._id,
  });

  const populated = await ApprovalRequest.findById(request._id)
    .populate('assignedTo', 'name avatar email')
    .populate('assignedBy', 'name')
    .lean();
  res.json({ success: true, request: populated });
});

// @route PUT /api/approvals/:id/forward  (super admin)
// Body: { targets: [{ organization, platform, handlerIds: [] }] }
export const forwardRequest = asyncHandler(async (req, res) => {
  if (!isSuperApprover(req.user)) { res.status(403); throw new Error('Only super admin can forward approved designs'); }

  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);
  if (request.type !== APPROVAL_TYPES.DESIGN) { res.status(400); throw new Error('Only design requests can be forwarded'); }
  if (request.status !== APPROVAL_STATUS.APPROVED) { res.status(400); throw new Error('Approve the design before forwarding'); }

  const rawTargets = Array.isArray(req.body.targets) ? req.body.targets : [];
  if (!rawTargets.length) { res.status(400); throw new Error('At least one target organization/platform is required'); }

  const normalized = [];
  const uniqueHandlers = new Set();
  for (const t of rawTargets) {
    if (!t?.organization || !t?.platform || !PLATFORMS.includes(t.platform)) {
      res.status(400);
      throw new Error('Each target requires a valid organization and platform');
    }
    const org = await Organization.findOne({ _id: t.organization, isActive: true }).select('_id');
    if (!org) { res.status(400); throw new Error('One or more selected organizations are invalid'); }

    const handlerIds = Array.isArray(t.handlerIds) ? [...new Set(t.handlerIds.map(String))] : [];
    if (!handlerIds.length) { res.status(400); throw new Error('Each target must include at least one social handler'); }

    const handlers = await User.find({
      _id: { $in: handlerIds },
      isActive: true,
      role: ROLES.USER,
      userType: USER_TYPES.SOCIAL_HANDLER,
      handles: { $elemMatch: { organization: org._id, platforms: t.platform } },
    }).select('_id name');
    if (handlers.length !== handlerIds.length) {
      res.status(400);
      throw new Error('Some selected handlers are not mapped to the target organization/platform');
    }

    handlers.forEach((h) => uniqueHandlers.add(String(h._id)));
    normalized.push({ organization: org._id, platform: t.platform, handlers: handlers.map((h) => h._id) });
  }

  request.deliveryMode = 'DIGITAL';
  request.forwardedTargets = normalized;
  request.forwardedHandlers = Array.from(uniqueHandlers);
  request.forwardedBy = req.user._id;
  request.forwardedAt = new Date();
  await request.save();

  await recordFeed({ request: request._id, kind: 'event', author: req.user._id, text: `forwarded this approved design to ${uniqueHandlers.size} social handler(s)` });
  logActivity({
    user: req.user._id,
    organization: request.organization,
    action: ACTIVITY_ACTIONS.DESIGN_FORWARDED,
    description: `Forwarded design "${request.title}" to social handlers`,
    entityType: 'ApprovalRequest',
    entityId: request._id,
  });

  await Promise.all(
    Array.from(uniqueHandlers).map((id) =>
      createNotification({
        recipient: id,
        organization: request.organization,
        type: NOTIFICATION_TYPES.CONTENT_FORWARDED,
        title: 'Approved design forwarded to you',
        message: `${req.user.name} forwarded "${request.title}" for publishing preparation`,
        link: `/approvals/${request._id}`,
        relatedRequest: request._id,
      })
    )
  );

  const populated = await ApprovalRequest.findById(request._id)
    .populate('forwardedTargets.organization', 'name color')
    .populate('forwardedTargets.handlers', 'name avatar email')
    .lean();
  res.json({ success: true, request: populated });
});

// @route POST /api/approvals/:id/comments  — chat message on the request's
// activity feed, with optional image/video attachments (multipart 'files').
// Visible-to = can-comment: the request owner, ADMIN, or the org's CEO.
export const addComment = asyncHandler(async (req, res) => {
  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);
  const privileged = [ROLES.ADMIN, ROLES.CEO].includes(req.user.role);
  const isOwner = String(request.createdBy) === String(req.user._id);
  const isForwarded = isForwardedHandler(request, req.user._id);
  if (!privileged && !isOwner && !isForwarded) { res.status(403); throw new Error('Not allowed to comment on this request'); }

  const text = String(req.body.text || '').trim();
  const files = req.files || [];
  if (!text && files.length === 0) { res.status(400); throw new Error('Write a message or attach a file'); }
  // The shared upload middleware also allows docs/sheets — chat renders media only.
  if (files.some((f) => !/^(image|video)\//.test(f.mimetype || ''))) {
    res.status(400); throw new Error('Only image and video attachments are allowed');
  }

  const attachments = [];
  try {
    for (const f of files) {
      const up = await uploadBuffer(f.buffer, { folder: 'approvals', originalName: f.originalname });
      const mediaType = f.mimetype?.startsWith('video/') ? 'video' : 'image';
      attachments.push({ url: up.url, publicId: up.publicId, mediaType, name: f.originalname });
    }
  } catch (err) {
    // A mid-loop failure must not orphan the files that already reached storage.
    await Promise.all(attachments.map((a) => deleteFile(a.publicId).catch(() => {})));
    throw err;
  }

  const created = await ApprovalComment.create({
    request: request._id, kind: 'message', text, attachments, author: req.user._id,
  });

  // Owner's messages go to the approvers; a reviewer's message goes to the owner.
  if (isOwner) {
    await notifyApprovers(NOTIFICATION_TYPES.APPROVAL_COMMENT, 'New comment', `${req.user.name} commented on "${request.title}"`, request);
  } else {
    await createNotification({
      recipient: request.createdBy, organization: request.organization, type: NOTIFICATION_TYPES.APPROVAL_COMMENT,
      title: 'New comment', message: `${req.user.name} commented on "${request.title}"`,
      link: `/approvals/${request._id}`, relatedRequest: request._id,
    });
  }

  const comment = await ApprovalComment.findById(created._id).populate('author', 'name avatar').lean();
  res.status(201).json({ success: true, comment });
});

// @route DELETE /api/approvals/:id  (owner or CEO)
export const deleteApproval = asyncHandler(async (req, res) => {
  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);
  if (String(request.createdBy) !== String(req.user._id) && ![ROLES.CEO, ROLES.ADMIN].includes(req.user.role)) {
    res.status(403); throw new Error('Not allowed');
  }
  const images = await ApprovalImage.find({ request: request._id });
  await Promise.all(images.map((img) => deleteFile(img.publicId)));
  // Chat attachments live on comment rows — remove their files from storage too.
  const comments = await ApprovalComment.find({ request: request._id }).select('attachments').lean();
  await Promise.all(comments.flatMap((c) => (c.attachments || []).map((a) => deleteFile(a.publicId))));
  await ApprovalImage.deleteMany({ request: request._id });
  await ApprovalComment.deleteMany({ request: request._id });
  await request.deleteOne();
  res.json({ success: true, message: 'Request deleted' });
});
