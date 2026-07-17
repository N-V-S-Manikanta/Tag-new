import asyncHandler from 'express-async-handler';
import Event from '../models/Event.js';
import Organization from '../models/Organization.js';
import { uploadBuffer, deleteFile } from '../config/storage.js';
import { logActivity } from '../utils/logActivity.js';
import { ACTIVITY_ACTIONS, ROLES } from '../config/constants.js';

const isUrl = (s = '') => /^https?:\/\/\S+/i.test(String(s).trim());

// May this user edit/delete the event? The creator, any Admin (CEO) or the
// Super Admin / global Admin.
const canManage = (user, event) =>
  String(event.createdBy) === String(user._id) ||
  user.role === ROLES.ADMIN ||
  user.role === ROLES.CEO;

// @route GET /api/events — every event (shared workspace). Optional ?search, ?organizationId.
export const listEvents = asyncHandler(async (req, res) => {
  const { search, organizationId } = req.query;
  const query = {};
  if (organizationId) query.organization = organizationId;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
    { location: { $regex: search, $options: 'i' } },
  ];
  const items = await Event.find(query)
    .populate('createdBy', 'name avatar')
    .populate('organization', 'name color')
    .sort({ eventDate: -1, createdAt: -1 })
    .lean();
  res.json({ success: true, count: items.length, events: items });
});

// @route POST /api/events — create an event (any authenticated user). Optional cover image.
export const createEvent = asyncHandler(async (req, res) => {
  const { name, description, folderLink, eventDate, location, organization } = req.body;
  if (!name?.trim()) { res.status(400); throw new Error('Event name is required'); }
  if (!isUrl(folderLink)) { res.status(400); throw new Error('A valid folder link (starting with http:// or https://) is required'); }

  let orgId = null;
  if (organization) {
    const org = await Organization.findById(organization).select('_id');
    if (org) orgId = org._id;
  }

  const doc = {
    name: name.trim(),
    description: description || '',
    folderLink: folderLink.trim(),
    eventDate: eventDate ? new Date(eventDate) : undefined,
    location: location || '',
    organization: orgId,
    createdBy: req.user._id,
  };

  if (req.file) {
    const up = await uploadBuffer(req.file.buffer, { folder: 'events', originalName: req.file.originalname });
    doc.coverImage = up.url;
    doc.coverImagePublicId = up.publicId;
  }

  const event = await Event.create(doc);
  logActivity({ user: req.user._id, organization: orgId, action: ACTIVITY_ACTIONS.EVENT_UPDATED, description: `Added event "${event.name}"`, entityType: 'Event', entityId: event._id });
  const populated = await Event.findById(event._id).populate('createdBy', 'name avatar').populate('organization', 'name color').lean();
  res.status(201).json({ success: true, event: populated });
});

// @route PUT /api/events/:id — edit an event (creator / Admin). Optional new cover.
export const updateEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) { res.status(404); throw new Error('Event not found'); }
  if (!canManage(req.user, event)) { res.status(403); throw new Error('Not allowed to edit this event'); }

  const { name, description, folderLink, eventDate, location, organization } = req.body;
  if (name !== undefined) { if (!name.trim()) { res.status(400); throw new Error('Event name is required'); } event.name = name.trim(); }
  if (folderLink !== undefined) { if (!isUrl(folderLink)) { res.status(400); throw new Error('A valid folder link is required'); } event.folderLink = folderLink.trim(); }
  if (description !== undefined) event.description = description;
  if (location !== undefined) event.location = location;
  if (eventDate !== undefined) event.eventDate = eventDate ? new Date(eventDate) : undefined;
  if (organization !== undefined) {
    if (!organization) event.organization = null;
    else { const org = await Organization.findById(organization).select('_id'); if (org) event.organization = org._id; }
  }

  if (req.file) {
    if (event.coverImagePublicId) await deleteFile(event.coverImagePublicId);
    const up = await uploadBuffer(req.file.buffer, { folder: 'events', originalName: req.file.originalname });
    event.coverImage = up.url;
    event.coverImagePublicId = up.publicId;
  }

  await event.save();
  const populated = await Event.findById(event._id).populate('createdBy', 'name avatar').populate('organization', 'name color').lean();
  res.json({ success: true, event: populated });
});

// @route DELETE /api/events/:id — remove an event (creator / Admin).
export const deleteEvent = asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) { res.status(404); throw new Error('Event not found'); }
  if (!canManage(req.user, event)) { res.status(403); throw new Error('Not allowed to delete this event'); }
  if (event.coverImagePublicId) await deleteFile(event.coverImagePublicId);
  await event.deleteOne();
  res.json({ success: true, id: req.params.id });
});
