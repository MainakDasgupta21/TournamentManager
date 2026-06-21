import { z } from 'zod';
import {
  AUDIT_ENTITY_VALUES,
  SPORT_VALUES,
  SPORTS,
  TIEBREAKERS,
  TOURNAMENT_STATUS_VALUES,
} from '../constants.js';
import { hexColor, imageAssetUrl, isoDate, nonEmptyString, objectId } from './common.js';

export const bonusPointRuleSchema = z.object({
  enabled: z.boolean().default(false),
  description: z.string().trim().max(280).default(''),
  bonusPoints: z.number().min(0).max(10).default(0),
});

/**
 * pointsConfig is the heart of the configurable engine (Module 4).
 * `tiebreakerOrder` is validated against the sport elsewhere (refinement below)
 * because the allowed set depends on the tournament's sport.
 */
export const pointsConfigSchema = z.object({
  win: z.number().min(0).max(100),
  draw: z.number().min(0).max(100),
  loss: z.number().min(0).max(100),
  noResult: z.number().min(0).max(100).default(0),
  bonusPointRule: bonusPointRuleSchema.default({
    enabled: false,
    description: '',
    bonusPoints: 0,
  }),
  tiebreakerOrder: z
    .array(z.string())
    .min(1)
    .refine((value) => new Set(value).size === value.length, {
      message: 'tiebreakerOrder must not contain duplicates',
    }),
});

export const groupSettingsSchema = z.object({
  numberOfGroups: z.number().int().min(1).max(64),
  doubleRoundRobin: z.boolean().default(false),
  qualifiersPerGroup: z.number().int().min(1).max(32),
});

const baseTournamentFields = {
  name: nonEmptyString.max(160),
  sportType: z.enum(SPORT_VALUES),
  logo: imageAssetUrl.optional(),
  bannerImage: imageAssetUrl.optional(),
  startDate: isoDate,
  endDate: isoDate,
  venues: z.array(nonEmptyString.max(160)).default([]),
  description: z.string().trim().max(2000).default(''),
  primaryColor: hexColor.optional(),
  pointsConfig: pointsConfigSchema,
  groupSettings: groupSettingsSchema,
};

/**
 * Cross-field validation reused by create/update:
 *  - endDate must be on/after startDate
 *  - every tiebreaker must be legal for the chosen sport
 */
const withTournamentRefinements = (schema) =>
  schema
    .refine(
      (t) => !t.startDate || !t.endDate || t.endDate >= t.startDate,
      { message: 'endDate must be on or after startDate', path: ['endDate'] }
    )
    .refine(
      (t) => {
        if (!t.sportType || !t.pointsConfig?.tiebreakerOrder) return true;
        const allowed = TIEBREAKERS[t.sportType] ?? [];
        return t.pointsConfig.tiebreakerOrder.every((tb) => allowed.includes(tb));
      },
      {
        message: 'tiebreakerOrder contains an option not valid for this sport',
        path: ['pointsConfig', 'tiebreakerOrder'],
      }
    );

export const createTournamentSchema = z.object({
  body: withTournamentRefinements(z.object(baseTournamentFields)),
});

// On update every field is optional, but the same refinements apply when present.
export const updateTournamentSchema = z.object({
  body: withTournamentRefinements(
    z.object(baseTournamentFields).partial()
  ),
});

export const updatePointsConfigSchema = z.object({
  body: z.object({ pointsConfig: pointsConfigSchema }),
});

/**
 * Public list filters. Enum-constrained so a crafted query object cannot inject
 * a Mongo operator (e.g. `?status[$ne]=x`) into `Tournament.find`. `mine` is a
 * loose boolean tolerant of the usual query-string encodings.
 *
 * `state` is a UI-friendly grouping ("live" spans group + knockout stages);
 * `q` is a name search; `page`/`limit` are optional — when omitted the endpoint
 * returns a capped filtered list and paginates only when a caller asks for a page.
 */
export const listTournamentsQuerySchema = z.object({
  query: z.object({
    sport: z.enum(SPORT_VALUES).optional(),
    status: z.enum(TOURNAMENT_STATUS_VALUES).optional(),
    state: z.enum(['live', 'setup', 'completed']).optional(),
    q: z.string().trim().max(120).optional(),
    sort: z.enum(['newest', 'name']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    mine: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((v) => v === true || v === 'true' || v === '1'),
  }),
});

/** Explicit tournament status transition. */
export const updateStatusSchema = z.object({
  body: z.object({ status: z.enum(TOURNAMENT_STATUS_VALUES) }),
});

/** Assign an additional tournament admin (owner / super admin). */
export const assignAdminSchema = z.object({
  body: z.object({ userId: objectId }),
});

/** Typeahead search for organisers to add as collaborators (owner only). */
export const adminCandidatesQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().max(120).optional().default(''),
  }),
});

/** Assign (or clear) the admin-chosen Player of the Tournament. */
export const setPlayerOfTournamentSchema = z.object({
  body: z.object({ playerId: objectId.nullable() }),
});

/**
 * Full recalculation trigger (Module 5B). `confirm` acknowledges that a bracket
 * winner change may invalidate already-played downstream knockout matches.
 */
export const recalculateSchema = z.object({
  body: z
    .object({ confirm: z.boolean().default(false) })
    .default({ confirm: false }),
});

/** Paginated audit-log query. */
export const auditLogQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    entityType: z.enum(AUDIT_ENTITY_VALUES).optional(),
  }),
});

export { SPORTS };
