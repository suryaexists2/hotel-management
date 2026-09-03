# InnSight — Project State

> Living status document. Reconstructed on 2026-07-06 because no `implementation_plan.md`
> or `README.md` existed in the workspace. Update this at the end of each session.

## Stack & Architecture (locked-in decisions)

- **Monorepo:** Turborepo + pnpm workspaces (`apps/*`, `packages/*`). Node ≥20, pnpm 9.15.4.
- **Apps:** `@innsight/api` (Express 4, ESM), `@innsight/web` (Next.js 15 App Router + Tailwind).
- **Packages:** `@innsight/database` (Prisma 5 + client singleton), `@innsight/shared`
  (Zod schemas, RBAC matrix, DTOs), `@innsight/config` (shared strict `tsconfig.base.json`).
- **Multi-tenancy:** every domain table carries `hotelId`. `SUPER_ADMIN` bypasses permission
  checks in code (its permission list is intentionally empty).
- **Module system:** ESM throughout (`"type": "module"`, NodeNext, `.js` import specifiers).
- **API response contract:** `{ success, data, error, meta? }` (`StandardResponse<T>`) everywhere.
- **Errors:** `AppError` subclasses (`statusCode` + `code`) + one global error handler.
- **Auth:** JWT access token + rotating, hashed, DB-persisted refresh tokens.
- **Financials:** append-only folio charges / payments, Decimal columns, multi-currency.

## Milestones

### ✅ Milestone 1 — Core Infrastructure (complete, prior session)
Turborepo wiring, strict TS config, full Prisma schema (25+ models), Prisma client,
Express skeleton (`/health`, `/api/v1`, error handler, request logger, env validation),
Next.js landing page + design system, docker-compose (Postgres 16 + Redis 7), `.env.example`.

### ✅ Milestone 2 — Authentication, RBAC & Seeding (complete, this session)
- **Idempotent seed** (`packages/database/prisma/seed.ts`): permissions, 11 system roles with
  permission maps, demo hotel + settings, bootstrap `HOTEL_ADMIN` user. Run with `pnpm db:seed`.
- **Password service** (bcrypt, cost 12) behind a `PasswordHasher` interface.
- **Token service** (`TokenService`): signs/verifies JWT access tokens; generates opaque
  refresh tokens stored only as SHA-256 hashes; Zod-validated payloads.
- **Auth service**: `login` (with lockout after 5 fails / 15 min + timing-safe enumeration
  guard), `refresh` (atomic rotation via `$transaction`), `logout` (idempotent revoke), `getProfile`.
- **Middleware**: `authenticate` (Bearer → `req.user`), `requirePermission(...)` (shared RBAC
  matrix, `SUPER_ADMIN` bypass), `validateBody(schema)` (Zod → 400), `asyncHandler`.
- **Routes** mounted at `/api/v1/auth`: `POST /login`, `POST /refresh`, `POST /logout`,
  `GET /me`. Login/refresh are rate-limited. Refresh token travels as an httpOnly cookie
  scoped to `/api/v1/auth`; access token is returned in the response body.
- **Bug fix (necessary):** `PermissionType` in `packages/shared/src/constants/permissions.ts`
  resolved to `never` (union indexed by common keys). Rewritten as a mapped type so every
  permission literal is preserved — required for the RBAC middleware to be usable/typed.

