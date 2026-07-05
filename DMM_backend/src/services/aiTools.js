// Read-only data tools the AI assistant can call. Each tool queries the live
// database and returns compact JSON for the model to reason over. Tools never
// mutate anything, and results are scoped by the calling user's role where the
// data is personal (approvals, plans).

import Organization from '../models/Organization.js';
import Analytics from '../models/Analytics.js';
import Goal from '../models/Goal.js';
import ApprovalRequest from '../models/ApprovalRequest.js';
import PostPlan from '../models/PostPlan.js';
import '../models/User.js'; // registers the User schema for populate('createdBy')
import { computeProgress } from '../controllers/goalController.js';
import { PLATFORMS, ROLES, APPROVAL_STATUS } from '../config/constants.js';

// Metrics that are lifetime totals (report end-of-period value, not a sum).
const STOCK_FIELDS = new Set(['followers', 'subscribers', 'engagementRate', 'clickThroughRate', 'leadConversionRate', 'profilesManaged', 'followersLast30Days']);
const YT_STOCK = new Set(['views', 'videoCount', 'comments', 'watchHours']);
// Period fields worth summing for a window summary.
const PERIOD_FIELDS = [
  'newFollowers', 'impressions', 'uniqueImpressions', 'reach', 'searchAppearances', 'views', 'watchHours',
  'postsPublished', 'clicks', 'reactions', 'comments', 'reposts', 'interactions',
  'pageViews', 'uniqueVisitors', 'visits', 'linkClicks', 'leads',
];

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const iso = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// Resolve an organization by (partial) name so the model can say "NCET".
const resolveOrg = async (name) => {
  if (!name) return null;
  const exact = await Organization.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') }).lean();
  if (exact) return exact;
  return Organization.findOne({ name: new RegExp(escapeRegex(name), 'i') }).lean();
};

// ---- Tool definitions (Anthropic tool schema) ----
export const TOOL_DEFINITIONS = [
  {
    name: 'list_organizations',
    description: 'List every organization on the platform with its website and brand color. Use this first when you are unsure of exact organization names.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'social_media_overview',
    description: 'Latest audience size (followers/subscribers) for EVERY organization on EVERY platform in one call, with the date of the last data entry. Best for comparisons and "which org is biggest/growing" questions.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'platform_metrics',
    description: 'Detailed metrics for one organization on one platform over a recent window: latest audience, growth vs the start of the window, and totals for period metrics (impressions, reach, interactions, clicks…).',
    input_schema: {
      type: 'object',
      properties: {
        organization: { type: 'string', description: 'Organization name, e.g. "NCET"' },
        platform: { type: 'string', enum: PLATFORMS },
        days: { type: 'number', description: 'Window length in days (default 28, max 365)' },
      },
      required: ['organization', 'platform'],
    },
  },
  {
    name: 'growth_goals',
    description: "An organization's growth goals per platform with live progress: target vs current followers, followers gained since the goal started, posts published in the period, and time remaining.",
    input_schema: {
      type: 'object',
      properties: { organization: { type: 'string', description: 'Organization name' } },
      required: ['organization'],
    },
  },
  {
    name: 'approvals_summary',
    description: 'Content approval requests: counts by status and platform plus the most recent requests. Optionally filter to one organization and/or a recent window.',
    input_schema: {
      type: 'object',
      properties: {
        organization: { type: 'string', description: 'Organization name (optional)' },
        days: { type: 'number', description: 'Only requests created in the last N days (optional)' },
      },
      required: [],
    },
  },
  {
    name: 'post_plans',
    description: 'Post planner submissions: upcoming posting plans and their approval status, window and post counts. Optionally filter by organization or status.',
    input_schema: {
      type: 'object',
      properties: {
        organization: { type: 'string', description: 'Organization name (optional)' },
        status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED', 'RESUBMITTED'] },
      },
      required: [],
    },
  },
];

