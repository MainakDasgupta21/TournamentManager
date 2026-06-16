import { Tournament } from '../models/Tournament.js';
import { Player } from '../models/Player.js';
import { Team } from '../models/Team.js';
import { Fixture } from '../models/Fixture.js';
import { FIXTURE_STATUS, SPORTS } from '@tms/shared/constants';
import {
  deriveCricketPlayerStats,
  deriveFootballPlayerStats,
  deriveCricketInnings,
  deriveFootballGoals,
} from './matchDerive.js';

const id = (v) => (v == null ? null : String(v));

// Qualification thresholds for "rate" leaderboards (so a single big over / cameo
// doesn't top the strike-rate / economy tables).
const MIN_BALLS_FACED = 10;
const MIN_BALLS_BOWLED = 12; // 2 overs
const TOP_N = 15;

const oversText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;
const round = (n, d = 2) => (Number.isFinite(n) ? Number(n.toFixed(d)) : 0);

/** Light player projection used on every leaderboard row. */
function projectPlayer(p) {
  const team = p.teamId && typeof p.teamId === 'object' ? p.teamId : null;
  return {
    _id: id(p._id),
    name: p.name,
    role: p.role,
    jerseyNumber: p.jerseyNumber,
    teamId: id(team?._id ?? p.teamId),
    team: team
      ? { _id: id(team._id), name: team.name, shortCode: team.shortCode, primaryColor: team.primaryColor }
      : null,
  };
}

/* ============================== Cricket ============================== */

function cricketLeaderboards(players) {
  const rows = players.map((p) => {
    const c = p.stats?.cricket ?? {};
    const ballsFaced = c.ballsFaced ?? 0;
    const ballsBowled = c.ballsBowled ?? 0;
    return {
      player: projectPlayer(p),
      matches: c.matches ?? 0,
      innings: c.batInnings ?? 0,
      runs: c.runs ?? 0,
      ballsFaced,
      notOuts: c.notOuts ?? 0,
      dismissals: c.dismissals ?? 0,
      highScore: c.highScore ?? 0,
      fours: c.fours ?? 0,
      sixes: c.sixes ?? 0,
      average: c.dismissals > 0 ? round(c.runs / c.dismissals) : null,
      strikeRate: ballsFaced > 0 ? round((c.runs / ballsFaced) * 100) : 0,
      wickets: c.wickets ?? 0,
      bowlInnings: c.bowlInnings ?? 0,
      ballsBowled,
      oversBowled: oversText(ballsBowled),
      runsConceded: c.runsConceded ?? 0,
      maidens: c.maidens ?? 0,
      economy: ballsBowled > 0 ? round(c.runsConceded / (ballsBowled / 6)) : 0,
      bestBowling: (c.bestWickets ?? 0) > 0 ? `${c.bestWickets}/${c.bestRuns}` : '—',
      bestWickets: c.bestWickets ?? 0,
      bestRuns: c.bestRuns ?? 0,
    };
  });

  const top = (arr) => arr.slice(0, TOP_N);
  return {
    mostRuns: top(rows.filter((r) => r.innings > 0).sort((a, b) => b.runs - a.runs || b.strikeRate - a.strikeRate)),
    mostWickets: top(rows.filter((r) => r.bowlInnings > 0).sort((a, b) => b.wickets - a.wickets || a.economy - b.economy)),
    highestScore: top(rows.filter((r) => r.highScore > 0).sort((a, b) => b.highScore - a.highScore)),
    bestBowling: top(rows.filter((r) => r.bestWickets > 0).sort((a, b) => b.bestWickets - a.bestWickets || a.bestRuns - b.bestRuns)),
    mostSixes: top(rows.filter((r) => r.sixes > 0).sort((a, b) => b.sixes - a.sixes)),
    mostFours: top(rows.filter((r) => r.fours > 0).sort((a, b) => b.fours - a.fours)),
    bestStrikeRate: top(rows.filter((r) => r.ballsFaced >= MIN_BALLS_FACED).sort((a, b) => b.strikeRate - a.strikeRate)),
    bestEconomy: top(rows.filter((r) => r.ballsBowled >= MIN_BALLS_BOWLED).sort((a, b) => a.economy - b.economy)),
  };
}

/* ============================== Football ============================== */

