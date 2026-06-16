import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { Group } from '../models/Group.js';
import { Standing } from '../models/Standing.js';
import { recalcAllStandings } from '../services/standingsService.js';
import { recalcPlayerStats } from '../services/playerStatsService.js';
import { emitToTournament, EVENTS } from '../socket/index.js';

/**
 * Public standings: grouped by group, each row joined to its team. Returned in
 * rank order so the client can render straight away.
 */
export const getStandings = asyncHandler(async (req, res) => {
  const groups = await Group.find({ tournamentId: req.tournament._id })
    .sort({ order: 1, name: 1 })
    .lean();

  const standings = await Standing.find({ tournamentId: req.tournament._id })
    .sort({ rank: 1 })
    .populate('teamId', 'name shortCode logo primaryColor')
    .lean();

  const byGroup = groups.map((g) => ({
    group: { _id: g._id, name: g.name, order: g.order },
    rows: standings.filter((s) => String(s.groupId) === String(g._id)),
  }));

  return sendSuccess(res, { data: { standings: byGroup } });
});

/** Force a full recalculation (admin maintenance / after manual edits). */
export const recalculateStandings = asyncHandler(async (req, res) => {
  const result = await recalcAllStandings(req.tournament._id);
  const playersUpdated = await recalcPlayerStats(req.tournament._id);
  emitToTournament(req.tournament._id, EVENTS.STANDINGS, { full: true });
  emitToTournament(req.tournament._id, EVENTS.STATS, { tournamentId: String(req.tournament._id) });
  return sendSuccess(res, {
    message: 'Standings recalculated',
    data: { groups: result.length, playersUpdated },
  });
});
