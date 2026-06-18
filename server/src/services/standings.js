import { SPORTS } from '@tms/shared/constants';
import { deriveCricketInnings, deriveFootballGoals } from './matchDerive.js';

/**
 * Convert cricket over notation (e.g. 19.4 = 19 overs, 4 balls) into a true
 * decimal (19 + 4/6 = 19.667) for rate maths. Anything beyond .5 balls is
 * clamped defensively.
 */
export function oversToDecimal(overs) {
  if (!overs || overs <= 0) return 0;
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  const safeBalls = Math.min(balls, 5);
  return whole + safeBalls / 6;
}

function emptyRow(teamId) {
  return {
    teamId: String(teamId),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    noResult: 0,
    points: 0,
    runsFor: 0,
    oversFor: 0,
    runsAgainst: 0,
    oversAgainst: 0,
    netRunRate: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    rank: 0,
  };
}

/** Apply any explicit per-team bonus points carried on the result object. */
function applyBonus(rowsById, result) {
  const bonus = result?.bonus;
  if (!Array.isArray(bonus)) return;
  for (const b of bonus) {
    const row = rowsById.get(String(b.team));
    if (row && Number.isFinite(b.points)) row.points += b.points;
  }
}

/* ----------------------------- Cricket ----------------------------- */

function accumulateCricket(rowsById, fixture, cfg) {
  const { teamA, teamB, result } = fixture;
  const a = rowsById.get(String(teamA));
  const b = rowsById.get(String(teamB));
  if (!a || !b) return;

  a.played += 1;
  b.played += 1;

  let runsA = 0;
  let runsB = 0;

  // Runs / overs for NRR. For each innings, the batting side scores `runs` in
  // `overs`; if all out (10 wickets) the full allotted overs are used per ICC.
  // `deriveCricketInnings` normalises ball-by-ball detail (when present) into
  // the same totals, so granular and quick-entry results behave identically.
  for (const rawInn of result?.innings ?? []) {
    const inn = deriveCricketInnings(rawInn);
    const batRow = rowsById.get(String(inn.battingTeam));
    const bowlRow = String(inn.battingTeam) === String(teamA) ? b : a;
    if (!batRow) continue;

    const allOut = inn.wickets >= 10;
    const effectiveOvers = allOut && inn.allottedOvers
      ? oversToDecimal(inn.allottedOvers)
      : oversToDecimal(inn.overs);

    batRow.runsFor += inn.runs ?? 0;
    batRow.oversFor += effectiveOvers;
    bowlRow.runsAgainst += inn.runs ?? 0;
    bowlRow.oversAgainst += effectiveOvers;
    if (String(inn.battingTeam) === String(teamA)) runsA += inn.runs ?? 0;
    else if (String(inn.battingTeam) === String(teamB)) runsB += inn.runs ?? 0;
  }

  const margin = result?.result?.margin;
  const declaredWinner = result?.result?.winner ? String(result.result.winner) : null;
  const scoreWinner = runsA === runsB ? null : runsA > runsB ? String(teamA) : String(teamB);
  const winnerId = scoreWinner ?? declaredWinner;

  if (margin === 'noResult') {
    a.noResult += 1;
    b.noResult += 1;
    a.points += cfg.noResult;
    b.points += cfg.noResult;
  } else if (margin === 'tie' || (!winnerId && margin !== 'noResult')) {
    a.drawn += 1;
    b.drawn += 1;
    a.points += cfg.draw;
    b.points += cfg.draw;
  } else if (winnerId) {
    const winRow = rowsById.get(winnerId);
    const loseRow = winnerId === String(teamA) ? b : a;
    winRow.won += 1;
    winRow.points += cfg.win;
    loseRow.lost += 1;
    loseRow.points += cfg.loss;
  }

  applyBonus(rowsById, result);
}

/* ----------------------------- Football ----------------------------- */

function accumulateFootball(rowsById, fixture, cfg) {
  const { teamA, teamB, result } = fixture;
  const a = rowsById.get(String(teamA));
  const b = rowsById.get(String(teamB));
  if (!a || !b) return;

  a.played += 1;
  b.played += 1;

  // Own goals credit the opposing side on the scoreboard (handled in derive).
  const { goalsA, goalsB } = deriveFootballGoals(result, teamA, teamB);

  a.goalsFor += goalsA;
  a.goalsAgainst += goalsB;
  b.goalsFor += goalsB;
  b.goalsAgainst += goalsA;

  const winnerId = goalsA === goalsB ? null : goalsA > goalsB ? String(teamA) : String(teamB);
  if (!winnerId) {
    // A null winner in the group stage is a draw (penalties only decide
    // knockout ties, never group points).
    a.drawn += 1;
    b.drawn += 1;
    a.points += cfg.draw;
    b.points += cfg.draw;
  } else {
    const winRow = rowsById.get(winnerId);
    const loseRow = winnerId === String(teamA) ? b : a;
    winRow.won += 1;
    winRow.points += cfg.win;
    loseRow.lost += 1;
    loseRow.points += cfg.loss;
  }

  applyBonus(rowsById, result);
}

