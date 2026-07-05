import asyncHandler from 'express-async-handler';
import ExcelJS from 'exceljs';
import Analytics from '../models/Analytics.js';
import Organization from '../models/Organization.js';
import SocialAccount from '../models/SocialAccount.js';
import Website from '../models/Website.js';
import { logActivity } from '../utils/logActivity.js';
import { requireOrgId, resolveViewOrgId } from '../utils/org.js';
import { cellText, cellNumber, normHeader, loadGrid } from '../utils/sheet.js';
import { ACTIVITY_ACTIONS, PLATFORMS } from '../config/constants.js';

// Metrics each platform exposes, grouped into LinkedIn-style sections.
export const PLATFORM_FIELDS = {
  LinkedIn: {
    Followers: ['followers', 'newFollowers', 'followersLast30Days', 'organicFollowers', 'sponsoredFollowers'],
    Content: ['postsPublished', 'impressions', 'clicks', 'reactions', 'comments', 'reposts', 'engagementRate'],
    Visitors: ['pageViews', 'uniqueVisitors', 'desktopPageViews', 'mobilePageViews', 'customButtonClicks'],
    Discovery: ['searchAppearances'],
  },
  Instagram: {
    Overview: ['followers', 'views', 'reach', 'interactions'],
  },
  YouTube: {
    Overview: ['subscribers', 'views', 'videoCount', 'engagementRate', 'comments'],
  },
  Facebook: {
    Overview: ['followers', 'newFollowers', 'reach', 'views', 'interactions', 'visits', 'linkClicks'],
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
  videoCount: 'Videos',
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
  interactions: 'Interactions',
  pageViews: 'Page Views',
  uniqueVisitors: 'Unique Visitors',
  visits: 'Visits',
  linkClicks: 'Link Clicks',
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
  const orgId = resolveViewOrgId(req); // any user may view any org
  const latest = {};
  for (const platform of PLATFORMS) {
    latest[platform] = await Analytics.findOne({ organization: orgId, platform }).sort({ date: -1 }).lean();
  }
  res.json({ success: true, fields: PLATFORM_FIELDS, labels: FIELD_LABELS, percentFields: [...PERCENT_FIELDS], latest });
});

// @route GET /api/analytics/overview  (ADMIN) — a matrix of every organization ×
// platform: whether an account exists, its follower/subscriber count, handle,
// profile URL and when it was last updated. Powers the Social Analytics grid.
export const getAnalyticsOverview = asyncHandler(async (req, res) => {
  const orgs = await Organization.find({ isActive: true }).select('name color').sort({ name: 1 }).lean();

  // Latest analytics snapshot per (org, platform).
  const latest = await Analytics.aggregate([
    { $sort: { date: -1 } },
    { $group: { _id: { org: '$organization', platform: '$platform' }, followers: { $first: '$followers' }, subscribers: { $first: '$subscribers' }, date: { $first: '$date' } } },
  ]);
  const anaMap = new Map();
  for (const a of latest) anaMap.set(`${a._id.org}|${a._id.platform}`, a);

  // Social handler entries (existence + handle + profile URL), incl. X (Twitter).
  const socials = await SocialAccount.find().select('organization platform accountName profileUrl updatedAt').lean();
  const socMap = new Map();
  for (const s of socials) if (s.organization) socMap.set(`${s.organization}|${s.platform}`, s);

  // One website per org (first match).
  const sites = await Website.find({ organization: { $ne: null } }).select('organization institution domain updatedAt').lean();
  const siteMap = new Map();
  for (const w of sites) if (!siteMap.has(String(w.organization))) siteMap.set(String(w.organization), w);

  const ANALYTICS_PLATFORMS = [
    { key: 'LinkedIn', metric: 'followers', label: 'Followers' },
    { key: 'Instagram', metric: 'followers', label: 'Followers' },
    { key: 'Facebook', metric: 'followers', label: 'Followers' },
    { key: 'YouTube', metric: 'subscribers', label: 'Subscribers' },
  ];

  const organizations = orgs.map((o) => {
    const cells = {};
    for (const p of ANALYTICS_PLATFORMS) {
      const a = anaMap.get(`${o._id}|${p.key}`);
      const s = socMap.get(`${o._id}|${p.key}`);
      const metric = a ? (p.metric === 'subscribers' ? a.subscribers : a.followers) : null;
      cells[p.key] = (a || s)
        ? { exists: true, metric: metric != null ? metric : null, label: p.label, username: s?.accountName || '', url: s?.profileUrl || '', lastUpdated: a?.date || s?.updatedAt || null }
        : { exists: false };
    }
    const x = socMap.get(`${o._id}|X (Twitter)`);
    cells['X (Twitter)'] = x ? { exists: true, metric: null, label: null, username: x.accountName || '', url: x.profileUrl || '', lastUpdated: x.updatedAt || null } : { exists: false };
    const w = siteMap.get(String(o._id));
    cells['Website'] = w ? { exists: true, metric: null, label: null, username: w.institution || '', url: w.domain || '', lastUpdated: w.updatedAt || null } : { exists: false };
    return { _id: o._id, name: o.name, color: o.color, cells };
  });

  const platforms = [
    ...ANALYTICS_PLATFORMS.map((p) => ({ ...p, kind: 'analytics' })),
    { key: 'X (Twitter)', kind: 'social' },
    { key: 'Website', kind: 'website' },
  ];
  res.json({ success: true, platforms, organizations });
});

