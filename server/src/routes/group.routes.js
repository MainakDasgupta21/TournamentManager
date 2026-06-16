import { Router } from 'express';
import { schemas } from '@tms/shared';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import {
  loadTournament,
  requireTournamentManager,
} from '../middleware/loadTournament.js';
import {
  createGroup,
  listGroups,
  updateGroup,
  deleteGroup,
  autoDistribute,
} from '../controllers/group.controller.js';

const router = Router({ mergeParams: true });
const manage = [authenticate, loadTournament, requireTournamentManager];

router.get('/', loadTournament, listGroups);
router.post('/', ...manage, validate(schemas.createGroupSchema), createGroup);
router.post('/auto-distribute', ...manage, validate(schemas.autoDistributeSchema), autoDistribute);
router.patch('/:groupId', ...manage, validate(schemas.updateGroupSchema), updateGroup);
router.delete('/:groupId', ...manage, deleteGroup);

export default router;
