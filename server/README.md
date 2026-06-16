# TourneyOps — API (server)

Express + MongoDB + Socket.io backend powering the configurable cricket/football
tournament engine.

## Run

```bash
cp .env.example .env     # configure Mongo URI + JWT secrets
npm install
npm run seed             # create the first super admin from SEED_ADMIN_* vars
npm run dev              # node --watch
```

## Architecture

```
src/
├── config/        env validation + Mongo connection
├── models/        Mongoose schemas (User, Tournament, Team, Player, Group,
│                  Fixture, Standing, KnockoutBracket) with indexes
├── middleware/    auth (JWT), RBAC, Zod validate, rate limit, error handler,
│                  tournament loaders/guards
├── validators/    (shared) — request schemas live in @tms/shared
├── services/      pure engines + persistence:
│                    roundRobin.js   — circle-method fixtures + byes
│                    standings.js    — points / NRR / goal-diff / tiebreakers
│                    knockout.js     — seeded cross-group bracket + byes
│                    standingsService.js / knockoutService.js — DB glue
├── controllers/   thin request handlers
├── routes/        REST routing (nested under /tournaments/:id)
├── socket/        Socket.io rooms + event helpers
└── index.js       HTTP + websocket bootstrap
```

### Key design choices

- **One engine, two sports.** Sport-specific behaviour is data-driven: the
  tournament's `sportType` + `pointsConfig` decide which result fields, stats,
  and tiebreakers apply. Engines branch on sport, not on hard-coded flows.
- **Pure engines.** Round-robin, standings (incl. NRR), and knockout seeding are
  side-effect-free functions — trivial to reason about and test.
- **Standings are derived, never incremented.** After every completed group
  match the affected group's standings are recomputed from scratch, so they can
  never drift out of sync.
- **Two-token auth.** Short-lived access token (Authorization header) + httpOnly
  refresh cookie with a `tokenVersion` for revocation.
- **Consistent envelope.** Success: `{ success, message, data }`. Error:
  `{ success: false, error: { message, details? } }`.

## Net Run Rate

`NRR = runsFor/oversFaced − runsAgainst/oversBowled`. Overs use cricket notation
(19.4 = 19 overs + 4 balls) converted to true decimals; if a side is bowled out,
its full allotted overs are used (ICC convention).

## API summary

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/auth/login` | public |
| POST | `/api/auth/refresh` | cookie |
| POST | `/api/auth/register` | super admin |
| POST | `/api/auth/logout` · `/logout-all` | — / token |
| GET  | `/api/auth/me` | token |
| GET/POST | `/api/tournaments` | public / manager |
| GET/PATCH/DELETE | `/api/tournaments/:id` | public / manager |
| PATCH | `/api/tournaments/:id/points-config` · `/status` | manager |
| POST | `/api/tournaments/:id/admins` | super admin |
| GET/POST/PATCH/DELETE | `/api/tournaments/:id/teams[/:teamId]` | public / manager |
| …/teams/:teamId/players[/:playerId] | roster CRUD | manager |
| GET/POST/PATCH/DELETE | `/api/tournaments/:id/groups[/:groupId]` | public / manager |
| POST | `/api/tournaments/:id/groups/auto-distribute` | manager |
| GET | `/api/tournaments/:id/fixtures` | public |
| POST | `/api/tournaments/:id/fixtures/generate-group-stage` | manager |
| PATCH | `/api/fixtures/:fixtureId` · `/result` · `/live-update` | manager |
| GET | `/api/tournaments/:id/standings` | public |
| POST | `/api/tournaments/:id/standings/recalculate` | manager |
| GET | `/api/tournaments/:id/knockouts` | public |
| POST | `/api/tournaments/:id/knockouts/generate` | manager |
| PATCH | `/api/tournaments/:id/knockouts/adjust` · `/lock` | manager |

## Realtime events (Socket.io)

Clients `joinTournament(id)` / `joinFixture(id)`. Server emits:
`fixture:liveUpdate`, `fixture:result`, `fixture:status`, `standings:update`,
`knockout:update`.
