import mongoose from 'mongoose';

// Dedicated collection for approval request images (the "approvalImages" collection).
// Each image references its parent request and carries an explicit order so the
// gallery can be reordered by the user.
const approvalImageSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', required: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ApprovalImage = mongoose.model('ApprovalImage', approvalImageSchema);
export default ApprovalImage;
