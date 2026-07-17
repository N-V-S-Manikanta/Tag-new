import asyncHandler from 'express-async-handler';
import WorkAssignment from '../models/WorkAssignment.js';
import User from '../models/User.js';
import Organization from '../models/Organization.js';
import { ROLES, USER_TYPES, PLATFORMS, ACTIVITY_ACTIONS, NOTIFICATION_TYPES } from '../config/constants.js';
import { logActivity } from '../utils/logActivity.js';
import { createNotification } from '../utils/notify.js';

const populateAssignment = (query) =>
  query
    .populate('organization', 'name color')
    .populate('assignee', 'name avatar email role userType handles organization')
    .populate('createdBy', 'name avatar email');

export const listWorkAssignments = asyncHandler(async (req, res) => {
  const { organization, assignee, status } = req.query;
  const query = {};
  if (req.user.role === ROLES.USER) {
    query.assignee = req.user._id;
  } else if (req.user.role === ROLES.CEO) {
    query.organization = req.user.organization?._id || req.user.organization;
  }

  if (organization && organization !== 'All' && req.user.role === ROLES.ADMIN) query.organization = organization;
  if (assignee && assignee !== 'All' && req.user.role === ROLES.ADMIN) query.assignee = assignee;
  if (status && status !== 'All') query.status = status;

  const assignments = await populateAssignment(WorkAssignment.find(query).sort({ createdAt: -1 })).lean();
  res.json({ success: true, assignments });
});

export const createWorkAssignment = asyncHandler(async (req, res) => {
  const { title, description, organization, platform = '', assigneeId } = req.body;
  if (!title || !String(title).trim()) { res.status(400); throw new Error('Title is required'); }
  if (!organization) { res.status(400); throw new Error('Organization is required'); }
  if (!assigneeId) { res.status(400); throw new Error('Please choose an assignee'); }
  if (platform && !PLATFORMS.includes(platform)) { res.status(400); throw new Error('Invalid platform'); }

  const org = await Organization.findById(organization).select('_id isActive name');
  if (!org || !org.isActive) { res.status(400); throw new Error('Selected organization does not exist'); }

  const assignee = await User.findOne({
    _id: assigneeId,
    isActive: true,
    role: ROLES.USER,
    userType: { $in: [USER_TYPES.DESIGNER, USER_TYPES.SOCIAL_HANDLER] },
  }).select('name avatar email role userType handles organization');
  if (!assignee) { res.status(400); throw new Error('Selected assignee not found'); }

  if (assignee.userType !== USER_TYPES.SOCIAL_HANDLER && String(assignee.organization || '') && String(assignee.organization) !== String(org._id)) {
    res.status(400);
    throw new Error('The chosen assignee does not belong to the selected organization');
  }

  if (assignee.userType === USER_TYPES.SOCIAL_HANDLER) {
    const handleMatch = Array.isArray(assignee.handles)
      && assignee.handles.some((h) => String(h.organization) === String(org._id)
        && (!platform || (h.platforms || []).includes(platform)));
    if (!handleMatch) {
      res.status(400);
      throw new Error('The chosen social handler is not mapped to this organization/platform');
    }
  }

  const assignment = await WorkAssignment.create({
    organization: org._id,
    title: String(title).trim(),
    description: String(description || '').trim(),
    platform,
    assignee: assignee._id,
    assigneeType: assignee.userType,
    createdBy: req.user._id,
  });

  await logActivity({
    user: req.user._id,
    organization: org._id,
    action: ACTIVITY_ACTIONS.WORK_ASSIGNED,
    description: `Assigned work "${assignment.title}" to ${assignee.name}${platform ? ` for ${platform}` : ''}`,
    entityType: 'WorkAssignment',
    entityId: assignment._id,
  });

  await createNotification({
    recipient: assignee._id,
    organization: org._id,
    type: NOTIFICATION_TYPES.WORK_ASSIGNED,
    title: 'Work assigned to you',
    message: `${req.user.name} assigned "${assignment.title}"${platform ? ` for ${platform}` : ''}`,
    link: '/notifications',
    relatedRequest: assignment._id,
  });

  const populated = await populateAssignment(WorkAssignment.findById(assignment._id)).lean();
  res.status(201).json({ success: true, assignment: populated });
});