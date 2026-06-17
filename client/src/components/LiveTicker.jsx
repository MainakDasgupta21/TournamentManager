import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import { Radio, Activity } from 'lucide-react';
import { TeamCrest } from '@/components/ui/misc';
import { oversDisplay, resultSummary } from '@/lib/format';
import { cn } from '@/lib/utils';

function TickerCell({ fixture, sport, live, tournamentId, duplicate }) {
  let score = 'vs';
  if (fixture.status === 'completed') score = resultSummary(fixture) || 'FT';
  else if (fixture.status === 'live' && live) {
    score =
      sport === 'cricket'
        ? `${live.runs ?? 0}/${live.wickets ?? 0} (${oversDisplay(live.overs)})`
        : `${live.teamAGoals ?? 0}-${live.teamBGoals ?? 0}`;
  }
  const aName = fixture.teamA?.name || fixture.teamA?.shortCode || 'TBD';
  const bName = fixture.teamB?.name || fixture.teamB?.shortCode || 'TBD';
  const statusWord =
    fixture.status === 'live' ? 'live now' : fixture.status === 'completed' ? 'full time' : 'upcoming';
  const ariaLabel = `${aName} versus ${bName}, ${statusWord}`;
  const body = (
    <>
      {fixture.status === 'live' && (
        <span aria-hidden="true" className="live-dot inline-block h-2 w-2 rounded-full bg-destructive" />
      )}
      <TeamCrest team={fixture.teamA} size="sm" />
      <span className="font-medium">{fixture.teamA?.shortCode || '—'}</span>
      <span className="px-1 font-bold tabular-nums text-primary">{score}</span>
      <span className="font-medium">{fixture.teamB?.shortCode || '—'}</span>
      <TeamCrest team={fixture.teamB} size="sm" />
    </>
  );
  const cls = 'flex shrink-0 items-center gap-2 border-r border-border/50 px-5 text-sm';
  // The duplicated strip only exists to make the marquee seamless; hide it from
  // assistive tech and keyboard tab order so each match is announced once.
  if (tournamentId) {
    return (
      <Link
        to={`/t/${tournamentId}/match/${fixture._id}`}
        aria-label={ariaLabel}
        aria-hidden={duplicate || undefined}
        tabIndex={duplicate ? -1 : undefined}
        className={cn(
          cls,
          'rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        )}
      >
        {body}
      </Link>
    );
  }
  return (
    <div className={cls} aria-hidden={duplicate || undefined}>
      {body}
    </div>
  );
}

/**
 * Broadcast-style scrolling ticker. Shows live matches first, then recent
 * results and upcoming fixtures. Duplicated content yields a seamless marquee.
 */
export default function LiveTicker({ fixtures = [], sport, liveStates = {}, tournamentId }) {
  const reduce = useReducedMotion();
  const relevant = [...fixtures]
    .filter((f) => f.teamA && f.teamB)
    .sort((a, b) => {
      const rank = (f) => (f.status === 'live' ? 0 : f.status === 'completed' ? 1 : 2);
      return rank(a) - rank(b);
    })
    .slice(0, 12);

  if (!relevant.length) return null;
  // The marquee needs a duplicated strip for a seamless loop; with reduced
  // motion the animation is disabled, so a single, manually scrollable list
  // avoids a static, clipped duplicate.
  const loop = reduce ? relevant : [...relevant, ...relevant];

  // Only flag the ticker as "LIVE" when a match is actually in progress;
  // otherwise it's just showing scores/schedule.
  const hasLive = relevant.some((f) => f.status === 'live');
  const label = hasLive ? 'Live' : 'Scores';

  return (
    <div
      role="region"
      aria-label={hasLive ? 'Live scores ticker' : 'Scores ticker'}
      className="surface-elevated relative flex items-center overflow-hidden rounded-2xl border border-border/70 py-2.5"
    >
      <div
        className={cn(
          'z-10 flex shrink-0 items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white',
          hasLive ? 'bg-destructive' : 'bg-secondary text-secondary-foreground'
        )}
      >
        {hasLive ? <Radio aria-hidden="true" className="h-3.5 w-3.5" /> : <Activity aria-hidden="true" className="h-3.5 w-3.5" />}
        {label}
      </div>
      {/* Edges fade out so cells glide in/out of view instead of clipping. */}
      <div
        className={cn(
          'mask-fade-x flex whitespace-nowrap',
          reduce ? 'min-w-0 flex-1 overflow-x-auto scrollbar-thin' : 'animate-marquee'
        )}
      >
        {loop.map((f, i) => (
          <TickerCell
            key={`${f._id}-${i}`}
            fixture={f}
            sport={sport}
            live={liveStates[f._id]}
            tournamentId={tournamentId}
            duplicate={!reduce && i >= relevant.length}
          />
        ))}
      </div>
    </div>
  );
}
