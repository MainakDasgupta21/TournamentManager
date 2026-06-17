import mongoose from 'mongoose';
import {
  TOURNAMENT_ACCESS_REQUEST_STATUS,
  TOURNAMENT_ACCESS_REQUEST_STATUS_VALUES,
} from '@tms/shared/constants';

const tournamentAccessRequestSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    message: { type: String, trim: true, maxlength: 500, default: '' },
    status: {
      type: String,
      enum: TOURNAMENT_ACCESS_REQUEST_STATUS_VALUES,
      default: TOURNAMENT_ACCESS_REQUEST_STATUS.PENDING,
      index: true,
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: true }
);

// At most one active pending request per tournament/user pair.
tournamentAccessRequestSchema.index(
  { tournamentId: 1, requestedBy: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: TOURNAMENT_ACCESS_REQUEST_STATUS.PENDING },
  }
);
tournamentAccessRequestSchema.index({ status: 1, createdAt: -1 });
tournamentAccessRequestSchema.index({ requestedBy: 1, createdAt: -1 });

export const TournamentAccessRequest = mongoose.model(
  'TournamentAccessRequest',
  tournamentAccessRequestSchema
);
