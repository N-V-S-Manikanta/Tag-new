// Shared enums / constants used across models, controllers and seed data.

export const ROLES = {
  ADMIN: 'ADMIN',
  CEO: 'CEO',
  USER: 'USER',
};

export const PLATFORMS = ['LinkedIn', 'Instagram', 'YouTube', 'Facebook'];

// The social-handlers directory also tracks X (Twitter) accounts, which the
// analytics/competitor features (core 4 platforms) don't.
export const SOCIAL_PLATFORMS = [...PLATFORMS, 'X (Twitter)'];

// What a rejection feedback point asks the submitter to change. "Reject" means
// the content is not salvageable rather than a specific fix.
export const FEEDBACK_CATEGORIES = ['Image', 'Content', 'Other', 'Reject'];

export const APPROVAL_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  RESUBMITTED: 'RESUBMITTED',
  POSTED: 'POSTED',
};

export const TEMPLATE_CATEGORIES = [
  'Placement',
  'Admissions',
  'Workshops',
  'Events',
  'Certifications',
  'Recruitment',
  'Social Media Campaigns',
];

export const ASSET_CATEGORIES = [
  'Logos',
  'Favicons',
  'PNG Files',
  'Backgrounds',
  'Icons',
  'Illustrations',
  'Brand Assets',
];

export const NOTIFICATION_TYPES = {
  CONTENT_APPROVED: 'CONTENT_APPROVED',
  CONTENT_REJECTED: 'CONTENT_REJECTED',
  RESUBMISSION_REQUIRED: 'RESUBMISSION_REQUIRED',
  CONTENT_POSTED: 'CONTENT_POSTED',
  NEW_REQUEST: 'NEW_REQUEST',
  CONTENT_RESUBMITTED: 'CONTENT_RESUBMITTED',
  PLAN_SUBMITTED: 'PLAN_SUBMITTED',
  PLAN_APPROVED: 'PLAN_APPROVED',
  PLAN_REJECTED: 'PLAN_REJECTED',
  PLAN_RESUBMITTED: 'PLAN_RESUBMITTED',
};

export const ACTIVITY_ACTIONS = {
  TEMPLATE_UPLOAD: 'TEMPLATE_UPLOAD',
  ASSET_UPLOAD: 'ASSET_UPLOAD',
  APPROVAL_SUBMISSION: 'APPROVAL_SUBMISSION',
  APPROVAL_APPROVED: 'APPROVAL_APPROVED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  APPROVAL_RESUBMITTED: 'APPROVAL_RESUBMITTED',
  POST_COMPLETION: 'POST_COMPLETION',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  ANALYTICS_UPDATED: 'ANALYTICS_UPDATED',
  PLAN_SUBMITTED: 'PLAN_SUBMITTED',
  PLAN_REVIEWED: 'PLAN_REVIEWED',
  GOAL_UPDATED: 'GOAL_UPDATED',
  COMPETITOR_UPDATED: 'COMPETITOR_UPDATED',
  SOCIAL_ACCOUNT_UPDATED: 'SOCIAL_ACCOUNT_UPDATED',
  WEBSITE_UPDATED: 'WEBSITE_UPDATED',
  EVENT_UPDATED: 'EVENT_UPDATED',
};
