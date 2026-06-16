/**
 * Qualification "what-if" calculator (points-based).
 *
 * Given a group's current standings and its not-yet-played fixtures, classify
 * each team as already qualified, still in contention, or eliminated — using a
 * transparent points-projection (the classic "magic number" reasoning):
 *
 *   - maxPoints   = current points + win points × games left
 *   - qualified   : even if every rival wins out, fewer than `qualifyCount`
 *                   teams can finish above this team's *current* points
 *   - eliminated  : at least `qualifyCount` teams already have more points than
 *                   this team could *ever* reach
 *   - contention  : anything in between
 *
 * This intentionally ignores NRR / goal-difference tiebreakers, so a result at
 * the exact points boundary stays "in contention" rather than being called
 * either way. It is a guide, not a guarantee — surface that in the UI.
 */

const idOf = (v) => String(v?._id ?? v);

/**
 * @param {object}   params
 * @param {object[]} params.rows         standings rows (rank order), each with
 *                                        `{ teamId (populated), points, played }`
 * @param {object[]} params.fixtures     all tournament fixtures (populated teams)
 * @param {string}   params.groupId      the group these rows belong to
 * @param {number}   params.winPoints    points awarded for a win
 * @param {number}   params.qualifyCount how many teams advance from the group
 * @returns {{ remainingFixtures:number, qualifyCount:number, teams:object[] }}
 */
export function qualificationScenarios({ rows = [], fixtures = [], groupId, winPoints = 3, qualifyCount = 2 }) {
  const gid = String(groupId);
  const ids = new Set(rows.map((r) => idOf(r.teamId)));

  const remainingByTeam = new Map([...ids].map((id) => [id, 0]));
  let remainingFixtures = 0;

  for (const f of fixtures) {
    if (String(f.groupId) !== gid) continue;
    if (f.status === 'completed') continue;
    const a = idOf(f.teamA);
    const b = idOf(f.teamB);
    if (!ids.has(a) && !ids.has(b)) continue;
    remainingFixtures += 1;
    if (remainingByTeam.has(a)) remainingByTeam.set(a, remainingByTeam.get(a) + 1);
    if (remainingByTeam.has(b)) remainingByTeam.set(b, remainingByTeam.get(b) + 1);
  }

  const base = rows.map((r) => {
    const id = idOf(r.teamId);
    const points = Number(r.points ?? 0);
    const remaining = remainingByTeam.get(id) ?? 0;
    return {
      teamId: id,
      name: r.teamId?.name ?? '',
      shortCode: r.teamId?.shortCode ?? '',
      points,
      played: Number(r.played ?? 0),
      remaining,
      maxPoints: points + winPoints * remaining,
    };
  });

  const teams = base.map((t) => {
    const others = base.filter((o) => o.teamId !== t.teamId);
    const rivalsCanPass = others.filter((o) => o.maxPoints > t.points).length;
    const guaranteedAhead = others.filter((o) => o.points > t.maxPoints).length;

    let status = 'contention';
    if (rivalsCanPass < qualifyCount) status = 'qualified';
    else if (guaranteedAhead >= qualifyCount) status = 'eliminated';

    return { ...t, status };
  });

  // Highest current points first, then ceiling, for a stable presentation.
  teams.sort((x, y) => y.points - x.points || y.maxPoints - x.maxPoints);

  return { remainingFixtures, qualifyCount, teams };
}

export const QUALIFICATION_LABELS = {
  qualified: 'Clinched',
  contention: 'In the hunt',
  eliminated: 'Eliminated',
};
