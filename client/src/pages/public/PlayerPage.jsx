import { Link, useOutletContext, useParams } from 'react-router-dom';
import { UserRound, ArrowLeft } from 'lucide-react';
import { usePlayerStats } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CountUp } from '@/components/ui/count-up';
import { EmptyState, ErrorState, Skeleton, TeamCrest } from '@/components/ui/misc';
import { formatDate } from '@/lib/format';
import { accentStyle, cn } from '@/lib/utils';

const oversText = (balls = 0) => `${Math.floor(balls / 6)}.${balls % 6}`;
const ratio = (n, d, mult = 1) => (d > 0 ? Number(((n / d) * mult).toFixed(2)) : '–');

/** Headline stat tile. Integer counts animate up; ratios render as-is. */
function Stat({ label, value, sub, count }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <p className="font-display text-3xl leading-none tracking-wide">
        {count && typeof value === 'number' ? <CountUp value={value} /> : value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground/80">{sub}</p>}
    </div>
  );
}

function CricketProfile({ stats, matches }) {
  const c = stats?.cricket ?? {};
  const avg = c.dismissals > 0 ? ratio(c.runs, c.dismissals) : (c.runs > 0 ? c.runs : '–');
  const sr = ratio(c.runs, c.ballsFaced, 100);
  const econ = ratio(c.runsConceded, c.ballsBowled / 6);
  const best = c.bestWickets > 0 ? `${c.bestWickets}/${c.bestRuns}` : '–';

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Matches" value={c.matches ?? 0} count />
        <Stat label="Runs" value={c.runs ?? 0} sub={`${c.batInnings ?? 0} inns`} count />
        <Stat label="High Score" value={c.highScore ?? 0} count />
        <Stat label="Bat Avg / SR" value={avg} sub={`SR ${sr}`} />
        <Stat label="Wickets" value={c.wickets ?? 0} sub={`Best ${best}`} count />
        <Stat label="Economy" value={econ} sub={`${oversText(c.ballsBowled)} ov`} />
      </div>

      <MatchTable
        matches={matches}
        head={['Match', 'Stage', 'Batting', 'Bowling']}
        renderRow={(m) => (
          <>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
              {m.batting ? `${m.batting.runs}${m.batting.out ? '' : '*'} (${m.batting.balls})` : '–'}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
              {m.bowling ? `${m.bowling.wickets}/${m.bowling.runs} (${m.bowling.overs})` : '–'}
            </td>
          </>
        )}
      />
    </>
  );
}

function FootballProfile({ stats, matches }) {
  const f = stats?.football ?? {};
  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Appearances" value={f.appearances ?? 0} count />
        <Stat label="Goals" value={f.goals ?? 0} count />
        <Stat label="Assists" value={f.assists ?? 0} count />
        <Stat label="Yellow" value={f.yellowCards ?? 0} count />
        <Stat label="Red" value={f.redCards ?? 0} count />
        <Stat label="Clean Sheets" value={f.cleanSheets ?? 0} count />
      </div>

      <MatchTable
        matches={matches}
        head={['Match', 'Stage', 'Score', 'G / A', 'Cards']}
        renderRow={(m) => (
          <>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{m.scoreline}</td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
              {m.goals}{m.ownGoals ? ` (${m.ownGoals} OG)` : ''} / {m.assists}
            </td>
            <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
              {m.yellowCards || m.redCards ? (
                <span className="inline-flex gap-1">
                  {m.yellowCards > 0 && <span className="inline-block h-3.5 w-2.5 rounded-sm bg-yellow-400" title={`${m.yellowCards} yellow`} />}
                  {m.redCards > 0 && <span className="inline-block h-3.5 w-2.5 rounded-sm bg-red-500" title={`${m.redCards} red`} />}
                </span>
              ) : '–'}
            </td>
          </>
        )}
      />
    </>
  );
}

function MatchTable({ matches, head, renderRow }) {
  if (!matches?.length) {
    return (
      <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
        No match contributions recorded yet.
      </p>
    );
  }
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <h2 className="mb-4 font-display text-2xl tracking-wide">Match by match</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                {head.map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      'whitespace-nowrap px-3 py-2.5',
                      i === 0 && 'sticky left-0 z-10 border-r border-border/40 bg-card',
                      i >= 2 && 'text-right'
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.fixtureId} className="border-b border-border/40 last:border-0 hover:bg-secondary/30">
                  <td className="sticky left-0 z-10 border-r border-border/40 bg-card px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <TeamCrest team={m.opponent} size="sm" />
                      <span>
                        <span className="font-medium">vs {m.opponent?.shortCode ?? '—'}</span>
                        <span className="block text-xs text-muted-foreground">{formatDate(m.date)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={m.stage === 'knockout' ? 'default' : 'secondary'}>{m.roundName}</Badge>
                  </td>
                  {renderRow(m)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PlayerPage() {
  const { tournamentId } = useOutletContext();
  const { playerId } = useParams();
  const { data, isLoading, isError, refetch } = usePlayerStats(playerId);
  useDocumentTitle(data?.player?.name);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <ErrorState
        title="Couldn't load this player"
        description="There was a problem reaching the server. Please try again."
        onRetry={refetch}
      />
    );
  }
  if (!data?.player) return <EmptyState icon={UserRound} title="Player not found" />;

  const { player, sport, stats, matches } = data;

  return (
    <div style={accentStyle(player.team?.primaryColor)} className="space-y-6">
      {player.team && (
        <Link
          to={`/t/${tournamentId}/teams/${player.team._id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {player.team.name}
        </Link>
      )}
      <div
        className="flex items-center gap-5 rounded-xl border border-border p-6"
        style={{ background: 'linear-gradient(120deg, rgb(var(--team-accent-rgb) / 0.18), transparent)' }}
      >
        <TeamCrest team={player.team} size="lg" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {player.role && <Badge variant="outline" className="uppercase">{player.role}</Badge>}
            {player.jerseyNumber != null && <span className="text-sm text-muted-foreground">#{player.jerseyNumber}</span>}
          </div>
          <h1 className="font-display text-4xl tracking-wide sm:text-5xl">{player.name}</h1>
          {player.team && (
            <Link to={`/t/${tournamentId}/teams/${player.team._id}`} className="text-muted-foreground hover:text-primary hover:underline">
              {player.team.name}
            </Link>
          )}
        </div>
      </div>

      {sport === 'cricket'
        ? <CricketProfile stats={stats} matches={matches} />
        : <FootballProfile stats={stats} matches={matches} />}
    </div>
  );
}
