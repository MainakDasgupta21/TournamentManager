import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Trophy, Activity, Users, Search, Sparkles, CalendarDays } from 'lucide-react';
import { useTournaments } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CountUp } from '@/components/ui/count-up';
import { TournamentStatusBadge, isInProgress } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, SkeletonGrid, FilterChip, SearchInput } from '@/components/ui/misc';
import { formatDate, sportLabel } from '@/lib/format';
import { accentStyle, cn, cssBackgroundImageUrl } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'In progress' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];

function matchesFilter(t, filter) {
  if (filter === 'all') return true;
  if (filter === 'live') return isInProgress(t.status);
  if (filter === 'upcoming') return t.status === 'setup';
  if (filter === 'completed') return t.status === 'completed';
  return true;
}

function TournamentCard({ t }) {
  const live = isInProgress(t.status);
  const bannerBackground = cssBackgroundImageUrl(t.bannerImage);
  return (
    <motion.div variants={staggerItem} style={accentStyle(t.primaryColor)} className="h-full">
      <motion.div whileHover={{ y: -6 }} whileTap={{ scale: 0.99 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }} className="h-full">
        <Link to={`/t/${t._id}`} className="block h-full">
          <Card className="group relative h-full overflow-hidden transition-colors hover:border-[rgb(var(--team-accent-rgb)/0.5)] hover:shadow-2xl hover:shadow-[rgb(var(--team-accent-rgb)/0.12)]">
            <div
              className="relative h-24 w-full"
              style={{
                background: bannerBackground
                  ? `${bannerBackground} center/cover`
                  : `linear-gradient(135deg, rgb(var(--team-accent-rgb) / 0.55), rgb(var(--team-accent-rgb) / 0.05))`,
              }}
            >
              {live && (
                <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/80 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-soft-pulse rounded-full bg-[hsl(var(--success))]" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                  </span>
                  Live
                </span>
              )}
            </div>
            <div className="p-5">
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                  {sportLabel(t.sportType)}
                </span>
                <TournamentStatusBadge status={t.status} />
              </div>
              <h3 className="font-display text-2xl leading-tight tracking-wide">{t.name}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(t.startDate)} – {formatDate(t.endDate)}
              </p>
              <div className="mt-4 flex items-center text-sm font-medium text-primary transition-all sm:opacity-60 sm:group-hover:opacity-100 sm:group-hover:translate-x-0.5">
                View tournament <ArrowRight className="ml-1 h-4 w-4" />
              </div>
            </div>
          </Card>
        </Link>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const { data: tournaments, isLoading, isError, refetch } = useTournaments({ limit: 100 });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  useDocumentTitle('Tournaments');

  const all = tournaments ?? [];
  const liveCount = all.filter((t) => isInProgress(t.status)).length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = all.filter((t) => matchesFilter(t, filter));
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q));
    list = [...list].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      return new Date(b.startDate || b.createdAt || 0) - new Date(a.startDate || a.createdAt || 0);
    });
    return list;
  }, [all, query, filter, sort]);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/60 bg-grid">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-background" />
        <div className="pointer-events-none absolute -left-1/4 top-0 h-[420px] w-[420px] animate-aurora rounded-full bg-primary/20 blur-[120px]" />
        <div className="pointer-events-none absolute -right-1/4 top-10 h-[380px] w-[380px] animate-aurora rounded-full bg-accent/20 blur-[120px]" style={{ animationDelay: '-7s' }} />
        <div className="relative mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}>
            <span className="mb-4 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="mr-1.5 h-3 w-3" /> Live scores · Standings · Brackets
            </span>
            <h1 className="mx-auto max-w-4xl font-display text-6xl leading-[0.95] tracking-wide sm:text-8xl">
              Follow every match,
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> live</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Real-time standings, ball-by-ball and minute-by-minute scores, automatic knockout
              brackets and player stats — for every cricket and football tournament in one place.
            </p>
          </motion.div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <a href="#tournaments"><Trophy /> Browse tournaments</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/signup"><Users /> Run your own</Link>
            </Button>
          </div>

          {!isLoading && all.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                <CountUp value={all.length} className="font-display text-xl tracking-wide text-foreground" /> tournaments
              </span>
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[hsl(var(--success))]" />
                <CountUp value={liveCount} className="font-display text-xl tracking-wide text-foreground" /> in progress
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Listing */}
      <section id="tournaments" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-3xl tracking-wide">Tournaments</h2>
          <SearchInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tournaments…"
            className="w-full sm:w-64"
          />
        </div>

        {!isLoading && !isError && all.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <FilterChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </FilterChip>
            ))}
            <div className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
              <button
                type="button"
                onClick={() => setSort('newest')}
                className={cn('rounded-md px-2 py-1', sort === 'newest' ? 'text-foreground' : 'hover:text-foreground')}
              >
                Newest
              </button>
              <span className="text-border">·</span>
              <button
                type="button"
                onClick={() => setSort('name')}
                className={cn('rounded-md px-2 py-1', sort === 'name' ? 'text-foreground' : 'hover:text-foreground')}
              >
                A–Z
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <SkeletonGrid count={6} />
        ) : isError ? (
          <ErrorState
            title="Couldn't load tournaments"
            description="There was a problem reaching the server. Please try again."
            onRetry={refetch}
          />
        ) : !all.length ? (
          <EmptyState
            icon={Trophy}
            title="No tournaments yet"
            description="Be the first — request organiser access and launch your cricket or football tournament in minutes."
            action={<Button asChild><Link to="/signup"><Users /> Run a tournament</Link></Button>}
          />
        ) : !visible.length ? (
          <EmptyState
            icon={Search}
            title="No matches"
            description="No tournaments match your search or filter. Try clearing them."
            action={<Button variant="outline" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</Button>}
          />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true, amount: 0.1 }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
          >
            {visible.map((t) => (
              <TournamentCard key={t._id} t={t} />
            ))}
          </motion.div>
        )}
      </section>
    </div>
  );
}
