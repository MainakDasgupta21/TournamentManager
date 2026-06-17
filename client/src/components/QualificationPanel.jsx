import { useId, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleDot, XCircle } from 'lucide-react';
import { QUALIFICATION_LABELS } from '@/lib/qualification';
import { cn } from '@/lib/utils';

const STYLES = {
  qualified: {
    icon: CheckCircle2,
    pill: 'bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]',
    dot: 'text-[hsl(var(--success))]',
  },
  contention: {
    icon: CircleDot,
    pill: 'bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]',
    dot: 'text-[hsl(var(--warning))]',
  },
  eliminated: {
    icon: XCircle,
    pill: 'bg-destructive/15 text-destructive',
    dot: 'text-destructive',
  },
};

/**
 * Collapsible "can they still qualify?" board for a group. Renders nothing when
 * the group has no games left (the final table already tells that story).
 * `defaultOpen` lets the parent collapse panels in the dense all-groups view
 * while keeping them open when a single group is in focus.
 */
export default function QualificationPanel({ scenarios, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  if (!scenarios || scenarios.remainingFixtures === 0) return null;
  const { teams, qualifyCount, remainingFixtures } = scenarios;

  return (
    <div className="surface-elevated mt-4 overflow-hidden rounded-2xl border border-border/75">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-secondary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <h4 className="text-sm font-semibold tracking-[-0.01em]">Qualification scenarios</h4>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="hidden sm:inline">
            Top {qualifyCount} advance · {remainingFixtures} game{remainingFixtures === 1 ? '' : 's'} left
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', open && 'rotate-180')} />
        </span>
      </button>

      {open && (
        <div id={panelId} className="px-4 pb-4">
          <ul className="space-y-2">
            {teams.map((t) => {
              const s = STYLES[t.status];
              const Icon = s.icon;
              return (
                <li
                  key={t.teamId}
                  className="flex items-center gap-2.5 rounded-xl border border-border/65 bg-card/55 px-2.5 py-2 text-sm"
                >
                  <Icon className={cn('h-4 w-4 shrink-0', s.dot)} />
                  <span className="flex-1 truncate font-medium">{t.name}</span>
                  <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                    {t.points} pts
                    {t.remaining > 0 && <span className="hidden sm:inline"> · max {t.maxPoints}</span>}
                  </span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', s.pill)}>
                    {QUALIFICATION_LABELS[t.status]}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Projection based on points only. Net run rate and goal-difference tiebreakers aren&rsquo;t modelled, so teams
            sitting on the qualification boundary stay &ldquo;in the hunt&rdquo;.
          </p>
        </div>
      )}
    </div>
  );
}
