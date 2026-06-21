import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../utils/tokens.js';
import { User } from '../models/User.js';
import { USER_ROLES, APPROVAL_STATUS } from '@tms/shared/constants';

function isCurrentSession(payload, user) {
  return Number(payload?.tv) === Number(user?.tokenVersion);
}

/**
 * Requires a valid access token. Attaches the live user document to req.user.
 * We re-load the user so a deactivated/role-changed account is rejected even
 * if it still holds a non-expired token.
 */
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw ApiError.unauthorized('Authentication required');

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account is not active');
  if (!isCurrentSession(payload, user)) {
    throw ApiError.unauthorized('Session is no longer valid');
  }
  // An organiser whose approval was revoked loses access even mid-session.
  if (
    user.role !== USER_ROLES.SUPER_ADMIN &&
    user.approvalStatus !== APPROVAL_STATUS.APPROVED
  ) {
    throw ApiError.forbidden('Account is not approved');
  }

  req.user = user;
  next();
});

/**
 * Role-based access control. Usage: `authorize('superadmin')` or
 * `authorize('superadmin', 'tournamentadmin')`.
 */
export const authorize = (...roles) =>
  asyncHandler(async (req, res, next) => {
    if (!req.user) throw ApiError.unauthorized('Authentication required');
    if (roles.length && !roles.includes(req.user.role)) {
      throw ApiError.forbidden('You do not have permission to perform this action');
    }
    next();
  });

/**
 * Optional auth: populate req.user when a valid token is present, but never
 * reject *when no token is provided*. Public endpoints can personalise output
 * for logged-in users, but an invalid/expired bearer token now returns 401 so
 * clients can refresh instead of silently degrading to anonymous responses.
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    next();
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Authentication required');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw ApiError.unauthorized('Account is not active');
  if (!isCurrentSession(payload, user)) {
    throw ApiError.unauthorized('Session is no longer valid');
  }
  if (
    user.role !== USER_ROLES.SUPER_ADMIN &&
    user.approvalStatus !== APPROVAL_STATUS.APPROVED
  ) {
    throw ApiError.unauthorized('Account is not approved');
  }

  req.user = user;
  next();
});
