import { z } from 'zod';
import {
  CARD_TYPES,
  CRICKET_EXTRA_TYPES,
  CRICKET_WICKET_TYPES,
  FOOTBALL_GOAL_TYPES,
} from '../constants.js';
import { objectId } from './common.js';
import { footballFormationBySideSchema } from './formation.schema.js';

/**
 * Optional explicit bonus points per team. Used when `pointsConfig.bonusPointRule`
 * is enabled and the admin awards a bonus on a given result (the precise
 * "win by 2x margin" judgement is left to the admin and captured here).
 */
export const bonusEntrySchema = z.object({
  team: objectId,
  points: z.number().min(0).max(10),
});

/** Optional roster reference: a 24-hex id, or null/empty when no roster link. */
const playerRef = objectId.nullable().optional();

/**
 * Optional Playing XI per side, keyed to the fixture's team slots. When present,
 * appearances and goalkeeper clean sheets are credited from the lineup instead
 * of the (looser) "whoever appears in an event + every rostered keeper" heuristic.
 */
export const lineupsSchema = z
  .object({
    teamA: z.array(objectId).max(30),
    teamB: z.array(objectId).max(30),
  })
  .partial()
  .optional();

/* =====================================================================
 * Cricket — granular ball-by-ball (Module 5) with aggregate fallback
 * ===================================================================== */

/**
 * A single delivery. `runsScored` is runs off the bat; `extras` carries the
 * extra type + its runs. A delivery can be both runs and a wicket (e.g. run-out
 * on a completed run is rare but possible — we keep them independent).
 */
export const cricketBallSchema = z.object({
  ballNumber: z.number().int().min(1).max(36).optional(),
  batsman: playerRef,
  nonStriker: playerRef,
  runsScored: z.number().int().min(0).max(8).default(0),
  extras: z
    .object({
      type: z.enum(CRICKET_EXTRA_TYPES).nullable().optional(),
      runs: z.number().int().min(0).max(10).default(0),
    })
    .nullable()
    .optional(),
  isWicket: z.boolean().default(false),
  wicket: z
    .object({
      type: z.enum(CRICKET_WICKET_TYPES),
      playerOut: playerRef,
      fielder: playerRef,
      bowlerCredited: z.boolean().default(true),
    })
    .nullable()
    .optional(),
  commentary: z.string().max(280).optional(),
});

export const cricketOverSchema = z.object({
  overNumber: z.number().int().min(0).max(199),
  bowler: playerRef,
  balls: z.array(cricketBallSchema).max(40).default([]),
});

/**
 * An innings. The aggregate fields (`runs`/`wickets`/`overs`) remain the source
 * of truth for standings/NRR; when `oversDetail` (ball-by-ball) is supplied the
 * server derives and overwrites those aggregates, so both stay consistent.
 * `overs` uses cricket notation (integer = overs, decimal .1-.5 = balls).
 */
export const cricketInningsSchema = z.object({
  battingTeam: objectId,
  bowlingTeam: objectId.optional(),
  runs: z.number().int().min(0).max(2000).default(0),
  wickets: z.number().int().min(0).max(10).default(0),
  overs: z.number().min(0).max(200).default(0),
  extras: z.number().int().min(0).max(500).default(0),
  // Allotted overs for this innings; used by NRR when a side is bowled out.
  allottedOvers: z.number().min(1).max(200).optional(),
  // Optional granular ball-by-ball detail (the broadcast scorecard).
  oversDetail: z.array(cricketOverSchema).max(200).optional(),
});

/**
 * Super Over tie-break (knockout cricket). Each side's one-over total; the side
 * with more runs takes the match. `teamA`/`teamB` map to the fixture's slots.
 */
const superOverSideSchema = z.object({
  runs: z.number().int().min(0).max(100).default(0),
  wickets: z.number().int().min(0).max(2).default(0),
});

export const cricketSuperOverSchema = z.object({
  teamA: superOverSideSchema,
  teamB: superOverSideSchema,
});

export const cricketResultSchema = z.object({
  toss: z
    .object({
      wonBy: objectId,
      decision: z.enum(['bat', 'field']),
    })
    .optional(),
  innings: z.array(cricketInningsSchema).max(4).default([]),
  result: z.object({
    winner: objectId.nullable().optional(),
    margin: z
      .union([
        z.object({
          type: z.enum(['runs', 'wickets']),
          value: z.number().int().min(0),
        }),
        z.literal('tie'),
        z.literal('superOver'),
        z.literal('noResult'),
      ])
      .optional(),
  }),
  // Present when a tied knockout was decided by a one-over eliminator.
  superOver: cricketSuperOverSchema.nullable().optional(),
  manOfTheMatch: playerRef,
  bonus: z.array(bonusEntrySchema).optional(),
  lineups: lineupsSchema,
});

/* =====================================================================
 * Football — per-event (Module 5) with count-based fallback
 * ===================================================================== */

