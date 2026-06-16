import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TOURNAMENT_STATUS = {
  setup: { label: 'Setup', variant: 'secondary' },
  groupStage: { label: 'Group stage', variant: 'accent' },
  knockoutStage: { label: 'Knockout', variant: 'default' },
  completed: { label: 'Completed', variant: 'success' },
};

/** Human, consistent label/variant for a tournament lifecycle status. */
export function TournamentStatusBadge({ status, className }) {
  const s = TOURNAMENT_STATUS[status] ?? TOURNAMENT_STATUS.setup;
  return <Badge variant={s.variant} className={className}>{s.label}</Badge>;
}

/** True when a tournament is actively in progress (group or knockout stage). */
export function isInProgress(status) {
  return status === 'groupStage' || status === 'knockoutStage';
}

/**
 * Sport-aware fixture status badge. Completed matches read "Result" for cricket
 * and "FT" for football; live matches get a pulsing dot.
 */
export function FixtureStatusBadge({ status, sport, className }) {
  if (status === 'live') {
    return (
      <Badge variant="live" className={cn('gap-1.5', className)}>
        <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
        LIVE
      </Badge>
    );
  }
  if (status === 'completed') {
    return (
      <Badge variant="secondary" className={className}>
        {sport === 'football' ? 'FT' : 'Result'}
      </Badge>
    );
  }
  return <Badge variant="outline" className={className}>Upcoming</Badge>;
}
