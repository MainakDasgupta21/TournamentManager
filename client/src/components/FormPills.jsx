import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const STYLE = {
  W: 'bg-[hsl(var(--success)/0.18)] text-[hsl(var(--success))] ring-1 ring-inset ring-[hsl(var(--success)/0.28)]',
  D: 'bg-secondary text-muted-foreground ring-1 ring-inset ring-border/55',
  L: 'bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/25',
};

const TITLE = { W: 'Win', D: 'Draw', L: 'Loss' };

const SIZES = {
  sm: 'h-5 w-5 text-[10px]',
  xs: 'h-[18px] w-[18px] text-[9px]',
};

const opponentLabel = (f) => f.opponent?.shortCode || f.opponent?.name || '';

/**
 * A row of recent-result pills (last-5 form). `form` is an array of
 * `{ result: 'W'|'D'|'L', opponent? }` ordered oldest -> newest.
 *
 * The whole strip is a single focusable tooltip trigger: hover, tap, or keyboard
 * focus reveals the match-by-match breakdown, and a screen-reader label reads the
 * sequence aloud — so the form guide is accessible without flooding the tab order
 * with one stop per pill.
 */
export function FormPills({ form = [], className, size = 'sm' }) {
  if (!form.length) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }

  const summary = form.map((f) => TITLE[f.result] ?? 'Draw').join(', ');

  const breakdown = (
    <ul className="space-y-1">
      {form.map((f, i) => (
        <li key={f.fixtureId ?? i} className="flex items-center gap-2">
          <span
            className={cn(
              'flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold',
              STYLE[f.result] ?? STYLE.D
            )}
          >
            {f.result}
          </span>
          <span className="whitespace-nowrap">
            {TITLE[f.result]}
            {opponentLabel(f) && <span className="text-muted-foreground"> vs {opponentLabel(f)}</span>}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <Tooltip label={breakdown}>
      <span
        tabIndex={0}
        role="img"
        aria-label={`Recent form, oldest to newest: ${summary}`}
        className={cn(
          'inline-flex items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
          className
        )}
      >
        {form.map((f, i) => (
          <span
            key={f.fixtureId ?? i}
            aria-hidden="true"
            className={cn(
              'flex items-center justify-center rounded font-bold',
              SIZES[size] ?? SIZES.sm,
              STYLE[f.result] ?? STYLE.D
            )}
          >
            {f.result}
          </span>
        ))}
      </span>
    </Tooltip>
  );
}
