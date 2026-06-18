import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Award, BarChart3, Crown } from 'lucide-react';
import { useLeaderboards, useTournamentPlayers } from '@/hooks/queries';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, ErrorState, SkeletonTable, TeamCrest } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import BestEleven from '@/components/BestEleven';
import { bestEleven } from '@/lib/bestEleven';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/* Board definitions. `get` reads a column value from a leaderboard row; the   */
/* leading entity column (player/team) is rendered separately.                 */
/* -------------------------------------------------------------------------- */

const CRICKET_BOARDS = [
  {
    key: 'mostRuns', label: 'Most Runs', tag: 'Orange Cap', accent: '#f97316',
    columns: [
      { label: 'M', get: (r) => r.matches },
      { label: 'Inns', get: (r) => r.innings },
      { label: 'Runs', get: (r) => r.runs, strong: true },
      { label: 'HS', get: (r) => r.highScore },
      { label: 'Avg', get: (r) => (r.average ?? '–') },
      { label: 'SR', get: (r) => r.strikeRate },
      { label: '4s', get: (r) => r.fours },
      { label: '6s', get: (r) => r.sixes },
    ],
  },
  {
    key: 'mostWickets', label: 'Most Wickets', tag: 'Purple Cap', accent: '#a855f7',
    columns: [
      { label: 'M', get: (r) => r.matches },
      { label: 'Overs', get: (r) => r.oversBowled },
      { label: 'Runs', get: (r) => r.runsConceded },
      { label: 'Wkts', get: (r) => r.wickets, strong: true },
      { label: 'Best', get: (r) => r.bestBowling },
      { label: 'Econ', get: (r) => r.economy },
    ],
  },
  {
    key: 'highestScore', label: 'Highest Score', accent: '#22d3ee',
    columns: [
      { label: 'HS', get: (r) => r.highScore, strong: true },
      { label: 'Runs', get: (r) => r.runs },
      { label: 'SR', get: (r) => r.strikeRate },
    ],
  },
  {
    key: 'bestBowling', label: 'Best Bowling', accent: '#a855f7',
    columns: [
      { label: 'Figures', get: (r) => r.bestBowling, strong: true },
      { label: 'Wkts', get: (r) => r.wickets },
      { label: 'Econ', get: (r) => r.economy },
    ],
  },
  {
    key: 'mostSixes', label: 'Most Sixes', accent: '#f59e0b',
    columns: [
      { label: '6s', get: (r) => r.sixes, strong: true },
      { label: '4s', get: (r) => r.fours },
      { label: 'Runs', get: (r) => r.runs },
    ],
  },
  {
    key: 'mostFours', label: 'Most Fours', accent: '#38bdf8',
    columns: [
      { label: '4s', get: (r) => r.fours, strong: true },
      { label: '6s', get: (r) => r.sixes },
      { label: 'Runs', get: (r) => r.runs },
    ],
  },
  {
    key: 'bestStrikeRate', label: 'Best Strike Rate', accent: '#34d399',
    columns: [
      { label: 'SR', get: (r) => r.strikeRate, strong: true },
      { label: 'Runs', get: (r) => r.runs },
      { label: 'Balls', get: (r) => r.ballsFaced },
    ],
  },
  {
    key: 'bestEconomy', label: 'Best Economy', accent: '#34d399',
    columns: [
      { label: 'Econ', get: (r) => r.economy, strong: true },
      { label: 'Overs', get: (r) => r.oversBowled },
      { label: 'Wkts', get: (r) => r.wickets },
    ],
  },
];

const FOOTBALL_BOARDS = [
  {
    key: 'topScorers', label: 'Golden Boot', tag: 'Top Scorers', accent: '#f59e0b',
    columns: [
      { label: 'Apps', get: (r) => r.appearances },
      { label: 'Goals', get: (r) => r.goals, strong: true },
      { label: 'Assists', get: (r) => r.assists },
    ],
  },
  {
    key: 'mostAssists', label: 'Most Assists', accent: '#38bdf8',
    columns: [
      { label: 'Apps', get: (r) => r.appearances },
      { label: 'Assists', get: (r) => r.assists, strong: true },
      { label: 'Goals', get: (r) => r.goals },
    ],
  },
  {
    key: 'goldenGlove', label: 'Golden Glove', tag: 'Goalkeepers', accent: '#fbbf24',
    columns: [
      { label: 'Apps', get: (r) => r.appearances },
      { label: 'Clean Sheets', get: (r) => r.cleanSheets, strong: true },
      { label: 'Conceded', get: (r) => r.goalsConcededByTeam },
    ],
  },
  {
    key: 'fairPlay', label: 'Fair Play', entity: 'team', accent: '#34d399',
    columns: [
      { label: 'Yellow', get: (r) => r.yellowCards },
      { label: 'Red', get: (r) => r.redCards },
      { label: 'Points', get: (r) => r.points, strong: true },
    ],
  },
];

const RANK_ACCENT = ['text-amber-400', 'text-slate-300', 'text-orange-400'];

function PlayerCell({ tournamentId, player }) {
  if (!player) return <span className="text-muted-foreground">Unknown</span>;
  return (
    <Link
      to={`/t/${tournamentId}/players/${player._id}`}
      className="group flex items-center gap-3 hover:text-primary"
    >
      <TeamCrest team={player.team} size="sm" />
      <span className="min-w-0 max-w-[40vw] sm:max-w-none">
        <span className="block truncate font-medium group-hover:underline">{player.name}</span>
        {player.team && (
          <span className="block text-xs text-muted-foreground">{player.team.shortCode}</span>
        )}
      </span>
    </Link>
  );
}

