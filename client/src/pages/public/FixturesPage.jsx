import { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarRange, Radio, Download } from 'lucide-react';
import { useFixtures, useGroups, useTeams } from '@/hooks/queries';
import FixtureItem from '@/components/FixtureItem';
import MatchDetail from '@/components/MatchDetail';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState, ErrorState, Skeleton, FilterChip, SearchInput } from '@/components/ui/misc';
import { formatDate, formatDateTime, resultSummary } from '@/lib/format';
import { toCsv, downloadCsv, slugify } from '@/lib/exportCsv';
import { staggerContainer, staggerItem } from '@/lib/motion';

function exportFixtures(fixtures, tournamentName) {
  const columns = [
    { header: 'Match', get: (f) => f.matchNumber ?? '' },
    { header: 'Stage', get: (f) => f.stage ?? '' },
    { header: 'Round', get: (f) => f.roundName || (f.groupRound ? `Round ${f.groupRound}` : 'Group') },
    { header: 'Date', get: (f) => (f.scheduledAt ? formatDateTime(f.scheduledAt) : '') },
    { header: 'Home', get: (f) => f.teamA?.name || f.placeholderA || 'TBD' },
    { header: 'Away', get: (f) => f.teamB?.name || f.placeholderB || 'TBD' },
    { header: 'Status', get: (f) => f.status },
    { header: 'Result', get: (f) => (f.status === 'completed' ? resultSummary(f) : '') },
    { header: 'Venue', get: (f) => f.venue ?? '' },
  ];
  downloadCsv(`${slugify(tournamentName, 'tournament')}-fixtures`, toCsv(fixtures, columns));
}

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'scheduled', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];

export default function FixturesPage() {
  const { tournament, tournamentId, liveStates } = useOutletContext();
  const { data: groups = [] } = useGroups(tournamentId);
  const { data: teams = [] } = useTeams(tournamentId);
  const [groupId, setGroupId] = useState('all');
  const [teamId, setTeamId] = useState('all');
  const [stage, setStage] = useState('all');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);

  const filters = {};
  if (groupId !== 'all') filters.groupId = groupId;
  if (teamId !== 'all') filters.teamId = teamId;
  if (stage !== 'all') filters.stage = stage;
  if (status !== 'all') filters.status = status;

  const { data: fixtures = [], isLoading, isError, refetch } = useFixtures(tournamentId, filters);

  // Free-text search (team, round, venue) over the server-filtered set.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return fixtures;
    return fixtures.filter((f) => {
      const hay = [f.teamA?.name, f.teamB?.name, f.placeholderA, f.placeholderB, f.roundName, f.venue]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [fixtures, query]);

  const liveNow = useMemo(() => filtered.filter((f) => f.status === 'live'), [filtered]);

  // Group the (non-live) fixtures by calendar day, chronologically, with undated
  // fixtures (e.g. knockout placeholders) collected at the end.
  const byDay = useMemo(() => {
    const ts = (f) => (f.scheduledAt ? new Date(f.scheduledAt).getTime() : Infinity);
    const map = new Map();
    for (const f of filtered) {
      if (f.status === 'live') continue;
      const key = f.scheduledAt ? formatDate(f.scheduledAt) : 'Date TBD';
      if (!map.has(key)) map.set(key, { key, sortTs: Infinity, fixtures: [] });
      const grp = map.get(key);
      grp.fixtures.push(f);
      grp.sortTs = Math.min(grp.sortTs, ts(f));
    }
    const groups = [...map.values()].sort((a, b) => a.sortTs - b.sortTs);
    for (const g of groups) {
      g.fixtures.sort((a, b) => ts(a) - ts(b) || (a.matchNumber ?? 0) - (b.matchNumber ?? 0));
    }
    return groups.map((g) => [g.key, g.fixtures]);
  }, [filtered]);

  const hasFilters =
    groupId !== 'all' || teamId !== 'all' || stage !== 'all' || status !== 'all' || query.trim() !== '';
  const clearFilters = () => {
    setGroupId('all');
    setTeamId('all');
    setStage('all');
    setStatus('all');
    setQuery('');
  };

  const open = (f) => setSelected(f);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_CHIPS.map((c) => (
              <FilterChip key={c.id} active={status === c.id} onClick={() => setStatus(c.id)}>
                {c.label}
              </FilterChip>
            ))}
          </div>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team, round, venue…"
            className="w-full lg:w-64"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={groupId} onValueChange={setGroupId}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Group" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g._id} value={g._id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Team" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Stage" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              <SelectItem value="group">Group</SelectItem>
              <SelectItem value="knockout">Knockout</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full sm:ml-auto sm:w-auto"
            title="Exports the current filtered list as CSV"
            disabled={!filtered.length}
            onClick={() => exportFixtures(filtered, tournament.name)}
          >
            <Download /> Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border/60 bg-card/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-12 rounded-full" />
              </div>
              <div className="space-y-2.5">
                {[0, 1].map((j) => (
                  <div key={j} className="flex items-center gap-2.5">
                    <Skeleton className="h-6 w-6 rounded-md" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Couldn't load fixtures"
          description="There was a problem reaching the server. Please try again."
          onRetry={refetch}
        />
      ) : !filtered.length ? (
        <EmptyState
          icon={CalendarRange}
          title="No fixtures"
          description={
            hasFilters
              ? 'No fixtures match your filters or search.'
              : 'Fixtures will appear here once the schedule is published.'
          }
          action={hasFilters ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
        />
      ) : (
        <div className="space-y-8">
          {liveNow.length > 0 && (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-destructive">
                <Radio className="h-4 w-4" /> Live now
              </h3>
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {liveNow.map((f) => (
                  <motion.div key={f._id} variants={staggerItem}>
                    <FixtureItem
                      fixture={f}
                      sport={tournament.sportType}
                      live={liveStates[f._id]}
                      onClick={() => open(f)}
                      className="border-destructive/40 bg-destructive/5"
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          )}

          {byDay.map(([day, dayFixtures]) => (
            <div key={day}>
              <h3 className="sticky top-28 z-10 -mx-1 mb-3 bg-background/90 px-1 py-1.5 text-sm font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/70">
                {day}
              </h3>
              <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {dayFixtures.map((f) => (
                  <motion.div key={f._id} variants={staggerItem}>
                    <FixtureItem
                      fixture={f}
                      sport={tournament.sportType}
                      live={liveStates[f._id]}
                      onClick={() => open(f)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>
          ))}
        </div>
      )}

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
