/**
 * Broadcast commentary generator (Module 8).
 *
 * Turns granular match data (cricket ball-by-ball `oversDetail`, football
 * goal/card/sub events) into a flat list of human commentary lines suitable for
 * a live feed. Pure + derived on read — no extra storage. Returned chronological
 * (oldest first); the UI reverses for a newest-first feed.
 *
 * Each line: `{ id, marker, text, kind }`
 *   - marker: over notation ("12.3") or match minute ("67'")
 *   - kind: 'six' | 'four' | 'wicket' | 'extra' | 'run' | 'goal' | 'owngoal'
 *           | 'yellow' | 'red' | 'sub' | 'info' (drives styling)
 */

const WIDE = 'wide';
const NOBALL = 'noball';
const BYE = 'bye';
const LEGBYE = 'legbye';

const isLegal = (ball) => {
  const t = ball?.extras?.type;
  return t !== WIDE && t !== NOBALL;
};

function nameFrom(map, id, fallback = '') {
  if (!id) return fallback;
  const p = map?.[String(id)];
  if (!p) return fallback;
  return p.name ?? p.shortCode ?? fallback;
}

function teamShort(map, id) {
  const t = map?.[String(id)];
  return t?.shortCode || t?.name || '';
}

/** Describe a single delivery's outcome + classify it. */
function describeBall(ball) {
  if (ball?.isWicket) {
    const how = ball?.wicket?.type ? ` (${ball.wicket.type})` : '';
    return { text: `OUT!${how}`, kind: 'wicket' };
  }
  const type = ball?.extras?.type;
  const extraRuns = Number(ball?.extras?.runs ?? 0);
  const off = Number(ball?.runsScored ?? 0);

  if (type === WIDE) return { text: extraRuns > 1 ? `wide, ${extraRuns} runs` : 'wide', kind: 'extra' };
  if (type === NOBALL) return { text: off ? `no ball, ${off} run(s) off the bat` : 'no ball', kind: 'extra' };
  if (type === BYE) return { text: `${extraRuns} bye${extraRuns === 1 ? '' : 's'}`, kind: 'extra' };
  if (type === LEGBYE) return { text: `${extraRuns} leg bye${extraRuns === 1 ? '' : 's'}`, kind: 'extra' };

  if (off === 6) return { text: 'SIX!', kind: 'six' };
  if (off === 4) return { text: 'FOUR!', kind: 'four' };
  if (off === 0) return { text: 'no run', kind: 'run' };
  return { text: `${off} run${off === 1 ? '' : 's'}`, kind: 'run' };
}

/**
 * @param {Array} innings  [{ battingTeam, bowlingTeam, oversDetail }]
 * @param {{ playersById?:object, teamsById?:object }} ctx
 */
export function buildCricketCommentary(innings = [], ctx = {}) {
  const { playersById = {}, teamsById = {} } = ctx;
  const lines = [];

  innings.forEach((inn, inningsIndex) => {
    const overs = inn?.oversDetail ?? [];
    const batShort = teamShort(teamsById, inn?.battingTeam);
    overs.forEach((over) => {
      const overNumber = over.overNumber ?? 0;
      const bowlerName = nameFrom(playersById, over.bowler, 'Bowler');
      let legalInOver = 0;
      (over.balls ?? []).forEach((ball, bi) => {
        const ballInOver = legalInOver + 1; // wides/no-balls share the upcoming ball number
        if (isLegal(ball)) legalInOver += 1;
        const batsman = nameFrom(playersById, ball.batsman, 'Batsman');
        const d = describeBall(ball);
        const wicketWho =
          ball?.isWicket && ball?.wicket?.playerOut
            ? ` ${nameFrom(playersById, ball.wicket.playerOut, batsman)} is gone.`
            : '';
        lines.push({
          id: `c-${inningsIndex}-${overNumber}-${bi}`,
          marker: `${overNumber}.${ballInOver}`,
          text: `${bowlerName} to ${batsman}, ${d.text}${wicketWho}`,
          kind: d.kind,
          inningsIndex,
          batShort,
        });
      });
    });
  });

  return lines;
}

/**
 * @param {{ goals?:Array, cards?:Array, substitutions?:Array }} events
 * @param {{ playersById?:object, teamsById?:object }} ctx
 */
export function buildFootballCommentary(events = {}, ctx = {}) {
  const { playersById = {}, teamsById = {} } = ctx;
  const out = [];
  const minuteOf = (e) => (e?.minute == null ? 0 : Number(e.minute));

  (events.goals ?? []).forEach((g, i) => {
    const scorer = g.scorer || nameFrom(playersById, g.playerId, 'Goal');
    const ts = teamShort(teamsById, g.team);
    if (g.type === 'ownGoal') {
      out.push({ id: `g-${i}`, marker: g.minute != null ? `${g.minute}'` : '', sort: minuteOf(g),
        text: `Own goal — ${scorer} (${ts})`, kind: 'owngoal' });
    } else {
      const assist = g.assist || nameFrom(playersById, g.assistId, '');
      const tail = assist ? ` (assist: ${assist})` : '';
      const pen = g.type === 'penalty' ? ' (penalty)' : g.type === 'freeKick' ? ' (free kick)' : '';
      out.push({ id: `g-${i}`, marker: g.minute != null ? `${g.minute}'` : '', sort: minuteOf(g),
        text: `GOAL! ${scorer}${pen} (${ts})${tail}`, kind: 'goal' });
    }
  });

  (events.cards ?? []).forEach((c, i) => {
    const who = c.player || nameFrom(playersById, c.playerId, 'Player');
    const ts = teamShort(teamsById, c.team);
    out.push({ id: `cd-${i}`, marker: c.minute != null ? `${c.minute}'` : '', sort: minuteOf(c),
      text: `${c.type === 'red' ? 'Red' : 'Yellow'} card — ${who} (${ts})`, kind: c.type === 'red' ? 'red' : 'yellow' });
  });

  (events.substitutions ?? []).forEach((s, i) => {
    const inName = s.playerIn || nameFrom(playersById, s.playerInId, '');
    const outName = s.playerOut || nameFrom(playersById, s.playerOutId, '');
    const ts = teamShort(teamsById, s.team);
    out.push({ id: `s-${i}`, marker: s.minute != null ? `${s.minute}'` : '', sort: minuteOf(s),
      text: `Substitution (${ts}) — ${inName || 'sub'} on${outName ? `, ${outName} off` : ''}`, kind: 'sub' });
  });

  return out.sort((a, b) => a.sort - b.sort).map(({ sort, ...rest }) => rest);
}

/** Convenience: build commentary from a fixture-like object + live snapshot. */
export function buildCommentary(sport, { result, live } = {}, ctx = {}) {
  if (sport === 'cricket') {
    const innings = live?.innings ?? result?.innings ?? [];
    return buildCricketCommentary(innings, ctx);
  }
  const events = {
    goals: live?.goals ?? result?.goals ?? [],
    cards: live?.cards ?? result?.cards ?? [],
    substitutions: live?.substitutions ?? result?.substitutions ?? [],
  };
  return buildFootballCommentary(events, ctx);
}
