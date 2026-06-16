import { NavLink, Outlet, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CalendarDays, MapPin, Trophy, ChevronRight, Share2, Radio } from 'lucide-react';
import { useTournament, useFixtures } from '@/hooks/queries';
import { useLiveTournament } from '@/hooks/useLiveTournament';
import { useTournamentNotifications } from '@/hooks/useTournamentNotifications';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TournamentStatusBadge } from '@/components/ui/status-badge';
import { EmptyState, ErrorState, SkeletonHero, Skeleton } from '@/components/ui/misc';
import NotificationBell from '@/components/NotificationBell';
import PageTransition from '@/components/layout/PageTransition';
import { formatDate, sportLabel } from '@/lib/format';
import { accentStyle, cn } from '@/lib/utils';

function Tab({ to, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative shrink-0 whitespace-nowrap px-1 py-3 text-sm font-medium transition-colors',
          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        )
      }
    >
      {({ isActive }) => (
        <>
          {label}
          {isActive && (
            <motion.span
              layoutId="tab-underline"
              className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary"
            />
          )}
        </>
      )}
    </NavLink>
  );
}

export default function PublicTournamentLayout() {
  const { id } = useParams();
  const { data, isLoading, isError, refetch } = useTournament(id);
  const { liveStates } = useLiveTournament(id);
  useTournamentNotifications(id, { toast: true });
  const { data: liveFixtures } = useFixtures(id, { status: 'live' });
  useDocumentTitle(data?.tournament?.name);

  const onShare = async () => {
    const url = window.location.href;
    const title = data?.tournament?.name ?? 'Tournament';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      return; // user dismissed the share sheet
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  if (isLoading) {
    return (
      <div>
        <SkeletonHero />
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <ErrorState
          title="Couldn't load this tournament"
          description="There was a problem reaching the server. Please try again."
          onRetry={refetch}
        />
      </div>
    );
  }

  if (!data?.tournament) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <EmptyState
          icon={Trophy}
          title="Tournament not found"
          description="This tournament may have been removed or the link is incorrect."
          action={<Button asChild><Link to="/">Browse tournaments</Link></Button>}
        />
      </div>
    );
  }

  const t = data.tournament;
  const liveCount = liveFixtures?.length ?? 0;

  return (
    <div style={accentStyle(t.primaryColor)}>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border/60">
        <div
          className="absolute inset-0 bg-grid opacity-40"
          style={{
            background: t.bannerImage
              ? `linear-gradient(to top, hsl(var(--background)) 5%, transparent), url(${t.bannerImage}) center/cover`
              : undefined,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(900px circle at 15% -20%, rgb(var(--team-accent-rgb) / 0.25), transparent 60%)`,
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6">
          <nav className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link to="/" className="transition-colors hover:text-foreground">Tournaments</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="truncate font-medium text-foreground/80">{t.name}</span>
          </nav>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{sportLabel(t.sportType)}</Badge>
                <TournamentStatusBadge status={t.status} />
                {liveCount > 0 && (
                  <Link
                    to={`/t/${id}/fixtures`}
                    className="inline-flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/25"
                  >
                    <Radio className="h-3 w-3" />
                    {liveCount} live now
                  </Link>
                )}
              </div>
              <h1 className="mt-3 font-display text-5xl leading-none tracking-wide sm:text-7xl">
                {t.name}
              </h1>
              {t.description && (
                <p className="mt-3 max-w-2xl text-muted-foreground">{t.description}</p>
              )}
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                {(t.startDate || t.endDate) && (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(t.startDate)} – {formatDate(t.endDate)}
                  </span>
                )}
                {t.venues?.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {t.venues.join(', ')}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell linkTo={(fixtureId) => `/t/${id}/match/${fixtureId}`} />
              <Button variant="outline" size="sm" onClick={onShare}>
                <Share2 /> <span className="hidden sm:inline">Share</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-16 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto scrollbar-thin px-4 sm:px-6">
          <Tab to={`/t/${id}`} label="Overview" end />
          <Tab to={`/t/${id}/standings`} label="Standings" />
          <Tab to={`/t/${id}/fixtures`} label="Fixtures" />
          <Tab to={`/t/${id}/bracket`} label="Bracket" />
          <Tab to={`/t/${id}/leaderboards`} label="Leaderboards" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PageTransition>
          <Outlet context={{ tournament: t, stats: data.stats, liveStates, tournamentId: id }} />
        </PageTransition>
      </div>
    </div>
  );
}
