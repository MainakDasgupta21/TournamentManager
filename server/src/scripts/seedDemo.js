/**
 * Demo data seeder.
 *
 * Creates a self-contained, *internally consistent* showcase dataset so a fresh
 * clone shows a populated, explorable app instead of empty screens. Rather than
 * hand-writing standings/brackets (which rot the moment the engines change),
 * this drives the **real services** end-to-end:
 *   - group fixtures via the round-robin generator,
 *   - results written in the same shape the result controller stores,
 *   - knockout via `generateAndPersist` + `advanceAfterResult`,
 *   - the full `recalculateTournament` cascade to derive standings + stats.
 *
 * It produces three tournaments to exercise every UI state:
 *   1. "Riverside Premier Cup"  (football) — COMPLETED: full groups + knockout
 *      with a third-place playoff, a champion, and Player of the Tournament.
 *   2. "Summer Sixes Trophy"    (cricket)  — IN PROGRESS: most group games
 *      played (ball-by-ball, so batting/bowling leaderboards populate), a few
 *      still scheduled, no knockout yet.
 *   3. "City Champions League"  (football) — SETUP: teams + groups, no fixtures,
 *      to show the onboarding/empty state.
 *
 * Idempotent: every run wipes and recreates only the demo organiser's data
 * (scoped by `createdBy`), so it never touches real tournaments.
 *
 * Run with: `npm run seed:demo` (from server/) or `npm run seed:demo` (root).
 */
import { connectDB, disconnectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Tournament } from '../models/Tournament.js';
import { Group } from '../models/Group.js';
import { Team } from '../models/Team.js';
import { Player } from '../models/Player.js';
import { Fixture } from '../models/Fixture.js';
import { Standing } from '../models/Standing.js';
import { KnockoutBracket } from '../models/KnockoutBracket.js';
import { buildGroupFixtureSeeds } from '../services/roundRobin.js';
import { deriveCricketInnings } from '../services/matchDerive.js';
import { generateAndPersist, advanceAfterResult, lockBracket } from '../services/knockoutService.js';
import { recalculateTournament } from '../services/recalcService.js';
import {
  SPORTS,
  USER_ROLES,
  APPROVAL_STATUS,
  TOURNAMENT_STATUS,
  FIXTURE_STAGE,
  FIXTURE_STATUS,
  DEFAULT_POINTS_CONFIG,
} from '@tms/shared/constants';

/* --------------------------- deterministic RNG --------------------------- */
// A tiny seeded PRNG (mulberry32) keeps every run reproducible so the demo
// looks the same each time and is easy to reason about.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const randInt = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (rng, arr) => (arr.length ? arr[Math.floor(rng() * arr.length)] : null);
const sid = (v) => String(v);

/* ------------------------------ name pools ------------------------------ */
const FIRST_NAMES = [
  'Arjun', 'Liam', 'Mateo', 'Noah', 'Kai', 'Diego', 'Omar', 'Yuki', 'Leo', 'Ravi',
  'Marco', 'Sami', 'Ethan', 'Hugo', 'Ivan', 'Tariq', 'Felix', 'Jonas', 'Aiden', 'Luca',
  'Rohan', 'Pedro', 'Mason', 'Ali', 'Nikolai', 'Theo', 'Caleb', 'Idris', 'Bruno', 'Hassan',
];
const LAST_NAMES = [
  'Sharma', 'Walker', 'Silva', 'Khan', 'Tan', 'Okafor', 'Rossi', 'Mendez', 'Novak', 'Haig',
  'Ito', 'Costa', 'Patel', 'Lund', 'Reyes', 'Abebe', 'Dubois', 'Park', 'Singh', 'Moretti',
];

/* ----------------------------- result builders ---------------------------- */

/**
 * Football match events. Picks goal counts, then attributes each goal to a
 * non-keeper scorer + (sometimes) an assister, and sprinkles a few cards. The
 * winner is derived from the goal tally; pass `decisive` to forbid a draw
 * (required for knockout fixtures).
 */
