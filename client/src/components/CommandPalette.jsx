import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Search,
  Trophy,
  Home,
  LayoutDashboard,
  LogIn,
  CornerDownLeft,
  ShieldCheck,
  UserCog,
} from 'lucide-react';
import { useTournaments } from '@/hooks/queries';
import { useAuth } from '@/store/auth';
import { sportLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Open the palette from anywhere (e.g. a header search button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event('open-command-palette'));
}

/**
 * Global Cmd/Ctrl+K command palette: fuzzy-jump to tournaments and key pages.
 * Mounted once per layout; listens for the hotkey and a custom open event.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const authed = useAuth((s) => s.status === 'authenticated');
  const role = useAuth((s) => s.user?.role);
  const isSuperAdmin = role === 'superadmin';
  const { data: tournaments } = useTournaments({ limit: 100, sort: 'name' });
  const listRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = [
      { key: 'home', label: 'All tournaments', sub: 'Home', icon: Home, run: () => navigate('/') },
    ];
    if (authed) {
      pages.push({
        key: 'admin',
        label: 'Admin dashboard',
        sub: 'Manage tournaments',
        icon: LayoutDashboard,
        run: () => navigate('/admin'),
      });
      if (isSuperAdmin) {
        pages.push(
          {
            key: 'users',
            label: 'User requests',
            sub: 'Super admin',
            icon: ShieldCheck,
            run: () => navigate('/admin/users'),
          },
          {
            key: 'tournament-access',
            label: 'Tournament access',
            sub: 'Super admin',
            icon: UserCog,
            run: () => navigate('/admin/tournament-access'),
          }
        );
      }
    } else {
      pages.push({
        key: 'login',
        label: 'Admin sign in',
        sub: 'Organisers',
        icon: LogIn,
        run: () => navigate('/login'),
      });
    }
    const filteredPages = pages.filter((p) => !q || p.label.toLowerCase().includes(q));

    const matches = (tournaments ?? [])
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((t) => ({
        key: `t-${t._id}`,
        label: t.name,
        sub: sportLabel(t.sportType),
        icon: Trophy,
        run: () => navigate(`/t/${t._id}`),
      }));

    return [...filteredPages, ...matches];
  }, [query, tournaments, authed, isSuperAdmin, navigate]);

  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, results.length - 1)));
  }, [results.length]);

  const select = (item) => {
    if (!item) return;
    setOpen(false);
    item.run();
  };

  const onInputKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[active]);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="surface-elevated-strong fixed left-1/2 top-[12vh] z-50 flex max-h-[min(80vh,calc(100dvh-6rem))] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-border/80 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2"
          onOpenAutoFocus={(e) => {
            // Let the search input keep focus; default would focus the content.
            e.preventDefault();
          }}
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-card/85 px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              aria-label="Search commands and tournaments"
              placeholder="Search tournaments or jump to…"
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/90"
            />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto scrollbar-thin p-2">
            {results.length ? (
              results.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => select(item)}
                    onMouseMove={() => setActive(i)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm transition-colors',
                      i === active
                        ? 'border-primary/35 bg-primary/12 text-foreground'
                        : 'text-muted-foreground hover:border-border/70 hover:bg-secondary/60'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate font-medium text-foreground">{item.label}</span>
                    <span className="truncate text-xs text-muted-foreground">{item.sub}</span>
                    {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No results</p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
