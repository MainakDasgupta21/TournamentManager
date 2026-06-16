import { describe, it, expect } from 'vitest';
import { generateRoundRobin, buildGroupFixtureSeeds } from '../src/services/roundRobin.js';

/** Collect the set of unordered pairings (e.g. "A|B") across every round. */
function pairKeys(rounds) {
  const keys = [];
  for (const r of rounds) {
    for (const m of r.matches) {
      keys.push([m.home, m.away].sort().join('|'));
    }
  }
  return keys;
}

/** Assert no team appears more than once within any single round. */
function noTeamTwicePerRound(rounds) {
  return rounds.every((r) => {
    const seen = new Set();
    for (const m of r.matches) {
      if (seen.has(m.home) || seen.has(m.away)) return false;
      seen.add(m.home);
      seen.add(m.away);
    }
    return true;
  });
}

describe('generateRoundRobin', () => {
  it('returns no rounds for fewer than 2 teams', () => {
    expect(generateRoundRobin([])).toEqual([]);
    expect(generateRoundRobin(['A'])).toEqual([]);
  });

  it('schedules every pair exactly once for an even field (4 teams → 3 rounds, 6 matches)', () => {
    const rounds = generateRoundRobin(['A', 'B', 'C', 'D']);
    expect(rounds).toHaveLength(3);

    const keys = pairKeys(rounds);
    expect(keys).toHaveLength(6); // C(4,2)
    expect(new Set(keys).size).toBe(6); // all distinct
    expect(noTeamTwicePerRound(rounds)).toBe(true);
  });

  it('handles an odd field with rotating byes (3 teams → 3 rounds, 3 matches, one sit-out each)', () => {
    const rounds = generateRoundRobin(['A', 'B', 'C']);
    expect(rounds).toHaveLength(3);

    const keys = pairKeys(rounds);
    expect(keys.sort()).toEqual(['A|B', 'A|C', 'B|C']);
    // Each round has exactly one match (one team byes).
    expect(rounds.every((r) => r.matches.length === 1)).toBe(true);
    expect(noTeamTwicePerRound(rounds)).toBe(true);
  });

  it('does not leak the BYE sentinel into any matchup', () => {
    const rounds = generateRoundRobin(['A', 'B', 'C', 'D', 'E']);
    for (const r of rounds) {
      for (const m of r.matches) {
        expect(typeof m.home).toBe('string');
        expect(typeof m.away).toBe('string');
      }
    }
  });

  it('double round-robin doubles the fixtures with the return leg reversed', () => {
    const single = generateRoundRobin(['A', 'B', 'C', 'D']);
    const double = generateRoundRobin(['A', 'B', 'C', 'D'], true);

    const singleMatches = single.flatMap((r) => r.matches);
    const doubleMatches = double.flatMap((r) => r.matches);
    expect(doubleMatches).toHaveLength(singleMatches.length * 2);

    // Every team still meets every other team — twice now.
    const counts = {};
    for (const k of pairKeys(double)) counts[k] = (counts[k] ?? 0) + 1;
    expect(Object.values(counts).every((c) => c === 2)).toBe(true);

    // Second leg flips home/away of the first leg.
    const leg2 = double.filter((r) => r.leg === 2);
    expect(leg2.length).toBe(single.length);
    const firstLegFirst = single[0].matches[0];
    const returnLegFirst = leg2[0].matches[0];
    expect(returnLegFirst.home).toBe(firstLegFirst.away);
    expect(returnLegFirst.away).toBe(firstLegFirst.home);

    // Rounds keep counting up across legs.
    expect(double.map((r) => r.round)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe('buildGroupFixtureSeeds', () => {
  it('numbers matches sequentially from 1 and maps home/away to teamA/teamB', () => {
    const seeds = buildGroupFixtureSeeds({ teamIds: ['A', 'B', 'C', 'D'] });
    expect(seeds).toHaveLength(6);
    expect(seeds.map((s) => s.matchNumber)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const s of seeds) {
      expect(s.teamA).toBeTruthy();
      expect(s.teamB).toBeTruthy();
      expect(s.leg).toBe(1);
      expect(s.scheduledAt).toBeNull(); // no startDate provided
    }
  });

  it('advances scheduledAt by daysBetweenRounds per round when a startDate is given', () => {
    const start = new Date('2026-01-01T10:00:00.000Z');
    const seeds = buildGroupFixtureSeeds({
      teamIds: ['A', 'B', 'C', 'D'],
      startDate: start,
      daysBetweenRounds: 7,
    });

    const round1 = seeds.filter((s) => s.groupRound === 1);
    const round2 = seeds.filter((s) => s.groupRound === 2);
    expect(round1.length).toBeGreaterThan(0);
    expect(round2.length).toBeGreaterThan(0);

    // Round 1 starts on the start date; round 2 is 7 days later.
    expect(round1[0].scheduledAt.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(round2[0].scheduledAt.toISOString().slice(0, 10)).toBe('2026-01-08');
  });
});
