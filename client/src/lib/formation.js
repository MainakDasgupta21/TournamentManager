import { FOOTBALL_FORMATION_PRESETS, FOOTBALL_FORMATION_PRESET_VALUES } from '@tms/shared/constants';

export const DEFAULT_FOOTBALL_FORMATION_PRESET = FOOTBALL_FORMATION_PRESET_VALUES[0] ?? '4-3-3';

export function formationTemplate(preset) {
  return FOOTBALL_FORMATION_PRESETS[preset] ?? FOOTBALL_FORMATION_PRESETS[DEFAULT_FOOTBALL_FORMATION_PRESET] ?? [];
}

export function emptyFormation(preset = DEFAULT_FOOTBALL_FORMATION_PRESET) {
  return {
    preset,
    slots: formationTemplate(preset).map((slot) => ({ slot: slot.slot, playerId: null })),
  };
}

export function normalizeFormation(value, fallbackPreset = DEFAULT_FOOTBALL_FORMATION_PRESET) {
  if (!value || !value.preset || !FOOTBALL_FORMATION_PRESETS[value.preset]) {
    return emptyFormation(fallbackPreset);
  }
  const expected = formationTemplate(value.preset).map((slot) => slot.slot);
  const existing = new Map((value.slots ?? []).map((slot) => [slot.slot, slot.playerId ?? null]));
  return {
    preset: value.preset,
    slots: expected.map((slot) => ({ slot, playerId: existing.get(slot) ?? null })),
  };
}

export function remapFormationPreset(value, nextPreset) {
  const current = normalizeFormation(value);
  const next = emptyFormation(nextPreset);
  const currentBySlot = new Map(current.slots.map((slot) => [slot.slot, slot.playerId ?? null]));
  return {
    preset: nextPreset,
    slots: next.slots.map((slot) => ({
      slot: slot.slot,
      playerId: currentBySlot.get(slot.slot) ?? null,
    })),
  };
}

export function assignedFormationPlayerIds(formation) {
  return [
    ...new Set(
      (formation?.slots ?? [])
        .map((slot) => (slot.playerId == null ? null : String(slot.playerId)))
        .filter(Boolean)
    ),
  ];
}

function normalizePlayerId(playerId) {
  return playerId == null ? null : String(playerId);
}

function slotIdForPlayer(slots, playerId) {
  const pid = normalizePlayerId(playerId);
  if (!pid) return null;
  return slots.find((slot) => String(slot.playerId) === pid)?.slot ?? null;
}

export function swapFormationSlots(formation, fromSlotId, toSlotId) {
  const current = normalizeFormation(formation);
  if (!fromSlotId || !toSlotId || fromSlotId === toSlotId) return current;
  const from = current.slots.find((slot) => slot.slot === fromSlotId);
  const to = current.slots.find((slot) => slot.slot === toSlotId);
  if (!from || !to) return current;
  const fromPlayerId = normalizePlayerId(from.playerId);
  const toPlayerId = normalizePlayerId(to.playerId);
  return {
    preset: current.preset,
    slots: current.slots.map((slot) => {
      if (slot.slot === fromSlotId) return { ...slot, playerId: toPlayerId };
      if (slot.slot === toSlotId) return { ...slot, playerId: fromPlayerId };
      return { ...slot, playerId: slot.playerId ?? null };
    }),
  };
}

export function setFormationSlotPlayer(formation, slotId, playerId, options = {}) {
  const current = normalizeFormation(formation);
  const pid = normalizePlayerId(playerId);
  const target = current.slots.find((slot) => slot.slot === slotId);
  if (!target) return current;

  const sourceSlotId = options.fromSlotId ?? slotIdForPlayer(current.slots, pid);
  const targetPlayerId = normalizePlayerId(target.playerId);
  const canSwap =
    Boolean(options.swap ?? true) &&
    Boolean(sourceSlotId) &&
    sourceSlotId !== slotId &&
    Boolean(targetPlayerId) &&
    targetPlayerId !== pid;

  return {
    preset: current.preset,
    slots: current.slots.map((slot) => {
      if (slot.slot === slotId) return { ...slot, playerId: pid };
      if (canSwap && slot.slot === sourceSlotId) {
        return { ...slot, playerId: targetPlayerId };
      }
      if (pid && String(slot.playerId) === pid) return { ...slot, playerId: null };
      return { ...slot, playerId: slot.playerId ?? null };
    }),
  };
}

export function clearFormationPlayer(formation, playerId) {
  const current = normalizeFormation(formation);
  const pid = playerId == null ? null : String(playerId);
  return {
    preset: current.preset,
    slots: current.slots.map((slot) => ({
      ...slot,
      playerId: pid && String(slot.playerId) === pid ? null : slot.playerId ?? null,
    })),
  };
}

export function slotsWithMeta(formation) {
  const normalized = normalizeFormation(formation);
  const bySlot = new Map(normalized.slots.map((slot) => [slot.slot, slot.playerId ?? null]));
  return formationTemplate(normalized.preset).map((meta) => ({
    ...meta,
    playerId: bySlot.get(meta.slot) ?? null,
  }));
}

export function formationFromResult(result) {
  return {
    teamA: result?.formation?.teamA ?? null,
    teamB: result?.formation?.teamB ?? null,
  };
}

export function cleanFormationOverrides(value) {
  const out = {};
  if (value?.teamA) out.teamA = normalizeFormation(value.teamA);
  if (value?.teamB) out.teamB = normalizeFormation(value.teamB);
  return Object.keys(out).length ? out : undefined;
}

export function effectiveFormation({ override, fallback }) {
  if (override) return normalizeFormation(override);
  if (fallback) return normalizeFormation(fallback);
  return null;
}

export function playerMapById(players = []) {
  return players.reduce((map, player) => {
    map[String(player._id)] = player;
    return map;
  }, {});
}
