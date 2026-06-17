import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  USER_ROLE_VALUES,
  USER_ROLES,
  APPROVAL_STATUS,
  APPROVAL_STATUS_VALUES,
  THEME_VALUES,
} from '@tms/shared/constants';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: USER_ROLE_VALUES,
      default: USER_ROLES.TOURNAMENT_ADMIN,
    },
    // Self-signups start `pending`; a super admin must approve before login.
    approvalStatus: {
      type: String,
      enum: APPROVAL_STATUS_VALUES,
      default: APPROVAL_STATUS.PENDING,
      index: true,
    },
    // Context the organiser supplies at signup to help the maintainer decide.
    organization: { type: String, trim: true, maxlength: 160 },
    // Audit trail for the approval decision.
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    // Per-user UI preferences. The single source of truth for the theme of a
    // signed-in user (the client no longer persists this locally).
    preferences: {
      theme: { type: String, enum: THEME_VALUES, default: 'dark' },
    },
    // Bumped on logout-all / password change to invalidate outstanding
    // refresh tokens (the version is encoded into the refresh token).
    tokenVersion: { type: Number, default: 0 },

    // Forgot-password flow. We store only a SHA-256 *hash* of the single-use
    // reset token (so a DB leak can't be used to reset accounts) plus its
    // expiry. Both are select:false so they never surface in API responses.
    resetPasswordTokenHash: { type: String, select: false, default: null },
    resetPasswordExpires: { type: Date, select: false, default: null },
  },
  { timestamps: true }
);

/** Hash a plaintext password and assign it. */
userSchema.methods.setPassword = async function setPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plain, salt);
};

userSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.toJSON = function toJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema);