function TeamCell({ team }) {
  if (!team) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-3">
      <TeamCrest team={team} size="sm" />
      <span className="max-w-[40vw] truncate font-medium sm:max-w-none">{team.name}</span>
    </span>
  );
}

function StatBoard({ board, rows, tournamentId }) {
  if (!rows?.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing to rank yet"
        description="This board fills in automatically as match data is recorded."
      />
    );
  }
  const isTeam = board.entity === 'team';
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="sticky left-0 z-10 w-10 bg-card px-2 py-2.5 text-center">#</th>
            <th className="sticky left-10 z-10 border-r border-border/40 bg-card px-2 py-2.5">{isTeam ? 'Team' : 'Player'}</th>
            {board.columns.map((c) => (
              <th key={c.label} className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <motion.tr
              key={(row.player?._id || row.team?._id || i) + board.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.025, 0.3) }}
              className="group border-b border-border/40 last:border-0 hover:bg-secondary/30"
            >
              <td className={cn('sticky left-0 z-10 bg-card px-2 py-2.5 text-center font-display text-lg', RANK_ACCENT[i] || 'text-muted-foreground')}>
                {i + 1}
              </td>
              <td className="sticky left-10 z-10 border-r border-border/40 bg-card px-2 py-2.5">
                {isTeam ? <TeamCell team={row.team} /> : <PlayerCell tournamentId={tournamentId} player={row.player} />}
              </td>
              {board.columns.map((c) => (
                <td
                  key={c.label}
                  className={cn(
                    'whitespace-nowrap px-2 py-2.5 text-right tabular-nums',
                    c.strong ? 'font-bold' : 'text-muted-foreground'
                  )}
                >
                  {c.get(row)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerOfTournament({ tournamentId, potm, sport }) {
  const p = potm?.player;
  if (!p) return null;
  const c = potm.stats?.[sport] ?? {};
  const line = sport === 'cricket'
    ? `${c.runs ?? 0} runs · ${c.wickets ?? 0} wkts`
    : `${c.goals ?? 0} goals · ${c.assists ?? 0} assists`;
  return (
    <Card className="overflow-hidden border-primary/30">
      <CardContent
        className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:gap-4"
        style={{ background: 'linear-gradient(120deg, rgb(var(--team-accent-rgb) / 0.18), transparent)' }}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-400/15">
          <Crown className="h-6 w-6 text-amber-400" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Player of the Tournament</p>
          <Link to={`/t/${tournamentId}/players/${p._id}`} className="break-words font-display text-2xl tracking-wide hover:underline">
            {p.name}
          </Link>
          <p className="break-words text-sm text-muted-foreground">{p.team?.name} · {line}</p>
        </div>
        <TeamCrest team={p.team} size="lg" />
      </CardContent>
    </Card>
  );
}

export default function LeaderboardsPage() {
  const { tournament, tournamentId } = useOutletContext();
  const { data: leaderboards, isLoading, isError, refetch } = useLeaderboards(tournamentId);
  const { data: players = [] } = useTournamentPlayers(tournamentId);

  const boards = tournament.sportType === 'cricket' ? CRICKET_BOARDS : FOOTBALL_BOARDS;
  const [active, setActive] = useState(boards[0].key);
  const activeBoard = useMemo(() => boards.find((b) => b.key === active) ?? boards[0], [boards, active]);
  const xi = useMemo(
    () => bestEleven(tournament.sportType, players),
    [tournament.sportType, players]
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonTable rows={8} />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load leaderboards"
        description="There was a problem reaching the server. Please try again."
        onRetry={refetch}
      />
    );
  }

  const rows = leaderboards?.[activeBoard.key] ?? [];
  const hasAny = boards.some((b) => (leaderboards?.[b.key]?.length ?? 0) > 0) || leaderboards?.playerOfTournament;

  if (!hasAny) {
    return (
      <EmptyState
        icon={Award}
        title="No leaderboards yet"
        description="Player and team rankings appear here automatically once match results are recorded."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboards"
        description="Celebrate top performers with live-updating, trophy-worthy rankings."
      />
      <PlayerOfTournament
        tournamentId={tournamentId}
        potm={leaderboards?.playerOfTournament}
        sport={tournament.sportType}
      />

      <BestEleven tournamentId={tournamentId} xi={xi} />

      {/* Category selector */}
      <div className="overflow-x-auto pb-1 scrollbar-thin">
        <div className="flex w-max gap-2">
          {boards.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setActive(b.key)}
              aria-pressed={b.key === active}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                b.key === active
                  ? 'border-primary/40 bg-primary text-primary-foreground shadow-[var(--shadow-soft)]'
                  : 'border-border/80 bg-card/55 text-muted-foreground hover:border-primary/35 hover:bg-secondary/65 hover:text-foreground'
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="h-5 w-1.5 rounded-full" style={{ background: activeBoard.accent }} />
            <h2 className="font-display text-2xl tracking-[-0.02em]">{activeBoard.label}</h2>
            {activeBoard.tag && <Badge variant="secondary">{activeBoard.tag}</Badge>}
          </div>
          <StatBoard board={activeBoard} rows={rows} tournamentId={tournamentId} />
        </CardContent>
      </Card>
    </div>
  );
}
