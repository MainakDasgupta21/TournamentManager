import { Router } from 'express';
import { schemas } from '@tms/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  loadTournament,
  requireTournamentManager,
} from '../middleware/loadTournament.js';
import {
  generateGroupStage,
  listFixtures,
} from '../controllers/fixture.controller.js';

const router = Router({ mergeParams: true });
const manage = [authenticate, loadTournament, requireTournamentManager];

// Public listing (filterable via query string).
router.get('/', loadTournament, validate(schemas.listFixturesQuery), listFixtures);

router.post(
  '/generate-group-stage',
  ...manage,
  validate(schemas.generateGroupFixturesSchema),
  generateGroupStage
);

export default router;
