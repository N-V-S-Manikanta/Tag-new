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
import { APPROVAL_STATUS, ACTIVITY_ACTIONS, NOTIFICATION_TYPES, ROLES, FEEDBACK_CATEGORIES } from '../config/constants.js';

const parseHashtags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw)
    .split(/[,\s]+/)
    .map((h) => h.replace(/^#/, '').trim())
    .filter(Boolean);
};

// Notify the people responsible for a request: the Admin(s) of the request's
// target organization (role CEO) AND every Super Admin (who oversee all orgs).
// Recipients are de-duplicated so a super admin who also heads the org is
// notified once.
const notifyApprovers = async (type, title, message, request) => {
  const recipients = await User.find({
    isActive: true,
    $or: [
      { role: ROLES.CEO, organization: request.organization },
      { isSuperAdmin: true },
    ],
  }).select('_id');
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

// Access guard for a single request:
//  - ADMIN / Super Admin: any organization (global).
//  - The request's creator: their own request, in ANY organization (users can
//    submit for any org in the shared workspace).
//  - CEO ("Admin" of an org): requests targeting their own organization.
const assertOrgAccess = (req, res, request) => {
  if (req.user.role === ROLES.ADMIN) return;
  if (String(request.createdBy) === String(req.user._id)) return;
  const orgId = resolveOrgId(req);
  if (orgId && String(request.organization) === String(orgId)) return;
  res.status(404); throw new Error('Request not found');
};

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

// @route GET /api/approvals  — CEO sees their org, USER sees own, ADMIN sees
// ALL organizations (head of all orgs). Supports filters.
export const getApprovals = asyncHandler(async (req, res) => {
  const { status, platform, search, user, from, to, page = 1, limit = 12 } = req.query;
  const query = {};
  // ADMIN / Super Admin span every organization (optional ?organizationId narrows).
  // CEO ("Admin") sees every request targeting their own organization.
  // USER sees their own requests across ALL organizations they submitted to.
  if (req.user.role === ROLES.ADMIN) {
    if (req.query.organizationId) query.organization = req.query.organizationId;
    if (user) query.createdBy = user;
  } else if (req.user.role === ROLES.CEO) {
    query.organization = requireOrgId(req, res);
    if (user) query.createdBy = user;
  } else {
    query.createdBy = req.user._id;
    if (req.query.organizationId) query.organization = req.query.organizationId;
  }

  // "REVIEW" is a convenience filter for everything awaiting a decision.
  if (status === 'REVIEW') query.status = { $in: [APPROVAL_STATUS.PENDING, APPROVAL_STATUS.RESUBMITTED] };
  else if (status && status !== 'All') query.status = status;
  if (platform && platform !== 'All') query.platform = platform;
  if (search) query.$or = [
    { title: { $regex: search, $options: 'i' } },
    { caption: { $regex: search, $options: 'i' } },
  ];
  if (from || to) {
    query.createdAt = {};
    if (from) query.createdAt.$gte = new Date(from);
    if (to) query.createdAt.$lte = new Date(`${to}T23:59:59.999Z`);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    ApprovalRequest.find(query).populate('createdBy', 'name avatar email').populate('organization', 'name color').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    ApprovalRequest.countDocuments(query),
  ]);
  const withImages = await attachImages(items);
  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), requests: withImages });
});

// @route GET /api/approvals/:id
export const getApproval = asyncHandler(async (req, res) => {
  const reqDoc = await ApprovalRequest.findById(req.params.id)
    .populate('createdBy', 'name avatar email')
    .populate('approvedBy', 'name')
    .populate('postedBy', 'name')
    .populate('organization', 'name color')
    .populate('reviews.reviewedBy', 'name avatar')
    .lean();
  if (!reqDoc) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, { ...reqDoc, organization: reqDoc.organization?._id || reqDoc.organization });
  const privileged = [ROLES.ADMIN, ROLES.CEO].includes(req.user.role);
  if (!privileged && String(reqDoc.createdBy._id) !== String(req.user._id)) {
    res.status(403); throw new Error('Not allowed to view this request');
  }
  const [images, comments] = await Promise.all([
    ApprovalImage.find({ request: reqDoc._id }).sort({ order: 1 }).lean(),
    ApprovalComment.find({ request: reqDoc._id }).populate('author', 'name avatar').sort({ createdAt: 1 }).lean(),
  ]);
  res.json({ success: true, request: { ...reqDoc, images, comments } });
});

// @route POST /api/approvals  — create new request (status PENDING)
export const createApproval = asyncHandler(async (req, res) => {
  const { title, platform, caption, description, hashtags, order, aspectRatio, organization } = req.body;
  if (!title || !platform) { res.status(400); throw new Error('Title and platform are required'); }

  // Any user can submit a request for ANY organization. The target org comes
  // from the form (organization); falls back to the user's own org if omitted.
  const orgId = organization || resolveOrgId(req);
  if (!orgId) { res.status(400); throw new Error('Please choose the organization this post is for'); }
  const org = await Organization.findById(orgId).select('_id isActive');
  if (!org || !org.isActive) { res.status(400); throw new Error('Selected organization does not exist'); }

  const request = await ApprovalRequest.create({
    organization: orgId,
    title, platform, caption, description,
    aspectRatio: aspectRatio || '',
    hashtags: parseHashtags(hashtags),
    status: APPROVAL_STATUS.PENDING,
    createdBy: req.user._id,
  });

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

  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.APPROVAL_SUBMISSION, description: `Submitted approval request "${title}"`, entityType: 'ApprovalRequest', entityId: request._id });
  await notifyApprovers(NOTIFICATION_TYPES.NEW_REQUEST, 'New approval request', `${req.user.name} submitted "${title}"`, request);

  const images = await ApprovalImage.find({ request: request._id }).sort({ order: 1 }).lean();
  res.status(201).json({ success: true, request: { ...request.toObject(), images } });
});

// @route PUT /api/approvals/:id/approve  (CEO)
export const approveRequest = asyncHandler(async (req, res) => {
  const request = await ApprovalRequest.findById(req.params.id);
  if (!request) { res.status(404); throw new Error('Request not found'); }
  assertOrgAccess(req, res, request);

  request.status = APPROVAL_STATUS.APPROVED;
  request.approvedAt = new Date();
  request.approvedBy = req.user._id;
  await request.save();

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

  // Persist each feedback point into the approvalComments collection.
  await ApprovalComment.insertMany(
    feedbackPoints.map((p) => ({ request: request._id, text: p.text, category: p.category, author: req.user._id, reviewRound }))
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
  if (request.status !== APPROVAL_STATUS.APPROVED) { res.status(400); throw new Error('Only approved content can be marked as posted'); }

  request.status = APPROVAL_STATUS.POSTED;
  request.postedAt = new Date();
  request.postedBy = req.user._id;
  await request.save();

  logActivity({ user: req.user._id, organization: request.organization, action: ACTIVITY_ACTIONS.POST_COMPLETION, description: `Marked "${request.title}" as posted`, entityType: 'ApprovalRequest', entityId: request._id });
  await notifyApprovers(NOTIFICATION_TYPES.CONTENT_POSTED, 'Content posted', `${req.user.name} posted "${request.title}" on ${request.platform}`, request);

  res.json({ success: true, request });
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
  await ApprovalImage.deleteMany({ request: request._id });
  await ApprovalComment.deleteMany({ request: request._id });
  await request.deleteOne();
  res.json({ success: true, message: 'Request deleted' });
});
