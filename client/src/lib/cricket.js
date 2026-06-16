/**
 * Pure cricket scoring helpers shared by the live ball-by-ball console and the
 * scorecard display. Mirrors the server's `matchDerive` conventions so client
 * and server agree on totals.
 */

export const WIDE = 'wide';
export const NOBALL = 'noball';
export const BYE = 'bye';
export const LEGBYE = 'legbye';

/** Wides and no-balls are not legal deliveries (they don't advance the over). */
export function isLegalBall(ball) {
  const t = ball?.extras?.type;
  return t !== WIDE && t !== NOBALL;
}

/** Total runs a delivery adds to the team score. */
export function ballRuns(ball) {
  const off = Number(ball?.runsScored ?? 0);
  const extra = Number(ball?.extras?.runs ?? 0);
  const penalty = ball?.extras?.type === WIDE || ball?.extras?.type === NOBALL ? 1 : 0;
  return off + extra + penalty;
}

/** Cricket over notation from a count of legal balls (e.g. 14 -> "2.2"). */
export function oversString(legalBalls) {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}

/** Running summary for an innings expressed as a flat list of balls. */
export function inningsSummary(balls = []) {
  let runs = 0;
  let wickets = 0;
  let legal = 0;
  for (const b of balls) {
    runs += ballRuns(b);
    if (b.isWicket) wickets += 1;
    if (isLegalBall(b)) legal += 1;
  }
  return { runs, wickets, legalBalls: legal, overs: oversString(legal) };
}

/** Group a flat ball list into overs of 6 legal deliveries (for `oversDetail`). */
export function buildOvers(balls = []) {
  const overs = [];
  let current = null;
  let legalInOver = 0;
  let overNumber = 0;

  for (const b of balls) {
    if (!current) current = { overNumber, bowler: b.bowler ?? null, balls: [] };
    current.balls.push({ ...b, ballNumber: current.balls.length + 1 });
    if (isLegalBall(b)) legalInOver += 1;
    if (legalInOver >= 6) {
      overs.push(current);
      overNumber += 1;
      legalInOver = 0;
      current = null;
    }
  }
  if (current) overs.push(current);
  return overs;
}

/** Flatten server `oversDetail` back into a flat ball list (for editing/resume). */
export function flattenOvers(oversDetail = []) {
  const balls = [];
  for (const over of oversDetail) {
    for (const b of over.balls ?? []) {
      balls.push({ ...b, bowler: b.bowler ?? over.bowler ?? null });
    }
  }
  return balls;
}

/** True if a legal-ball count sits exactly on an over boundary (>0). */
export function isOverComplete(legalBalls) {
  return legalBalls > 0 && legalBalls % 6 === 0;
}

/** A compact label for a single delivery, e.g. "4", "W", "Wd", "1nb". */
export function ballLabel(ball) {
  if (ball.isWicket) return 'W';
  const t = ball?.extras?.type;
  const runs = Number(ball?.runsScored ?? 0) + Number(ball?.extras?.runs ?? 0);
  if (t === WIDE) return runs ? `${runs}wd` : 'wd';
  if (t === NOBALL) return runs ? `${runs}nb` : 'nb';
  if (t === BYE) return `${runs}b`;
  if (t === LEGBYE) return `${runs}lb`;
  return String(Number(ball?.runsScored ?? 0));
}
