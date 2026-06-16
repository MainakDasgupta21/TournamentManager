import { Router } from 'express';
import { schemas } from '@tms/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  loadTournamentFromFixture,
  requireTournamentManager,
} from '../middleware/loadTournament.js';
import {
  getFixture,
  updateFixture,
  submitResult,
  liveUpdate,
  editFixtureEvents,
} from '../controllers/fixture.controller.js';

const router = Router();

// Top-level, fixture-id-addressed routes (the parent tournament is resolved
// from the fixture itself).
const manage = [authenticate, loadTournamentFromFixture, requireTournamentManager];

router.get('/:fixtureId', getFixture);
router.patch('/:fixtureId', ...manage, validate(schemas.updateFixtureSchema), updateFixture);
router.patch('/:fixtureId/result', ...manage, validate(schemas.submitResultSchema), submitResult);
router.patch('/:fixtureId/live-update', ...manage, validate(schemas.liveUpdateSchema), liveUpdate);
router.patch('/:fixtureId/events', ...manage, validate(schemas.eventOpSchema), editFixtureEvents);

export default router;
