import { useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarClock, ListChecks, ArrowRight, Users, Layers, Swords, Trophy } from 'lucide-react';
import { useFixtures, useStandings } from '@/hooks/queries';
import LiveTicker from '@/components/LiveTicker';
import FixtureItem from '@/components/FixtureItem';
import MatchDetail from '@/components/MatchDetail';
import StandingsTable from '@/components/StandingsTable';
import { Card, CardContent } from '@/components/ui/card';
import { CountUp } from '@/components/ui/count-up';
import { EmptyState } from '@/components/ui/misc';
import { staggerContainer, staggerItem } from '@/lib/motion';

const STAT_TONES = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning)/0.12)] text-[hsl(var(--warning))]',
};

function StatTile({ icon: Icon, label, value, sub, tone = 'primary' }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-foreground/5 blur-2xl" />
      <CardContent className="flex items-center gap-4 p-5">
        {Icon && (
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${STAT_TONES[tone]}`}>
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="font-display text-3xl leading-tight tracking-wide">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TournamentHub() {
  const { tournament, stats, liveStates, tournamentId } = useOutletContext();
  const { data: fixtures = [] } = useFixtures(tournamentId);
  const { data: standings = [] } = useStandings(tournamentId);
  const [selected, setSelected] = useState(null);

  const upcoming = fixtures
    .filter((f) => f.status !== 'completed' && f.teamA && f.teamB)
    .slice(0, 5);
  const recent = fixtures.filter((f) => f.status === 'completed').slice(-5).reverse();
  const previewGroup = standings.find((g) => g.rows.length);

  const played = stats?.completedCount ?? 0;
  const total = stats?.fixtureCount ?? 0;

  return (
    <div className="space-y-8">
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
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-semibold">
              <CalendarClock className="h-4 w-4 text-primary" /> Upcoming
            </h3>
            <Link to={`/t/${tournamentId}/fixtures`} className="text-sm text-primary hover:underline">
              All fixtures
            </Link>
          </div>
          {upcoming.length ? (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
              {upcoming.map((f) => (
                <motion.div key={f._id} variants={staggerItem}>
                  <FixtureItem fixture={f} sport={tournament.sportType} live={liveStates[f._id]} onClick={() => setSelected(f)} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming fixtures.</p>
          )}
        </div>

        <div className="space-y-4 lg:col-span-1">
          <h3 className="flex items-center gap-2 font-semibold">
            <ListChecks className="h-4 w-4 text-accent" /> Recent results
          </h3>
          {recent.length ? (
            <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
              {recent.map((f) => (
                <motion.div key={f._id} variants={staggerItem}>
                  <FixtureItem fixture={f} sport={tournament.sportType} onClick={() => setSelected(f)} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <p className="text-sm text-muted-foreground">No results yet.</p>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">{previewGroup?.group?.name ?? 'Standings'}</h3>
            <Link to={`/t/${tournamentId}/standings`} className="flex items-center text-sm text-primary hover:underline">
              Full table <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </div>
          {previewGroup ? (
            <Card>
              <CardContent className="p-3">
                <StandingsTable
                  tournamentId={tournamentId}
                  sport={tournament.sportType}
                  rows={previewGroup.rows}
                  qualifiers={tournament.groupSettings?.qualifiersPerGroup}
                />
              </CardContent>
            </Card>
          ) : (
            <EmptyState icon={ListChecks} title="No standings yet" description="Standings populate as results come in." />
          )}
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
