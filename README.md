# TourneyOps — Tournament Management Platform

A configurable **cricket & football** tournament engine: group stages (round-robin
with NRR / goal-difference standings), seeded cross-group knockouts, live scoring
over websockets, and public leaderboards. Monorepo with an Express + MongoDB +
Socket.io API and a React 19 SPA, sharing domain constants and Zod schemas.

```
.
├── server/   Express + MongoDB + Socket.io API   (see server/README.md)
├── client/   React 19 + Vite SPA                  (see client/README.md)
└── shared/   @tms/shared — sport constants + Zod schemas (used by both)
```

## Prerequisites

- **Node.js 18+**
- **MongoDB** running locally (default `mongodb://127.0.0.1:27017/tournament_manager`)
  or a connection string in `server/.env`.

## Quick start

```bash
# 1. configure the API (Mongo URI, JWT secrets, seed credentials)
cp server/.env.example server/.env

# 2. install every workspace (root + server + client)
npm run install:all

# 3. seed the super admin + a full demo dataset
npm run seed          # creates the SEED_ADMIN_* super admin
npm run seed:demo     # creates a demo organiser + sample tournaments

# 4. run the API and SPA together
npm run dev
```

`npm run dev` launches both servers concurrently — API on
`http://localhost:5000`, SPA on `http://localhost:5173`.

> First time? `npm run setup` chains install → seed → seed:demo in one go.

## Sign-in credentials

Created by the seed scripts (override via the `SEED_*` vars in `server/.env`):

| Role | Email | Password | Created by |
| --- | --- | --- | --- |
| Super admin | `admin@tms.local` | `admin12345` | `npm run seed` |
| Demo organiser | `demo@tms.local` | `demo12345` | `npm run seed:demo` |

Super Admin uses a fixed configured password (`SEED_ADMIN_PASSWORD`) and cannot
change/reset it from the app. To rotate it, update `server/.env` and run
`npm run seed`.

## Demo data

`npm run seed:demo` is **idempotent** — every run wipes and recreates only the
demo organiser's tournaments (scoped by owner), so it never touches real data. It
builds the dataset by driving the real engines (round-robin → results →
`generateAndPersist` knockout → `recalculateTournament` cascade), so standings,
brackets, and player stats are always internally consistent. It seeds three
tournaments to exercise every UI state:

1. **Riverside Premier Cup** (football) — *completed*: two groups of four, full
   knockout with a third-place playoff, a champion, and a Player of the Tournament.
2. **Summer Sixes Trophy** (cricket) — *in progress*: most six-over group games
   played ball-by-ball (so batting/bowling leaderboards + NRR populate), the rest
   still scheduled.
3. **City Champions League** (football) — *setup*: teams and groups created, no
   fixtures yet (the onboarding/empty state).

## Common scripts (root)

| Command | What it does |
| --- | --- |
| `npm run install:all` | Install root, server, and client dependencies |
| `npm run dev` | Run API + SPA together (concurrently) |
| `npm run dev:server` / `npm run dev:client` | Run one side only |
| `npm run seed` / `npm run seed:demo` | Seed the super admin / demo dataset |
| `npm run setup` | install:all → seed → seed:demo |
| `npm test` | Run the server's engine test suite (Vitest) |
| `npm run build` | Production build of the SPA |

## Tests

The pure scoring/bracket engines (round-robin, standings + NRR, knockout seeding
and advancement, and the cricket/football derivation layer) are covered by a fast
Vitest suite:

```bash
npm test            # from the repo root (delegates to server)
```
