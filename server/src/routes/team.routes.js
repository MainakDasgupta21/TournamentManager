import { Router } from 'express';
import { schemas } from '@tms/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  loadTournament,
  requireTournamentManager,
} from '../middleware/loadTournament.js';
import {
  createTeam,
  listTeams,
  getTeam,
  updateTeam,
  updateTeamFormation,
  deleteTeam,
  addPlayer,
  updatePlayer,
  deletePlayer,
} from '../controllers/team.controller.js';

// mergeParams lets these handlers read :id (the tournament) from the parent router.
const router = Router({ mergeParams: true });

const manage = [authenticate, loadTournament, requireTournamentManager];

router.get('/', loadTournament, listTeams);
router.get('/:teamId', loadTournament, getTeam);

router.post('/', ...manage, validate(schemas.createTeamSchema), createTeam);
router.patch('/:teamId', ...manage, validate(schemas.updateTeamSchema), updateTeam);
router.patch('/:teamId/formation', ...manage, validate(schemas.updateTeamFormationSchema), updateTeamFormation);
router.delete('/:teamId', ...manage, deleteTeam);

/* Roster */
router.post('/:teamId/players', ...manage, validate(schemas.playerSchema), addPlayer);
router.patch('/:teamId/players/:playerId', ...manage, validate(schemas.updatePlayerSchema), updatePlayer);
router.delete('/:teamId/players/:playerId', ...manage, deletePlayer);

export default router;
