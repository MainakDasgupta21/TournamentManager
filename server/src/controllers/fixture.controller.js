import { asyncHandler } from '../utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { Fixture } from '../models/Fixture.js';
import { Group } from '../models/Group.js';
import { Tournament } from '../models/Tournament.js';
import { Player } from '../models/Player.js';
import { buildGroupFixtureSeeds } from '../services/roundRobin.js';
import {
  recalcAllStandings,
  recalcStandingsForFixture,
} from '../services/standingsService.js';
import { recalcPlayerStats } from '../services/playerStatsService.js';
import { advanceAfterResult } from '../services/knockoutService.js';
import { recalculateTournament } from '../services/recalcService.js';
import { recordAudit } from '../services/auditService.js';
import {
  deriveCricketInnings,
  deriveFootballGoals,
  deriveLiveTicker,
} from '../services/matchDerive.js';
import {
  emitToFixture,
  emitToTournament,
  EVENTS,
} from '../socket/index.js';
import {
  SPORTS,
  FIXTURE_STAGE,
  FIXTURE_STATUS,
  TOURNAMENT_STATUS,
  AUDIT_ENTITY,
  AUDIT_ACTION,
  FOOTBALL_FORMATION_PRESETS,
  normalizeFootballFormationSlots,
} from '@tms/shared/constants';

const ACTION_BY_OP = { add: AUDIT_ACTION.CREATE, edit: AUDIT_ACTION.UPDATE, delete: AUDIT_ACTION.DELETE };
const clone = (v) => (v == null ? null : JSON.parse(JSON.stringify(v)));
const id = (v) => (v == null ? null : String(v));

function formationPlayerIds(formation) {
  if (!formation?.slots?.length) return [];
  return [
    ...new Set(
      formation.slots
        .map((slot) => id(slot.playerId))
        .filter(Boolean)
    ),
  ];
}

function normalizeFootballFormation(formation) {
  if (!formation?.preset || !FOOTBALL_FORMATION_PRESETS[formation.preset]) return formation;
  return {
    preset: formation.preset,
    slots: normalizeFootballFormationSlots({
      preset: formation.preset,
      slots: formation.slots ?? [],
    }),
  };
}

function normalizeFormationBySide(formationBySide) {
  if (!formationBySide) return formationBySide;
  const out = {};
  if (formationBySide.teamA) out.teamA = normalizeFootballFormation(formationBySide.teamA);
  if (formationBySide.teamB) out.teamB = normalizeFootballFormation(formationBySide.teamB);
  return Object.keys(out).length ? out : undefined;
}

async function assertFootballFormationPlayers({ tournamentId, fixture, formationBySide }) {
  if (!formationBySide) return;
  const sideSpecs = [
    { key: 'teamA', teamId: fixture.teamA },
    { key: 'teamB', teamId: fixture.teamB },
  ];
  for (const side of sideSpecs) {
    const formation = formationBySide[side.key];
    if (!formation) continue;
    const ids = formationPlayerIds(formation);
    if (!ids.length) continue;
    const count = await Player.countDocuments({
      _id: { $in: ids },
      tournamentId,
      teamId: side.teamId,
    });
    if (count !== ids.length) {
      throw ApiError.badRequest(
        `Formation override for ${side.key} contains a player outside that team roster`
      );
    }
  }
}

/**
 * Generate round-robin group-stage fixtures for every group. Existing group
 * fixtures are only cleared when `overwrite` is true (guards against wiping
 * results by accident).
 */
