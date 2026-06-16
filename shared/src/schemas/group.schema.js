import { z } from 'zod';
import { nonEmptyString, objectId } from './common.js';

export const createGroupSchema = z.object({
  body: z.object({
    name: nonEmptyString.max(60),
    teams: z.array(objectId).default([]),
  }),
});

export const updateGroupSchema = z.object({
  body: z.object({
    name: nonEmptyString.max(60).optional(),
    teams: z.array(objectId).optional(),
  }),
});

/**
 * Auto-distribute teams across groups via a seeded snake draft. The admin can
 * either let the system create the groups (numberOfGroups) or pass explicit
 * group names. `seededTeamIds` is the seeding order (best team first).
 */
export const autoDistributeSchema = z.object({
  body: z
    .object({
      numberOfGroups: z.number().int().min(1).max(64).optional(),
      groupNames: z.array(nonEmptyString.max(60)).optional(),
      seededTeamIds: z.array(objectId).min(2),
    })
    .refine((b) => b.numberOfGroups || b.groupNames?.length, {
      message: 'Provide either numberOfGroups or groupNames',
      path: ['numberOfGroups'],
    }),
});
