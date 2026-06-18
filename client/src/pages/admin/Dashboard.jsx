import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Settings2, Trophy, Trash2, ArrowRight, Search, Send, ShieldCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import {
  useTournamentList,
  useDeleteTournament,
  useRequestTournamentAccess,
  useUsers,
  useTournamentAccessRequests,
} from '@/hooks/queries';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { apiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
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
const SCOPE_FILTERS = [
  { id: 'mine', label: 'My access' },
  { id: 'all', label: 'All tournaments' },
];

const REQUEST_BADGE = {
  pending: { label: 'Request pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Declined', variant: 'live' },
};

export default function Dashboard() {
  const del = useDeleteTournament();
  const requestAccess = useRequestTournamentAccess();
  const confirm = useConfirm();
  const user = useAuth((s) => s.user);
  const isSuperAdmin = user?.role === 'superadmin';
  useDocumentTitle('Dashboard');

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('mine');
  const [status, setStatus] = useState('all');
  const [sport, setSport] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const scopeInitialized = useRef(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);
  const defaultScope = isSuperAdmin ? 'all' : 'mine';

  useEffect(() => {
    if (scopeInitialized.current || !user) return;
    if (isSuperAdmin) setScope('all');
    scopeInitialized.current = true;
  }, [isSuperAdmin, user]);

  const hasFilters = debouncedQuery !== '' || status !== 'all' || sport !== 'all' || scope !== defaultScope;
  const clearFilters = () => {
    setQuery('');
    setScope(defaultScope);
    setStatus('all');
    setSport('all');
  };

  // Any filter/search/sort change resets to the first page.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, scope, status, sport, sort]);

  const filters = {
    page,
    limit: PAGE_SIZE,
    sort,
    ...(scope === 'mine' ? { mine: true } : {}),
    ...(status !== 'all' ? { state: status } : {}),
    ...(sport !== 'all' ? { sport } : {}),
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
  };
  const { data, isLoading, isError, isFetching, refetch } = useTournamentList(filters);
  const { data: pendingUsersData } = useUsers(
    { status: 'pending' },
    { enabled: isSuperAdmin, refetchInterval: 60_000 }
  );
  const { data: pendingTournamentAccessData } = useTournamentAccessRequests(
    { status: 'pending' },
    { enabled: isSuperAdmin, refetchInterval: 60_000 }
  );

  const visible = data?.tournaments ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;
  const showToolbar = !isLoading && !isError;
  const userPendingCount = pendingUsersData?.pendingCount ?? 0;
  const tournamentPendingCount = pendingTournamentAccessData?.pendingCount ?? 0;

  // Clamp the page if results shrank beneath us (e.g. after a delete).
  useEffect(() => {
    const safePages = Math.max(pages, 1);
    if (!isFetching && page > safePages) setPage(safePages);
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

  const onRequestAccess = async (t) => {
    try {
      await requestAccess.mutateAsync({ tournamentId: t._id });
      toast.success(`Access request sent for "${t.name}"`);
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title={scope === 'mine' ? 'Your tournaments' : 'All tournaments'}
        description={
          scope === 'mine'
            ? 'Create and manage cricket & football competitions'
            : 'Browse all tournaments and request management access where needed'
        }
        className="mb-8"
        actions={
          <Button asChild size="lg">
            <Link to="/admin/new"><Plus /> New tournament</Link>
          </Button>
        }
      />

      {isSuperAdmin && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {[
            {
              key: 'users',
              title: 'Pending user requests',
              count: userPendingCount,
              href: '/admin/users',
              icon: ShieldCheck,
              pendingCta: 'Review users',
              emptyCta: 'View users',
            },
            {
              key: 'tournament-access',
              title: 'Pending tournament access requests',
              count: tournamentPendingCount,
              href: '/admin/tournament-access',
              icon: UserCog,
              pendingCta: 'Review access',
              emptyCta: 'View access',
            },
          ].map((item) => {
            const hasPending = item.count > 0;
            const Icon = item.icon;
            return (
              <Card key={item.key} className="surface-interactive border border-border/75">
                <CardContent className="flex h-full flex-col justify-between gap-4 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">{item.title}</p>
                      <p className="font-display text-3xl tracking-[-0.02em] tabular-nums">{item.count}</p>
                    </div>
                    <span className="rounded-xl border border-border/70 bg-secondary/45 p-2 text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={hasPending ? 'warning' : 'success'}>
                      {hasPending ? `${item.count} pending` : 'No action needed'}
                    </Badge>
                    <Button asChild size="sm" variant={hasPending ? 'default' : 'outline'}>
                      <Link to={item.href}>
                        {hasPending ? item.pendingCta : item.emptyCta}
                        <ArrowRight />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Toolbar — hidden until there's something to filter. */}
      {showToolbar && (
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search tournaments"
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
            {SCOPE_FILTERS.map((f) => (
              <FilterChip key={f.id} active={scope === f.id} onClick={() => setScope(f.id)}>
                {f.label}
              </FilterChip>
            ))}
            <span className="mx-1 h-5 w-px bg-border" aria-hidden />
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
          title={scope === 'mine' ? 'No tournaments yet' : 'No tournaments available'}
          description={
            scope === 'mine'
              ? 'Spin up your first tournament — pick a sport, add teams, and let the engine handle fixtures, standings and brackets.'
              : 'No tournaments have been created yet. Check back later or create one now.'
          }
          action={
            <Button asChild>
              <Link to="/admin/new"><Plus /> Create tournament</Link>
            </Button>
          }
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
                      {!t.canManage && t.myAccessRequest && (
                        <Badge
                          variant={REQUEST_BADGE[t.myAccessRequest.status]?.variant ?? 'secondary'}
                        >
                          {REQUEST_BADGE[t.myAccessRequest.status]?.label ?? 'Request sent'}
                        </Badge>
                      )}
                    </div>
                    <h3 className="font-display text-2xl tracking-wide">{t.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(t.startDate)} – {formatDate(t.endDate)}
                    </p>
                    {t.canManage ? (
                      <div className="mt-auto flex items-center pt-4 text-sm font-medium text-primary">
                        <Settings2 className="mr-1.5 h-4 w-4" /> Manage
                        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    ) : (
                      <div className="mt-auto flex items-center pt-4 text-sm text-muted-foreground">
                        <Send className="mr-1.5 h-4 w-4" />
                        Request access to manage
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
              {t.canManage ? (
                <Tooltip label="Delete tournament">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-3 top-3 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(t);
                    }}
                    aria-label="Delete tournament"
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip
                  label={
                    t.myAccessRequest?.status === 'pending'
                      ? 'Request pending'
                      : t.myAccessRequest?.status === 'approved'
                        ? 'Access already approved'
                        : t.myAccessRequest?.status === 'rejected'
                          ? 'Request access again'
                          : 'Request access'
                  }
                >
                  <Button
                    variant="outline"
                    size="icon"
                    className="absolute right-3 top-3 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRequestAccess(t);
                    }}
                    disabled={!t.canRequestAccess || requestAccess.isPending}
                    aria-label="Request tournament access"
                  >
                    <Send />
                  </Button>
                </Tooltip>
              )}
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