function footballLeaderboards(players, teams) {
  const rows = players.map((p) => {
    const f = p.stats?.football ?? {};
    return {
      player: projectPlayer(p),
      appearances: f.appearances ?? 0,
      goals: f.goals ?? 0,
      assists: f.assists ?? 0,
      yellowCards: f.yellowCards ?? 0,
      redCards: f.redCards ?? 0,
      cleanSheets: f.cleanSheets ?? 0,
      goalsConcededByTeam: f.goalsConcededByTeam ?? 0,
      isGK: p.role === 'GK',
    };
  });

  // Fair play: aggregate disciplinary points per team (yellow = 1, red = 3).
  const fairByTeam = new Map();
  for (const p of players) {
    const tId = id(p.teamId?._id ?? p.teamId);
    if (!tId) continue;
    const f = p.stats?.football ?? {};
    const cur = fairByTeam.get(tId) ?? { yellow: 0, red: 0 };
    cur.yellow += f.yellowCards ?? 0;
    cur.red += f.redCards ?? 0;
    fairByTeam.set(tId, cur);
  }
  const fairPlay = teams
    .map((t) => {
      const v = fairByTeam.get(id(t._id)) ?? { yellow: 0, red: 0 };
      return {
        team: { _id: id(t._id), name: t.name, shortCode: t.shortCode, primaryColor: t.primaryColor },
        yellowCards: v.yellow,
        redCards: v.red,
        points: v.yellow + v.red * 3,
      };
    })
    .sort((a, b) => a.points - b.points || a.redCards - b.redCards);

  const top = (arr) => arr.slice(0, TOP_N);
  return {
    topScorers: top(rows.filter((r) => r.goals > 0).sort((a, b) => b.goals - a.goals || b.assists - a.assists)),
    mostAssists: top(rows.filter((r) => r.assists > 0).sort((a, b) => b.assists - a.assists)),
    goldenGlove: top(rows.filter((r) => r.isGK).sort((a, b) => b.cleanSheets - a.cleanSheets || a.goalsConcededByTeam - b.goalsConcededByTeam)),
    fairPlay,
  };
}

/* --------------------------- Public entrypoints --------------------------- */

export async function computeLeaderboards(tournamentId) {
  const tournament = await Tournament.findById(tournamentId).lean();
  if (!tournament) return null;
  const sport = tournament.sportType;

  const [players, teams, potm] = await Promise.all([
    Player.find({ tournamentId }).populate('teamId', 'name shortCode primaryColor').lean(),
    Team.find({ tournamentId }).lean(),
    tournament.playerOfTournament
      ? Player.findById(tournament.playerOfTournament).populate('teamId', 'name shortCode primaryColor').lean()
      : null,
  ]);

  const boards = sport === SPORTS.CRICKET ? cricketLeaderboards(players) : footballLeaderboards(players, teams);

  return {
    sport,
    playerOfTournament: potm ? { player: projectPlayer(potm), stats: potm.stats } : null,
    ...boards,
  };
}

/** Full single-player profile: cached aggregate + per-match breakdown. */
export async function computePlayerProfile(playerId) {
  const player = await Player.findById(playerId).populate('teamId', 'name shortCode primaryColor').lean();
  if (!player) return null;

  const [tournament, fixtures] = await Promise.all([
    Tournament.findById(player.tournamentId).lean(),
    Fixture.find({
      tournamentId: player.tournamentId,
      status: FIXTURE_STATUS.COMPLETED,
      $or: [{ teamA: player.teamId?._id ?? player.teamId }, { teamB: player.teamId?._id ?? player.teamId }],
    })
      .populate('teamA', 'name shortCode primaryColor')
      .populate('teamB', 'name shortCode primaryColor')
      .sort({ matchNumber: 1, scheduledAt: 1 })
      .lean(),
  ]);
  const sport = tournament?.sportType;
  const teamId = id(player.teamId?._id ?? player.teamId);

  const matches = [];
  for (const fx of fixtures) {
    const opponent = id(fx.teamA?._id) === teamId ? fx.teamB : fx.teamA;
    const base = {
      fixtureId: id(fx._id),
      date: fx.scheduledAt,
      stage: fx.stage,
      roundName: fx.roundName || (fx.groupRound ? `Round ${fx.groupRound}` : 'Group'),
      opponent: opponent
        ? { _id: id(opponent._id), name: opponent.name, shortCode: opponent.shortCode, primaryColor: opponent.primaryColor }
        : null,
    };

    if (sport === SPORTS.CRICKET) {
      const c = deriveCricketPlayerStats(fx).get(id(player._id));
      if (!c) continue;
      matches.push({
        ...base,
        batting: c.batInnings > 0
          ? { runs: c.runs, balls: c.ballsFaced, fours: c.fours, sixes: c.sixes, out: c.out }
          : null,
        bowling: c.bowlInnings > 0
          ? { wickets: c.wickets, runs: c.runsConceded, overs: oversText(c.ballsBowled), maidens: c.maidens }
          : null,
      });
    } else {
      const f = deriveFootballPlayerStats(fx).get(id(player._id));
      const { goalsA, goalsB } = deriveFootballGoals(fx.result, fx.teamA?._id, fx.teamB?._id);
      const isTeamA = id(fx.teamA?._id) === teamId;
      const scoreline = isTeamA ? `${goalsA}-${goalsB}` : `${goalsB}-${goalsA}`;
      if (!f) continue;
      matches.push({
        ...base,
        scoreline,
        goals: f.goals,
        assists: f.assists,
        yellowCards: f.yellowCards,
        redCards: f.redCards,
        ownGoals: f.ownGoals,
      });
    }
  }

  return {
    sport,
    player: projectPlayer(player),
    stats: player.stats,
    statsUpdatedAt: player.statsUpdatedAt,
    matches,
  };
}
