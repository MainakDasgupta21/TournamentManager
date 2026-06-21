import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Teams are also stamped with groupId on the Team doc; this array preserves
    // explicit ordering (useful for seeding display) and fast membership reads.
    teams: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Team' }],
    // Display/seeding order of the group within the tournament.
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

groupSchema.index({ tournamentId: 1, name: 1 }, { unique: true });
// Groups are listed in display order within a tournament (`sort({ order, name })`).
groupSchema.index({ tournamentId: 1, order: 1 });

export const Group = mongoose.model('Group', groupSchema);
