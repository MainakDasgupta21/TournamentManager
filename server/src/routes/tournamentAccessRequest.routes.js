import { Router } from 'express';
import { schemas } from '@tms/shared';
import { USER_ROLES } from '@tms/shared/constants';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listTournamentAccessRequests,
  reviewTournamentAccessRequest,
} from '../controllers/tournamentAccessRequest.controller.js';

const router = Router();

// Super-admin-only queue for tournament access requests.
router.use(authenticate, authorize(USER_ROLES.SUPER_ADMIN));

router.get('/', validate(schemas.listTournamentAccessRequestsQuerySchema), listTournamentAccessRequests);
router.patch(
  '/:id/review',
  validate(schemas.reviewTournamentAccessRequestSchema),
  reviewTournamentAccessRequest
);

export default router;
