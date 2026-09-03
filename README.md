# InnSight — Hotel Management Application

A full-featured hotel / hospitality property-management system (PMS) delivered as a **desktop application** (Electron) backed by a web UI (Next.js) and a modular REST API.

Built as a **pnpm + Turborepo monorepo** with shared packages for types, schemas, and the data layer, so the web app and the desktop app share one codebase and one database.

---

## Stack

| Layer | Tech |
|-------|------|
| **Monorepo** | pnpm workspaces + Turborepo |
| **Desktop app** | Electron (`apps/desktop`) |
| **Web UI** | Next.js + React + Tailwind (`apps/web`) |
| **API** | Node/Express + Zod (`apps/api`) |
| **Data** | Prisma + SQLite (local desktop) / Postgres (`packages/database`) |
| **Shared** | Types, schemas, constants, permissions (`packages/shared`) |
| **Testing** | Playwright + Jest |

---

## Modules

- 👤 **Guests** — profiles, history, restore, management
- 🛏️ **Rooms & Room Types** — inventory, status, rates
- 📅 **Reservations** — occupancy, bookings, check-in/check-out
- 🧹 **Housekeeping** — task assignment and tracking
- 🧾 **Billing & Invoices** — folios, invoices, PDF generation
- 👥 **Employees & Roles** — staff, permissions, audit logs
- 🔧 **Maintenance** — work orders and tracking
- 🏨 **Hotel Profile & Setup** — first-run setup, currency, theme
- 📊 **Reports & Analytics** — revenue, occupancy, KPIs
- 🍽️ **Restaurant** — F&B integration

---

## Getting started

Requirements: **Node ≥ 20**, **pnpm ≥ 9**

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env

# 3. Prepare the database
pnpm db:generate
pnpm db:push          # or: pnpm run db:template for the desktop template DB

# 4. Start the dev environment (web + API)
pnpm dev
```

### Build & package the desktop app

```bash
pnpm build:all        # shared → database → api → web → desktop
pnpm build:desktop    # produce the Electron distributable
```

### Useful scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Run web + API in dev mode |
| `pnpm build:all` | Build every workspace in order |
| `pnpm build:desktop` | Build + package the desktop distributable |
| `pnpm db:push` | Push the Prisma schema to the database |
| `pnpm lint` / `pnpm typecheck` | Lint and type-check all workspaces |
| `pnpm format` | Prettier format everything |

---

## Monorepo layout

```
first-demo/
├── apps/
│   ├── api/           # Express REST API (modules under src/modules)
│   ├── desktop/       # Electron desktop app
│   └── web/           # Next.js web UI (dashboard routes)
├── packages/
│   ├── config/        # Shared tsconfig / tooling config
│   ├── database/      # Prisma schema, client, seed
│   └── shared/        # Types, Zod schemas, constants, permissions, roles
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## Configuration

Environment variables live in `.env` (see `.env.example`). Key values:

| Key | Purpose |
|-----|---------|
| `DATABASE_URL` | Prisma connection string (SQLite file: or Postgres) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Auth signing secrets (≥ 32 chars) |
| `JWT_ACCESS_EXPIRY` / `JWT_REFRESH_EXPIRY` | Token lifetimes |
| `CORS_ORIGIN` | Allowed web origin |
| `PORT` | API port |

> `*.db`, `.env`, build outputs, and test artifacts are excluded from the repo via `.gitignore`.

---

## Repository hygiene

- `apps/desktop/release/` (large Electron binaries) is **git-ignored** — build artifacts are not committed.
- Playwright reports, E2E specs, and project-state scratch are excluded.
- Unit tests live alongside source under `apps/api/src/__tests__/`.

---

## License

Private / internal project. Not licensed for redistribution.