export const generateGroupStage = asyncHandler(async (req, res) => {
  const { tournament } = req;
  const {
    doubleRoundRobin,
    startDate,
    daysBetweenRounds = 7,
    defaultVenue = '',
    overwrite = false,
  } = req.body ?? {};

  const groups = await Group.find({ tournamentId: tournament._id }).sort({ order: 1 });
  if (!groups.length) throw ApiError.badRequest('Create groups before generating fixtures');

  const existing = await Fixture.countDocuments({
    tournamentId: tournament._id,
    stage: FIXTURE_STAGE.GROUP,
  });
  if (existing > 0 && !overwrite) {
    throw ApiError.conflict('Group fixtures already exist. Pass overwrite:true to regenerate.');
  }
  if (overwrite) {
    await Fixture.deleteMany({ tournamentId: tournament._id, stage: FIXTURE_STAGE.GROUP });
  }

  const useDouble =
    typeof doubleRoundRobin === 'boolean'
      ? doubleRoundRobin
      : Boolean(tournament.groupSettings?.doubleRoundRobin);

  const docs = [];
  let globalMatchNumber = 1;
  const venue = defaultVenue || tournament.venues?.[0] || '';

  for (const group of groups) {
    if (group.teams.length < 2) continue; // a 1-team group has no fixtures
    const seeds = buildGroupFixtureSeeds({
      teamIds: group.teams.map((t) => String(t)),
      doubleRoundRobin: useDouble,
      startDate,
      daysBetweenRounds,
      venue,
    });
    for (const s of seeds) {
      docs.push({
        tournamentId: tournament._id,
        groupId: group._id,
        stage: FIXTURE_STAGE.GROUP,
        teamA: s.teamA,
        teamB: s.teamB,
        groupRound: s.groupRound,
        leg: s.leg,
        scheduledAt: s.scheduledAt,
        venue: s.venue,
        matchNumber: globalMatchNumber++,
        status: FIXTURE_STATUS.SCHEDULED,
      });
    }
  }

  const created = await Fixture.insertMany(docs);

  // Regeneration (overwrite) removes old completed fixtures; rebuild standings so
  // no stale points/NRR/GD rows survive after the new schedule is created.
  await recalcAllStandings(tournament._id);
  emitToTournament(tournament._id, EVENTS.STANDINGS, { full: true });

  // Move the tournament into the group stage if it was still in setup.
  if (tournament.status === TOURNAMENT_STATUS.SETUP) {
    tournament.status = TOURNAMENT_STATUS.GROUP_STAGE;
    await tournament.save();
  }

  return sendCreated(res, {
    message: `Generated ${created.length} group fixtures`,
    data: { count: created.length },
  });
});

/** Public, filterable fixture list. */
export const listFixtures = asyncHandler(async (req, res) => {
  const { groupId, teamId, stage, status, from, to } = req.query;
  const filter = { tournamentId: req.tournament._id };
  if (groupId) filter.groupId = groupId;
  if (stage) filter.stage = stage;
  if (status) filter.status = status;
  if (teamId) filter.$or = [{ teamA: teamId }, { teamB: teamId }];
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to) filter.scheduledAt.$lte = new Date(to);
  }

  const fixtures = await Fixture.find(filter)
    .sort({ scheduledAt: 1, matchNumber: 1 })
    .populate('teamA', 'name shortCode logo primaryColor')
    .populate('teamB', 'name shortCode logo primaryColor')
    .populate('winner', 'name shortCode')
    .lean();

  return sendSuccess(res, { data: { fixtures } });
});

export const getFixture = asyncHandler(async (req, res) => {
  const fixture = await Fixture.findById(req.params.fixtureId)
    .populate('teamA', 'name shortCode logo primaryColor')
    .populate('teamB', 'name shortCode logo primaryColor')
    .populate('winner', 'name shortCode')
    .lean();
  if (!fixture) throw ApiError.notFound('Fixture not found');
  return sendSuccess(res, { data: { fixture } });
});

