import { describe, expect, it } from 'vitest';
import {
  FOOTBALL_FORMATION_PRESETS,
  inferFootballFormationPositions,
} from '@tms/shared/constants';
import { normalizeFormation, remapFormationPreset } from '../../client/src/lib/formation.js';

function bySlot(entries) {
  return Object.fromEntries(entries.map((entry) => [entry.slot, entry.position]));
}

function presetSlots(preset) {
  return (FOOTBALL_FORMATION_PRESETS[preset] ?? []).map((slot) => ({
    slot: slot.slot,
    x: slot.x,
    y: slot.y,
  }));
}

describe('inferFootballFormationPositions regressions', () => {
  it('keeps 3-5-2 wing-backs in defensive roles', () => {
    const inferred = bySlot(inferFootballFormationPositions(presetSlots('3-5-2')));
    expect(inferred.GK).toBe('GK');
    expect(inferred.LWB).toBe('LB');
    expect(inferred.RWB).toBe('RB');
    expect(['LCB', 'RCB']).toContain(inferred.CB);
    expect(inferred.CB).not.toBe('LB');
    expect(inferred.CB).not.toBe('RB');
  });

  it('keeps 3-4-3 wide midfielders out of defensive classification', () => {
    const inferred = bySlot(inferFootballFormationPositions(presetSlots('3-4-3')));
    expect(inferred.LM).toBe('LMF');
    expect(inferred.RM).toBe('RMF');
  });

  it('keeps 5-3-2 wing-backs as full-backs', () => {
    const inferred = bySlot(inferFootballFormationPositions(presetSlots('5-3-2')));
    expect(inferred.LWB).toBe('LB');
    expect(inferred.RWB).toBe('RB');
  });

  it('does not steal GK label when an outfield slot is dragged deeper', () => {
    const dragged = presetSlots('4-3-3').map((slot) =>
      slot.slot === 'ST'
        ? {
            ...slot,
            y: 95,
          }
        : slot
    );
    const inferred = bySlot(inferFootballFormationPositions(dragged));
    expect(inferred.GK).toBe('GK');
    expect(inferred.ST).not.toBe('GK');
  });
});

describe('remapFormationPreset regressions', () => {
  it('preserves all assigned players and overlapping custom coordinates', () => {
    const base = normalizeFormation({
      preset: '4-3-3',
      slots: (FOOTBALL_FORMATION_PRESETS['4-3-3'] ?? []).map((slot, index) => ({
        slot: slot.slot,
        playerId: `p${index + 1}`,
        x: slot.x + 0.75,
        y: slot.y - 0.5,
      })),
    });

    const remapped = remapFormationPreset(base, '4-4-2');
    expect(remapped.preset).toBe('4-4-2');

    const assignedIds = remapped.slots.map((slot) => slot.playerId).filter(Boolean);
    expect(assignedIds).toHaveLength(11);
    expect(new Set(assignedIds).size).toBe(11);

    const beforeGK = base.slots.find((slot) => slot.slot === 'GK');
    const afterGK = remapped.slots.find((slot) => slot.slot === 'GK');
    expect(afterGK.x).toBe(beforeGK.x);
    expect(afterGK.y).toBe(beforeGK.y);
  });
});
