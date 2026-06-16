import { format, formatDistanceToNowStrict, isValid } from 'date-fns';

export function formatDate(value, fmt = 'dd MMM yyyy') {
  if (!value) return 'TBD';
  const d = new Date(value);
  return isValid(d) ? format(d, fmt) : 'TBD';
}

export function formatDateTime(value) {
  if (!value) return 'Date TBD';
  const d = new Date(value);
  return isValid(d) ? format(d, "dd MMM yyyy 'at' HH:mm") : 'Date TBD';
}

export function fromNow(value) {
  if (!value) return '';
  const d = new Date(value);
  return isValid(d) ? formatDistanceToNowStrict(d, { addSuffix: true }) : '';
}

/** Cricket over notation: 19.667 -> "19.4". */
export function decimalToOvers(dec) {
  if (!dec) return '0.0';
  const whole = Math.floor(dec);
  const balls = Math.round((dec - whole) * 6);
  return `${whole}.${balls}`;
}

/**
 * Display an overs value that is already in cricket notation (integer = overs,
 * first decimal = balls, e.g. 1.5 = 1 over 5 balls). Normalises "1" -> "1.0".
 */
export function oversDisplay(overs) {
  const n = Number(overs ?? 0);
  const whole = Math.floor(n);
  const balls = Math.round((n - whole) * 10);
  return `${whole}.${Math.min(balls, 5)}`;
}

export function sportLabel(sport) {
  return sport === 'cricket' ? 'Cricket' : 'Football';
}

const sameTeam = (a, b) => String(a) === String(b);

/**
 * Football goals per team for a fixture, crediting own goals to the opponent.
 * Shared by the fixture card and the match detail panel so both always agree.
 */
export function footballScore(fixture) {
  const { teamA, teamB, result } = fixture ?? {};
  let a = 0;
  let b = 0;
  for (const g of result?.goals ?? []) {
    const scoringId = g.type === 'ownGoal'
      ? (sameTeam(g.team, teamA?._id) ? teamB?._id : teamA?._id)
      : g.team;
    if (sameTeam(scoringId, teamA?._id)) a += 1;
    else if (sameTeam(scoringId, teamB?._id)) b += 1;
  }
  return { a, b };
}

/** A team's cricket innings line `{ runs, wickets, overs }`, or null if they didn't bat. */
export function cricketTeamScore(fixture, teamId) {
  const inn = fixture?.result?.innings?.find((i) => sameTeam(i.battingTeam, teamId));
  if (!inn) return null;
  return { runs: inn.runs ?? 0, wickets: inn.wickets ?? 0, overs: inn.overs ?? 0 };
}

/** Short summary line for a completed fixture, sport-aware. */
export function resultSummary(fixture) {
  if (!fixture?.result) return '';
  if (fixture.result.innings) {
    const inn = fixture.result.innings
      .map((i) => `${i.runs}/${i.wickets}`)
      .join('  •  ');
    return inn;
  }
  if (fixture.result.goals) {
    const a = fixture.result.goals.filter((g) => String(g.team) === String(fixture.teamA?._id)).length;
    const b = fixture.result.goals.filter((g) => String(g.team) === String(fixture.teamB?._id)).length;
    return `${a} - ${b}`;
  }
  return '';
}