// @route GET /api/analytics/pulse — the three headline LinkedIn numbers per
// organization over the last 15 days (impressions, new followers, engagement
// rate) plus the audience total. One call powers the dashboard pulse cards.
// Windows are anchored per metric, same as the LinkedIn view.
export const getAnalyticsPulse = asyncHandler(async (req, res) => {
  const DAYS = 15;
  const orgs = await Organization.find({ isActive: true }).select('name color logo').sort({ name: 1 }).lean();
  const organizations = await Promise.all(orgs.map(async (org) => {
    const snaps = await Analytics.find({ organization: org._id, platform: 'LinkedIn' }).sort({ date: -1 }).limit(500).lean();
    const base = { organization: { _id: org._id, name: org.name, color: org.color, logo: org.logo } };
    if (!snaps.length) return { ...base, hasData: false };

    const windowSum = (anchorField, sum) => {
      const anchor = snaps.find((s) => (s[anchorField] || 0) > 0) || snaps[0];
      const end = new Date(anchor.date).getTime();
      const rows = snaps.filter((s) => { const t = new Date(s.date).getTime(); return t <= end && t > end - DAYS * 86400000; });
      return sum(rows);
    };
    const { impressions, engagements } = windowSum('impressions', (rows) => ({
      impressions: rows.reduce((a, s) => a + (s.impressions || 0), 0),
      engagements: rows.reduce((a, s) => a + (s.clicks || 0) + (s.reactions || 0) + (s.comments || 0) + (s.reposts || 0), 0),
    }));
    const newFollowers = windowSum('newFollowers', (rows) => rows.reduce((a, s) => a + (s.newFollowers || 0), 0));
    const followers = snaps.find((s) => (s.followers || 0) > 0)?.followers || 0;
    return {
      ...base,
      hasData: true,
      followers,
      impressions,
      newFollowers,
      engagementRate: impressions > 0 ? +((engagements / impressions) * 100).toFixed(2) : 0,
    };
  }));
  res.json({ success: true, days: DAYS, platform: 'LinkedIn', organizations });
});

