import { CheckCircle2, CircleDot, XCircle } from 'lucide-react';
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
 * Compact "can they still qualify?" board for a group. Renders nothing when the
 * group has no games left (the final table already tells that story).
 */
export default function QualificationPanel({ scenarios }) {
  if (!scenarios || scenarios.remainingFixtures === 0) return null;
  const { teams, qualifyCount, remainingFixtures } = scenarios;

  return (
    <div className="mt-4 rounded-xl border border-border/70 bg-secondary/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Qualification scenarios</h4>
        <span className="text-xs text-muted-foreground">
          Top {qualifyCount} advance · {remainingFixtures} game{remainingFixtures === 1 ? '' : 's'} left
        </span>
      </div>

      <ul className="space-y-1.5">
        {teams.map((t) => {
          const s = STYLES[t.status];
          const Icon = s.icon;
          return (
            <li key={t.teamId} className="flex items-center gap-2.5 text-sm">
              <Icon className={cn('h-4 w-4 shrink-0', s.dot)} />
              <span className="flex-1 truncate font-medium">{t.name}</span>
              <span className="hidden tabular-nums text-xs text-muted-foreground sm:inline">
                {t.points} pts{t.remaining > 0 ? ` · max ${t.maxPoints}` : ''}
              </span>
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', s.pill)}>
                {QUALIFICATION_LABELS[t.status]}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Points-based projection. Ties on equal points are decided later by{' '}
        {/* sport-agnostic phrasing */}net run rate / goal difference, so boundary cases stay &ldquo;in the hunt&rdquo;.
      </p>
    </div>
  );
}
