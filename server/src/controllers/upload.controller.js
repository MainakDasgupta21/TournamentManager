import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Accept a single image and return its public URL. Local disk today; to move to
 * Cloudinary, replace the URL line with the CDN upload result (the multer
 * storage engine in middleware/upload.js would change too).
 */
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image uploaded (field name must be "file")');
  // Return a same-origin relative path so client-side URL sanitisation accepts it
  // in both local dev (vite proxy) and production deployments.
  const url = `/uploads/${req.file.filename}`;
  return sendSuccess(res, { message: 'Image uploaded', data: { url, filename: req.file.filename } });
});
