import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GripVertical, RotateCcw, Sparkles } from 'lucide-react';
import { FOOTBALL_FORMATION_PRESET_VALUES } from '@tms/shared/constants';
import {
  emptyFormation,
  normalizeFormation,
  remapFormationPreset,
  setFormationSlotPlayer,
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

  const [activePlayerId, setActivePlayerId] = useState(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState(null);

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

  const assignPlayer = (slotId, playerId) => {
    if (!canAssign) return;
    onChange(setFormationSlotPlayer(formation, slotId, playerId));
  };

  const removePlayerFromPitch = (playerId) => {
    if (!canAssign) return;
    onChange(clearFormationPlayer(formation, playerId));
  };

  const onSlotClick = (slot) => {
    if (!canAssign) return;
    if (activePlayerId) {
      assignPlayer(slot.slot, activePlayerId);
      setActivePlayerId(null);
      return;
    }
    if (slot.playerId) {
      setActivePlayerId(String(slot.playerId));
    }
  };

  const onPresetChange = (preset) => {
    if (!canAssign) return;
    onChange(remapFormationPreset(formation, preset));
    setActivePlayerId(null);
  };

  const onSlotDrop = (slotId, e) => {
    e.preventDefault();
    if (!canAssign) return;
    const pid = e.dataTransfer.getData('text/player-id') || draggingPlayerId;
    if (!pid) return;
    assignPlayer(slotId, pid);
    setDraggingPlayerId(null);
    setActivePlayerId(null);
  };

  const onBenchDrop = (e) => {
    e.preventDefault();
    if (!canAssign) return;
    const pid = e.dataTransfer.getData('text/player-id') || draggingPlayerId;
    if (!pid) return;
    removePlayerFromPitch(pid);
    setDraggingPlayerId(null);
  };

  const pitchSize = compact ? 'aspect-[4/3]' : 'aspect-[16/10]';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
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
                setActivePlayerId(null);
                onChange(emptyFormation(formation.preset));
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset slots
            </Button>
          )}
        </div>
      </div>

      <div
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
            const selected = activePlayerId && String(slot.playerId) === String(activePlayerId);
            return (
              <motion.button
                key={`${formation.preset}-${slot.slot}`}
                layout
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.18 }}
                type="button"
                draggable={Boolean(player) && canAssign}
                onDragStart={(e) => {
                  if (!player) return;
                  setDraggingPlayerId(String(player._id));
                  e.dataTransfer.setData('text/player-id', String(player._id));
                }}
                onDragEnd={() => setDraggingPlayerId(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onSlotDrop(slot.slot, e)}
                onClick={() => onSlotClick(slot)}
                disabled={!canAssign}
                className={cn(
                  'absolute w-[clamp(4.5rem,20%,6.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl border px-[clamp(0.35rem,1vw,0.5rem)] py-[clamp(0.3rem,0.9vw,0.45rem)] text-left shadow-md backdrop-blur-[1px] transition-all',
                  SLOT_LINE_STYLES[slot.line] ?? SLOT_LINE_STYLES.mid,
                  canAssign && 'surface-interactive',
                  selected && 'ring-2 ring-primary',
                  !player && 'opacity-90'
                )}
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              >
                <p className="truncate text-[clamp(0.5rem,1.8vw,0.625rem)] font-bold uppercase tracking-wider text-muted-foreground">
                  {slot.label}
                </p>
                {player ? (
                  <>
                    <p className="truncate text-[clamp(0.56rem,2.1vw,0.75rem)] font-semibold">{shortName(player.name)}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-[clamp(0.5rem,1.7vw,0.625rem)] text-muted-foreground">
                      {player.jerseyNumber != null && (
                        <span className="rounded bg-background/50 px-1 py-0.5 tabular-nums">
                          #{player.jerseyNumber}
                        </span>
                      )}
                      <span className="truncate">{player.role || 'Player'}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-[clamp(0.56rem,2vw,0.75rem)] text-muted-foreground">Unassigned</p>
                )}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onBenchDrop}
        className="rounded-xl border border-border/75 bg-card/70 p-3"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bench ({bench.length})
          </p>
          <p className="text-[11px] text-muted-foreground">
            {canAssign ? 'Click a player then click a slot, or drag to a slot.' : 'Read-only'}
          </p>
        </div>
        {!bench.length ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Full XI assigned.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {bench.map((player) => {
              const active = String(activePlayerId) === String(player._id);
              return (
                <motion.button
                  key={player._id}
                  layout
                  type="button"
                  draggable={canAssign}
                  onDragStart={(e) => {
                    if (!canAssign) return;
                    setDraggingPlayerId(String(player._id));
                    e.dataTransfer.setData('text/player-id', String(player._id));
                  }}
                  onDragEnd={() => setDraggingPlayerId(null)}
                  onClick={() =>
                    setActivePlayerId((prev) =>
                      String(prev) === String(player._id) ? null : String(player._id)
                    )
                  }
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
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