**Bootstrap credentials (dev):** `admin@innsight.io` / `Admin@12345`
(overridable via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_HOTEL_SLUG`).
Seeding refuses the default password when `NODE_ENV=production`.

#### Security audit (2026-07-06) — fixes applied
- **Refresh-token reuse detection + race:** rotation now atomically *claims* the token
  (`updateMany … where revokedAt: null`, count-guarded); a replayed/already-revoked token or a
  lost race revokes the **entire token family** for the user (OWASP rotation).
- **SUPER_ADMIN bypass hardened:** authorization keys on a server-derived `isSuperAdmin`
  (system-role + reserved name) carried in the JWT — never on the tenant-settable role name.
- **Lockout race fixed:** `failedAttempts` uses an atomic DB `increment` (no lost updates).
- **JWT hardened:** algorithm pinned to `HS256` + issuer (`innsight-api`) bound on sign & verify.
- **Password/email validation:** password capped at 72 bytes (bcrypt limit); email normalised
  to lowercase (case-insensitive, prevents duplicate/locked accounts).
- **Proxy-aware rate limiting:** `TRUST_PROXY` env controls `app.set('trust proxy', …)` so
  `req.ip` is accurate and `X-Forwarded-For` isn't spoofable behind a load balancer.

**Accepted / deferred (documented, not bugs):**
- Login distinguishes `locked` / `not active` from `invalid credentials` — minor account
  enumeration, kept for operator UX. Revisit if enumeration becomes a concern.
- `RefreshToken` rows are never pruned → add a scheduled cleanup of expired/revoked tokens
  (indexed on `expiresAt` already) in M3+.

### ✅ Milestones 3–6 (this session)
- **M3** Foundation: pagination/id/common schemas, `http/` helpers (respond, pagination,
  context), global error handler now maps Zod + Prisma errors, audit service. Modules:
  **Users**, **Roles** (reserved-name guard, permission cat
alog), **Hotel** (profile/settings/tax rules).
- **M4** **Room Types** + **Rooms** (status transitions, floor/type filters).
- **M5** **Guests** (soft-delete, multi-field search, VIP, stay stats).
- **M6** **Folio service** (Decimal ledger, charge posting, recompute) + **Reservations**
  (availability, booking, walk-in, check-in→opens folio+room charge, check-out→settle +
  auto housekeeping task + guest stats, cancel).
- Pattern per module: `schema (shared)` → `service` → `controller` → `routes`, all
  tenant-scoped by `hotelId`, RBAC via `requirePermission`, audited. API builds clean.

- **M7** **Billing**: post/void charges, discounts, payments, refunds (Decimal-safe,
  partial refunds), invoice snapshot. Routes under `/api/v1/billing/folios/:folioId/...`.
- **M8** **Employees** (CRUD, user linkage, department filters).
- **M9** **Housekeeping** (assign/status/inspect + room sync), **Maintenance** (work orders,
  assign, status/resolve, costs), **Audit-log read** API (`/api/v1/audit-logs`).

### ✅ Milestones 10–13 (this session)
- **M10** **Restaurant/POS**: menu CRUD, order lifecycle, order routes (`/menu`, `/orders`). Mounted.
- **M11** **Inventory**: items, suppliers, stock movements (`/inventory`, `/suppliers`). Mounted.
- **M12** **Notifications + Email**: notification API (list/unread-count/read/read-all/create) +
  `EmailService` transport. Router was built but unmounted — **mounted at `/api/v1/notifications`**.
- **M13** **Reports/Analytics + Dashboard** (`/api/v1/reports`, new module):
  `GET /occupancy` (occupancy %, ADR, RevPAR, room revenue over a range),
  `GET /revenue` (collected/refunded/net + charge breakdown by category),
  `GET /housekeeping` (throughput + SLA: completion rate, avg minutes),
  `GET /arrivals-departures?date=` (arrivals/departures lists + in-house count),
  `GET /dashboard` (live KPI snapshot). Operational reports gated by
  `REPORTS.VIEW_OPERATIONAL`, revenue by `REPORTS.VIEW_FINANCIAL`. Shared `report.schema.ts`
  (day-aligned range with trailing-30-day default). Decimal-safe (`.toNumber()` at the edge).

**Backend Version 1.0 — feature-complete.** All numbered backend feature milestones (M1–M13) done.

### ⏭️ Next: Frontend (M14 web foundation onward) — NOT started per instruction. Backend
hardening extras (OpenAPI docs, uploads, attendance/coupons, migration baseline) deferred to M18.

## Verified this session
- `tsc` builds clean: `@innsight/shared` then `@innsight/api` (after mounting notifications +
  adding the reports module). No test runner configured, so build is the verification path.
- `tsc` builds clean: shared, database, api. `next build` clean: web. Seed typechecks.
- Prettier-clean (repo style) on all new/changed files.
- Runtime smoke test (no DB): health 200, `/api/v1` 200, `me` 401, bad-login 400, unknown 404.

## Notes / follow-ups
- `.prettierrc` lists `prettier-plugin-tailwindcss` which is **not installed**, so
  `pnpm format:check` fails repo-wide (pre-existing). Install it or drop the plugin entry.
- `turbo` cannot find the `pnpm` binary in this environment (pnpm is a corepack shim only).
  Per-package builds work via `corepack pnpm --filter <pkg> build`. Fix by putting pnpm on PATH.
- No test runner is configured yet; auth services are structured (DI on hasher/token) to be
  unit-testable when one is added.