/** Update schedule / venue / status (e.g. flip to "live"). */
export const updateFixture = asyncHandler(async (req, res) => {
  const fixture = await Fixture.findOne({
    _id: req.params.fixtureId,
    tournamentId: req.tournament._id,
  });
  if (!fixture) throw ApiError.notFound('Fixture not found');

  const prevStatus = fixture.status;
  const wasLiveToggle = req.body.status && req.body.status !== fixture.status;
  Object.assign(fixture, req.body);
  await fixture.save();

  if (wasLiveToggle) {
    emitToTournament(req.tournament._id, EVENTS.STATUS, {
      fixtureId: String(fixture._id),
      status: fixture.status,
    });
    emitToFixture(fixture._id, EVENTS.STATUS, {
      fixtureId: String(fixture._id),
      status: fixture.status,
    });
  }

  // Re-opening a completed match to live (Module 5B) is worth auditing.
  const reopened = prevStatus === FIXTURE_STATUS.COMPLETED && fixture.status === FIXTURE_STATUS.LIVE;
  await recordAudit({
    tournament: req.tournament,
    user: req.user,
    entityType: AUDIT_ENTITY.FIXTURE,
    entityId: fixture._id,
    action: reopened ? AUDIT_ACTION.REOPEN : AUDIT_ACTION.UPDATE,
    summary: reopened
      ? `Re-opened match #${fixture.matchNumber ?? ''} to live`
      : `Updated match #${fixture.matchNumber ?? ''}`,
    before: { status: prevStatus },
    after: { status: fixture.status, scheduledAt: fixture.scheduledAt, venue: fixture.venue },
  });

  return sendSuccess(res, { message: 'Fixture updated', data: { fixture } });
});

/** Pick the sport-appropriate result branch and resolve the winning team. */
function resolveResult(tournament, fixture, body) {
  const sport = tournament.sportType;
  const sportResult = sport === SPORTS.CRICKET ? body.cricket : body.football;
  if (!sportResult) {
    throw ApiError.badRequest(`Expected a "${sport}" result payload`);
  }

  const teamAId = String(fixture.teamA);
  const teamBId = String(fixture.teamB);
  const declaredWinner = sportResult.result?.winner ? String(sportResult.result.winner) : null;
  let winner = declaredWinner;

  if (sport === SPORTS.FOOTBALL) {
    const { goalsA, goalsB } = deriveFootballGoals(sportResult, fixture.teamA, fixture.teamB);
    const scoreWinner = goalsA === goalsB ? null : goalsA > goalsB ? teamAId : teamBId;
    const penalties = sportResult.penalties;

    if (scoreWinner) {
      if (declaredWinner && declaredWinner !== scoreWinner) {
        throw ApiError.badRequest('Declared winner does not match the goal score');
      }
      winner = scoreWinner;
    } else if (fixture.stage === FIXTURE_STAGE.GROUP) {
      if (declaredWinner) {
        throw ApiError.badRequest('Group-stage football draws cannot declare a winner');
      }
      winner = null;
    } else if (fixture.stage === FIXTURE_STAGE.KNOCKOUT && penalties) {
      if (penalties.teamA === penalties.teamB) {
        throw ApiError.badRequest('Penalty shootout cannot end level');
      }
      const penaltyWinner = penalties.teamA > penalties.teamB ? teamAId : teamBId;
      if (declaredWinner && declaredWinner !== penaltyWinner) {
        throw ApiError.badRequest('Declared winner does not match the penalty shootout');
      }
      winner = penaltyWinner;
    } else if (declaredWinner) {
      throw ApiError.badRequest('A tied football score requires penalties to decide the winner');
    }
  }

  if (sport === SPORTS.CRICKET) {
    const margin = sportResult.result?.margin;
    const noResult = margin === 'noResult';
    const innings = sportResult.innings ?? [];

    if (noResult && declaredWinner) {
      throw ApiError.badRequest('No-result cricket matches cannot declare a winner');
    }

    if (!noResult && innings.length) {
      let runsA = 0;
      let runsB = 0;
      for (const rawInn of innings) {
        const inn = deriveCricketInnings(rawInn);
        if (String(inn.battingTeam) === teamAId) runsA += Number(inn.runs ?? 0);
        else if (String(inn.battingTeam) === teamBId) runsB += Number(inn.runs ?? 0);
      }
      const scoreWinner = runsA === runsB ? null : runsA > runsB ? teamAId : teamBId;
      if (scoreWinner) {
        if (declaredWinner && declaredWinner !== scoreWinner) {
          throw ApiError.badRequest('Declared winner does not match cricket innings totals');
        }
        winner = scoreWinner;
      } else if (fixture.stage === FIXTURE_STAGE.GROUP && declaredWinner) {
        throw ApiError.badRequest('Group-stage tied cricket scores cannot declare a winner');
      }
    }
  }

  // Football knockout ties are decided on penalties.
  if (sport === SPORTS.FOOTBALL && !winner && fixture.stage === FIXTURE_STAGE.KNOCKOUT) {
    const pen = sportResult.penalties;
    if (pen) {
      if (pen.teamA > pen.teamB) winner = teamAId;
      else if (pen.teamB > pen.teamA) winner = teamBId;
    }
  }

  // Cricket knockout ties are broken by a Super Over (most runs in one over).
  if (sport === SPORTS.CRICKET && !winner && fixture.stage === FIXTURE_STAGE.KNOCKOUT) {
    const so = sportResult.superOver;
    if (so) {
      const ra = Number(so.teamA?.runs ?? 0);
      const rb = Number(so.teamB?.runs ?? 0);
      if (ra > rb) winner = teamAId;
      else if (rb > ra) winner = teamBId;
    }
  }

  // Validate the winner is actually one of the two teams.
  if (winner && ![teamAId, teamBId].includes(winner)) {
    throw ApiError.badRequest('Winner must be teamA or teamB');
  }

  // Knockout fixtures must produce a winner so the bracket can advance.
  if (fixture.stage === FIXTURE_STAGE.KNOCKOUT && !winner) {
    throw ApiError.badRequest('A knockout fixture must have a winner (use penalties / super over)');
  }

  return { sportResult, winner };
}

