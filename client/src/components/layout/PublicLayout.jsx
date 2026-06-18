import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Trophy, LayoutDashboard, LogIn, Search, Menu } from 'lucide-react';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import PageTransition from '@/components/layout/PageTransition';
import CommandPalette, { openCommandPalette } from '@/components/CommandPalette';
import ThemeToggle from '@/components/ThemeToggle';
import { cn, shortcutModifier } from '@/lib/utils';

function Brand({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-br from-primary via-primary/90 to-accent shadow-[var(--shadow-soft)]">
        <Trophy className="h-5 w-5 text-white" />
      </div>
      <span className="font-display text-xl leading-none tracking-[-0.02em] text-gradient-brand sm:text-2xl">TourneyOps</span>
    </Link>
  );
}

const navItems = [{ to: '/', label: 'Tournaments', end: true }];

export default function PublicLayout() {
  const { status } = useAuth();
  const { pathname } = useLocation();
  const authed = status === 'authenticated';
  const [menuOpen, setMenuOpen] = useState(false);

  // Group all routes within a single tournament under one key so switching
  // tabs keeps the hero + tab bar mounted (the inner Outlet handles that fade).
  const sectionKey = pathname.startsWith('/t/')
    ? `/t/${pathname.split('/')[2] ?? ''}`
    : pathname;

  return (
    <div className="relative flex min-h-screen flex-col">
      <a
        href="#public-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-[var(--shadow-soft)]"
      >
        Skip to main content
      </a>
      <div className="pointer-events-none fixed inset-x-0 top-[-18rem] z-0 h-[32rem] bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.2),transparent_62%)]" />
      <header className="sticky top-0 z-40 border-b border-border/65 bg-background/78 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-4 lg:gap-8">
            <Brand />
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-xl border border-transparent px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      isActive
                        ? 'border-primary/35 bg-primary/12 text-foreground'
                        : 'text-muted-foreground hover:border-border/65 hover:bg-secondary/50 hover:text-foreground'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Desktop search pill */}
            <button
              type="button"
              onClick={openCommandPalette}
              aria-label="Search tournaments and pages"
              className="hidden items-center gap-2 rounded-xl border border-border/70 bg-card/55 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/35 hover:bg-secondary/65 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex"
            >
              <Search className="h-4 w-4" /> Search
              <kbd className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px]">{shortcutModifier()}K</kbd>
            </button>
            {/* Mobile search icon */}
            <Button variant="ghost" size="icon" className="sm:hidden" onClick={openCommandPalette} aria-label="Search">
              <Search />
            </Button>

            <ThemeToggle />

            <Button asChild variant={authed ? 'secondary' : 'default'} size="sm" className="hidden sm:inline-flex">
              <Link to={authed ? '/admin' : '/login'}>
                {authed ? <LayoutDashboard /> : <LogIn />}
                {authed ? 'Dashboard' : 'Admin sign in'}
              </Link>
            </Button>

            {/* Mobile menu */}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(true)} aria-label="Menu">
              <Menu />
            </Button>
          </div>
        </div>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="max-w-xs">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            {navItems.map((item) => (
              <SheetClose asChild key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </SheetClose>
            ))}
            <SheetClose asChild>
              <Button asChild variant={authed ? 'secondary' : 'default'} className="mt-2 w-full justify-start">
                <Link to={authed ? '/admin' : '/login'}>
                  {authed ? <LayoutDashboard /> : <LogIn />}
                  {authed ? 'Dashboard' : 'Admin sign in'}
                </Link>
              </Button>
            </SheetClose>
          </nav>
        </SheetContent>
      </Sheet>

      <main id="public-main-content" className="relative z-10 flex-1">
        <PageTransition transitionKey={sectionKey}>
          <Outlet />
        </PageTransition>
      </main>

      <footer className="relative z-10 mt-8 border-t border-border/65 bg-background/70 py-8 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span>© {new Date().getFullYear()} TourneyOps — Universal Tournament Platform</span>
          </div>
          <span className="text-xs">Cricket &amp; Football · Live scores · Standings · Brackets</span>
        </div>
      </footer>

      <CommandPalette />
    </div>
  );
}