// @route GET /api/analytics/:platform/report — rich report: latest, previous, WoW deltas, series
export const getPlatformReport = asyncHandler(async (req, res) => {
  const orgId = resolveViewOrgId(req); // any user may view any org
  const { platform } = req.params;
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }

  // Window length for the period comparison, matching LinkedIn's range presets
  // (Past 7 / 14 / 28 / 90 / 365 days, plus 30 and 180). Defaults to 7.
  // "This period" = the most recent N days; "last period" = the N days before.
  const ALLOWED_RANGES = [7, 14, 15, 28, 30, 90, 180, 365];
  let rangeDays = ALLOWED_RANGES.includes(Number(req.query.range)) ? Number(req.query.range) : 7;

  // Custom window (LinkedIn's "Custom" range picker): explicit ?from=YYYY-MM-DD
  // &to=YYYY-MM-DD. Overrides the preset — the window is exactly [from, to] and
  // the previous period is the same number of days immediately before it.
  const parseQDate = (s) => { const d = s ? new Date(`${String(s).slice(0, 10)}T00:00:00Z`) : null; return d && !isNaN(d) ? d : null; };
  const customFrom = parseQDate(req.query.from);
  const customTo = parseQDate(req.query.to);
  const hasCustom = !!(customFrom && customTo && customTo >= customFrom);
  if (hasCustom) rangeDays = Math.min(730, Math.round((customTo - customFrom) / 86400000) + 1);

  // Optional ?anchor=<field>: end the range window at the latest snapshot where
  // that field has data. LinkedIn's exports end on different dates per tab
  // (visitor data lags content by a day or two), so anchoring each tab on its
  // own metric makes the totals match LinkedIn's UI exactly instead of a
  // boundary day slipping out of the window.
  const anchorField = FIELD_LABELS[req.query.anchor] ? String(req.query.anchor) : null;

  // Enough daily snapshots for a full 365-day window PLUS its comparison
  // period (and headroom), so a year-long LinkedIn export aggregates fully.
  const snapshots = await Analytics.find({ organization: orgId, platform }).sort({ date: -1 }).limit(800).lean();
  const latest = snapshots[0] || null;
  // Week-over-week: compare the latest entry against the most recent entry that
  // is at least 7 days older (so daily uploads compare to ~the same day last
  // week, not just yesterday). Falls back to the immediately previous entry.
  let previous = snapshots[1] || null;
  if (latest) {
    const weekAgo = new Date(latest.date).getTime() - 7 * 24 * 60 * 60 * 1000;
    const prior = snapshots.find((s, i) => i > 0 && new Date(s.date).getTime() <= weekAgo);
    if (prior) previous = prior;
  }
  const fields = flatFields(platform);

  const deltas = {};
  for (const f of fields) deltas[f] = computeDelta(latest?.[f], previous?.[f]);

  // Oldest → newest for charting
  const series = [...snapshots].reverse().map((s) => {
    const row = { date: s.date };
    for (const f of fields) row[f] = s[f] ?? 0;
    return row;
  });

  // ---- Weekly aggregation ----
  // Bucket the daily snapshots into rolling 7-day weeks anchored on the latest
  // date (so "this week" = the most recent 7 days, "last week" = the 7 before).
  // Counts (impressions, clicks, reactions…) are summed; follower-style totals
  // take the end-of-week value.
  // On YouTube these are cumulative lifetime totals, so they take the end-of-week
  // value (growth = delta) rather than being summed.
  const STOCK_FIELDS = new Set(['followers', 'subscribers', 'profilesManaged', 'followersLast30Days',
    ...(platform === 'YouTube' ? ['views', 'videoCount', 'comments'] : [])]);
  // Engagement rate is DERIVED from the period totals exactly like LinkedIn does
  // — engagements ÷ impressions over the whole period — not an average of each
  // day's percentage (which is mathematically wrong and drifts a few tenths).
  // We only use the components a platform actually tracks.
  const ENGAGEMENT_COMPONENTS = ['clicks', 'reactions', 'comments', 'reposts', 'shares'].filter((f) => fields.includes(f));
  const aggregateWeek = (rows) => {
    const out = {};
    for (const f of fields) {
      if (PERCENT_FIELDS.has(f)) {
        out[f] = 0; // filled in below from totals
      } else if (STOCK_FIELDS.has(f)) {
        out[f] = rows[rows.length - 1]?.[f] || 0; // end-of-week snapshot
      } else {
        out[f] = rows.reduce((a, r) => a + (r[f] || 0), 0); // period total
      }
    }
    // Engagement rate = total engagements ÷ total impressions (LinkedIn's method).
    // Fall back to the impression-weighted average of stored daily rates only when
    // the underlying counts weren't provided, so a rate-only import still shows.
    if (out.engagementRate !== undefined) {
      const engagements = ENGAGEMENT_COMPONENTS.reduce((a, f) => a + (out[f] || 0), 0);
      if (out.impressions > 0 && engagements > 0) {
        out.engagementRate = +((engagements / out.impressions) * 100).toFixed(2);
      } else {
        const totalImp = rows.reduce((a, r) => a + (r.impressions || 0), 0);
        out.engagementRate = totalImp > 0
          ? +(rows.reduce((a, r) => a + (r.engagementRate || 0) * (r.impressions || 0), 0) / totalImp).toFixed(2)
          : (rows.length ? +(rows.reduce((a, r) => a + (r.engagementRate || 0), 0) / rows.length).toFixed(2) : 0);
      }
    }
    // Any other percentage fields keep the impression-weighted average.
    for (const f of fields) {
      if (!PERCENT_FIELDS.has(f) || f === 'engagementRate') continue;
      const totalImp = rows.reduce((a, r) => a + (r.impressions || 0), 0);
      out[f] = totalImp > 0
        ? +(rows.reduce((a, r) => a + (r[f] || 0) * (r.impressions || 0), 0) / totalImp).toFixed(2)
        : (rows.length ? +(rows.reduce((a, r) => a + (r[f] || 0), 0) / rows.length).toFixed(2) : 0);
    }
    return out;
  };
  const rangeOf = (rows) => (rows.length ? { from: rows[0].date, to: rows[rows.length - 1].date, days: rows.length } : null);

  let weekly = null;
  if (latest) {
    const asc = [...snapshots].reverse(); // oldest → newest
    let anchorSnap = latest;
    if (hasCustom) {
      anchorSnap = { date: customTo }; // window ends exactly on the chosen date
    } else if (anchorField) {
      const hit = snapshots.find((s) => (s[anchorField] || 0) > 0); // snapshots are newest-first
      if (hit) anchorSnap = hit;
    }
    const latestTime = new Date(anchorSnap.date).getTime();
    const windowMs = rangeDays * 24 * 60 * 60 * 1000;
    const buckets = new Map(); // periodIndex (0 = most recent N days) → rows
    for (const s of asc) {
      const idx = Math.floor((latestTime - new Date(s.date).getTime()) / windowMs);
      if (idx < 0) continue;
      if (!buckets.has(idx)) buckets.set(idx, []);
      buckets.get(idx).push(s);
    }
    const cur = buckets.get(0) || [];
    const prev = buckets.get(1) || [];
    const wDeltas = {};
    const curAgg = aggregateWeek(cur);
    const prevAgg = aggregateWeek(prev);
    for (const f of fields) wDeltas[f] = computeDelta(curAgg[f], prevAgg[f]);
    const wSeries = [...buckets.entries()]
      .sort((a, b) => b[0] - a[0]) // oldest period first
      .map(([, rows]) => ({ ...rangeOf(rows), ...aggregateWeek(rows) }));
    weekly = {
      rangeDays,
      anchorDate: anchorSnap.date,
      current: curAgg,
      previous: prevAgg,
      currentRange: rangeOf(cur),
      previousRange: rangeOf(prev),
      hasPrevious: prev.length > 0,
      deltas: wDeltas,
      series: wSeries,
    };
  }

  res.json({
    success: true,
    platform,
    hasData: !!latest,
    groups: PLATFORM_FIELDS[platform],
    labels: FIELD_LABELS,
    percentFields: [...PERCENT_FIELDS],
    ranges: ALLOWED_RANGES,
    rangeDays,
    latest,
    previous,
    deltas,
    series,
    weekly,
  });
});

