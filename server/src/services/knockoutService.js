import { ApiError } from '../utils/ApiError.js';
import { Group } from '../models/Group.js';
import { Team } from '../models/Team.js';
import { Standing } from '../models/Standing.js';
import { Fixture } from '../models/Fixture.js';
import { KnockoutBracket } from '../models/KnockoutBracket.js';
import { collectQualifiers, generateBracket, generatePlayoffBracket, computeAdvancement } from './knockout.js';
import { recalcAllStandings } from './standingsService.js';
import { FIXTURE_STAGE, FIXTURE_STATUS, TOURNAMENT_STATUS, SPORTS } from '@tms/shared/constants';

/** Derive a short label ("A") from a group name ("Group A"). */
function shortLabelFor(name, index) {
  const m = /group\s+(.+)/i.exec(name);
  if (m) return m[1].trim().toUpperCase();
  return name?.slice(0, 3).toUpperCase() || String.fromCharCode(65 + index);
}

/**
 * Build per-group ranked team lists from persisted standings (fresh recalc).
 * Also returns each team's standing row so callers can rank qualifiers across
 * groups (needed for IPL-style playoffs, where the field is the overall top 4).
 */
async function buildRankedGroups(tournament) {
  await recalcAllStandings(tournament._id);
  const groups = await Group.find({ tournamentId: tournament._id }).sort({ order: 1, name: 1 });

  // Fetch every group's standings in one query (rank-ordered) and bucket by
  // group in memory, rather than issuing one query per group inside the loop.
  const allStandings = await Standing.find({
    tournamentId: tournament._id,
    groupId: { $in: groups.map((g) => g._id) },
  })
    .sort({ rank: 1 })
    .lean();

  const standingsByGroup = new Map();
  const standingByTeam = new Map();
  for (const s of allStandings) {
    const key = String(s.groupId);
    if (!standingsByGroup.has(key)) standingsByGroup.set(key, []);
    standingsByGroup.get(key).push(s);
    standingByTeam.set(String(s.teamId), s);
  }

  const ranked = [];
  for (const group of groups) {
    const standings = standingsByGroup.get(String(group._id)) ?? [];
    const rankedTeamIds = standings.length
      ? standings.map((s) => String(s.teamId))
      : group.teams.map((t) => String(t)); // pre-match fallback: group order

    ranked.push({
      id: String(group._id),
      shortLabel: shortLabelFor(group.name, ranked.length),
      rankedTeamIds,
    });
  }
  return { groups: ranked, standingByTeam };
}

/**
 * Rank qualifiers by overall league strength (points, then the sport's primary
 * differential, then a secondary metric). Used to pick the playoff top four when
 * qualifiers were collected position-first across multiple groups.
 */
function rankQualifiersGlobally(qualifiers, standingByTeam, sport) {
  const primary = sport === SPORTS.CRICKET ? 'netRunRate' : 'goalDifference';
  const secondary = sport === SPORTS.CRICKET ? 'won' : 'goalsFor';
  const metric = (teamId, key) => standingByTeam.get(String(teamId))?.[key] ?? 0;
  return [...qualifiers].sort((x, y) => {
    const pts = metric(y.teamId, 'points') - metric(x.teamId, 'points');
    if (pts !== 0) return pts;
    const diff = metric(y.teamId, primary) - metric(x.teamId, primary);
    if (diff !== 0) return diff;
    return metric(y.teamId, secondary) - metric(x.teamId, secondary);
  });
}

/**
 * Generate (or regenerate) the knockout bracket and its fixtures. Refuses to
 * run if a locked bracket already exists.
 */
export async function generateAndPersist(tournament, options = {}) {
  const existing = await KnockoutBracket.findOne({ tournamentId: tournament._id });
  if (existing?.locked) {
    throw ApiError.conflict('Knockout bracket is locked and cannot be regenerated');
  }

  const format = options.format === 'playoff' ? 'playoff' : 'single-elimination';
  // Playoffs always use the top four overall; default the per-group cut to 4 so
  // a single league group qualifies its top four.
  const qualifiersPerGroup =
    format === 'playoff'
      ? (options.qualifiersPerGroup ?? tournament.groupSettings?.qualifiersPerGroup ?? 4)
      : (options.qualifiersPerGroup ?? tournament.groupSettings?.qualifiersPerGroup ?? 2);

  const { groups, standingByTeam } = await buildRankedGroups(tournament);
  if (!groups.length) throw ApiError.badRequest('No groups to qualify teams from');

  const orderedQualifiers = collectQualifiers(groups, qualifiersPerGroup);
  if (orderedQualifiers.length < 2) {
    throw ApiError.badRequest('Not enough qualifiers to build a bracket');
  }

  let built;
  if (format === 'playoff') {
    if (orderedQualifiers.length < 4) {
      throw ApiError.badRequest(
        'IPL-style playoffs need at least 4 qualified teams — use a single group or raise qualifiers per group'
      );
    }
    // collectQualifiers orders position-first across groups (A1, B1, C1, D1, ...),
    // which is NOT overall strength when there are multiple groups. The playoff
    // field must be the league's top four, so rank globally before slicing.
    const top4 =
      groups.length > 1
        ? rankQualifiersGlobally(orderedQualifiers, standingByTeam, tournament.sportType).slice(0, 4)
        : orderedQualifiers.slice(0, 4);
    built = generatePlayoffBracket(top4);
  } else {
    built = generateBracket(orderedQualifiers, {
      thirdPlacePlayoff: Boolean(options.thirdPlacePlayoff),
    });
  }

  // Clear any previous (unlocked) bracket + knockout fixtures.
  await KnockoutBracket.deleteMany({ tournamentId: tournament._id });
  await Fixture.deleteMany({ tournamentId: tournament._id, stage: FIXTURE_STAGE.KNOCKOUT });

  const startDate = options.startDate ? new Date(options.startDate) : null;
  const daysBetweenRounds = options.daysBetweenRounds ?? 3;
  const venue = options.defaultVenue || tournament.venues?.[0] || '';

  // Create a fixture for every non-bye matchup (teams may still be unresolved;
  // they are filled in as feeders complete). Link fixtureId back onto matchups.
  let matchNumber = 1;
  for (let ri = 0; ri < built.rounds.length; ri += 1) {
    const round = built.rounds[ri];
    for (let mi = 0; mi < round.matchups.length; mi += 1) {
      const m = round.matchups[mi];
      if (m.isBye) continue;

      let scheduledAt = null;
      if (startDate) {
        scheduledAt = new Date(startDate);
        scheduledAt.setDate(startDate.getDate() + ri * daysBetweenRounds);
      }

      // eslint-disable-next-line no-await-in-loop
      const fixture = await Fixture.create({
        tournamentId: tournament._id,
        groupId: null,
        stage: FIXTURE_STAGE.KNOCKOUT,
        roundIndex: ri,
        matchupIndex: mi,
        roundName: m.matchupName || round.roundName,
        teamA: m.slotA,
        teamB: m.slotB,
        placeholderA: m.slotALabel,
        placeholderB: m.slotBLabel,
        scheduledAt,
        venue,
        matchNumber: matchNumber++,
        status: FIXTURE_STATUS.SCHEDULED,
      });
      m.fixtureId = fixture._id;
    }
  }

  const bracket = await KnockoutBracket.create({
    tournamentId: tournament._id,
    rounds: built.rounds,
    format,
    thirdPlacePlayoff: built.thirdPlacePlayoff,
    locked: false,
  });

  tournament.status = TOURNAMENT_STATUS.KNOCKOUT_STAGE;
  tournament.knockoutLocked = false;
  await tournament.save();

  return bracket;
}