function makeFootballResult({ teamAId, teamBId, rosterA, rosterB, rng, decisive }) {
  let ga = randInt(rng, 0, 3);
  let gb = randInt(rng, 0, 3);
  if (decisive && ga === gb) ga += 1; // knockout: no draws

  const goals = [];
  const cards = [];
  const outfield = (roster) => roster.filter((p) => p.role !== 'GK');

  const addGoals = (count, teamId, roster) => {
    const players = outfield(roster);
    for (let i = 0; i < count; i += 1) {
      const scorer = pick(rng, players) ?? roster[0];
      const assistPool = players.filter((p) => p.id !== scorer.id);
      const assister = rng() < 0.6 ? pick(rng, assistPool) : null;
      goals.push({
        team: teamId,
        playerId: scorer.id,
        assistId: assister ? assister.id : null,
        type: rng() < 0.12 ? 'penalty' : 'openPlay',
        minute: randInt(rng, 1, 90),
      });
    }
  };
  addGoals(ga, teamAId, rosterA);
  addGoals(gb, teamBId, rosterB);

  const addCards = (teamId, roster) => {
    if (rng() < 0.45) {
      const p = pick(rng, roster);
      if (p) cards.push({ team: teamId, playerId: p.id, type: rng() < 0.12 ? 'red' : 'yellow', minute: randInt(rng, 20, 89) });
    }
  };
  addCards(teamAId, rosterA);
  addCards(teamBId, rosterB);

  const winner = ga > gb ? teamAId : gb > ga ? teamBId : null;
  return {
    result: {
      goals,
      cards,
      substitutions: [],
      result: { winner: winner ? sid(winner) : null, scoreA: ga, scoreB: gb },
    },
    winner: winner ? sid(winner) : null,
  };
}

/**
 * Build one ball-by-ball cricket innings, then fold it into the aggregate
 * fields the standings engine reads (exactly like the result controller's
 * `normalizeForStorage`). Totals emerge from the simulated deliveries, so
 * batting/bowling leaderboards and NRR are all derived from the same source.
 */
function makeCricketInnings({ battingTeamId, bowlingTeamId, batters, bowlers, oversCount, rng }) {
  const oversDetail = [];
  let striker = 0;
  let nonStriker = 1;
  let nextBatter = 2;
  let wickets = 0;
  const maxWickets = Math.min(10, batters.length - 1);

  for (let o = 0; o < oversCount && wickets < maxWickets; o += 1) {
    const bowler = bowlers[o % bowlers.length];
    const balls = [];
    let legal = 0;
    let guard = 0;
    while (legal < 6 && wickets < maxWickets && guard < 30) {
      guard += 1;
      // ~7% wide: counts a run, not a legal delivery, no strike change.
      if (rng() < 0.07) {
        balls.push({ batsman: batters[striker], runsScored: 0, extras: { type: 'wide', runs: 0 } });
        continue;
      }
      legal += 1;
      // ~9% wicket on a legal ball.
      if (rng() < 0.09) {
        balls.push({
          batsman: batters[striker],
          runsScored: 0,
          isWicket: true,
          wicket: { playerOut: batters[striker], bowlerCredited: bowler, type: 'bowled' },
        });
        wickets += 1;
        if (nextBatter < batters.length) {
          striker = nextBatter;
          nextBatter += 1;
        }
        continue;
      }
      const r = rng();
      let runs;
      if (r < 0.34) runs = 1;
      else if (r < 0.54) runs = 0;
      else if (r < 0.70) runs = 2;
      else if (r < 0.83) runs = 4;
      else if (r < 0.92) runs = 6;
      else runs = 3;
      balls.push({ batsman: batters[striker], runsScored: runs });
      if (runs % 2 === 1) [striker, nonStriker] = [nonStriker, striker];
    }
    [striker, nonStriker] = [nonStriker, striker]; // strike rotates at over's end
    oversDetail.push({ overNumber: o, bowler, balls });
  }

  const inn = { battingTeam: sid(battingTeamId), bowlingTeam: sid(bowlingTeamId), allottedOvers: oversCount, oversDetail };
  const d = deriveCricketInnings(inn, sid(bowlingTeamId));
  return { ...inn, runs: d.runs, wickets: d.wickets, overs: d.overs, extras: d.extras };
}

/**
 * A full cricket result (two innings) with the winner derived from the totals.
 * `decisive` guarantees a result (used if we ever play knockout cricket).
 */
