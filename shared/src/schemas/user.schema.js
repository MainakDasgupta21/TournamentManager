import { z } from 'zod';
import { APPROVAL_STATUS, APPROVAL_STATUS_VALUES, USER_ROLE_VALUES } from '../constants.js';
import { objectId } from './common.js';

/**
 * Super-admin user listing, optionally filtered by approval status / role and a
 * free-text `q` (name or email). `page`/`limit` are optional — omitting them
 * returns the full filtered set (e.g. the pending-badge poll), and supplying a
 * page turns on server-side pagination.
 */
export const listUsersQuerySchema = z.object({
  query: z
    .object({
      status: z.enum(APPROVAL_STATUS_VALUES).optional(),
      role: z.enum(USER_ROLE_VALUES).optional(),
      q: z.string().trim().max(120).optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    })
    .optional(),
});

/**
 * Approve or reject an organiser request. Only `approved` / `rejected` are
 * settable here (an account never reverts to `pending`).
 */
export const updateApprovalSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum([APPROVAL_STATUS.APPROVED, APPROVAL_STATUS.REJECTED]),
    note: z.string().trim().max(500).optional(),
  }),
});
