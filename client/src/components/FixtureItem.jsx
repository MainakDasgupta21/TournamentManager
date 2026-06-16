import { TeamCrest } from '@/components/ui/misc';
import { FixtureStatusBadge } from '@/components/ui/status-badge';
import { formatDate, footballScore, cricketTeamScore, oversDisplay } from '@/lib/format';
import { cn } from '@/lib/utils';

function TeamLine({ team, placeholder, score, sub, isWinner }) {
  return (
    <div className={cn('flex items-center gap-2.5', isWinner ? 'font-semibold' : '')}>
      {team ? <TeamCrest team={team} size="sm" /> : <div className="h-6 w-6 rounded-md bg-secondary" />}
      <span className="min-w-0 flex-1 truncate">{team?.name || placeholder || 'TBD'}</span>
      {sub != null && <span className="shrink-0 tabular-nums text-[11px] text-muted-foreground">{sub}</span>}
      {score != null && (
        <span
          className={cn(
            'shrink-0 font-display text-base tabular-nums',
            isWinner ? 'font-bold text-[hsl(var(--success))]' : 'text-foreground'
          )}
        >
          {score}
        </span>
      )}
    </div>
  );
}

/**
 * One fixture, sport-aware. Each team line carries its own score (final or live
 * snapshot) with the winner highlighted; the footer line shows the kickoff time
 * for upcoming matches or the live minute for in-progress football.
 */
export default function FixtureItem({ fixture, sport, live, onClick, className }) {
  const isLive = fixture.status === 'live';
  const completed = fixture.status === 'completed';
  const winnerId = fixture.winner?._id || fixture.winner;
  const aWins = completed && String(winnerId) === String(fixture.teamA?._id);
  const bWins = completed && String(winnerId) === String(fixture.teamB?._id);

  let scoreA = null;
  let scoreB = null;
  let subA = null;
  let subB = null;

  if (sport === 'cricket') {
    if (completed) {
      const a = cricketTeamScore(fixture, fixture.teamA?._id);
      const b = cricketTeamScore(fixture, fixture.teamB?._id);
      if (a) { scoreA = `${a.runs}/${a.wickets}`; subA = `${oversDisplay(a.overs)} ov`; }
      if (b) { scoreB = `${b.runs}/${b.wickets}`; subB = `${oversDisplay(b.overs)} ov`; }
    }
    if (isLive && live) {
      const snap = `${live.runs ?? 0}/${live.wickets ?? 0}`;
      const ov = `${oversDisplay(live.overs)} ov`;
      if (String(live.battingTeam) === String(fixture.teamA?._id)) { scoreA = snap; subA = ov; }
      else { scoreB = snap; subB = ov; }
    }
  } else {
    if (completed) { const { a, b } = footballScore(fixture); scoreA = a; scoreB = b; }
    if (isLive && live) { scoreA = live.teamAGoals ?? 0; scoreB = live.teamBGoals ?? 0; }
  }

  // Footer context: live minute (football) or kickoff time (upcoming, since the
  // calendar day is already the section header). Completed cards need no footer.
  let context = null;
  if (isLive && sport === 'football' && live?.minute != null) context = `${live.minute}'`;
  else if (!isLive && !completed && fixture.scheduledAt) context = formatDate(fixture.scheduledAt, 'HH:mm');

  const aName = fixture.teamA?.name || fixture.placeholderA || 'TBD';
  const bName = fixture.teamB?.name || fixture.placeholderB || 'TBD';
  const action = completed ? 'view result' : isLive ? 'live, view details' : 'view fixture';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${aName} versus ${bName} — ${action}`}
      className={cn(
        'group w-full rounded-lg border border-border/60 bg-card/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">
          {fixture.roundName || (fixture.groupRound ? `Round ${fixture.groupRound}` : 'Group stage')}
          {fixture.venue ? ` · ${fixture.venue}` : ''}
        </span>
        <FixtureStatusBadge status={fixture.status} sport={sport} />
      </div>
      <div className="space-y-1.5 text-sm">
        <TeamLine team={fixture.teamA} placeholder={fixture.placeholderA} score={scoreA} sub={subA} isWinner={aWins} />
        <TeamLine team={fixture.teamB} placeholder={fixture.placeholderB} score={scoreB} sub={subB} isWinner={bWins} />
      </div>
      {context && (
        <div
          className={cn(
            'mt-2 flex items-center justify-center gap-1.5 text-xs font-medium',
            isLive ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {isLive && <span className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-destructive" />}
          {context}
        </div>
      )}
    </button>
  );
}
