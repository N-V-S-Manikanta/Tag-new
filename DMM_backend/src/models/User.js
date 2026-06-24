import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ROLES } from '../config/constants.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    // CEO and USER belong to one organization. ADMIN is global (organization = null).
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', default: null, index: true },
    avatar: { type: String, default: '' },
    avatarPublicId: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    settings: {
      theme: { type: String, enum: ['light', 'dark'], default: 'light' },
      notifications: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
      },
    },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = function (entered) {
  return bcrypt.compare(entered, this.password);
};

userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
  return resetToken;
};

const User = mongoose.model('User', userSchema);
export default User;
