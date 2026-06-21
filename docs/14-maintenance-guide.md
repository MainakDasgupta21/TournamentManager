# 14 · Maintenance Guide

[← Development Guide](./13-development-guide.md) · [Back to index](./README.md) · Next: [Domain Glossary →](./15-domain-glossary.md)

---

This guide is for whoever keeps TourneyOps running: common troubleshooting scenarios,
known limitations, upgrade procedures, technical‑debt areas, and prioritised future
improvements.

---

## 14.1 Routine operations

| Task | How |
|------|-----|
| Rotate super‑admin password | Update `SEED_ADMIN_PASSWORD` (and `SYNC_SEED_ADMIN_PASSWORD=true`), restart / `npm run seed`. |
| Rotate JWT secrets | Change `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` → all sessions invalidated; users re‑login. |
| Approve organisers | Super admin → **Access requests** page (`PATCH /users/:id/approval`). |
| Rebuild derived data | `POST /tournaments/:id/recalculate` (per tournament). |
| Refresh demo data | `npm run seed:demo` (only touches the demo organiser's data). |
| Inspect activity | Per‑tournament **Audit Log** (`GET /tournaments/:id/audit-logs`). |
| Health check | `GET /api/health`. |

---

## 14.2 Common troubleshooting scenarios

### Auth & access
| Symptom | Cause | Resolution |
|---------|-------|-----------|
| Can't log in (valid creds) | Account `pending`/`rejected`/inactive | Super admin approves; `authenticate` blocks non‑approved users. |
| Logged out unexpectedly everywhere | `tokenVersion` bumped (password change/reset/logout‑all/reject) or JWT secret rotated | Re‑login. Expected behaviour. |
| 401 loop in the SPA | Refresh cookie missing/expired or `CLIENT_ORIGIN` mismatch (cookie not sent) | Verify HTTPS + `CLIENT_ORIGIN` exactly matches the SPA origin; check `tms_refresh` cookie. |
| Super admin can't reset password | By design — managed via env | Rotate `SEED_ADMIN_PASSWORD` + re‑seed. |
| Reset email never arrives | SMTP not configured | In dev it's logged to console; in prod set `SMTP_*`. |

### Data correctness
| Symptom | Cause | Resolution |
|---------|-------|-----------|
| Standings/leaderboards look wrong | Derived cache out of sync, or fixture not `completed` | `POST /tournaments/:id/recalculate`; confirm fixtures are completed. |
| Knockout shows wrong team | An earlier result was edited | Recalc → if it would reset a played match you'll get `requiresConfirm`; resend with `confirm:true`. |
| NRR looks off | Expecting overs‑faced, not allotted overs | ICC rule: a bowled‑out side uses **full allotted overs** for NRR (see [Testing](./12-testing.md#122-current-test-suite)). |
| Own goal credited to wrong team | Misunderstanding | Own goals are intentionally credited to the **opponent's** score. |
| Can't delete a team | It has fixtures | Clear/regenerate fixtures or the bracket first (409 is a guard). |

### Operational
| Symptom | Cause | Resolution |
|---------|-------|-----------|
| Server exits on boot | `env.js` validation failed (missing/weak secret in prod) | Provide required env vars. |
| Uploaded images disappear after deploy | Local‑disk storage on ephemeral PaaS disk | Configure Cloudinary (durable CDN). |
| Rate limits too strict/loose across instances | In‑memory limiter per process | Set `RATE_LIMIT_REDIS_URL` for shared limits. |
| Live updates not propagating across instances | No Socket.IO Redis adapter / no sticky sessions | Add the adapter + sticky sessions (see [Realtime](./09-realtime-and-live-scoring.md#97-scaling-realtime)). |
| Mongo connection warnings | Non‑local URI in non‑prod | Expected guard log; use a local/throwaway DB for dev. |

---

## 14.3 Known limitations

- **No automated migration framework.** Schema evolution relies on Mongoose defaults,
  `Mixed` result shapes, and idempotent seed/backfill scripts (see
  [Database → Migrations](./05-database.md#56-migration-strategy)).
- **No data retention/archival.** Tournaments and audit logs grow unbounded; there is no
  TTL or archival job.
- **Single‑process realtime & rate limiting by default.** Multi‑instance needs Redis
  (adapter + limit store) and sticky sessions.
- **Local‑disk uploads are ephemeral** on most PaaS — Cloudinary is effectively required in
  production.
- **No integration/E2E tests yet** — only pure‑engine unit tests (see
  [Testing roadmap](./12-testing.md#126-recommended-test-roadmap)).
- **Two sports only** (cricket, football); adding a sport touches `shared` constants,
  `matchDerive`, `standings`, and the scoring consoles.
- **Super‑admin credential is config‑managed**, not self‑service — intentional, but means
  password ops require a deploy/seed.
- **No background jobs** — all work is synchronous within requests (bulk operations could
  block).
- **Audit log has no UI export/retention controls** beyond pagination.

---

## 14.4 Upgrade procedures

### Dependencies
```bash
npm --prefix server outdated && npm --prefix client outdated
npm audit --prefix server && npm audit --prefix client
```
- Upgrade in a branch; run `npm test` + `npm --prefix client run build` before merging.
- **Watch points:** Express 4→5, Mongoose major versions (query/index behaviour), React 19
  (already current), Tailwind v4 (CSS‑first config), Zod majors (schema API). Bump one
  major dependency at a time.

### Node runtime
Target Node 20 LTS+. When moving major Node versions, re‑run the full test suite and a
manual smoke test; the app uses native ESM + `node --watch`.

### Database
- Index changes: prefer building new indexes **before** deploying code that depends on them
  (avoid foreground build stalls on large collections).
- For destructive schema changes, write an idempotent one‑off script under
  `server/src/scripts/`, run per environment, then recalc derived data.

### Application releases
1. Merge after CI (tests + client build) passes.
2. Deploy API; run `npm run seed` (idempotent) if super‑admin/legacy backfill is needed.
3. Build + publish the client (`client/dist`).
4. Smoke‑test `GET /api/health` and a login.

---

## 14.5 Technical‑debt areas

| Area | Debt | Suggested direction |
|------|------|---------------------|
| Testing | No integration/E2E/client tests | Add `mongodb-memory-server` + `supertest` API tests; Playwright happy‑path. |
| Migrations | Ad‑hoc scripts | Adopt a lightweight migration runner if schema churn increases. |
| Observability | Dev‑only logging, no error tracking | Structured logs (pino) + Sentry + uptime monitoring. |
| Scale‑out | Single‑process assumptions | Socket.IO Redis adapter, shared rate‑limit store, sticky sessions documented but not wired. |
| Result shape | `Mixed` fields (flexible but unvalidated at the DB layer) | Rely on Zod at the edge (already done); consider discriminated sub‑schemas if it grows. |
| Retention | Unbounded growth | TTL/archival policy for old tournaments + audit logs. |
| Background work | Synchronous recompute in request | Introduce a queue (BullMQ on Redis) for heavy/bulk operations. |
| Config drift | Super‑admin via env | Acceptable, but document rotation runbook (done here). |

---

## 14.6 Future improvement opportunities

- **More sports / formats** — generalise the data‑driven config (the architecture already
  supports it via `shared` constants + derivation).
- **Background job queue** — BullMQ on the existing optional Redis for bulk emails,
  exports, scheduled status transitions.
- **Public API / webhooks** — let external scoreboards subscribe to results.
- **Richer analytics** — historical cross‑tournament player stats, partnership/manhattan
  exports beyond the current charts.
- **Internationalisation** — externalise UI strings.
- **Fine‑grained collaborator roles** — e.g. scorer‑only vs full manager.
- **Offline‑tolerant scoring console** — queue events locally and sync (useful for poor
  venue connectivity).
- **Automated backups verification** — periodic restore drills.

---

## 14.7 Operational runbook quick reference

```text
Health:            GET /api/health
Rebuild a tourney: POST /api/tournaments/:id/recalculate  { confirm: true if prompted }
Re-seed admin:     npm run seed
Refresh demo:      npm run seed:demo
Revoke a user:     super admin → reject (bumps tokenVersion) or rotate JWT secrets (all users)
Inspect changes:   GET /api/tournaments/:id/audit-logs
Restore data:      restore MongoDB backup → recalc affected tournaments
```

See [DevOps & Infrastructure → Disaster recovery](./11-devops-and-infrastructure.md#118-disaster-recovery)
for the full recovery procedure.

---

## 14.8 Keeping documentation current

Documentation drift is treated as a bug. When you change the system, update the matching
document **in the same pull request**:

| If you change… | Update… |
|----------------|---------|
| A Mongoose model / field / index | [Database](./05-database.md) + [Glossary](./15-domain-glossary.md) |
| An endpoint, schema, or validation rule | [API Reference](./06-api-reference.md) (+ the Zod schema in `shared/`) |
| A pure engine / service / middleware | [Backend](./07-backend.md) and, if behaviour changes, [System Design](./03-system-design.md) |
| A socket event or live‑scoring flow | [Realtime & Live Scoring](./09-realtime-and-live-scoring.md) |
| Auth / roles / security controls | [Security](./10-security.md) |
| An environment variable / deploy step | [DevOps & Infrastructure](./11-devops-and-infrastructure.md) + `server/.env.example` |
| A client route / store / major component | [Frontend](./08-frontend.md) |
| Domain vocabulary | [Domain Glossary](./15-domain-glossary.md) |

**Review checklist for docs:** headings keep their numbered prefix (anchors depend on it),
cross‑links resolve, Mermaid renders, and any new env var/credential is reflected in both
the doc and `.env.example`. A quick way to catch broken intra‑doc links is to search for
`.md#` and confirm each fragment matches a heading slug.
