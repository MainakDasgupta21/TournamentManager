import mongoose from 'mongoose';
import {
  FIXTURE_STAGE,
  FIXTURE_STAGE_VALUES,
  FIXTURE_STATUS,
  FIXTURE_STATUS_VALUES,
} from '@tms/shared/constants';

const fixtureSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    // Null for knockout fixtures.
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
      index: true,
    },
    stage: { type: String, enum: FIXTURE_STAGE_VALUES, default: FIXTURE_STAGE.GROUP },

    // Group-stage round number (round-robin round). Knockout uses roundIndex.
    groupRound: { type: Number, default: null },
    // For double round-robin: 1 = first leg, 2 = return leg.
    leg: { type: Number, default: 1 },

    // Knockout linkage: which bracket round/matchup this fixture realises.
    roundIndex: { type: Number, default: null },
    matchupIndex: { type: Number, default: null },
    roundName: { type: String, default: '' },

    teamA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    teamB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    // Human-readable placeholders for unresolved knockout slots, e.g.
    // "Winner of QF1" or "A1" (Group A winner). Shown until a team is assigned.
    placeholderA: { type: String, default: '' },
    placeholderB: { type: String, default: '' },

    scheduledAt: { type: Date, default: null },
    venue: { type: String, default: '' },
    matchNumber: { type: Number, default: null },

    status: {
      type: String,
      enum: FIXTURE_STATUS_VALUES,
      default: FIXTURE_STATUS.SCHEDULED,
      index: true,
    },

    // Sport-specific result object (Module 5). Validated by Zod on write.
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    // Incremental snapshot pushed during live mode (broadcast via Socket.io).
    liveState: { type: mongoose.Schema.Types.Mixed, default: null },

    // Normalised winner used by standings + knockout advancement. Null = draw
    // / tie / no-result / not played.
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    // Knockout-only convenience flag: a bye auto-completes with teamA advancing.
    isBye: { type: Boolean, default: false },
  },
  { timestamps: true }
);

fixtureSchema.index({ tournamentId: 1, stage: 1, status: 1 });
fixtureSchema.index({ tournamentId: 1, groupId: 1, groupRound: 1 });
fixtureSchema.index({ tournamentId: 1, scheduledAt: 1 });

export { FIXTURE_STATUS, FIXTURE_STAGE };
export const Fixture = mongoose.model('Fixture', fixtureSchema);
