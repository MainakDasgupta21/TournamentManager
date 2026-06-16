import { describe, it, expect } from 'vitest';
import {
  ballsToOvers,
  deriveCricketInnings,
  deriveCricketPlayerStats,
  deriveFootballGoals,
  deriveFootballPlayerStats,
  deriveFootballTeamCredits,
  lineupPlayerIds,
} from '../src/services/matchDerive.js';

describe('ballsToOvers', () => {
  it('converts a legal-ball count to cricket over notation', () => {
    expect(ballsToOvers(0)).toBe(0);
    expect(ballsToOvers(6)).toBe(1);
    expect(ballsToOvers(7)).toBe(1.1);
    expect(ballsToOvers(11)).toBe(1.5);
  });
});

// One over containing: a four, a wide, a six, a wicket, then three singles/dots.
const sampleOver = {
  overNumber: 0,
  bowler: 'b1',
  balls: [
    { batsman: 'p1', runsScored: 4 },
    { batsman: 'p1', runsScored: 0, extras: { type: 'wide', runs: 0 } },
    { batsman: 'p1', runsScored: 6 },
    { batsman: 'p2', runsScored: 0, isWicket: true, wicket: { playerOut: 'p1', bowlerCredited: 'b1' } },
    { batsman: 'p2', runsScored: 1 },
    { batsman: 'p2', runsScored: 2 },
    { batsman: 'p2', runsScored: 0 },
  ],
};

describe('deriveCricketInnings', () => {
  it('derives totals from ball-by-ball detail (wides count to the score, not the over)', () => {
    const inn = deriveCricketInnings({ battingTeam: 'A', oversDetail: [sampleOver] });
    expect(inn.battingTeam).toBe('A');
    expect(inn.runs).toBe(14); // 4 + wide(1) + 6 + 0 + 1 + 2 + 0
    expect(inn.wickets).toBe(1);
    expect(inn.extras).toBe(1); // just the wide
    expect(inn.overs).toBe(1); // 6 legal balls = 1.0 overs
  });

  it('trusts aggregate fields when no ball-by-ball detail is present', () => {
    const inn = deriveCricketInnings({ battingTeam: 'A', runs: 150, wickets: 4, overs: 20 });
    expect(inn.runs).toBe(150);
    expect(inn.wickets).toBe(4);
    expect(inn.overs).toBe(20);
  });
});

describe('deriveCricketPlayerStats', () => {
  const stats = deriveCricketPlayerStats({ result: { innings: [{ battingTeam: 'A', oversDetail: [sampleOver] }] } });

  it('credits the striker with runs, boundaries, balls faced and dismissal', () => {
    const p1 = stats.get('p1');
    expect(p1.runs).toBe(10); // 4 + 6
    expect(p1.fours).toBe(1);
    expect(p1.sixes).toBe(1);
    expect(p1.ballsFaced).toBe(2); // wide is not a ball faced
    expect(p1.out).toBe(true);
    expect(p1.batInnings).toBe(1);
  });

  it('tracks the second batter who was not dismissed', () => {
    const p2 = stats.get('p2');
    expect(p2.runs).toBe(3); // 1 + 2 + 0
    expect(p2.ballsFaced).toBe(4);
    expect(p2.out).toBe(false);
  });

  it('charges the bowler with runs, balls and the credited wicket', () => {
    const b1 = stats.get('b1');
    expect(b1.bowlInnings).toBe(1);
    expect(b1.ballsBowled).toBe(6);
    expect(b1.runsConceded).toBe(14);
    expect(b1.wickets).toBe(1);
    expect(b1.maidens).toBe(0);
  });
});

describe('deriveFootballGoals', () => {
  it('credits an own goal to the opposing team', () => {
    const result = { goals: [{ team: 'A' }, { team: 'A', type: 'ownGoal' }] };
    expect(deriveFootballGoals(result, 'A', 'B')).toEqual({ goalsA: 1, goalsB: 1 });
  });

  it('returns zeros for a goalless game', () => {
    expect(deriveFootballGoals({ goals: [] }, 'A', 'B')).toEqual({ goalsA: 0, goalsB: 0 });
  });
});

describe('deriveFootballPlayerStats', () => {
  const stats = deriveFootballPlayerStats({
    result: {
      goals: [
        { playerId: 's1', assistId: 'a1' },
        { playerId: 'og1', type: 'ownGoal' },
      ],
      cards: [
        { playerId: 'c1', type: 'yellow' },
        { playerId: 'c1', type: 'red' },
      ],
    },
  });

  it('credits scorers and assisters without counting own goals as goals', () => {
    expect(stats.get('s1').goals).toBe(1);
    expect(stats.get('a1').assists).toBe(1);
    expect(stats.get('og1').goals).toBe(0);
    expect(stats.get('og1').ownGoals).toBe(1);
  });

  it('tallies cards per player', () => {
    expect(stats.get('c1').yellowCards).toBe(1);
    expect(stats.get('c1').redCards).toBe(1);
  });
});

