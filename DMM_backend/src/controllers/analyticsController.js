import asyncHandler from 'express-async-handler';
import Analytics from '../models/Analytics.js';
import Organization from '../models/Organization.js';
import { logActivity } from '../utils/logActivity.js';
import { requireOrgId } from '../utils/org.js';
import { ACTIVITY_ACTIONS, PLATFORMS } from '../config/constants.js';

// Metrics each platform exposes, grouped into LinkedIn-style sections.
export const PLATFORM_FIELDS = {
  LinkedIn: {
    Followers: ['followers', 'newFollowers', 'followersLast30Days', 'organicFollowers', 'sponsoredFollowers'],
    Content: ['postsPublished', 'impressions', 'uniqueImpressions', 'clicks', 'clickThroughRate', 'reactions', 'comments', 'reposts', 'engagementRate'],
    Visitors: ['pageViews', 'uniqueVisitors', 'desktopPageViews', 'mobilePageViews', 'customButtonClicks'],
    'Discovery & Leads': ['searchAppearances', 'leads', 'leadFormViews', 'leadConversionRate'],
  },
  Instagram: {
    Audience: ['followers', 'newFollowers', 'followersLast30Days'],
    Reach: ['reach', 'impressions'],
    Engagement: ['engagementRate', 'reactions', 'comments'],
  },
  YouTube: {
    Audience: ['subscribers', 'newFollowers'],
    Performance: ['views', 'watchHours', 'impressions'],
    Engagement: ['engagementRate', 'comments'],
  },
  Facebook: {
    Audience: ['followers', 'newFollowers', 'followersLast30Days'],
    Reach: ['reach', 'impressions'],
    Engagement: ['engagementRate', 'reactions', 'comments'],
    Visitors: ['pageViews', 'uniqueVisitors'],
  },
};

export const FIELD_LABELS = {
  profilesManaged: 'Profiles Managed',
  followers: 'Total Followers',
  newFollowers: 'New Followers',
  followersLast30Days: 'Followers (last 30 days)',
  organicFollowers: 'Organic Followers',
  sponsoredFollowers: 'Sponsored Followers',
  subscribers: 'Subscribers',
  impressions: 'Post Impressions',
  uniqueImpressions: 'Unique Impressions',
  reach: 'Reach',
  searchAppearances: 'Search Appearances',
  views: 'Views',
  watchHours: 'Watch Hours',
  postsPublished: 'Posts Published',
  clicks: 'Clicks',
  clickThroughRate: 'Click-Through Rate',
  engagementRate: 'Engagement Rate',
  reactions: 'Reactions',
  comments: 'Comments',
  reposts: 'Reposts',
  pageViews: 'Page Views',
  uniqueVisitors: 'Unique Visitors',
  desktopPageViews: 'Desktop Page Views',
  mobilePageViews: 'Mobile Page Views',
  customButtonClicks: 'Custom Button Clicks',
  leads: 'Leads',
  leadFormViews: 'Lead Form Views',
  leadConversionRate: 'Lead Conversion Rate',
};

// Percentage-style fields render with a % suffix and 1 decimal.
export const PERCENT_FIELDS = new Set(['engagementRate', 'clickThroughRate', 'leadConversionRate']);

const flatFields = (platform) => Object.values(PLATFORM_FIELDS[platform] || {}).flat();

const computeDelta = (current, previous) => {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  const change = +(cur - prev).toFixed(2);
  const changePct = prev ? +((change / prev) * 100).toFixed(1) : null;
  return { current: cur, previous: prev, change, changePct };
};

// @route GET /api/analytics — latest snapshot per platform for one org (+ field config)
export const getAnalytics = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const latest = {};
  for (const platform of PLATFORMS) {
    latest[platform] = await Analytics.findOne({ organization: orgId, platform }).sort({ date: -1 }).lean();
  }
  res.json({ success: true, fields: PLATFORM_FIELDS, labels: FIELD_LABELS, percentFields: [...PERCENT_FIELDS], latest });
});

// @route GET /api/analytics/:platform/report — rich report: latest, previous, WoW deltas, series
export const getPlatformReport = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const { platform } = req.params;
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }

  const snapshots = await Analytics.find({ organization: orgId, platform }).sort({ date: -1 }).limit(13).lean();
  const latest = snapshots[0] || null;
  const previous = snapshots[1] || null;
  const fields = flatFields(platform);

  const deltas = {};
  for (const f of fields) deltas[f] = computeDelta(latest?.[f], previous?.[f]);

  // Oldest → newest for charting
  const series = [...snapshots].reverse().map((s) => {
    const row = { date: s.date };
    for (const f of fields) row[f] = s[f] ?? 0;
    return row;
  });

  res.json({
    success: true,
    platform,
    hasData: !!latest,
    groups: PLATFORM_FIELDS[platform],
    labels: FIELD_LABELS,
    percentFields: [...PERCENT_FIELDS],
    latest,
    previous,
    deltas,
    series,
  });
});

// @route GET /api/analytics/:platform/history — recent snapshots (kept for simple trend use)
export const getPlatformHistory = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const { platform } = req.params;
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }
  const history = await Analytics.find({ organization: orgId, platform }).sort({ date: -1 }).limit(30).lean();
  res.json({ success: true, platform, history: history.reverse() });
});

// @route GET /api/analytics/compare?platform=&metric=  (ADMIN) — compare orgs on one metric
export const compareOrganizations = asyncHandler(async (req, res) => {
  const platform = req.query.platform || 'LinkedIn';
  const metric = req.query.metric || 'followers';
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }
  if (!FIELD_LABELS[metric]) { res.status(400); throw new Error('Invalid metric'); }

  const orgs = await Organization.find({ isActive: true }).select('name color logo').lean();
  const rows = await Promise.all(
    orgs.map(async (org) => {
      const snaps = await Analytics.find({ organization: org._id, platform }).sort({ date: -1 }).limit(2).lean();
      const d = computeDelta(snaps[0]?.[metric], snaps[1]?.[metric]);
      return { organization: org, ...d, hasData: !!snaps[0] };
    })
  );
  rows.sort((a, b) => b.current - a.current);
  res.json({ success: true, platform, metric, label: FIELD_LABELS[metric], organizations: rows });
});

// @route POST /api/analytics  (ADMIN/CEO) — record a new metrics snapshot for a platform
export const recordAnalytics = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const { platform } = req.body;
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }

  const allowed = flatFields(platform);
  const doc = { organization: orgId, platform, date: new Date() };
  for (const field of allowed) {
    const val = Number(req.body[field]);
    doc[field] = Number.isFinite(val) && val >= 0 ? val : 0;
  }
  const snapshot = await Analytics.create(doc);

  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.ANALYTICS_UPDATED, description: `Updated ${platform} analytics`, entityType: 'Analytics', entityId: snapshot._id });
  res.status(201).json({ success: true, snapshot });
});
