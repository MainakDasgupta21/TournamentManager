import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Tournament } from '../models/Tournament.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Fixture } from '../models/Fixture.js';
import { Standing } from '../models/Standing.js';
import { Player } from '../models/Player.js';
import { KnockoutBracket } from '../models/KnockoutBracket.js';
import { AuditLog } from '../models/AuditLog.js';
import { TournamentAccessRequest } from '../models/TournamentAccessRequest.js';
import { User } from '../models/User.js';
import { canManageTournament, isTournamentOwner } from '../middleware/loadTournament.js';
import { recalcAllStandings } from '../services/standingsService.js';
import { recordAudit } from '../services/auditService.js';
import { emitToTournament, EVENTS } from '../socket/index.js';
import {
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_VALUES,
  USER_ROLES,
  APPROVAL_STATUS,
  TIEBREAKERS,
  AUDIT_ENTITY,
  AUDIT_ACTION,
  TOURNAMENT_ACCESS_REQUEST_STATUS,
} from '@tms/shared/constants';

/**
 * Tiebreakers are sport-specific. The Zod refinement is skipped on partial PATCH
 * bodies (no `sportType` present), so enforce it here against the persisted sport.
 */
function assertTiebreakersValid(sportType, tiebreakerOrder) {
  if (!Array.isArray(tiebreakerOrder)) return;
  const allowed = TIEBREAKERS[sportType] ?? [];
  const invalid = tiebreakerOrder.filter((t) => !allowed.includes(t));
  if (invalid.length) {
    throw ApiError.badRequest(
      `Invalid tiebreaker(s) for ${sportType}: ${invalid.join(', ')}`
    );
  }
}

export const createTournament = asyncHandler(async (req, res) => {
  const tournament = await Tournament.create({
    ...req.body,
    createdBy: req.user._id,
  });
  return sendCreated(res, { message: 'Tournament created', data: { tournament } });
});

/** Map the UI status grouping to the underlying tournament statuses. */
const STATE_TO_STATUSES = {
  live: [TOURNAMENT_STATUS.GROUP_STAGE, TOURNAMENT_STATUS.KNOCKOUT_STAGE],
  setup: [TOURNAMENT_STATUS.SETUP],
  completed: [TOURNAMENT_STATUS.COMPLETED],
};

/** Explicit lifecycle: setup -> groupStage -> knockoutStage -> completed. */
const ALLOWED_STATUS_TRANSITIONS = {
  [TOURNAMENT_STATUS.SETUP]: [TOURNAMENT_STATUS.SETUP, TOURNAMENT_STATUS.GROUP_STAGE],
  [TOURNAMENT_STATUS.GROUP_STAGE]: [TOURNAMENT_STATUS.GROUP_STAGE, TOURNAMENT_STATUS.KNOCKOUT_STAGE],
  [TOURNAMENT_STATUS.KNOCKOUT_STAGE]: [TOURNAMENT_STATUS.KNOCKOUT_STAGE, TOURNAMENT_STATUS.COMPLETED],
  [TOURNAMENT_STATUS.COMPLETED]: [TOURNAMENT_STATUS.COMPLETED],
};

/** Escape user text before embedding it in a (case-insensitive) RegExp. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Public-safe projection of a tournament access request for the requester. */
function toRequestSummary(request) {
  if (!request) return null;
  return {
    _id: request._id,
    status: request.status,
    message: request.message ?? '',
    reviewNote: request.reviewNote ?? '',
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt ?? null,
  };
}

/**
 * Public list with light filtering, optional name search, sort and pagination.
 * Admins see a `canManage` flag so the client can show edit affordances without
 * a second request. Pagination is opt-in: when neither `page` nor `limit` is
 * supplied, a capped filtered list (max 200) is returned; supplying a page
 * returns `{ total, page, pages }`.
 */
