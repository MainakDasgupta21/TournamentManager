import { create } from 'zustand';

/**
 * Ephemeral, per-tournament activity feed populated from live Socket.io events
 * (results + matches going live). Scoped to the tournament currently being
 * viewed: switching tournaments resets the feed so notices never bleed across
 * competitions. State is session-only by design (it mirrors a live stream, not
 * a durable inbox).
 */
const MAX_ITEMS = 50;
const DEDUPE_WINDOW_MS = 3000;
let seq = 0;

export const useNotifications = create((set, get) => ({
  tournamentId: null,
  items: [], // newest first

  /** Point the feed at a tournament, clearing it when the context changes. */
  setContext: (tournamentId) => {
    if (get().tournamentId === tournamentId) return;
    set({ tournamentId, items: [] });
  },

  add: (notice) =>
    set((state) => {
      const now = Date.now();
      const last = state.items[0];
      // Drop accidental rapid repeats (same event for the same fixture).
      if (
        last &&
        last.kind === notice.kind &&
        last.fixtureId === notice.fixtureId &&
        now - last.ts < DEDUPE_WINDOW_MS
      ) {
        return state;
      }
      seq += 1;
      const item = { id: `${now}-${seq}`, ts: now, read: false, ...notice };
      return { items: [item, ...state.items].slice(0, MAX_ITEMS) };
    }),

  markAllRead: () =>
    set((state) => ({
      items: state.items.some((i) => !i.read)
        ? state.items.map((i) => (i.read ? i : { ...i, read: true }))
        : state.items,
    })),

  clear: () => set({ items: [] }),
}));

/** Selector: number of unread notices (use with useNotifications(selectUnread)). */
export const selectUnread = (state) => state.items.reduce((n, i) => n + (i.read ? 0 : 1), 0);