// @route GET /api/analytics/:platform/history — recent snapshots (kept for simple trend use)
export const getPlatformHistory = asyncHandler(async (req, res) => {
  const orgId = resolveViewOrgId(req); // any user may view any org
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

// @route POST /api/analytics  (ADMIN/CEO) — save metrics for a specific date.
// Upserts by day so manual entry merges with imported data: only the fields the
// user actually filled are written, leaving everything else for that date intact.
export const recordAnalytics = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const { platform } = req.body;
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }

  // The date the metrics apply to (default today), normalized to UTC midnight so
  // it lines up with imported daily snapshots.
  const parsed = req.body.date ? new Date(req.body.date) : new Date();
  if (isNaN(parsed)) { res.status(400); throw new Error('Invalid date'); }
  const day = new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  const allowed = flatFields(platform);
  let snapshot = await Analytics.findOne({ organization: orgId, platform, date: { $gte: day, $lt: dayEnd } });
  if (!snapshot) snapshot = new Analytics({ organization: orgId, platform, date: day });
  for (const field of allowed) {
    const raw = req.body[field];
    if (raw === undefined || raw === '' || raw === null) continue; // leave existing/blank untouched
    const val = Number(raw);
    snapshot[field] = Number.isFinite(val) && val >= 0 ? val : 0;
  }
  await snapshot.save();

  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.ANALYTICS_UPDATED, description: `Updated ${platform} analytics for ${day.toISOString().slice(0, 10)}`, entityType: 'Analytics', entityId: snapshot._id });
  res.status(201).json({ success: true, snapshot });
});

