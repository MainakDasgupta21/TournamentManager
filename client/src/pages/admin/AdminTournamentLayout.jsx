import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  Users,
  Layers,
  CalendarDays,
  GitBranch,
  History,
  UserCog,
  ArrowLeft,
  ShieldAlert,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTournament, useRequestTournamentAccess } from '@/hooks/queries';
import { useLiveTournament } from '@/hooks/useLiveTournament';
import { useTournamentNotifications } from '@/hooks/useTournamentNotifications';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { apiError } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TournamentStatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/misc';
import NotificationBell from '@/components/NotificationBell';
import PageTransition from '@/components/layout/PageTransition';
import { sportLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: 'setup', label: 'Setup', icon: Settings },
  { to: 'teams', label: 'Teams', icon: Users },
  { to: 'groups', label: 'Groups', icon: Layers },
  { to: 'fixtures', label: 'Fixtures', icon: CalendarDays },
  { to: 'knockout', label: 'Knockout', icon: GitBranch },
  { to: 'collaborators', label: 'Collaborators', icon: UserCog },
  { to: 'audit', label: 'Audit log', icon: History },
];

export default function AdminTournamentLayout() {
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useTournament(id);
  const requestAccess = useRequestTournamentAccess();
  // Keep admin views live too, so a result entered elsewhere refreshes here.
  useLiveTournament(id);
  useTournamentNotifications(id);
  useDocumentTitle(data?.tournament?.name ? `${data.tournament.name} · Admin` : 'Admin');

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load this tournament"
        description="There was a problem reaching the server."
        onRetry={refetch}
      />
    );
  }

  const t = data?.tournament;
  if (!t) {
    return (
      <EmptyState
        icon={ArrowLeft}
        title="Tournament not found"
        description="This tournament may have been removed."
        action={<Button asChild><Link to="/admin">Back to dashboard</Link></Button>}
      />
    );
  }

  const requestStatus = t.myAccessRequest?.status;
  const onRequestAccess = async () => {
    try {
      await requestAccess.mutateAsync({ tournamentId: id });
      toast.success('Access request submitted');
    } catch (e) {
      toast.error(apiError(e));
    }
  };

  if (!t.canManage) {
    return (
      <div className="space-y-6">
        <Button asChild variant="ghost" size="sm" className="mb-1">
          <Link to="/admin"><ArrowLeft /> All tournaments</Link>
        </Button>

        <div className="surface-elevated rounded-2xl p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words font-display text-3xl tracking-[-0.02em] sm:text-4xl">{t.name}</h1>
            <Badge variant="outline">{sportLabel(t.sportType)}</Badge>
            <TournamentStatusBadge status={t.status} />
          </div>
        </div>

        <div className="surface-elevated max-w-3xl rounded-2xl p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <ShieldAlert className="h-5 w-5 text-primary" /> Access required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not currently have management access to this tournament. Request access and a
            super admin will review it.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {requestStatus === 'pending' && <Badge variant="warning">Request pending</Badge>}
            {requestStatus === 'approved' && <Badge variant="success">Approved</Badge>}
            {requestStatus === 'rejected' && <Badge variant="live">Declined</Badge>}
            {!requestStatus && <Badge variant="secondary">No request sent</Badge>}
          </div>

          <div className="mt-5">
            <Button
              onClick={onRequestAccess}
              disabled={!t.canRequestAccess || requestAccess.isPending}
            >
              <Send />
              {requestAccess.isPending
                ? 'Submitting...'
                : requestStatus === 'rejected'
                  ? 'Request access again'
                  : 'Request access'}
            </Button>
            {requestStatus === 'pending' && (
              <p className="mt-2 text-xs text-muted-foreground">
                A super admin has to approve this request before you can manage this tournament.
              </p>
            )}
            {requestStatus === 'approved' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Access is approved. Refresh this page in a moment if your permissions have not
                updated yet.
              </p>
            )}
            {requestStatus === 'rejected' && (
              <p className="mt-2 text-xs text-muted-foreground">
                Your previous request was declined. You can submit a new request if needed.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/admin"><ArrowLeft /> All tournaments</Link>
      </Button>

      <div className="surface-elevated mb-6 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words font-display text-3xl tracking-[-0.02em] sm:text-4xl">{t.name}</h1>
            <Badge variant="outline">{sportLabel(t.sportType)}</Badge>
            <TournamentStatusBadge status={t.status} />
          </div>
          <div className="flex items-center gap-2 self-start sm:shrink-0">
            <NotificationBell linkTo={() => `/admin/t/${id}/fixtures`} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <nav className="surface-elevated flex gap-1 overflow-x-auto rounded-2xl p-2.5 scrollbar-thin lg:flex-col">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to ? `/admin/t/${id}/${item.to}` : `/admin/t/${id}`}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-transparent px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isActive
                        ? 'border-primary/35 bg-primary/12 text-primary'
                        : 'text-muted-foreground hover:border-border/70 hover:bg-secondary/75 hover:text-foreground'
                    )
                  }
                >
                  <Icon className="h-4 w-4" /> {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <PageTransition>
            <Outlet context={{ tournament: t, tournamentId: id }} />
          </PageTransition>
        </div>
      </div>
    </div>
  );
}
