import asyncHandler from 'express-async-handler';
import Analytics from '../models/Analytics.js';
import LinkedInPost from '../models/LinkedInPost.js';
import AudienceDemographic from '../models/AudienceDemographic.js';
import Competitor from '../models/Competitor.js';
import { ingestDailyGrid, parseDateCell } from './analyticsController.js';
import { logActivity } from '../utils/logActivity.js';
import { requireOrgId, resolveViewOrgId } from '../utils/org.js';
import { cellText, cellNumber, cellHyperlink, normHeader, loadAllGrids } from '../utils/sheet.js';
import { ACTIVITY_ACTIONS } from '../config/constants.js';

// ----------------------------------------------------------------------------
// LinkedIn export import — drop ANY analytics download from a LinkedIn company
// page (Content, Visitors, Followers, Competitors). Every worksheet in the file
// is inspected and routed to the right ingester:
//   • daily "Metrics" sheets            → Analytics snapshots (merged by date)
//   • "All posts" sheets                → LinkedInPost table
//   • demographic sheets (Location,
//     Job function, Seniority,
//     Industry, Company size)           → AudienceDemographic (replace per category)
//   • competitor sheets                 → Competitor entries (upsert by name)
// ----------------------------------------------------------------------------

// Percent-style cells in LinkedIn exports arrive as fractions (0.0699 = 6.99%).
const asPercent = (v) => (v > 0 && v <= 1 ? +(v * 100).toFixed(2) : +Number(v || 0).toFixed(2));

// ---- "All posts" sheet (Content export, second sheet) ----
const POST_COLUMNS = [
  { field: 'title', pats: [/^posttitle$/, /posttitle/, /^updatetitle$/] },
  { field: 'url', pats: [/postlink|posturl|updatelink|permalink/] },
  { field: 'postType', pats: [/^posttype$/, /campaigntype/] },
  { field: 'contentType', pats: [/contenttype/] },
  { field: 'postedBy', pats: [/postedby|createdby|author/] },
  { field: 'createdDate', pats: [/^createddate$/, /createddate|postdate|datepublished|publisheddate/] },
  { field: 'impressions', pats: [/^impressions$/, /impression/] },
  { field: 'views', pats: [/^views$/, /videoviews/] },
  { field: 'clickThroughRate', pats: [/clickthroughrate|^ctr$/], percent: true },
  { field: 'clicks', pats: [/^clicks$/, /click/] },
  { field: 'reactions', pats: [/reaction|^likes$/] },
  { field: 'comments', pats: [/comment/] },
  { field: 'reposts', pats: [/repost|share/] },
  { field: 'follows', pats: [/^follows$/, /followsgained/] },
  { field: 'engagementRate', pats: [/engagementrate/], percent: true },
];

const buildColumnMap = (headerVals, columns) => {
  const headers = [];
  (headerVals || []).forEach((v, col) => { if (col === 0) return; const n = normHeader(v); if (n) headers.push({ col, norm: n }); });
  const map = {};
  const claimed = new Set();
  for (const { field, pats } of columns) {
    for (const pat of pats) {
      const hit = headers.find((h) => !claimed.has(h.col) && pat.test(h.norm));
      if (hit) { map[field] = hit.col; claimed.add(hit.col); break; }
    }
  }
  return map;
};

// A posts sheet must have a post title/link AND at least one metric column.
const detectPostsSheet = (grid) => {
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const map = buildColumnMap(grid[i], POST_COLUMNS);
    if ((map.title != null || map.url != null) && (map.impressions != null || map.engagementRate != null)) {
      return { headerRow: i, map };
    }
  }
  return null;
};

const ingestPostsGrid = async (grid, orgId, det) => {
  const { headerRow, map } = det;
  const pct = new Set(POST_COLUMNS.filter((c) => c.percent).map((c) => c.field));
  let count = 0;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const title = map.title != null ? cellText(row[map.title]).trim() : '';
    const url = map.url != null ? (cellHyperlink(row[map.url]) || cellText(row[map.url]).trim()) : '';
    if (!title && !url) continue;

    const doc = { title, url };
    for (const field of ['postType', 'contentType', 'postedBy']) {
      if (map[field] != null) doc[field] = cellText(row[map[field]]).trim();
    }
    if (map.createdDate != null) doc.createdDate = parseDateCell(row[map.createdDate]) || undefined;
    for (const field of ['impressions', 'views', 'clicks', 'clickThroughRate', 'reactions', 'comments', 'reposts', 'follows', 'engagementRate']) {
      if (map[field] == null) continue;
      const val = cellNumber(row[map[field]]);
      doc[field] = pct.has(field) ? asPercent(val) : val;
    }

    // Upsert by URL when the export includes links, else by title + date.
    const key = url
      ? { organization: orgId, url }
      : { organization: orgId, title, ...(doc.createdDate ? { createdDate: doc.createdDate } : {}) };
    await LinkedInPost.findOneAndUpdate(key, { ...doc, organization: orgId }, { upsert: true, setDefaultsOnInsert: true });
    count += 1;
  }
  return count;
};