// @route DELETE /api/analytics?platform=LinkedIn  (ADMIN/CEO) — clear stored
// metrics for an org so fresh numbers can be entered/imported. With a platform,
// only that platform is cleared; without one, every platform for the org is.
// Clearing LinkedIn also removes its export-derived data (post performance and
// audience demographics) so a fresh upload starts from a truly clean slate.
export const clearAnalytics = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const filter = { organization: orgId };
  const { platform } = req.query;
  if (platform) {
    if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }
    filter.platform = platform;
  }
  const result = await Analytics.deleteMany(filter);
  if (!platform || platform === 'LinkedIn') {
    const { default: LinkedInPost } = await import('../models/LinkedInPost.js');
    const { default: AudienceDemographic } = await import('../models/AudienceDemographic.js');
    await LinkedInPost.deleteMany({ organization: orgId });
    await AudienceDemographic.deleteMany({ organization: orgId, platform: 'LinkedIn' });
  }
  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.ANALYTICS_UPDATED, description: `Cleared ${platform || 'all'} analytics (${result.deletedCount} entries)`, entityType: 'Analytics' });
  res.json({ success: true, deleted: result.deletedCount });
});

// ----------------------------------------------------------------------------
// Excel import — daily analytics export (e.g. LinkedIn's downloaded sheets)
// ----------------------------------------------------------------------------

