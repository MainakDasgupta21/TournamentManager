import { cn } from '@/lib/utils';

const STYLE = {
  W: 'bg-[hsl(var(--success)/0.18)] text-[hsl(var(--success))]',
  D: 'bg-secondary text-muted-foreground',
  L: 'bg-destructive/15 text-destructive',
};

const TITLE = { W: 'Win', D: 'Draw', L: 'Loss' };

/**
 * A row of recent-result pills (last-5 form). `form` is an array of
 * `{ result: 'W'|'D'|'L', opponent? }` ordered oldest -> newest.
 */
export function FormPills({ form = [], className }) {
  if (!form.length) {
    return <span className="text-xs text-muted-foreground/60">—</span>;
  }
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {form.map((f, i) => (
        <span
          key={f.fixtureId ?? i}
          title={`${TITLE[f.result]}${f.opponent?.shortCode ? ` vs ${f.opponent.shortCode}` : f.opponent?.name ? ` vs ${f.opponent.name}` : ''}`}
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold',
            STYLE[f.result] ?? STYLE.D
          )}
        >
          {f.result}
        </span>
      ))}
    </div>
  );
}
