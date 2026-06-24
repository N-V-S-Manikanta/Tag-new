import asyncHandler from 'express-async-handler';
import Competitor from '../models/Competitor.js';
import Analytics from '../models/Analytics.js';
import Organization from '../models/Organization.js';
import { logActivity } from '../utils/logActivity.js';
import { requireOrgId } from '../utils/org.js';
import { ACTIVITY_ACTIONS, PLATFORMS } from '../config/constants.js';

// Editable numeric metrics for a competitor, with labels for the UI.
export const COMPETITOR_FIELDS = ['followers', 'newFollowers', 'postsLast30Days', 'engagementRate'];
export const COMPETITOR_LABELS = {
  followers: 'Followers',
  newFollowers: 'New Followers (30d)',
  postsLast30Days: 'Posts (30d)',
  engagementRate: 'Engagement Rate',
};
export const COMPETITOR_PERCENT_FIELDS = ['engagementRate'];

const sanitize = (body) => {
  const out = {};
  for (const f of COMPETITOR_FIELDS) {
    const val = Number(body[f]);
    out[f] = Number.isFinite(val) && val >= 0 ? val : 0;
  }
  return out;
};

// @route GET /api/competitors?platform=LinkedIn — competitors for one org/platform,
// plus the org's own latest snapshot (so the UI can rank "You" against them).
export const listCompetitors = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const platform = req.query.platform || 'LinkedIn';
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }

  const competitors = await Competitor.find({ organization: orgId, platform }).sort({ followers: -1 }).lean();
  const org = await Organization.findById(orgId).select('name color').lean();
  const ownSnap = await Analytics.findOne({ organization: orgId, platform }).sort({ date: -1 }).lean();

  const own = {
    name: org?.name || 'Your organization',
    color: org?.color || '#7c3aed',
    isSelf: true,
    followers: ownSnap?.followers || 0,
    newFollowers: ownSnap?.newFollowers || 0,
    postsLast30Days: ownSnap?.postsPublished || 0,
    engagementRate: ownSnap?.engagementRate || 0,
  };

  res.json({
    success: true,
    platform,
    fields: COMPETITOR_FIELDS,
    labels: COMPETITOR_LABELS,
    percentFields: COMPETITOR_PERCENT_FIELDS,
    own,
    competitors,
  });
});

// @route POST /api/competitors  (ADMIN) — add a competitor
export const createCompetitor = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const platform = req.body.platform || 'LinkedIn';
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }
  const name = (req.body.name || '').trim();
  if (!name) { res.status(400); throw new Error('Competitor name is required'); }

  const competitor = await Competitor.create({
    organization: orgId,
    platform,
    name,
    handle: (req.body.handle || '').trim(),
    ...sanitize(req.body),
  });

  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.COMPETITOR_UPDATED, description: `Added competitor ${name} (${platform})`, entityType: 'Competitor', entityId: competitor._id });
  res.status(201).json({ success: true, competitor });
});

// @route PUT /api/competitors/:id  (ADMIN) — update a competitor
export const updateCompetitor = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const competitor = await Competitor.findOne({ _id: req.params.id, organization: orgId });
  if (!competitor) { res.status(404); throw new Error('Competitor not found'); }

  if (req.body.name !== undefined) {
    const name = (req.body.name || '').trim();
    if (!name) { res.status(400); throw new Error('Competitor name is required'); }
    competitor.name = name;
  }
  if (req.body.handle !== undefined) competitor.handle = (req.body.handle || '').trim();
  Object.assign(competitor, sanitize(req.body));
  await competitor.save();

  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.COMPETITOR_UPDATED, description: `Updated competitor ${competitor.name}`, entityType: 'Competitor', entityId: competitor._id });
  res.json({ success: true, competitor });
});

// @route DELETE /api/competitors/:id  (ADMIN) — remove a competitor
export const deleteCompetitor = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const competitor = await Competitor.findOneAndDelete({ _id: req.params.id, organization: orgId });
  if (!competitor) { res.status(404); throw new Error('Competitor not found'); }

  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.COMPETITOR_UPDATED, description: `Removed competitor ${competitor.name}`, entityType: 'Competitor', entityId: competitor._id });
  res.json({ success: true, id: req.params.id });
});
