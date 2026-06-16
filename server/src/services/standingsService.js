import { Tournament } from '../models/Tournament.js';
import { Group } from '../models/Group.js';
import { Fixture } from '../models/Fixture.js';
import { Standing } from '../models/Standing.js';
import { computeGroupStandings } from './standings.js';
import { FIXTURE_STAGE } from '@tms/shared/constants';

/**
 * Recompute and persist standings for one group. Returns the ranked rows.
 * Idempotent: derived purely from the group's completed fixtures + pointsConfig.
 */
export async function recalcGroupStandings(tournament, group) {
  const teamIds = group.teams.map((t) => String(t));
  const fixtures = await Fixture.find({
    tournamentId: tournament._id,
    groupId: group._id,
    stage: FIXTURE_STAGE.GROUP,
  }).lean();

  const rows = computeGroupStandings({
    sport: tournament.sportType,
    pointsConfig: tournament.pointsConfig,
    teamIds,
    fixtures,
  });

  // Upsert each row (one DB round-trip per team; group sizes are small).
  await Promise.all(
    rows.map((row) =>
      Standing.findOneAndUpdate(
        { tournamentId: tournament._id, groupId: group._id, teamId: row.teamId },
        { $set: { ...row, tournamentId: tournament._id, groupId: group._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  // Drop stale rows for teams no longer in the group.
  await Standing.deleteMany({
    tournamentId: tournament._id,
    groupId: group._id,
    teamId: { $nin: rows.map((r) => r.teamId) },
  });

  return rows;
}

/** Recompute standings for every group in a tournament. */
export async function recalcAllStandings(tournamentId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return [];
  const groups = await Group.find({ tournamentId }).sort({ order: 1, name: 1 });
  const result = [];
  for (const group of groups) {
    // eslint-disable-next-line no-await-in-loop -- groups are few; keep ordering
    const rows = await recalcGroupStandings(tournament, group);
    result.push({ groupId: String(group._id), rows });
  }
  return result;
}

/**
 * Recompute standings for the single group a fixture belongs to (used after a
 * result is entered) and return the fresh rows for broadcasting.
 */
export async function recalcStandingsForFixture(fixture) {
  if (!fixture.groupId) return null;
  const tournament = await Tournament.findById(fixture.tournamentId);
  const group = await Group.findById(fixture.groupId);
  if (!tournament || !group) return null;
  const rows = await recalcGroupStandings(tournament, group);
  return { groupId: String(group._id), rows };
}
