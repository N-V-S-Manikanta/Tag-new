import mongoose from 'mongoose';

// A college/marketing event captured by the Zolo team. The actual photos live in
// an external folder (e.g. a OneDrive share link) — we store the event details
// and that folder link so everyone can view and open the pictures in one click.
const eventSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // External folder holding the photos (OneDrive / Google Drive / any share URL).
    folderLink: { type: String, required: true, trim: true },
    eventDate: { type: Date },
    location: { type: String, default: '' },
    // Optional cover thumbnail for the event card.
    coverImage: { type: String, default: '' },
    coverImagePublicId: { type: String, default: '' },
    // Which organization the event relates to (optional — many events are college-wide).
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

eventSchema.index({ eventDate: -1, createdAt: -1 });

const Event = mongoose.model('Event', eventSchema);
export default Event;
