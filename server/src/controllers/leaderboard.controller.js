import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Player } from '../models/Player.js';
import { computeLeaderboards, computePlayerProfile } from '../services/leaderboardService.js';

/** Public, auto-updating tournament-wide leaderboards (Module 7B). */
export const getLeaderboards = asyncHandler(async (req, res) => {
  const leaderboards = await computeLeaderboards(req.tournament._id);
  return sendSuccess(res, { data: { leaderboards } });
});

/** All players in a tournament with their cached stats (admin pickers, etc.). */
export const listTournamentPlayers = asyncHandler(async (req, res) => {
  const players = await Player.find({ tournamentId: req.tournament._id })
    .populate('teamId', 'name shortCode primaryColor')
    .sort({ name: 1 })
    .lean();
  return sendSuccess(res, { data: { players } });
});

/** Single player's profile: cached aggregate stats + match-by-match breakdown. */
export const getPlayerStats = asyncHandler(async (req, res) => {
  const profile = await computePlayerProfile(req.params.id);
  if (!profile) throw ApiError.notFound('Player not found');
  return sendSuccess(res, { data: profile });
});
