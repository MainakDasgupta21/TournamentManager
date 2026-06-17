import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Trophy, LogOut, ExternalLink, ShieldCheck, Search, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/store/auth';
import { useUsers } from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import PageTransition from '@/components/layout/PageTransition';
import CommandPalette, { openCommandPalette } from '@/components/CommandPalette';
import ThemeToggle from '@/components/ThemeToggle';
import { shortcutModifier } from '@/lib/utils';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Pending-request badge for the maintainer; skipped for organisers.
  const { data: pendingData } = useUsers(
    { status: 'pending' },
    { enabled: isSuperAdmin, refetchInterval: 60_000 }
  );
  const pendingCount = pendingData?.pendingCount ?? 0;

  // Keep the chrome mounted across a tournament's admin sections.
  const sectionKey = pathname.startsWith('/admin/t/')
    ? `/admin/t/${pathname.split('/')[3] ?? ''}`
    : pathname;

  const onLogout = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-x-0 top-[-16rem] z-0 h-[30rem] bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.22),transparent_62%)]" />
      <header className="sticky top-0 z-40 border-b border-border/65 bg-background/78 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/admin" className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-primary via-primary/90 to-accent shadow-[var(--shadow-soft)]">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0 leading-none">
              <span className="truncate font-display text-2xl tracking-[-0.02em] text-gradient-brand">TourneyOps</span>
              <span className="ml-2 hidden align-middle text-xs text-muted-foreground sm:inline">Admin</span>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Tooltip label={`Search (${shortcutModifier()}K)`}>
              <Button variant="ghost" size="icon" onClick={openCommandPalette} aria-label="Search">
                <Search />
              </Button>
            </Tooltip>
            <ThemeToggle />
            {isSuperAdmin && (
              <Button asChild variant="ghost" size="sm" className="relative">
                <Link to="/admin/users">
                  <ShieldCheck /> <span className="hidden sm:inline">Access requests</span>
                  {pendingCount > 0 && (
                    <Badge variant="warning" className="ml-0.5 px-1.5 py-0">
                      {pendingCount}
                    </Badge>
                  )}
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/" target="_blank"><ExternalLink /> Public site</Link>
            </Button>
            <Tooltip label="Account & password">
              <Button asChild variant="ghost" size="icon" className="sm:hidden" aria-label="Account">
                <Link to="/admin/account"><KeyRound /></Link>
              </Button>
            </Tooltip>
            <Tooltip label="Account & password">
              <Link
                to="/admin/account"
                className="hidden rounded-xl border border-transparent px-2 py-1 text-right transition-colors hover:border-border/70 hover:bg-secondary/60 sm:block"
              >
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <Badge variant="secondary" className="mt-0.5">
                  {user?.role === 'superadmin' ? 'Super Admin' : 'Tournament Admin'}
                </Badge>
              </Link>
            </Tooltip>
            <Button variant="outline" size="sm" onClick={onLogout} aria-label="Sign out">
              <LogOut /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <PageTransition transitionKey={sectionKey}>
          <Outlet />
        </PageTransition>
      </main>
      <CommandPalette />
    </div>
  );
}
