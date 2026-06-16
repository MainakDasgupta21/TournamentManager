import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { recalculateTournament } from '../services/recalcService.js';
import { listAuditLogs, recordAudit } from '../services/auditService.js';
import { emitToTournament, EVENTS } from '../socket/index.js';
import { AUDIT_ENTITY, AUDIT_ACTION } from '@tms/shared/constants';

/**
 * Admin-triggered full recalculation cascade (Module 5B). Returns a confirmation
 * request (HTTP 200, `requiresConfirm:true`) when applying would invalidate
 * already-played knockout matches; the client re-calls with `confirm:true`.
 */
export const recalculateAll = asyncHandler(async (req, res) => {
  const confirm = Boolean(req.body?.confirm);
  const result = await recalculateTournament(req.tournament._id, { confirm });

  if (result.requiresConfirm) {
    return sendSuccess(res, {
      message: 'Confirmation required: downstream knockout matches will be reset',
      data: { requiresConfirm: true, affected: result.affected },
    });
  }

  // Push fresh data to every connected viewer.
  emitToTournament(req.tournament._id, EVENTS.STANDINGS, { full: true });
  emitToTournament(req.tournament._id, EVENTS.STATS, { tournamentId: String(req.tournament._id) });
  if (result.bracketChanged) {
    emitToTournament(req.tournament._id, EVENTS.BRACKET, { tournamentId: String(req.tournament._id) });
  }

  await recordAudit({
    tournament: req.tournament,
    user: req.user,
    entityType: AUDIT_ENTITY.STANDINGS,
    action: AUDIT_ACTION.RECALCULATE,
    summary: `Full recalculation (${result.groups} groups, ${result.playersUpdated} players${
      result.bracketChanged ? ', bracket updated' : ''
    })`,
    meta: { ...result, confirmed: confirm },
  });

  return sendSuccess(res, {
    message: 'Recalculation complete',
    data: {
      requiresConfirm: false,
      groups: result.groups,
      playersUpdated: result.playersUpdated,
      bracketChanged: result.bracketChanged,
    },
  });
});

/** Admin-only audit trail for a tournament. */
export const getAuditLogs = asyncHandler(async (req, res) => {
  const { page, limit, entityType } = req.query;
  const data = await listAuditLogs(req.tournament._id, { page, limit, entityType });
  return sendSuccess(res, { data });
});
