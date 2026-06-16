import { Tournament } from '../models/Tournament.js';
import { Fixture } from '../models/Fixture.js';
import { KnockoutBracket } from '../models/KnockoutBracket.js';
import { recalcAllStandings } from './standingsService.js';
import { recalcPlayerStats } from './playerStatsService.js';
import { computeAdvancement } from './knockout.js';
import { FIXTURE_STAGE, FIXTURE_STATUS, TOURNAMENT_STATUS } from '@tms/shared/constants';

const sid = (v) => (v == null ? null : String(v));

/**
 * Recalculation cascade (Module 5B).
 *
 * A single authoritative pass that rebuilds everything derived from fixtures:
 *   1. Group standings (points / NRR / GD / rank).
 *   2. Cached player aggregate stats (runs, wickets, goals, ...).
 *   3. Knockout bracket advancement — re-derived from the completed knockout
 *      fixtures' winners.
 *
 * The bracket step is the delicate one: if a completed result was edited so its
 * winner changed, the team it sent forward may already have *played* a later
 * round. We never silently rewrite those: we detect the conflict and return
 * `{ requiresConfirm, affected }` so the admin can confirm before downstream
 * matches are invalidated. On confirm, the now-orphaned downstream fixtures are
 * reset to "scheduled" (their results cleared) and the corrected team is slotted
 * in.
 */

/**
 * Pure planner: simulate bracket reconciliation on clones so we can detect
 * conflicts without mutating anything. Returns the desired final round state,
 * the per-fixture updates required, and any invalidated downstream matches.
 *
 * Strategy: **clear-then-replay**. We cannot incrementally "fix" only the slots
 * an edit touched, because a changed winner can have rippled forward two or more
 * rounds (e.g. correcting a quarterfinal must also un-decide the final). So we:
 *   1. find every "fed" slot (a destination of some winner/loser advancement),
 *   2. clear those slot team ids in the clone (first-round seeds are preserved),
 *   3. replay byes + completed results in round order, advancing a result only
 *      while the fixture's recorded participants still match the (replayed)
 *      bracket slots — a stale completed match never feeds forward,
 *   4. diff the replayed bracket against each knockout fixture: any fixture whose
 *      required teams changed is updated, and if it was already completed it is
 *      flagged as `affected` and reset.
 * Labels are intentionally left untouched when a slot is cleared so static
 * placeholders ("Loser Q1", "Winner Eliminator") survive; the replay overwrites
 * them whenever a real team is routed in.
 */