/**
 * For cricket, fold any ball-by-ball detail back into the aggregate innings
 * fields (runs/wickets/overs/extras/bowlingTeam) so the stored result is
 * internally consistent and the standings/summary code can read totals without
 * re-deriving. Granular `oversDetail` is preserved untouched.
 */
function normalizeForStorage(sport, sportResult, fixture) {
  if (sport !== SPORTS.CRICKET) return sportResult;
  const teamA = String(fixture.teamA);
  const teamB = String(fixture.teamB);
  const innings = (sportResult.innings ?? []).map((inn) => {
    const bowling = String(inn.battingTeam) === teamA ? teamB : teamA;
    const d = deriveCricketInnings(inn, bowling);
    return {
      ...inn,
      bowlingTeam: inn.bowlingTeam ?? bowling,
      runs: d.runs,
      wickets: d.wickets,
      overs: d.overs,
      extras: d.extras,
    };
  });
  return { ...sportResult, innings };
}

/**
 * Submit a final result. Recomputes standings (group) or advances the bracket
 * (knockout), refreshes cached player stats, then broadcasts over Socket.io.
 */
export const submitResult = asyncHandler(async (req, res) => {
  const fixture = await Fixture.findOne({
    _id: req.params.fixtureId,
    tournamentId: req.tournament._id,
  });
  if (!fixture) throw ApiError.notFound('Fixture not found');
  if (!fixture.teamA || !fixture.teamB) {
    throw ApiError.badRequest('Both teams must be assigned before entering a result');
  }

  const { sportResult: resolvedResult, winner } = resolveResult(req.tournament, fixture, req.body);
  let sportResult = resolvedResult;
  if (req.tournament.sportType === SPORTS.FOOTBALL) {
    const normalizedFormation = normalizeFormationBySide(sportResult.formation);
    sportResult = normalizedFormation ? { ...sportResult, formation: normalizedFormation } : sportResult;
    await assertFootballFormationPlayers({
      tournamentId: req.tournament._id,
      fixture,
      formationBySide: normalizedFormation,
    });
  }

  const beforeResult = clone(fixture.result);
  const wasCompleted = fixture.status === FIXTURE_STATUS.COMPLETED;

  fixture.result = normalizeForStorage(req.tournament.sportType, sportResult, fixture);
  fixture.winner = winner || null;
  fixture.status = FIXTURE_STATUS.COMPLETED;
  fixture.liveState = null;
  await fixture.save();

  await recordAudit({
    tournament: req.tournament,
    user: req.user,
    entityType: AUDIT_ENTITY.RESULT,
    entityId: fixture._id,
    action: wasCompleted ? AUDIT_ACTION.UPDATE : AUDIT_ACTION.CREATE,
    summary: `${wasCompleted ? 'Edited' : 'Recorded'} result for match #${fixture.matchNumber ?? ''}`,
    before: beforeResult,
    after: fixture.result,
  });

  const broadcast = { fixtureId: String(fixture._id), tournamentId: String(req.tournament._id) };
  emitToFixture(fixture._id, EVENTS.RESULT, broadcast);
  emitToTournament(req.tournament._id, EVENTS.RESULT, broadcast);

  let requiresConfirm = false;
  let affected = [];
  let didFullRecalc = false;

  // Group stage -> recompute and push standings. Knockout -> advance bracket.
  if (fixture.stage === FIXTURE_STAGE.GROUP) {
    const standings = await recalcStandingsForFixture(fixture);
    if (standings) {
      emitToTournament(req.tournament._id, EVENTS.STANDINGS, standings);
    }
  } else if (!wasCompleted) {
    // First time this knockout match is decided: advance the winner forward.
    const loser =
      winner && String(winner) === String(fixture.teamA)
        ? String(fixture.teamB)
        : String(fixture.teamA);
    const bracket = await advanceAfterResult(req.tournament, fixture, winner, loser);
    if (bracket) emitToTournament(req.tournament._id, EVENTS.BRACKET, { tournamentId: String(req.tournament._id) });
  } else {
    // Re-submitting an already-played knockout result: reconcile the whole
    // bracket from current results. If a later round was already decided with a
    // now-incorrect team, the cascade asks for confirmation before resetting it.
    const recalc = await recalculateTournament(req.tournament._id, {
      confirm: Boolean(req.body.confirm),
    });
    requiresConfirm = Boolean(recalc.requiresConfirm);
    affected = recalc.affected ?? [];
    didFullRecalc = true; // the cascade already rebuilt every player's stats
    if (!requiresConfirm) {
      emitToTournament(req.tournament._id, EVENTS.BRACKET, { tournamentId: String(req.tournament._id) });
    }
  }

  // Rebuild cached player aggregate stats from granular events (Module 5/7B).
  // A single result only moves the two competing teams' players, so scope the
  // recompute to them — unless the knockout re-submit cascade above already
  // rebuilt every player in the tournament.
  if (!didFullRecalc) {
    await recalcPlayerStats(req.tournament._id, { teamIds: [fixture.teamA, fixture.teamB] });
  }
  emitToTournament(req.tournament._id, EVENTS.STATS, { tournamentId: String(req.tournament._id) });

  const populated = await Fixture.findById(fixture._id)
    .populate('teamA', 'name shortCode logo primaryColor')
    .populate('teamB', 'name shortCode logo primaryColor')
    .populate('winner', 'name shortCode')
    .lean();

  return sendSuccess(res, {
    message: requiresConfirm
      ? 'Result saved; confirmation required to reset downstream matches'
      : 'Result recorded',
    data: { fixture: populated, requiresConfirm, affected },
  });
});

