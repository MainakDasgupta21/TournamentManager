import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Settings2, Trophy, Trash2, ArrowRight, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useTournamentList, useDeleteTournament } from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { PageHeader } from '@/components/ui/page-header';
import { TournamentStatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, SkeletonGrid, FilterChip, SearchInput, Pager, Spinner } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { formatDate, sportLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { staggerContainer, staggerItem } from '@/lib/motion';

const PAGE_SIZE = 12;

// `id` doubles as the server `state` param ('all' means no status filter).
const STATUS_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'In progress' },
  { id: 'setup', label: 'Setup' },
  { id: 'completed', label: 'Completed' },
];
const SPORT_FILTERS = [
  { id: 'all', label: 'All sports' },
  { id: 'cricket', label: 'Cricket' },
  { id: 'football', label: 'Football' },
];

export default function Dashboard() {
  const del = useDeleteTournament();
  const confirm = useConfirm();
  useDocumentTitle('Dashboard');

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sport, setSport] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const hasFilters = debouncedQuery !== '' || status !== 'all' || sport !== 'all';
  const clearFilters = () => { setQuery(''); setStatus('all'); setSport('all'); };

  // Any filter/search/sort change resets to the first page.
  useEffect(() => { setPage(1); }, [debouncedQuery, status, sport, sort]);

  const filters = {
    mine: true,
    page,
    limit: PAGE_SIZE,
    sort,
    ...(status !== 'all' ? { state: status } : {}),
    ...(sport !== 'all' ? { sport } : {}),
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
  };
  const { data, isLoading, isError, isFetching, refetch } = useTournamentList(filters);

  const visible = data?.tournaments ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const showToolbar = !isLoading && !isError && (total > 0 || hasFilters);

  // Clamp the page if results shrank beneath us (e.g. after a delete).
  useEffect(() => {
    if (!isFetching && page > pages) setPage(pages);
  }, [isFetching, page, pages]);

  const onDelete = async (t) => {
    const ok = await confirm({
      title: `Delete "${t.name}"?`,
      description: 'This permanently removes all teams, fixtures and standings for this tournament.',
      confirmLabel: 'Delete tournament',
    });
    if (!ok) return;
    try {
      await del.mutateAsync(t._id);
      toast.success('Tournament deleted');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Your tournaments"
        description="Create and manage cricket & football competitions"
        className="mb-8"
        actions={
          <Button asChild size="lg">
            <Link to="/admin/new"><Plus /> New tournament</Link>
          </Button>
        }
      />

      {/* Toolbar — hidden until there's something to filter. */}
      {showToolbar && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search your tournaments…"
                className="w-full sm:w-72"
              />
              {isFetching && <Spinner className="h-4 w-4 shrink-0" />}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span className="mr-1 hidden sm:inline">Sort</span>
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
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => (
              <FilterChip key={f.id} active={status === f.id} onClick={() => setStatus(f.id)}>
                {f.label}
              </FilterChip>
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
            {SPORT_FILTERS.map((f) => (
              <FilterChip key={f.id} active={sport === f.id} onClick={() => setSport(f.id)}>
                {f.label}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <SkeletonGrid count={6} media={false} />
      ) : isError ? (
        <ErrorState
          title="Couldn't load your tournaments"
          description="There was a problem reaching the server."
          onRetry={refetch}
        />
      ) : total === 0 && !hasFilters ? (
        <EmptyState
          icon={Trophy}
          title="No tournaments yet"
          description="Spin up your first tournament — pick a sport, add teams, and let the engine handle fixtures, standings and brackets."
          action={<Button asChild><Link to="/admin/new"><Plus /> Create tournament</Link></Button>}
        />
      ) : total === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description="No tournaments match your search or filters."
          action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>}
        />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <motion.div key={t._id} variants={staggerItem} className="group relative">
              <Link to={`/admin/t/${t._id}`} className="block h-full">
                <Card className="h-full transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline">{sportLabel(t.sportType)}</Badge>
                      <TournamentStatusBadge status={t.status} />
                    </div>
                    <h3 className="font-display text-2xl tracking-wide">{t.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(t.startDate)} – {formatDate(t.endDate)}
                    </p>
                    <div className="mt-auto flex items-center pt-4 text-sm font-medium text-primary">
                      <Settings2 className="mr-1.5 h-4 w-4" /> Manage
                      <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
              <Tooltip label="Delete tournament">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-3 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(t); }}
                  aria-label="Delete tournament"
                >
                  <Trash2 className="text-destructive" />
                </Button>
              </Tooltip>
            </motion.div>
          ))}
        </motion.div>
      )}

      {!isLoading && !isError && total > 0 && (
        <Pager page={data?.page ?? page} pages={pages} onPage={setPage} className="mt-8" />
      )}
    </div>
  );
}