export const listTournaments = asyncHandler(async (req, res) => {
  const { sport, status, state, q, sort, page, limit, mine } = req.query;

  const filter = {};
  if (sport) filter.sportType = sport;
  if (state && STATE_TO_STATUSES[state]) filter.status = { $in: STATE_TO_STATUSES[state] };
  else if (status) filter.status = status;
  if (mine && req.user) {
    filter.$or = [{ createdBy: req.user._id }, { admins: req.user._id }];
  }
  const term = q?.trim();
  if (term) filter.name = new RegExp(escapeRegex(term), 'i');

  const sortSpec = sort === 'name' ? { name: 1, createdAt: -1 } : { createdAt: -1 };
  const paginate = page != null || limit != null;
  const perPage = Math.min(Math.max(limit ?? 12, 1), 100);
  const current = Math.max(page ?? 1, 1);

  const query = Tournament.find(filter).sort(sortSpec).lean();
  if (paginate) query.skip((current - 1) * perPage).limit(perPage);
  else query.limit(200); // defensive cap for unpaginated public/admin fetches

  const [rows, total] = await Promise.all([
    query,
    paginate ? Tournament.countDocuments(filter) : Promise.resolve(null),
  ]);

  let requestByTournamentId = new Map();
  if (req.user?.role === USER_ROLES.TOURNAMENT_ADMIN && rows.length) {
    const latestRequests = await TournamentAccessRequest.find({
      requestedBy: req.user._id,
      tournamentId: { $in: rows.map((t) => t._id) },
    })
      .sort({ createdAt: -1 })
      .select('tournamentId status message reviewNote createdAt reviewedAt')
      .lean();
    requestByTournamentId = latestRequests.reduce((map, r) => {
      const key = String(r.tournamentId);
      if (!map.has(key)) map.set(key, toRequestSummary(r));
      return map;
    }, new Map());
  }

  const tournaments = rows.map((t) => {
    const canManage = canManageTournament(req.user, t);
    const myAccessRequest = requestByTournamentId.get(String(t._id)) ?? null;
    return {
      ...t,
      canManage,
      // Owner-only actions (e.g. delete) gate on this, not canManage.
      isOwner: isTournamentOwner(req.user, t),
      myAccessRequest,
      canRequestAccess:
        req.user?.role === USER_ROLES.TOURNAMENT_ADMIN &&
        !canManage &&
        myAccessRequest?.status !== TOURNAMENT_ACCESS_REQUEST_STATUS.PENDING,
    };
  });

  return sendSuccess(res, {
    data: {
      tournaments,
      total: paginate ? total : tournaments.length,
      page: paginate ? current : 1,
      pages: paginate ? Math.max(Math.ceil(total / perPage), 1) : 1,
    },
  });
});

/** Public detail, enriched with counts so the hub can render at a glance. */
export const getTournament = asyncHandler(async (req, res) => {
  const t = req.tournament;
  const canManage = canManageTournament(req.user, t);
  const [teamCount, groupCount, fixtureCount, completedCount] = await Promise.all([
    Team.countDocuments({ tournamentId: t._id }),
    Group.countDocuments({ tournamentId: t._id }),
    Fixture.countDocuments({ tournamentId: t._id }),
    Fixture.countDocuments({ tournamentId: t._id, status: 'completed' }),
  ]);

  let myAccessRequest = null;
  if (req.user?.role === USER_ROLES.TOURNAMENT_ADMIN) {
    const request = await TournamentAccessRequest.findOne({
      tournamentId: t._id,
      requestedBy: req.user._id,
    })
      .sort({ createdAt: -1 })
      .select('status message reviewNote createdAt reviewedAt')
      .lean();
    myAccessRequest = toRequestSummary(request);
  }

  return sendSuccess(res, {
    data: {
      tournament: {
        ...t.toObject(),
        canManage,
        isOwner: isTournamentOwner(req.user, t),
        myAccessRequest,
        canRequestAccess:
          req.user?.role === USER_ROLES.TOURNAMENT_ADMIN &&
          !canManage &&
          myAccessRequest?.status !== TOURNAMENT_ACCESS_REQUEST_STATUS.PENDING,
      },
      stats: { teamCount, groupCount, fixtureCount, completedCount },
    },
  });
});

export const updateTournament = asyncHandler(async (req, res) => {
  // Changing the sport after creation would invalidate points config, standings
  // math, rosters and fixtures — reject it rather than silently corrupt data.
  if (req.body.sportType && req.body.sportType !== req.tournament.sportType) {
    throw ApiError.badRequest('sportType cannot be changed after creation');
  }
  const nextStartDate = req.body.startDate ?? req.tournament.startDate;
  const nextEndDate = req.body.endDate ?? req.tournament.endDate;
  if (nextStartDate && nextEndDate && nextEndDate < nextStartDate) {
    throw ApiError.badRequest('endDate must be on or after startDate');
  }
  assertTiebreakersValid(req.tournament.sportType, req.body.pointsConfig?.tiebreakerOrder);

  Object.assign(req.tournament, req.body);
  await req.tournament.save();
  return sendSuccess(res, { message: 'Tournament updated', data: { tournament: req.tournament } });
});

