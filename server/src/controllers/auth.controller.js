import crypto from 'node:crypto';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import {
  dispatchEmail,
  sendPasswordResetEmail,
  sendAccessRequestEmail,
} from '../services/emailService.js';
import { USER_ROLES, APPROVAL_STATUS } from '@tms/shared/constants';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  refreshCookieOptions,
} from '../utils/tokens.js';

const REFRESH_COOKIE = 'tms_refresh';
const RESET_TTL_MINUTES = 30;
const SUPER_ADMIN_FIXED_PASSWORD_MESSAGE =
  'Super admin password is fixed by system configuration and cannot be changed here.';

/** Hash a reset token before storing/looking it up (never store the raw token). */
const hashResetToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * Compare a candidate password to the configured fixed super-admin password.
 * Uses a timing-safe compare when lengths match.
 */
function matchesFixedSuperAdminPassword(candidate) {
  const expected = env.seed.password ?? '';
  if (typeof candidate !== 'string') return false;
  const actualBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

/** Only accounts that could actually sign in are eligible for a reset link. */
function canSignIn(user) {
  if (!user || !user.isActive) return false;
  return user.role === USER_ROLES.SUPER_ADMIN || user.approvalStatus === APPROVAL_STATUS.APPROVED;
}

function issueTokens(res, user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, user.tokenVersion);
  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());
  return { accessToken, refreshToken };
}

/**
 * Block sign-in for accounts that have not been approved by the site
 * maintainer. Super admins are inherently trusted and bypass the gate.
 */
function assertApproved(user) {
  if (user.role === USER_ROLES.SUPER_ADMIN) return;
  if (user.approvalStatus === APPROVAL_STATUS.APPROVED) return;
  if (user.approvalStatus === APPROVAL_STATUS.REJECTED) {
    throw ApiError.forbidden('Your access request was declined by the site maintainer.');
  }
  throw ApiError.forbidden('Your account is awaiting approval by the site maintainer.');
}

/**
 * Public self-signup for tournament organisers. Creates a `pending`
 * tournamentadmin account that a super admin must approve before login. No
 * tokens are issued: the requester cannot enter the admin panel until approved.
 */
export const signup = asyncHandler(async (req, res) => {
  const { name, email, password, organization } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw ApiError.conflict('Email is already registered');

  const user = new User({
    name,
    email,
    organization,
    role: USER_ROLES.TOURNAMENT_ADMIN,
    approvalStatus: APPROVAL_STATUS.PENDING,
  });
  await user.setPassword(password);
  await user.save();

  // Notify the site maintainer(s) that a request is awaiting review. Best-effort:
  // never let a mail hiccup fail the signup itself.
  const maintainers = await User.find({
    role: USER_ROLES.SUPER_ADMIN,
    isActive: true,
  })
    .select('email')
    .lean();
  const to = maintainers.map((m) => m.email).filter(Boolean);
  if (to.length) {
    dispatchEmail(
      sendAccessRequestEmail({
        to,
        requester: { name: user.name, email: user.email, organization: user.organization },
        reviewUrl: `${env.appUrl}/admin/users`,
      }),
      'access request notification'
    );
  }

  return sendCreated(res, {
    message: 'Request submitted. A site maintainer will review your account shortly.',
    data: { user },
  });
});

/**
 * Register a new admin account. Only a super admin may create accounts, and
 * only a super admin may mint another super admin. Accounts created here are
 * pre-approved (the maintainer is creating them directly).
 */
export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (role === USER_ROLES.SUPER_ADMIN && req.user?.role !== USER_ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only a super admin can create another super admin');
  }

  const exists = await User.findOne({ email });
  if (exists) throw ApiError.conflict('Email is already registered');

  const user = new User({
    name,
    email,
    role,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    approvedBy: req.user?._id,
    approvedAt: new Date(),
  });
  await user.setPassword(password);
  await user.save();

  return sendCreated(res, { message: 'Account created', data: { user } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !user.isActive) throw ApiError.unauthorized('Invalid credentials');

  const ok =
    user.role === USER_ROLES.SUPER_ADMIN
      ? matchesFixedSuperAdminPassword(password)
      : await user.comparePassword(password);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');

  // Only approved organisers (and super admins) may enter the admin panel.
  assertApproved(user);

  const { accessToken } = issueTokens(res, user);
  return sendSuccess(res, {
    message: 'Logged in',
    data: { user, accessToken },
  });
});

/**
 * Exchange a valid refresh token (cookie or body) for a new access token.
 * tokenVersion check lets us revoke all sessions on logout-all / password reset.
 */
