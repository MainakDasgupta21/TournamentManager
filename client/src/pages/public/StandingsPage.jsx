import { useEffect, useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Download } from 'lucide-react';
import { useStandings, useFixtures } from '@/hooks/queries';
import StandingsTable from '@/components/StandingsTable';
import QualificationPanel from '@/components/QualificationPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonTable, FilterChip } from '@/components/ui/misc';
import { PageHeader } from '@/components/ui/page-header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formByTeam as computeFormByTeam } from '@/lib/formGuide';
import { qualificationScenarios } from '@/lib/qualification';
import { toCsv, downloadCsv, slugify } from '@/lib/exportCsv';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/useMediaQuery';

function exportStandings(groups, sport, tournamentName) {
  const isCricket = sport === 'cricket';
  const rows = [];
  for (const g of groups) {
    g.rows.forEach((r, i) => rows.push({ group: g.group?.name ?? '', pos: i + 1, ...r }));
  }
  const columns = [
    { header: 'Group', get: (r) => r.group },
    { header: 'Pos', get: (r) => r.pos },
    { header: 'Team', get: (r) => r.teamId?.name ?? '' },
    { header: 'P', get: (r) => r.played ?? 0 },
    { header: 'W', get: (r) => r.won ?? 0 },
    { header: isCricket ? 'T' : 'D', get: (r) => r.drawn ?? 0 },
    { header: 'L', get: (r) => r.lost ?? 0 },
    ...(isCricket
      ? [
          { header: 'NR', get: (r) => r.noResult ?? 0 },
          { header: 'NRR', get: (r) => Number(r.netRunRate ?? 0).toFixed(3) },
        ]
      : [
          { header: 'GF', get: (r) => r.goalsFor ?? 0 },
          { header: 'GA', get: (r) => r.goalsAgainst ?? 0 },
          { header: 'GD', get: (r) => r.goalDifference ?? 0 },
        ]),
    { header: 'Pts', get: (r) => r.points ?? 0 },
  ];
  downloadCsv(`${slugify(tournamentName, 'tournament')}-standings`, toCsv(rows, columns));
}

function formatRelative(ts) {
  if (!ts) return '';
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Subtle freshness pill — reflects React Query's last refetch (socket-driven). */
function UpdatedIndicator({ updatedAt, isFetching }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!updatedAt) return null;
  return (
    <span
      aria-live="polite"
      className="hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/50 px-2.5 py-1 text-xs text-muted-foreground sm:inline-flex"
    >
      <span className={cn('h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]', isFetching && 'animate-soft-pulse')} />
      {isFetching ? 'Updating…' : `Updated ${formatRelative(updatedAt)}`}
    </span>
  );
}