function makeCricketResult({ teamAId, teamBId, rosterA, rosterB, oversCount, rng, decisive }) {
  const battersA = rosterA.map((p) => p.id);
  const battersB = rosterB.map((p) => p.id);
  const bowlersA = rosterA.filter((p) => p.role === 'bowler' || p.role === 'all-rounder').map((p) => p.id);
  const bowlersB = rosterB.filter((p) => p.role === 'bowler' || p.role === 'all-rounder').map((p) => p.id);

  const inn1 = makeCricketInnings({
    battingTeamId: teamAId,
    bowlingTeamId: teamBId,
    batters: battersA,
    bowlers: bowlersB.length ? bowlersB : battersB,
    oversCount,
    rng,
  });
  const inn2 = makeCricketInnings({
    battingTeamId: teamBId,
    bowlingTeamId: teamAId,
    batters: battersB,
    bowlers: bowlersA.length ? bowlersA : battersA,
    oversCount,
    rng,
  });

  let winner = inn1.runs > inn2.runs ? teamAId : inn2.runs > inn1.runs ? teamBId : null;
  let margin = winner ? 'runs' : 'tie';
  if (decisive && !winner) {
    // Force a result for a knockout: give the side batting first one more run.
    inn1.runs += 1;
    winner = teamAId;
    margin = 'runs';
  }
  return {
    result: { innings: [inn1, inn2], result: { winner: winner ? sid(winner) : null, margin } },
    winner: winner ? sid(winner) : null,
  };
}

/* --------------------------- structural builders --------------------------- */

let nameCursor = 0;
function nextName(rng) {
  const fn = FIRST_NAMES[nameCursor % FIRST_NAMES.length];
  const ln = LAST_NAMES[(nameCursor * 7 + Math.floor(rng() * LAST_NAMES.length)) % LAST_NAMES.length];
  nameCursor += 1;
  return `${fn} ${ln}`;
}

const FOOTBALL_LINEUP = ['GK', 'CB', 'RB', 'CM', 'LW', 'ST'];
const CRICKET_LINEUP = [
  'wicketkeeper', 'batsman', 'batsman', 'all-rounder', 'bowler', 'bowler', 'all-rounder',
];

/**
 * Create teams (with rosters) for a tournament, distributing them across the
 * given groups round-robin. Returns the created team docs and a teamId -> roster
 * map of { id, role } used by the result builders.
 */
async function createTeamsWithPlayers({ tournament, groups, teamSpecs, sport, rng }) {
  const lineup = sport === SPORTS.FOOTBALL ? FOOTBALL_LINEUP : CRICKET_LINEUP;
  const teams = [];
  const rosterByTeam = new Map();

  for (let i = 0; i < teamSpecs.length; i += 1) {
    const spec = teamSpecs[i];
    const group = groups.length ? groups[i % groups.length] : null;
    // eslint-disable-next-line no-await-in-loop
    const team = await Team.create({
      tournamentId: tournament._id,
      name: spec.name,
      shortCode: spec.code,
      primaryColor: spec.color,
      groupId: group ? group._id : null,
      seed: i + 1,
    });
    teams.push(team);
    if (group) {
      group.teams.push(team._id);
    }

    const playerDocs = lineup.map((role, idx) => ({
      tournamentId: tournament._id,
      teamId: team._id,
      name: nextName(rng),
      role,
      jerseyNumber: idx + 1,
    }));
    // eslint-disable-next-line no-await-in-loop
    const created = await Player.insertMany(playerDocs);
    rosterByTeam.set(sid(team._id), created.map((p) => ({ id: sid(p._id), role: p.role })));
  }

  await Promise.all(groups.map((g) => g.save()));
  return { teams, rosterByTeam };
}

/** Insert scheduled round-robin group fixtures for every group (like the controller). */
async function createGroupFixtures({ tournament, groups, startDate, daysBetweenRounds = 5 }) {
  const docs = [];
  let matchNumber = 1;
  for (const group of groups) {
    if (group.teams.length < 2) continue;
    const seeds = buildGroupFixtureSeeds({
      teamIds: group.teams.map((t) => sid(t)),
      doubleRoundRobin: false,
      startDate,
      daysBetweenRounds,
      venue: tournament.venues?.[0] || '',
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
        matchNumber: matchNumber++,
        status: FIXTURE_STATUS.SCHEDULED,
      });
    }
  }
  return Fixture.insertMany(docs);
}

