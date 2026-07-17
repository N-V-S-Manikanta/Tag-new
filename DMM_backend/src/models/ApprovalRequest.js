import mongoose from 'mongoose';
import { PLATFORMS, APPROVAL_STATUS, APPROVAL_TYPES } from '../config/constants.js';

// Images live in the `approvalImages` collection (models/ApprovalImage.js) and
// feedback points live in the `approvalComments` collection
// (models/ApprovalComment.js). Both reference this request by id. The controller
// attaches them to the response as `images` and `comments` arrays.

// A single feedback point: what to change (category) + the note itself.
const feedbackPointSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    category: { type: String, default: 'Other' }, // Image | Content | Other | Reject
  },
  { _id: false }
);

// One review round groups the feedback points the reviewer submitted on a rejection.
const reviewSchema = new mongoose.Schema(
  {
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    feedbackPoints: [feedbackPointSchema],
    reviewedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const forwardTargetSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    handlers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { _id: false }
);

const approvalRequestSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    // POST = ready-to-publish content; DESIGN = creative work that, once
    // approved, is assigned to a social-media handler who raises the linked
    // POST request. Legacy documents without the field are treated as POST.
    type: { type: String, enum: Object.values(APPROVAL_TYPES), default: APPROVAL_TYPES.POST, index: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    caption: { type: String, default: '' },
    description: { type: String, default: '' },
    aspectRatio: { type: String, default: '' }, // e.g. "1:1", "4:5", "9:16", "16:9"
    hashtags: [{ type: String }],
    reviews: [reviewSchema],
    imageCount: { type: Number, default: 0 }, // denormalized for quick list rendering
    status: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.PENDING,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    // lifecycle timestamps
    approvedAt: { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: { type: Date },
    resubmittedAt: { type: Date },

    // DESIGN pipeline: who the approved design was handed to for publishing…
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedAt: { type: Date },
    // …and the POST request the handler raised from it (back-linked both ways).
    linkedPost: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null },
    sourceDesign: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null },
    deliveryMode: { type: String, enum: ['DIGITAL', 'PRINT'], default: 'DIGITAL' },
    forwardedTargets: [forwardTargetSchema],
    forwardedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    forwardedAt: { type: Date },
    // Flattened fast-lookup list for assignee checks in query filters.
    forwardedHandlers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],

    // post completion
    postedAt: { type: Date },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    resubmitCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

approvalRequestSchema.index({ title: 'text', caption: 'text', description: 'text' });

const ApprovalRequest = mongoose.model('ApprovalRequest', approvalRequestSchema);
export default ApprovalRequest;
