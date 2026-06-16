import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.js';
import { env } from '../config/env.js';
import { dispatchEmail, sendApprovalDecisionEmail } from '../services/emailService.js';
import { APPROVAL_STATUS, USER_ROLES } from '@tms/shared/constants';

/** Escape user text before embedding it in a (case-insensitive) RegExp. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Super-admin user directory. Optionally filtered by approval status / role and
 * a free-text `q` (name or email), newest first. `pendingCount` is the global
 * number of pending requests (independent of filter/page) for the nav badge.
 * Pagination is opt-in: supplying `page`/`limit` returns one page plus
 * `{ total, page, pages }`; omitting them returns the full filtered list.
 */
export const listUsers = asyncHandler(async (req, res) => {
  const { status, role, q, page, limit } = req.query ?? {};

  const filter = {};
  if (status) filter.approvalStatus = status;
  if (role) filter.role = role;
  const term = q?.trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const paginate = page != null || limit != null;
  const perPage = Math.min(Math.max(limit ?? 20, 1), 100);
  const current = Math.max(page ?? 1, 1);

  const query = User.find(filter)
    .sort({ createdAt: -1 })
    .populate('approvedBy', 'name email')
    .lean();
  if (paginate) query.skip((current - 1) * perPage).limit(perPage);

  const [users, total, pendingCount] = await Promise.all([
    query,
    paginate ? User.countDocuments(filter) : Promise.resolve(null),
    User.countDocuments({ approvalStatus: APPROVAL_STATUS.PENDING }),
  ]);

  return sendSuccess(res, {
    data: {
      users,
      total: paginate ? total : users.length,
      page: paginate ? current : 1,
      pages: paginate ? Math.max(Math.ceil(total / perPage), 1) : 1,
      pendingCount,
    },
  });
});

/**
 * Approve or reject an organiser request. Super admins cannot be acted on, and
 * a maintainer cannot review their own account. Rejecting also bumps the token
 * version so any outstanding sessions are invalidated immediately.
 */
export const updateApproval = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  if (user.role === USER_ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Super admin accounts cannot be reviewed');
  }
  if (String(user._id) === String(req.user._id)) {
    throw ApiError.forbidden('You cannot review your own account');
  }

  const previousStatus = user.approvalStatus;
  user.approvalStatus = status;
  user.reviewNote = note;
  user.approvedBy = req.user._id;
  user.approvedAt = new Date();
  if (status === APPROVAL_STATUS.REJECTED) {
    user.tokenVersion += 1; // kill any live sessions
  }
  await user.save();

  // Let the organiser know the outcome — but only when it actually changed, so
  // re-saving the same decision doesn't re-notify them.
  if (previousStatus !== status) {
    dispatchEmail(
      sendApprovalDecisionEmail({
        user,
        approved: status === APPROVAL_STATUS.APPROVED,
        note,
        loginUrl: `${env.appUrl}/login`,
      }),
      'approval decision'
    );
  }

  return sendSuccess(res, {
    message: status === APPROVAL_STATUS.APPROVED ? 'Organiser approved' : 'Request rejected',
    data: { user },
  });
});
