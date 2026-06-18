import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

/** Local upload target. Cloudinary-ready: swap the storage engine + the URL
 * built in upload.controller.js to move to a CDN without touching callers. */
export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// NOTE: SVG is intentionally excluded. SVGs can embed <script>/event handlers
// and, because uploads are served from our own origin, would become a stored
// XSS vector. Only raster image types are accepted.
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const EXT_BY_MIME = Object.freeze({
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
});
const MAX_BYTES = 2 * 1024 * 1024; // 2MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Never trust `originalname` for extension: it is client-controlled.
    const ext = EXT_BY_MIME[file.mimetype];
    if (!ext) {
      return cb(ApiError.badRequest('Only PNG, JPEG, WebP or GIF images are allowed'));
    }
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9).toString(36)}${ext}`);
  },
});

const uploadImage = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(ApiError.badRequest('Only PNG, JPEG, WebP or GIF images are allowed'));
  },
}).single('file');

/** Run multer and normalise its errors into ApiError for the global handler. */
export function handleImageUpload(req, res, next) {
  uploadImage(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2MB or smaller' : err.message;
      return next(ApiError.badRequest(msg));
    }
    return next(err);
  });
}