// ---- Demographic sheets (Followers & Visitors exports) ----
const DEMO_CATEGORIES = [
  { key: 'Location', pats: [/location|region|geograph/] },
  { key: 'Job function', pats: [/jobfunction|function/] },
  { key: 'Seniority', pats: [/seniority/] },
  { key: 'Industry', pats: [/industry/] },
  { key: 'Company size', pats: [/companysize/] },
];

// Detect a two-column demographic sheet: first column is the category label,
// another column holds followers / views / a percentage.
const detectDemographicSheet = (grid, sheetName) => {
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const row = grid[i] || [];
    const firstHeader = normHeader(row[1]);
    if (!firstHeader) continue;
    const cat = DEMO_CATEGORIES.find((c) => c.pats.some((p) => p.test(firstHeader) || p.test(normHeader(sheetName))));
    if (!cat) continue;
    // find the value column: totalfollowers / followers / views / percentage
    let valueCol = null;
    let isPercent = false;
    for (let col = 2; col < row.length; col++) {
      const n = normHeader(row[col]);
      if (!n) continue;
      if (/totalfollower|follower|views|visitors|pageviews/.test(n)) { valueCol = col; isPercent = false; break; }
      if (/percentage|percent/.test(n)) { valueCol = col; isPercent = true; }
    }
    if (valueCol != null) return { headerRow: i, labelCol: 1, valueCol, isPercent, category: cat.key };
  }
  return null;
};

const ingestDemographicGrid = async (grid, orgId, audience, det) => {
  const rows = [];
  for (let i = det.headerRow + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const label = cellText(row[det.labelCol]).trim();
    if (!label) continue;
    let value = cellNumber(row[det.valueCol]);
    if (det.isPercent) value = asPercent(value);
    rows.push({ organization: orgId, platform: 'LinkedIn', audience, category: det.category, label, value, isPercent: det.isPercent });
  }
  if (!rows.length) return 0;
  // Replace semantics: the latest export is the truth for this category.
  await AudienceDemographic.deleteMany({ organization: orgId, platform: 'LinkedIn', audience, category: det.category });
  await AudienceDemographic.insertMany(rows);
  return rows.length;
};

// ---- Competitor sheet ----
const COMPETITOR_COLUMNS = [
  { field: 'name', pats: [/^page$/, /pagename|competitorpage|company|competitor/] },
  { field: 'followers', pats: [/totalfollower/, /^followers$/] },
  { field: 'newFollowers', pats: [/newfollower/] },
  { field: 'engagements', pats: [/totalpostengagement|postengagement|totalengagement/] },
  { field: 'posts', pats: [/totalposts|^posts$/] },
  { field: 'engagementRate', pats: [/engagementrate/], percent: true },
];

const detectCompetitorSheet = (grid, sheetName) => {
  const nameHints = /competitor/.test(normHeader(sheetName));
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const map = buildColumnMap(grid[i], COMPETITOR_COLUMNS);
    if (map.name != null && map.followers != null && (nameHints || map.posts != null || map.engagements != null || map.newFollowers != null)) {
      return { headerRow: i, map };
    }
  }
  return null;
};

const ingestCompetitorGrid = async (grid, orgId, det) => {
  const { headerRow, map } = det;
  let count = 0;
  for (let i = headerRow + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    const name = cellText(row[map.name]).trim();
    if (!name) continue;
    const followers = cellNumber(row[map.followers]);
    const doc = { organization: orgId, platform: 'LinkedIn', name, followers };
    if (map.newFollowers != null) doc.newFollowers = cellNumber(row[map.newFollowers]);
    if (map.posts != null) doc.postsLast30Days = cellNumber(row[map.posts]);
    if (map.engagementRate != null) doc.engagementRate = asPercent(cellNumber(row[map.engagementRate]));
    else if (map.engagements != null) {
      // LinkedIn's competitor export gives total engagements + total posts; keep
      // a comparable rate: engagements per post relative to followers is opaque,
      // so store engagements/posts as-is only when a rate column is absent.
      const engagements = cellNumber(row[map.engagements]);
      const posts = map.posts != null ? cellNumber(row[map.posts]) : 0;
      if (followers > 0 && engagements > 0) doc.engagementRate = +((engagements / Math.max(posts, 1) / followers) * 100).toFixed(2);
    }
    await Competitor.findOneAndUpdate(
      { organization: orgId, platform: 'LinkedIn', name },
      doc,
      { upsert: true, setDefaultsOnInsert: true }
    );
    count += 1;
  }
  return count;
};

