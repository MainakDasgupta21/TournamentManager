import { Loader2, AlertTriangle, RotateCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function Spinner({ className }) {
  return <Loader2 className={cn('animate-spin text-muted-foreground', className)} />;
}

export function Skeleton({ className }) {
  return <div className={cn('shimmer rounded-lg bg-secondary/65', className)} />;
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card/55 py-20 text-muted-foreground"
    >
      <Spinner className="h-6 w-6" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div
      role="status"
      className="surface-elevated flex flex-col items-center justify-center rounded-2xl border border-border/75 px-6 py-14 text-center"
    >
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary/70 text-muted-foreground">
          <Icon className="h-6 w-6" />
        </span>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground/90">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Friendly, branded failure state with an optional retry action. */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Please try again.',
  onRetry,
}) {
  return (
    <div
      role="alert"
      className="surface-elevated flex flex-col items-center justify-center rounded-2xl border border-destructive/35 bg-destructive/10 px-6 py-14 text-center"
    >
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/15">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
          <RotateCw /> Try again
        </Button>
      )}
    </div>
  );
}

/* ----------------------------- Filters ----------------------------- */

/** Rounded pill toggle used by list toolbars (status / sport quick filters). */
export function FilterChip({ active, onClick, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        active
          ? 'border-primary/45 bg-primary text-primary-foreground shadow-[var(--shadow-soft)]'
          : 'border-border/80 bg-card/50 text-muted-foreground hover:border-primary/35 hover:bg-secondary/65 hover:text-foreground',
        className
      )}
    >
      {children}
    </button>
  );
}

/** Text input with a leading magnifier, used for client-side list search. */
export function SearchInput({ value, onChange, placeholder = 'Search…', className, ...props }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/90" />
      <Input
        type="search"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-9"
        {...props}
      />
    </div>
  );
}

/** Previous / next pager for server-paginated lists. Renders nothing for a single page. */
export function Pager({ page, pages, onPage, className }) {
  if (!pages || pages <= 1) return null;
  return (
    <div className={cn('flex items-center justify-center gap-3 rounded-2xl border border-border/70 bg-card/55 px-3 py-2', className)}>
      <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
      <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </div>
  );
}

/* ----------------------------- Skeletons ----------------------------- */

/** Card-shaped placeholder mirroring the tournament/list cards. */
export function SkeletonCard({ className, media = true }) {
  return (
    <div className={cn('surface-elevated overflow-hidden rounded-2xl border border-border/80', className)}>
      {media && <Skeleton className="h-24 w-full rounded-none" />}
      <div className="space-y-3 p-5">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/** Responsive grid of skeleton cards used for listing pages. */
export function SkeletonGrid({ count = 6, media = true, className }) {
  return (
    <div className={cn('grid gap-5 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} media={media} />
      ))}
    </div>
  );
}

/** Table placeholder for standings-style content. */
export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="surface-elevated rounded-2xl border border-border/80 p-5">
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-6 w-6 rounded" />
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Hero-band placeholder used while a tournament header loads. */
export function SkeletonHero() {
  return (
    <div className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 pb-6 pt-12 sm:px-6">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="mt-3 h-16 w-2/3" />
        <Skeleton className="mt-4 h-4 w-1/3" />
      </div>
    </div>
  );
}

/** Team crest: shows logo if present, else colored initials chip. */
export function TeamCrest({ team, size = 'md' }) {
  const sizes = { sm: 'h-6 w-6 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-14 w-14 text-lg' };
  if (team?.logo) {
    return (
      <img
        src={team.logo}
        alt={team.name}
        loading="lazy"
        decoding="async"
        className={cn('rounded-md object-cover', sizes[size])}
        style={{ background: team.primaryColor }}
      />
    );
  }
  return (
    <div
      className={cn('flex items-center justify-center rounded-md font-bold text-white', sizes[size])}
      style={{ background: team?.primaryColor || '#6366f1' }}
    >
      {team?.shortCode || (team?.name || '?').slice(0, 2).toUpperCase()}
    </div>
  );
}
