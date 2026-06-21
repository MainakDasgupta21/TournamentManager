import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { saveImage } from '../services/imageStorage.js';

/**
 * Accept a single image and return its public URL. Uses Cloudinary when
 * configured, otherwise local-disk storage (see services/imageStorage.js).
 */
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No image uploaded (field name must be "file")');
  const requestHost = req.get('host');
  const publicBaseUrl = requestHost ? `${req.protocol}://${requestHost}` : '';
  const { url, id } = await saveImage({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    publicBaseUrl,
  });
  return sendSuccess(res, { message: 'Image uploaded', data: { url, filename: id } });
});