/** Compact two-option segmented control for column density. */
function ViewToggle({ value, onChange }) {
  const options = [
    { id: 'summary', label: 'Summary' },
    { id: 'full', label: 'Full stats' },
  ];
  return (
    <div
      role="group"
      aria-label="Table detail level"
      className="inline-flex shrink-0 self-start rounded-full border border-border/80 bg-card/50 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            value === o.id
              ? 'bg-secondary text-foreground shadow-[var(--shadow-soft)]'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function StandingsPage() {
  const { tournament, tournamentId } = useOutletContext();
  const { data: standings = [], isLoading, isError, refetch, dataUpdatedAt, isFetching } = useStandings(tournamentId);
  const { data: fixtures = [], isLoading: fixturesLoading } = useFixtures(tournamentId);
  const [searchParams, setSearchParams] = useSearchParams();
  const prefersSummary = useMediaQuery('(max-width: 639px)');
  const [viewMode, setViewMode] = useState('full');
  const [viewModeTouched, setViewModeTouched] = useState(false);

  useEffect(() => {
    if (viewModeTouched) return;
    setViewMode(prefersSummary ? 'summary' : 'full');
  }, [prefersSummary, viewModeTouched]);

  const groupsWithRows = useMemo(() => standings.filter((g) => g.rows.length), [standings]);
  const formMap = useMemo(() => computeFormByTeam(fixtures), [fixtures]);

  const winPoints = tournament.pointsConfig?.win ?? (tournament.sportType === 'football' ? 3 : 2);
  const qualifyCount = tournament.groupSettings?.qualifiersPerGroup ?? 2;
  const scenariosByGroup = useMemo(() => {
    const map = {};
    for (const g of groupsWithRows) {
      map[g.group._id] = qualificationScenarios({
        rows: g.rows,
        fixtures,
        groupId: g.group._id,
        winPoints,
        qualifyCount,
      });
    }
    return map;
  }, [groupsWithRows, fixtures, winPoints, qualifyCount]);

  const groupParam = searchParams.get('group');
  const active = groupParam && groupsWithRows.some((g) => g.group._id === groupParam) ? groupParam : 'all';
  const setActive = (next) =>
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next === 'all') params.delete('group');
        else params.set('group', next);
        return params;
      },
      { replace: true }
    );

  // Form and qualification scenarios both derive from fixtures, so gate the
  // first paint on both queries to avoid a flash of "—" / stale projections.
  if (isLoading || fixturesLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <SkeletonTable />
        <SkeletonTable />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load standings"
        description="There was a problem reaching the server. Please try again."
        onRetry={refetch}
      />
    );
  }

  if (!groupsWithRows.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No standings yet"
        description="Standings are calculated automatically as group-stage results are entered."
      />
    );
  }

  const isAllGroups = active === 'all';
  const visible = isAllGroups ? groupsWithRows : groupsWithRows.filter((g) => g.group._id === active);
  const showSwitcher = groupsWithRows.length > 1;
  const options = [{ id: 'all', name: 'All groups' }, ...groupsWithRows.map((g) => ({ id: g.group._id, name: g.group.name }))];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Standings"
        description="Auto-ranked tables with form and qualification scenarios for every group."
        actions={
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <UpdatedIndicator updatedAt={dataUpdatedAt} isFetching={isFetching} />
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportStandings(visible, tournament.sportType, tournament.name)}
            >
              <Download /> <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {showSwitcher ? (
          <div className="min-w-0 flex-1">
            {/* Mobile: compact dropdown keeps a long group list from dominating the screen. */}
            <div className="sm:hidden">
              <Select value={active} onValueChange={setActive}>
                <SelectTrigger aria-label="Filter by group">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Desktop: full chip rail. */}
            <div className="hidden flex-wrap gap-2 sm:flex">
              {options.map((o) => (
                <FilterChip key={o.id} active={active === o.id} onClick={() => setActive(o.id)}>
                  {o.name}
                </FilterChip>
              ))}
            </div>
          </div>
        ) : (
          <span />
        )}
        <ViewToggle
          value={viewMode}
          onChange={(next) => {
            setViewModeTouched(true);
            setViewMode(next);
          }}
        />
      </div>

      <div className={cn('grid gap-6', isAllGroups && 'lg:grid-cols-2')}>
        {visible.map((g, i) => (
          <motion.div
            key={g.group._id}
            className="min-w-0"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="font-display text-2xl tracking-[-0.02em]">{g.group.name}</CardTitle>
                <span className="shrink-0 rounded-full border border-border/65 bg-card/50 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {g.rows.length} {g.rows.length === 1 ? 'team' : 'teams'}
                </span>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <StandingsTable
                  tournamentId={tournamentId}
                  sport={tournament.sportType}
                  rows={g.rows}
                  qualifiers={tournament.groupSettings?.qualifiersPerGroup}
                  formByTeam={formMap}
                  compact={viewMode === 'summary'}
                  caption={`${g.group.name} standings table`}
                />
                <QualificationPanel scenarios={scenariosByGroup[g.group._id]} defaultOpen={!isAllGroups} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
