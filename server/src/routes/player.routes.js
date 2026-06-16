import { Router } from 'express';
import { getPlayerStats } from '../controllers/leaderboard.controller.js';

// Top-level, player-id addressed. Public player profile + match-by-match stats.
const router = Router();

router.get('/:id/stats', getPlayerStats);

export default router;
