/**
 * Knockout bracket engine (Module 6).
 *
 * Strategy:
 *  1. Collect qualifiers from each group's ranked standings (top N per group).
 *  2. Build a flat strength-ordered seed list, positions first then group order:
 *       [A1, B1, C1, ...,  A2, B2, C2, ...]
 *     Combined with standard single-elimination seeding (where round-1
 *     opponents always sum to bracketSize+1), this naturally produces the
 *     desired cross-group pairings (group winner vs a *different* group's
 *     runner-up) and keeps same-group rematches out of the first round.
 *  3. If the field is not a power of two, pad the weakest seeds with byes;
 *     standard seeding then routes those byes to the highest seeds.
 *  4. Pre-resolve byes by auto-advancing the present team into the next round.
 *  5. Optionally append a third-place playoff fed by the semifinal losers.
 *
 * The output is a pure data structure (no DB); the controller persists it as a
 * KnockoutBracket plus Fixture documents and the admin may adjust it before
 * locking.
 */

const ROUND_NAME_BY_MATCHUPS = {
  1: 'Final',
  2: 'Semifinals',
  4: 'Quarterfinals',
  8: 'Round of 16',
  16: 'Round of 32',
  32: 'Round of 64',
};

const roundName = (matchups) =>
  ROUND_NAME_BY_MATCHUPS[matchups] ?? `Round of ${matchups * 2}`;

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/**
 * Standard single-elimination seed slot order for a power-of-two size.
 * e.g. seedOrder(8) -> [1,8,4,5,2,7,3,6]; consecutive pairs are round-1
 * matchups and every pair of opponents sums to size+1.
 */
