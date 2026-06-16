import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { handleImageUpload } from '../middleware/upload.js';
import { uploadFile } from '../controllers/upload.controller.js';

const router = Router();

// POST /api/uploads — any authenticated admin can upload an image asset.
router.post('/', authenticate, handleImageUpload, uploadFile);

export default router;
