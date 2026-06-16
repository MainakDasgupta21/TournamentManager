import { describe, it, expect } from 'vitest';
import { computeGroupStandings, oversToDecimal } from '../src/services/standings.js';

const FOOTBALL_CFG = {
  win: 3,
  draw: 1,
  loss: 0,
  noResult: 0,
  tiebreakerOrder: ['goalDifference', 'goalsScored', 'headToHead'],
};
const CRICKET_CFG = {
  win: 2,
  draw: 1,
  loss: 0,
  noResult: 1,
  tiebreakerOrder: ['netRunRate', 'headToHead', 'totalWins'],
};

/** Football fixture. `goals` is a list of { team, type? }. */
const fb = (teamA, teamB, goals, winner) => ({
  teamA,
  teamB,
  status: 'completed',
  result: { goals, result: { winner: winner ?? null } },
});

/** Cricket fixture from explicit innings + outcome. */
const ck = (teamA, teamB, innings, winner, margin) => ({
  teamA,
  teamB,
  status: 'completed',
  result: { innings, result: { winner: winner ?? null, margin } },
});

const byTeam = (rows) => Object.fromEntries(rows.map((r) => [r.teamId, r]));

describe('oversToDecimal', () => {
  it('converts cricket over notation to a true decimal', () => {
    expect(oversToDecimal(20)).toBe(20);
    expect(oversToDecimal(19.4)).toBeCloseTo(19 + 4 / 6, 5);
    expect(oversToDecimal(0)).toBe(0);
  });

  it('clamps an illegal ball count beyond .5', () => {
    expect(oversToDecimal(10.7)).toBeCloseTo(10 + 5 / 6, 5);
  });
});

describe('computeGroupStandings — football', () => {
  it('awards points, tracks goal difference, and ranks correctly', () => {
    const rows = computeGroupStandings({
      sport: 'football',
      pointsConfig: FOOTBALL_CFG,
      teamIds: ['A', 'B', 'C'],
      fixtures: [
        fb('A', 'B', [{ team: 'A' }, { team: 'A' }, { team: 'B' }], 'A'), // A 2-1
        fb('A', 'C', [{ team: 'A' }], 'A'), // A 1-0
        fb('B', 'C', [{ team: 'B' }, { team: 'C' }], null), // 1-1 draw
      ],
    });

    const t = byTeam(rows);
    expect(t.A.points).toBe(6);
    expect(t.A.goalsFor).toBe(3);
    expect(t.A.goalsAgainst).toBe(1);
    expect(t.A.goalDifference).toBe(2);
    expect(t.A.rank).toBe(1);

    // B and C are level on points (1) and GD (-1); B ranks higher on goals scored.
    expect(t.B.points).toBe(1);
    expect(t.C.points).toBe(1);
    expect(t.B.goalsFor).toBe(2);
    expect(t.C.goalsFor).toBe(1);
    expect(t.B.rank).toBe(2);
    expect(t.C.rank).toBe(3);
  });

  it('credits an own goal to the opposing side on the scoreboard', () => {
    const rows = computeGroupStandings({
      sport: 'football',
      pointsConfig: FOOTBALL_CFG,
      teamIds: ['A', 'B'],
      fixtures: [fb('A', 'B', [{ team: 'A', type: 'ownGoal' }], 'B')], // A's OG → B 1-0
    });
    const t = byTeam(rows);
    expect(t.A.goalsFor).toBe(0);
    expect(t.B.goalsFor).toBe(1);
    expect(t.B.points).toBe(3);
    expect(t.A.points).toBe(0);
  });

  it('breaks an all-square tie on head-to-head when GD and goals are equal', () => {
    // A & B both finish on 3 pts, GD 0, GF 3 — but A beat B directly.
    const rows = computeGroupStandings({
      sport: 'football',
      pointsConfig: FOOTBALL_CFG,
      teamIds: ['A', 'B', 'C', 'D'],
      fixtures: [
        fb('A', 'B', [{ team: 'A' }, { team: 'A' }, { team: 'B' }], 'A'), // A 2-1 B
        fb('A', 'C', [{ team: 'C' }, { team: 'C' }, { team: 'A' }], 'C'), // C 2-1 A
        fb('B', 'D', [{ team: 'B' }, { team: 'B' }, { team: 'D' }], 'B'), // B 2-1 D
      ],
    });
    const t = byTeam(rows);
    expect(t.A.points).toBe(3);
    expect(t.B.points).toBe(3);
    expect(t.A.goalDifference).toBe(0);
    expect(t.B.goalDifference).toBe(0);
    expect(t.A.goalsFor).toBe(t.B.goalsFor);
    // Head-to-head decides: A above B. C (GD +1) leads; D trails.
    expect(t.C.rank).toBe(1);
    expect(t.A.rank).toBe(2);
    expect(t.B.rank).toBe(3);
    expect(t.D.rank).toBe(4);
  });
});

describe('computeGroupStandings — cricket', () => {
  it('computes net run rate, using full allotted overs when a side is bowled out', () => {
    const rows = computeGroupStandings({
      sport: 'cricket',
      pointsConfig: CRICKET_CFG,
      teamIds: ['A', 'B'],
      fixtures: [
        ck(
          'A',
          'B',
          [
            { battingTeam: 'A', runs: 160, overs: 20, wickets: 5, allottedOvers: 20 },
            // B is bowled out in 18 overs but NRR must use the full 20 (ICC rule).
            { battingTeam: 'B', runs: 150, overs: 18, wickets: 10, allottedOvers: 20 },
          ],
          'A',
          'runs'
        ),
      ],
    });
    const t = byTeam(rows);
    expect(t.A.points).toBe(2);
    expect(t.B.points).toBe(0);
    expect(t.A.netRunRate).toBeCloseTo(0.5, 3); // 160/20 - 150/20
    expect(t.B.netRunRate).toBeCloseTo(-0.5, 3);
    expect(t.A.rank).toBe(1);
  });

  it('treats a no-result as shared no-result points', () => {
    const rows = computeGroupStandings({
      sport: 'cricket',
      pointsConfig: CRICKET_CFG,
      teamIds: ['A', 'B'],
      fixtures: [ck('A', 'B', [], null, 'noResult')],
    });
    const t = byTeam(rows);
    expect(t.A.noResult).toBe(1);
    expect(t.B.noResult).toBe(1);
    expect(t.A.points).toBe(1);
    expect(t.B.points).toBe(1);
  });

  it('treats a tie as a shared draw', () => {
    const rows = computeGroupStandings({
      sport: 'cricket',
      pointsConfig: CRICKET_CFG,
      teamIds: ['A', 'B'],
      fixtures: [ck('A', 'B', [], null, 'tie')],
    });
    const t = byTeam(rows);
    expect(t.A.drawn).toBe(1);
    expect(t.B.drawn).toBe(1);
    expect(t.A.points).toBe(1);
    expect(t.B.points).toBe(1);
  });

  it('ignores fixtures that are not completed', () => {
    const rows = computeGroupStandings({
      sport: 'cricket',
      pointsConfig: CRICKET_CFG,
      teamIds: ['A', 'B'],
      fixtures: [{ teamA: 'A', teamB: 'B', status: 'scheduled', result: null }],
    });
    const t = byTeam(rows);
    expect(t.A.played).toBe(0);
    expect(t.B.played).toBe(0);
  });
});