export const footballGoalSchema = z.object({
  team: objectId,
  // Roster link (for player stats) + free-text display name (roster optional).
  playerId: playerRef,
  scorer: z.string().trim().max(120).optional().default(''),
  assistId: playerRef,
  assist: z.string().trim().max(120).optional().default(''),
  minute: z.number().int().min(0).max(130).optional(),
  type: z.enum(FOOTBALL_GOAL_TYPES).optional().default('openPlay'),
});

export const footballCardSchema = z.object({
  team: objectId,
  playerId: playerRef,
  player: z.string().trim().max(120).optional().default(''),
  type: z.enum(CARD_TYPES),
  minute: z.number().int().min(0).max(130).optional(),
  reason: z.string().trim().max(160).optional(),
});

export const footballSubSchema = z.object({
  team: objectId,
  playerOutId: playerRef,
  playerInId: playerRef,
  playerOut: z.string().trim().max(120).optional().default(''),
  playerIn: z.string().trim().max(120).optional().default(''),
  minute: z.number().int().min(0).max(130).optional(),
});

const teamSideStat = z
  .object({ teamA: z.number().min(0).max(1000), teamB: z.number().min(0).max(1000) })
  .partial();

export const footballResultSchema = z.object({
  goals: z.array(footballGoalSchema).default([]),
  cards: z.array(footballCardSchema).default([]),
  substitutions: z.array(footballSubSchema).default([]),
  matchStats: z
    .object({
      possession: teamSideStat.optional(),
      shots: teamSideStat.optional(),
      shotsOnTarget: teamSideStat.optional(),
      corners: teamSideStat.optional(),
      fouls: teamSideStat.optional(),
    })
    .optional(),
  extraTime: z.boolean().default(false),
  penalties: z
    .object({ teamA: z.number().int().min(0), teamB: z.number().int().min(0) })
    .nullable()
    .optional(),
  result: z.object({ winner: objectId.nullable().optional() }),
  manOfTheMatch: playerRef,
  bonus: z.array(bonusEntrySchema).optional(),
  lineups: lineupsSchema,
  // Optional per-match tactical layout override (team defaults remain unchanged).
  formation: footballFormationBySideSchema.optional(),
});

/**
 * Discriminated payload for `PATCH /fixtures/:id/result`. The server picks the
 * right branch based on the fixture's tournament sport, but we still validate
 * structurally here.
 */
export const submitResultSchema = z.object({
  body: z.object({
    // Acknowledge propagation when re-submitting a knockout result whose winner
    // changed and a downstream match was already played (Module 5B).
    confirm: z.boolean().optional(),
    cricket: cricketResultSchema.optional(),
    football: footballResultSchema.optional(),
  }),
});

/* =====================================================================
 * Event-level edits (Module 5B) — add/edit/delete a single ball or a
 * single goal/card/substitution, even after a match is completed.
 * ===================================================================== */

export const eventOpSchema = z.object({
  body: z.object({
    target: z.enum(['cricketBall', 'cricketOver', 'goal', 'card', 'substitution']),
    op: z.enum(['add', 'edit', 'delete']),
    // Cricket location.
    inningsIndex: z.number().int().min(0).max(3).optional(),
    overIndex: z.number().int().min(0).max(199).optional(),
    ballIndex: z.number().int().min(0).max(39).optional(),
    // Football: index into the relevant event array.
    index: z.number().int().min(0).optional(),
    // Payload for add/edit (only the relevant one is read).
    ball: cricketBallSchema.optional(),
    over: cricketOverSchema.optional(),
    goal: footballGoalSchema.optional(),
    card: footballCardSchema.optional(),
    sub: footballSubSchema.optional(),
  }),
});

/* =====================================================================
 * Live updates — granular in-progress state + lightweight ticker fields
 * ===================================================================== */

/**
 * Live payloads carry the full in-progress granular state (so the server can
 * persist a resumable scorecard) plus a few flat ticker fields that the public
 * marquee reads directly without re-deriving.
 */
export const liveUpdateSchema = z.object({
  body: z.object({
    cricket: z
      .object({
        innings: z.array(cricketInningsSchema).max(4).optional(),
        currentInnings: z.number().int().min(0).max(3).optional(),
        battingTeam: objectId.optional(),
        runs: z.number().int().min(0).optional(),
        wickets: z.number().int().min(0).max(10).optional(),
        overs: z.number().min(0).optional(),
        commentary: z.string().max(280).optional(),
      })
      .optional(),
    football: z
      .object({
        goals: z.array(footballGoalSchema).optional(),
        cards: z.array(footballCardSchema).optional(),
        substitutions: z.array(footballSubSchema).optional(),
        formation: footballFormationBySideSchema.optional(),
        teamAGoals: z.number().int().min(0).optional(),
        teamBGoals: z.number().int().min(0).optional(),
        minute: z.number().int().min(0).max(130).optional(),
        commentary: z.string().max(280).optional(),
      })
      .optional(),
  }),
});
