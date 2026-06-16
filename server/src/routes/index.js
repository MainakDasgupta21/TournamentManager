import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import tournamentRoutes from './tournament.routes.js';
import fixtureRoutes from './fixture.routes.js';
import playerRoutes from './player.routes.js';
import uploadRoutes from './upload.routes.js';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API is healthy', data: { uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tournaments', tournamentRoutes);
router.use('/fixtures', fixtureRoutes);
router.use('/players', playerRoutes);
router.use('/uploads', uploadRoutes);

export default router;
