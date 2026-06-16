import { useEffect, useMemo } from 'react';
import { useOutletContext, useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Radio, ArrowLeft, MapPin, CalendarDays, MessageSquare, BarChart3, Trophy } from 'lucide-react';
import { useFixture, useTeam } from '@/hooks/queries';
import { getSocket, EVENTS } from '@/lib/socket';
import { qk } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FixtureStatusBadge } from '@/components/ui/status-badge';
import { TeamCrest, EmptyState, Skeleton } from '@/components/ui/misc';
import { formatDateTime, oversDisplay } from '@/lib/format';
import { inningsSummary, flattenOvers } from '@/lib/cricket';
import { hasBallDetail } from '@/lib/cricketSeries';
import { buildCommentary } from '@/lib/commentary';
import { winProbability } from '@/lib/winPredictor';
import WormChart from '@/components/charts/WormChart';
import ManhattanChart from '@/components/charts/ManhattanChart';
import MatchTimeline from '@/components/charts/MatchTimeline';
import WinProbabilityBar from '@/components/charts/WinProbabilityBar';
import MatchShareBar from '@/components/MatchShareBar';
import { cn } from '@/lib/utils';

const teamEq = (a, b) => String(a) === String(b);

const KIND_STYLE = {
  six: 'border-accent/40 bg-accent/10 text-accent',
  four: 'border-primary/40 bg-primary/10 text-primary',
  wicket: 'border-destructive/40 bg-destructive/10 text-destructive',
  goal: 'border-accent/40 bg-accent/10 text-accent',
  owngoal: 'border-destructive/40 bg-destructive/10 text-destructive',
  red: 'border-destructive/40 bg-destructive/10 text-destructive',
  yellow: 'border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]',
  sub: 'border-border bg-secondary text-foreground',
  extra: 'border-border bg-secondary/50 text-muted-foreground',
  run: 'border-border/60 bg-card text-foreground',
};

function cricketInnDisplay(inn) {
  if (hasBallDetail(inn)) {
    const s = inningsSummary(flattenOvers(inn.oversDetail));
    return { runs: s.runs, wickets: s.wickets, overs: s.overs };
  }
  return { runs: inn.runs ?? 0, wickets: inn.wickets ?? 0, overs: oversDisplay(inn.overs) };
}

function footballTally(goals = [], teamAId, teamBId) {
  let a = 0;
  let b = 0;
  for (const g of goals) {
    const scoring = g.type === 'ownGoal' ? (teamEq(g.team, teamAId) ? teamBId : teamAId) : g.team;
    if (teamEq(scoring, teamAId)) a += 1;
    else if (teamEq(scoring, teamBId)) b += 1;
  }
  return { a, b };
}

