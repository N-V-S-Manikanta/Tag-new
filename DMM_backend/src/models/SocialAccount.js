import mongoose from 'mongoose';

// Who handles each social media account, per organization + platform — owner,
// linked emails, the coordinators handling it (with contact details), the
// profile/website URL, a rating and how many people can access it.
const handlerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phone: { type: String, trim: true },
    role: { type: String, trim: true, default: '' }, // e.g. "Designer", "Content"
  },
  { _id: false }
);

const socialAccountSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    platform: { type: String, enum: ['LinkedIn', 'Instagram', 'YouTube', 'Facebook'], required: true },
    accountName: { type: String, default: '' }, // handle / page name
    profileUrl: { type: String, default: '' }, // website / profile link
    ownerName: { type: String, default: '' },
    ownerEmail: { type: String, default: '' },
    linkedEmails: [{ type: String, trim: true }], // emails linked to the account
    handlers: [handlerSchema], // coordinators handling this account
    rating: { type: Number, default: 0 }, // 0–5
    accessCount: { type: Number, default: 0 }, // how many people can access it
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

socialAccountSchema.index({ organization: 1, platform: 1 });

const SocialAccount = mongoose.model('SocialAccount', socialAccountSchema);
export default SocialAccount;
