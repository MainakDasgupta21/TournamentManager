import { useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Shirt, ArrowLeft, Swords } from 'lucide-react';
import { useTeam, useStandings } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import FixtureItem from '@/components/FixtureItem';
import MatchDetail from '@/components/MatchDetail';
import FormationBoard from '@/components/FormationBoard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountUp } from '@/components/ui/count-up';
import { TeamCrest, Skeleton, EmptyState, ErrorState } from '@/components/ui/misc';
import { PlayerCategoryBadge } from '@/components/ui/player-category-badge';
import { teamForm, headToHead } from '@/lib/formGuide';
import { effectiveFormation, playerMapById } from '@/lib/formation';
import { accentStyle, cn } from '@/lib/utils';

function TeamSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-5 rounded-xl border border-border p-6">
        <Skeleton className="h-14 w-14 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, highlight }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-center">
      <p className={cn('font-display text-2xl leading-none tracking-wide', highlight && 'text-primary')}>{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function FormPill({ result, opponent }) {
  const map = {
    W: 'bg-[hsl(var(--success)/0.2)] text-[hsl(var(--success))]',
    L: 'bg-destructive/15 text-destructive',
    D: 'bg-secondary text-muted-foreground',
  };
  const title = { W: 'Win', D: 'Draw', L: 'Loss' }[result];
  return (
    <span
      title={`${title}${opponent?.shortCode ? ` vs ${opponent.shortCode}` : opponent?.name ? ` vs ${opponent.name}` : ''}`}
      className={cn('flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold', map[result])}
    >
      {result}
    </span>
  );
}

export default function TeamPage() {
  const { tournament, tournamentId, liveStates } = useOutletContext();
  const { teamId } = useParams();
  const { data, isLoading, isError, refetch } = useTeam(tournamentId, teamId);
  const { data: standings = [] } = useStandings(tournamentId);
  const [selected, setSelected] = useState(null);
  useDocumentTitle(data?.team?.name);

  const fixtures = data?.fixtures ?? [];
  const isCricket = tournament.sportType === 'cricket';
  const statLine = (p) => {
    if (isCricket) {
      const c = p.stats?.cricket ?? {};
      return `${c.matches ?? 0} M · ${c.runs ?? 0} runs · ${c.wickets ?? 0} wkts`;
    }
    const f = p.stats?.football ?? {};
    return `${f.appearances ?? 0} apps · ${f.goals ?? 0} G · ${f.assists ?? 0} A`;
  };

  const standing = useMemo(() => {
    for (const g of standings) {
      const idx = g.rows.findIndex((r) => String(r.teamId?._id) === String(teamId));
      if (idx >= 0) return { row: g.rows[idx], position: idx + 1, group: g.group?.name };
    }
    return null;
  }, [standings, teamId]);

  const form = useMemo(() => teamForm(fixtures, teamId), [fixtures, teamId]);

  const h2h = useMemo(() => {
    const opponents = new Map();
    for (const f of fixtures) {
      if (f.status !== 'completed') continue;
      const opp = String(f.teamA?._id) === String(teamId) ? f.teamB : f.teamA;
      if (opp?._id) opponents.set(String(opp._id), opp);
    }
    return [...opponents.values()]
      .map((opp) => ({ opp, ...headToHead(fixtures, teamId, opp._id) }))
      .filter((r) => r.aWins + r.bWins + r.draws > 0)
      .sort((a, b) => b.aWins - a.aWins);
  }, [fixtures, teamId]);

  if (isLoading) return <TeamSkeleton />;
  if (isError) {
    return (
      <ErrorState
        title="Couldn't load this team"
        description="There was a problem reaching the server. Please try again."
        onRetry={refetch}
      />
    );
  }
  if (!data?.team) {
    return (
      <EmptyState
        icon={Shirt}
        title="Team not found"
        description="This team may have been removed."
        action={<Link to={`/t/${tournamentId}/standings`} className="text-sm text-primary hover:underline">Back to standings</Link>}
      />
    );
  }

  const { team, players = [] } = data;
  const playersById = playerMapById(players);
  const defaultFormation =
    tournament.sportType === 'football'
      ? effectiveFormation({ override: null, fallback: team.defaultFormation })
      : null;
  const row = standing?.row;

  return (
    <div style={accentStyle(team.primaryColor)} className="space-y-8">
      <Link
        to={`/t/${tournamentId}/standings`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Standings
      </Link>

      <div
        className="rounded-xl border border-border p-5 sm:p-6"
        style={{ background: `linear-gradient(120deg, rgb(var(--team-accent-rgb) / 0.18), transparent)` }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <TeamCrest team={team} size="lg" />
            <div className="min-w-0">
              <h1 className="break-words font-display text-3xl tracking-wide sm:text-5xl">{team.name}</h1>
              <p className="text-muted-foreground">{team.shortCode}</p>
            </div>
          </div>
          {standing && (
            <div className="w-full text-left sm:w-auto sm:text-right">
              <p className="font-display text-4xl tracking-wide text-primary">#{standing.position}</p>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{standing.group}</p>
            </div>
          )}
        </div>

        {row && (
          <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <MiniStat label="Played" value={<CountUp value={row.played ?? 0} />} />
            <MiniStat label="Won" value={<CountUp value={row.won ?? 0} />} />
            <MiniStat label={isCricket ? 'Tie/NR' : 'Drawn'} value={<CountUp value={(row.drawn ?? 0) + (row.noResult ?? 0)} />} />
            <MiniStat label="Lost" value={<CountUp value={row.lost ?? 0} />} />
            <MiniStat
              label={isCricket ? 'NRR' : 'GD'}
              value={isCricket
                ? (row.netRunRate > 0 ? '+' : '') + Number(row.netRunRate ?? 0).toFixed(2)
                : (row.goalDifference > 0 ? '+' : '') + (row.goalDifference ?? 0)}
            />
            <MiniStat label="Points" value={<CountUp value={row.points ?? 0} />} highlight />
          </div>
        )}

        {form.length > 0 && (
          <div className="mt-5 flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Form</span>
            <div className="flex flex-wrap gap-1.5">
              {form.map((f, i) => <FormPill key={f.fixtureId ?? i} result={f.result} opponent={f.opponent} />)}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {defaultFormation && (
            <FormationBoard
              formation={defaultFormation}
              playersById={playersById}
              title="Default formation"
              subtitle="Opponent-facing tactical shape"
            />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shirt className="h-4 w-4" /> Squad ({players.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {players.length ? (
                <ul className="divide-y divide-border/50">
                  {players.map((p) => (
                    <li key={p._id} className="flex items-center gap-3 py-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-bold tabular-nums">
                        {p.jerseyNumber ?? '–'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Link
                            to={`/t/${tournamentId}/players/${p._id}`}
                            className="truncate font-medium hover:text-primary hover:underline"
                          >
                            {p.name}
                          </Link>
                          <PlayerCategoryBadge category={p.category} size="xs" />
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.role && <span className="uppercase tracking-wider">{p.role}</span>}
                          {p.role && ' · '}
                          {statLine(p)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No roster registered.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {h2h.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Swords className="h-4 w-4" /> Head-to-head
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border/50">
                  {h2h.map(({ opp, aWins, draws, bWins }) => (
                    <li key={opp._id} className="flex items-center gap-3 py-2.5 text-sm">
                      <TeamCrest team={opp} size="sm" />
                      <Link
                        to={`/t/${tournamentId}/teams/${opp._id}`}
                        className="flex-1 truncate font-medium hover:text-primary hover:underline"
                      >
                        {opp.name}
                      </Link>
                      <span className="flex items-center gap-1 tabular-nums">
                        <span className="font-semibold text-[hsl(var(--success))]">{aWins}</span>
                        <span className="text-muted-foreground/50">–</span>
                        <span className="text-muted-foreground">{draws}</span>
                        <span className="text-muted-foreground/50">–</span>
                        <span className="font-semibold text-destructive">{bWins}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                  Wins – Draws – Losses (this team's perspective)
                </p>
              </CardContent>
            </Card>
          )}

          <div>
            <h3 className="mb-3 font-semibold">Match history</h3>
            <div className="space-y-3">
              {fixtures.length ? (
                fixtures.map((f) => (
                  <FixtureItem
                    key={f._id}
                    fixture={f}
                    sport={tournament.sportType}
                    live={liveStates?.[f._id]}
                    onClick={() => setSelected(f)}
                  />
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No fixtures yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <MatchDetail
        fixture={selected}
        sport={tournament.sportType}
        live={selected ? liveStates?.[selected._id] : undefined}
        tournamentId={tournamentId}
        onOpenChange={() => setSelected(null)}
      />
    </div>
  );
}
