import { cn } from '@/lib/utils';
import { normalizeFormation, slotsWithMeta } from '@/lib/formation';

function shortName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1]}`;
}

const SLOT_LINE_STYLES = {
  gk: 'border-[hsl(var(--warning)/0.45)] bg-[hsl(var(--warning)/0.12)]',
  def: 'border-primary/45 bg-primary/12',
  mid: 'border-accent/45 bg-accent/12',
  fwd: 'border-[hsl(var(--success)/0.45)] bg-[hsl(var(--success)/0.12)]',
};

export default function FormationBoard({
  formation,
  playersById = {},
  title = 'Formation',
  subtitle,
  compact = false,
  className,
  emptyMessage = 'Formation not available yet.',
}) {
  if (!formation) {
    return (
      <div className={cn('rounded-xl border border-border/70 bg-card/70 p-4', className)}>
        <p className="text-sm font-semibold">{title}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const normalized = normalizeFormation(formation);
  const slots = slotsWithMeta(normalized);
  const pitchSize = compact ? 'aspect-[4/3]' : 'aspect-[16/10]';

  return (
    <div className={cn('space-y-2 rounded-xl border border-border/70 bg-card/70 p-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-xs font-semibold text-muted-foreground">{normalized.preset}</span>
      </div>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}

      <div
        className={cn(
          'relative w-full overflow-hidden rounded-xl border border-border/70 bg-gradient-to-b from-[hsl(var(--success)/0.2)] via-[hsl(var(--success)/0.1)] to-[hsl(var(--success)/0.22)]',
          pitchSize
        )}
      >
        <div className="pointer-events-none absolute inset-2 rounded-lg border border-white/20" />
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/20" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />

        {slots.map((slot) => {
          const player = slot.playerId ? playersById[String(slot.playerId)] : null;
          return (
            <div
              key={`${normalized.preset}-${slot.slot}`}
              className={cn(
                'absolute w-[clamp(4rem,18%,5.5rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border px-1.5 py-1 text-left shadow-md',
                SLOT_LINE_STYLES[slot.line] ?? SLOT_LINE_STYLES.mid
              )}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <p className="truncate text-[clamp(0.5rem,1.8vw,0.625rem)] font-bold uppercase tracking-wider text-muted-foreground">
                {slot.label}
              </p>
              {player ? (
                <>
                  <p className="truncate text-[clamp(0.56rem,2.1vw,0.69rem)] font-semibold">{shortName(player.name)}</p>
                  <p className="truncate text-[clamp(0.5rem,1.7vw,0.625rem)] text-muted-foreground">
                    {player.jerseyNumber != null ? `#${player.jerseyNumber} · ` : ''}
                    {player.role || 'Player'}
                  </p>
                </>
              ) : (
                <p className="text-[clamp(0.5rem,1.7vw,0.625rem)] text-muted-foreground">Unassigned</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
