// Meta (Facebook + Instagram) Graph API service.
//
// SECURITY: the master/system access token is read ONLY from the environment
// (META_SYSTEM_TOKEN) at request time. It is never stored in the database, never
// returned to the client, and never logged. All Graph calls happen server-side.
//
// Meta deprecates metrics frequently (e.g. Instagram `impressions` -> `views` in
// 2025, and many page_* metrics in 2024), so every insight fetch is defensive:
// a failing metric is skipped rather than failing the whole sync, and only the
// fields that actually come back are returned.

import crypto from 'crypto';

const GRAPH = 'https://graph.facebook.com';
const VERSION = process.env.META_API_VERSION || 'v21.0';

export const hasToken = () => !!process.env.META_SYSTEM_TOKEN;
const token = () => process.env.META_SYSTEM_TOKEN;

// appsecret_proof = HMAC-SHA256(access_token) keyed with the app secret. Required
// when the Meta app has "Require app secret proof for server API calls" enabled.
// Computed for whichever token a given call uses (user token or page token).
const appSecretProof = (tok) => {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(tok).digest('hex');
};

// Low-level Graph GET. Throws an Error enriched with Meta's error fields.
// `tok` overrides the token (e.g. a Page Access Token for page/IG insights);
// defaults to the system/user token from the environment.
const call = async (path, params = {}, tok) => {
  if (!hasToken()) {
    const e = new Error('Meta is not connected. Set META_SYSTEM_TOKEN in the backend .env file.');
    e.notConfigured = true;
    throw e;
  }
  const useTok = tok || token();
  const url = new URL(`${GRAPH}/${VERSION}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  url.searchParams.set('access_token', useTok);
  const proof = appSecretProof(useTok);
  if (proof) url.searchParams.set('appsecret_proof', proof);

  let res, data;
  try {
    res = await fetch(url);
    data = await res.json().catch(() => ({}));
  } catch (netErr) {
    const e = new Error(`Could not reach the Meta Graph API: ${netErr.message}`);
    e.network = true;
    throw e;
  }
  if (!res.ok || data.error) {
    const me = data.error || {};
    const e = new Error(me.message || `Meta API error (HTTP ${res.status})`);
    e.metaCode = me.code;
    e.metaSubcode = me.error_subcode;
    e.metaType = me.type;
    e.status = res.status;
    throw e;
  }
  return data;
};

// Follow Graph pagination via the absolute `paging.next` URL (which already
// carries the token + cursor).
const fetchNext = async (nextUrl) => {
  const u = new URL(nextUrl);
  const proof = appSecretProof(token());
  if (proof && !u.searchParams.has('appsecret_proof')) u.searchParams.set('appsecret_proof', proof);
  const res = await fetch(u);
  const data = await res.json().catch(() => ({}));
  if (data.error) throw Object.assign(new Error(data.error.message), { metaCode: data.error.code });
  return data;
};

// Latest value from a time-series insight metric object ({ values: [{value,end_time}] }).
const latestTs = (metricObj) => {
  const vals = metricObj?.values || [];
  if (!vals.length) return undefined;
  const last = vals[vals.length - 1];
  return typeof last?.value === 'number' ? last.value : undefined;
};

// ---------------------------------------------------------------------------
// Discovery — list all Facebook Pages visible to the token and their linked
// Instagram business accounts. This is how we find the 7 brands automatically.
// ---------------------------------------------------------------------------
export const listAccounts = async () => {
  const out = [];
  let data = await call('me/accounts', {
    fields: 'name,id,access_token,instagram_business_account{id,username,profile_picture_url,followers_count}',
    limit: 100,
  });
  for (;;) {
    for (const pg of data.data || []) {
      out.push({
        pageId: pg.id,
        pageName: pg.name,
        // Page Access Token — REQUIRED for page/Instagram insights. Kept server-side
        // only; controllers strip this before returning accounts to the client.
        pageToken: pg.access_token || null,
        instagramId: pg.instagram_business_account?.id || null,
        instagramUsername: pg.instagram_business_account?.username || null,
        instagramFollowers: pg.instagram_business_account?.followers_count ?? null,
        instagramAvatar: pg.instagram_business_account?.profile_picture_url || null,
      });
    }
    if (!data.paging?.next) break;
    data = await fetchNext(data.paging.next);
  }
  return out;
};

// Fetch a single Page Access Token by page id (used at sync time).
export const getPageToken = async (pageId) => {
  try {
    const r = await call(pageId, { fields: 'access_token' });
    return r.access_token || null;
  } catch {
    return null;
  }
};

// Lightweight identity/health probe for a "Test connection" button.
export const probe = async () => {
  const me = await call('me', { fields: 'id,name' });
  let scopes = [];
  try {
    const perms = await call('me/permissions');
    scopes = (perms.data || []).filter((p) => p.status === 'granted').map((p) => p.permission);
  } catch {
    /* /me/permissions isn't available for some system-user tokens — non-fatal */
  }
  return { id: me.id, name: me.name, scopes };
};

// Scopes required to read Instagram + Facebook insights.
export const REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_manage_insights',
  'pages_show_list',
  'pages_read_engagement',
  'business_management',
];

// ---------------------------------------------------------------------------
// Instagram metrics -> our Analytics fields: followers, views, reach, interactions
// ---------------------------------------------------------------------------
export const getInstagramMetrics = async (igId, pageToken) => {
  const out = {};

  // Total followers — a node field, not an insight.
  try {
    const node = await call(igId, { fields: 'followers_count' }, pageToken);
    if (typeof node.followers_count === 'number') out.followers = node.followers_count;
  } catch { /* skip */ }

  // Reach — classic time-series insight (needs the page token + insights scope).
  try {
    const r = await call(`${igId}/insights`, { metric: 'reach', period: 'day' }, pageToken);
    const v = latestTs((r.data || [])[0]);
    if (v != null) out.reach = v;
  } catch { /* skip */ }

  // Views + total interactions — newer "total_value" insights (v18+). Try the
  // batched call first, then fall back to one metric at a time so a single
  // unsupported metric never blocks the other.
  const totalValue = async (metric) => {
    const r = await call(`${igId}/insights`, { metric, metric_type: 'total_value', period: 'day' }, pageToken);
    const m = (r.data || [])[0];
    return m?.total_value?.value;
  };
  try {
    const r = await call(`${igId}/insights`, { metric: 'views,total_interactions', metric_type: 'total_value', period: 'day' }, pageToken);
    for (const m of r.data || []) {
      if (m.name === 'views' && m.total_value?.value != null) out.views = m.total_value.value;
      if (m.name === 'total_interactions' && m.total_value?.value != null) out.interactions = m.total_value.value;
    }
  } catch {
    try { const v = await totalValue('views'); if (v != null) out.views = v; } catch { /* skip */ }
    try { const v = await totalValue('total_interactions'); if (v != null) out.interactions = v; } catch { /* skip */ }
  }

  return out;
};

// ---------------------------------------------------------------------------
// Facebook Page metrics -> our Analytics fields. Page insights availability
// varies a lot post-2024 deprecations, so we map whatever returns.
// ---------------------------------------------------------------------------
export const getFacebookMetrics = async (pageId, pageTokenIn) => {
  const out = {};
  // Page insights REQUIRE a Page Access Token (not the user/system token).
  const pageToken = pageTokenIn || (await getPageToken(pageId));

  // Node fields are the ONLY Facebook signals the standard scopes still expose
  // reliably. Meta retired almost every page_* time-series insight (they now
  // return empty even on large pages), and reading post-level engagement needs
  // the extra `pages_read_user_content` permission. So we lead with node fields:
  //   • followers_count / fan_count → the audience total
  //   • talking_about_count → Facebook's "People talking about this" (PTAT): a
  //     rolling 7-day engagement count (likes, comments, shares, mentions,
  //     check-ins). Mapped to `interactions` as our engagement signal.
  try {
    const node = await call(pageId, { fields: 'followers_count,fan_count,talking_about_count' }, pageToken);
    const f = node.followers_count ?? node.fan_count;
    if (typeof f === 'number') out.followers = f;
    if (typeof node.talking_about_count === 'number') out.interactions = node.talking_about_count;
  } catch { /* skip */ }

  // Insights are attempted defensively as a bonus: when a page DOES still return
  // them, page_post_engagements (real, per-period engagement) overrides the PTAT
  // proxy above, and follows/visits fill in. Each is fetched individually so a
  // single unsupported/empty metric never drops the rest, and empty results are
  // skipped (leaving the node-field values in place).
  const MAP = {
    page_post_engagements: 'interactions',
    page_daily_follows_unique: 'newFollowers',
    page_views_total: 'visits',
  };
  for (const [metric, field] of Object.entries(MAP)) {
    try {
      const r = await call(`${pageId}/insights`, { metric, period: 'days_28' }, pageToken);
      const v = latestTs((r.data || [])[0]);
      if (v != null) out[field] = v;
    } catch { /* skip */ }
  }

  return out;
};
