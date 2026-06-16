import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  loadTournament,
  requireTournamentManager,
} from '../middleware/loadTournament.js';
import {
  getStandings,
  recalculateStandings,
} from '../controllers/standing.controller.js';

const router = Router({ mergeParams: true });

router.get('/', loadTournament, getStandings);
router.post(
  '/recalculate',
  authenticate,
  loadTournament,
  requireTournamentManager,
  recalculateStandings
);

export default router;
