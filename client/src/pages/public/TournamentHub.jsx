import { useMemo, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CalendarClock,
  ListChecks,
  ArrowRight,
  Users,
  Layers,
  Swords,
  Trophy,
  LayoutDashboard,
  Table2,
} from 'lucide-react';
import { useFixtures, useStandings } from '@/hooks/queries';
import LiveTicker from '@/components/LiveTicker';
import FixtureItem from '@/components/FixtureItem';
import MatchDetail from '@/components/MatchDetail';
import StandingsTable from '@/components/StandingsTable';
import { Card, CardContent } from '@/components/ui/card';
import { CountUp } from '@/components/ui/count-up';
import { Skeleton } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { sectionFade } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Compact, retryable failure note for a secondary section on a busy dashboard. */
function InlineError({ message, onRetry }) {
  return (
    <div role="alert" className="m-3 rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-3 py-6 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Try again
        </button>
      )}
    </div>
  );
}

/** Calm, in-panel empty message (smaller than the full-page EmptyState). */
function PanelEmpty({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-4 py-12 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/60 text-muted-foreground">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Placeholder row that mirrors a FixtureItem while fixtures load. */
function FixtureSkeleton() {
  return (
    <div className="surface-elevated rounded-2xl border border-border/70 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <div className="space-y-2">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="h-6 w-6 rounded-md" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FixtureSkeletonList({ count = 4 }) {
  return (
    <div className="space-y-3 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <FixtureSkeleton key={i} />
      ))}
    </div>
  );
}

const STAT_TONES = {
  primary: { chip: 'bg-primary/10 text-primary', glow: 'bg-primary/25' },
  accent: { chip: 'bg-accent/10 text-accent', glow: 'bg-accent/25' },
  success: { chip: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]', glow: 'bg-[hsl(var(--success)/0.3)]' },
  warning: { chip: 'bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]', glow: 'bg-[hsl(var(--warning)/0.3)]' },
};

