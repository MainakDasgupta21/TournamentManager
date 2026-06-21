import { z } from 'zod';
import {
  FOOTBALL_FORMATION_PRESETS,
  FOOTBALL_FORMATION_PRESET_VALUES,
  FOOTBALL_FORMATION_SLOT_COUNT,
  FOOTBALL_PITCH_PLAYER_COUNT,
  FOOTBALL_POSITION_VALUES,
} from '../constants.js';
import { objectId } from './common.js';

export const footballFormationSlotSchema = z.object({
  slot: z.string().trim().min(1).max(16),
  playerId: objectId.nullable().optional(),
  x: z.number().min(0).max(100).optional(),
  y: z.number().min(0).max(100).optional(),
  position: z.enum(FOOTBALL_POSITION_VALUES).optional(),
});

/**
 * Football formation with fixed preset slots. Slots are always fully enumerated
 * and every slot must be assigned for strict XI validation.
 */
export const footballFormationSchema = z
  .object({
    preset: z.enum(FOOTBALL_FORMATION_PRESET_VALUES),
    slots: z.array(footballFormationSlotSchema).length(FOOTBALL_FORMATION_SLOT_COUNT),
  })
  .superRefine((value, ctx) => {
    const expected = (FOOTBALL_FORMATION_PRESETS[value.preset] ?? []).map((s) => s.slot);
    const uniqueExpected = new Set(expected);
    if (expected.length !== FOOTBALL_FORMATION_SLOT_COUNT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Preset ${value.preset} is misconfigured`,
        path: ['preset'],
      });
      return;
    }
    if (uniqueExpected.size !== expected.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Preset ${value.preset} has duplicate slot ids`,
        path: ['preset'],
      });
      return;
    }

    const actual = value.slots.map((s) => s.slot);
    const uniqueActual = new Set(actual);
    if (uniqueActual.size !== actual.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Formation slots cannot repeat',
        path: ['slots'],
      });
    }

    for (const slot of expected) {
      if (!uniqueActual.has(slot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing required slot: ${slot}`,
          path: ['slots'],
        });
      }
    }
    for (const slot of uniqueActual) {
      if (!expected.includes(slot)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Slot ${slot} is not valid for ${value.preset}`,
          path: ['slots'],
        });
      }
    }

    const assigned = value.slots
      .map((s) => (s.playerId == null ? null : String(s.playerId)))
      .filter(Boolean);
    if (new Set(assigned).size !== assigned.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A player can only be assigned to one slot',
        path: ['slots'],
      });
    }
    if (assigned.length !== FOOTBALL_PITCH_PLAYER_COUNT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Formation must assign exactly ${FOOTBALL_PITCH_PLAYER_COUNT} players`,
        path: ['slots'],
      });
    }
  });

/** Per-side formation overrides for a fixture. */
export const footballFormationBySideSchema = z
  .object({
    teamA: footballFormationSchema,
    teamB: footballFormationSchema,
  })
  .partial();
