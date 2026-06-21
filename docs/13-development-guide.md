# 13 · Development Guide

[← Testing](./12-testing.md) · [Back to index](./README.md) · Next: [Maintenance Guide →](./14-maintenance-guide.md)

---

Everything you need to run TourneyOps locally, understand the dev workflow, debug
effectively, and contribute changes. If you read only one doc before coding, read this one
plus [Code Structure](./04-code-structure.md).

---

## 13.1 Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | **20 LTS+** | The app uses native ESM and `node --watch`. |
| npm | 9+ (ships with Node 20) | Workspaces linked via `file:` deps. |
| MongoDB | 6.x / 7.x | Local `mongod` or Docker, or a throwaway Atlas DB. **Never point dev at production.** |
| Git | any | |

Optional (only if you exercise those integrations locally): Redis, a Cloudinary account,
an SMTP server. Without them the app uses in‑memory rate limiting, local‑disk uploads, and
console email — all flows still work.

---

## 13.2 First‑time setup

```bash
# 1. Clone
git clone <repo-url> TournamentManager
cd TournamentManager

# 2. Configure the server environment
#    Copy the template and adjust as needed (defaults work for local dev).
cp server/.env.example server/.env       # PowerShell: Copy-Item server\.env.example server\.env

# 3. Start MongoDB (one option)
#    - local service: mongod
#    - docker:        docker run -d -p 27017:27017 --name tms-mongo mongo:7

# 4. Install everything, seed the super admin + demo data
npm run setup
```

`npm run setup` = `install:all` + `seed` + `seed:demo`. After it completes you have:
- A **super admin**: `admin@tms.local` / `admin12345` (from `SEED_ADMIN_*`).
- A **demo organiser**: `demo@tms.local` / `demo12345` owning three sample tournaments.

> Change these credentials in `server/.env` before seeding if you prefer. The super‑admin
> password is **only** changeable via env + re‑seed (not via the UI).

---

## 13.3 Running locally

```bash
npm run dev          # API (http://localhost:5000) + Vite SPA (http://localhost:5173)
```

- The Vite dev server **proxies** `/api`, `/uploads`, and `/socket.io` to the API
  (`client/vite.config.js`), so the browser talks to a single origin — cookies and CORS
  "just work" in dev.
- Run halves separately if needed: `npm run dev:server` / `npm run dev:client`.
- API auto‑reloads via `node --watch`; the client hot‑reloads via Vite HMR.

Open `http://localhost:5173`, click through public pages, and sign in at `/login`.

---

## 13.4 Environment variables (dev)

The committed defaults in `server/.env.example` are tuned for local development:
- `MONGODB_URI` → local DB.
- `JWT_*` → placeholder secrets (fine for dev; **required & validated** in prod).
- `SMTP_HOST` blank → emails print to the **server console** (password reset still works
  end‑to‑end — copy the link from the log).
- `CLOUDINARY_*` blank → uploads go to `server/uploads/` and are served at `/uploads`.
- `RATE_LIMIT_REDIS_URL` blank → in‑memory rate limiting.

