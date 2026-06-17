import { z } from 'zod';
import { TOURNAMENT_ACCESS_REQUEST_STATUS } from '../constants.js';
import { objectId } from './common.js';

/** Tournament admin requests access to a specific tournament. */
export const createTournamentAccessRequestSchema = z.object({
  body: z
    .object({
      message: z.string().trim().max(500).optional(),
    })
    .default({}),
});

/**
 * Super-admin request queue with optional status/search filtering and optional
 * pagination (enabled when page or limit is supplied).
 */
export const listTournamentAccessRequestsQuerySchema = z.object({
  query: z
    .object({
      status: z
        .enum([
          TOURNAMENT_ACCESS_REQUEST_STATUS.PENDING,
          TOURNAMENT_ACCESS_REQUEST_STATUS.APPROVED,
          TOURNAMENT_ACCESS_REQUEST_STATUS.REJECTED,
        ])
        .optional(),
      q: z.string().trim().max(120).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .optional(),
});

/** Super admin approves/rejects a tournament access request. */
export const reviewTournamentAccessRequestSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum([
      TOURNAMENT_ACCESS_REQUEST_STATUS.APPROVED,
      TOURNAMENT_ACCESS_REQUEST_STATUS.REJECTED,
    ]),
    note: z.string().trim().max(500).optional(),
  }),
});
