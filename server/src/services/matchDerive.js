import { SPORTS } from '@tms/shared/constants';

/**
 * Derivation layer (Module 5).
 *
 * Granular events (ball-by-ball cricket, per-event football) are the richest
 * source of truth. This module turns them into:
 *   1. Normalised innings/score totals consumed by the standings engine.
 *   2. Per-player contributions used to (re)build cached player aggregate stats.
 *
 * Everything degrades gracefully: if only aggregate fields were entered (the
 * "quick result" path), we use those directly and skip per-player derivation.
 */

/* ----------------------------- helpers ----------------------------- */

const id = (v) => (v == null ? null : String(v));

/** Cricket over notation (e.g. 19.4) from a count of legal balls. */
export function ballsToOvers(balls) {
  const whole = Math.floor(balls / 6);
  const rem = balls % 6;
  return Number(`${whole}.${rem}`);
}

/** True if a delivery counts as a legal ball (wides/no-balls do not). */
function isLegalDelivery(ball) {
  const type = ball?.extras?.type;
  return type !== 'wide' && type !== 'noball';
}

/** Total runs a delivery adds to the team score (off bat + extra runs). */
function ballRuns(ball) {
  const off = Number(ball?.runsScored ?? 0);
  const extra = Number(ball?.extras?.runs ?? 0);
  // Wide/no-ball implicitly cost 1 even if `runs` only stores the additional.
  const penalty = ball?.extras?.type === 'wide' || ball?.extras?.type === 'noball' ? 1 : 0;
  return off + extra + penalty;
}

/** Runs charged to the bowler (byes/leg-byes are not the bowler's fault). */
function bowlerRuns(ball) {
  const off = Number(ball?.runsScored ?? 0);
  const type = ball?.extras?.type;
  const extra = Number(ball?.extras?.runs ?? 0);
  if (type === 'wide' || type === 'noball') return off + extra + 1;
  if (type === 'bye' || type === 'legbye') return off; // extras not charged
  return off + extra;
}

/* ============================== Cricket ============================== */

/**
 * Normalise one innings to `{ battingTeam, bowlingTeam, runs, wickets, overs,
 * extras, allottedOvers }`. When ball-by-ball detail exists we derive the
 * totals from it; otherwise we trust the aggregate fields.
 */
export function deriveCricketInnings(inn, fallbackBowlingTeam = null) {
  const base = {
    battingTeam: id(inn?.battingTeam),
    bowlingTeam: id(inn?.bowlingTeam) ?? fallbackBowlingTeam,
    runs: Number(inn?.runs ?? 0),
    wickets: Number(inn?.wickets ?? 0),
    overs: Number(inn?.overs ?? 0),
    extras: Number(inn?.extras ?? 0),
    allottedOvers: inn?.allottedOvers ?? undefined,
  };

  const overs = inn?.oversDetail;
  if (!Array.isArray(overs) || overs.length === 0) return base;

  let runs = 0;
  let wickets = 0;
  let extras = 0;
  let legalBalls = 0;
  for (const over of overs) {
    for (const ball of over.balls ?? []) {
      runs += ballRuns(ball);
      extras += Number(ball?.extras?.runs ?? 0) +
        (ball?.extras?.type === 'wide' || ball?.extras?.type === 'noball' ? 1 : 0);
      if (ball?.isWicket) wickets += 1;
      if (isLegalDelivery(ball)) legalBalls += 1;
    }
  }

  return {
    ...base,
    runs,
    wickets,
    extras,
    overs: ballsToOvers(legalBalls),
  };
}

/** All innings of a cricket result, normalised (with bowling team inferred). */
export function deriveCricketInningsList(result, teamA, teamB) {
  const a = id(teamA);
  const b = id(teamB);
  return (result?.innings ?? []).map((inn) => {
    const batting = id(inn.battingTeam);
    const bowling = batting === a ? b : a;
    return deriveCricketInnings(inn, bowling);
  });
}

/**
 * Per-player cricket contributions for a single fixture, keyed by playerId.
 * Only populated for innings that carry ball-by-ball detail.
 */
