# Glasswork by KorvenzaTech

A marketplace for software projects where buyers hire verified sellers and can always **see** how far their project has progressed: milestone by milestone, with funds held until each milestone is approved.

> Status: **Phase 0 — Foundation** (see [MASTER_PLAN.md](MASTER_PLAN.md)). Product decisions live in [DECISIONS.md](DECISIONS.md); the full brief is [docs/BRIEF.md](docs/BRIEF.md).

## Quick start (Docker, one command)

```bash
cp .env.example .env
pnpm install          # once: installs workspace tooling
pnpm dev:up           # builds and starts postgres, redis, minio, mailpit, api, worker, web
```

| What           | URL                                                   |
| -------------- | ----------------------------------------------------- |
| Web app        | http://localhost:3000                                 |
| API + Swagger  | http://localhost:4000 · http://localhost:4000/v1/docs |
| Auth reference | http://localhost:4000/v1/auth/reference (dev only)    |
| Mailpit        | http://localhost:8025 (verification emails land here) |
| MinIO console  | http://localhost:9001 (credentials from `.env`)       |

Seeded dev users (password `Glasswork-dev-123!`): `buyer@`, `seller@`, `admin@`, `support@dev.glasswork.test`.

Stop with `pnpm dev:down`; wipe all data with `pnpm dev:reset`. Full instructions, OAuth keys and troubleshooting are in [SETUP.md](SETUP.md).

## Daily development (hot reload)

```bash
pnpm dev     # infra in Docker; api, worker and web on your machine with watch mode
```

## Repository layout

```
apps/web        Next.js 16 (App Router) — UI only, talks to the API
apps/api        NestJS 11 + Fastify — REST /v1, Better Auth, Socket.io gateway
apps/worker     BullMQ workers (emails today; timers, scans, AI later)
packages/shared brand.ts, env schemas, enums, state machines, socket types, typed API client
packages/db     Drizzle schema, migrations, seed, scoped repositories
packages/ui     Tailwind v4 tokens + shadcn-style components
packages/emails React Email templates
packages/config Shared tsconfig / ESLint
infra/          docker-compose.yml, Dockerfile
e2e/            Playwright tests
docs/           Brief, ERD, state machines
```

## Scripts

| Command                       | What it does                                                       |
| ----------------------------- | ------------------------------------------------------------------ |
| `pnpm dev:up`                 | Whole stack in Docker, waits until healthy                         |
| `pnpm dev`                    | Infra in Docker + apps locally with hot reload                     |
| `pnpm lint` / `typecheck`     | ESLint / TypeScript across the monorepo                            |
| `pnpm test`                   | Unit tests (Vitest)                                                |
| `pnpm test:integration`       | API against real Postgres + Redis (Testcontainers, needs Docker)   |
| `pnpm test:e2e`               | Playwright against a running stack (desktop 1440 + mobile 390)     |
| `pnpm db:generate`            | Generate a migration from schema changes                           |
| `pnpm db:migrate` / `db:seed` | Apply migrations / seed dev data (refuses in production)           |
| `pnpm openapi`                | Regenerate `packages/shared/openapi.json` and the typed web client |

## Principles

Transparency is the product · trust by default · fast in-app UX · never fabricate data. See the brief §4.