export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
  if (!token) throw ApiError.unauthorized('Missing refresh token');

  const payload = verifyRefreshToken(token);
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive || user.tokenVersion !== payload.tv) {
    throw ApiError.unauthorized('Refresh token is no longer valid');
  }
  // Revoking approval (or rejecting) immediately invalidates live sessions.
  assertApproved(user);

  const { accessToken } = issueTokens(res, user);
  return sendSuccess(res, { message: 'Token refreshed', data: { user, accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  // Revoke every outstanding refresh token for this user. Since refresh tokens
  // carry only a tokenVersion (no per-session id), bumping the version is what
  // makes a copied/stolen refresh cookie unusable after logout. Clearing the
  // cookie alone would not invalidate a token that was already exfiltrated.
  await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  return sendSuccess(res, { message: 'Logged out' });
});

/** Invalidate every outstanding refresh token for the current user. */
export const logoutAll = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  return sendSuccess(res, { message: 'Logged out of all sessions' });
});

export const me = asyncHandler(async (req, res) => {
  return sendSuccess(res, { data: { user: req.user } });
});

/**
 * Update the signed-in user's UI preferences (currently just the theme). The
 * database is the single source of truth — the client persists nothing locally.
 */
export const updatePreferences = asyncHandler(async (req, res) => {
  const { theme } = req.body;
  const user = req.user;
  user.preferences = { ...user.preferences?.toObject?.() ?? user.preferences, theme };
  await user.save();
  return sendSuccess(res, { message: 'Preferences updated', data: { user } });
});

/**
 * Authenticated self-service password change. `authenticate` loads req.user
 * without the (select:false) passwordHash, so we re-load with it to verify the
 * current password. On success we bump tokenVersion — invalidating refresh
 * tokens on every *other* device (matching logout-all) — and then re-issue
 * tokens for the current session so this client stays signed in.
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Account not found');
  if (user.role === USER_ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden(SUPER_ADMIN_FIXED_PASSWORD_MESSAGE);
  }

  const ok = await user.comparePassword(currentPassword);
  // 400 (not 401): the session is valid, the supplied field is wrong. A 401 here
  // would trip the client's refresh-and-replay interceptor.
  if (!ok) throw ApiError.badRequest('Current password is incorrect');

  await user.setPassword(newPassword);
  user.tokenVersion += 1; // revoke refresh tokens on all other sessions
  await user.save();

  const { accessToken } = issueTokens(res, user);
  return sendSuccess(res, {
    message: 'Password changed. Other devices have been signed out.',
    data: { user, accessToken },
  });
});

/**
 * Begin the forgot-password flow. Always returns the same generic message so an
 * attacker can't probe which emails have accounts. When the email maps to a
 * sign-in-capable account we mint a single-use token, store only its hash +
 * expiry, and email the reset link.
 */
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const generic = {
    message: 'If an account exists for that email, a password reset link is on its way.',
  };

  const user = await User.findOne({ email });
  if (!canSignIn(user) || user.role === USER_ROLES.SUPER_ADMIN) return sendSuccess(res, generic);

  const rawToken = crypto.randomBytes(32).toString('hex');
  user.resetPasswordTokenHash = hashResetToken(rawToken);
  user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
  await user.save();

  // Fire-and-forget: don't await the send, so response timing is the same
  // whether or not the account exists (no enumeration via latency).
  const resetUrl = `${env.appUrl}/reset-password?token=${rawToken}`;
  dispatchEmail(
    sendPasswordResetEmail({ user, resetUrl, ttlMinutes: RESET_TTL_MINUTES }),
    'password reset'
  );

  return sendSuccess(res, generic);
});

/**
 * Complete a password reset. The token is matched by hash and must be unexpired.
 * On success the token is consumed (single-use), the password is replaced, and
 * tokenVersion is bumped so any existing sessions are invalidated. No tokens are
 * issued — the user signs in fresh with the new password.
 */
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body;

  const user = await User.findOne({
    resetPasswordTokenHash: hashResetToken(token),
    resetPasswordExpires: { $gt: new Date() },
  }).select('+resetPasswordTokenHash +resetPasswordExpires');

  if (!user) throw ApiError.badRequest('This password reset link is invalid or has expired.');
  if (user.role === USER_ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden(SUPER_ADMIN_FIXED_PASSWORD_MESSAGE);
  }

  await user.setPassword(newPassword);
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpires = null;
  user.tokenVersion += 1; // invalidate any sessions opened before the reset
  await user.save();

  return sendSuccess(res, {
    message: 'Password reset. You can now sign in with your new password.',
  });
});
