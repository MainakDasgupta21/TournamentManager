import { Router } from 'express';
import { schemas } from '@tms/shared';
import { USER_ROLES } from '@tms/shared/constants';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { listUsers, updateApproval } from '../controllers/user.controller.js';

const router = Router();

// All user-management endpoints are super-admin (site maintainer) only.
router.use(authenticate, authorize(USER_ROLES.SUPER_ADMIN));

router.get('/', validate(schemas.listUsersQuerySchema), listUsers);
router.patch('/:id/approval', validate(schemas.updateApprovalSchema), updateApproval);

export default router;