Full table: [DevOps → Environment configuration](./11-devops-and-infrastructure.md#112-environment-configuration).

---

## 13.5 Project workflow & conventions

- **Monorepo packages:** `shared` (constants + Zod), `server` (API), `client` (SPA). Both
  server and client import `@tms/shared`. If you change `shared`, both consumers pick it up
  via the `file:` link (restart dev if module resolution caches).
- **Domain constants & enums live in `shared/src/constants.js`** — add new sports
  config/positions/tiebreakers there, never hard‑code them in server or client.
- **Validation lives in `shared/src/schemas/`** — when you add/modify an endpoint, update
  (or add) the Zod schema and wire it through `validate(schema)`.
- **Pure vs shell:** put algorithms in pure engine modules (no DB), and DB/orchestration in
  `*Service.js`/controllers. This keeps logic testable. See
  [Backend](./07-backend.md#71-service-architecture).
- **Source of truth:** never write derived collections (standings/stats/bracket
  advancement) by hand — change the result and let the recalc cascade rebuild them.
- **Response envelope:** return via `ApiResponse.sendSuccess/sendCreated`; throw `ApiError`
  for failures (don't hand‑roll error JSON).
- **Code style:** ES modules, async/await, guard clauses, no narrating comments (comment
  *why*, not *what*). Match existing patterns in the file you're editing.

### Adding a new API endpoint (recipe)
1. Add/extend a Zod schema in `shared/src/schemas/…` and export it.
2. Add a controller handler in `server/src/controllers/…` wrapped in `asyncHandler`.
3. Register the route with the right middleware chain
   (`authenticate` → `loadTournament` → `requireTournamentManager` → `validate(schema)`).
4. Emit socket events if it changes shared state; record an audit log if it's an admin
   mutation.
5. Add a `qk` key + hook in `client/src/hooks/queries.js`; invalidate on mutation.
6. Unit‑test any new pure logic; smoke‑test the flow.

---

## 13.6 Debugging workflows

### Server
- **Logs:** `morgan('dev')` prints requests in development; `errorHandler` logs server
  errors with stack traces (dev only).
- **Inspector:** run with the Node inspector and attach from VS Code:
  ```bash
  node --watch --inspect server/src/index.js
  ```
  Then use a "Node: Attach" debug config (port 9229). Set breakpoints in
  controllers/services.
- **DB inspection:** use `mongosh` or MongoDB Compass against `MONGODB_URI` to inspect
  collections. Remember standings/stats are derived — if they look wrong, check fixtures
  first, then run `POST /tournaments/:id/recalculate`.
- **Auth issues:** a 401 loop usually means a `tokenVersion` mismatch (you bumped it via
  logout‑all/password change) — log in again. Check the `tms_refresh` cookie exists and is
  scoped to `/api/auth`.

### Client
- **React DevTools** + **TanStack Query Devtools** (inspect cache, see which keys are
  stale/invalidated).
- **Network tab:** watch the `/auth/refresh` retry on 401 (the single‑flight interceptor).
- **Realtime:** in the console, the singleton socket logs connect/disconnect; join events
  are emitted by `useLiveTournament`. Open two tabs to watch live updates propagate.
- **`ErrorBoundary`** surfaces render errors; check the console for the component stack.

### Common dev gotchas
| Symptom | Likely cause / fix |
|---------|--------------------|
| `env.js` throws on start | Missing required var in non‑dev `NODE_ENV`; set secrets or use `NODE_ENV=development`. |
| CORS / cookie errors | `CLIENT_ORIGIN` doesn't include your frontend origin; in dev, use the Vite proxy (same origin). |
| Uploads 404 after restart | Local‑disk uploads are fine in dev; for parity with prod, set Cloudinary. |
| Standings not updating | You edited a derived collection directly, or forgot the fixture wasn't `completed`; recalc. |
| `@tms/shared` change not picked up | Restart the dev process so the `file:` link re‑resolves. |
| Knockout won't regenerate | Bracket is `locked` (409) — unlock requires regenerating with an unlocked bracket. |

---

## 13.7 Contribution guidelines

- **Branch** off the default branch; keep changes focused.
- **Before committing:** run `npm test` and `npm --prefix client run build` (catches
  schema/engine regressions and broken imports).
- **Commits:** clear, imperative messages describing the *why*. Don't commit `node_modules`,
  `.env`, or build output (already in `.gitignore`).
- **Touching the API contract?** Update the Zod schema, the controller, the client hook,
  **and** [API Reference](./06-api-reference.md) together so docs stay accurate.
- **Touching the domain model?** Update `shared/src/constants.js`, the Mongoose model,
  [Database](./05-database.md), and [Glossary](./15-domain-glossary.md).
- **New pure logic** must come with Vitest tests.
- **Keep secrets out of the repo**; never log tokens/passwords.

---

## 13.8 Useful commands cheat‑sheet

```bash
npm run setup           # install + seed + demo (first time)
npm run dev             # run API + client
npm run dev:server      # API only
npm run dev:client      # client only
npm run build           # build SPA (client/dist)
npm start               # run API (production mode)
npm run seed            # ensure super admin / backfill
npm run seed:demo       # refresh demo tournaments
npm test                # server unit tests (Vitest)
npm --prefix server run test:watch   # TDD loop
```
