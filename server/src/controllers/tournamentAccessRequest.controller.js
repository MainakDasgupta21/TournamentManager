import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Tournament } from '../models/Tournament.js';
import { TournamentAccessRequest } from '../models/TournamentAccessRequest.js';
import { User } from '../models/User.js';
import { canManageTournament } from '../middleware/loadTournament.js';
import { env } from '../config/env.js';
import {
  dispatchEmail,
  sendTournamentAccessDecisionEmail,
  sendTournamentAccessRequestEmail,
} from '../services/emailService.js';
import { recordAudit } from '../services/auditService.js';
import {
  APPROVAL_STATUS,
  AUDIT_ACTION,
  AUDIT_ENTITY,
  TOURNAMENT_ACCESS_REQUEST_STATUS,
  USER_ROLES,
} from '@tms/shared/constants';

/** Escape user text before embedding it in a (case-insensitive) RegExp. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Organiser requests management access to a specific tournament.
 * Super admins can already access every tournament, so they cannot request.
 */
export const requestTournamentAccess = asyncHandler(async (req, res) => {
  if (req.user.role !== USER_ROLES.TOURNAMENT_ADMIN) {
    throw ApiError.forbidden('Only tournament admins can request tournament access');
  }
  if (canManageTournament(req.user, req.tournament)) {
    throw ApiError.badRequest('You already have access to this tournament');
  }

  const existing = await TournamentAccessRequest.findOne({
    tournamentId: req.tournament._id,
    requestedBy: req.user._id,
    status: TOURNAMENT_ACCESS_REQUEST_STATUS.PENDING,
  }).lean();
  if (existing) {
    throw ApiError.conflict('You already have a pending request for this tournament');
  }

  const accessRequest = await TournamentAccessRequest.create({
    tournamentId: req.tournament._id,
    requestedBy: req.user._id,
    message: req.body?.message ?? '',
  });

  const reviewers = await User.find({
    role: USER_ROLES.SUPER_ADMIN,
    isActive: true,
  })
    .select('email')
    .lean();
  const reviewerEmails = reviewers.map((r) => r.email).filter(Boolean);

  dispatchEmail(
    sendTournamentAccessRequestEmail({
      to: reviewerEmails,
      requester: req.user,
      tournament: req.tournament,
      message: accessRequest.message,
      reviewUrl: `${env.appUrl}/admin/tournament-access`,
    }),
    'tournament access request'
  );

  return sendCreated(res, {
    message: 'Access request submitted',
    data: { request: accessRequest },
  });
});

/**
 * Super-admin review queue for tournament access requests.
 * Supports status filter + optional search by tournament name/requester.
 */
export const listTournamentAccessRequests = asyncHandler(async (req, res) => {
  const { status, q, page, limit } = req.query ?? {};

  const filter = {};
  if (status) filter.status = status;

  const term = q?.trim();
  if (term) {
    const rx = new RegExp(escapeRegex(term), 'i');
    const [matchingUsers, matchingTournaments] = await Promise.all([
      User.find({
        $or: [{ name: rx }, { email: rx }],
      })
        .select('_id')
        .lean(),
      Tournament.find({ name: rx }).select('_id').lean(),
    ]);
    const userIds = matchingUsers.map((u) => u._id);
    const tournamentIds = matchingTournaments.map((t) => t._id);
    filter.$or = [{ requestedBy: { $in: userIds } }, { tournamentId: { $in: tournamentIds } }];
  }

  const paginate = page != null || limit != null;
  const perPage = Math.min(Math.max(limit ?? 20, 1), 100);
  const current = Math.max(page ?? 1, 1);

  const query = TournamentAccessRequest.find(filter)
    .sort({ createdAt: -1 })
    .populate('tournamentId', 'name sportType')
    .populate('requestedBy', 'name email organization role')
    .populate('reviewedBy', 'name email')
    .lean();
  if (paginate) query.skip((current - 1) * perPage).limit(perPage);

  const [requests, total, pendingCount] = await Promise.all([
    query,
    paginate ? TournamentAccessRequest.countDocuments(filter) : Promise.resolve(null),
    TournamentAccessRequest.countDocuments({ status: TOURNAMENT_ACCESS_REQUEST_STATUS.PENDING }),
  ]);

  return sendSuccess(res, {
    data: {
      requests,
      total: paginate ? total : requests.length,
      page: paginate ? current : 1,
      pages: paginate ? Math.max(Math.ceil(total / perPage), 1) : 1,
      pendingCount,
    },
  });
});

/**
 * Super admin approves/rejects a pending request.
 * Approval grants collaborator access on that tournament.
 */
export const reviewTournamentAccessRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;

  const accessRequest = await TournamentAccessRequest.findById(id);
  if (!accessRequest) throw ApiError.notFound('Tournament access request not found');
  if (accessRequest.status !== TOURNAMENT_ACCESS_REQUEST_STATUS.PENDING) {
    throw ApiError.conflict('This request has already been reviewed');
  }

  const [tournament, requester] = await Promise.all([
    Tournament.findById(accessRequest.tournamentId),
    User.findById(accessRequest.requestedBy).select('name email role approvalStatus isActive'),
  ]);
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (!requester || !requester.isActive) {
    throw ApiError.badRequest('Requester account is missing or inactive');
  }

  if (status === TOURNAMENT_ACCESS_REQUEST_STATUS.APPROVED) {
    const isOrganiser =
      requester.role === USER_ROLES.TOURNAMENT_ADMIN || requester.role === USER_ROLES.SUPER_ADMIN;
    if (!isOrganiser) {
      throw ApiError.badRequest('Only organiser accounts can be granted tournament access');
    }
    if (
      requester.role !== USER_ROLES.SUPER_ADMIN &&
      requester.approvalStatus !== APPROVAL_STATUS.APPROVED
    ) {
      throw ApiError.badRequest('Requester is not an approved organiser');
    }

    const requesterId = String(requester._id);
    const isOwner = String(tournament.createdBy) === requesterId;
    const alreadyCollaborator = tournament.admins.some((a) => String(a) === requesterId);
    if (!isOwner && !alreadyCollaborator) {
      tournament.admins.push(requester._id);
      await tournament.save();
    }

    await recordAudit({
      tournament,
      user: req.user,
      entityType: AUDIT_ENTITY.TOURNAMENT,
      entityId: tournament._id,
      action: AUDIT_ACTION.UPDATE,
      summary: `Approved ${requester.name}'s collaborator access request`,
      meta: {
        collaboratorId: requesterId,
        email: requester.email,
        accessRequestId: String(accessRequest._id),
      },
    });
  }

  accessRequest.status = status;
  accessRequest.reviewNote = note;
  accessRequest.reviewedBy = req.user._id;
  accessRequest.reviewedAt = new Date();
  await accessRequest.save();

  dispatchEmail(
    sendTournamentAccessDecisionEmail({
      user: requester,
      tournament,
      approved: status === TOURNAMENT_ACCESS_REQUEST_STATUS.APPROVED,
      note,
      adminUrl: `${env.appUrl}/admin/t/${tournament._id}`,
    }),
    'tournament access decision'
  );

  return sendSuccess(res, {
    message:
      status === TOURNAMENT_ACCESS_REQUEST_STATUS.APPROVED
        ? 'Tournament access approved'
        : 'Tournament access request rejected',
    data: { request: accessRequest },
  });
});
