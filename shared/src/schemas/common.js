import { z } from 'zod';

/**
 * Mongo ObjectId as a string. We validate the 24-hex shape rather than
 * importing mongoose into the shared package (which must stay framework-free
 * so the browser bundle does not pull in server code).
 */
export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const isoDate = z
  .union([z.string().trim().min(1), z.date()])
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), 'Invalid date');

export const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex color like #1e293b');

export const nonEmptyString = z.string().trim().min(1);

/** Pagination query shared by list endpoints. */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
