# SETUP — Glasswork

## 1. Prerequisites (macOS)

| Tool           | Version              | Check         |
| -------------- | -------------------- | ------------- |
| Node.js        | 22.x (≥ 22.18)       | `node -v`     |
| pnpm           | 12.11.2              | `pnpm -v`     |
| Docker Desktop | running, Compose v2+ | `docker info` |

If pnpm is missing: `corepack enable && corepack prepare pnpm@12.11.2 --activate`.
Give Docker Desktop at least **4 GB RAM** (Settings → Resources); the first image build compiles Next.js.

## 2. First run

```bash
git clone <repo-url> glasswork && cd glasswork
cp .env.example .env
pnpm install
pnpm dev:up
```

What `pnpm dev:up` does:

1. **`pnpm dev:pull`** downloads the images one at a time, retrying each up to 5 times with backoff (5s, 15s, 30s, 60s). Images you already have are skipped. If one still fails, it prints which one and the exact retry command.
2. `docker compose up --build` builds the api/worker/web images. The first build downloads the npm packages for Linux inside Docker; they're cached for later builds.
3. postgres, redis, rustfs (storage) and mailpit start and become healthy.
4. `api` applies migrations, runs the idempotent dev seed, creates the storage bucket if it's missing, then starts. `worker` and `web` follow.
5. It waits until everything answers, runs a **storage smoke test** inside the api container (presigned upload/download and CORS), then prints the URLs.

### First-run download size (linux/amd64, compressed)

