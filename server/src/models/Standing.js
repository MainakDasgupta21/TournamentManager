import mongoose from 'mongoose';

/**
 * One row per (tournament, group, team). Fully denormalised so the public
 * standings table is a single indexed query. Recomputed from scratch by the
 * standings engine after every completed group match.
 */
const standingSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },

    played: { type: Number, default: 0 },
    won: { type: Number, default: 0 },
    drawn: { type: Number, default: 0 }, // draws (football) / ties (cricket)
    lost: { type: Number, default: 0 },
    noResult: { type: Number, default: 0 }, // cricket abandoned matches
    points: { type: Number, default: 0 },

    // --- Cricket aggregates (used for Net Run Rate) ---
    runsFor: { type: Number, default: 0 },
    oversFor: { type: Number, default: 0 }, // decimal overs (e.g. 19.4 -> 19.667)
    runsAgainst: { type: Number, default: 0 },
    oversAgainst: { type: Number, default: 0 },
    netRunRate: { type: Number, default: 0 },

    // --- Football aggregates ---
    goalsFor: { type: Number, default: 0 },
    goalsAgainst: { type: Number, default: 0 },
    goalDifference: { type: Number, default: 0 },

    rank: { type: Number, default: 0 },
  },
  { timestamps: true }
);

standingSchema.index({ tournamentId: 1, groupId: 1, teamId: 1 }, { unique: true });
// Knockout qualifier selection reads a group's rows in rank order; this serves
// `find({ tournamentId, groupId }).sort({ rank: 1 })` without an in-memory sort.
standingSchema.index({ tournamentId: 1, groupId: 1, rank: 1 });

export const Standing = mongoose.model('Standing', standingSchema);
