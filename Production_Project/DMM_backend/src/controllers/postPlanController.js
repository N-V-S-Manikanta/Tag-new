import asyncHandler from 'express-async-handler';
import PostPlan from '../models/PostPlan.js';
import User from '../models/User.js';
import { createNotification } from '../utils/notify.js';
import { logActivity } from '../utils/logActivity.js';
import { requireOrgId, resolveOrgId } from '../utils/org.js';
import { APPROVAL_STATUS, ACTIVITY_ACTIONS, NOTIFICATION_TYPES, ROLES, PLATFORMS } from '../config/constants.js';

// Same recipients as content approvals: the target org's Admin(s) (role CEO)
// plus every Super Admin, de-duplicated.
const notifyReviewers = async (type, title, message, plan) => {
  const recipients = await User.find({
    isActive: true,
    $or: [{ role: ROLES.CEO, organization: plan.organization }, { isSuperAdmin: true }],
  }).select('_id');
  const seen = new Set();
  await Promise.all(
    recipients
      .filter((u) => { const k = String(u._id); if (seen.has(k)) return false; seen.add(k); return true; })
      .map((u) => createNotification({ recipient: u._id, organization: plan.organization, type, title, message, link: '/planner' }))
  );
};

// Validate and normalise the submitted items list; also derive the plan window.
const parseItems = (raw, res) => {
  const items = Array.isArray(raw) ? raw : [];
  if (!items.length) { res.status(400); throw new Error('Add at least one planned post'); }
  const clean = items.map((it, i) => {
    const date = new Date(it.date);
    if (Number.isNaN(date.getTime())) { res.status(400); throw new Error(`Post ${i + 1}: a valid date is required`); }
    if (!PLATFORMS.includes(it.platform)) { res.status(400); throw new Error(`Post ${i + 1}: platform must be one of ${PLATFORMS.join(', ')}`); }
    if (!it.title || !String(it.title).trim()) { res.status(400); throw new Error(`Post ${i + 1}: a title is required`); }
    return { date, platform: it.platform, title: String(it.title).trim(), notes: it.notes ? String(it.notes) : '' };
  }).sort((a, b) => a.date - b.date);
  return { items: clean, startDate: clean[0].date, endDate: clean[clean.length - 1].date };
};

// Reviewer guard: Super Admin console (ADMIN) reviews any org; a CEO reviews
// plans that target their own organization.
const assertCanReview = (req, res, plan) => {
  if (req.user.role === ROLES.ADMIN) return;
  const orgId = resolveOrgId(req);
  if (req.user.role === ROLES.CEO && orgId && String(plan.organization) === String(orgId)) return;
  res.status(403); throw new Error('Only the organization Admin or Super Admin can review plans');
};

// @route GET /api/plans — ADMIN sees all orgs, CEO their org, USER their own plans.
export const getPlans = asyncHandler(async (req, res) => {
  const { status, organizationId, page = 1, limit = 12 } = req.query;
  const query = {};
  if (req.user.role === ROLES.ADMIN) {
    if (organizationId) query.organization = organizationId;
  } else if (req.user.role === ROLES.CEO) {
    query.$or = [{ organization: requireOrgId(req, res) }, { createdBy: req.user._id }];
  } else {
    query.createdBy = req.user._id;
  }
  if (status === 'REVIEW') query.status = { $in: [APPROVAL_STATUS.PENDING, APPROVAL_STATUS.RESUBMITTED] };
  else if (status && status !== 'All') query.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const [plans, total] = await Promise.all([
    PostPlan.find(query)
      .populate('createdBy', 'name avatar email')
      .populate('organization', 'name color logo')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    PostPlan.countDocuments(query),
  ]);
  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), plans });
});

// @route GET /api/plans/:id
export const getPlan = asyncHandler(async (req, res) => {
  const plan = await PostPlan.findById(req.params.id)
    .populate('createdBy', 'name avatar email')
    .populate('organization', 'name color logo')
    .populate('reviewedBy', 'name')
    .lean();
  if (!plan) { res.status(404); throw new Error('Plan not found'); }
  const isOwner = String(plan.createdBy?._id) === String(req.user._id);
  const orgId = resolveOrgId(req);
  const sameOrg = orgId && String(plan.organization?._id) === String(orgId);
  if (req.user.role !== ROLES.ADMIN && !isOwner && !(req.user.role === ROLES.CEO && sameOrg)) {
    res.status(404); throw new Error('Plan not found');
  }
  res.json({ success: true, plan });
});

// @route POST /api/plans — any user, for any organization (shared workspace).
export const createPlan = asyncHandler(async (req, res) => {
  const { organization, title, description } = req.body;
  if (!organization) { res.status(400); throw new Error('organization is required'); }
  if (!title || !title.trim()) { res.status(400); throw new Error('Give the plan a title'); }
  const { items, startDate, endDate } = parseItems(req.body.items, res);

  const plan = await PostPlan.create({
    organization, title: title.trim(), description: description || '',
    items, startDate, endDate, createdBy: req.user._id,
  });

  await notifyReviewers(
    NOTIFICATION_TYPES.PLAN_SUBMITTED,
    'New post plan awaiting approval',
    `${req.user.name} submitted "${plan.title}" (${items.length} posts, ${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)})`,
    plan
  );
  await logActivity({
    user: req.user._id, organization, action: ACTIVITY_ACTIONS.PLAN_SUBMITTED,
    description: `Submitted post plan "${plan.title}" (${items.length} posts)`,
  });
  res.status(201).json({ success: true, plan });
});

