import mongoose from 'mongoose';
import { FOOTBALL_FORMATION_PRESET_VALUES } from '@tms/shared/constants';

const formationSlotSchema = new mongoose.Schema(
  {
    slot: { type: String, required: true, trim: true, maxlength: 16 },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  },
  { _id: false }
);

const defaultFormationSchema = new mongoose.Schema(
  {
    preset: { type: String, enum: FOOTBALL_FORMATION_PRESET_VALUES, required: true },
    slots: { type: [formationSlotSchema], default: [] },
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    shortCode: { type: String, required: true, trim: true, uppercase: true, maxlength: 4 },
    logo: { type: String, default: '' },
    primaryColor: { type: String, default: '#3b82f6' },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
      index: true,
    },
    // Seeding rank used by auto-distribute and knockout seeding (lower = stronger).
    seed: { type: Number, default: null },
    // Default tactical layout (football only); optionally overridden per fixture.
    defaultFormation: { type: defaultFormationSchema, default: null },
  },
  { timestamps: true }
);

// Short code unique within a tournament (different tournaments may reuse codes).
teamSchema.index({ tournamentId: 1, shortCode: 1 }, { unique: true });

export const Team = mongoose.model('Team', teamSchema);