export function deriveCricketPlayerStats(fixture) {
  const result = fixture?.result;
  const innings = result?.innings ?? [];
  const byPlayer = new Map();

  const row = (pid) => {
    const key = id(pid);
    if (!key) return null;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        playerId: key,
        // batting
        batInnings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, out: false,
        // bowling
        bowlInnings: 0, ballsBowled: 0, runsConceded: 0, wickets: 0, maidens: 0,
      });
    }
    return byPlayer.get(key);
  };

  for (const inn of innings) {
    if (!Array.isArray(inn.oversDetail) || inn.oversDetail.length === 0) continue;

    const battedThisInnings = new Set();
    const bowledThisInnings = new Set();

    for (const over of inn.oversDetail) {
      const bowler = row(over.bowler);
      let overRuns = 0;
      let overLegalBalls = 0;

      for (const ball of over.balls ?? []) {
        // Batting
        const bat = row(ball.batsman);
        if (bat) {
          if (!battedThisInnings.has(bat.playerId)) {
            bat.batInnings += 1;
            battedThisInnings.add(bat.playerId);
          }
          bat.runs += Number(ball.runsScored ?? 0);
          if (isLegalDelivery(ball) || ball?.extras?.type === 'noball') bat.ballsFaced += 1;
          if (Number(ball.runsScored) === 4) bat.fours += 1;
          if (Number(ball.runsScored) === 6) bat.sixes += 1;
        }

        // Dismissal
        if (ball.isWicket && ball.wicket?.playerOut) {
          const outRow = row(ball.wicket.playerOut);
          if (outRow) outRow.out = true;
        }

        // Bowling tallies for this over
        if (bowler) {
          if (!bowledThisInnings.has(bowler.playerId)) {
            bowler.bowlInnings += 1;
            bowledThisInnings.add(bowler.playerId);
          }
          bowler.runsConceded += bowlerRuns(ball);
          overRuns += bowlerRuns(ball);
          if (isLegalDelivery(ball)) {
            bowler.ballsBowled += 1;
            overLegalBalls += 1;
          }
          if (ball.isWicket && ball.wicket?.bowlerCredited) bowler.wickets += 1;
        }
      }

      // Maiden = a completed (6 legal balls) over with zero runs charged.
      if (bowler && overLegalBalls >= 6 && overRuns === 0) bowler.maidens += 1;
    }
  }

  return byPlayer;
}

/* ============================== Football ============================== */

/** Goal counts per side, ignoring own-goal attribution quirks for the score. */
export function deriveFootballGoals(result, teamA, teamB) {
  const a = id(teamA);
  const b = id(teamB);
  let goalsA = 0;
  let goalsB = 0;
  for (const g of result?.goals ?? []) {
    // An own goal credits the OPPOSING team on the scoreboard.
    const scoringTeam = g.type === 'ownGoal'
      ? (id(g.team) === a ? b : a)
      : id(g.team);
    if (scoringTeam === a) goalsA += 1;
    else if (scoringTeam === b) goalsB += 1;
  }
  return { goalsA, goalsB };
}

/** Per-player football contributions for a single fixture, keyed by playerId. */
export function deriveFootballPlayerStats(fixture) {
  const result = fixture?.result;
  const byPlayer = new Map();
  const row = (pid) => {
    const key = id(pid);
    if (!key) return null;
    if (!byPlayer.has(key)) {
      byPlayer.set(key, {
        playerId: key, goals: 0, assists: 0, ownGoals: 0, yellowCards: 0, redCards: 0,
      });
    }
    return byPlayer.get(key);
  };

  for (const g of result?.goals ?? []) {
    if (g.type === 'ownGoal') {
      const r = row(g.playerId);
      if (r) r.ownGoals += 1;
      continue;
    }
    const scorer = row(g.playerId);
    if (scorer) scorer.goals += 1;
    const assist = row(g.assistId);
    if (assist) assist.assists += 1;
  }
  for (const c of result?.cards ?? []) {
    const r = row(c.playerId);
    if (!r) continue;
    if (c.type === 'red') r.redCards += 1;
    else r.yellowCards += 1;
  }

  return byPlayer;
}

/**
 * Football appearances + goalkeeping credit for a single fixture, keyed by
 * playerId → `{ appeared, goalsConcededByTeam, cleanSheets }`.
 *
 * `rosterByTeam` maps each side's team id to its players (`[{ _id, role }]`).
 * When `result.lineups` names a Playing XI for a side, appearances and clean
 * sheets are credited from it (the keeper is the lineup's GK). Otherwise we fall
 * back to the legacy heuristic: appearances = anyone who featured in an event
 * plus that side's rostered keepers, and every rostered keeper shares the clean
 * sheet. Goals/assists/cards are derived separately by `deriveFootballPlayerStats`.
 */