function TeamHeader({ team, placeholder, score, sub, isWinner }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-2 text-center">
      {team ? <TeamCrest team={team} size="lg" /> : <div className="h-12 w-12 rounded-md bg-secondary" />}
      <p className={cn('text-sm font-medium', isWinner && 'text-[hsl(var(--success))]')}>
        {team?.name || placeholder || 'TBD'}
      </p>
      {score != null && <p className="font-display text-4xl tabular-nums leading-none">{score}</p>}
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function MatchCenter() {
  const { tournament, tournamentId, liveStates } = useOutletContext();
  const { fixtureId } = useParams();
  const qc = useQueryClient();
  const sport = tournament.sportType;

  const { data: fixture, isLoading } = useFixture(fixtureId);

  const teamAId = fixture?.teamA?._id;
  const teamBId = fixture?.teamB?._id;
  const aTeam = useTeam(tournamentId, teamAId);
  const bTeam = useTeam(tournamentId, teamBId);

  // Refresh the single fixture on result/status broadcasts (live granular state
  // arrives via the layout's liveStates map without a refetch).
  useEffect(() => {
    if (!fixtureId) return undefined;
    const socket = getSocket();
    socket.emit('joinFixture', fixtureId);
    const refresh = () => qc.invalidateQueries({ queryKey: qk.fixture(fixtureId) });
    socket.on(EVENTS.RESULT, refresh);
    socket.on(EVENTS.STATUS, refresh);
    return () => {
      socket.emit('leaveFixture', fixtureId);
      socket.off(EVENTS.RESULT, refresh);
      socket.off(EVENTS.STATUS, refresh);
    };
  }, [fixtureId, qc]);

  const live = liveStates?.[fixtureId] ?? fixture?.liveState ?? null;

  const playersById = useMemo(() => {
    const m = {};
    for (const p of aTeam.data?.players ?? []) m[String(p._id)] = p;
    for (const p of bTeam.data?.players ?? []) m[String(p._id)] = p;
    return m;
  }, [aTeam.data, bTeam.data]);

  const teamsById = useMemo(() => {
    const m = {};
    if (fixture?.teamA) m[String(teamAId)] = fixture.teamA;
    if (fixture?.teamB) m[String(teamBId)] = fixture.teamB;
    return m;
  }, [fixture, teamAId, teamBId]);

  const commentary = useMemo(() => {
    if (!fixture) return [];
    return buildCommentary(sport, { result: fixture.result, live }, { playersById, teamsById });
  }, [fixture, live, sport, playersById, teamsById]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!fixture) {
    return <EmptyState icon={Trophy} title="Match not found" description="This fixture may have been removed." />;
  }

  const completed = fixture.status === 'completed';
  const isLive = fixture.status === 'live';
  const winnerId = fixture.winner?._id || fixture.winner || fixture.result?.result?.winner;

  // ---- scoreline + win probability (sport-aware) ----
  let scoreA = null;
  let scoreB = null;
  let subA = null;
  let subB = null;
  let prob = null;

  const cricketInnings =
    (live?.innings?.length ? live.innings : fixture.result?.innings) ?? [];

  if (sport === 'cricket') {
    for (const inn of cricketInnings) {
      const d = cricketInnDisplay(inn);
      if (teamEq(inn.battingTeam, teamAId)) { scoreA = `${d.runs}/${d.wickets}`; subA = `${d.overs} ov`; }
      else if (teamEq(inn.battingTeam, teamBId)) { scoreB = `${d.runs}/${d.wickets}`; subB = `${d.overs} ov`; }
    }
    if (isLive || completed) {
      // Use derived totals for the predictor.
      const derived = cricketInnings.map((inn) => ({ ...cricketInnDisplay(inn), battingTeam: inn.battingTeam, allottedOvers: inn.allottedOvers }));
      prob = winProbability('cricket', { innings: derived, teamA: teamAId, teamB: teamBId });
    }
  } else {
    const goals = live?.goals ?? fixture.result?.goals ?? [];
    const { a, b } = footballTally(goals, teamAId, teamBId);
    scoreA = a;
    scoreB = b;
    if (isLive) subA = `${live?.minute ?? 0}'`;
    if (isLive || completed) {
      prob = winProbability('football', { goalsA: a, goalsB: b, minute: live?.minute ?? 0, completed });
    }
  }

  const reversedFeed = [...commentary].reverse();

  // Football event sources (also used to decide whether a timeline is drawable).
  const fbGoals = live?.goals ?? fixture.result?.goals ?? [];
  const fbCards = live?.cards ?? fixture.result?.cards ?? [];
  const fbSubs = live?.substitutions ?? fixture.result?.substitutions ?? [];
  const fbEventCount = fbGoals.length + fbCards.length + fbSubs.length;
  const hasTimeline = [...fbGoals, ...fbCards, ...fbSubs].some((e) => e?.minute != null);

  const winnerName = teamEq(winnerId, teamAId)
    ? fixture.teamA?.name
    : teamEq(winnerId, teamBId)
      ? fixture.teamB?.name
      : null;
  let outcome = '';
  if (completed) {
    const margin = fixture.result?.result?.margin;
    if (margin === 'tie') outcome = 'Match tied';
    else if (margin === 'noResult') outcome = 'No result';
    else if (margin === 'superOver' && winnerName) outcome = `${winnerName} won (Super Over)`;
    else if (winnerName) outcome = `${winnerName} won`;
    else outcome = sport === 'football' ? 'Match drawn' : 'Result';
  } else if (isLive) {
    outcome = 'Live now';
  } else {
    outcome = formatDateTime(fixture.scheduledAt);
  }

  const roundLabel = fixture.roundName || (fixture.groupRound ? `Round ${fixture.groupRound}` : 'Group stage');
  const shareCard = {
    tournamentName: tournament.name,
    roundName: roundLabel,
    teamAName: fixture.teamA?.name || fixture.placeholderA || 'Team A',
    teamBName: fixture.teamB?.name || fixture.placeholderB || 'Team B',
    scoreA: scoreA != null ? String(scoreA) : '',
    scoreB: scoreB != null ? String(scoreB) : '',
    outcome,
    accent: fixture.teamA?.primaryColor || tournament.primaryColor || '#6366f1',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to={`/t/${tournamentId}/fixtures`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to fixtures
        </Link>
        <MatchShareBar card={shareCard} canSaveImage={completed} />
      </div>

      {/* Scorecard header */}
      <Card id="print-root" className={cn(isLive && 'border-destructive/40')}>
        <CardContent className="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">
              {fixture.roundName || (fixture.groupRound ? `Round ${fixture.groupRound}` : 'Group stage')}
              {fixture.venue ? ` · ${fixture.venue}` : ''}
            </span>
            <FixtureStatusBadge status={fixture.status} sport={sport} />
          </div>

          <div className="flex items-start justify-between gap-4">
            <TeamHeader team={fixture.teamA} placeholder={fixture.placeholderA} score={scoreA} sub={subA} isWinner={completed && teamEq(winnerId, teamAId)} />
            <div className="flex flex-col items-center pt-6">
              {isLive ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-destructive">
                  <Radio className="h-3.5 w-3.5 live-dot" /> Live
                </span>
              ) : (
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">vs</span>
              )}
            </div>
            <TeamHeader team={fixture.teamB} placeholder={fixture.placeholderB} score={scoreB} sub={subB} isWinner={completed && teamEq(winnerId, teamBId)} />
          </div>

          {!completed && !isLive && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" /> {formatDateTime(fixture.scheduledAt)}
            </p>
          )}

          {prob && (teamAId && teamBId) && (
            <div className="mt-5 border-t border-border/60 pt-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Win predictor <span className="font-normal normal-case text-muted-foreground/70">· model estimate</span>
              </p>
              <WinProbabilityBar
                a={prob.a}
                b={prob.b}
                draw={prob.draw ?? 0}
                labelA={fixture.teamA?.shortCode || 'A'}
                labelB={fixture.teamB?.shortCode || 'B'}
                note={prob.note}
              />
            </div>
          )}

          {fixture.venue && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {fixture.venue}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Analytics */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <BarChart3 className="h-4 w-4 text-primary" />
            <CardTitle>Analytics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {sport === 'cricket' ? (
              cricketInnings.some(hasBallDetail) ? (
                <>
                  <div>
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Run worm (cumulative)</p>
                    <WormChart innings={cricketInnings} teamsById={teamsById} />
                  </div>
                  {cricketInnings.filter(hasBallDetail).map((inn, i) => (
                    <ManhattanChart
                      key={i}
                      innings={inn}
                      color={i === 0 ? 'hsl(var(--primary))' : 'hsl(var(--accent))'}
                      label={`${teamsById[String(inn.battingTeam)]?.shortCode || 'Innings'} — runs per over`}
                    />
                  ))}
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Ball-by-ball charts appear once granular scoring data is recorded.
                </p>
              )
            ) : hasTimeline ? (
              <MatchTimeline
                goals={fbGoals}
                cards={fbCards}
                substitutions={fbSubs}
                teamA={teamAId}
                teamB={teamBId}
                teamsById={teamsById}
              />
            ) : fbEventCount > 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Event minutes weren&apos;t recorded — see the commentary for the full event list.
              </p>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">No events recorded yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Commentary */}
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <MessageSquare className="h-4 w-4 text-primary" />
            <CardTitle>Commentary</CardTitle>
          </CardHeader>
          <CardContent>
            {reversedFeed.length ? (
              <ul className="max-h-[28rem] space-y-1.5 overflow-y-auto scrollbar-thin pr-1">
                {reversedFeed.map((line) => (
                  <li key={line.id} className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-sm', KIND_STYLE[line.kind] ?? KIND_STYLE.run)}>
                    <span className="min-w-10 shrink-0 font-mono text-xs font-semibold tabular-nums opacity-80">{line.marker}</span>
                    <span className="flex-1">{line.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Commentary appears as the match is scored ball-by-ball / event-by-event.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
