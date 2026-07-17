// Shared enums / constants used across models, controllers and seed data.

export const ROLES = {
  ADMIN: 'ADMIN',
  CEO: 'CEO',
  USER: 'USER',
};

export const USER_TYPES = {
  DESIGNER: 'DESIGNER',
  SOCIAL_HANDLER: 'SOCIAL_HANDLER',
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

// What an approval request is about. DESIGN = creative work from the design
// team; once approved it is ASSIGNED to a social-media handler, who then
// raises the linked POST request (content + fields) for final approval.
export const APPROVAL_TYPES = {
  POST: 'POST',
  DESIGN: 'DESIGN',
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
  'Center of Excellence',
];

export const NOTIFICATION_TYPES = {
  CONTENT_APPROVED: 'CONTENT_APPROVED',
  CONTENT_REJECTED: 'CONTENT_REJECTED',
  RESUBMISSION_REQUIRED: 'RESUBMISSION_REQUIRED',
  CONTENT_POSTED: 'CONTENT_POSTED',
  NEW_REQUEST: 'NEW_REQUEST',
  WORK_ASSIGNED: 'WORK_ASSIGNED',
  CONTENT_RESUBMITTED: 'CONTENT_RESUBMITTED',
  APPROVAL_COMMENT: 'APPROVAL_COMMENT',
  DESIGN_ASSIGNED: 'DESIGN_ASSIGNED',
  PROFILE_UPDATE_SUBMITTED: 'PROFILE_UPDATE_SUBMITTED',
  PROFILE_UPDATE_REVIEWED: 'PROFILE_UPDATE_REVIEWED',
  PLAN_SUBMITTED: 'PLAN_SUBMITTED',
  PLAN_APPROVED: 'PLAN_APPROVED',
  PLAN_REJECTED: 'PLAN_REJECTED',
  PLAN_RESUBMITTED: 'PLAN_RESUBMITTED',
  CONTENT_FORWARDED: 'CONTENT_FORWARDED',
};

export const ACTIVITY_ACTIONS = {
  TEMPLATE_UPLOAD: 'TEMPLATE_UPLOAD',
  ASSET_UPLOAD: 'ASSET_UPLOAD',
  APPROVAL_SUBMISSION: 'APPROVAL_SUBMISSION',
  APPROVAL_APPROVED: 'APPROVAL_APPROVED',
  APPROVAL_REJECTED: 'APPROVAL_REJECTED',
  APPROVAL_RESUBMITTED: 'APPROVAL_RESUBMITTED',
  WORK_ASSIGNED: 'WORK_ASSIGNED',
  DESIGN_ASSIGNED: 'DESIGN_ASSIGNED',
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
  SIGNAGE_UPDATED: 'SIGNAGE_UPDATED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  DESIGN_FORWARDED: 'DESIGN_FORWARDED',
};

// Physical signage (campus banner stands). A location is the fixed stand/frame;
// a banner is what's mounted on it for a given event, forming a change history.
export const SIGNAGE_TYPES = ['Arch banner', 'Foam board', 'Standee', 'Normal banner', 'Other'];

export const SIGNAGE_LOCATION_STATUS = {
  EMPTY: 'EMPTY',
  OCCUPIED: 'OCCUPIED',
  NEEDS_REPLACEMENT: 'NEEDS_REPLACEMENT',
  DAMAGED: 'DAMAGED',
};