/** Write a completed result onto a fixture (group stage; no bracket side-effects). */
async function completeFixture({ fixture, sport, rosterByTeam, oversCount, rng, decisive }) {
  const rosterA = rosterByTeam.get(sid(fixture.teamA)) ?? [];
  const rosterB = rosterByTeam.get(sid(fixture.teamB)) ?? [];
  const built =
    sport === SPORTS.FOOTBALL
      ? makeFootballResult({ teamAId: fixture.teamA, teamBId: fixture.teamB, rosterA, rosterB, rng, decisive })
      : makeCricketResult({ teamAId: fixture.teamA, teamBId: fixture.teamB, rosterA, rosterB, oversCount, rng, decisive });

  fixture.result = built.result;
  fixture.winner = built.winner;
  fixture.status = FIXTURE_STATUS.COMPLETED;
  fixture.liveState = null;
  await fixture.save();
  return built.winner;
}

/**
 * Play out a knockout bracket: repeatedly find fixtures whose teams are
 * resolved + still scheduled, decide them, and advance via the real service.
 * Each pass unlocks the next round (the final/3rd-place get their teams once
 * the semis advance), so a few passes drain the whole bracket.
 */
async function playKnockout({ tournament, sport, rosterByTeam, oversCount, rng }) {
  for (let pass = 0; pass < 12; pass += 1) {
    // eslint-disable-next-line no-await-in-loop
    const playable = await Fixture.find({
      tournamentId: tournament._id,
      stage: FIXTURE_STAGE.KNOCKOUT,
      status: FIXTURE_STATUS.SCHEDULED,
      teamA: { $ne: null },
      teamB: { $ne: null },
    }).sort({ roundIndex: 1, matchNumber: 1 });
    if (!playable.length) break;

    for (const fixture of playable) {
      // eslint-disable-next-line no-await-in-loop
      const winner = await completeFixture({ fixture, sport, rosterByTeam, oversCount, rng, decisive: true });
      const loser = winner === sid(fixture.teamA) ? sid(fixture.teamB) : sid(fixture.teamA);
      // eslint-disable-next-line no-await-in-loop
      await advanceAfterResult(tournament, fixture, winner, loser);
    }
  }
}

/* ------------------------------ team rosters ------------------------------ */

const CUP_TEAMS = [
  { name: 'Riverside Rovers', code: 'RIV', color: '#2563eb' },
  { name: 'Harbor United', code: 'HAR', color: '#dc2626' },
  { name: 'Summit Athletic', code: 'SUM', color: '#16a34a' },
  { name: 'Kingsway FC', code: 'KIN', color: '#9333ea' },
  { name: 'Delta Dynamos', code: 'DEL', color: '#ea580c' },
  { name: 'Orchard City', code: 'ORC', color: '#0891b2' },
  { name: 'Northgate Lions', code: 'NOR', color: '#ca8a04' },
  { name: 'Vale Wanderers', code: 'VAL', color: '#db2777' },
];

const SIXES_TEAMS = [
  { name: 'Coastal Chargers', code: 'COA', color: '#0d9488' },
  { name: 'Granite Gladiators', code: 'GRA', color: '#7c3aed' },
  { name: 'Meadow Mavericks', code: 'MEA', color: '#16a34a' },
  { name: 'Skyline Strikers', code: 'SKY', color: '#2563eb' },
  { name: 'Desert Daredevils', code: 'DES', color: '#d97706' },
  { name: 'Royal Rhinos', code: 'ROY', color: '#be123c' },
];

const DRAFT_TEAMS = [
  { name: 'Old Town Eagles', code: 'OTE', color: '#1d4ed8' },
  { name: 'Lakeside Galaxy', code: 'LAK', color: '#9333ea' },
  { name: 'Ironworks FC', code: 'IRO', color: '#b91c1c' },
  { name: 'Park Rangers', code: 'PAR', color: '#15803d' },
];

/* ------------------------------- tournaments ------------------------------ */

async function makeGroups(tournament, names) {
  const groups = [];
  for (let i = 0; i < names.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const g = await Group.create({ tournamentId: tournament._id, name: names[i], order: i, teams: [] });
    groups.push(g);
  }
  return groups;
}