/**
 * Push an incremental live snapshot. Persists the snapshot and broadcasts it to
 * everyone watching the match / tournament so the ticker updates without reload.
 */
export const liveUpdate = asyncHandler(async (req, res) => {
  const fixture = await Fixture.findOne({
    _id: req.params.fixtureId,
    tournamentId: req.tournament._id,
  });
  if (!fixture) throw ApiError.notFound('Fixture not found');

  const sport = req.tournament.sportType;
  let snapshot = sport === SPORTS.CRICKET ? req.body.cricket : req.body.football;
  if (!snapshot) throw ApiError.badRequest(`Expected a "${sport}" live payload`);
  if (sport === SPORTS.FOOTBALL) {
    const normalizedFormation = normalizeFormationBySide(snapshot.formation);
    snapshot = normalizedFormation ? { ...snapshot, formation: normalizedFormation } : snapshot;
    await assertFootballFormationPlayers({
      tournamentId: req.tournament._id,
      fixture,
      formationBySide: normalizedFormation,
    });
  }

  // Auto-flip to live on first update.
  if (fixture.status !== FIXTURE_STATUS.LIVE) fixture.status = FIXTURE_STATUS.LIVE;

  // Persist the full (possibly granular) in-progress state, plus flat ticker
  // fields derived from it so the public marquee renders without re-deriving.
  const ticker = deriveLiveTicker(sport, snapshot, fixture.teamA, fixture.teamB);
  fixture.liveState = { ...snapshot, ...ticker, sport, updatedAt: new Date() };
  await fixture.save();

  const payload = {
    fixtureId: String(fixture._id),
    tournamentId: String(req.tournament._id),
    status: fixture.status,
    liveState: fixture.liveState,
  };
  emitToFixture(fixture._id, EVENTS.LIVE_UPDATE, payload);
  emitToTournament(req.tournament._id, EVENTS.LIVE_UPDATE, payload);

  return sendSuccess(res, { message: 'Live update pushed', data: { liveState: fixture.liveState } });
});

