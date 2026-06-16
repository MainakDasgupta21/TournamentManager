import mongoose from 'mongoose';
import { AUDIT_ENTITY_VALUES, AUDIT_ACTION_VALUES } from '@tms/shared/constants';

/**
 * Audit trail (Module 5B). One row per admin edit, capturing who changed what
 * and the before/after snapshots so the dashboard can show a full history and,
 * if ever needed, support manual reconciliation. `before`/`after` are Mixed so
 * we can store whatever shape the entity uses (a result object, a config, etc.).
 *
 * `editedByName` is denormalised so the log still reads sensibly even if the
 * user account is later removed.
 */
const auditLogSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    editedByName: { type: String, default: '' },

    entityType: { type: String, enum: AUDIT_ENTITY_VALUES, required: true },
    // ObjectId for most entities; left flexible for config-level edits.
    entityId: { type: mongoose.Schema.Types.Mixed, default: null },
    action: { type: String, enum: AUDIT_ACTION_VALUES, required: true },

    // Human-readable one-liner, e.g. "Edited ball 12.3 in ALP vs BRV".
    summary: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    // Free-form extra context (affected matches, counts, etc.).
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

// Newest-first within a tournament is the dominant query.
auditLogSchema.index({ tournamentId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