// Followers exports' daily sheet is "New followers"; visitors exports' is
// "Visitor metrics". Both are handled by ingestDailyGrid. The audience for a
// demographic sheet comes from which export it belongs to — inferred from the
// other sheets / filename.
const guessAudience = (sheetNames, filename) => {
  const all = normHeader(sheetNames.join(' ') + ' ' + (filename || ''));
  if (/visitor/.test(all)) return 'visitors';
  return 'followers';
};

// @route POST /api/linkedin/import  (ADMIN/CEO) — upload any LinkedIn analytics
// export; every sheet is auto-detected and ingested. Returns a per-sheet summary.
export const importLinkedIn = asyncHandler(async (req, res) => {
  const orgId = requireOrgId(req, res);
  if (!req.file) { res.status(400); throw new Error('No file uploaded'); }

  let sheets;
  try { sheets = await loadAllGrids(req.file); }
  catch { res.status(400); throw new Error('Could not read the file. Please upload the .xls/.xlsx file exactly as LinkedIn exported it.'); }

  const audience = guessAudience(sheets.map((s) => s.name), req.file.originalname);
  const summary = [];

  for (const { name, grid } of sheets) {
    if (!grid.length) continue;

    // Order matters: posts and competitor sheets would also partially match the
    // generic daily detector, so probe the specific shapes first.
    const posts = detectPostsSheet(grid);
    if (posts) {
      const n = await ingestPostsGrid(grid, orgId, posts);
      summary.push({ sheet: name, kind: 'posts', rows: n });
      continue;
    }
    const comp = detectCompetitorSheet(grid, name);
    if (comp) {
      const n = await ingestCompetitorGrid(grid, orgId, comp);
      summary.push({ sheet: name, kind: 'competitors', rows: n });
      continue;
    }
    const demo = detectDemographicSheet(grid, name);
    if (demo) {
      const n = await ingestDemographicGrid(grid, orgId, audience, demo);
      summary.push({ sheet: name, kind: `${audience} demographics — ${demo.category}`, rows: n });
      continue;
    }
    const daily = await ingestDailyGrid(grid, orgId, 'LinkedIn');
    if (daily && daily.days > 0) {
      summary.push({ sheet: name, kind: 'daily metrics', rows: daily.days, fields: daily.mappedFields });
      continue;
    }
    summary.push({ sheet: name, kind: 'skipped', rows: 0 });
  }

  const ingested = summary.filter((s) => s.kind !== 'skipped');
  if (!ingested.length) {
    res.status(400);
    throw new Error('No recognizable LinkedIn data found. Upload the file exactly as downloaded from LinkedIn (Content, Visitors, Followers or Competitor analytics).');
  }

  logActivity({
    user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.ANALYTICS_UPDATED,
    description: `Imported LinkedIn export "${req.file.originalname}" (${ingested.map((s) => `${s.kind}: ${s.rows}`).join(', ')})`,
    entityType: 'Analytics',
  });
  res.json({ success: true, file: req.file.originalname, sheets: summary });
});

// @route GET /api/linkedin/dashboard?organizationId=&days=
// Everything the LinkedIn-style view needs beyond the daily report: the post
// performance table, follower/visitor demographics, and competitors.
export const linkedinDashboard = asyncHandler(async (req, res) => {
  const orgId = resolveViewOrgId(req); // any user may view any org
  const days = Math.min(Math.max(Number(req.query.days) || 365, 7), 730);
  const since = new Date(Date.now() - days * 86400000);

  const [posts, demographics, competitors] = await Promise.all([
    LinkedInPost.find({ organization: orgId, $or: [{ createdDate: { $gte: since } }, { createdDate: null }] })
      .sort({ createdDate: -1 }).limit(200).lean(),
    AudienceDemographic.find({ organization: orgId, platform: 'LinkedIn' }).sort({ value: -1 }).lean(),
    Competitor.find({ organization: orgId, platform: 'LinkedIn' }).sort({ followers: -1 }).lean(),
  ]);

  // Group demographics: { followers: { Location: [{label,value}…] }, visitors: {…} }
  const demo = { followers: {}, visitors: {} };
  for (const d of demographics) {
    (demo[d.audience][d.category] = demo[d.audience][d.category] || []).push({ label: d.label, value: d.value, isPercent: d.isPercent });
  }

  res.json({ success: true, days, posts, demographics: demo, competitors });
});