// @route PUT /api/plans/:id — creator edits while PENDING, or fixes and
// resubmits after a rejection.
export const updatePlan = asyncHandler(async (req, res) => {
  const plan = await PostPlan.findById(req.params.id);
  if (!plan) { res.status(404); throw new Error('Plan not found'); }
  if (String(plan.createdBy) !== String(req.user._id)) { res.status(403); throw new Error('Only the plan creator can edit it'); }
  if (![APPROVAL_STATUS.PENDING, APPROVAL_STATUS.REJECTED].includes(plan.status)) {
    res.status(400); throw new Error(`A ${plan.status.toLowerCase()} plan can no longer be edited`);
  }

  const wasRejected = plan.status === APPROVAL_STATUS.REJECTED;
  if (req.body.title !== undefined) {
    if (!String(req.body.title).trim()) { res.status(400); throw new Error('Give the plan a title'); }
    plan.title = String(req.body.title).trim();
  }
  if (req.body.description !== undefined) plan.description = req.body.description;
  if (req.body.items !== undefined) {
    const { items, startDate, endDate } = parseItems(req.body.items, res);
    plan.items = items; plan.startDate = startDate; plan.endDate = endDate;
  }
  if (wasRejected) {
    plan.status = APPROVAL_STATUS.RESUBMITTED;
    plan.resubmitCount += 1;
    plan.feedback = '';
  }
  await plan.save();

  if (wasRejected) {
    await notifyReviewers(
      NOTIFICATION_TYPES.PLAN_RESUBMITTED,
      'Post plan resubmitted',
      `${req.user.name} updated and resubmitted "${plan.title}"`,
      plan
    );
  }
  res.json({ success: true, plan });
});

// @route PUT /api/plans/:id/approve — ADMIN, or the org's CEO.
export const approvePlan = asyncHandler(async (req, res) => {
  const plan = await PostPlan.findById(req.params.id);
  if (!plan) { res.status(404); throw new Error('Plan not found'); }
  assertCanReview(req, res, plan);
  if (![APPROVAL_STATUS.PENDING, APPROVAL_STATUS.RESUBMITTED].includes(plan.status)) {
    res.status(400); throw new Error('This plan has already been reviewed');
  }
  plan.status = APPROVAL_STATUS.APPROVED;
  plan.reviewedBy = req.user._id;
  plan.reviewedAt = new Date();
  plan.feedback = '';
  await plan.save();

  await createNotification({
    recipient: plan.createdBy, organization: plan.organization,
    type: NOTIFICATION_TYPES.PLAN_APPROVED,
    title: 'Post plan approved 🎉',
    message: `"${plan.title}" was approved — you can start creating the posts.`,
    link: '/planner',
  });
  await logActivity({
    user: req.user._id, organization: plan.organization, action: ACTIVITY_ACTIONS.PLAN_REVIEWED,
    description: `Approved post plan "${plan.title}"`,
  });
  res.json({ success: true, plan });
});

// @route PUT /api/plans/:id/reject — ADMIN, or the org's CEO. Feedback required
// so the creator knows what to fix.
export const rejectPlan = asyncHandler(async (req, res) => {
  const plan = await PostPlan.findById(req.params.id);
  if (!plan) { res.status(404); throw new Error('Plan not found'); }
  assertCanReview(req, res, plan);
  if (![APPROVAL_STATUS.PENDING, APPROVAL_STATUS.RESUBMITTED].includes(plan.status)) {
    res.status(400); throw new Error('This plan has already been reviewed');
  }
  const feedback = String(req.body.feedback || '').trim();
  if (!feedback) { res.status(400); throw new Error('Tell the creator what to change (feedback is required)'); }
  plan.status = APPROVAL_STATUS.REJECTED;
  plan.feedback = feedback;
  plan.reviewedBy = req.user._id;
  plan.reviewedAt = new Date();
  await plan.save();

  await createNotification({
    recipient: plan.createdBy, organization: plan.organization,
    type: NOTIFICATION_TYPES.PLAN_REJECTED,
    title: 'Post plan needs changes',
    message: `"${plan.title}" was rejected: ${feedback}`,
    link: '/planner',
  });
  await logActivity({
    user: req.user._id, organization: plan.organization, action: ACTIVITY_ACTIONS.PLAN_REVIEWED,
    description: `Rejected post plan "${plan.title}"`,
  });
  res.json({ success: true, plan });
});

// @route DELETE /api/plans/:id — creator or ADMIN.
export const deletePlan = asyncHandler(async (req, res) => {
  const plan = await PostPlan.findById(req.params.id);
  if (!plan) { res.status(404); throw new Error('Plan not found'); }
  if (req.user.role !== ROLES.ADMIN && String(plan.createdBy) !== String(req.user._id)) {
    res.status(403); throw new Error('Only the plan creator or an admin can delete it');
  }
  await plan.deleteOne();
  res.json({ success: true, message: 'Plan deleted' });
});
