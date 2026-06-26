import api from './client.js';

export const authApi = {
  setupStatus: () => api.get('/auth/setup-status').then((r) => r.data),
  setup: (data) => api.post('/auth/setup', data).then((r) => r.data),
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
  report: (platform, organizationId) => api.get(`/analytics/${platform}/report`, { params: { organizationId } }).then((r) => r.data),
  compare: (platform, metric) => api.get('/analytics/compare', { params: { platform, metric } }).then((r) => r.data),
  record: (data) => api.post('/analytics', data).then((r) => r.data),
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
};

export const calendarApi = {
  month: (organizationId, month) => api.get('/calendar', { params: { organizationId, month } }).then((r) => r.data),
  day: (organizationId, date) => api.get('/calendar/day', { params: { organizationId, date } }).then((r) => r.data),
};

export const activityApi = {
  list: (params) => api.get('/activity', { params }).then((r) => r.data),
};
