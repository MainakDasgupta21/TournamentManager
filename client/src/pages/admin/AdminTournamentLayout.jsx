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
} from 'lucide-react';
import { useTournament } from '@/hooks/queries';
import { useLiveTournament } from '@/hooks/useLiveTournament';
import { useTournamentNotifications } from '@/hooks/useTournamentNotifications';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/admin"><ArrowLeft /> All tournaments</Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-wide">{t.name}</h1>
        <Badge variant="outline">{sportLabel(t.sportType)}</Badge>
        <TournamentStatusBadge status={t.status} />
        <div className="ml-auto">
          <NotificationBell linkTo={() => `/admin/t/${id}/fixtures`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <nav className="flex gap-1 overflow-x-auto scrollbar-thin lg:flex-col">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to ? `/admin/t/${id}/${item.to}` : `/admin/t/${id}`}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
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
