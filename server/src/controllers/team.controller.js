import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Team } from '../models/Team.js';
import { Group } from '../models/Group.js';
import { Player } from '../models/Player.js';
import { Fixture } from '../models/Fixture.js';
import {
  SPORTS,
  CRICKET_ROLES,
  FOOTBALL_POSITIONS,
} from '@tms/shared/constants';

/** Roles valid for the tournament's sport. */
function allowedRoles(sport) {
  return sport === SPORTS.CRICKET ? CRICKET_ROLES : FOOTBALL_POSITIONS;
}

async function syncGroupMembership(tournamentId, teamId, newGroupId, oldGroupId) {
  if (String(newGroupId ?? '') === String(oldGroupId ?? '')) return;
  if (oldGroupId) {
    await Group.findByIdAndUpdate(oldGroupId, { $pull: { teams: teamId } });
  }
  if (newGroupId) {
    await Group.findByIdAndUpdate(newGroupId, { $addToSet: { teams: teamId } });
  }
}

export const createTeam = asyncHandler(async (req, res) => {
  const { tournament } = req;
  const { groupId } = req.body;

  if (groupId) {
    const group = await Group.findOne({ _id: groupId, tournamentId: tournament._id });
    if (!group) throw ApiError.badRequest('Group does not belong to this tournament');
  }

  const team = await Team.create({ ...req.body, tournamentId: tournament._id });
  if (groupId) await syncGroupMembership(tournament._id, team._id, groupId, null);

  return sendCreated(res, { message: 'Team created', data: { team } });
});

export const listTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({ tournamentId: req.tournament._id })
    .sort({ seed: 1, name: 1 })
    .lean();
  return sendSuccess(res, { data: { teams } });
});

export const getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findOne({
    _id: req.params.teamId,
    tournamentId: req.tournament._id,
  }).lean();
  if (!team) throw ApiError.notFound('Team not found');

  const [players, fixtures] = await Promise.all([
    Player.find({ teamId: team._id }).sort({ jerseyNumber: 1, name: 1 }).lean(),
    Fixture.find({
      tournamentId: req.tournament._id,
      $or: [{ teamA: team._id }, { teamB: team._id }],
    })
      .sort({ scheduledAt: 1, matchNumber: 1 })
      .lean(),
  ]);

  return sendSuccess(res, { data: { team, players, fixtures } });
});

export const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findOne({
    _id: req.params.teamId,
    tournamentId: req.tournament._id,
  });
  if (!team) throw ApiError.notFound('Team not found');

  const oldGroupId = team.groupId;
  if (req.body.groupId !== undefined && req.body.groupId) {
    const group = await Group.findOne({
      _id: req.body.groupId,
      tournamentId: req.tournament._id,
    });
    if (!group) throw ApiError.badRequest('Group does not belong to this tournament');
  }

  Object.assign(team, req.body);
  await team.save();

  if (req.body.groupId !== undefined) {
    await syncGroupMembership(req.tournament._id, team._id, team.groupId, oldGroupId);
  }

  return sendSuccess(res, { message: 'Team updated', data: { team } });
});

export const deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findOne({
    _id: req.params.teamId,
    tournamentId: req.tournament._id,
  });
  if (!team) throw ApiError.notFound('Team not found');

  if (team.groupId) await Group.findByIdAndUpdate(team.groupId, { $pull: { teams: team._id } });
  await Player.deleteMany({ teamId: team._id });
  await team.deleteOne();

  return sendSuccess(res, { message: 'Team deleted' });
});

/* ------------------------------ Players ------------------------------ */

export const addPlayer = asyncHandler(async (req, res) => {
  const team = await Team.findOne({
    _id: req.params.teamId,
    tournamentId: req.tournament._id,
  });
  if (!team) throw ApiError.notFound('Team not found');

  const { role } = req.body;
  if (role && !allowedRoles(req.tournament.sportType).includes(role)) {
    throw ApiError.badRequest(
      `Invalid role for ${req.tournament.sportType}. Allowed: ${allowedRoles(
        req.tournament.sportType
      ).join(', ')}`
    );
  }

  const player = await Player.create({
    ...req.body,
    teamId: team._id,
    tournamentId: req.tournament._id,
  });
  return sendCreated(res, { message: 'Player added', data: { player } });
});

export const updatePlayer = asyncHandler(async (req, res) => {
  if (req.body.role && !allowedRoles(req.tournament.sportType).includes(req.body.role)) {
    throw ApiError.badRequest(`Invalid role for ${req.tournament.sportType}`);
  }
  const player = await Player.findOneAndUpdate(
    { _id: req.params.playerId, tournamentId: req.tournament._id },
    { $set: req.body },
    { new: true }
  );
  if (!player) throw ApiError.notFound('Player not found');
  return sendSuccess(res, { message: 'Player updated', data: { player } });
});

export const deletePlayer = asyncHandler(async (req, res) => {
  const player = await Player.findOneAndDelete({
    _id: req.params.playerId,
    tournamentId: req.tournament._id,
  });
  if (!player) throw ApiError.notFound('Player not found');
  return sendSuccess(res, { message: 'Player removed' });
});
