import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, MapPin, CalendarDays, Trophy, ArrowRight, BarChart3 } from 'lucide-react';
import { useTeam } from '@/hooks/queries';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { FixtureStatusBadge } from '@/components/ui/status-badge';
import { TeamCrest } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import FormationBoard from '@/components/FormationBoard';
import { formatDateTime, oversDisplay, footballScore, cricketTeamScore } from '@/lib/format';
import { effectiveFormation, playerMapById } from '@/lib/formation';
import { cn } from '@/lib/utils';

const teamMatch = (a, b) => String(a) === String(b);

/** Human result line, sport-aware. */
function outcomeLine(fixture, sport) {
  const { teamA, teamB, winner, result } = fixture;
  const winnerId = winner?._id || winner || result?.result?.winner;
  const winName = teamMatch(winnerId, teamA?._id) ? teamA?.name : teamMatch(winnerId, teamB?._id) ? teamB?.name : null;

  if (sport === 'cricket') {
    const margin = result?.result?.margin;
    if (margin === 'tie') return 'Match tied';
    if (margin === 'noResult') return 'No result';
    if (margin === 'superOver') return winName ? `${winName} won (Super Over)` : 'Tied — decided by Super Over';
    if (winName && margin?.type) {
      const unit = margin.value === 1 ? margin.type.replace(/s$/, '') : margin.type;
      return `${winName} won by ${margin.value} ${unit}`;
    }
    if (winName) return `${winName} won`;
    return '';
  }
  const pens = result?.penalties;
  if (winName && pens && pens.teamA != null) return `${winName} won ${pens.teamA}–${pens.teamB} on penalties`;
  if (winName) return `${winName} won`;
  if (result?.result && winnerId == null) return 'Match drawn';
  return '';
}

function TeamRow({ team, placeholder, score, sub, isWinner, tournamentId, onNavigate }) {
  const inner = (
    <div className={cn('flex items-center gap-3 rounded-xl border border-transparent p-3 transition-colors', isWinner ? 'border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.08)]' : 'hover:border-border/70 hover:bg-secondary/40')}>
      {team ? <TeamCrest team={team} size="md" /> : <div className="h-9 w-9 rounded-md bg-secondary" />}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate', isWinner ? 'font-semibold' : 'font-medium')}>
          {team?.name || placeholder || 'TBD'}
        </p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {score != null && (
        <span className={cn('font-display text-2xl tracking-wide tabular-nums', isWinner && 'text-[hsl(var(--success))]')}>
          {score}
        </span>
      )}
      {isWinner && <Trophy className="h-4 w-4 shrink-0 text-[hsl(var(--success))]" />}
    </div>
  );
  if (team && tournamentId) {
    return (
      <Link to={`/t/${tournamentId}/teams/${team._id}`} onClick={onNavigate} className="block">
        {inner}
      </Link>
    );
  }
  return inner;
}