// Each Analytics field with the header patterns that map to it, most specific
// first. Order matters: e.g. uniqueImpressions is detected before impressions,
// and the column it claims is then excluded from the broader "impression" match.
const ANALYTICS_COLUMNS = [
  { field: 'date', pats: [/^date$/, /date/] },
  { field: 'newFollowers', pats: [/newfollower/, /followersgained|followergained|netnewfollower/] },
  { field: 'organicFollowers', pats: [/organicfollower/] },
  { field: 'sponsoredFollowers', pats: [/sponsoredfollower|paidfollower/] },
  { field: 'followers', pats: [/totalfollower/, /^followers$/, /follower/] },
  { field: 'uniqueImpressions', pats: [/uniqueimpression/] },
  { field: 'impressions', pats: [/impressionstotal/, /^impressions$/, /impressionsorganic/, /impression/] },
  { field: 'clickThroughRate', pats: [/clickthrough/, /ctr/], percent: true },
  // Both must be claimed before the broad clicks patterns (/clickstotal/ would
  // otherwise swallow "Custom button clicks (total)" from the Visitors export).
  // LinkedIn's Visitors export repeats button clicks per device — prefer the
  // aggregate "(total)" column, fall back to any custom-button column.
  { field: 'customButtonClicks', pats: [/^(total)?custombuttonclickstotal$/, /custombutton|buttonclick|ctaclick/] },
  { field: 'linkClicks', pats: [/linkclick/] },
  // The broad fallback must never grab button/link/CTR click columns left over
  // from the Visitors export (e.g. "Custom button clicks (desktop)").
  { field: 'clicks', pats: [/^clickstotal$/, /^clicks$/, /clicksorganic/, /^(?!.*button)(?!.*link)(?!.*through).*click/] },
  { field: 'engagementRate', pats: [/engagementratetotal/, /engagementrateorganic/, /engagementrate/, /engagement/], percent: true },
  { field: 'interactions', pats: [/totalinteraction/, /^interactions?$/, /interaction/] },
  { field: 'reactions', pats: [/reactionstotal/, /reactionsorganic/, /reaction|likes/] },
  { field: 'comments', pats: [/commentstotal/, /commentsorganic/, /comment/] },
  { field: 'reposts', pats: [/repoststotal/, /repostsorganic/, /repost|share/] },
  { field: 'postsPublished', pats: [/postspublished/, /^posts$/, /^postscount$/] }, // not /posts/ — that matches "reposts"
  // LinkedIn's Visitors export has one column set PER PAGE TAB ("Overview page
  // views (desktop)", "Life page views (mobile)", "Jobs …") plus the aggregate
  // "Total page views/unique visitors (…)" columns. Anchored patterns claim the
  // aggregates first so the report matches the numbers LinkedIn's UI shows;
  // the loose patterns remain as fallbacks for simpler sheets.
  { field: 'desktopPageViews', pats: [/^totalpageviewsdesktop$/, /desktoppageview/, /desktop/] },
  { field: 'mobilePageViews', pats: [/^totalpageviewsmobile$/, /mobilepageview/, /mobile/] },
  { field: 'uniqueVisitors', pats: [/^totaluniquevisitorstotal$/, /uniquevisitorstotal$/, /uniquevisitor/] },
  { field: 'pageViews', pats: [/^totalpageviewstotal$/, /pageviewstotal$/, /totalpageview/, /pageview/] },
  // Must not claim LinkedIn's "… unique visitors (…)" leftovers.
  { field: 'visits', pats: [/pagevisit|profilevisit/, /^visits?$/, /^(?!.*visitor).*visit/] },
  { field: 'searchAppearances', pats: [/searchappearance/] },
  { field: 'leadFormViews', pats: [/leadform/] },
  { field: 'leadConversionRate', pats: [/leadconversion/], percent: true },
  { field: 'leads', pats: [/^leads?$/, /leadsgenerated|leadgen|leads/] },
  { field: 'reach', pats: [/reach/] },
  { field: 'subscribers', pats: [/subscriber/] },
  // Anchored/specific only — a broad /views/ would swallow LinkedIn's leftover
  // per-tab "… page views (…)" columns.
  { field: 'views', pats: [/^views$/, /^viewstotal$/, /videoview/, /^(?!.*page)(?!.*visitor)(?!.*impression).*views$/] },
  { field: 'watchHours', pats: [/watchhour|watchtime/] },
];
const PERCENT_IMPORT = new Set(ANALYTICS_COLUMNS.filter((c) => c.percent).map((c) => c.field));

// Build { field: columnIndex } from a candidate header row. Each column is
// claimed by at most one field, so specific fields win over broad ones.
const buildAnalyticsColumns = (headerVals) => {
  const headers = [];
  (headerVals || []).forEach((v, col) => { if (col === 0) return; const n = normHeader(v); if (n) headers.push({ col, norm: n }); });
  const map = {};
  const claimed = new Set();
  for (const { field, pats } of ANALYTICS_COLUMNS) {
    for (const pat of pats) {
      const hit = headers.find((h) => !claimed.has(h.col) && pat.test(h.norm));
      if (hit) { map[field] = hit.col; claimed.add(hit.col); break; }
    }
  }
  return map;
};