export const updatePointsConfig = asyncHandler(async (req, res) => {
  assertTiebreakersValid(req.tournament.sportType, req.body.pointsConfig?.tiebreakerOrder);

  const before = req.tournament.pointsConfig
    ? JSON.parse(JSON.stringify(req.tournament.pointsConfig))
    : null;
  req.tournament.pointsConfig = req.body.pointsConfig;
  await req.tournament.save();

  // Points / tiebreaker changes mid-tournament must re-rank every group (5B).
  await recalcAllStandings(req.tournament._id);
  emitToTournament(req.tournament._id, EVENTS.STANDINGS, { full: true });

  await recordAudit({
    tournament: req.tournament,
    user: req.user,
    entityType: AUDIT_ENTITY.POINTS_CONFIG,
    entityId: req.tournament._id,
    action: AUDIT_ACTION.UPDATE,
    summary: 'Updated points configuration',
    before,
    after: req.body.pointsConfig,
  });

  return sendSuccess(res, {
    message: 'Points configuration updated',
    data: { tournament: req.tournament },
  });
});

/** Explicit status transition (setup -> groupStage -> knockoutStage -> completed). */
export const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!TOURNAMENT_STATUS_VALUES.includes(status)) {
    throw ApiError.badRequest('Invalid status');
  }
  const currentStatus = req.tournament.status;
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [currentStatus];
  if (!allowed.includes(status)) {
    throw ApiError.conflict(`Cannot move status from ${currentStatus} to ${status}`);
  }
  req.tournament.status = status;
  await req.tournament.save();
  return sendSuccess(res, { message: 'Status updated', data: { tournament: req.tournament } });
});

/** Assign (or clear) the admin-chosen Player of the Tournament (Module 7B). */
export const setPlayerOfTournament = asyncHandler(async (req, res) => {
  const { playerId } = req.body;
  if (playerId) {
    const player = await Player.findOne({ _id: playerId, tournamentId: req.tournament._id });
    if (!player) throw ApiError.badRequest('Player does not belong to this tournament');
  }
  req.tournament.playerOfTournament = playerId || null;
  await req.tournament.save();
  return sendSuccess(res, {
    message: 'Player of the tournament updated',
    data: { tournament: req.tournament },
  });
});

/** Owner + collaborator admins for the collaborator-management UI (managers). */
export const listAdmins = asyncHandler(async (req, res) => {
  const t = await Tournament.findById(req.tournament._id)
    .populate('createdBy', 'name email role')
    .populate('admins', 'name email role')
    .lean();

  const ownerId = String(t.createdBy?._id ?? t.createdBy ?? '');
  // The owner is implicitly a manager; never list them as a collaborator too.
  const admins = (t.admins ?? []).filter((a) => String(a._id) !== ownerId);
  return sendSuccess(res, { data: { owner: t.createdBy ?? null, admins } });
});

/**
 * Search approved organisers to add as collaborators (super-admin only). Returns at
 * most 10 minimal records, excluding the owner and current admins. Requires a
 * 2+ char query so we never dump the whole directory.
 */
export const searchAdminCandidates = asyncHandler(async (req, res) => {
  const q = (req.query.q ?? '').trim();
  if (q.length < 2) {
    return sendSuccess(res, { data: { candidates: [] } });
  }

  const exclude = new Set([
    String(req.tournament.createdBy),
    ...(req.tournament.admins ?? []).map((a) => String(a)),
  ]);
  // Escape regex metacharacters so a query like "a.b" can't alter the match.
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = new RegExp(safe, 'i');

  const users = await User.find({
    isActive: true,
    role: USER_ROLES.TOURNAMENT_ADMIN,
    approvalStatus: APPROVAL_STATUS.APPROVED,
    $or: [{ name: rx }, { email: rx }],
  })
    .select('name email role')
    .sort({ name: 1 })
    .limit(20)
    .lean();

  const candidates = users.filter((u) => !exclude.has(String(u._id))).slice(0, 10);
  return sendSuccess(res, { data: { candidates } });
});

