# 15 · Domain Glossary

[← Maintenance Guide](./14-maintenance-guide.md) · [Back to index](./README.md)

---

A reference for the domain and technical vocabulary used across TourneyOps and this
documentation. Terms are grouped by area; cross‑links point to where each concept is used.

---

## 15.1 Roles & accounts

| Term | Meaning |
|------|---------|
| **Super admin** | Platform maintainer (`role: superadmin`). Manages users, reviews access requests, can act on any tournament. Credentials are config‑managed (`SEED_ADMIN_*`), not self‑service. |
| **Tournament admin / Organiser** | `role: tournamentadmin`. Creates and runs tournaments. |
| **Owner** | The organiser who *created* a tournament (`createdBy`). Can manage **and delete** it. |
| **Collaborator** | An organiser added to a tournament's `admins`. Can manage but **not delete**. |
| **Approval status** | `pending` / `approved` / `rejected`. Self‑signups start `pending` and cannot use the console until approved. |
| **Access request** | An organiser's request for collaborator access to a tournament, reviewed by a super admin. |
| **Token version (`tokenVersion` / `tv`)** | Per‑user counter embedded in JWTs; bumping it revokes all outstanding tokens. |

## 15.2 Competition structure

| Term | Meaning |
|------|---------|
| **Tournament** | Top‑level competition for one sport (cricket or football) with its own teams, groups, fixtures, standings, and bracket. |
| **Sport type** | `cricket` or `football`; immutable after creation; drives data‑driven behaviour everywhere. |
| **Group** | A pool of teams that play a round‑robin; a tournament can have one or many groups. |
| **Team** | A competitor in a tournament, identified by name + unique `shortCode`, optionally in a group, optionally seeded. |
| **Player** | A team member with a sport‑specific `role`/position, a manual `category`, and cached `stats`. |
| **Seed** | A team's strength rank used for group distribution and bracket placement (lower = stronger). |
| **Qualifier** | A team that advances from the group stage into the knockout (e.g. "A1" = group A, 1st). |
| **Stage** | `group` or `knockout`. |
| **Status (tournament)** | `setup` → `groupStage` → `knockoutStage` → `completed`. |

## 15.3 Matches & scoring

| Term | Meaning |
|------|---------|
| **Fixture** | A scheduled match between two teams. **The source of truth** for all derived data. |
| **Result** | The sport‑specific outcome object stored on a fixture (`result`), validated by Zod on write. |
| **Live state** | A lightweight in‑progress snapshot (`liveState`) broadcast over sockets during live scoring. |
| **Event** | A granular scoring action (cricket ball/over; football goal/card/substitution) edited via `/events`; events are the source, aggregates are derived. |
| **Bye** | A knockout slot with no opponent; auto‑advances/auto‑completes. |
| **Bonus point** | Optional extra standings point from a configurable rule (`pointsConfig.bonusPointRule`). |
| **Man/Player of the Match** | Per‑fixture award (`result.manOfTheMatch`). |
| **Player of the Tournament (POTM)** | Tournament‑level award (`playerOfTournament`). |

### Cricket terms
| Term | Meaning |
|------|---------|
| **Innings** | One team's batting turn; a limited‑overs match has up to two. |
| **Over** | Six legal deliveries; written "X.Y" where Y is balls (e.g. 19.4 = 19 overs + 4 balls). |
| **`oversToDecimal`** | Converts over notation to true decimal for NRR (19.4 → 19.667). |
| **Net Run Rate (NRR)** | (runs scored / overs faced) − (runs conceded / overs bowled). A **bowled‑out** side uses **full allotted overs**, not overs actually faced (ICC rule). |
| **No‑result** | An abandoned cricket match; both teams share `noResult` points. |
| **Tie** | Equal scores; treated as a shared draw in standings; resolved by **Super Over** in knockouts. |
| **Super Over** | Tiebreaker mini‑innings deciding a tied knockout cricket match. |

### Football terms
| Term | Meaning |
|------|---------|
| **Goal** | A scoring event; `type: ownGoal` is credited to the **opponent's** score. |
| **Goal difference (GD)** | `goalsFor − goalsAgainst`; primary football tiebreaker. |
| **Clean sheet** | A match where a team/keeper conceded no goals. |
| **Card** | Disciplinary event (`yellow`/`red`); feeds the Fair Play leaderboard (yellow=1, red=3). |
| **Formation** | A tactical layout (preset + 11 pitch slots + bench); requires a 26‑player squad. |
| **Penalties (shootout)** | Tiebreaker deciding a drawn knockout football match. |
| **Extra time** | Additional period before penalties in knockouts. |

