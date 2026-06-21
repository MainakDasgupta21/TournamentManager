import fs from 'node:fs';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Image storage abstraction.
 *
 * Primary backend is Cloudinary (uploads return an absolute `secure_url`). When
 * Cloudinary credentials are not configured we transparently fall back to
 * local-disk storage so local development keeps working without a CDN account.
 *
 * SVG is intentionally excluded everywhere: it can embed <script>/event handlers
 * and would become a stored-XSS vector when served from our own origin. Only
 * raster image types are accepted.
 */
export const ALLOWED_IMAGE_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const EXT_BY_MIME = Object.freeze({
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
});
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB

/** Local fallback directory (also served statically by app.js). */
export const UPLOAD_DIR = path.resolve(import.meta.dirname, '../../uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Configure the Cloudinary SDK once at module load. `CLOUDINARY_URL` is read
// automatically by the SDK; discrete keys take precedence when provided.
const hasDiscreteKeys = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);
let cloudinaryReady = false;
if (hasDiscreteKeys) {
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
    secure: true,
  });
  cloudinaryReady = true;
} else if (env.cloudinary.url) {
  cloudinary.config({ secure: true });
  cloudinaryReady = true;
}

export function isCloudinaryConfigured() {
  return cloudinaryReady;
}

/** Human-readable storage mode for boot logging. */
export function imageStorageMode() {
  return cloudinaryReady ? 'cloudinary' : 'local-disk';
}

async function uploadToCloudinary(buffer, mimetype) {
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: env.cloudinary.folder || 'tourneyops',
      resource_type: 'image',
      overwrite: false,
    });
    return { url: result.secure_url, id: result.public_id, provider: 'cloudinary' };
  } catch (err) {
    // The Cloudinary SDK exposes the upstream HTTP status on `http_code`.
    // Surfacing it turns an opaque "upload failed" into an actionable cause:
    // 401 => bad key/secret, 403 => the API key has no upload ("create") permission.
    const status = err?.http_code ?? err?.error?.http_code ?? null;
    const detail = err?.message ?? err?.error?.message ?? 'unknown error';
    console.error(`[cloudinary] upload failed (http ${status ?? '?'}): ${detail}`);
    const hint =
      status === 401
        ? ' — check CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET'
        : status === 403
          ? ' — the Cloudinary API key lacks upload ("create") permission'
          : '';
    throw new ApiError(
      502,
      `Image upload to Cloudinary failed${status ? ` (HTTP ${status})` : ''}${hint}`
    );
  }
}

function saveToDisk(buffer, mimetype, publicBaseUrl) {
  const ext = EXT_BY_MIME[mimetype];
  if (!ext) throw ApiError.badRequest('Only PNG, JPEG, WebP or GIF images are allowed');
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9).toString(36)}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  const relativePath = `/uploads/${filename}`;

  // Prefer an explicit deployment URL when configured, otherwise use the
  // request host passed by the upload controller. This keeps returned URLs
  // absolute/portable in split frontend+API deployments.
  const baseCandidates = [env.publicUrl, publicBaseUrl].filter(Boolean);
  for (const base of baseCandidates) {
    try {
      const parsedBase = new URL(base);
      if (!['http:', 'https:'].includes(parsedBase.protocol)) continue;
      return {
        url: new URL(relativePath, parsedBase).toString(),
        id: filename,
        provider: 'local-disk',
      };
    } catch {
      /* ignore invalid base URL and continue */
    }
  }
  return { url: relativePath, id: filename, provider: 'local-disk' };
}

/**
 * Persist an uploaded image buffer and return its public URL + provider id.
 * @param {{ buffer: Buffer, mimetype: string, publicBaseUrl?: string }} file
 */
export async function saveImage({ buffer, mimetype, publicBaseUrl } = {}) {
  if (!buffer?.length) throw ApiError.badRequest('Empty image upload');
  if (!ALLOWED_IMAGE_MIME.has(mimetype)) {
    throw ApiError.badRequest('Only PNG, JPEG, WebP or GIF images are allowed');
  }
  return cloudinaryReady
    ? uploadToCloudinary(buffer, mimetype)
    : saveToDisk(buffer, mimetype, publicBaseUrl);
}
