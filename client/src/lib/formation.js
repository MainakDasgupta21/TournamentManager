import {
  FOOTBALL_FORMATION_PRESETS,
  FOOTBALL_FORMATION_PRESET_VALUES,
  footballPositionLine,
  inferFootballPitchPosition,
  normalizeFootballPosition,
} from '@tms/shared/constants';

export const DEFAULT_FOOTBALL_FORMATION_PRESET = FOOTBALL_FORMATION_PRESET_VALUES[0] ?? '4-3-3';

const clampCoord = (value, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
};

function normalizePlayerId(playerId) {
  return playerId == null ? null : String(playerId);
}

function normalizeSlot(meta, rawSlot = {}) {
  const x = clampCoord(rawSlot.x, meta.x);
  const y = clampCoord(rawSlot.y, meta.y);
  const position = normalizeFootballPosition(rawSlot.position) || inferFootballPitchPosition(x, y);
  return {
    slot: meta.slot,
    playerId: rawSlot.playerId ?? null,
    x,
    y,
    position,
  };
}

export function formationTemplate(preset) {
  return FOOTBALL_FORMATION_PRESETS[preset] ?? FOOTBALL_FORMATION_PRESETS[DEFAULT_FOOTBALL_FORMATION_PRESET] ?? [];
}

export function emptyFormation(preset = DEFAULT_FOOTBALL_FORMATION_PRESET) {
  return {
    preset,
    slots: formationTemplate(preset).map((meta) => normalizeSlot(meta)),
  };
}

export function normalizeFormation(value, fallbackPreset = DEFAULT_FOOTBALL_FORMATION_PRESET) {
  if (!value || !value.preset || !FOOTBALL_FORMATION_PRESETS[value.preset]) {
    return emptyFormation(fallbackPreset);
  }
  const template = formationTemplate(value.preset);
  const existing = new Map((value.slots ?? []).map((slot) => [slot.slot, slot]));
  return {
    preset: value.preset,
    slots: template.map((meta) => normalizeSlot(meta, existing.get(meta.slot))),
  };
}

export function remapFormationPreset(value, nextPreset) {
  const current = normalizeFormation(value);
  const template = formationTemplate(nextPreset);
  const currentBySlot = new Map(current.slots.map((slot) => [slot.slot, slot.playerId ?? null]));
  return {
    preset: nextPreset,
    slots: template.map((meta) => normalizeSlot(meta, { playerId: currentBySlot.get(meta.slot) ?? null })),
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
      if (canSwap && slot.slot === sourceSlotId) return { ...slot, playerId: targetPlayerId };
      if (pid && String(slot.playerId) === pid) return { ...slot, playerId: null };
      return { ...slot, playerId: slot.playerId ?? null };
    }),
  };
}

export function setFormationSlotCoords(formation, slotId, coords) {
  const current = normalizeFormation(formation);
  const currentSlot = current.slots.find((slot) => slot.slot === slotId);
  if (!currentSlot) return current;
  const x = clampCoord(coords?.x, currentSlot.x ?? 50);
  const y = clampCoord(coords?.y, currentSlot.y ?? 50);
  const position = inferFootballPitchPosition(x, y);
  return {
    preset: current.preset,
    slots: current.slots.map((slot) =>
      slot.slot === slotId
        ? {
            ...slot,
            x,
            y,
            position,
          }
        : slot
    ),
  };
}

export function clearFormationPlayer(formation, playerId) {
  const current = normalizeFormation(formation);
  const pid = normalizePlayerId(playerId);
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
  const bySlot = new Map(normalized.slots.map((slot) => [slot.slot, slot]));
  return formationTemplate(normalized.preset).map((meta) => {
    const raw = bySlot.get(meta.slot) ?? {};
    const x = clampCoord(raw.x, meta.x);
    const y = clampCoord(raw.y, meta.y);
    const position = normalizeFootballPosition(raw.position) || inferFootballPitchPosition(x, y);
    return {
      ...meta,
      x,
      y,
      position,
      line: footballPositionLine(position),
      label: position,
      playerId: raw.playerId ?? null,
    };
  });
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
