/**
 * Form guide + head-to-head helpers (Module 8). Pure, derived on read from the
 * fixtures list — no extra storage or endpoints. Results are W / D / L from the
 * perspective of a given team; cricket ties count as draws and "no result"
 * matches are skipped entirely.
 */

const idOf = (t) => (t == null ? null : String(t._id ?? t));

function involves(fixture, teamId) {
  const sid = String(teamId);
  return idOf(fixture.teamA) === sid || idOf(fixture.teamB) === sid;
}

/** Chronological order (oldest first), falling back to match number. */
function byChrono(a, b) {
  const ta = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
  const tb = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return (a.matchNumber ?? 0) - (b.matchNumber ?? 0);
}

function opponentOf(fixture, teamId) {
  return idOf(fixture.teamA) === String(teamId) ? fixture.teamB : fixture.teamA;
}

/**
 * 'W' | 'L' | 'D' from `teamId`'s perspective, or `null` when the match doesn't
 * count toward form (not completed, team not involved, or a cricket no-result).
 */
export function outcomeFor(fixture, teamId) {
  if (fixture.status !== 'completed') return null;
  if (!involves(fixture, teamId)) return null;

  const margin = fixture.result?.result?.margin;
  if (margin === 'noResult') return null;

  const winner = idOf(fixture.winner) ?? (fixture.result?.result?.winner ? String(fixture.result.result.winner) : null);
  if (!winner) return 'D'; // draw or tie
  return winner === String(teamId) ? 'W' : 'L';
}

/** Most recent `limit` results for a team (oldest -> newest). */
export function teamForm(fixtures = [], teamId, limit = 5) {
  if (!teamId) return [];
  return fixtures
    .filter((f) => outcomeFor(f, teamId))
    .sort(byChrono)
    .slice(-limit)
    .map((f) => ({
      result: outcomeFor(f, teamId),
      fixtureId: f._id,
      opponent: opponentOf(f, teamId),
      matchNumber: f.matchNumber,
    }));
}

/** Build a `{ [teamId]: formArray }` map for every team appearing in fixtures. */
export function formByTeam(fixtures = [], limit = 5) {
  const ids = new Set();
  for (const f of fixtures) {
    if (idOf(f.teamA)) ids.add(idOf(f.teamA));
    if (idOf(f.teamB)) ids.add(idOf(f.teamB));
  }
  const map = {};
  for (const id of ids) map[id] = teamForm(fixtures, id, limit);
  return map;
}

/**
 * Head-to-head record between two teams across all completed fixtures.
 * @returns {{ aWins:number, bWins:number, draws:number, matches:Array }}
 */
export function headToHead(fixtures = [], aId, bId) {
  if (!aId || !bId) return { aWins: 0, bWins: 0, draws: 0, matches: [] };
  const matches = fixtures
    .filter((f) => f.status === 'completed' && involves(f, aId) && involves(f, bId))
    .sort(byChrono);

  let aWins = 0;
  let bWins = 0;
  let draws = 0;
  for (const f of matches) {
    const o = outcomeFor(f, aId);
    if (o === 'W') aWins += 1;
    else if (o === 'L') bWins += 1;
    else if (o === 'D') draws += 1;
  }
  return { aWins, bWins, draws, matches };
}