/** Tournament 1: a fully-played football cup with a champion. */
async function seedFootballCup(organiser) {
  const rng = mulberry32(101);
  const tournament = await Tournament.create({
    name: 'Riverside Premier Cup',
    sportType: SPORTS.FOOTBALL,
    description: 'An eight-team invitational: two groups of four feeding a knockout with a third-place playoff.',
    primaryColor: '#2563eb',
    venues: ['Riverside Arena', 'Harbor Park'],
    startDate: new Date('2026-03-01T16:00:00.000Z'),
    pointsConfig: DEFAULT_POINTS_CONFIG[SPORTS.FOOTBALL],
    groupSettings: { numberOfGroups: 2, doubleRoundRobin: false, qualifiersPerGroup: 2 },
    status: TOURNAMENT_STATUS.SETUP,
    createdBy: organiser._id,
  });

  const groups = await makeGroups(tournament, ['Group A', 'Group B']);
  const { rosterByTeam } = await createTeamsWithPlayers({
    tournament, groups, teamSpecs: CUP_TEAMS, sport: SPORTS.FOOTBALL, rng,
  });

  await createGroupFixtures({ tournament, groups, startDate: tournament.startDate, daysBetweenRounds: 4 });
  const groupFixtures = await Fixture.find({ tournamentId: tournament._id, stage: FIXTURE_STAGE.GROUP });
  for (const fixture of groupFixtures) {
    // eslint-disable-next-line no-await-in-loop
    await completeFixture({ fixture, sport: SPORTS.FOOTBALL, rosterByTeam, rng });
  }

  tournament.status = TOURNAMENT_STATUS.GROUP_STAGE;
  await tournament.save();

  // Build + play the knockout via the real services, then run the cascade.
  await generateAndPersist(tournament, { thirdPlacePlayoff: true });
  await playKnockout({ tournament, sport: SPORTS.FOOTBALL, rosterByTeam, rng });
  await recalculateTournament(tournament._id, { confirm: true });

  // Crown a Player of the Tournament (top scorer) and lock the bracket.
  const fresh = await Tournament.findById(tournament._id);
  const topScorer = await Player.findOne({ tournamentId: tournament._id })
    .sort({ 'stats.football.goals': -1, 'stats.football.assists': -1 })
    .lean();
  if (topScorer?.stats?.football?.goals > 0) {
    fresh.playerOfTournament = topScorer._id;
    await fresh.save();
  }
  await lockBracket(fresh);

  return { tournament: fresh, topScorer };
}

/** Tournament 2: a cricket sixes event mid group-stage (in progress). */
async function seedCricketSixes(organiser) {
  const rng = mulberry32(202);
  const oversCount = 6;
  const tournament = await Tournament.create({
    name: 'Summer Sixes Trophy',
    sportType: SPORTS.CRICKET,
    description: 'Fast six-over cricket. Two groups of three — group stage in progress.',
    primaryColor: '#0d9488',
    venues: ['Meadow Oval', 'Skyline Ground'],
    startDate: new Date('2026-04-10T09:00:00.000Z'),
    pointsConfig: DEFAULT_POINTS_CONFIG[SPORTS.CRICKET],
    groupSettings: { numberOfGroups: 2, doubleRoundRobin: false, qualifiersPerGroup: 2 },
    status: TOURNAMENT_STATUS.SETUP,
    createdBy: organiser._id,
  });

  const groups = await makeGroups(tournament, ['Group A', 'Group B']);
  const { rosterByTeam } = await createTeamsWithPlayers({
    tournament, groups, teamSpecs: SIXES_TEAMS, sport: SPORTS.CRICKET, rng,
  });

  await createGroupFixtures({ tournament, groups, startDate: tournament.startDate, daysBetweenRounds: 3 });
  const groupFixtures = await Fixture.find({ tournamentId: tournament._id, stage: FIXTURE_STAGE.GROUP }).sort({ matchNumber: 1 });

  // Play roughly two-thirds; leave the rest scheduled to show upcoming fixtures.
  const playCount = Math.ceil(groupFixtures.length * 0.67);
  for (let i = 0; i < playCount; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await completeFixture({ fixture: groupFixtures[i], sport: SPORTS.CRICKET, rosterByTeam, oversCount, rng });
  }

  tournament.status = TOURNAMENT_STATUS.GROUP_STAGE;
  await tournament.save();
  await recalculateTournament(tournament._id);

  return { tournament, total: groupFixtures.length, played: playCount };
}

