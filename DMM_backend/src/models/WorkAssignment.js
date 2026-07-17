import mongoose from 'mongoose';
import { PLATFORMS, USER_TYPES } from '../config/constants.js';

const workAssignmentSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    platform: { type: String, enum: ['', ...PLATFORMS], default: '' },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assigneeType: { type: String, enum: Object.values(USER_TYPES), required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['OPEN', 'ACKNOWLEDGED', 'DONE'], default: 'OPEN', index: true },
    acknowledgedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

workAssignmentSchema.index({ organization: 1, assignee: 1, status: 1, createdAt: -1 });

const WorkAssignment = mongoose.model('WorkAssignment', workAssignmentSchema);
export default WorkAssignment;