// Parse a date cell: a real Date (exceljs date cells), MM/DD/YYYY (LinkedIn),
// YYYY-MM-DD, or anything Date can parse. Returns a UTC midnight Date or null.
export const parseDateCell = (v) => {
  if (v instanceof Date && !isNaN(v)) return new Date(Date.UTC(v.getUTCFullYear(), v.getUTCMonth(), v.getUTCDate()));
  const s = cellText(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/); // MM/DD/YYYY
  if (m) { const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]; return new Date(Date.UTC(y, +m[1] - 1, +m[2])); }
  m = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/); // YYYY-MM-DD
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const d = new Date(s);
  return isNaN(d) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

// Ingest one grid of daily rows (a sheet with a Date column + metric columns)
// into Analytics snapshots. Returns null when the grid has no such header, so
// callers can probe arbitrary sheets. Only the columns present are written, so
// several exports for the same dates merge. Reused by the LinkedIn multi-sheet
// import (linkedinController).
export const ingestDailyGrid = async (grid, orgId, platform) => {
  // Find the header row — first row with a Date column and at least one metric.
  let headerRow = -1;
  let map = null;
  for (let i = 0; i < grid.length; i++) {
    const m = buildAnalyticsColumns(grid[i]);
    if (m.date != null && Object.keys(m).length >= 2) { headerRow = i; map = m; break; }
  }
  if (!map) return null;

  // Parse the data rows first (oldest → newest) so cumulative followers can
  // roll forward regardless of the sheet's row order.
  const parsed = [];
  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const date = parseDateCell(row[map.date]);
    if (date) parsed.push({ date, row });
  }
  parsed.sort((a, b) => a.date - b.date);

  // LinkedIn QUIRK: in the Followers export, the column named "Total followers"
  // is NOT the audience size — it's that day's gains (organic + sponsored).
  // Detect that shape (total == organic + sponsored on nearly every row) and
  // treat the column as newFollowers instead, so the audience total never gets
  // overwritten with a day's gain count.
  let gainsStyleFollowers = false;
  if (map.followers != null && (map.organicFollowers != null || map.sponsoredFollowers != null) && map.newFollowers == null) {
    let checked = 0;
    let matches = 0;
    for (const { row } of parsed.slice(0, 40)) {
      const tot = cellNumber(row[map.followers]);
      const sum = (map.organicFollowers != null ? cellNumber(row[map.organicFollowers]) : 0)
        + (map.sponsoredFollowers != null ? cellNumber(row[map.sponsoredFollowers]) : 0);
      checked += 1;
      if (tot === sum) matches += 1;
    }
    // Even one row decides it: a page's cumulative total coincidentally
    // equalling that same day's organic+sponsored gains is practically
    // impossible, and short weekly exports must be detected too.
    if (checked >= 1 && matches / checked >= 0.8) {
      map.newFollowers = map.followers;
      delete map.followers;
      gainsStyleFollowers = true;
    }
  }

  const metricFields = Object.keys(map).filter((f) => f !== 'date');
  let created = 0;
  let updated = 0;
  let minDate = null;
  let maxDate = null;
  let runningFollowers = null; // cumulative roll-forward for gains-style imports

  for (const { date, row } of parsed) {
    const dayEnd = new Date(date.getTime() + 86400000);
    let snap = await Analytics.findOne({ organization: orgId, platform, date: { $gte: date, $lt: dayEnd } });
    const isNew = !snap;
    if (!snap) snap = new Analytics({ organization: orgId, platform, date });

    for (const field of metricFields) {
      let val = cellNumber(row[map[field]]);
      // LinkedIn exports rates as fractions (0.0699 = 6.99%). Store as percent.
      if (PERCENT_IMPORT.has(field) && val > 0 && val <= 1) val = +(val * 100).toFixed(2);
      snap[field] = val;
    }
    // LinkedIn's Followers export has no "New followers" column — its UI sums
    // the organic + sponsored gains. Derive it so follower-gain charts work.
    if (map.newFollowers == null && (map.organicFollowers != null || map.sponsoredFollowers != null)) {
      snap.newFollowers = (snap.organicFollowers || 0) + (snap.sponsoredFollowers || 0);
    }
    // Gains-style import: the export never carries the audience total, so roll
    // it forward from the last known cumulative value (set once via the
    // followers-baseline sync). Without a baseline it stays 0 until synced.
    if (gainsStyleFollowers) {
      if (runningFollowers === null) {
        const prevSnap = await Analytics.findOne({
          organization: orgId, platform, date: { $lt: parsed[0].date }, followers: { $gt: 0 },
        }).sort({ date: -1 }).lean();
        runningFollowers = prevSnap?.followers || 0;
      }
      if (runningFollowers > 0) {
        runningFollowers += snap.newFollowers || 0;
        snap.followers = runningFollowers;
      } else {
        snap.followers = 0; // unknown until the baseline sync — never a gain count
      }
    }
    await snap.save();

    if (isNew) created += 1; else updated += 1;
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
  }
  return { days: created + updated, created, updated, minDate, maxDate, mappedFields: metricFields };
};

