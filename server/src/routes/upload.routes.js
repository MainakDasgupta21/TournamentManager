import { Router } from 'express';
import { USER_ROLES } from '@tms/shared/constants';
import { authenticate, authorize } from '../middleware/auth.js';
import { handleImageUpload } from '../middleware/upload.js';
import { uploadFile } from '../controllers/upload.controller.js';

const router = Router();

// POST /api/uploads — any authenticated admin can upload an image asset.
router.post(
  '/',
  authenticate,
  authorize(USER_ROLES.SUPER_ADMIN, USER_ROLES.TOURNAMENT_ADMIN),
  handleImageUpload,
  uploadFile
);

export default router;
