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
import { cn } from '@/lib/utils';

function Brand({ onClick }) {
  return (
    <Link to="/" onClick={onClick} className="flex items-center gap-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
        <Trophy className="h-5 w-5 text-white" />
      </div>
      <span className="font-display text-2xl leading-none tracking-wide">TourneyOps</span>
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
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-8">
            <Brand />
            <nav className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
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
              className="hidden items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground sm:flex"
            >
              <Search className="h-4 w-4" /> Search
              <kbd className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px]">⌘K</kbd>
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

      <main className="flex-1">
        <PageTransition transitionKey={sectionKey}>
          <Outlet />
        </PageTransition>
      </main>

      <footer className="border-t border-border/60 py-8">
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
