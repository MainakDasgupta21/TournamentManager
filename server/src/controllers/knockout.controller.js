import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../utils/ApiResponse.js';
import { KnockoutBracket } from '../models/KnockoutBracket.js';
import {
  generateAndPersist,
  applyAdjustment,
  lockBracket,
} from '../services/knockoutService.js';
import { recordAudit } from '../services/auditService.js';
import { emitToTournament, EVENTS } from '../socket/index.js';
import { AUDIT_ENTITY, AUDIT_ACTION } from '@tms/shared/constants';

export const generateKnockout = asyncHandler(async (req, res) => {
  const bracket = await generateAndPersist(req.tournament, req.body ?? {});
  emitToTournament(req.tournament._id, EVENTS.BRACKET, {
    tournamentId: String(req.tournament._id),
  });
  await recordAudit({
    tournament: req.tournament,
    user: req.user,
    entityType: AUDIT_ENTITY.KNOCKOUT,
    entityId: bracket._id,
    action: AUDIT_ACTION.CREATE,
    summary: `Generated ${bracket.format === 'playoff' ? 'IPL-style playoff' : 'knockout'} bracket`,
    meta: { format: bracket.format, thirdPlacePlayoff: bracket.thirdPlacePlayoff, rounds: bracket.rounds?.length },
  });
  return sendCreated(res, { message: 'Knockout bracket generated', data: { bracket } });
});

/**
 * Public bracket view. Teams are populated so the visualisation can render
 * names/logos without extra requests.
 */
export const getKnockout = asyncHandler(async (req, res) => {
  const bracket = await KnockoutBracket.findOne({ tournamentId: req.tournament._id })
    .populate('rounds.matchups.slotA', 'name shortCode logo primaryColor')
    .populate('rounds.matchups.slotB', 'name shortCode logo primaryColor')
    .populate('rounds.matchups.fixtureId', 'status scheduledAt venue result winner')
    .lean();

  if (!bracket) return sendSuccess(res, { data: { bracket: null } });
  return sendSuccess(res, { data: { bracket } });
});

export const adjustKnockout = asyncHandler(async (req, res) => {
  const bracket = await applyAdjustment(req.tournament, req.body);
  emitToTournament(req.tournament._id, EVENTS.BRACKET, {
    tournamentId: String(req.tournament._id),
  });
  await recordAudit({
    tournament: req.tournament,
    user: req.user,
    entityType: AUDIT_ENTITY.KNOCKOUT,
    entityId: bracket._id,
    action: AUDIT_ACTION.UPDATE,
    summary: 'Adjusted knockout bracket',
    after: req.body,
  });
  return sendSuccess(res, { message: 'Bracket adjusted', data: { bracket } });
});

export const lockKnockout = asyncHandler(async (req, res) => {
  const bracket = await lockBracket(req.tournament);
  await recordAudit({
    tournament: req.tournament,
    user: req.user,
    entityType: AUDIT_ENTITY.KNOCKOUT,
    entityId: bracket._id,
    action: AUDIT_ACTION.UPDATE,
    summary: 'Locked knockout bracket',
  });
  return sendSuccess(res, { message: 'Bracket locked', data: { bracket } });
});
