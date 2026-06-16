import { describe, it, expect } from 'vitest';
import {
  seedOrder,
  collectQualifiers,
  generateBracket,
  generatePlayoffBracket,
  computeAdvancement,
} from '../src/services/knockout.js';

describe('seedOrder', () => {
  it('produces standard single-elimination seeding', () => {
    expect(seedOrder(2)).toEqual([1, 2]);
    expect(seedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it('pairs opponents so each round-1 matchup sums to size + 1', () => {
    const size = 8;
    const order = seedOrder(size);
    for (let i = 0; i < order.length; i += 2) {
      expect(order[i] + order[i + 1]).toBe(size + 1);
    }
  });
});

describe('collectQualifiers', () => {
  it('orders qualifiers by position first, then group order, with readable labels', () => {
    const groups = [
      { id: 'g1', shortLabel: 'A', rankedTeamIds: ['a1', 'a2', 'a3'] },
      { id: 'g2', shortLabel: 'B', rankedTeamIds: ['b1', 'b2'] },
    ];
    const quals = collectQualifiers(groups, 2);
    expect(quals.map((q) => q.teamId)).toEqual(['a1', 'b1', 'a2', 'b2']);
    expect(quals.map((q) => q.label)).toEqual(['A1', 'B1', 'A2', 'B2']);
    // a3 is below the qualification cut-off and excluded.
    expect(quals.find((q) => q.teamId === 'a3')).toBeUndefined();
  });

  it('skips positions a group cannot fill', () => {
    const groups = [
      { id: 'g1', shortLabel: 'A', rankedTeamIds: ['a1', 'a2'] },
      { id: 'g2', shortLabel: 'B', rankedTeamIds: ['b1'] }, // only one team
    ];
    const quals = collectQualifiers(groups, 2);
    expect(quals.map((q) => q.teamId)).toEqual(['a1', 'b1', 'a2']);
  });
});

const quals = (n) =>
  Array.from({ length: n }, (_, i) => ({ teamId: `t${i + 1}`, label: `S${i + 1}` }));

describe('generateBracket', () => {
  it('builds named rounds with wired advancement for a power-of-two field', () => {
    const b = generateBracket(quals(4));
    expect(b.bracketSize).toBe(4);
    expect(b.qualifiersCount).toBe(4);
    expect(b.rounds).toHaveLength(2);
    expect(b.rounds[0].roundName).toBe('Semifinals');
    expect(b.rounds[1].roundName).toBe('Final');
    expect(b.rounds[0].matchups).toHaveLength(2);

    // Both semifinal winners feed the single final, into slots A and B.
    expect(b.rounds[0].matchups[0].winnerAdvancesTo).toMatchObject({
      roundIndex: 1,
      matchupIndex: 0,
      slot: 'A',
    });
    expect(b.rounds[0].matchups[1].winnerAdvancesTo).toMatchObject({
      roundIndex: 1,
      matchupIndex: 0,
      slot: 'B',
    });
  });

  it('pads a non-power-of-two field with a bye and auto-advances the top seed', () => {
    const b = generateBracket(quals(3));
    expect(b.bracketSize).toBe(4);
    const byes = b.rounds[0].matchups.filter((m) => m.isBye);
    expect(byes).toHaveLength(1);
    // The top seed (t1) sits in the bye and is pre-advanced into the final.
    expect(byes[0].slotA).toBe('t1');
    expect(b.rounds[1].matchups[0].slotA).toBe('t1');
  });

  it('appends a third-place playoff fed by the semifinal losers', () => {
    const b = generateBracket(quals(4), { thirdPlacePlayoff: true });
    expect(b.thirdPlacePlayoff).toBe(true);
    expect(b.rounds.at(-1).roundName).toBe('Third-place playoff');
    expect(b.rounds[0].matchups[0].loserAdvancesTo).toMatchObject({
      matchupIndex: 0,
      slot: 'A',
    });
    expect(b.rounds[0].matchups[1].loserAdvancesTo).toMatchObject({
      matchupIndex: 0,
      slot: 'B',
    });
  });

  it('requires at least two qualifiers', () => {
    expect(() => generateBracket(quals(1))).toThrow();
  });
});

describe('generatePlayoffBracket (IPL-style)', () => {
  it('gives the top two seeds a second life via Qualifier 2', () => {
    const b = generatePlayoffBracket(quals(4));
    expect(b.format).toBe('playoff');
    expect(b.rounds.map((r) => r.roundName)).toEqual(['Playoffs', 'Qualifier 2', 'Final']);

    const [q1, eliminator] = b.rounds[0].matchups;
    expect(q1.winnerAdvancesTo).toMatchObject({ roundIndex: 2, slot: 'A' }); // → Final
    expect(q1.loserAdvancesTo).toMatchObject({ roundIndex: 1, slot: 'A' }); // → Q2 (not out)
    expect(eliminator.winnerAdvancesTo).toMatchObject({ roundIndex: 1, slot: 'B' });
    expect(eliminator.loserAdvancesTo).toBeNull(); // eliminator loser is out
  });

  it('requires at least four qualifiers', () => {
    expect(() => generatePlayoffBracket(quals(3))).toThrow();
  });
});

describe('computeAdvancement', () => {
  it('routes the winner forward and the semifinal loser to the third-place match', () => {
    const b = generateBracket(quals(4), { thirdPlacePlayoff: true });
    const sf = b.rounds[0].matchups[0];
    const winnerId = sf.slotA;
    const loserId = sf.slotB;

    const edits = computeAdvancement(b, 0, 0, winnerId, loserId);
    expect(edits).toHaveLength(2);

    const winnerEdit = edits.find((e) => e.teamId === String(winnerId));
    const loserEdit = edits.find((e) => e.teamId === String(loserId));
    expect(winnerEdit).toMatchObject({ roundIndex: 1, matchupIndex: 0, slot: 'A' });
    expect(loserEdit.roundIndex).toBe(b.rounds.length - 1); // third-place round
  });

  it('returns no edits for a missing matchup', () => {
    const b = generateBracket(quals(4));
    expect(computeAdvancement(b, 9, 9, 't1', 't2')).toEqual([]);
  });
});