export function seedOrder(size) {
  let seeds = [1];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

/**
 * Build the ordered qualifier list from ranked groups.
 * @param {Array<{ id:string, shortLabel:string, rankedTeamIds:string[] }>} groups
 * @param {number} qualifiersPerGroup
 * @returns {Array<{ teamId:string, label:string, groupId:string, position:number }>}
 */
export function collectQualifiers(groups, qualifiersPerGroup) {
  const byPosition = [];
  for (let pos = 0; pos < qualifiersPerGroup; pos += 1) {
    for (const g of groups) {
      const teamId = g.rankedTeamIds[pos];
      if (!teamId) continue; // group smaller than qualifiersPerGroup
      byPosition.push({
        teamId: String(teamId),
        label: `${g.shortLabel}${pos + 1}`,
        groupId: String(g.id),
        position: pos,
      });
    }
  }
  return byPosition;
}

function emptyMatchup(extra = {}) {
  return {
    fixtureId: null,
    slotA: null,
    slotB: null,
    matchupName: '',
    slotALabel: '',
    slotBLabel: '',
    winnerAdvancesTo: null,
    loserAdvancesTo: null,
    isBye: false,
    isThirdPlace: false,
    ...extra,
  };
}

/**
 * Generate the full bracket structure.
 * @param {Array} orderedQualifiers  output of collectQualifiers (strength order)
 * @param {object} options
 * @param {boolean} options.thirdPlacePlayoff
 * @returns {{ rounds: Array, thirdPlacePlayoff: boolean, bracketSize: number, qualifiersCount: number }}
 */
export function generateBracket(orderedQualifiers, { thirdPlacePlayoff = false } = {}) {
  const M = orderedQualifiers.length;
  if (M < 2) {
    throw new Error('At least 2 qualifiers are required to build a knockout bracket');
  }

  const N = nextPowerOfTwo(M);
  const slots = seedOrder(N);
  // seed rank (1-based) -> qualifier or null (bye)
  const seedToQual = (rank) => (rank <= M ? orderedQualifiers[rank - 1] : null);

  const rounds = [];

  // ---- First round ----
  const firstRound = { roundName: roundName(N / 2), matchups: [] };
  for (let j = 0; j < N / 2; j += 1) {
    const qA = seedToQual(slots[2 * j]);
    const qB = seedToQual(slots[2 * j + 1]);
    const isBye = !qA || !qB;
    firstRound.matchups.push(
      emptyMatchup({
        slotA: qA?.teamId ?? null,
        slotB: qB?.teamId ?? null,
        slotALabel: qA?.label ?? 'BYE',
        slotBLabel: qB?.label ?? 'BYE',
        isBye,
      })
    );
  }
  rounds.push(firstRound);

  // ---- Subsequent rounds (empty, filled by advancement) ----
  let matchupsInRound = N / 4;
  while (matchupsInRound >= 1) {
    const r = { roundName: roundName(matchupsInRound), matchups: [] };
    for (let j = 0; j < matchupsInRound; j += 1) r.matchups.push(emptyMatchup());
    rounds.push(r);
    matchupsInRound /= 2;
  }

  // ---- Wire winnerAdvancesTo links ----
  for (let r = 0; r < rounds.length - 1; r += 1) {
    rounds[r].matchups.forEach((m, k) => {
      m.winnerAdvancesTo = {
        roundIndex: r + 1,
        matchupIndex: Math.floor(k / 2),
        slot: k % 2 === 0 ? 'A' : 'B',
      };
    });
  }

  // ---- Pre-resolve byes: auto-advance the present team ----
  for (const m of rounds[0].matchups) {
    if (!m.isBye) continue;
    const advancing = m.slotA ?? m.slotB;
    const advancingLabel = m.slotA ? m.slotALabel : m.slotBLabel;
    const target = m.winnerAdvancesTo;
    if (advancing && target) {
      const dest = rounds[target.roundIndex].matchups[target.matchupIndex];
      dest[`slot${target.slot}`] = advancing;
      dest[`slot${target.slot}Label`] = advancingLabel;
    }
  }

  // ---- Optional third-place playoff fed by semifinal losers ----
  let appliedThirdPlace = false;
  if (thirdPlacePlayoff && N >= 4) {
    const semiIndex = rounds.findIndex((r) => r.matchups.length === 2);
    if (semiIndex !== -1) {
      const thirdRound = {
        roundName: 'Third-place playoff',
        matchups: [
          emptyMatchup({
            isThirdPlace: true,
            slotALabel: 'Loser SF1',
            slotBLabel: 'Loser SF2',
          }),
        ],
      };
      const thirdIndex = rounds.length; // appended at the end
      rounds.push(thirdRound);
      rounds[semiIndex].matchups[0].loserAdvancesTo = {
        roundIndex: thirdIndex,
        matchupIndex: 0,
        slot: 'A',
      };
      rounds[semiIndex].matchups[1].loserAdvancesTo = {
        roundIndex: thirdIndex,
        matchupIndex: 0,
        slot: 'B',
      };
      appliedThirdPlace = true;
    }
  }

  return { rounds, thirdPlacePlayoff: appliedThirdPlace, bracketSize: N, qualifiersCount: M };
}

/**
 * IPL-style top-4 playoff bracket.
 *
 *   Qualifier 1 : seed1 v seed2  -> winner to Final,  loser to Qualifier 2
 *   Eliminator  : seed3 v seed4  -> winner to Qualifier 2, loser out
 *   Qualifier 2 : (loser Q1) v (winner Eliminator) -> winner to Final, loser out
 *   Final       : (winner Q1) v (winner Q2)
 *
 * The top two seeds get a second life: losing Qualifier 1 is not elimination.
 * The shared matchup/advancement model carries this entirely via the existing
 * winnerAdvancesTo / loserAdvancesTo links, so advancement + reconciliation
 * (recalcService) work unchanged.
 *
 * @param {Array} orderedQualifiers strength-ordered; the first four are used
 * @returns {{ rounds, thirdPlacePlayoff:boolean, bracketSize:number, qualifiersCount:number, format:string }}
 */
export function generatePlayoffBracket(orderedQualifiers) {
  if (orderedQualifiers.length < 4) {
    throw new Error('IPL-style playoffs require at least 4 qualifiers');
  }
  const [s1, s2, s3, s4] = orderedQualifiers;

  const qualifier1 = emptyMatchup({
    matchupName: 'Qualifier 1',
    slotA: s1.teamId, slotB: s2.teamId,
    slotALabel: s1.label, slotBLabel: s2.label,
    winnerAdvancesTo: { roundIndex: 2, matchupIndex: 0, slot: 'A' }, // -> Final
    loserAdvancesTo: { roundIndex: 1, matchupIndex: 0, slot: 'A' },  // -> Qualifier 2
  });
  const eliminator = emptyMatchup({
    matchupName: 'Eliminator',
    slotA: s3.teamId, slotB: s4.teamId,
    slotALabel: s3.label, slotBLabel: s4.label,
    winnerAdvancesTo: { roundIndex: 1, matchupIndex: 0, slot: 'B' },  // -> Qualifier 2
    // loser is eliminated (no loserAdvancesTo)
  });
  const qualifier2 = emptyMatchup({
    matchupName: 'Qualifier 2',
    slotALabel: 'Loser Q1', slotBLabel: 'Winner Eliminator',
    winnerAdvancesTo: { roundIndex: 2, matchupIndex: 0, slot: 'B' }, // -> Final
  });
  const final = emptyMatchup({
    matchupName: 'Final',
    slotALabel: 'Winner Q1', slotBLabel: 'Winner Q2',
  });

  const rounds = [
    { roundName: 'Playoffs', matchups: [qualifier1, eliminator] },
    { roundName: 'Qualifier 2', matchups: [qualifier2] },
    { roundName: 'Final', matchups: [final] },
  ];

  return {
    rounds,
    thirdPlacePlayoff: false,
    bracketSize: 4,
    qualifiersCount: orderedQualifiers.length,
    format: 'playoff',
  };
}

/**
 * Given a completed knockout fixture and the bracket, compute the slot
 * mutations needed to advance the winner (and, for semifinals, route the loser
 * to the third-place match). Returns a list of { roundIndex, matchupIndex,
 * slot, teamId, label } edits for the caller to apply + persist.
 */
export function computeAdvancement(bracket, roundIndex, matchupIndex, winnerId, loserId) {
  const edits = [];
  const matchup = bracket.rounds?.[roundIndex]?.matchups?.[matchupIndex];
  if (!matchup) return edits;

  const winnerLabel =
    String(matchup.slotA) === String(winnerId) ? matchup.slotALabel : matchup.slotBLabel;
  const loserLabel =
    String(matchup.slotA) === String(loserId) ? matchup.slotALabel : matchup.slotBLabel;

  // Read fields explicitly: `matchup.*AdvancesTo` may be a Mongoose subdocument,
  // which does not spread to plain { roundIndex, matchupIndex, slot } via {...t}.
  if (matchup.winnerAdvancesTo && winnerId) {
    const t = matchup.winnerAdvancesTo;
    edits.push({
      roundIndex: t.roundIndex,
      matchupIndex: t.matchupIndex,
      slot: t.slot,
      teamId: String(winnerId),
      label: winnerLabel,
    });
  }
  if (matchup.loserAdvancesTo && loserId) {
    const t = matchup.loserAdvancesTo;
    edits.push({
      roundIndex: t.roundIndex,
      matchupIndex: t.matchupIndex,
      slot: t.slot,
      teamId: String(loserId),
      label: loserLabel,
    });
  }
  return edits;
}
