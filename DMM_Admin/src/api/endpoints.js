import api from './client.js';

export const authApi = {
  setupStatus: () => api.get('/auth/setup-status').then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
};

export const organizationApi = {
  list: (params) => api.get('/organizations', { params }).then((r) => r.data),
  get: (id) => api.get(`/organizations/${id}`).then((r) => r.data),
  create: (formData) =>
    api.post('/organizations', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id, formData) =>
    api.put(`/organizations/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  remove: (id) => api.delete(`/organizations/${id}`).then((r) => r.data),
  goal: (id) => api.get(`/organizations/${id}/goal`).then((r) => r.data),
  setGoal: (id, goal) => api.put(`/organizations/${id}`, { goal }).then((r) => r.data),
};

export const userApi = {
  list: (params) => api.get('/users', { params }).then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  create: (data) => api.post('/users', data).then((r) => r.data),
  update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/users/${id}`).then((r) => r.data),
  resetPassword: (id, password) => api.put(`/users/${id}/reset-password`, { password }).then((r) => r.data),
  updateProfile: (formData) =>
    api.put('/users/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  changePassword: (data) => api.put('/users/password', data).then((r) => r.data),
};

// Org-scoped calls — the active org is attached as x-organization-id by the client.
export const analyticsApi = {
  get: (organizationId) => api.get('/analytics', { params: { organizationId } }).then((r) => r.data),
  report: (platform, organizationId, range) => api.get(`/analytics/${platform}/report`, { params: { organizationId, range } }).then((r) => r.data),
  compare: (platform, metric) => api.get('/analytics/compare', { params: { platform, metric } }).then((r) => r.data),
  record: (data) => api.post('/analytics', data).then((r) => r.data),
  clear: (platform, organizationId) => api.delete('/analytics', { params: { platform, organizationId } }).then((r) => r.data),
  import: (formData) => api.post('/analytics/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  template: () => api.get('/analytics/template', { responseType: 'blob' }).then((r) => r.data),
};

// Meta (Facebook + Instagram) live sync. The master token lives only on the
// backend (env) — these endpoints never see or carry it.
export const metaApi = {
  status: () => api.get('/meta/status').then((r) => r.data),
  accounts: () => api.get('/meta/accounts').then((r) => r.data),
  map: (organization, pageId) => api.post('/meta/map', { organizationId: organization, pageId }).then((r) => r.data),
  automap: () => api.post('/meta/automap').then((r) => r.data),
  sync: (organizationId, platform) => api.post('/meta/sync', { platform }, { params: { organizationId, platform } }).then((r) => r.data),
};

// YouTube live sync (Data API v3). The API key lives only in the backend env.
export const youtubeApi = {
  status: () => api.get('/youtube/status').then((r) => r.data),
  channel: (organizationId) => api.get('/youtube/channel', { params: { organizationId } }).then((r) => r.data),
  resolve: (q) => api.get('/youtube/resolve', { params: { q } }).then((r) => r.data),
  map: (organizationId, query) => api.post('/youtube/map', { organizationId, query }).then((r) => r.data),
  sync: (organizationId) => api.post('/youtube/sync', {}, { params: { organizationId } }).then((r) => r.data),
};

// Competitor benchmark — org-scoped (active org attached as x-organization-id).
export const competitorApi = {
  list: (platform, organizationId) => api.get('/competitors', { params: { platform, organizationId } }).then((r) => r.data),
  create: (data) => api.post('/competitors', data).then((r) => r.data),
  update: (id, data) => api.put(`/competitors/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/competitors/${id}`).then((r) => r.data),
  import: (formData) => api.post('/competitors/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  template: () => api.get('/competitors/template', { responseType: 'blob' }).then((r) => r.data),
};

// Approvals — ADMIN is the global head of all organizations and can review,
// approve or reject content for any org. The list spans all orgs unless an
// organizationId is passed; single-item ops are not org-scoped for admins.
export const approvalApi = {
  list: (params) => api.get('/approvals', { params }).then((r) => r.data),
  get: (id) => api.get(`/approvals/${id}`).then((r) => r.data),
  approve: (id) => api.put(`/approvals/${id}/approve`).then((r) => r.data),
  reject: (id, feedbackPoints) => api.put(`/approvals/${id}/reject`, { feedbackPoints }).then((r) => r.data),
  remove: (id) => api.delete(`/approvals/${id}`).then((r) => r.data),
};

// Events — Zolo event photos (folder links). Shared across the workspace.
export const eventApi = {
  list: (params) => api.get('/events', { params }).then((r) => r.data),
  create: (formData) => api.post('/events', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id, formData) => api.put(`/events/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  remove: (id) => api.delete(`/events/${id}`).then((r) => r.data),
};

// Premium packs / purchases — org-scoped (active org via header).
export const purchaseApi = {
  list: () => api.get('/purchases').then((r) => r.data),
  create: (data) => api.post('/purchases', data).then((r) => r.data),
  update: (id, data) => api.put(`/purchases/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/purchases/${id}`).then((r) => r.data),
};

// Brand Library — flyers / brochures / branding videos (file or link).
export const brandApi = {
  list: (params) => api.get('/brand', { params }).then((r) => r.data),
  create: (formData) => api.post('/brand', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id, data) => api.put(`/brand/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/brand/${id}`).then((r) => r.data),
};

// Social media accounts / handlers directory.
export const socialAccountApi = {
  list: (params) => api.get('/social-accounts', { params }).then((r) => r.data),
  create: (data) => api.post('/social-accounts', data).then((r) => r.data),
  update: (id, data) => api.put(`/social-accounts/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/social-accounts/${id}`).then((r) => r.data),
  import: (formData) => api.post('/social-accounts/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  template: () => api.get('/social-accounts/template', { responseType: 'blob' }).then((r) => r.data),
};

// Websites / domains inventory directory.
export const websiteApi = {
  list: (params) => api.get('/websites', { params }).then((r) => r.data),
  create: (data) => api.post('/websites', data).then((r) => r.data),
  update: (id, data) => api.put(`/websites/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/websites/${id}`).then((r) => r.data),
  import: (formData) => api.post('/websites/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  template: () => api.get('/websites/template', { responseType: 'blob' }).then((r) => r.data),
};

export const calendarApi = {
  month: (organizationId, month) => api.get('/calendar', { params: { organizationId, month } }).then((r) => r.data),
  day: (organizationId, date) => api.get('/calendar/day', { params: { organizationId, date } }).then((r) => r.data),
};

export const activityApi = {
  list: (params) => api.get('/activity', { params }).then((r) => r.data),
};