function planBracketReconciliation(rounds, fixturesById) {
  const R = JSON.parse(JSON.stringify(rounds)); // plain deep clone
  const fxState = new Map();
  for (const [fid, fx] of fixturesById) {
    fxState.set(fid, {
      teamA: sid(fx.teamA),
      teamB: sid(fx.teamB),
      status: fx.status,
      winner: sid(fx.winner),
      matchNumber: fx.matchNumber ?? null,
    });
  }

  // 1) Every slot that is the destination of an advancement link is "fed":
  //    its occupant is derived, never seeded, so it is safe to clear & rebuild.
  const fedSlots = new Set(); // `${ri}:${mi}:${slot}`
  for (const round of R) {
    for (const m of round.matchups) {
      for (const link of [m.winnerAdvancesTo, m.loserAdvancesTo]) {
        if (link) fedSlots.add(`${link.roundIndex}:${link.matchupIndex}:${link.slot}`);
      }
    }
  }
  const isFed = (ri, mi, slot) => fedSlots.has(`${ri}:${mi}:${slot}`);

  // 2) Clear fed slot team ids (keep labels as cosmetic placeholders).
  for (let ri = 0; ri < R.length; ri += 1) {
    for (let mi = 0; mi < R[ri].matchups.length; mi += 1) {
      const m = R[ri].matchups[mi];
      if (isFed(ri, mi, 'A')) m.slotA = null;
      if (isFed(ri, mi, 'B')) m.slotB = null;
    }
  }

  const applyEdit = (e) => {
    const dest = R[e.roundIndex]?.matchups?.[e.matchupIndex];
    if (!dest) return;
    dest[`slot${e.slot}`] = sid(e.teamId);
    dest[`slot${e.slot}Label`] = e.label || dest[`slot${e.slot}Label`];
  };

  // 3) Replay in round order. Byes auto-advance their present team; completed
  //    results advance only while their participants still match the bracket.
  for (let ri = 0; ri < R.length; ri += 1) {
    for (let mi = 0; mi < R[ri].matchups.length; mi += 1) {
      const m = R[ri].matchups[mi];

      if (m.isBye) {
        const advancing = m.slotA ? sid(m.slotA) : m.slotB ? sid(m.slotB) : null;
        const label = m.slotA ? m.slotALabel : m.slotBLabel;
        if (advancing && m.winnerAdvancesTo) {
          applyEdit({ ...m.winnerAdvancesTo, teamId: advancing, label });
        }
        continue;
      }

      if (!m.fixtureId) continue;
      const st = fxState.get(sid(m.fixtureId));
      if (!st || st.status !== FIXTURE_STATUS.COMPLETED || !st.winner) continue;

      // A completed match only feeds forward while its recorded participants
      // still equal the (replayed) bracket slots. If an upstream correction
      // changed who is in this match, the old result is stale -> do not advance.
      const slotA = m.slotA ? sid(m.slotA) : null;
      const slotB = m.slotB ? sid(m.slotB) : null;
      if (st.teamA !== slotA || st.teamB !== slotB) continue;

      const winnerId = st.winner;
      const loserId = winnerId === st.teamA ? st.teamB : st.teamA;
      for (const e of computeAdvancement({ rounds: R }, ri, mi, winnerId, loserId)) {
        applyEdit(e);
      }
    }
  }

  // 4) Diff the replayed bracket against the fixtures. Only fed slots can move.
  const affected = [];
  const fixtureUpdates = new Map();
  for (let ri = 0; ri < R.length; ri += 1) {
    for (let mi = 0; mi < R[ri].matchups.length; mi += 1) {
      const m = R[ri].matchups[mi];
      if (!m.fixtureId) continue;
      const fid = sid(m.fixtureId);
      const st = fxState.get(fid);
      if (!st) continue;

      const slotA = m.slotA ? sid(m.slotA) : null;
      const slotB = m.slotB ? sid(m.slotB) : null;
      const u = {};
      let changed = false;
      if (isFed(ri, mi, 'A') && st.teamA !== slotA) {
        u.teamA = slotA;
        u.placeholderA = m.slotALabel || '';
        changed = true;
      }
      if (isFed(ri, mi, 'B') && st.teamB !== slotB) {
        u.teamB = slotB;
        u.placeholderB = m.slotBLabel || '';
        changed = true;
      }
      if (!changed) continue;

      if (st.status === FIXTURE_STATUS.COMPLETED) {
        // Decided with participants that are no longer correct -> invalidate.
        affected.push({
          fixtureId: fid,
          roundName: R[ri]?.roundName ?? '',
          matchNumber: st.matchNumber,
        });
        u.reset = true;
      }
      fixtureUpdates.set(fid, u);
    }
  }

  // Did any bracket slot/label actually change versus what is persisted?
  let bracketChanged = false;
  for (let ri = 0; ri < R.length && !bracketChanged; ri += 1) {
    for (let mi = 0; mi < R[ri].matchups.length; mi += 1) {
      const a = R[ri].matchups[mi];
      const b = rounds[ri].matchups[mi];
      if (
        sid(a.slotA) !== sid(b.slotA) ||
        sid(a.slotB) !== sid(b.slotB) ||
        (a.slotALabel || '') !== (b.slotALabel || '') ||
        (a.slotBLabel || '') !== (b.slotBLabel || '')
      ) {
        bracketChanged = true;
        break;
      }
    }
  }

  return { affected, fixtureUpdates, bracketChanged, newRounds: R };
}

