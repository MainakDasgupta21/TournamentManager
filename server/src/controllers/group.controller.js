import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Group } from '../models/Group.js';
import { Team } from '../models/Team.js';
import { Fixture } from '../models/Fixture.js';
import { Standing } from '../models/Standing.js';
import { recalcAllStandings } from '../services/standingsService.js';
import { emitToTournament, EVENTS } from '../socket/index.js';
import { FIXTURE_STAGE } from '@tms/shared/constants';

/**
 * Reject if any submitted team id does not belong to this tournament, so a
 * caller can never store foreign team references on `group.teams`.
 */
async function assertTeamsBelong(tournamentId, teamIds = []) {
  if (!teamIds.length) return;
  const unique = [...new Set(teamIds.map(String))];
  const count = await Team.countDocuments({ _id: { $in: unique }, tournamentId });
  if (count !== unique.length) {
    throw ApiError.badRequest('One or more teams do not belong to this tournament');
  }
}

export const createGroup = asyncHandler(async (req, res) => {
  const { name, teams = [] } = req.body;
  await assertTeamsBelong(req.tournament._id, teams);
  const order = await Group.countDocuments({ tournamentId: req.tournament._id });

  const group = await Group.create({
    tournamentId: req.tournament._id,
    name,
    teams,
    order,
  });

  if (teams.length) {
    await Team.updateMany(
      { _id: { $in: teams }, tournamentId: req.tournament._id },
      { $set: { groupId: group._id } }
    );
  }
  return sendCreated(res, { message: 'Group created', data: { group } });
});

export const listGroups = asyncHandler(async (req, res) => {
  const groups = await Group.find({ tournamentId: req.tournament._id })
    .sort({ order: 1, name: 1 })
    .populate('teams', 'name shortCode logo primaryColor seed')
    .lean();
  return sendSuccess(res, { data: { groups } });
});

export const updateGroup = asyncHandler(async (req, res) => {
  const group = await Group.findOne({
    _id: req.params.groupId,
    tournamentId: req.tournament._id,
  });
  if (!group) throw ApiError.notFound('Group not found');

  if (req.body.name !== undefined) group.name = req.body.name;

  // When the team set changes, re-point the affected teams' groupId so the two
  // sides of the relationship stay consistent.
  if (req.body.teams !== undefined) {
    await assertTeamsBelong(req.tournament._id, req.body.teams);
    const prev = group.teams.map(String);
    const next = req.body.teams.map(String);

    const removed = prev.filter((id) => !next.includes(id));
    const added = next.filter((id) => !prev.includes(id));

    if (removed.length) {
      await Team.updateMany(
        { _id: { $in: removed }, tournamentId: req.tournament._id, groupId: group._id },
        { $set: { groupId: null } }
      );
    }
    if (added.length) {
      // A team can only be in one group; detach it from any previous group.
      await Group.updateMany(
        { tournamentId: req.tournament._id, _id: { $ne: group._id } },
        { $pull: { teams: { $in: added } } }
      );
      await Team.updateMany(
        { _id: { $in: added }, tournamentId: req.tournament._id },
        { $set: { groupId: group._id } }
      );
    }
    group.teams = next;
  }

  await group.save();
  return sendSuccess(res, { message: 'Group updated', data: { group } });
});

export const deleteGroup = asyncHandler(async (req, res) => {
  const group = await Group.findOne({
    _id: req.params.groupId,
    tournamentId: req.tournament._id,
  });
  if (!group) throw ApiError.notFound('Group not found');

  await Team.updateMany({ groupId: group._id }, { $set: { groupId: null } });
  // Cascade: this group's fixtures and standing rows are meaningless without it
  // and would otherwise dangle with a now-invalid groupId.
  await Fixture.deleteMany({ tournamentId: req.tournament._id, groupId: group._id });
  await Standing.deleteMany({ tournamentId: req.tournament._id, groupId: group._id });
  await group.deleteOne();

  emitToTournament(req.tournament._id, EVENTS.STANDINGS, { full: true });
  return sendSuccess(res, { message: 'Group deleted' });
});

/**
 * Seeded snake draft: distribute teams across groups so seeding is balanced.
 * Round 1 fills groups left-to-right (seed 1 -> A, seed 2 -> B, ...), round 2
 * fills right-to-left, and so on. Uneven counts are fine — later groups simply
 * receive fewer teams.
 */
export const autoDistribute = asyncHandler(async (req, res) => {
  const { seededTeamIds, numberOfGroups, groupNames } = req.body;

  // Validate every seeded team belongs to this tournament.
  const teams = await Team.find({
    _id: { $in: seededTeamIds },
    tournamentId: req.tournament._id,
  }).lean();
  if (teams.length !== seededTeamIds.length) {
    throw ApiError.badRequest('One or more teams do not belong to this tournament');
  }

  const names =
    groupNames?.length
      ? groupNames
      : Array.from({ length: numberOfGroups }, (_, i) => `Group ${String.fromCharCode(65 + i)}`);
  const G = names.length;

  // Fresh start: remove existing groups & detach teams. The previous group
  // fixtures + standings reference the groups we are about to delete, so clear
  // them too rather than leaving them dangling with dead groupIds.
  await Group.deleteMany({ tournamentId: req.tournament._id });
  await Team.updateMany(
    { tournamentId: req.tournament._id },
    { $set: { groupId: null, seed: null } }
  );
  await Fixture.deleteMany({ tournamentId: req.tournament._id, stage: FIXTURE_STAGE.GROUP });
  await Standing.deleteMany({ tournamentId: req.tournament._id });

  // Create empty groups.
  const groups = await Group.insertMany(
    names.map((name, order) => ({ tournamentId: req.tournament._id, name, order, teams: [] }))
  );

  // Snake assignment.
  const buckets = Array.from({ length: G }, () => []);
  seededTeamIds.forEach((teamId, idx) => {
    const round = Math.floor(idx / G);
    const posInRound = idx % G;
    const groupIdx = round % 2 === 0 ? posInRound : G - 1 - posInRound;
    buckets[groupIdx].push({ teamId, seed: idx + 1 });
  });

  // Persist memberships + seeds.
  await Promise.all(
    groups.map(async (group, gi) => {
      const ids = buckets[gi].map((b) => b.teamId);
      group.teams = ids;
      await group.save();
      await Promise.all(
        buckets[gi].map((b) =>
          Team.findByIdAndUpdate(b.teamId, { $set: { groupId: group._id, seed: b.seed } })
        )
      );
    })
  );

  // Rebuild standings to a clean, fresh state for the new group layout.
  await recalcAllStandings(req.tournament._id);
  emitToTournament(req.tournament._id, EVENTS.STANDINGS, { full: true });

  const populated = await Group.find({ tournamentId: req.tournament._id })
    .sort({ order: 1 })
    .populate('teams', 'name shortCode logo primaryColor seed')
    .lean();

  return sendSuccess(res, {
    message: 'Teams distributed across groups',
    data: { groups: populated },
  });
});
