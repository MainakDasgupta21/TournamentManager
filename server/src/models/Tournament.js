import mongoose from 'mongoose';
import {
  SPORT_VALUES,
  TOURNAMENT_STATUS,
  TOURNAMENT_STATUS_VALUES,
} from '@tms/shared/constants';

const bonusPointRuleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: false },
    description: { type: String, default: '' },
    bonusPoints: { type: Number, default: 0 },
  },
  { _id: false }
);

const pointsConfigSchema = new mongoose.Schema(
  {
    win: { type: Number, required: true },
    draw: { type: Number, required: true },
    loss: { type: Number, required: true },
    noResult: { type: Number, default: 0 },
    bonusPointRule: { type: bonusPointRuleSchema, default: () => ({}) },
    // Ordered list of tiebreaker keys applied left-to-right by the engine.
    tiebreakerOrder: { type: [String], default: [] },
  },
  { _id: false }
);

const groupSettingsSchema = new mongoose.Schema(
  {
    numberOfGroups: { type: Number, default: 1 },
    doubleRoundRobin: { type: Boolean, default: false },
    qualifiersPerGroup: { type: Number, default: 2 },
  },
  { _id: false }
);

const tournamentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    sportType: { type: String, enum: SPORT_VALUES, required: true },
    logo: { type: String, default: '' },
    bannerImage: { type: String, default: '' },
    primaryColor: { type: String, default: '#6366f1' },
    startDate: { type: Date },
    endDate: { type: Date },
    venues: { type: [String], default: [] },
    description: { type: String, default: '', maxlength: 2000 },

    pointsConfig: { type: pointsConfigSchema, required: true },
    groupSettings: { type: groupSettingsSchema, default: () => ({}) },

    status: {
      type: String,
      enum: TOURNAMENT_STATUS_VALUES,
      default: TOURNAMENT_STATUS.SETUP,
      index: true,
    },
    // Whether the knockout bracket has been locked (no further structural edits).
    knockoutLocked: { type: Boolean, default: false },

    // Admin-assignable Player of the Tournament (Module 7B). Surfaced on the
    // public leaderboards once chosen.
    playerOfTournament: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // Tournament-admins permitted to manage this tournament (in addition to the
    // creator and any super admin). A super admin can assign extra admins here.
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

tournamentSchema.index({ sportType: 1, status: 1 });
// Supports the A–Z sort and ordered name listing on the admin dashboard.
tournamentSchema.index({ name: 1 });

export const Tournament = mongoose.model('Tournament', tournamentSchema);
