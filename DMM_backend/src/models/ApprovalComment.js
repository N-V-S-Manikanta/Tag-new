import mongoose from 'mongoose';

// Dedicated collection for CEO feedback points on a request (the "approvalComments"
// collection). Each comment references its parent request and (optionally) the
// review round it belongs to.
const approvalCommentSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', required: true, index: true },
    text: { type: String, required: true },
    category: { type: String, default: 'Other' }, // Image | Content | Other | Reject
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewRound: { type: Number, default: 1 },
  },
  { timestamps: true }
);

const ApprovalComment = mongoose.model('ApprovalComment', approvalCommentSchema);
export default ApprovalComment;
