# TourneyOps — Web app (client)

React 19 + Vite SPA. Broadcast-quality dark UI for public viewers and admins.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (proxies /api + websockets to :5000)
npm run build
```

## Stack

- **React 19 + Vite** (JSX)
- **Tailwind CSS v4** — CSS-first theme tokens in `src/index.css` (no JS config)
- **shadcn/ui-style** primitives (Radix + CVA + tailwind-merge) in `components/ui`
- **TanStack Query** for all server state (`hooks/queries.js`)
- **Zustand** for the auth session (`store/auth.js`)
- **Socket.io client** wired into the query cache (`hooks/useLiveTournament.js`)
- **Framer Motion** for standings/bracket/tab transitions

## Structure

```
src/
├── components/
│   ├── ui/            base primitives (button, card, dialog, select, …)
│   ├── layout/        PublicLayout + nav
│   ├── admin/         TournamentForm, ResultEntryDialog, LiveDialog
│   ├── StandingsTable.jsx · FixtureItem.jsx · LiveTicker.jsx · Bracket.jsx
├── hooks/             queries.js (TanStack) + useLiveTournament.js (sockets)
├── lib/               api (axios + refresh), socket, queryClient, format, utils
├── store/             auth (Zustand)
├── pages/
│   ├── public/        Home, TournamentHub, Standings, Fixtures, Bracket, Team
│   └── admin/         Login, Dashboard, NewTournament, + tournament-scoped tabs
└── App.jsx            routing
```

## Auth flow

The access token lives in memory; on load the app calls `/auth/refresh` (httpOnly
cookie) to silently restore the session. A 401 triggers a one-shot refresh +
request replay via the axios interceptor.

## Notes

- The public side requires no login. Admin routes are gated by `ProtectedRoute`.
- Live updates: any open tournament page joins its socket room, so standings,
  tickers, and brackets refresh without a reload when an admin enters results.
- Default seeded admin: `admin@tms.local` / `admin12345`.
