import { Tournament } from '../models/Tournament.js';
import { Player } from '../models/Player.js';
import { Fixture } from '../models/Fixture.js';
import { FIXTURE_STATUS, SPORTS } from '@tms/shared/constants';
import {
  deriveCricketPlayerStats,
  deriveFootballPlayerStats,
  deriveFootballTeamCredits,
  lineupPlayerIds,
} from './matchDerive.js';

const id = (v) => (v == null ? null : String(v));

function emptyCricket() {
  return {
    matches: 0,
    batInnings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, notOuts: 0,
    highScore: 0, dismissals: 0,
    bowlInnings: 0, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0,
    bestWickets: 0, bestRuns: 0,
  };
}

function emptyFootball() {
  return {
    appearances: 0, goals: 0, assists: 0, ownGoals: 0,
    yellowCards: 0, redCards: 0, goalsConcededByTeam: 0, cleanSheets: 0,
  };
}

/** A new bowling figure is "better" with more wickets, or fewer runs at equal wickets. */
function isBetterBowling(newW, newR, curW, curR) {
  if (newW !== curW) return newW > curW;
  if (newW === 0) return false;
  return newR < curR;
}

/**
 * Recompute players' cached aggregate stats for a tournament from the granular
 * events of its completed fixtures. Idempotent and safe to call after any result
 * edit (the foundation of the Module 5B recalculation cascade).
 *
 * Pass `teamIds` to scope the recompute to specific rosters (e.g. the two teams
 * of an edited fixture) instead of every player in the tournament. This is exact,
 * not approximate: a player only accumulates from fixtures their team played, and
 * those fixtures always reference one of `teamIds` — so the scoped aggregate is
 * byte-for-byte identical to the full pass for the players it touches, while the
 * full pass is reserved for the explicit recalc cascade / points-config changes.
 *
 * @param {string} tournamentId
 * @param {{ teamIds?: (string|object)[] | null }} [options]
 * @returns {number} number of players updated
 */
export async function recalcPlayerStats(tournamentId, { teamIds = null } = {}) {
  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) return 0;
  const sport = tournament.sportType;

  // Empty / unusable scope falls back to a full recompute (correctness first).
  const scopeIds = Array.isArray(teamIds) ? teamIds.map(id).filter(Boolean) : [];
  const scoped = scopeIds.length > 0;

  const playerFilter = { tournamentId };
  const fixtureFilter = { tournamentId, status: FIXTURE_STATUS.COMPLETED };
  if (scoped) {
    playerFilter.teamId = { $in: scopeIds };
    fixtureFilter.$or = [{ teamA: { $in: scopeIds } }, { teamB: { $in: scopeIds } }];
  }

  const [players, fixtures] = await Promise.all([
    Player.find(playerFilter).lean(),
    Fixture.find(fixtureFilter).lean(),
  ]);
  if (!players.length) return 0;

  const acc = new Map(); // playerId -> stats accumulator
  const playerById = new Map(players.map((p) => [id(p._id), p]));
  for (const p of players) {
    acc.set(id(p._id), sport === SPORTS.CRICKET ? emptyCricket() : emptyFootball());
  }

  // Roster index by team — used for football appearance/clean-sheet credit.
  const rosterByTeam = {};
  if (sport === SPORTS.FOOTBALL) {
    for (const p of players) {
      const t = id(p.teamId);
      if (!t) continue;
      (rosterByTeam[t] ??= []).push(p);
    }
  }

  for (const fixture of fixtures) {
    if (!fixture.result) continue;

    if (sport === SPORTS.CRICKET) {
      const contrib = deriveCricketPlayerStats(fixture);
      const counted = new Set();
      for (const [pid, c] of contrib) {
        const s = acc.get(pid);
        if (!s) continue; // event referenced a non-roster id; ignore defensively
        s.matches += 1;
        counted.add(pid);
        if (c.batInnings > 0) {
          s.batInnings += c.batInnings;
          s.runs += c.runs;
          s.ballsFaced += c.ballsFaced;
          s.fours += c.fours;
          s.sixes += c.sixes;
          if (!c.out) s.notOuts += 1;
          else s.dismissals += 1;
          if (c.runs > s.highScore) s.highScore = c.runs;
        }
        if (c.bowlInnings > 0) {
          s.bowlInnings += c.bowlInnings;
          s.ballsBowled += c.ballsBowled;
          s.runsConceded += c.runsConceded;
          s.wickets += c.wickets;
          s.maidens += c.maidens;
          if (isBetterBowling(c.wickets, c.runsConceded, s.bestWickets, s.bestRuns)) {
            s.bestWickets = c.wickets;
            s.bestRuns = c.runsConceded;
          }
        }
      }
      // A named XI player who never batted or bowled still played the match.
      for (const pid of lineupPlayerIds(fixture.result)) {
        if (counted.has(pid)) continue;
        const s = acc.get(pid);
        if (!s) continue;
        s.matches += 1;
        counted.add(pid);
      }
    } else {
      // Goals / assists / cards always come straight from the recorded events.
      const contrib = deriveFootballPlayerStats(fixture);
      for (const [pid, c] of contrib) {
        const s = acc.get(pid);
        if (!s) continue;
        s.goals += c.goals;
        s.assists += c.assists;
        s.ownGoals += c.ownGoals;
        s.yellowCards += c.yellowCards;
        s.redCards += c.redCards;
      }

      // Appearances + goalkeeping credit: exact from the Playing XI when present,
      // otherwise the legacy heuristic (event participants + rostered keepers).
      const credits = deriveFootballTeamCredits(fixture, rosterByTeam);
      for (const [pid, cr] of credits) {
        const s = acc.get(pid);
        if (!s) continue;
        s.goalsConcededByTeam += cr.goalsConcededByTeam;
        s.cleanSheets += cr.cleanSheets;
        if (cr.appeared) s.appearances += 1;
      }
    }
  }

  const now = new Date();
  const ops = [];
  for (const [pid, stats] of acc) {
    if (!playerById.has(pid)) continue;
    const setStats = sport === SPORTS.CRICKET ? { cricket: stats } : { football: stats };
    ops.push({
      updateOne: {
        filter: { _id: pid },
        update: { $set: { stats: setStats, statsUpdatedAt: now } },
      },
    });
  }
  if (ops.length) await Player.bulkWrite(ops);
  return ops.length;
}