export async function getBracket(tournamentId) {
  return KnockoutBracket.findOne({ tournamentId }).lean();
}

/** Manually reassign a slot on an unlocked bracket (and sync its fixture). */
export async function applyAdjustment(tournament, { roundIndex, matchupIndex, slotA, slotB }) {
  const bracket = await KnockoutBracket.findOne({ tournamentId: tournament._id });
  if (!bracket) throw ApiError.notFound('No bracket to adjust');
  if (bracket.locked) throw ApiError.conflict('Bracket is locked');

  const matchup = bracket.rounds?.[roundIndex]?.matchups?.[matchupIndex];
  if (!matchup) throw ApiError.badRequest('Invalid round/matchup index');

  const setSlot = async (slot, teamId) => {
    if (teamId === undefined) return;
    if (teamId) {
      // Never assign a team that isn't part of this tournament.
      const team = await Team.findOne({ _id: teamId, tournamentId: tournament._id }).lean();
      if (!team) throw ApiError.badRequest('Team does not belong to this tournament');
      matchup[`slot${slot}`] = teamId;
      matchup[`slot${slot}Label`] = team.shortCode ?? matchup[`slot${slot}Label`];
    } else {
      matchup[`slot${slot}`] = teamId; // null clears the slot
    }
    if (matchup.fixtureId) {
      await Fixture.findByIdAndUpdate(matchup.fixtureId, {
        $set: { [slot === 'A' ? 'teamA' : 'teamB']: teamId || null },
      });
    }
  };

  await setSlot('A', slotA);
  await setSlot('B', slotB);

  bracket.markModified('rounds');
  await bracket.save();
  return bracket;
}

export async function lockBracket(tournament) {
  const bracket = await KnockoutBracket.findOne({ tournamentId: tournament._id });
  if (!bracket) throw ApiError.notFound('No bracket to lock');
  bracket.locked = true;
  await bracket.save();
  tournament.knockoutLocked = true;
  await tournament.save();
  return bracket;
}

/**
 * After a knockout result, advance the winner (and route the loser to the
 * third-place match if configured). Updates both the bracket slots and the
 * downstream fixtures' team assignments.
 */
export async function advanceAfterResult(tournament, fixture, winnerId, loserId) {
  const bracket = await KnockoutBracket.findOne({ tournamentId: tournament._id });
  if (!bracket) return null;

  const edits = computeAdvancement(
    bracket,
    fixture.roundIndex,
    fixture.matchupIndex,
    winnerId,
    loserId
  );

  for (const edit of edits) {
    const dest = bracket.rounds?.[edit.roundIndex]?.matchups?.[edit.matchupIndex];
    if (!dest) continue;
    dest[`slot${edit.slot}`] = edit.teamId;
    dest[`slot${edit.slot}Label`] = edit.label || dest[`slot${edit.slot}Label`];

    // Sync the downstream fixture's team slot so it becomes playable.
    if (dest.fixtureId) {
      // eslint-disable-next-line no-await-in-loop
      await Fixture.findByIdAndUpdate(dest.fixtureId, {
        $set: {
          [edit.slot === 'A' ? 'teamA' : 'teamB']: edit.teamId,
          [edit.slot === 'A' ? 'placeholderA' : 'placeholderB']: edit.label || '',
        },
      });
    }
  }

  bracket.markModified('rounds');
  await bracket.save();

  // If the final just finished, mark the tournament complete.
  const matchup = bracket.rounds?.[fixture.roundIndex]?.matchups?.[fixture.matchupIndex];
  if (matchup && !matchup.winnerAdvancesTo && !matchup.isThirdPlace) {
    tournament.status = TOURNAMENT_STATUS.COMPLETED;
    await tournament.save();
  }

  return bracket;
}
