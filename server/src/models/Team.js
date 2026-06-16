import mongoose from 'mongoose';

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
  },
  { timestamps: true }
);

// Short code unique within a tournament (different tournaments may reuse codes).
teamSchema.index({ tournamentId: 1, shortCode: 1 }, { unique: true });

export const Team = mongoose.model('Team', teamSchema);
