import api from './client.js';

// ---- Auth ----
export const authApi = {
  setupStatus: () => api.get('/auth/setup-status').then((r) => r.data),
  emailStatus: () => api.get('/auth/email-status').then((r) => r.data),
  login: (data) => api.post('/auth/login', data).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  forgot: (email) => api.post('/auth/forgot-password', { email }).then((r) => r.data),
  reset: (token, password) => api.post(`/auth/reset-password/${token}`, { password }).then((r) => r.data),
};

// ---- Users (self + admin management) ----
export const userApi = {
  // self
  updateProfile: (formData) =>
    api.put('/users/profile', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  changePassword: (data) => api.put('/users/password', data).then((r) => r.data),
  updateSettings: (data) => api.put('/users/settings', data).then((r) => r.data),
  // admin
  list: (params) => api.get('/users', { params }).then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  create: (data) => api.post('/users', data).then((r) => r.data),
  update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/users/${id}`).then((r) => r.data),
  resetPassword: (id, password) => api.put(`/users/${id}/reset-password`, { password }).then((r) => r.data),
};

// ---- Analytics (social metrics management) ----
// Social analytics — auto-scoped to the logged-in user's organization.
export const analyticsApi = {
  get: (organizationId) => api.get('/analytics', { params: { organizationId } }).then((r) => r.data),
  report: (platform, organizationId, range) => api.get(`/analytics/${platform}/report`, { params: { organizationId, range } }).then((r) => r.data),
  history: (platform, organizationId) => api.get(`/analytics/${platform}/history`, { params: { organizationId } }).then((r) => r.data),
};

// LinkedIn export hub — dashboard for everyone; uploads for CEO/Admin.
export const linkedinApi = {
  dashboard: (organizationId, days) => api.get('/linkedin/dashboard', { params: { organizationId, days } }).then((r) => r.data),
  import: (organizationId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/linkedin/import', fd, { params: { organizationId }, headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
};

// ---- Organizations (options for pickers — any authenticated user) ----
export const organizationApi = {
  options: () => api.get('/organizations/options').then((r) => r.data),
};

// Competitor benchmark — read-only for the product app (auto-scoped to user's org).
export const competitorApi = {
  list: (platform) => api.get('/competitors', { params: { platform } }).then((r) => r.data),
};

// ---- Brand Library / Social Handlers / Premium Packs / Goals (read-only for product) ----
export const libraryApi = {
  brand: (params) => api.get('/brand', { params }).then((r) => r.data),
  socialAccounts: (params) => api.get('/social-accounts', { params }).then((r) => r.data),
  purchases: () => api.get('/purchases').then((r) => r.data),
};

// ---- Growth goals (per organization + platform, read-only here) ----
export const goalApi = {
  list: (organizationId) => api.get('/goals', { params: { organizationId } }).then((r) => r.data),
};

// ---- Post Planner — plan upcoming posts and submit the plan for approval ----
export const planApi = {
  list: (params) => api.get('/plans', { params }).then((r) => r.data),
  get: (id) => api.get(`/plans/${id}`).then((r) => r.data),
  create: (data) => api.post('/plans', data).then((r) => r.data),
  update: (id, data) => api.put(`/plans/${id}`, data).then((r) => r.data),
  approve: (id) => api.put(`/plans/${id}/approve`).then((r) => r.data),
  reject: (id, feedback) => api.put(`/plans/${id}/reject`, { feedback }).then((r) => r.data),
  remove: (id) => api.delete(`/plans/${id}`).then((r) => r.data),
};

// ---- Dashboard ----
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats').then((r) => r.data),
  charts: () => api.get('/dashboard/charts').then((r) => r.data),
  activity: () => api.get('/dashboard/activity').then((r) => r.data),
  topPlatform: () => api.get('/dashboard/top-platform').then((r) => r.data),
  myUploads: () => api.get('/dashboard/my-uploads').then((r) => r.data),
};

// ---- Global Search ----
export const searchApi = {
  query: (q) => api.get('/search', { params: { q } }).then((r) => r.data),
};

// ---- Calendar (posting calendar — auto-scoped to the user's org) ----
export const calendarApi = {
  month: (month) => api.get('/calendar', { params: { month } }).then((r) => r.data),
  day: (date) => api.get('/calendar/day', { params: { date } }).then((r) => r.data),
};

// ---- Templates ----
export const templateApi = {
  list: (params) => api.get('/templates', { params }).then((r) => r.data),
  get: (id) => api.get(`/templates/${id}`).then((r) => r.data),
  create: (formData) =>
    api.post('/templates', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id, formData) =>
    api.put(`/templates/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  remove: (id) => api.delete(`/templates/${id}`).then((r) => r.data),
  download: (id) => api.post(`/templates/${id}/download`).then((r) => r.data),
};

// ---- Assets ----
export const assetApi = {
  list: (params) => api.get('/assets', { params }).then((r) => r.data),
  get: (id) => api.get(`/assets/${id}`).then((r) => r.data),
  create: (formData) =>
    api.post('/assets', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id, formData) =>
    api.put(`/assets/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  remove: (id) => api.delete(`/assets/${id}`).then((r) => r.data),
  download: (id) => api.post(`/assets/${id}/download`).then((r) => r.data),
};

// ---- Approvals ----
export const approvalApi = {
  list: (params) => api.get('/approvals', { params }).then((r) => r.data),
  get: (id) => api.get(`/approvals/${id}`).then((r) => r.data),
  create: (formData) =>
    api.post('/approvals', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  approve: (id) => api.put(`/approvals/${id}/approve`).then((r) => r.data),
  reject: (id, feedbackPoints) => api.put(`/approvals/${id}/reject`, { feedbackPoints }).then((r) => r.data),
  resubmit: (id, formData) =>
    api.put(`/approvals/${id}/resubmit`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  markPosted: (id) => api.put(`/approvals/${id}/posted`).then((r) => r.data),
  remove: (id) => api.delete(`/approvals/${id}`).then((r) => r.data),
};

// ---- AI assistant (key lives only on the backend) ----
export const aiApi = {
  status: () => api.get('/ai/status').then((r) => r.data),
  chat: (messages) => api.post('/ai/chat', { messages }).then((r) => r.data),
};

// ---- Link preview (Open-Graph thumbnail/title) ----
export const linkApi = {
  preview: (url) => api.get('/link-preview', { params: { url } }).then((r) => r.data),
};

// ---- Events (Zolo event photos — folder links) ----
export const eventApi = {
  list: (params) => api.get('/events', { params }).then((r) => r.data),
  create: (formData) => api.post('/events', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  update: (id, formData) => api.put(`/events/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  remove: (id) => api.delete(`/events/${id}`).then((r) => r.data),
};

// ---- Notifications ----
export const notificationApi = {
  list: (params) => api.get('/notifications', { params }).then((r) => r.data),
  markRead: (id) => api.put(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.put('/notifications/read-all').then((r) => r.data),
  remove: (id) => api.delete(`/notifications/${id}`).then((r) => r.data),
};

// ---- Activity ----
export const activityApi = {
  list: (params) => api.get('/activity', { params }).then((r) => r.data),
};

// ---- Reports / Analytics ----
export const reportApi = {
  analytics: () => api.get('/reports/summary/approval-analytics').then((r) => r.data),
  downloadUrl: (type, format) => `/api/reports/${type}?format=${format}`,
};
