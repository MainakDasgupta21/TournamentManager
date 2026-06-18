import { z } from 'zod';
import { FIXTURE_STAGE_VALUES, FIXTURE_STATUS_VALUES } from '../constants.js';
import { isoDate, nonEmptyString, objectId } from './common.js';

/**
 * Options for auto-generating the group-stage fixtures. `startDate` and
 * `daysBetweenRounds` let the engine spread rounds out on the calendar.
 */
export const generateGroupFixturesSchema = z.object({
  body: z
    .object({
      doubleRoundRobin: z.boolean().optional(),
      startDate: isoDate.optional(),
      daysBetweenRounds: z.number().int().min(0).max(60).default(7),
      defaultVenue: z.string().trim().max(160).optional(),
      overwrite: z.boolean().default(false),
    })
    .default({}),
});

export const updateFixtureSchema = z.object({
  body: z.object({
    scheduledAt: isoDate.optional(),
    venue: z.string().trim().max(160).optional(),
    status: z.enum(FIXTURE_STATUS_VALUES).optional(),
  }),
});

export const createManualFixtureSchema = z.object({
  body: z.object({
    teamA: objectId.nullable().optional(),
    teamB: objectId.nullable().optional(),
    groupId: objectId.nullable().optional(),
    scheduledAt: isoDate.optional(),
    venue: nonEmptyString.max(160).optional(),
  }),
});

export const listFixturesQuery = z.object({
  query: z.object({
    groupId: objectId.optional(),
    teamId: objectId.optional(),
    stage: z.enum(FIXTURE_STAGE_VALUES).optional(),
    status: z.enum(FIXTURE_STATUS_VALUES).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  }),
});