/**
 * Apply a single granular event mutation to a fixture's stored result (Module
 * 5B): add/edit/delete one cricket ball or over, or one football goal/card/sub
 * — even on a completed match. The full result is re-validated implicitly by
 * re-folding aggregates, the winner is re-resolved from the declared result,
 * the change is audited, and the standings/player-stat cascade runs.
 */
export const editFixtureEvents = asyncHandler(async (req, res) => {
  const fixture = await Fixture.findOne({
    _id: req.params.fixtureId,
    tournamentId: req.tournament._id,
  });
  if (!fixture) throw ApiError.notFound('Fixture not found');
  if (!fixture.teamA || !fixture.teamB) {
    throw ApiError.badRequest('Both teams must be assigned before editing events');
  }

  const sport = req.tournament.sportType;
  const { target, op, inningsIndex = 0, overIndex, ballIndex, index } = req.body;
  const before = clone(fixture.result);

  // Mutable working copy (preserving declared result/toss/MOTM meta).
  const result = before
    ? clone(before)
    : sport === SPORTS.CRICKET
      ? { innings: [], result: {} }
      : { goals: [], cards: [], substitutions: [], result: {} };

  if (sport === SPORTS.CRICKET) {
    if (!['cricketBall', 'cricketOver'].includes(target)) {
      throw ApiError.badRequest('Invalid target for a cricket fixture');
    }
    if (!Array.isArray(result.innings)) result.innings = [];
    const inn = result.innings[inningsIndex];
    if (!inn) throw ApiError.badRequest('Innings does not exist (submit a result first)');
    if (!Array.isArray(inn.oversDetail)) inn.oversDetail = [];

    if (target === 'cricketOver') {
      if (op === 'add') {
        inn.oversDetail.push(req.body.over ?? { overNumber: inn.oversDetail.length, bowler: null, balls: [] });
      } else {
        if (inn.oversDetail[overIndex] == null) throw ApiError.badRequest('Over not found');
        if (op === 'edit') inn.oversDetail[overIndex] = req.body.over;
        else inn.oversDetail.splice(overIndex, 1);
      }
    } else {
      const over = inn.oversDetail[overIndex];
      if (!over) throw ApiError.badRequest('Over not found');
      if (!Array.isArray(over.balls)) over.balls = [];
      if (op === 'add') {
        if (!req.body.ball) throw ApiError.badRequest('Missing ball payload');
        if (ballIndex == null || ballIndex >= over.balls.length) over.balls.push(req.body.ball);
        else over.balls.splice(ballIndex, 0, req.body.ball);
      } else {
        if (over.balls[ballIndex] == null) throw ApiError.badRequest('Ball not found');
        if (op === 'edit') {
          if (!req.body.ball) throw ApiError.badRequest('Missing ball payload');
          over.balls[ballIndex] = req.body.ball;
        } else {
          over.balls.splice(ballIndex, 1);
        }
      }
    }
  } else {
    const arrKey =
      target === 'goal' ? 'goals' : target === 'card' ? 'cards' : target === 'substitution' ? 'substitutions' : null;
    if (!arrKey) throw ApiError.badRequest('Invalid target for a football fixture');
    if (!Array.isArray(result[arrKey])) result[arrKey] = [];
    const value = req.body.goal ?? req.body.card ?? req.body.sub;

    if (op === 'add') {
      if (!value) throw ApiError.badRequest('Missing event payload');
      result[arrKey].push(value);
    } else {
      if (result[arrKey][index] == null) throw ApiError.badRequest('Event not found');
      if (op === 'edit') {
        if (!value) throw ApiError.badRequest('Missing event payload');
        result[arrKey][index] = value;
      } else {
        result[arrKey].splice(index, 1);
      }
    }
  }

  if (sport === SPORTS.FOOTBALL && result.formation) {
    result.formation = normalizeFormationBySide(result.formation);
  }

  // Re-fold aggregates + re-resolve winner from the (unchanged) declared result.
  const body = sport === SPORTS.CRICKET ? { cricket: result } : { football: result };
  const { sportResult, winner } = resolveResult(req.tournament, fixture, body);
  fixture.result = normalizeForStorage(sport, sportResult, fixture);
  fixture.winner = winner || null;
  if (fixture.status === FIXTURE_STATUS.SCHEDULED) fixture.status = FIXTURE_STATUS.COMPLETED;
  await fixture.save();

  await recordAudit({
    tournament: req.tournament,
    user: req.user,
    entityType: AUDIT_ENTITY.EVENT,
    entityId: fixture._id,
    action: ACTION_BY_OP[op],
    summary: `${op} ${target} on match #${fixture.matchNumber ?? ''}`,
    before,
    after: fixture.result,
    meta: { target, op, inningsIndex, overIndex, ballIndex, index },
  });

  // Cascade. Editing events never changes the *declared* winner, so the bracket
  // confirm flow is unnecessary here; standings + player stats are rebuilt.
  if (fixture.groupId) {
    const standings = await recalcStandingsForFixture(fixture);
    if (standings) emitToTournament(req.tournament._id, EVENTS.STANDINGS, standings);
  }
  // Editing one fixture's events only affects its two teams' players.
  await recalcPlayerStats(req.tournament._id, { teamIds: [fixture.teamA, fixture.teamB] });
  emitToTournament(req.tournament._id, EVENTS.STATS, { tournamentId: String(req.tournament._id) });

  const broadcast = { fixtureId: String(fixture._id), tournamentId: String(req.tournament._id) };
  emitToFixture(fixture._id, EVENTS.RESULT, broadcast);
  emitToTournament(req.tournament._id, EVENTS.RESULT, broadcast);

  const populated = await Fixture.findById(fixture._id)
    .populate('teamA', 'name shortCode logo primaryColor')
    .populate('teamB', 'name shortCode logo primaryColor')
    .populate('winner', 'name shortCode')
    .lean();

  return sendSuccess(res, { message: 'Event updated', data: { fixture: populated } });
});

export { Tournament };
