import { z } from 'zod';
import { isoDate, objectId } from './common.js';

export const generateKnockoutSchema = z.object({
  body: z
    .object({
      // 'single-elimination' (default) or 'playoff' (IPL-style top-4).
      format: z.enum(['single-elimination', 'playoff']).default('single-elimination'),
      qualifiersPerGroup: z.number().int().min(1).max(32).optional(),
      thirdPlacePlayoff: z.boolean().default(false),
      startDate: isoDate.optional(),
      daysBetweenRounds: z.number().int().min(0).max(60).default(3),
      defaultVenue: z.string().trim().max(160).optional(),
    })
    .default({}),
});

/**
 * Manual adjustment of an auto-generated (unlocked) bracket. The admin can
 * reassign which seeded team sits in a given slot before locking.
 */
export const adjustKnockoutSchema = z.object({
  body: z.object({
    roundIndex: z.number().int().min(0),
    matchupIndex: z.number().int().min(0),
    slotA: objectId.nullable().optional(),
    slotB: objectId.nullable().optional(),
  }),
});