| Item                                                                                         | Approx.          |
| -------------------------------------------------------------------------------------------- | ---------------- |
| `postgres:17-alpine`                                                                         | 117 MB           |
| `rustfs/rustfs:1.0.1`                                                                        | 111 MB           |
| `node:22-bookworm-slim` (base for app images)                                                | 80 MB            |
| `axllent/mailpit:v1.31.4`                                                                    | 17 MB            |
| `redis:7.4-alpine`                                                                           | 16 MB            |
| npm packages inside the Docker build (Linux builds, separate from your Mac's `pnpm install`) | ~300–400 MB      |
| **Total**                                                                                    | **≈ 650–750 MB** |

Optional: Playwright's Chromium for `pnpm test:e2e` adds about 110 MB. Later runs download almost nothing unless images or dependencies change.

**Slow connection tips:** run `pnpm dev:pull` on its own first (safe to re-run; it resumes). If the build stops while downloading npm packages, just run `pnpm dev:up` again: downloaded packages stay in Docker's build cache. pnpm itself retries each package 6 times with long timeouts (`pnpm-workspace.yaml`).

## 2a. Local services

| Service        | URL                   | Notes                                                                                       |
| -------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| Web            | http://localhost:3000 |                                                                                             |
| API            | http://localhost:4000 | Swagger at `/v1/docs`, auth reference at `/v1/auth/reference`                               |
| Mailpit        | http://localhost:8025 | All outgoing email in dev                                                                   |
| RustFS console | http://localhost:9001 | Log in with `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` from `.env`; bucket `glasswork-dev` |
| RustFS S3 API  | http://localhost:9000 | Path-style, used by presigned URLs                                                          |

## 3. Hot-reload development

```bash
pnpm dev
```

This starts infra in Docker (`pnpm infra:up`), then runs api (Nest watch), worker (node --watch) and web (`next dev`) on your machine. The `.env` defaults point at `localhost`, so nothing else is needed. Run `pnpm db:migrate && pnpm db:seed` once when using `pnpm dev` without having run `dev:up` before.

## 4. Environment variables

Every variable is documented in [.env.example](.env.example). Required in every environment: `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` (≥ 32 chars, `openssl rand -base64 48`) and the `S3_*` keys. The API and worker validate env at boot and exit with a clear message if anything is missing.

## 5. OAuth apps (optional — buttons stay hidden until keys exist)

**Google** — https://console.cloud.google.com/apis/credentials → Create OAuth client ID → _Web application_

- Authorised JavaScript origin: `http://localhost:3000`
- Authorised redirect URI: `http://localhost:4000/v1/auth/callback/google`
- Put the values in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

**GitHub** — https://github.com/settings/developers → New OAuth App

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:4000/v1/auth/callback/github`
- Put the values in `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

Restart with `pnpm dev:up` (it rebuilds). For production, add the production callback URLs (`https://api.<domain>/v1/auth/callback/...`).

## 6. Tests

```bash
pnpm lint && pnpm typecheck && pnpm test     # fast checks
pnpm test:integration                        # starts Postgres + Redis via Testcontainers (Docker must run)
pnpm dev:up && pnpm --filter @glasswork/e2e exec playwright install chromium && pnpm test:e2e
```

The e2e suite signs up and logs in many times per minute from one IP, so before running it set `AUTH_RATE_LIMIT_MAX=500` and `RATE_LIMIT_PER_MINUTE=5000` in your local `.env` and re-run `pnpm dev:up` (keep the default `10` for normal use). Screenshots and Playwright reports go to the git-ignored `artifacts/` folder.

To reuse already-running databases for integration tests instead of Testcontainers:
`TEST_DATABASE_URL=postgres://… TEST_REDIS_URL=redis://…/1 pnpm test:integration` (the test database is wiped).

## 7. Database workflow

1. Edit `packages/db/src/schema/*.ts`.
2. Run `pnpm db:generate` → review the SQL in `packages/db/migrations/`.
3. Run `pnpm db:migrate`. Commit the schema and migration together.

Never edit an applied migration; add a new one. `audit_logs` is append-only (a DB trigger blocks UPDATE/DELETE).

## 8. Observability

Sentry is off unless `SENTRY_DSN` (api/worker/web server) or `NEXT_PUBLIC_SENTRY_DSN` (browser, build time) is set. Logs are JSON (pino) with a `requestId`, which is also returned in every API error body.

## 9. Troubleshooting

| Symptom                                 | Fix                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Port already in use (5432, 6379, 3000…) | Stop the local service, or change `POSTGRES_PORT`, `REDIS_PORT`, etc. in `.env`. For 3000/4000, also update `WEB_URL` / `API_PUBLIC_URL`.                                                                          |
| "Invalid environment configuration"     | A required variable is missing; compare `.env` with `.env.example`.                                                                                                                                                |
| No verification email                   | Open Mailpit (http://localhost:8025) and check `pnpm dev:logs` for worker errors.                                                                                                                                  |
| Login says "verify your email first"    | Click the link in Mailpit; the link expires after 1 hour (use "Resend link").                                                                                                                                      |
| `429 Too many requests` on login        | Auth rate limit (`AUTH_RATE_LIMIT_MAX` per minute per IP). Wait a minute.                                                                                                                                          |
| Start from scratch                      | `pnpm dev:reset && pnpm dev:up` (deletes all local data).                                                                                                                                                          |
| Storage smoke test fails                | Run `pnpm smoke:storage` to repeat it; check `docker compose -f infra/docker-compose.yml --env-file .env logs rustfs`. A CORS failure means `WEB_URL` in `.env` doesn't match the address you open in the browser. |

### An image fails to download

1. Re-run `pnpm dev:pull`. Finished images are skipped and Docker keeps partial layers, so each retry continues where it stopped.
2. Retry a single image directly: `docker pull <image>` (the script prints the exact command).
3. Still failing:
   - **"connection reset" / timeout**: network problem. Try again later or on another connection. Docker Desktop → Settings → Docker Engine also lets you set `"max-concurrent-downloads": 1`, which helps on very slow links.
   - **"not found" / "pull access denied"**: the tag was removed from the registry. For storage only, set `STORAGE_IMAGE` in `.env` to another RustFS tag listed at hub.docker.com/r/rustfs/rustfs/tags, then re-run. For the others, tell me and I'll re-pin.

## Payments (test mode)

Local and CI use the built-in simulated provider (`PAYMENTS_PROVIDER=test`, the default): ordering sends you to a **"Test checkout"** page where you press "Pay (simulate success)". No Stripe account, no network, no real money. The result still travels as a signed webhook, so the real pipeline is exercised.

To try Stripe **test mode** (needs your own test keys; this part is not yet verified by the project):

1. Put `PAYMENTS_PROVIDER=stripe`, `STRIPE_SECRET_KEY=sk_test_…` in `.env`.
2. Run `stripe listen --forward-to localhost:4000/v1/webhooks/stripe` and copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`.
3. `pnpm dev:up`. Live keys (`sk_live_…`) are refused unless `PAYMENTS_LIVE_ENABLED=true`, which must stay false until the legal entity is decided.

Fees are zero placeholders; change them in **Admin → Fees** (product scope). Payouts are manual: sellers request them on `/earnings`, Operations marks them paid on **Admin → Payouts**.

## Realtime, notifications and file scanning

- **Live Project Room / chat / bell** use one authenticated WebSocket (`/v1/realtime`); nothing to configure locally.
- **Web push** is off until you set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (generate with `npx web-push generate-vapid-keys`) and `VAPID_SUBJECT` in `.env`, then enable it under **Settings → Notifications**.
- **Virus scanning** is off locally (`SCAN_MODE=off`). To try it: `docker compose -f infra/docker-compose.yml --env-file .env --profile scan up -d clamav`, wait for it to become healthy (first start downloads signatures), set `SCAN_MODE=clamav` in `.env`, then `pnpm dev:up`. Uploads then stay "Scanning…" until the worker reports a verdict. Production refuses `SCAN_MODE=off`.

## Keeping disk space under control

Docker build cache grows with every image rebuild (it once filled a Mac's disk to 100%).

- Rebuild only what changed: `pnpm dev:up:api`, `pnpm dev:up:web` or `pnpm dev:up:worker` (instead of `pnpm dev:up`). For day-to-day coding, `pnpm dev` runs api/worker/web on your machine with hot reload and needs no image builds.
- `pnpm dev:clean` trims the build cache to 8 GB (`docker builder prune -f --keep-storage 8GB`) and then prints free disk space.
- `pnpm disk:check` warns when free space is below 15 GB (`MIN_FREE_GB=20 pnpm disk:check` to change the threshold).
- `pnpm verify` runs lint, typecheck, unit, integration and e2e, then always runs `pnpm dev:clean`.
