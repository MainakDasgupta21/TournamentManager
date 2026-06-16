import { Router } from 'express';
import { schemas } from '@tms/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  loadTournament,
  requireTournamentManager,
} from '../middleware/loadTournament.js';
import {
  generateKnockout,
  getKnockout,
  adjustKnockout,
  lockKnockout,
} from '../controllers/knockout.controller.js';

const router = Router({ mergeParams: true });
const manage = [authenticate, loadTournament, requireTournamentManager];

router.get('/', loadTournament, getKnockout);
router.post('/generate', ...manage, validate(schemas.generateKnockoutSchema), generateKnockout);
router.patch('/adjust', ...manage, validate(schemas.adjustKnockoutSchema), adjustKnockout);
router.patch('/lock', ...manage, lockKnockout);

export default router;