describe('deriveFootballTeamCredits', () => {
  // A: keeper, forward, defender, plus an unused bench defender. B: keeper + forward.
  const rosterByTeam = {
    A: [
      { _id: 'gkA', role: 'GK', teamId: 'A' },
      { _id: 'fwA', role: 'FW', teamId: 'A' },
      { _id: 'defA', role: 'DEF', teamId: 'A' },
      { _id: 'benchA', role: 'DEF', teamId: 'A' },
    ],
    B: [
      { _id: 'gkB', role: 'GK', teamId: 'B' },
      { _id: 'fwB', role: 'FW', teamId: 'B' },
    ],
  };

  it('falls back to event participants + rostered keepers when no lineup is given', () => {
    const fixture = { teamA: 'A', teamB: 'B', result: { goals: [{ team: 'A', playerId: 'fwA' }] } };
    const c = deriveFootballTeamCredits(fixture, rosterByTeam);

    expect(c.get('gkA')).toMatchObject({ appeared: true, cleanSheets: 1, goalsConcededByTeam: 0 });
    expect(c.get('fwA').appeared).toBe(true);
    expect(c.get('gkB')).toMatchObject({ appeared: true, cleanSheets: 0, goalsConcededByTeam: 1 });
    // A non-scoring outfielder with no event and no lineup gets no appearance.
    expect(c.get('defA')).toBeUndefined();
    expect(c.get('benchA')).toBeUndefined();
  });

  it('credits appearances + clean sheet from the named XI (bench excluded)', () => {
    const fixture = {
      teamA: 'A',
      teamB: 'B',
      result: {
        goals: [{ team: 'A', playerId: 'fwA' }],
        lineups: { teamA: ['gkA', 'fwA', 'defA'], teamB: ['gkB', 'fwB'] },
      },
    };
    const c = deriveFootballTeamCredits(fixture, rosterByTeam);

    // The defender who touched no event still earns an appearance from the XI…
    expect(c.get('defA').appeared).toBe(true);
    // …while the keeper named in the XI keeps the clean sheet.
    expect(c.get('gkA')).toMatchObject({ appeared: true, cleanSheets: 1, goalsConcededByTeam: 0 });
    expect(c.get('fwB').appeared).toBe(true);
    expect(c.get('gkB')).toMatchObject({ appeared: true, cleanSheets: 0, goalsConcededByTeam: 1 });
    // The bench player left out of the XI gets nothing.
    expect(c.get('benchA')).toBeUndefined();
  });

  it('falls back to the rostered keeper when the XI names none', () => {
    const fixture = {
      teamA: 'A',
      teamB: 'B',
      result: { goals: [], lineups: { teamA: ['fwA', 'defA'], teamB: ['fwB'] } },
    };
    const c = deriveFootballTeamCredits(fixture, rosterByTeam);
    // 0-0: both keepers (fallback, since neither XI lists a GK) keep clean sheets.
    expect(c.get('gkA')).toMatchObject({ appeared: true, cleanSheets: 1 });
    expect(c.get('gkB')).toMatchObject({ appeared: true, cleanSheets: 1 });
    expect(c.get('fwA').appeared).toBe(true);
  });

  it('charges goals conceded and withholds the clean sheet when the side concedes', () => {
    const fixture = {
      teamA: 'A',
      teamB: 'B',
      result: {
        goals: [{ team: 'B', playerId: 'fwB' }, { team: 'B', playerId: 'fwB' }],
        lineups: { teamA: ['gkA', 'fwA'], teamB: ['gkB', 'fwB'] },
      },
    };
    const c = deriveFootballTeamCredits(fixture, rosterByTeam);
    expect(c.get('gkA')).toMatchObject({ cleanSheets: 0, goalsConcededByTeam: 2 });
    expect(c.get('gkB')).toMatchObject({ cleanSheets: 1, goalsConcededByTeam: 0 });
  });
});

describe('lineupPlayerIds', () => {
  it('flattens and de-dupes both sides of a stored lineup', () => {
    const ids = lineupPlayerIds({ lineups: { teamA: ['p1', 'p2'], teamB: ['p2', 'p3'] } });
    expect(ids.sort()).toEqual(['p1', 'p2', 'p3']);
  });

  it('returns an empty list when there are no lineups', () => {
    expect(lineupPlayerIds({})).toEqual([]);
    expect(lineupPlayerIds(null)).toEqual([]);
  });
});
