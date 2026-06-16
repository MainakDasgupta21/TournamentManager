/**
 * Win predictor (Module 8) — a deliberately simple, transparent model. It is a
 * heuristic, not a betting engine: cricket uses required run rate + wickets in
 * hand; football uses goal margin + minutes remaining. Everything is pure.
 */

const id = (v) => (v == null ? null : String(v));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Cricket "overs notation" (1.4 = 1 over 4 balls) -> legal-ball count. */
function oversToBalls(overs) {
  const o = Number(overs ?? 0);
  const whole = Math.floor(o);
  const balls = Math.round((o - whole) * 10);
  return whole * 6 + Math.min(balls, 5);
}

/**
 * @returns {{ a:number, b:number, note:string, chasing?:string, runsNeeded?:number, ballsRemaining?:number } | null}
 */
export function cricketWinProbability({ innings = [], teamA, teamB, allottedOvers } = {}) {
  if (!innings.length) return null;

  const allot =
    allottedOvers ||
    innings[0]?.allottedOvers ||
    Math.max(...innings.map((i) => Math.ceil(Number(i.overs || 0))), 0) ||
    20;

  if (innings.length < 2) {
    return { a: 50, b: 50, note: 'First innings in progress — too early to call.' };
  }

  const first = innings[0];
  const second = innings[1];
  const target = Number(first.runs || 0) + 1;
  const scored = Number(second.runs || 0);
  const wickets = Number(second.wickets || 0);
  const ballsBowled = oversToBalls(second.overs);
  const ballsRemaining = Math.max(0, allot * 6 - ballsBowled);
  const chasing = id(second.battingTeam);
  const runsNeeded = target - scored;

  let chaseProb;
  if (runsNeeded <= 0) chaseProb = 1;
  else if (wickets >= 10 || ballsRemaining <= 0) chaseProb = 0;
  else {
    const wicketsInHand = 10 - wickets;
    const reqRate = runsNeeded / (ballsRemaining / 6);
    const rateFactor = clamp(1 - (reqRate - 6) / 12, 0, 1); // ~6 rpo is neutral
    const wktFactor = wicketsInHand / 10;
    chaseProb = clamp(0.12 + 0.55 * rateFactor + 0.33 * wktFactor, 0.02, 0.98);
  }

  const chaseIsA = chasing === id(teamA);
  const a = Math.round((chaseIsA ? chaseProb : 1 - chaseProb) * 100);
  const note =
    runsNeeded > 0
      ? `Need ${runsNeeded} run${runsNeeded === 1 ? '' : 's'} off ${ballsRemaining} ball${ballsRemaining === 1 ? '' : 's'}.`
      : 'Target reached.';

  return { a, b: 100 - a, note, chasing, runsNeeded, ballsRemaining };
}

/**
 * @returns {{ a:number, b:number, draw:number, note:string }}
 */
export function footballWinProbability({ goalsA = 0, goalsB = 0, minute = 0, completed = false } = {}) {
  const min = completed ? 90 : clamp(Number(minute || 0), 0, 90);
  const remaining = Math.max(0, 90 - min);
  const diff = Number(goalsA) - Number(goalsB);

  if (completed) {
    if (diff > 0) return { a: 100, b: 0, draw: 0, note: 'Full time.' };
    if (diff < 0) return { a: 0, b: 100, draw: 0, note: 'Full time.' };
    return { a: 0, b: 0, draw: 100, note: 'Full time — drawn.' };
  }

  // Sharper as time runs out.
  const k = 0.8 + (1 - remaining / 90) * 1.6;
  const pa = 1 / (1 + Math.exp(-diff * k));
  const pb = 1 / (1 + Math.exp(diff * k));
  const draw = clamp(Math.exp(-Math.abs(diff) * 1.2) * (0.15 + 0.5 * (1 - remaining / 90)), 0, 0.85);

  const rem = 1 - draw;
  const total = pa + pb || 1;
  const a = Math.round(rem * (pa / total) * 100);
  const b = Math.round(rem * (pb / total) * 100);
  const drawPct = clamp(100 - a - b, 0, 100);

  return { a, b, draw: drawPct, note: `${remaining}' remaining (approx).` };
}

/** Unified entry point used by the Match Center. */
export function winProbability(sport, params = {}) {
  return sport === 'cricket' ? cricketWinProbability(params) : footballWinProbability(params);
}
