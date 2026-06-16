import { Router } from 'express';
import { loadTournament } from '../middleware/loadTournament.js';
import { getLeaderboards, listTournamentPlayers } from '../controllers/leaderboard.controller.js';

// Mounted at /tournaments/:id (merged params). Public, read-only stats surface.
const router = Router({ mergeParams: true });

router.get('/leaderboards', loadTournament, getLeaderboards);
router.get('/players', loadTournament, listTournamentPlayers);

export default router;
