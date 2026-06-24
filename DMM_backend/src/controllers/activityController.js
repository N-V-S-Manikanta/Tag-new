import asyncHandler from 'express-async-handler';
import ActivityLog from '../models/ActivityLog.js';
import { resolveOrgId } from '../utils/org.js';
import { ROLES } from '../config/constants.js';

// @route GET /api/activity — paginated activity logs.
// ADMIN: system-wide (all orgs), or one org if ?organizationId is given.
// CEO: all activity in their org. USER: only their own activity in their org.
export const getActivityLogs = asyncHandler(async (req, res) => {
  const { action, page = 1, limit = 20 } = req.query;
  const query = {};
  if (req.user.role === ROLES.ADMIN) {
    const orgId = resolveOrgId(req);
    if (orgId) query.organization = orgId;
  } else {
    query.organization = req.user.organization?._id || req.user.organization;
    if (req.user.role !== ROLES.CEO) query.user = req.user._id;
  }
  if (action && action !== 'All') query.action = action;

  const skip = (Number(page) - 1) * Number(limit);
  const [logs, total] = await Promise.all([
    ActivityLog.find(query).populate('user', 'name avatar').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    ActivityLog.countDocuments(query),
  ]);
  res.json({ success: true, total, page: Number(page), pages: Math.ceil(total / limit), logs });
});