/** Assign an additional tournament admin (super-admin-only route). */
export const assignAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  // The owner already manages the tournament — don't duplicate them as a collaborator.
  if (String(req.tournament.createdBy) === String(userId)) {
    throw ApiError.badRequest('The owner already manages this tournament');
  }

  // Only assign real, active organiser accounts — never an arbitrary id.
  const user = await User.findById(userId).select('name email role approvalStatus isActive');
  if (!user || !user.isActive) {
    throw ApiError.badRequest('User not found or inactive');
  }
  const isOrganiser =
    user.role === USER_ROLES.TOURNAMENT_ADMIN || user.role === USER_ROLES.SUPER_ADMIN;
  if (!isOrganiser) {
    throw ApiError.badRequest('Only organiser accounts can be assigned as tournament admins');
  }
  if (user.role !== USER_ROLES.SUPER_ADMIN && user.approvalStatus !== APPROVAL_STATUS.APPROVED) {
    throw ApiError.badRequest('User is not an approved organiser');
  }

  if (!req.tournament.admins.some((a) => String(a) === String(userId))) {
    req.tournament.admins.push(userId);
    await req.tournament.save();
    await recordAudit({
      tournament: req.tournament,
      user: req.user,
      entityType: AUDIT_ENTITY.TOURNAMENT,
      entityId: req.tournament._id,
      action: AUDIT_ACTION.UPDATE,
      summary: `Added ${user.name} as a collaborator`,
      meta: { collaboratorId: String(userId), email: user.email },
    });
  }
  return sendSuccess(res, { message: 'Collaborator added', data: { tournament: req.tournament } });
});

/** Remove a collaborator admin (super-admin-only route). */
export const removeAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  if (String(req.tournament.createdBy) === String(userId)) {
    throw ApiError.badRequest('The tournament owner cannot be removed');
  }

  const before = req.tournament.admins.length;
  req.tournament.admins = req.tournament.admins.filter((a) => String(a) !== String(userId));

  if (req.tournament.admins.length !== before) {
    await req.tournament.save();
    const removed = await User.findById(userId).select('name email').lean();
    await recordAudit({
      tournament: req.tournament,
      user: req.user,
      entityType: AUDIT_ENTITY.TOURNAMENT,
      entityId: req.tournament._id,
      action: AUDIT_ACTION.UPDATE,
      summary: `Removed ${removed?.name ?? 'a collaborator'} as a collaborator`,
      meta: { collaboratorId: String(userId) },
    });
  }
  return sendSuccess(res, { message: 'Collaborator removed', data: { tournament: req.tournament } });
});

/** Cascade delete a tournament and all of its dependent documents. */
function isTransactionUnsupported(err) {
  const message = String(err?.message ?? '');
  return /transaction|replica set|mongos|no transaction/i.test(message);
}

async function deleteTournamentCascade(id, session) {
  const options = session ? { session } : {};
  await Promise.all([
    Team.deleteMany({ tournamentId: id }, options),
    Group.deleteMany({ tournamentId: id }, options),
    Player.deleteMany({ tournamentId: id }, options),
    Fixture.deleteMany({ tournamentId: id }, options),
    Standing.deleteMany({ tournamentId: id }, options),
    KnockoutBracket.deleteMany({ tournamentId: id }, options),
    TournamentAccessRequest.deleteMany({ tournamentId: id }, options),
    AuditLog.deleteMany({ tournamentId: id }, options),
  ]);
}

export const deleteTournament = asyncHandler(async (req, res) => {
  const id = req.tournament._id;
  try {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await deleteTournamentCascade(id, session);
        await req.tournament.deleteOne({ session });
      });
      return sendSuccess(res, { message: 'Tournament deleted' });
    } finally {
      await session.endSession();
    }
  } catch (err) {
    // Local standalone MongoDB does not support transactions; fall back to the
    // legacy best-effort cascade so dev environments still work.
    if (!isTransactionUnsupported(err)) throw err;
  }

  await deleteTournamentCascade(id);
  await req.tournament.deleteOne();
  return sendSuccess(res, { message: 'Tournament deleted' });
});

export { TOURNAMENT_STATUS };
