import mongoose from 'mongoose';

// A tenant. Every CEO/User belongs to one organization, and all org-scoped data
// (approvals, templates, assets, analytics, notifications, activity) references it.
const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    logoPublicId: { type: String, default: '' },
    website: { type: String, default: '' },
    // Visual accent for the org (used in product app branding)
    color: { type: String, default: '#6366f1' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const slugify = (name = '') =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const Organization = mongoose.model('Organization', organizationSchema);
export default Organization;