/** Re-derive and (optionally) apply knockout advancement for a tournament. */
async function reconcileBracket(tournamentId, { confirm }) {
  const bracket = await KnockoutBracket.findOne({ tournamentId });
  if (!bracket || !bracket.rounds?.length) return { changed: false, affected: [] };

  const fixtures = await Fixture.find({
    tournamentId,
    stage: FIXTURE_STAGE.KNOCKOUT,
  });
  const fixturesById = new Map(fixtures.map((f) => [sid(f._id), f]));

  const { affected, fixtureUpdates, bracketChanged, newRounds } = planBracketReconciliation(
    bracket.rounds,
    fixturesById
  );

  if (affected.length && !confirm) {
    return { changed: false, affected, requiresConfirm: true };
  }

  if (bracketChanged) {
    for (let ri = 0; ri < bracket.rounds.length; ri += 1) {
      for (let mi = 0; mi < bracket.rounds[ri].matchups.length; mi += 1) {
        const real = bracket.rounds[ri].matchups[mi];
        const planned = newRounds[ri]?.matchups?.[mi];
        if (!planned) continue;
        real.slotA = planned.slotA || null;
        real.slotB = planned.slotB || null;
        real.slotALabel = planned.slotALabel || '';
        real.slotBLabel = planned.slotBLabel || '';
      }
    }
    bracket.markModified('rounds');
    await bracket.save();
  }

  for (const [fid, u] of fixtureUpdates) {
    const set = {};
    if ('teamA' in u) set.teamA = u.teamA;
    if ('teamB' in u) set.teamB = u.teamB;
    if ('placeholderA' in u) set.placeholderA = u.placeholderA;
    if ('placeholderB' in u) set.placeholderB = u.placeholderB;
    if (u.reset) {
      set.status = FIXTURE_STATUS.SCHEDULED;
      set.result = null;
      set.winner = null;
      set.liveState = null;
    }
    // eslint-disable-next-line no-await-in-loop
    await Fixture.findByIdAndUpdate(fid, { $set: set });
  }

  return { changed: bracketChanged || fixtureUpdates.size > 0, affected: [] };
}

/**
 * Keep the tournament lifecycle in sync with the bracket: mark COMPLETED once
 * the final is decided, and revert to KNOCKOUT_STAGE if a downstream reset
 * un-decides it.
 */
async function syncTournamentStatus(tournament) {
  const bracket = await KnockoutBracket.findOne({ tournamentId: tournament._id }).lean();
  if (!bracket?.rounds?.length) return;

  let finalMatchup = null;
  for (const round of bracket.rounds) {
    for (const m of round.matchups) {
      if (!m.winnerAdvancesTo && !m.isThirdPlace) finalMatchup = m;
    }
  }
  if (!finalMatchup?.fixtureId) return;

  const finalFixture = await Fixture.findById(finalMatchup.fixtureId).lean();
  const decided = Boolean(finalFixture && finalFixture.status === FIXTURE_STATUS.COMPLETED && finalFixture.winner);

  if (decided && tournament.status !== TOURNAMENT_STATUS.COMPLETED) {
    tournament.status = TOURNAMENT_STATUS.COMPLETED;
    await tournament.save();
  } else if (!decided && tournament.status === TOURNAMENT_STATUS.COMPLETED) {
    tournament.status = TOURNAMENT_STATUS.KNOCKOUT_STAGE;
    await tournament.save();
  }
}

/**
 * Full recalculation entry point.
 * @param {string} tournamentId
 * @param {object} [opts]
 * @param {boolean} [opts.confirm] confirm propagation of bracket invalidations
 * @returns {Promise<{ requiresConfirm?:boolean, affected?:Array, groups:number, playersUpdated:number, bracketChanged:boolean }>}
 */
export async function recalculateTournament(tournamentId, { confirm = false } = {}) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) return { groups: 0, playersUpdated: 0, bracketChanged: false };

  // 1) Standings + 2) player stats are always safe to rebuild.
  const groups = await recalcAllStandings(tournamentId);
  const playersUpdated = await recalcPlayerStats(tournamentId);

  // 3) Knockout reconciliation (may require confirmation).
  const bracket = await reconcileBracket(tournamentId, { confirm });
  if (bracket.requiresConfirm) {
    return {
      requiresConfirm: true,
      affected: bracket.affected,
      groups: groups.length,
      playersUpdated,
      bracketChanged: false,
    };
  }

  await syncTournamentStatus(tournament);

  return {
    requiresConfirm: false,
    groups: groups.length,
    playersUpdated,
    bracketChanged: bracket.changed,
  };
}