/** Tournament 3: a football league still in setup (no fixtures). */
async function seedDraftLeague(organiser) {
  const rng = mulberry32(303);
  const tournament = await Tournament.create({
    name: 'City Champions League',
    sportType: SPORTS.FOOTBALL,
    description: 'A single round-robin league — created but not yet started. Generate fixtures to kick off.',
    primaryColor: '#1d4ed8',
    venues: ['Civic Stadium'],
    pointsConfig: DEFAULT_POINTS_CONFIG[SPORTS.FOOTBALL],
    groupSettings: { numberOfGroups: 1, doubleRoundRobin: true, qualifiersPerGroup: 2 },
    status: TOURNAMENT_STATUS.SETUP,
    createdBy: organiser._id,
  });

  const groups = await makeGroups(tournament, ['League Table']);
  await createTeamsWithPlayers({
    tournament, groups, teamSpecs: DRAFT_TEAMS, sport: SPORTS.FOOTBALL, rng,
  });

  return { tournament };
}

/* --------------------------------- driver --------------------------------- */

async function ensureOrganiser() {
  const email = (process.env.SEED_DEMO_EMAIL ?? 'demo@tms.local').toLowerCase();
  const password = process.env.SEED_DEMO_PASSWORD ?? 'demo12345';
  const name = process.env.SEED_DEMO_NAME ?? 'Demo Organiser';

  let user = await User.findOne({ email });
  if (!user) {
    user = new User({
      name,
      email,
      role: USER_ROLES.TOURNAMENT_ADMIN,
      approvalStatus: APPROVAL_STATUS.APPROVED,
      approvedAt: new Date(),
      organization: 'TourneyOps Demo',
      isActive: true,
    });
    await user.setPassword(password);
    await user.save();
  }
  return { user, email, password };
}

/** Remove every tournament owned by the demo organiser, plus all child docs. */
async function wipeExistingDemoData(organiserId) {
  const tournaments = await Tournament.find({ createdBy: organiserId }).select('_id').lean();
  if (!tournaments.length) return 0;
  const ids = tournaments.map((t) => t._id);
  await Promise.all([
    Fixture.deleteMany({ tournamentId: { $in: ids } }),
    Standing.deleteMany({ tournamentId: { $in: ids } }),
    KnockoutBracket.deleteMany({ tournamentId: { $in: ids } }),
    Player.deleteMany({ tournamentId: { $in: ids } }),
    Team.deleteMany({ tournamentId: { $in: ids } }),
    Group.deleteMany({ tournamentId: { $in: ids } }),
  ]);
  await Tournament.deleteMany({ _id: { $in: ids } });
  return ids.length;
}

async function run() {
  await connectDB();

  const { user: organiser, email, password } = await ensureOrganiser();
  nameCursor = 0;

  const wiped = await wipeExistingDemoData(organiser._id);
  if (wiped) console.log(`[seed:demo] cleared ${wiped} existing demo tournament(s)`);

  const cup = await seedFootballCup(organiser);
  const sixes = await seedCricketSixes(organiser);
  const draft = await seedDraftLeague(organiser);

  console.log('\n[seed:demo] demo data ready:\n');
  console.log(`  1. ${cup.tournament.name} (football) — ${cup.tournament.status}`);
  if (cup.topScorer) console.log(`       Player of the Tournament: ${cup.topScorer.name} (${cup.topScorer.stats.football.goals} goals)`);
  console.log(`  2. ${sixes.tournament.name} (cricket)  — ${sixes.tournament.status} (${sixes.played}/${sixes.total} group games played)`);
  console.log(`  3. ${draft.tournament.name} (football) — ${draft.tournament.status} (no fixtures yet)`);
  console.log('\n  Sign in as the demo organiser to manage them:');
  console.log(`       email:    ${email}`);
  console.log(`       password: ${password}\n`);

  await disconnectDB();
  process.exit(0);
}

run().catch(async (err) => {
  console.error('[seed:demo] failed:', err);
  try {
    await disconnectDB();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
