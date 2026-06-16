import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Tournament } from '../models/Tournament.js';
import { Fixture } from '../models/Fixture.js';
import { USER_ROLES } from '@tms/shared/constants';

/** True if the user may manage (write to) the given tournament. */
export function canManageTournament(user, tournament) {
  if (!user) return false;
  if (user.role === USER_ROLES.SUPER_ADMIN) return true;
  const uid = String(user._id);
  if (String(tournament.createdBy) === uid) return true;
  return (tournament.admins ?? []).some((a) => String(a) === uid);
}

/**
 * True if the user *owns* the tournament — its creator, or a super admin.
 * Stricter than canManageTournament: a co-admin can manage content but is not
 * an owner, so they cannot add/remove fellow collaborators.
 */
export function isTournamentOwner(user, tournament) {
  if (!user) return false;
  if (user.role === USER_ROLES.SUPER_ADMIN) return true;
  return String(tournament.createdBy) === String(user._id);
}

/**
 * Loads the tournament referenced by :id (or :tournamentId) onto req.tournament.
 * Use on all tournament-scoped routes so we hit the DB once and 404 early.
 */
export const loadTournament = asyncHandler(async (req, res, next) => {
  const id = req.params.id ?? req.params.tournamentId;
  const tournament = await Tournament.findById(id);
  if (!tournament) throw ApiError.notFound('Tournament not found');
  req.tournament = tournament;
  next();
});

/**
 * For top-level fixture routes (/api/fixtures/:fixtureId/...). Resolves the
 * parent tournament from the fixture so the same manager guard can be reused.
 */
export const loadTournamentFromFixture = asyncHandler(async (req, res, next) => {
  const fixture = await Fixture.findById(req.params.fixtureId).select('tournamentId');
  if (!fixture) throw ApiError.notFound('Fixture not found');
  const tournament = await Tournament.findById(fixture.tournamentId);
  if (!tournament) throw ApiError.notFound('Tournament not found');
  req.tournament = tournament;
  next();
});

/**
 * Guards write access to req.tournament. Must run after authenticate +
 * loadTournament.
 */
export const requireTournamentManager = asyncHandler(async (req, res, next) => {
  if (!canManageTournament(req.user, req.tournament)) {
    throw ApiError.forbidden('You cannot manage this tournament');
  }
  next();
});

/**
 * Guards owner-only actions (collaborator management). Must run after
 * authenticate + loadTournament.
 */
export const requireTournamentOwner = asyncHandler(async (req, res, next) => {
  if (!isTournamentOwner(req.user, req.tournament)) {
    throw ApiError.forbidden('Only the tournament owner or a super admin can manage collaborators');
  }
  next();
});