// ---- Tool handlers ----
const handlers = {
  async list_organizations() {
    const orgs = await Organization.find({ isActive: true }).select('name description website color').sort({ name: 1 }).lean();
    return orgs.map((o) => ({ name: o.name, website: o.website || null, color: o.color, description: o.description || undefined }));
  },

  async social_media_overview() {
    const [orgs, latest] = await Promise.all([
      Organization.find({ isActive: true }).select('name').lean(),
      Analytics.aggregate([
        { $sort: { date: -1 } },
        {
          $group: {
            _id: { org: '$organization', platform: '$platform' },
            followers: { $first: '$followers' },
            subscribers: { $first: '$subscribers' },
            engagementRate: { $first: '$engagementRate' },
            date: { $first: '$date' },
          },
        },
      ]),
    ]);
    const nameById = Object.fromEntries(orgs.map((o) => [String(o._id), o.name]));
    return latest
      .filter((r) => nameById[String(r._id.org)])
      .map((r) => ({
        organization: nameById[String(r._id.org)],
        platform: r._id.platform,
        audience: r._id.platform === 'YouTube' ? r.subscribers : r.followers,
        engagementRate: r.engagementRate || undefined,
        lastEntry: iso(r.date),
      }));
  },

  async platform_metrics({ organization, platform, days = 28 }) {
    const org = await resolveOrg(organization);
    if (!org) return { error: `No organization matching "${organization}" — call list_organizations for valid names.` };
    if (!PLATFORMS.includes(platform)) return { error: `platform must be one of ${PLATFORMS.join(', ')}` };
    const windowDays = Math.min(Math.max(Number(days) || 28, 1), 365);
    const since = new Date(Date.now() - windowDays * 86400000);

    const [latest, baseline, snaps] = await Promise.all([
      Analytics.findOne({ organization: org._id, platform }).sort({ date: -1 }).lean(),
      Analytics.findOne({ organization: org._id, platform, date: { $lte: since } }).sort({ date: -1 }).lean(),
      Analytics.find({ organization: org._id, platform, date: { $gt: since } }).sort({ date: 1 }).lean(),
    ]);
    if (!latest) return { organization: org.name, platform, note: 'No analytics data recorded yet for this platform.' };

    const audienceField = platform === 'YouTube' ? 'subscribers' : 'followers';
    const isStock = (f) => STOCK_FIELDS.has(f) || (platform === 'YouTube' && YT_STOCK.has(f));
    const totals = {};
    for (const f of PERIOD_FIELDS) {
      if (isStock(f)) continue;
      const sum = snaps.reduce((a, s) => a + (s[f] || 0), 0);
      if (sum > 0) totals[f] = sum;
    }
    // For lifetime counters report the end-of-window value instead of a sum.
    const stocks = {};
    for (const f of ['views', 'videoCount', 'comments', 'watchHours']) {
      if (isStock(f) && latest[f]) stocks[f] = latest[f];
    }
    return {
      organization: org.name,
      platform,
      windowDays,
      dataPointsInWindow: snaps.length,
      latestEntry: iso(latest.date),
      audience: { field: audienceField, current: latest[audienceField] || 0, atWindowStart: baseline?.[audienceField] ?? null, gained: baseline ? (latest[audienceField] || 0) - (baseline[audienceField] || 0) : null },
      engagementRatePct: latest.engagementRate || 0,
      periodTotals: totals,
      lifetimeTotals: Object.keys(stocks).length ? stocks : undefined,
    };
  },

  async growth_goals({ organization }) {
    const org = await resolveOrg(organization);
    if (!org) return { error: `No organization matching "${organization}" — call list_organizations for valid names.` };
    const goals = await Goal.find({ organization: org._id }).lean();
    if (!goals.length) return { organization: org.name, note: 'No growth goals set yet for this organization.' };
    return Promise.all(goals.map(async (g) => {
      const p = await computeProgress(g);
      const daysLeft = Math.max(0, Math.ceil((new Date(g.endDate) - Date.now()) / 86400000));
      return {
        organization: org.name,
        platform: g.platform,
        period: `${iso(g.startDate)} to ${iso(g.endDate)}`,
        daysLeft,
        targetFollowers: g.targetFollowers || undefined,
        currentFollowers: p.currentFollowers,
        gainedSinceStart: p.gainedFollowers,
        targetPosts: g.targetPosts || undefined,
        postsPublished: p.postsPublished,
        note: g.note || undefined,
      };
    }));
  },

  async approvals_summary({ organization, days } = {}, user) {
    const query = {};
    // Regular users only see their own requests — same rule as the approvals page.
    if (user.role === ROLES.USER) query.createdBy = user._id;
    else if (user.role === ROLES.CEO) query.organization = user.organization?._id || user.organization;
    if (organization) {
      const org = await resolveOrg(organization);
      if (!org) return { error: `No organization matching "${organization}".` };
      query.organization = org._id;
    }
    if (days) query.createdAt = { $gte: new Date(Date.now() - Math.min(Number(days) || 30, 365) * 86400000) };

    const [byStatus, byPlatform, recent] = await Promise.all([
      ApprovalRequest.aggregate([{ $match: query }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      ApprovalRequest.aggregate([{ $match: query }, { $group: { _id: '$platform', n: { $sum: 1 } } }]),
      ApprovalRequest.find(query).populate('organization', 'name').populate('createdBy', 'name').sort({ createdAt: -1 }).limit(10).lean(),
    ]);
    return {
      counts: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
      byPlatform: Object.fromEntries(byPlatform.map((p) => [p._id, p.n])),
      recent: recent.map((r) => ({
        title: r.title, status: r.status, platform: r.platform,
        organization: r.organization?.name, by: r.createdBy?.name,
        created: iso(r.createdAt),
      })),
    };
  },

  async post_plans({ organization, status } = {}, user) {
    const query = {};
    if (user.role === ROLES.USER) query.createdBy = user._id;
    else if (user.role === ROLES.CEO) query.organization = user.organization?._id || user.organization;
    if (organization) {
      const org = await resolveOrg(organization);
      if (!org) return { error: `No organization matching "${organization}".` };
      query.organization = org._id;
    }
    if (status && Object.values(APPROVAL_STATUS).includes(status)) query.status = status;

    const plans = await PostPlan.find(query).populate('organization', 'name').populate('createdBy', 'name').sort({ createdAt: -1 }).limit(15).lean();
    if (!plans.length) return { note: 'No post plans found for this filter.' };
    return plans.map((p) => ({
      title: p.title, status: p.status,
      organization: p.organization?.name, by: p.createdBy?.name,
      window: `${iso(p.startDate)} to ${iso(p.endDate)}`,
      posts: p.items?.length || 0,
      platforms: [...new Set((p.items || []).map((i) => i.platform))],
      feedback: p.status === 'REJECTED' ? p.feedback : undefined,
    }));
  },
};

// Execute one tool call. Errors become readable strings so the model can recover.
export const runTool = async (name, input, user) => {
  const handler = handlers[name];
  if (!handler) return { error: `Unknown tool: ${name}` };
  try {
    return await handler(input || {}, user);
  } catch (err) {
    console.error(`AI tool ${name} failed:`, err.message);
    return { error: `Tool failed: ${err.message}` };
  }
};
