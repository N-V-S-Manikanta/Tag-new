import asyncHandler from 'express-async-handler';
import ExcelJS from 'exceljs';
import Analytics from '../models/Analytics.js';
import Organization from '../models/Organization.js';
import { logActivity } from '../utils/logActivity.js';
import { requireOrgId } from '../utils/org.js';
import { cellText, cellNumber, normHeader, loadGrid } from '../utils/sheet.js';
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

  // Up to ~4 months of daily snapshots (or years of weekly) so imported daily
  // exports render in full, not just the last couple of weeks.
  const snapshots = await Analytics.find({ organization: orgId, platform }).sort({ date: -1 }).limit(120).lean();
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
  // take the end-of-week value; rates (engagement %) are impression-weighted.
  const STOCK_FIELDS = new Set(['followers', 'subscribers', 'profilesManaged', 'followersLast30Days']);
  const aggregateWeek = (rows) => {
    const out = {};
    const totalImp = rows.reduce((a, r) => a + (r.impressions || 0), 0);
    for (const f of fields) {
      if (PERCENT_FIELDS.has(f)) {
        out[f] = totalImp > 0
          ? +(rows.reduce((a, r) => a + (r[f] || 0) * (r.impressions || 0), 0) / totalImp).toFixed(2)
          : (rows.length ? +(rows.reduce((a, r) => a + (r[f] || 0), 0) / rows.length).toFixed(2) : 0);
      } else if (STOCK_FIELDS.has(f)) {
        out[f] = rows[rows.length - 1]?.[f] || 0; // end-of-week snapshot
      } else {
        out[f] = rows.reduce((a, r) => a + (r[f] || 0), 0); // weekly total
      }
    }
    return out;
  };
  const rangeOf = (rows) => (rows.length ? { from: rows[0].date, to: rows[rows.length - 1].date, days: rows.length } : null);

  let weekly = null;
  if (latest) {
    const asc = [...snapshots].reverse(); // oldest → newest
    const latestTime = new Date(latest.date).getTime();
    const WEEK = 7 * 24 * 60 * 60 * 1000;
    const buckets = new Map(); // weekIndex (0 = most recent 7 days) → rows
    for (const s of asc) {
      const idx = Math.floor((latestTime - new Date(s.date).getTime()) / WEEK);
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
      .sort((a, b) => b[0] - a[0]) // oldest week first
      .map(([, rows]) => ({ ...rangeOf(rows), ...aggregateWeek(rows) }));
    weekly = {
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
    latest,
    previous,
    deltas,
    series,
    weekly,
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

// @route DELETE /api/analytics?platform=LinkedIn  (ADMIN/CEO) — clear stored
// metrics for an org so fresh numbers can be entered/imported. With a platform,
// only that platform is cleared; without one, every platform for the org is.
export const clearAnalytics = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  const filter = { organization: orgId };
  const { platform } = req.query;
  if (platform) {
    if (!PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }
    filter.platform = platform;
  }
  const result = await Analytics.deleteMany(filter);
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
  { field: 'clicks', pats: [/clickstotal/, /^clicks$/, /clicksorganic/, /click/] },
  { field: 'engagementRate', pats: [/engagementratetotal/, /engagementrateorganic/, /engagementrate/, /engagement/], percent: true },
  { field: 'reactions', pats: [/reactionstotal/, /reactionsorganic/, /reaction|likes/] },
  { field: 'comments', pats: [/commentstotal/, /commentsorganic/, /comment/] },
  { field: 'reposts', pats: [/repoststotal/, /repostsorganic/, /repost|share/] },
  { field: 'postsPublished', pats: [/postspublished/, /^posts$/, /^postscount$/] }, // not /posts/ — that matches "reposts"
  { field: 'desktopPageViews', pats: [/desktoppageview/, /desktop/] },
  { field: 'mobilePageViews', pats: [/mobilepageview/, /mobile/] },
  { field: 'uniqueVisitors', pats: [/uniquevisitor/] },
  { field: 'pageViews', pats: [/totalpageview/, /pageviewstotal/, /pageview/] },
  { field: 'customButtonClicks', pats: [/custombutton|buttonclick|ctaclick/] },
  { field: 'searchAppearances', pats: [/searchappearance/] },
  { field: 'leadFormViews', pats: [/leadform/] },
  { field: 'leadConversionRate', pats: [/leadconversion/], percent: true },
  { field: 'leads', pats: [/^leads?$/, /leadsgenerated|leadgen|leads/] },
  { field: 'reach', pats: [/reach/] },
  { field: 'subscribers', pats: [/subscriber/] },
  { field: 'views', pats: [/^views$/, /videoview|views/] },
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
const parseDateCell = (v) => {
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

  // Find the header row — first row with a Date column and at least one metric.
  let headerRow = -1;
  let map = null;
  for (let i = 0; i < grid.length; i++) {
    const m = buildAnalyticsColumns(grid[i]);
    if (m.date != null && Object.keys(m).length >= 2) { headerRow = i; map = m; break; }
  }
  if (!map) {
    res.status(400);
    throw new Error('Could not detect the columns. The sheet needs a header row with a "Date" column and metric columns.');
  }

  const metricFields = Object.keys(map).filter((f) => f !== 'date');
  let created = 0;
  let updated = 0;
  let minDate = null;
  let maxDate = null;

  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const date = parseDateCell(row[map.date]);
    if (!date) continue;

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
    await snap.save();

    if (isNew) created += 1; else updated += 1;
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
  }

  if (created + updated === 0) { res.status(400); throw new Error('No dated rows found under the header.'); }

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
