import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';
import { ALLOWED_IMAGE_MIME, MAX_IMAGE_BYTES } from '../services/imageStorage.js';

// Buffer the upload in memory so the storage service can forward it to Cloudinary
// (or write it to disk in the local fallback). Single image, MIME-allowlisted,
// size-capped — the actual persistence happens in services/imageStorage.js.
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype)) cb(null, true);
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
