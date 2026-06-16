import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Download } from 'lucide-react';
import { useStandings, useFixtures } from '@/hooks/queries';
import StandingsTable from '@/components/StandingsTable';
import QualificationPanel from '@/components/QualificationPanel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, ErrorState, SkeletonTable } from '@/components/ui/misc';
import { formByTeam as computeFormByTeam } from '@/lib/formGuide';
import { qualificationScenarios } from '@/lib/qualification';
import { toCsv, downloadCsv, slugify } from '@/lib/exportCsv';
import { cn } from '@/lib/utils';

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

export default function StandingsPage() {
  const { tournament, tournamentId } = useOutletContext();
  const { data: standings = [], isLoading, isError, refetch } = useStandings(tournamentId);
  const { data: fixtures = [] } = useFixtures(tournamentId);
  const [active, setActive] = useState('all');

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

  if (isLoading) {
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

  const visible = active === 'all' ? groupsWithRows : groupsWithRows.filter((g) => g.group._id === active);
  const showSwitcher = groupsWithRows.length > 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showSwitcher ? (
          <div className="flex flex-wrap gap-2">
            <Chip active={active === 'all'} onClick={() => setActive('all')}>All groups</Chip>
            {groupsWithRows.map((g) => (
              <Chip key={g.group._id} active={active === g.group._id} onClick={() => setActive(g.group._id)}>
                {g.group.name}
              </Chip>
            ))}
          </div>
        ) : (
          <span />
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportStandings(groupsWithRows, tournament.sportType, tournament.name)}
        >
          <Download /> Export CSV
        </Button>
      </div>

      <div className={cn('grid gap-6', active === 'all' && 'lg:grid-cols-2')}>
        {visible.map((g, i) => (
          <motion.div
            key={g.group._id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="font-display text-2xl tracking-wide">{g.group.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <StandingsTable
                  tournamentId={tournamentId}
                  sport={tournament.sportType}
                  rows={g.rows}
                  qualifiers={tournament.groupSettings?.qualifiersPerGroup}
                  formByTeam={formMap}
                />
                <QualificationPanel scenarios={scenariosByGroup[g.group._id]} />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}
