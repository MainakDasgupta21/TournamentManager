/**
 * Round-robin fixture generator using the classic "circle method".
 *
 * For N teams:
 *  - if N is odd we add a BYE placeholder so every real team sits out exactly
 *    one round, in rotation
 *  - team at index 0 is fixed; all others rotate clockwise each round
 *  - this yields N-1 rounds (or N rounds when a bye was added), with every team
 *    playing every other team exactly once
 *
 * Home/away alternation: within a round we alternate which side is "home" and
 * we flip every other round so the home/away balance stays fair. For a double
 * round-robin we append the same schedule with sides swapped (the return leg).
 *
 * @param {Array<string>} teamIds  team ids in seeding order
 * @param {boolean} doubleRoundRobin  generate a return leg with reversed venues
 * @returns {Array<{ round:number, leg:number, matches:Array<{home,away}> }>}
 */
const BYE = Symbol('bye');

export function generateRoundRobin(teamIds, doubleRoundRobin = false) {
  const teams = [...teamIds];
  if (teams.length < 2) return [];

  // Insert a bye for odd counts so the circle method has an even ring.
  const hasBye = teams.length % 2 !== 0;
  if (hasBye) teams.push(BYE);

  const n = teams.length;
  const roundsCount = n - 1;
  const half = n / 2;

  // Mutable ring of everything except the fixed first element.
  const fixed = teams[0];
  let rotating = teams.slice(1);

  const legs = [];

  for (let round = 0; round < roundsCount; round += 1) {
    const ring = [fixed, ...rotating];
    const matches = [];

    for (let i = 0; i < half; i += 1) {
      const t1 = ring[i];
      const t2 = ring[n - 1 - i];
      if (t1 === BYE || t2 === BYE) continue; // skip bye pairing

      // Alternate home/away per slot and per round for fairness.
      const homeFirst = (round + i) % 2 === 0;
      matches.push(
        homeFirst ? { home: t1, away: t2 } : { home: t2, away: t1 }
      );
    }

    legs.push({ round: round + 1, leg: 1, matches });

    // Rotate: last element moves to the front of the rotating section.
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  if (!doubleRoundRobin) return legs;

  // Return leg: identical pairings with home/away reversed, rounds continue.
  const secondLeg = legs.map((r, idx) => ({
    round: roundsCount + idx + 1,
    leg: 2,
    matches: r.matches.map((m) => ({ home: m.away, away: m.home })),
  }));

  return [...legs, ...secondLeg];
}

/**
 * Flattens the round structure into a list of fixture seeds, attaching a
 * sequential match number and a scheduled date that advances by
 * `daysBetweenRounds` per round.
 */
export function buildGroupFixtureSeeds({
  teamIds,
  doubleRoundRobin,
  startDate,
  daysBetweenRounds = 7,
  venue = '',
}) {
  const rounds = generateRoundRobin(teamIds, doubleRoundRobin);
  const seeds = [];
  let matchNumber = 1;
  const base = startDate ? new Date(startDate) : null;

  for (const r of rounds) {
    for (const m of r.matches) {
      let scheduledAt = null;
      if (base) {
        scheduledAt = new Date(base);
        scheduledAt.setDate(base.getDate() + (r.round - 1) * daysBetweenRounds);
      }
      seeds.push({
        teamA: m.home,
        teamB: m.away,
        groupRound: r.round,
        leg: r.leg,
        matchNumber: matchNumber++,
        scheduledAt,
        venue,
      });
    }
  }

  return seeds;
}
