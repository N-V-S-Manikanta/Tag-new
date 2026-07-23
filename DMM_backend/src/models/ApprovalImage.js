import mongoose from 'mongoose';

// Dedicated collection for approval request media (the "approvalImages" collection).
// Each item references its parent request and carries an explicit order so the
// gallery can be reordered by the user. `mediaType` distinguishes images from
// videos so the UI can render the right element.
const approvalImageSchema = new mongoose.Schema(
  {
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalRequest', required: true, index: true },
    url: { type: String, required: true },
    publicId: { type: String, default: '' },
    mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
    // 'reference' = brief material a coordinator attached; 'final' = the finished
    // design/media submitted for approval. Standalone POST media is 'final'.
    kind: { type: String, enum: ['reference', 'final'], default: 'final' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ApprovalImage = mongoose.model('ApprovalImage', approvalImageSchema);
export default ApprovalImage;