// @route POST /api/analytics/import  (ADMIN/CEO) — import a daily analytics
// export (one row per date). Columns are auto-detected, so the LinkedIn
// "Engagement", "Followers", "Visitors" etc. downloads all work. Each row is
// upserted by date and only the columns present are written, so importing
// several exports for the same dates merges them. Existing data is never removed.
export const importAnalytics = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const platform = req.body.platform || 'LinkedIn';
  if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }
  if (!req.file) { res.status(400); throw new Error('No Excel file uploaded'); }

  let grid;
  try { grid = await loadGrid(req.file); }
  catch { res.status(400); throw new Error('Could not read the file. Please upload a valid .xlsx Excel file.'); }

  const result = await ingestDailyGrid(grid, orgId, platform);
  if (!result) {
    res.status(400);
    throw new Error('Could not detect the columns. The sheet needs a header row with a "Date" column and metric columns.');
  }
  const { days, created, updated, minDate, maxDate, mappedFields: metricFields } = result;
  if (days === 0) { res.status(400); throw new Error('No dated rows found under the header.'); }

  const fmt = (d) => (d ? d.toISOString().slice(0, 10) : null);
  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.ANALYTICS_UPDATED, description: `Imported ${created + updated} days of ${platform} analytics from Excel (${fmt(minDate)} → ${fmt(maxDate)})`, entityType: 'Analytics' });

  res.json({ success: true, platform, days: created + updated, created, updated, from: fmt(minDate), to: fmt(maxDate), mappedFields: metricFields });
});

// @route GET /api/analytics/template — a daily-import template (LinkedIn-style columns).
export const analyticsTemplate = asyncHandler(async (req, res) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Analytics');
  ws.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Impressions (total)', key: 'impressions', width: 18 },
    { header: 'Unique impressions (organic)', key: 'uniqueImpressions', width: 26 },
    { header: 'Clicks (total)', key: 'clicks', width: 14 },
    { header: 'Reactions (total)', key: 'reactions', width: 16 },
    { header: 'Comments (total)', key: 'comments', width: 16 },
    { header: 'Reposts (total)', key: 'reposts', width: 14 },
    { header: 'Engagement rate (total)', key: 'engagementRate', width: 22 },
  ];
  const head = ws.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2350' } };
  head.height = 22;
  ws.addRow({ date: '06/01/2026', impressions: 3071, uniqueImpressions: 867, clicks: 1301, reactions: 91, comments: 1, reposts: 0, engagementRate: 0.4536 });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="analytics-template.xlsx"');
  await wb.xlsx.write(res);
  res.end();
});
