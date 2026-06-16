import mongoose from 'mongoose';

/**
 * Describes where a matchup's winner (or loser, for the 3rd-place playoff)
 * should be placed once the result is in.
 */
const advanceTargetSchema = new mongoose.Schema(
  {
    roundIndex: { type: Number, required: true },
    matchupIndex: { type: Number, required: true },
    slot: { type: String, enum: ['A', 'B'], required: true },
  },
  { _id: false }
);

const matchupSchema = new mongoose.Schema(
  {
    fixtureId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fixture', default: null },
    // Resolved teams (null until both feeders complete or a bye is applied).
    slotA: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    slotB: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    // Per-matchup display name when a single round has differently-named ties
    // (e.g. "Qualifier 1" + "Eliminator" both live in the playoffs round).
    matchupName: { type: String, default: '' },
    // Labels shown before resolution, e.g. "A1", "B2", "Winner M3".
    slotALabel: { type: String, default: '' },
    slotBLabel: { type: String, default: '' },
    // Where the winner flows next. Null for the final.
    winnerAdvancesTo: { type: advanceTargetSchema, default: null },
    // Where the loser flows (used to feed a 3rd-place playoff from the semis).
    loserAdvancesTo: { type: advanceTargetSchema, default: null },
    isBye: { type: Boolean, default: false },
    isThirdPlace: { type: Boolean, default: false },
  },
  { _id: false }
);

const roundSchema = new mongoose.Schema(
  {
    roundName: { type: String, required: true },
    matchups: { type: [matchupSchema], default: [] },
  },
  { _id: false }
);

const knockoutBracketSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      unique: true,
      index: true,
    },
    rounds: { type: [roundSchema], default: [] },
    // 'single-elimination' (default) or 'playoff' (IPL-style top-4 Q1/Elim/Q2/Final).
    format: { type: String, enum: ['single-elimination', 'playoff'], default: 'single-elimination' },
    thirdPlacePlayoff: { type: Boolean, default: false },
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const KnockoutBracket = mongoose.model('KnockoutBracket', knockoutBracketSchema);
