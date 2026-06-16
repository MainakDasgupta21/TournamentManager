import { z } from 'zod';
import { CRICKET_ROLES, FOOTBALL_POSITIONS } from '../constants.js';
import { hexColor, nonEmptyString, objectId } from './common.js';

export const createTeamSchema = z.object({
  body: z.object({
    name: nonEmptyString.max(120),
    shortCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{2,4}$/, 'Short code must be 2-4 letters/digits'),
    logo: z.string().url().optional().or(z.literal('')),
    primaryColor: hexColor.default('#3b82f6'),
    groupId: objectId.optional().nullable(),
  }),
});

export const updateTeamSchema = z.object({
  body: createTeamSchema.shape.body.partial(),
});

/**
 * A player's role/position field is sport-dependent. We accept either set and
 * let the controller validate against the tournament's sport, keeping this
 * schema usable on the client before the sport context is wired in.
 */
export const playerSchema = z.object({
  body: z.object({
    name: nonEmptyString.max(120),
    role: z
      .enum([...CRICKET_ROLES, ...FOOTBALL_POSITIONS])
      .optional(),
    jerseyNumber: z.number().int().min(0).max(999).optional(),
  }),
});

export const updatePlayerSchema = z.object({
  body: playerSchema.shape.body.partial(),
});
