import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, Radio, Trophy, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, selectUnread } from '@/store/notifications';
import { fromNow } from '@/lib/format';
import { cn } from '@/lib/utils';

const KIND = {
  result: { Icon: Trophy, tint: 'text-primary' },
  live: { Icon: Radio, tint: 'text-destructive' },
};

/**
 * Header bell that surfaces the live tournament activity feed (results + matches
 * going live). Self-contained popover with click-outside / Escape handling;
 * opening the panel clears the unread badge. Pass `linkTo(fixtureId)` to make
 * each notice navigate somewhere on click.
 */
export default function NotificationBell({ linkTo }) {
  const items = useNotifications((s) => s.items);
  const unread = useNotifications(selectUnread);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const clear = useNotifications((s) => s.clear);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    markAllRead(); // viewing the feed clears the unread count
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, markAllRead]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <Button
        variant="outline"
        size="icon"
        className="relative shadow-[var(--shadow-soft)]"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-background bg-destructive px-1 text-[10px] font-bold leading-none text-white shadow-[var(--shadow-soft)]">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="surface-elevated-strong absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] max-w-[calc(100vw-1.5rem)] origin-top-right overflow-hidden rounded-2xl border border-border/80"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold">Activity</span>
              {items.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  aria-label="Clear all notifications"
                  className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Clear
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
                <Inbox className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="text-xs text-muted-foreground">Live matches and results show up here.</p>
              </div>
            ) : (
              <ul className="max-h-80 divide-y divide-border/60 overflow-y-auto scrollbar-thin">
                {items.map((n) => {
                  const { Icon, tint } = KIND[n.kind] ?? KIND.result;
                  const body = (
                    <div className={cn('flex gap-3 px-4 py-3 transition-colors hover:bg-secondary/65', !n.read && 'bg-primary/10')}>
                      <span className={cn('mt-0.5 shrink-0', tint)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{n.title}</p>
                        {n.detail && <p className="truncate text-xs text-muted-foreground">{n.detail}</p>}
                        <p className="mt-0.5 text-[11px] text-muted-foreground/70">{fromNow(n.ts)}</p>
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {linkTo && n.fixtureId ? (
                        <Link to={linkTo(n.fixtureId)} onClick={() => setOpen(false)}>
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
