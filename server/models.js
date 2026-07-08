import mongoose from 'mongoose';

// Single-document store for all editable site content. Kept as Mixed so the
// admin panel can evolve the shape without schema migrations.
const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'main' },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true, minimize: false }
);

const subscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true }
);

const bookingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    time: { type: String, required: true }, // e.g. "09:00 AM"
    duration: { type: String, default: '' },
    topic: { type: String, default: '', trim: true },
    status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  },
  { timestamps: true }
);
// One booking per date+time slot (cancelled ones free the slot via query logic).
bookingSchema.index({ date: 1, time: 1 });

export const SiteContent = mongoose.model('SiteContent', siteContentSchema);
export const Subscriber = mongoose.model('Subscriber', subscriberSchema);
export const Booking = mongoose.model('Booking', bookingSchema);