export function deriveFootballTeamCredits(fixture, rosterByTeam = {}) {
  const result = fixture?.result;
  const teamA = id(fixture?.teamA);
  const teamB = id(fixture?.teamB);

  const out = new Map();
  const ensure = (pid) => {
    const key = id(pid);
    if (!key) return null;
    if (!out.has(key)) out.set(key, { appeared: false, goalsConcededByTeam: 0, cleanSheets: 0 });
    return out.get(key);
  };

  const { goalsA, goalsB } = deriveFootballGoals(result, teamA, teamB);

  // playerId → owning team id, for placing event participants on a side.
  const teamOfPlayer = new Map();
  for (const [tid, list] of Object.entries(rosterByTeam)) {
    for (const p of list ?? []) teamOfPlayer.set(id(p._id), id(p.teamId) ?? id(tid));
  }

  const contrib = deriveFootballPlayerStats(fixture);
  const lineups = result?.lineups ?? null;

  const sides = [
    { slot: 'teamA', teamId: teamA, conceded: goalsB },
    { slot: 'teamB', teamId: teamB, conceded: goalsA },
  ];

  for (const side of sides) {
    if (!side.teamId) continue;
    const roster = rosterByTeam[side.teamId] ?? [];
    const rosterGkIds = roster.filter((p) => p.role === 'GK').map((p) => id(p._id));
    const lineup = Array.isArray(lineups?.[side.slot])
      ? lineups[side.slot].map(id).filter(Boolean)
      : null;

    let appearanceIds;
    let gkIds;
    if (lineup && lineup.length) {
      appearanceIds = lineup;
      const lineupGks = lineup.filter((pid) =>
        roster.some((p) => id(p._id) === pid && p.role === 'GK')
      );
      // A keeper named in the XI keeps; if the XI lists none, fall back to roster.
      gkIds = lineupGks.length ? lineupGks : rosterGkIds;
    } else {
      const fromEvents = [...contrib.keys()].filter((pid) => teamOfPlayer.get(pid) === side.teamId);
      gkIds = rosterGkIds;
      appearanceIds = [...new Set([...fromEvents, ...rosterGkIds])];
    }

    for (const pid of appearanceIds) {
      const r = ensure(pid);
      if (r) r.appeared = true;
    }
    for (const pid of gkIds) {
      const r = ensure(pid);
      if (!r) continue;
      r.goalsConcededByTeam += side.conceded;
      if (side.conceded === 0) r.cleanSheets += 1;
      r.appeared = true;
    }
  }

  return out;
}

/** Flatten a fixture's `result.lineups` to a de-duped list of player ids. */
export function lineupPlayerIds(result) {
  const l = result?.lineups;
  if (!l) return [];
  const ids = [...(Array.isArray(l.teamA) ? l.teamA : []), ...(Array.isArray(l.teamB) ? l.teamB : [])];
  return [...new Set(ids.map(id).filter(Boolean))];
}

/* ------------------------------ ticker ------------------------------ */

/**
 * A flat, sport-aware score snapshot for the public live ticker, derived from
 * either the granular in-progress state or the explicit ticker fields.
 */
export function deriveLiveTicker(sport, state, teamA, teamB) {
  if (sport === SPORTS.CRICKET) {
    const innings = state?.innings ?? [];
    const idx = state?.currentInnings ?? Math.max(0, innings.length - 1);
    const inn = innings[idx];
    if (inn) {
      const d = deriveCricketInnings(inn);
      return {
        battingTeam: d.battingTeam,
        runs: d.runs,
        wickets: d.wickets,
        overs: d.overs,
        inningsIndex: idx,
        commentary: state?.commentary ?? '',
      };
    }
    return {
      battingTeam: id(state?.battingTeam),
      runs: Number(state?.runs ?? 0),
      wickets: Number(state?.wickets ?? 0),
      overs: Number(state?.overs ?? 0),
      commentary: state?.commentary ?? '',
    };
  }

  // Football
  if (Array.isArray(state?.goals)) {
    const { goalsA, goalsB } = deriveFootballGoals({ goals: state.goals }, teamA, teamB);
    return {
      teamAGoals: goalsA,
      teamBGoals: goalsB,
      minute: Number(state?.minute ?? 0),
      commentary: state?.commentary ?? '',
    };
  }
  return {
    teamAGoals: Number(state?.teamAGoals ?? 0),
    teamBGoals: Number(state?.teamBGoals ?? 0),
    minute: Number(state?.minute ?? 0),
    commentary: state?.commentary ?? '',
  };
}
