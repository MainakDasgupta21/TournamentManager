import { useOutletContext, Link } from 'react-router-dom';
import { CheckCircle2, Clock, ArrowRight, Crown } from 'lucide-react';
import { useFixtures, useTournamentPlayers, useSetPlayerOfTournament } from '@/hooks/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import FixtureItem from '@/components/FixtureItem';
import { EmptyState, ErrorState, Spinner, Skeleton, SkeletonGrid } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';

const POTM_NONE = '__none__';

/** Admin-assignable Player of the Tournament (Module 7B). */
function PlayerOfTournamentCard({ tournament, tournamentId }) {
  const { data: players = [] } = useTournamentPlayers(tournamentId);
  const setPotm = useSetPlayerOfTournament(tournamentId);
  const currentId =
    tournament.playerOfTournament && typeof tournament.playerOfTournament === 'object'
      ? tournament.playerOfTournament._id
      : tournament.playerOfTournament || '';

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Crown className="h-4 w-4 text-amber-400" />
        <CardTitle>Player of the Tournament</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {players.length ? (
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={currentId || POTM_NONE}
              onValueChange={(v) => setPotm.mutate(v === POTM_NONE ? null : v)}
            >
              <SelectTrigger className="w-full sm:max-w-sm">
                <SelectValue placeholder="Select a player" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={POTM_NONE}>— Not assigned —</SelectItem>
                {players.map((p) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name}{p.teamId?.shortCode ? ` · ${p.teamId.shortCode}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {setPotm.isPending && <Spinner className="h-4 w-4" />}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add players to team rosters to assign a Player of the Tournament.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Progress({ value, total }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted-foreground">Matches played</span>
        <span className="font-medium">{value} / {total}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { tournament, tournamentId } = useOutletContext();
  const { data: fixtures = [], isLoading, isError, refetch } = useFixtures(tournamentId);

  const completed = fixtures.filter((f) => f.status === 'completed').length;
  const pending = fixtures.filter((f) => f.status !== 'completed' && f.teamA && f.teamB).slice(0, 6);

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load this tournament's fixtures"
        description="There was a problem reaching the server."
        onRetry={refetch}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-[88px] w-full rounded-xl" />
          <Skeleton className="h-[88px] w-full rounded-xl" />
          <Skeleton className="h-[88px] w-full rounded-xl" />
        </div>
        <Skeleton className="h-7 w-44 rounded-md" />
        <SkeletonGrid count={6} media={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Track progress, review upcoming fixtures, and assign Player of the Tournament."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-6">
          <CheckCircle2 className="h-8 w-8 text-[hsl(var(--success))]" />
          <div><p className="font-display text-3xl">{completed}</p><p className="text-xs text-muted-foreground">Completed</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-6">
          <Clock className="h-8 w-8 text-[hsl(var(--warning))]" />
          <div><p className="font-display text-3xl">{fixtures.length - completed}</p><p className="text-xs text-muted-foreground">Remaining</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-6"><Progress value={completed} total={fixtures.length} /></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>Pending fixtures</CardTitle>
          <Link to={`/admin/t/${tournamentId}/fixtures`} className="flex items-center text-sm text-primary hover:underline">
            Manage all <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {pending.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((f) => <FixtureItem key={f._id} fixture={f} sport={tournament.sportType} />)}
            </div>
          ) : (
            <EmptyState icon={CheckCircle2} title="All caught up" description="No pending fixtures with both teams assigned." />
          )}
        </CardContent>
      </Card>

      <PlayerOfTournamentCard tournament={tournament} tournamentId={tournamentId} />
    </div>
  );
}
