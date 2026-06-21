import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, RotateCcw, Sparkles } from 'lucide-react';
import { FOOTBALL_FORMATION_PRESET_VALUES, normalizeFootballPosition } from '@tms/shared/constants';
import {
  emptyFormation,
  normalizeFormation,
  remapFormationPreset,
  setFormationSlotPlayer,
  setFormationSlotCoords,
  clearFormationPlayer,
  assignedFormationPlayerIds,
  slotsWithMeta,
  playerMapById,
} from '@/lib/formation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const SLOT_LINE_STYLES = {
  gk: 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.12)]',
  def: 'border-primary/45 bg-primary/12',
  mid: 'border-accent/45 bg-accent/12',
  fwd: 'border-[hsl(var(--success)/0.45)] bg-[hsl(var(--success)/0.12)]',
};

function shortName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

export default function FormationEditor({
  roster = [],
  value,
  onChange,
  disabled = false,
  title = 'Formation',
  description = 'Assign players by dragging or clicking into pitch slots.',
  compact = false,
}) {
  const formation = useMemo(() => normalizeFormation(value), [value]);
  const slots = useMemo(() => slotsWithMeta(formation), [formation]);
  const playersById = useMemo(() => playerMapById(roster), [roster]);
  const assigned = useMemo(() => new Set(assignedFormationPlayerIds(formation)), [formation]);
  const pitchRef = useRef(null);

  const [mode, setMode] = useState('assign');
  const [activePick, setActivePick] = useState(null); // { playerId, sourceSlotId|null }
  const [draggingPick, setDraggingPick] = useState(null); // { playerId, sourceSlotId|null }
  const [hoveredSlotId, setHoveredSlotId] = useState(null);
  const [benchDropActive, setBenchDropActive] = useState(false);
  const [layoutDrag, setLayoutDrag] = useState(null); // { slotId }
  const [layoutPreview, setLayoutPreview] = useState({});
  const layoutPreviewRef = useRef(layoutPreview);

  useEffect(() => {
    layoutPreviewRef.current = layoutPreview;
  }, [layoutPreview]);

  const bench = useMemo(
    () =>
      roster
        .filter((player) => !assigned.has(String(player._id)))
        .sort((a, b) => {
          const an = a.jerseyNumber ?? Number.MAX_SAFE_INTEGER;
          const bn = b.jerseyNumber ?? Number.MAX_SAFE_INTEGER;
          if (an !== bn) return an - bn;
          return a.name.localeCompare(b.name);
        }),
    [roster, assigned]
  );

  const canAssign = !disabled && typeof onChange === 'function';
  const activePlayer = activePick?.playerId ? playersById[String(activePick.playerId)] : null;
  const editingPositions = mode === 'edit';

  const assignPlayer = (slotId, pick) => {
    if (!canAssign || !pick?.playerId) return;
    onChange(
      setFormationSlotPlayer(formation, slotId, pick.playerId, {
        fromSlotId: pick.sourceSlotId ?? null,
        swap: true,
      })
    );
  };

  const removePlayerFromPitch = (playerId) => {
    if (!canAssign) return;
    onChange(clearFormationPlayer(formation, playerId));
  };

  const toPitchCoords = (clientX, clientY) => {
    const rect = pitchRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.max(0, Math.min(100, Number(x.toFixed(2)))),
      y: Math.max(0, Math.min(100, Number(y.toFixed(2)))),
    };
  };

  const clearLayoutState = () => {
    setLayoutDrag(null);
    setLayoutPreview({});
  };

  const clearInteractionState = () => {
    setDraggingPick(null);
    setHoveredSlotId(null);
    setBenchDropActive(false);
    clearLayoutState();
  };

  const onSlotClick = (slot) => {
    if (!canAssign || editingPositions) return;

    if (activePick?.playerId) {
      if (activePick.sourceSlotId === slot.slot) {
        setActivePick(null);
        return;
      }
      assignPlayer(slot.slot, activePick);
      setActivePick(null);
      return;
    }

    if (slot.playerId) {
      setActivePick({ playerId: String(slot.playerId), sourceSlotId: slot.slot });
    }
  };

  const onPresetChange = (preset) => {
    if (!canAssign) return;
    onChange(remapFormationPreset(formation, preset));
    setActivePick(null);
    clearInteractionState();
  };

  const startDrag = (e, playerId, sourceSlotId = null) => {
    if (!canAssign || !playerId) return;
    const pid = String(playerId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/player-id', pid);
    if (sourceSlotId) e.dataTransfer.setData('text/source-slot', sourceSlotId);
    setDraggingPick({ playerId: pid, sourceSlotId });
    setActivePick({ playerId: pid, sourceSlotId });
  };

  const resolveDropPayload = (e) => {
    const dataPlayerId = e.dataTransfer?.getData('text/player-id') || '';
    const dataSourceSlot = e.dataTransfer?.getData('text/source-slot') || '';
    const playerId = dataPlayerId || draggingPick?.playerId || activePick?.playerId || null;
    const sourceSlotId =
      dataSourceSlot || draggingPick?.sourceSlotId || activePick?.sourceSlotId || null;
    if (!playerId) return null;
    return { playerId: String(playerId), sourceSlotId: sourceSlotId || null };
  };

  const onSlotDrop = (slotId, e) => {
    e.preventDefault();
    if (!canAssign || editingPositions) return;
    const payload = resolveDropPayload(e);
    if (!payload) return;
    assignPlayer(slotId, payload);
    setActivePick(null);
    clearInteractionState();
  };

  const onBenchDrop = (e) => {
    e.preventDefault();
    if (!canAssign || editingPositions) return;
    const payload = resolveDropPayload(e);
    if (!payload?.playerId) return;
    removePlayerFromPitch(payload.playerId);
    if (activePick?.playerId === payload.playerId) setActivePick(null);
    clearInteractionState();
  };

  const startSlotPositionEdit = (slot, e) => {
    if (!canAssign || !editingPositions) return;
    e.preventDefault();
    const coords = toPitchCoords(e.clientX, e.clientY);
    if (!coords) return;
    setActivePick(null);
    setLayoutDrag({ slotId: slot.slot });
    setLayoutPreview((prev) => ({ ...prev, [slot.slot]: coords }));
  };

  useEffect(() => {
    if (!layoutDrag || !canAssign || !editingPositions) return undefined;

    const onMove = (e) => {
      const coords = toPitchCoords(e.clientX, e.clientY);
      if (!coords) return;
      setLayoutPreview((prev) => ({ ...prev, [layoutDrag.slotId]: coords }));
    };

    const finish = () => {
      const coords = layoutPreviewRef.current[layoutDrag.slotId];
      if (coords) {
        onChange(setFormationSlotCoords(formation, layoutDrag.slotId, coords));
      }
      setLayoutDrag(null);
      setLayoutPreview((prev) => {
        const next = { ...prev };
        delete next[layoutDrag.slotId];
        return next;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
  }, [layoutDrag, canAssign, editingPositions, formation, onChange]);

  const pitchSize = compact ? 'aspect-[4/3]' : 'aspect-[16/10]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAssign && (
            <div className="inline-flex rounded-md border border-border/70 bg-secondary/35 p-0.5">
              <Button
                type="button"
                size="sm"
                variant={editingPositions ? 'ghost' : 'secondary'}
                className="h-8 px-2.5 text-xs"
                onClick={() => {
                  setMode('assign');
                  clearLayoutState();
                }}
              >
                Assign players
              </Button>
              <Button
                type="button"
                size="sm"
                variant={editingPositions ? 'secondary' : 'ghost'}
                className="h-8 px-2.5 text-xs"
                onClick={() => {
                  setMode('edit');
                  setActivePick(null);
                  setDraggingPick(null);
                }}
              >
                Edit positions
              </Button>
            </div>
          )}
          <Badge variant="outline">{formation.preset}</Badge>
          <Select value={formation.preset} onValueChange={onPresetChange} disabled={!canAssign}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FOOTBALL_FORMATION_PRESET_VALUES.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {preset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canAssign && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActivePick(null);
                clearInteractionState();
                onChange(emptyFormation(formation.preset));
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset slots
            </Button>
          )}
        </div>
      </div>

      {canAssign && !editingPositions && activePick?.playerId && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
          <span className="font-medium text-primary">
            Selected:{' '}
            {activePlayer
              ? `${activePlayer.jerseyNumber != null ? `#${activePlayer.jerseyNumber} ` : ''}${shortName(activePlayer.name)}`
              : 'Player'}
          </span>
          <span className="text-muted-foreground">
            {activePick.sourceSlotId
              ? 'Tap or drop onto another slot to swap/move.'
              : 'Tap or drop onto a slot to assign.'}
          </span>
          {activePick.sourceSlotId && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                removePlayerFromPitch(activePick.playerId);
                setActivePick(null);
              }}
            >
              Move to bench
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-[11px]"
            onClick={() => setActivePick(null)}
          >
            Cancel
          </Button>
        </div>
      )}

      {canAssign && editingPositions && (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-muted-foreground">
          Drag any tactical card to a new place on the pitch. Position names update automatically
          from the card location.
        </p>
      )}

      <div
        ref={pitchRef}
        className={cn(
          'relative w-full overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-b from-[hsl(var(--success)/0.2)] via-[hsl(var(--success)/0.1)] to-[hsl(var(--success)/0.22)] p-3',
          pitchSize
        )}
      >
        <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/25" />
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-white/20" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-[12%] w-[22%] -translate-x-1/2 rounded-t-xl border border-b-0 border-white/20" />
        <div className="pointer-events-none absolute top-3 left-1/2 h-[12%] w-[22%] -translate-x-1/2 rounded-b-xl border border-t-0 border-white/20" />

        <AnimatePresence>
          {slots.map((slot) => {
            const player = slot.playerId ? playersById[String(slot.playerId)] : null;
            const sourceActive = activePick?.sourceSlotId === slot.slot;
            const hoverTarget =
              !editingPositions && hoveredSlotId === slot.slot && Boolean(draggingPick?.playerId);
            const dragSource = draggingPick?.sourceSlotId === slot.slot;
            const canPlaceHere =
              !editingPositions && Boolean(activePick?.playerId) && activePick.sourceSlotId !== slot.slot;
            const isLayoutDragging = layoutDrag?.slotId === slot.slot;
            const previewCoords = layoutPreview[slot.slot];
            const left = previewCoords?.x ?? slot.x;
            const top = previewCoords?.y ?? slot.y;

            return (
              <motion.button
                key={`${formation.preset}-${slot.slot}`}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                type="button"
                draggable={Boolean(player) && canAssign && !editingPositions}
                onDragStart={(e) => !editingPositions && player && startDrag(e, player._id, slot.slot)}
                onDragEnd={clearInteractionState}
                onDragOver={(e) => {
                  if (editingPositions) return;
                  e.preventDefault();
                  setHoveredSlotId(slot.slot);
                }}
                onDragLeave={() => {
                  if (editingPositions) return;
                  if (hoveredSlotId === slot.slot) setHoveredSlotId(null);
                }}
                onDrop={(e) => onSlotDrop(slot.slot, e)}
                onClick={() => onSlotClick(slot)}
                onPointerDown={(e) => startSlotPositionEdit(slot, e)}
                disabled={!canAssign}
                className={cn(
                  'absolute w-[clamp(4.5rem,20%,6.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-[clamp(0.35rem,1vw,0.5rem)] py-[clamp(0.3rem,0.9vw,0.45rem)] text-left shadow-md backdrop-blur-[1px] transition-all',
                  'relative',
                  SLOT_LINE_STYLES[slot.line] ?? SLOT_LINE_STYLES.mid,
                  canAssign && 'surface-interactive',
                  sourceActive && 'ring-2 ring-primary',
                  hoverTarget && 'ring-2 ring-primary/70',
                  dragSource && 'opacity-70',
                  isLayoutDragging && 'ring-2 ring-accent',
                  !player && 'opacity-90',
                  canPlaceHere && !player && 'border-dashed',
                  editingPositions && canAssign && 'cursor-grab active:cursor-grabbing touch-none select-none'
                )}
                style={{ left: `${left}%`, top: `${top}%` }}
              >
                {player && canAssign && (
                  <span className="pointer-events-none absolute right-1 top-1 inline-flex rounded bg-background/40 p-0.5 text-muted-foreground/80">
                    <GripVertical className="h-2.5 w-2.5" />
                  </span>
                )}
                <p className="truncate text-[clamp(0.5rem,1.8vw,0.625rem)] font-bold uppercase tracking-wider text-muted-foreground">
                  {slot.position || slot.label}
                </p>
                {player ? (
                  <>
                    <p className="truncate text-[clamp(0.56rem,2.1vw,0.75rem)] font-semibold">
                      {shortName(player.name)}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-[clamp(0.5rem,1.7vw,0.625rem)] text-muted-foreground">
                      {player.jerseyNumber != null && (
                        <span className="rounded bg-background/50 px-1 py-0.5 tabular-nums">
                          #{player.jerseyNumber}
                        </span>
                      )}
                      <span className="truncate">
                        {normalizeFootballPosition(player.role) || player.role || 'Player'}
                      </span>
                    </div>
                  </>
                ) : canPlaceHere ? (
                  <p className="text-[clamp(0.56rem,2vw,0.75rem)] font-medium text-primary">Drop / Tap</p>
                ) : (
                  <p className="text-[clamp(0.56rem,2vw,0.75rem)] text-muted-foreground">Unassigned</p>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <div
        onDragOver={(e) => {
          if (editingPositions) return;
          e.preventDefault();
          setBenchDropActive(true);
        }}
        onDragLeave={() => {
          if (editingPositions) return;
          setBenchDropActive(false);
        }}
        onDrop={onBenchDrop}
        className={cn(
          'rounded-xl border border-border/75 bg-card/70 p-3 transition-colors',
          benchDropActive && 'border-primary/40 bg-primary/5'
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bench ({bench.length})
          </p>
          <p className="text-[11px] text-muted-foreground">
            {canAssign
              ? editingPositions
                ? 'Position mode: drag any card to a tactical area.'
                : 'Assign mode: drag to swap or tap player then tap slot.'
              : 'Read-only'}
          </p>
        </div>
        {!bench.length ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Full XI assigned.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bench.map((player) => {
              const active =
                String(activePick?.playerId) === String(player._id) && !activePick?.sourceSlotId;
              return (
                <motion.button
                  key={player._id}
                  layout
                  type="button"
                  disabled={!canAssign || editingPositions}
                  draggable={canAssign && !editingPositions}
                  onDragStart={(e) => canAssign && !editingPositions && startDrag(e, player._id, null)}
                  onDragEnd={clearInteractionState}
                  onClick={() => {
                    if (!canAssign || editingPositions) return;
                    setActivePick((prev) =>
                      String(prev?.playerId) === String(player._id) && !prev?.sourceSlotId
                        ? null
                        : { playerId: String(player._id), sourceSlotId: null }
                    );
                  }}
                  className={cn(
                    'flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary/55 bg-primary/15 text-primary'
                      : 'border-border/70 bg-secondary/60 hover:bg-secondary'
                  )}
                >
                  <GripVertical className="h-3 w-3 opacity-60" />
                  {player.jerseyNumber != null ? `#${player.jerseyNumber} ` : ''}
                  {shortName(player.name)}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
