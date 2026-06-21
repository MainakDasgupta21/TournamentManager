import { Router } from 'express';
import { schemas } from '@tms/shared';
import { USER_ROLES } from '@tms/shared/constants';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize, optionalAuth } from '../middleware/auth.js';
import {
  loadTournament,
  requireTournamentManager,
  requireTournamentOwner,
} from '../middleware/loadTournament.js';
import {
  createTournament,
  listTournaments,
  getTournament,
  updateTournament,
  updatePointsConfig,
  updateStatus,
  listAdmins,
  searchAdminCandidates,
  assignAdmin,
  removeAdmin,
  setPlayerOfTournament,
  deleteTournament,
} from '../controllers/tournament.controller.js';
import { requestTournamentAccess } from '../controllers/tournamentAccessRequest.controller.js';
import { recalculateAll, getAuditLogs } from '../controllers/recalc.controller.js';
import teamRoutes from './team.routes.js';
import groupRoutes from './group.routes.js';
import fixtureRoutes from './tournamentFixture.routes.js';
import standingRoutes from './standing.routes.js';
import knockoutRoutes from './knockout.routes.js';
import statsRoutes from './stats.routes.js';

const router = Router();

/* ---- Collection ---- */
router.post(
  '/',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.TOURNAMENT_ADMIN),
  validate(schemas.createTournamentSchema),
  createTournament
);
router.get('/', optionalAuth, validate(schemas.listTournamentsQuerySchema), listTournaments);

/* ---- Single tournament ---- */
router.get('/:id', optionalAuth, loadTournament, getTournament);

router.post(
  '/:id/access-requests',
  authenticate,
  authorize(USER_ROLES.TOURNAMENT_ADMIN),
  loadTournament,
  validate(schemas.createTournamentAccessRequestSchema),
  requestTournamentAccess
);

router.patch(
  '/:id',
  authenticate,
  loadTournament,
  requireTournamentManager,
  validate(schemas.updateTournamentSchema),
  updateTournament
);

router.patch(
  '/:id/points-config',
  authenticate,
  loadTournament,
  requireTournamentManager,
  validate(schemas.updatePointsConfigSchema),
  updatePointsConfig
);

router.patch(
  '/:id/status',
  authenticate,
  loadTournament,
  requireTournamentManager,
  validate(schemas.updateStatusSchema),
  updateStatus
);

router.patch(
  '/:id/player-of-tournament',
  authenticate,
  loadTournament,
  requireTournamentManager,
  validate(schemas.setPlayerOfTournamentSchema),
  setPlayerOfTournament
);

router.post(
  '/:id/recalculate',
  authenticate,
  loadTournament,
  requireTournamentManager,
  validate(schemas.recalculateSchema),
  recalculateAll
);

router.get(
  '/:id/audit-logs',
  authenticate,
  loadTournament,
  requireTournamentManager,
  validate(schemas.auditLogQuerySchema),
  getAuditLogs
);

/* ---- Collaborators (super admin only for mutations) ---- */
router.get(
  '/:id/admins',
  authenticate,
  loadTournament,
  requireTournamentManager,
  listAdmins
);

router.get(
  '/:id/admin-candidates',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN),
  loadTournament,
  validate(schemas.adminCandidatesQuerySchema),
  searchAdminCandidates
);

router.post(
  '/:id/admins',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN),
  loadTournament,
  validate(schemas.assignAdminSchema),
  assignAdmin
);

router.delete(
  '/:id/admins/:userId',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN),
  loadTournament,
  removeAdmin
);

// Deleting a tournament (and cascading all of its data) is owner-only: a
// collaborator admin can manage day-to-day data but must not be able to nuke the
// whole tournament. Super admins are always allowed.
router.delete(
  '/:id',
  authenticate,
  loadTournament,
  requireTournamentOwner,
  deleteTournament
);

/* ---- Nested resources (all scoped to :id) ---- */
router.use('/:id/teams', teamRoutes);
router.use('/:id/groups', groupRoutes);
router.use('/:id/fixtures', fixtureRoutes);
router.use('/:id/standings', standingRoutes);
router.use('/:id/knockouts', knockoutRoutes);
router.use('/:id', statsRoutes); // /:id/leaderboards, /:id/players

export default router;
