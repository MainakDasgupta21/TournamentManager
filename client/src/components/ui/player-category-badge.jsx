import { cn } from '@/lib/utils';

/**
 * Per-tier color tones (dark-first palette, mirroring the app's chip styling).
 * Strongest (S++) reads as gold, descending through the spectrum to a muted D.
 */
const TONES = {
  'S++': 'border-amber-400/50 bg-amber-400/15 text-amber-300',
  S: 'border-violet-400/50 bg-violet-400/15 text-violet-300',
  A: 'border-emerald-400/50 bg-emerald-400/15 text-emerald-300',
  B: 'border-sky-400/50 bg-sky-400/15 text-sky-300',
  C: 'border-slate-400/50 bg-slate-400/15 text-slate-300',
  D: 'border-zinc-500/50 bg-zinc-500/15 text-zinc-400',
};

const SIZES = {
  sm: 'px-2 py-0.5 text-[11px]',
  xs: 'px-1.5 py-0 text-[10px]',
};

/**
 * Colored tier chip for a player's manually-assigned category (S++ … D).
 * Renders nothing for an unrated player unless `showUnrated` is set.
 */
export function PlayerCategoryBadge({ category, size = 'sm', showUnrated = false, className }) {
  if (!category) {
    if (!showUnrated) return null;
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border border-border/70 bg-secondary/50 font-semibold text-muted-foreground',
          SIZES[size] ?? SIZES.sm,
          className
        )}
      >
        Unrated
      </span>
    );
  }
  return (
    <span
      title={`Category ${category}`}
      aria-label={`Category ${category}`}
      className={cn(
        'inline-flex items-center rounded-full border font-bold tracking-tight',
        SIZES[size] ?? SIZES.sm,
        TONES[category] ?? TONES.D,
        className
      )}
    >
      {category}
    </span>
  );
}