function GoalTimeline({ fixture }) {
  const goals = (fixture.result?.goals ?? []).filter((g) => g.scorer || g.minute != null);
  if (!goals.length) return null;
  const sorted = [...goals].sort((x, y) => (x.minute ?? 0) - (y.minute ?? 0));
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goals</h3>
      <ul className="space-y-1.5">
        {sorted.map((g, i) => {
          const own = g.type === 'ownGoal';
          const side = teamMatch(g.team, fixture.teamA?._id);
          return (
            <li key={i} className={cn('flex items-center gap-2 text-sm', side ? 'justify-start' : 'flex-row-reverse text-right')}>
              <span className="tabular-nums text-muted-foreground">{g.minute != null ? `${g.minute}'` : '•'}</span>
              <span className="font-medium">{g.scorer || 'Goal'}{own ? ' (OG)' : ''}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function MatchBody({ fixture, sport, live, tournamentId, onNavigate, formationBySide, formationPlayers }) {
  const isLive = fixture.status === 'live';
  const completed = fixture.status === 'completed';
  const winnerId = fixture.winner?._id || fixture.winner || fixture.result?.result?.winner;

  let scoreA = null;
  let scoreB = null;
  let subA = null;
  let subB = null;

  if (sport === 'cricket') {
    const a = cricketTeamScore(fixture, fixture.teamA?._id);
    const b = cricketTeamScore(fixture, fixture.teamB?._id);
    if (a) { scoreA = `${a.runs}/${a.wickets}`; subA = `${oversDisplay(a.overs)} ov`; }
    if (b) { scoreB = `${b.runs}/${b.wickets}`; subB = `${oversDisplay(b.overs)} ov`; }
    if (isLive && live) {
      const battingA = teamMatch(live.battingTeam, fixture.teamA?._id);
      const snap = `${live.runs ?? 0}/${live.wickets ?? 0}`;
      if (battingA) { scoreA = snap; subA = `${oversDisplay(live.overs)} ov`; }
      else { scoreB = snap; subB = `${oversDisplay(live.overs)} ov`; }
    }
  } else {
    const { a, b } = footballScore(fixture);
    if (completed) { scoreA = a; scoreB = b; }
    if (isLive && live) { scoreA = live.teamAGoals ?? 0; scoreB = live.teamBGoals ?? 0; subA = `${live.minute ?? 0}'`; }
  }

  const line = completed ? outcomeLine(fixture, sport) : '';

  return (
    <div className="space-y-5 p-5">
      {isLive && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
          <Radio className="h-4 w-4" /> Live now
          {sport === 'football' && live?.minute != null && <span className="ml-auto tabular-nums">{live.minute}'</span>}
        </div>
      )}

      <div className="space-y-1">
        <TeamRow
          team={fixture.teamA}
          placeholder={fixture.placeholderA}
          score={scoreA}
          sub={subA}
          isWinner={completed && teamMatch(winnerId, fixture.teamA?._id)}
          tournamentId={tournamentId}
          onNavigate={onNavigate}
        />
        <TeamRow
          team={fixture.teamB}
          placeholder={fixture.placeholderB}
          score={scoreB}
          sub={subB}
          isWinner={completed && teamMatch(winnerId, fixture.teamB?._id)}
          tournamentId={tournamentId}
          onNavigate={onNavigate}
        />
      </div>

      {line && (
        <p className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-2 text-center text-sm font-medium">
          {line}
        </p>
      )}

      {tournamentId && fixture._id && (
        <SheetClose asChild>
          <Button asChild className="w-full">
            <Link to={`/t/${tournamentId}/match/${fixture._id}`}>
              {isLive ? <Radio className="live-dot" /> : <BarChart3 />}
              Open Match Center
              <ArrowRight />
            </Link>
          </Button>
        </SheetClose>
      )}

      {!completed && !isLive && (
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4" /> {formatDateTime(fixture.scheduledAt)}
        </p>
      )}

      {sport === 'football' && completed && <GoalTimeline fixture={fixture} />}

      {sport === 'football' && (formationBySide?.teamA || formationBySide?.teamB) && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Formation</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <FormationBoard
              compact
              formation={formationBySide?.teamA}
              playersById={formationPlayers}
              title={fixture.teamA?.shortCode || fixture.teamA?.name || 'Team A'}
              subtitle={
                (live?.formation?.teamA ?? fixture?.result?.formation?.teamA)
                  ? 'Match override'
                  : 'Team default'
              }
              emptyMessage="Not set"
            />
            <FormationBoard
              compact
              formation={formationBySide?.teamB}
              playersById={formationPlayers}
              title={fixture.teamB?.shortCode || fixture.teamB?.name || 'Team B'}
              subtitle={
                (live?.formation?.teamB ?? fixture?.result?.formation?.teamB)
                  ? 'Match override'
                  : 'Team default'
              }
              emptyMessage="Not set"
            />
          </div>
        </div>
      )}

      {fixture.venue && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {fixture.venue}
        </p>
      )}

      {(fixture.teamA || fixture.teamB) && tournamentId && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          {fixture.teamA && (
            <SheetClose asChild>
              <Button asChild variant="outline" size="sm">
                <Link to={`/t/${tournamentId}/teams/${fixture.teamA._id}`}>{fixture.teamA.shortCode || fixture.teamA.name} <ArrowRight /></Link>
              </Button>
            </SheetClose>
          )}
          {fixture.teamB && (
            <SheetClose asChild>
              <Button asChild variant="outline" size="sm">
                <Link to={`/t/${tournamentId}/teams/${fixture.teamB._id}`}>{fixture.teamB.shortCode || fixture.teamB.name} <ArrowRight /></Link>
              </Button>
            </SheetClose>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Slide-over match detail / scorecard. Controlled by passing a `fixture`
 * (null = closed). Retains the last fixture during the close animation so the
 * panel doesn't blank out mid-transition.
 */
export default function MatchDetail({ fixture, sport, live, tournamentId, onOpenChange }) {
  const [retained, setRetained] = useState(fixture);
  useEffect(() => {
    if (fixture) setRetained(fixture);
  }, [fixture]);

  const f = fixture || retained;
  const teamAId = f?.teamA?._id;
  const teamBId = f?.teamB?._id;
  const a = useTeam(tournamentId, sport === 'football' ? teamAId : null);
  const b = useTeam(tournamentId, sport === 'football' ? teamBId : null);
  const formationPlayers = useMemo(
    () => playerMapById([...(a.data?.players ?? []), ...(b.data?.players ?? [])]),
    [a.data?.players, b.data?.players]
  );
  const formationBySide =
    sport === 'football' && f
      ? {
          teamA: effectiveFormation({
            override: live?.formation?.teamA ?? f.result?.formation?.teamA ?? null,
            fallback: a.data?.team?.defaultFormation ?? null,
          }),
          teamB: effectiveFormation({
            override: live?.formation?.teamB ?? f.result?.formation?.teamB ?? null,
            fallback: b.data?.team?.defaultFormation ?? null,
          }),
        }
      : { teamA: null, teamB: null };

  return (
    <Sheet open={!!fixture} onOpenChange={(o) => !o && onOpenChange(false)}>
      <SheetContent side="right" className="w-full max-w-md p-0">
        <SheetHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <SheetTitle className="truncate text-sm font-medium text-muted-foreground">
              {f?.roundName || (f?.groupRound ? `Round ${f.groupRound}` : 'Group stage')}
            </SheetTitle>
            {f && <FixtureStatusBadge status={f.status} sport={sport} />}
          </div>
        </SheetHeader>
        {f && (
          <MatchBody
            fixture={f}
            sport={sport}
            live={live}
            tournamentId={tournamentId}
            onNavigate={() => onOpenChange(false)}
            formationBySide={formationBySide}
            formationPlayers={formationPlayers}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