function StatTile({ icon: Icon, label, value, sub, tone = 'primary' }) {
  const t = STAT_TONES[tone] ?? STAT_TONES.primary;
  return (
    <Card className="surface-interactive relative overflow-hidden">
      {/* Tone-tinted corner glow for a premium, eye-catching finish. */}
      <div className={cn('pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl', t.glow)} />
      <CardContent className="flex items-center gap-4 p-5 pt-5 sm:p-5 sm:pt-5">
        {Icon && (
          <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-border/40', t.chip)}>
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display text-2xl leading-none tracking-wide tabular-nums sm:text-3xl">{value}</p>
          {/* Always reserve the sub line so every tile keeps the same height and
              the icons/labels/numbers stay aligned across the row. */}
          <p className="min-h-4 truncate text-xs leading-4 text-muted-foreground">{sub || '\u00A0'}</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Consistent "see all" link with a trailing chevron, used in panel headers. */
function PanelLink({ to, children }) {
  return (
    <Link
      to={to}
      className="inline-flex shrink-0 items-center gap-1 rounded-md text-xs font-semibold text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {children} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

const PANEL_TONES = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
};

/** Shared dashboard panel: header band (icon + title + count + action) over a body. */
function OverviewPanel({ icon: Icon, tone = 'primary', title, count, action, className, children }) {
  return (
    <Card className={cn('flex min-w-0 flex-col self-start overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', PANEL_TONES[tone])}>
            <Icon className="h-4 w-4" />
          </span>
          <h2 className="truncate text-sm font-semibold uppercase tracking-wider">{title}</h2>
          {count != null && (
            <span className="shrink-0 rounded-full bg-secondary/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {count}
            </span>
          )}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

const SCROLL_BODY = 'min-h-0 overflow-y-auto scrollbar-thin max-h-[22rem] sm:max-h-[26rem] lg:max-h-[32rem]';

export default function TournamentHub() {
  const { tournament, stats, liveStates, tournamentId } = useOutletContext();
  const {
    data: fixtures = [],
    isLoading: fixturesLoading,
    isError: fixturesError,
    refetch: refetchFixtures,
  } = useFixtures(tournamentId);
  const {
    data: standings = [],
    isLoading: standingsLoading,
    isError: standingsError,
    refetch: refetchStandings,
  } = useStandings(tournamentId);
  const [selected, setSelected] = useState(null);

  const fixtureTime = (f, fallback) => (f.scheduledAt ? new Date(f.scheduledAt).getTime() : fallback);

  // Show full lists in Overview and keep order stable/predictable.
  const upcoming = useMemo(
    () => fixtures
      .filter((f) => f.status !== 'completed' && f.teamA && f.teamB)
      .sort((a, b) => {
        // Live matches first, then upcoming by kickoff time.
        const rank = (f) => (f.status === 'live' ? 0 : 1);
        return rank(a) - rank(b)
          || fixtureTime(a, Number.POSITIVE_INFINITY) - fixtureTime(b, Number.POSITIVE_INFINITY)
          || (a.matchNumber ?? Number.POSITIVE_INFINITY) - (b.matchNumber ?? Number.POSITIVE_INFINITY);
      }),
    [fixtures]
  );
  const recent = useMemo(
    () => fixtures
      .filter((f) => f.status === 'completed' && f.teamA && f.teamB)
      .sort((a, b) =>
        fixtureTime(b, Number.NEGATIVE_INFINITY) - fixtureTime(a, Number.NEGATIVE_INFINITY)
        || (b.matchNumber ?? Number.NEGATIVE_INFINITY) - (a.matchNumber ?? Number.NEGATIVE_INFINITY)
      ),
    [fixtures]
  );
  const groupsWithRows = useMemo(
    () => standings.filter((g) => g.rows.length),
    [standings]
  );
  const multiGroup = groupsWithRows.length > 1;

  const played = stats?.completedCount ?? 0;
  const total = stats?.fixtureCount ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        icon={LayoutDashboard}
        title="Overview"
        description="Live action, upcoming fixtures, recent results, and standings — all in one place."
      />
      <LiveTicker fixtures={fixtures} sport={tournament.sportType} liveStates={liveStates} tournamentId={tournamentId} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Users} tone="primary" label="Teams" value={<CountUp value={stats?.teamCount ?? 0} />} />
        <StatTile icon={Layers} tone="accent" label="Groups" value={<CountUp value={stats?.groupCount ?? 0} />} />
        <StatTile
          icon={Swords}
          tone="success"
          label="Matches played"
          value={<><CountUp value={played} />/{total}</>}
          sub={`${total - played} remaining`}
        />
        <StatTile
          icon={Trophy}
          tone="warning"
          label="Qualifiers / group"
          value={tournament.groupSettings?.qualifiersPerGroup ?? '—'}
          sub={tournament.groupSettings?.qualifiersPerGroup ? 'Advance to knockout' : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <OverviewPanel
          icon={CalendarClock}
          tone="primary"
          title="Upcoming"
          count={upcoming.length || undefined}
          action={<PanelLink to={`/t/${tournamentId}/fixtures`}>All fixtures</PanelLink>}
        >
          {fixturesError ? (
            <InlineError message="Couldn't load fixtures." onRetry={refetchFixtures} />
          ) : fixturesLoading ? (
            <FixtureSkeletonList />
          ) : upcoming.length ? (
            <div className={cn(SCROLL_BODY, 'scroll-fade-y')}>
              <motion.div variants={sectionFade} initial="initial" animate="animate" className="space-y-3 p-3">
                {upcoming.map((f) => (
                  <FixtureItem key={f._id} fixture={f} sport={tournament.sportType} live={liveStates[f._id]} onClick={() => setSelected(f)} />
                ))}
              </motion.div>
            </div>
          ) : (
            <PanelEmpty icon={CalendarClock} message="No upcoming fixtures." />
          )}
        </OverviewPanel>

        <OverviewPanel
          icon={ListChecks}
          tone="accent"
          title="Recent results"
          count={recent.length || undefined}
          action={<PanelLink to={`/t/${tournamentId}/fixtures`}>All results</PanelLink>}
        >
          {fixturesError ? (
            <InlineError message="Couldn't load results." onRetry={refetchFixtures} />
          ) : fixturesLoading ? (
            <FixtureSkeletonList />
          ) : recent.length ? (
            <div className={cn(SCROLL_BODY, 'scroll-fade-y')}>
              <motion.div variants={sectionFade} initial="initial" animate="animate" className="space-y-3 p-3">
                {recent.map((f) => (
                  <FixtureItem key={f._id} fixture={f} sport={tournament.sportType} onClick={() => setSelected(f)} />
                ))}
              </motion.div>
            </div>
          ) : (
            <PanelEmpty icon={ListChecks} message="No results yet." />
          )}
        </OverviewPanel>

        <OverviewPanel
          icon={Table2}
          tone="success"
          title="Points table"
          count={multiGroup ? `${groupsWithRows.length} groups` : undefined}
          action={<PanelLink to={`/t/${tournamentId}/standings`}>Full table</PanelLink>}
        >
          {standingsError ? (
            <InlineError message="Couldn't load standings." onRetry={refetchStandings} />
          ) : standingsLoading ? (
            <div className="p-3">
              <Skeleton className="mb-3 h-5 w-28" />
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            </div>
          ) : groupsWithRows.length ? (
            <div className={SCROLL_BODY}>
              {groupsWithRows.map((g, idx) => (
                <section key={g.group._id} className={cn(idx > 0 && 'border-t border-border/60')}>
                  {multiGroup && (
                    <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/50 bg-card px-4 py-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                      <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {g.group.name}
                      </p>
                    </div>
                  )}
                  <div className="p-3">
                    <StandingsTable
                      compact
                      tournamentId={tournamentId}
                      sport={tournament.sportType}
                      rows={g.rows}
                      qualifiers={tournament.groupSettings?.qualifiersPerGroup}
                    />
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <PanelEmpty icon={Table2} message="Standings populate as results come in." />
          )}
        </OverviewPanel>
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