/* --------------------------- Head-to-head --------------------------- */

/**
 * Build a pairwise head-to-head points map from completed fixtures so the
 * tiebreaker can compare two teams by the points they took off each other.
 */
function buildHeadToHead(fixtures, cfg, sport) {
  const h2h = new Map(); // `${a}|${b}` -> points a earned vs b
  const add = (x, y, pts) => {
    const key = `${x}|${y}`;
    h2h.set(key, (h2h.get(key) ?? 0) + pts);
  };

  for (const f of fixtures) {
    const A = String(f.teamA);
    const B = String(f.teamB);
    const winnerId = f.result?.result?.winner ? String(f.result.result.winner) : null;
    const margin = f.result?.result?.margin;

    if (sport === SPORTS.CRICKET && margin === 'noResult') {
      add(A, B, cfg.noResult);
      add(B, A, cfg.noResult);
    } else if (!winnerId) {
      add(A, B, cfg.draw);
      add(B, A, cfg.draw);
    } else {
      const loser = winnerId === A ? B : A;
      add(winnerId, loser, cfg.win);
      add(loser, winnerId, cfg.loss);
    }
  }
  return h2h;
}

/* ----------------------------- Ranking ----------------------------- */

function compareByTiebreakers(x, y, order, h2h) {
  for (const key of order) {
    let diff = 0;
    switch (key) {
      case 'netRunRate':
        diff = y.netRunRate - x.netRunRate;
        break;
      case 'goalDifference':
        diff = y.goalDifference - x.goalDifference;
        break;
      case 'goalsScored':
        diff = y.goalsFor - x.goalsFor;
        break;
      case 'totalWins':
        diff = y.won - x.won;
        break;
      case 'headToHead': {
        const xv = h2h.get(`${x.teamId}|${y.teamId}`) ?? 0;
        const yv = h2h.get(`${y.teamId}|${x.teamId}`) ?? 0;
        diff = yv - xv;
        break;
      }
      default:
        diff = 0;
    }
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Compute fully-ranked standings rows for a single group.
 *
 * @param {object}   params
 * @param {string}   params.sport       'cricket' | 'football'
 * @param {object}   params.pointsConfig tournament.pointsConfig
 * @param {string[]} params.teamIds     teams in the group
 * @param {object[]} params.fixtures    completed group fixtures for this group
 * @returns {object[]} standing rows (plain objects, no _id), rank-ordered
 */
export function computeGroupStandings({ sport, pointsConfig, teamIds, fixtures }) {
  const cfg = {
    win: pointsConfig?.win ?? 0,
    draw: pointsConfig?.draw ?? 0,
    loss: pointsConfig?.loss ?? 0,
    noResult: pointsConfig?.noResult ?? 0,
  };

  const rowsById = new Map(teamIds.map((id) => [String(id), emptyRow(id)]));

  const completed = fixtures.filter((f) => f.status === 'completed' && f.result);
  for (const f of completed) {
    if (sport === SPORTS.CRICKET) accumulateCricket(rowsById, f, cfg);
    else accumulateFootball(rowsById, f, cfg);
  }

  // Derived rates / differences.
  for (const row of rowsById.values()) {
    row.netRunRate =
      Number(
        (
          (row.oversFor > 0 ? row.runsFor / row.oversFor : 0) -
          (row.oversAgainst > 0 ? row.runsAgainst / row.oversAgainst : 0)
        ).toFixed(3)
      ) || 0;
    row.goalDifference = row.goalsFor - row.goalsAgainst;
  }

  const order = pointsConfig?.tiebreakerOrder ?? [];
  const h2h = buildHeadToHead(completed, cfg, sport);

  const rows = [...rowsById.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const tb = compareByTiebreakers(x, y, order, h2h);
    if (tb !== 0) return tb;
    return x.teamId.localeCompare(y.teamId); // deterministic final fallback
  });

  rows.forEach((row, i) => {
    row.rank = i + 1;
  });

  return rows;
}
