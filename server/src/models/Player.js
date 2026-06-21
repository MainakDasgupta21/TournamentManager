import mongoose from 'mongoose';
import { PLAYER_CATEGORIES } from '@tms/shared/constants';

/**
 * Cached, derived aggregate stats (Module 5 / 7B). These are NOT entered by
 * hand — they are recomputed from granular match events whenever a result is
 * saved or the admin triggers a recalculation, so they can always be rebuilt
 * from the source-of-truth fixtures.
 */
const cricketStatsSchema = new mongoose.Schema(
  {
    matches: { type: Number, default: 0 },
    // Batting
    batInnings: { type: Number, default: 0 },
    runs: { type: Number, default: 0 },
    ballsFaced: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    notOuts: { type: Number, default: 0 },
    highScore: { type: Number, default: 0 },
    dismissals: { type: Number, default: 0 },
    // Bowling
    bowlInnings: { type: Number, default: 0 },
    ballsBowled: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    wickets: { type: Number, default: 0 },
    maidens: { type: Number, default: 0 },
    // Best bowling in an innings, stored as wickets-for-runs for comparison.
    bestWickets: { type: Number, default: 0 },
    bestRuns: { type: Number, default: 0 },
  },
  { _id: false }
);

const footballStatsSchema = new mongoose.Schema(
  {
    appearances: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    assists: { type: Number, default: 0 },
    ownGoals: { type: Number, default: 0 },
    yellowCards: { type: Number, default: 0 },
    redCards: { type: Number, default: 0 },
    // Goals conceded while this player's team played (used for Golden Glove on GKs).
    goalsConcededByTeam: { type: Number, default: 0 },
    cleanSheets: { type: Number, default: 0 },
  },
  { _id: false }
);

/**
 * Optional roster. `role` stores either a cricket role (batsman/bowler/...) or
 * a football position (detailed tactical roles, with legacy coarse values
 * accepted during transition); the controller validates the value against the
 * tournament's sport, so a single field serves both sports.
 */
const playerSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, default: '' },
    jerseyNumber: { type: Number, default: null },
    // Manually-assigned tier (S++ … D). `null` = Unrated.
    category: { type: String, enum: [...PLAYER_CATEGORIES, null], default: null },

    // Cached derived stats. Only the relevant sport's section is populated.
    stats: {
      cricket: { type: cricketStatsSchema, default: () => ({}) },
      football: { type: footballStatsSchema, default: () => ({}) },
    },
    statsUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Roster reads/recalcs filter by tournament + team together (e.g. formation
// validation, scoped player-stat recompute), so back that with a compound index.
playerSchema.index({ tournamentId: 1, teamId: 1 });

export const Player = mongoose.model('Player', playerSchema);