## 15.4 Derived data & engines

| Term | Meaning |
|------|---------|
| **Standing** | A denormalised group‑table row per `(tournament, group, team)`: P/W/D/L, points, NRR or GD, rank. Derived. |
| **Leaderboard** | Ranked player lists per sport (most runs, top scorers, golden glove, etc.), computed from cached player stats. |
| **Knockout bracket** | The elimination tree (`rounds` → `matchups`), single‑elimination or playoff. Derived via advancement. |
| **Advancement** | Moving a winner (and playoff loser) into the next matchup after a result. |
| **Tiebreaker order** | Ordered list deciding equal‑points teams (cricket: NRR/H2H/totalWins; football: GD/goalsScored/H2H). |
| **Head‑to‑head (H2H)** | Tiebreak using only matches between the tied teams. |
| **Recalculation cascade** | The idempotent rebuild of all derived data from fixtures (`recalcService.recalculateTournament`). |
| **Clear‑then‑replay** | Bracket reconciliation that re‑simulates advancement; if it would overwrite an already‑played match it requires confirmation. |
| **`requiresConfirm` / `affected`** | Response signalling a destructive downstream knockout reset; resend with `confirm:true` to apply. |
| **Pure engine** | A side‑effect‑free module (`roundRobin`, `standings`, `knockout`, `matchDerive`) holding the algorithms. |
| **Round‑robin (circle method)** | Scheduling algorithm where every team plays every other; rotate teams around a fixed point. |
| **Snake draft** | Auto‑distribution order (1‑2‑3‑3‑2‑1…) used to balance seeded teams across groups. |

## 15.5 Platform & technical

| Term | Meaning |
|------|---------|
| **`@tms/shared`** | Shared package of domain constants + Zod schemas imported by both server and client. |
| **Response envelope** | Standard API JSON: `{ success, message, data }` or `{ success:false, error }`. |
| **`ApiError` / `ApiResponse`** | Server utilities for consistent errors / success responses. |
| **`asyncHandler`** | Wrapper forwarding async errors to the central error handler. |
| **Access token** | Short‑lived JWT (Bearer header), kept in memory. |
| **Refresh token** | Long‑lived JWT in an httpOnly cookie (`tms_refresh`), exchanged at `/auth/refresh`. |
| **Silent refresh** | The Axios interceptor swapping an expired access token for a fresh one on 401. |
| **Optional dependency / adapter** | Cloudinary, Redis, SMTP — each with a built‑in fallback (disk, in‑memory, console). |
| **Room (Socket.IO)** | A broadcast channel (`tournament:<id>`, `fixture:<id>`) clients join to receive scoped updates. |
| **Query key (`qk`)** | A TanStack Query cache key identifying a piece of server state for caching/invalidation. |
| **Invalidation** | Marking cached queries stale so they refetch (triggered by mutations and realtime events). |
| **Audit log** | Append‑only record of admin edits with before/after snapshots and actor. |
| **Seed / demo seed** | Scripts ensuring the super admin (`seed`) and sample tournaments (`seed:demo`). |
| **Source of truth** | The authoritative data (fixtures + authored entities); everything else is re‑derivable. |

---

## 15.6 Abbreviations

| Abbr. | Expansion |
|-------|-----------|
| **NRR** | Net Run Rate |
| **GD** | Goal Difference |
| **H2H** | Head‑to‑head |
| **POTM** | Player of the Tournament |
| **RBAC** | Role‑Based Access Control |
| **JWT** | JSON Web Token |
| **SPA** | Single‑Page Application |
| **HLD / LLD** | High‑/Low‑Level Design |
| **ERD** | Entity‑Relationship Diagram |
| **CDN** | Content Delivery Network |
| **TTL** | Time To Live |
| **RPO / RTO** | Recovery Point / Time Objective |
| **CQRS** | Command Query Responsibility Segregation |

---

*End of documentation set.* Return to the [index](./README.md) for the full table of
contents.
