# DECISIONS — Glasswork by KorvenzaTech

Architecture decision log. Each entry gives the decision, a 1–2 line reason, and alternatives where relevant.
Status: all Phase 0 proposals **Accepted** by Rashid on 2026-10-11 unless noted.
Status values: **Proposed** · **Accepted** · **Superseded by D-xxx**.

---

## 0. Brand & scope overrides

**D-001 Product name is "Glasswork".** _Accepted (Rashid, 2026-10-11)._
This overrides the brief's working name "Korvenza Hub". It lives only in `packages/shared/src/brand.ts`:

```ts
export const brand = {
  productName: 'Glasswork',
  parentName: 'KorvenzaTech',
  lockup: 'Glasswork by KorvenzaTech',
  tagline: 'Hire verified builders. Watch your project move.', // placeholder, change freely
  domain: 'TODO', // e.g. glasswork.<tld>; dev uses localhost
  parentDomain: 'korvenzatech.com',
  legalEntity: 'KorvenzaTech (TODO: registered company name)',
  legalAddress: 'TODO',
  supportEmail: 'TODO',
} as const;
```

A lint rule (`no-restricted-syntax` on string literals "Glasswork"/"KorvenzaTech" outside brand.ts) enforces "never hard-code".

**D-002 KorvenzaTech's own services get no ranking advantage.** _Proposed._
They carry the "Operated by KorvenzaTech" label, the ranking function has no owner/affiliate input, and an automated test asserts that ranking is unchanged when the `operated_by_platform` flag is flipped. The same wording goes into the Terms (Phase 8).

**D-003 Admin roles.** _Accepted (provisional)._ Roles are data, never tied to specific people: three admin scopes plus `support`: `admin:product` (Product/Tech), `admin:growth` (onboarding, marketing), `admin:operations` (verification, support, disputes, payouts). Who holds which scope is assigned in the admin panel / seed, not in code. Provisional mapping (Rashid confirming with partners): Rashid = product, Taha Amir = growth, Suliman = operations. Money-moving admin actions (refunds, manual releases, payout approvals) require `admin:operations` and are audit-logged with a reason.

---

## 1. Stack & exact versions (pinned exactly, no `^`)

Rule I applied: take the latest stable release, but **skip majors less than ~6 weeks old** that the rest of the ecosystem hasn't caught up with yet. Renovate will propose upgrades weekly.

| Area            | Choice                                                                            | Version                                                   | Note                                                                                                  |
| --------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Runtime         | Node.js LTS                                                                       | **22.x** (≥ 22.18.0; Docker `node:22.18.0-bookworm-slim`) | Matches your Mac. Node 24 LTS is the upgrade path (Phase 9).                                          |
| Package manager | pnpm                                                                              | **12.11.2** (`packageManager` field)                      | Matches your Mac.                                                                                     |
| Monorepo        | Turborepo                                                                         | **2.11.7**                                                |                                                                                                       |
| Language        | TypeScript                                                                        | **6.0.3**                                                 | **Not 7.0**: Nest's DI relies on `emitDecoratorMetadata`, and typescript-eslint supports only `<6.1`. |
| Web             | Next.js (App Router)                                                              | **16.3.8**                                                | 16.4.0 is 5 days old; I'll bump after ~2 weeks of patches.                                            |
|                 | React / React DOM                                                                 | **19.3.0**                                                |                                                                                                       |
| API             | NestJS (`core`, `common`, `platform-fastify`, `websockets`, `platform-socket.io`) | **11.2.7**                                                | **Not 12.x** (out Aug 27): `nestjs-zod` doesn't support Nest 12 yet. 11.x is still patched.           |
|                 | Fastify                                                                           | 5.x (the version `@nestjs/platform-fastify` 11.2.7 pins)  |                                                                                                       |
|                 | @nestjs/swagger                                                                   | **11.4.7**                                                | OpenAPI → TS client now, Dart client later                                                            |
| Validation      | zod                                                                               | **4.6.5**                                                 | Shared by web, api and worker                                                                         |
|                 | nestjs-zod                                                                        | **5.5.0**                                                 | zod DTOs + OpenAPI                                                                                    |
| Database        | PostgreSQL                                                                        | **17** (`postgres:17-alpine`)                             | Brief says 16+. 17 is supported by both Neon and DO Managed.                                          |
| ORM             | drizzle-orm / drizzle-kit                                                         | **0.45.4 / 0.31.11**                                      | Not the 1.0 RC.                                                                                       |
|                 | pg (node-postgres)                                                                | **8.23.1**                                                | Most mature driver; Better Auth peer.                                                                 |
| Cache/queues    | Redis                                                                             | **7.4** (`redis:7.4-alpine`)                              |                                                                                                       |
|                 | ioredis                                                                           | **5.11.1**                                                | 6.0 is a fresh major.                                                                                 |
|                 | BullMQ                                                                            | **6.3.12**                                                |                                                                                                       |
| Realtime        | socket.io / @socket.io/redis-adapter                                              | **4.8.4 / 8.3.0**                                         |                                                                                                       |
| Auth            | better-auth                                                                       | **1.7.7**                                                 | See D-010                                                                                             |
|                 | @node-rs/argon2                                                                   | **2.2.2**                                                 | argon2id                                                                                              |
| Payments        | stripe (Node)                                                                     | **22.6.2**                                                | 23.0.0 is 10 days old.                                                                                |
| Files           | @aws-sdk/client-s3 + s3-request-presigner                                         | **3.1149.0**                                              | Same code for RustFS (local) and R2                                                                   |
| Local S3        | RustFS (D-046)                                                                    | `rustfs/rustfs:1.0.1`                                     | Local only; prod uses Cloudflare R2.                                                                  |
| Local mail      | Mailpit                                                                           | `axllent/mailpit:v1.31.4`                                 |                                                                                                       |
| Email           | React Email (`@react-email/components`) / Resend                                  | **1.0.12 / 6.32.1**                                       | Mailpit locally via SMTP transport                                                                    |
| UI              | Tailwind CSS                                                                      | **4.3.3**                                                 |                                                                                                       |
|                 | shadcn/ui + Radix                                                                 | CLI-generated (code lives in `packages/ui`)               |                                                                                                       |
| Logs            | pino / nestjs-pino                                                                | **10.4.0 / 5.3.1**                                        |                                                                                                       |
| Errors          | @sentry/nestjs, @sentry/nextjs, @sentry/node                                      | **10.76.2**                                               | 11.0 is ~3 weeks old.                                                                                 |
| Tests           | Vitest                                                                            | **4.1.11**                                                | 5.0 is ~5 weeks old.                                                                                  |
|                 | Playwright                                                                        | **1.63.0**                                                | 1.64 is 4 days old.                                                                                   |
|                 | Testcontainers                                                                    | **12.2.0**                                                |                                                                                                       |
| Lint/format     | ESLint (flat) / typescript-eslint / Prettier                                      | **9.39.5** / latest compatible / **3.9.10**               | ESLint 10's plugin ecosystem is still uneven.                                                         |

**D-005 IDs:** UUIDv7, generated in the app. They're time-sortable, which gives cheap cursor pagination, and they're safe to expose. Postgres 17 has no native v7, so the `uuidv7` package generates them.
**D-006 Money:** `bigint` minor units + `char(3)` currency on every money column. No floats, ever. Amounts are always recomputed server-side from DB prices.
**D-007 Timestamps:** `timestamptz` everywhere, stored in UTC, displayed in the user's timezone.

---

### Version changes made during the Phase 0 build (2026-10-11)

| Change                                                                                                    | Why                                                                                                                 |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| ESLint **10.12.0** + @eslint/js 10.0.1 (was 9.39.5)                                                       | npm marks ESLint 9 as deprecated; 10 has been out since Feb 2026 and typescript-eslint 8.71 supports it.            |
| nodemailer **10.1.0** (worker, SMTP to Mailpit)                                                           | Versions below 10.0.9 have high-severity advisories (`pnpm audit`). Security beats the "skip fresh majors" rule.    |
| fastify **5.12.5** via pnpm override                                                                      | @nestjs/platform-fastify 11.2.7 pins 5.11.3, which has high-severity advisories. Patch-level within 5.x.            |
| js-yaml 5.4.1 via override                                                                                | Moderate advisory in @nestjs/swagger's dependency.                                                                  |
| socket.io **4.8.3** in the API                                                                            | Must match the version @nestjs/platform-socket.io 11.2.7 is built against (the web client stays on 4.8.4).          |
| Base images: `node:22-bookworm-slim`, `postgres:17-alpine`, `redis:7.4-alpine`, `axllent/mailpit:v1.31.4` | Majors pinned and patches float, so security fixes arrive on rebuild. Digest pinning via Renovate comes in Phase 9. |
| ~~MinIO pinned tag~~ → **RustFS 1.0.1** (2026-10-11)                                                      | The MinIO tag couldn't be pulled on the Mac ("pull access denied"); see D-046.                                      |

**D-008 pnpm: explicit peer dependencies (`autoInstallPeers: false`).** Auto-installed peers made the API's production bundle pull in the web app's optional better-auth peers (Next.js, React, Playwright: 650 MB → 206 MB after the fix). Every peer is now declared where it's used, and `pnpm peers check` is clean. Build scripts are allow-listed in `pnpm-workspace.yaml` (`allowBuilds`).

**D-009 One drizzle-orm instance.** Apps import query helpers (`eq`, `and`, `sql`, …) from `@glasswork/db`, never from `drizzle-orm` directly (enforced by ESLint). This avoids duplicate-instance type errors.

## 2. Folder structure

```
glasswork/
├─ apps/
│  ├─ web/            Next.js 16 — UI only; calls the API via generated client
│  ├─ api/            NestJS 11 + Fastify — REST /v1 + Socket.io gateway
│  │  └─ src/modules/{auth,users,files,realtime,health,...}   one module per domain
│  │  └─ src/common/{policy,errors,pagination,idempotency,logger,config}
│  └─ worker/         BullMQ processors (email, timers, scans, AI)
├─ packages/
│  ├─ shared/         brand.ts, env schema, zod schemas/DTOs, enums, state machines, socket event types, openapi.json + generated client
│  ├─ db/             Drizzle schema, migrations/, seed/, scoped repositories
│  ├─ ui/             Tailwind preset + tokens, shadcn components
│  ├─ emails/         React Email templates (shared by api + worker)
│  └─ config/         tsconfig bases, eslint config, prettier config
├─ infra/
│  ├─ docker/         Dockerfiles (api, worker, web)
│  ├─ docker-compose.yml
│  └─ deploy/         Caddyfile, prod compose, backup scripts (Phase 9)
├─ e2e/               Playwright tests (cross-app flows)
├─ docs/              BRIEF.md, ERD.md, STATE_MACHINE.md, runbooks/
├─ artifacts/         git-ignored: screenshots, reports
├─ MASTER_PLAN.md · DECISIONS.md · README.md · SETUP.md · .env.example
```

I added `packages/emails` and `packages/config`, which aren't in the brief. Emails are shared by api and worker; the config package keeps tsconfig/eslint in one place.

---

## 3. Auth

**D-010 Better Auth 1.7.7, mounted inside the NestJS API on our own Postgres.** _Proposed._

- **Why:** it's TypeScript-first and runs inside our API and DB (no BaaS). It has a Drizzle adapter, plus maintained plugins for exactly what the brief lists: email verification, password reset, Google/GitHub OAuth, TOTP 2FA, multi-session / revoke-all, bearer tokens, JWT, and Redis-backed rate limiting.
- **Rejected:** _Lucia_ (deprecated in 2025). _Auth.js_ (Next-centric; it would put auth in the web app, which breaks "web talks only to API"). _Passport_ (we'd hand-roll sessions, verification and token flows, which is what the brief forbids). _Keycloak/Ory_ (another service to run and theme; too heavy for us now).
- **Risk:** it's a younger library than Passport. Mitigation: exact pin, GitHub security-advisory watch, Renovate, and our own e2e tests on every auth flow.
- **Passwords:** argon2id via `@node-rs/argon2` (OWASP params: m=19 MiB, t=2, p=1), plugged into Better Auth's custom `password.hash/verify`. Better Auth's default is scrypt, so we override it.
- **Web sessions:** opaque session token in an httpOnly, Secure (prod), SameSite=Lax cookie. Sessions live in Postgres, with a Redis secondary-storage cache.
- **Flutter app (later):** Better Auth `bearer` + `jwt` plugins: a short-lived JWT access token (15 min) plus a long-lived, revocable session token used to mint new access tokens.
  - ⚠ **Pushback:** Better Auth doesn't do classic _rotating_ refresh tokens out of the box. I'll add rotation (each refresh issues a new session token and revokes the old one, with reuse detection) as a small plugin in Phase 1, when the mobile API matters, rather than in Phase 0.
- **Table naming clash:** Better Auth's `verification` table (email/OTP tokens) collides with the brief's `verifications` (seller badges). Better Auth's table becomes `auth_tokens`; `verifications` keeps the brief's meaning.
- **Email verification required before login.** OAuth accounts whose email is verified by Google or GitHub skip it. Account linking happens only for verified emails.
- **Rate limits:** auth endpoints get per-IP and per-email limits, plus temporary lockout after repeated failures (Redis).
- **Phase 0 scope:** register, verify, login, OAuth wiring, logout. 2FA, password reset UI and the session list are Phase 1 (MASTER_PLAN).

**D-011 Authorization: explicit policy functions + guard, not CASL.** _Proposed._
Our rules are mostly relationship checks ("is this user a participant of this project?"), which need DB lookups. Typed functions like `canViewProject(actor, project)` are easier to read, test and audit than CASL's ability DSL.

- Every controller method and socket handler must declare `@Policy(...)` or `@Public()`. A boot-time check fails the app if any route has neither.
- Repositories take an `actor` and always scope their queries.
- On cross-tenant access the API returns **404, not 403**, so it doesn't leak whether a resource exists.

---

## 4. API conventions

**D-015** REST under `/v1`; zod on every input; error format `{ error: { code, message, details?, requestId } }`; cursor pagination `?cursor=&limit=` returning `{ items, nextCursor }`; an `Idempotency-Key` header is required on order/payment POSTs (stored 24h in an `idempotency_keys` table). OpenAPI is exported on build and generates the typed web client; the same spec will generate the Dart client.

**D-016 Cookies/CORS:** the web app and API share a parent domain in prod (`app.<domain>`, `api.<domain>`). CORS is an explicit allow-list with credentials. Dev: `localhost:3000` (web) and `localhost:4000` (api). Socket.io authenticates by reading the same session cookie in the handshake.

---

## 5. Payments, escrow and payouts — the biggest risk in the brief

**D-020 Split money-in from money-out, with our own ledger as the source of truth.** _Proposed._

⚠ **Pushback (important):** the brief assumes Stripe Connect Express can pay every seller. Per Stripe's docs, **Connect cross-border payouts work only between platforms and sellers in the US, UK, EEA, Canada and Switzerland.** Sellers in Pakistan (likely most of our early supply) **can't be Connect Express accounts**. Stripe's alternative, _Global Payouts_, does reach Pakistan (PKR via wire), but only from a **US- or UK-based platform**, and it puts the money-transmission compliance on us instead of Stripe. So the legal entity question decides which payout rails we can even use. That's why it's open question Q1 below.

Design, so this doesn't block engineering:

- `PaymentsProvider` (money in): `createCustomer`, `createMilestoneCharge(milestoneId, amount, idempotencyKey)`, `refund`, `verifyWebhook`, `parseEvent`. First adapter: **Stripe, test mode**, "separate charges and transfers" (no `on_behalf_of`), so funds sit in the platform balance until release.
- `PayoutsProvider` (money out), chosen per seller by country and availability:
  1. `stripe_connect`: transfers to Express accounts (sellers in supported countries)
  2. `stripe_global_payouts`: PK and others (needs a US/UK entity + compliance review)
  3. `payoneer`: future adapter
  4. `manual_bank`: Operations admin marks a payout as paid with a reference (bootstrapping fallback)
- **Ledger** (append-only, double-entry, in the same DB transaction as every state change). Accounts: `platform_cash`, `escrow_liability:{milestone}`, `seller_payable:{seller}`, `platform_revenue`, `payout_clearing`, `refunds`.
  - Charge succeeded: cash ↑ / escrow ↑
  - Release: escrow ↓ → seller_payable ↑ + platform_revenue ↑ (fee)
  - Payout: seller_payable ↓ → payout_clearing ↑ → cash ↓ when settled
  - A DB constraint + nightly check ensures every transaction's entries sum to zero.
- **Safety rails:** the app refuses `sk_live_` keys unless `PAYMENTS_LIVE_ENABLED=true` (stays false until Q1 is answered). Webhooks: signature verified, raw event stored in `webhook_events`, processed idempotently by event id, admin replay.
- **Holding period:** Stripe limits how long a platform may hold funds before paying out, and the limit depends on the platform country. We'll confirm it for the chosen entity before launch and set the auto-approve window under it.

**D-021 Don't call it "escrow" in user-facing copy until a lawyer says so.** _Proposed._
"Escrow" is a regulated term in many jurisdictions. The code says `escrow`; the UI says "Milestone protection" / "Held by Glasswork until you approve". Low cost now, avoids a legal problem later.

**D-022 Auto-approval:** default **5 days** after submission without buyer action, with reminders at day 2 and day 4. Configurable per platform setting; the timer runs in the worker; the buyer can pause it once by requesting a revision. (Fiverr uses 3; we give buyers a bit more since software review takes longer.)

---

## 6. Data & lifecycle

**D-025 Project and milestone are two separate state machines** (see docs/STATE_MACHINE.md).
The brief writes them as one line, but a project has several milestones in different states at once. Splitting them makes the rules enforceable, and progress, health and escrow all derive cleanly from milestone states. Both machines are defined once in `packages/shared` (pure functions + exhaustive tests) and enforced in the API inside DB transactions with row locks. Every transition writes `audit_logs` + `project_events`.

**D-026 Tables I added beyond the brief's list** (all in docs/ERD.md): `accounts` (OAuth links), `auth_tokens`, `files` (every upload; deliverables/portfolio/messages reference it), `project_participants`, `project_events` (activity feed), `task_comments`, `deliverable_feedback` (pinned comments), `ledger_accounts` + `ledger_transactions` (needed for real double-entry), `webhook_events`, `idempotency_keys`, `categories`, `favorites`, `saved_searches`, `notification_preferences`, `platform_settings`, `feature_flags`, `ai_usage`.

**D-027 Seed data:** dev/test only. The script refuses to run when `NODE_ENV=production`, and every seeded row has `is_seed=true` so it can never leak into real metrics (brief principle 4).

---

## 7. Files

**D-030** Presigned PUT straight from the browser to S3 (RustFS locally, R2 in prod), max 15-minute expiry. Size and MIME are allow-listed per purpose, keys look like `u/{userId}/{uuid}`, and a `files` row moves `pending → uploaded → clean|infected`. Download URLs are issued only after a policy check.
⚠ **Pushback:** ClamAV needs ~1–1.5 GB RAM, which is a lot for a single VPS. It goes in Phase 4 (deliverables) as a worker job behind a `FileScanner` interface. Phase 0 marks files `clean` with a TODO, and nothing downloadable to _other_ users exists in Phase 0.

---

## 8. Infra, CI, observability

**D-035** `docker compose` runs postgres, redis, rustfs, mailpit, api (runs migrations + dev seed on start), worker, web, all with healthchecks.

- `pnpm dev:up` runs the whole stack in containers.
- `pnpm dev` runs infra in Docker and the apps on the host with hot reload. This is the faster daily loop on a Mac.

**D-046 Local object storage: RustFS instead of MinIO.** _Accepted (2026-10-11)._
MinIO's community images were removed from Docker Hub, and quay.io now requires login, so the stack failed on the first pull. I compared the two maintained alternatives Rashid suggested:

- **RustFS** (`rustfs/rustfs:1.0.1`, amd64 + arm64, ~111 MB): one container configured by env vars (root keys, CORS origins, console). The API already creates the bucket on startup, so no init container is needed. Path-style S3 and SigV4 presigned URLs, like MinIO. Web console on :9001.
- **Garage** (`dxflrs/garage`): needs a mounted `garage.toml`, then `garage layout assign/apply` and `garage key import` from an init container before the first request. More moving parts for a local-only service, and its Docker Hub tags are commit hashes.

Picked **RustFS** for the least setup. Trade-off: it's young (1.0 in Sept 2026). That's acceptable because it's local dev only; production stays on Cloudflare R2 behind the same S3 code, and `STORAGE_IMAGE` can switch tags.

- S3 CORS is off in RustFS unless `RUSTFS_CORS_ALLOWED_ORIGINS` is set, so compose sets it to `WEB_URL`.
- `pnpm dev:up` ends with a storage smoke test (presigned PUT/GET, CORS preflight, HEAD) so a storage incompatibility shows up immediately with a clear message.
- The separate `migrate` service was folded into the api container's start command, to avoid two services building the same image tag.

**D-047 Slow-network friendly setup.** `pnpm dev:pull` pulls each image separately with 5 attempts and backoff, skips images already present, and names the failing image with its retry command. pnpm uses 6 fetch retries with long timeouts. The Dockerfile no longer pulls the `docker/dockerfile` syntax image (one fewer download).

**D-036 CI** (GitHub Actions): pnpm cache, then lint, typecheck, unit, integration (Testcontainers), e2e (Playwright against compose), build, `pnpm audit --prod`. Docker image build + deploy jobs come in Phase 9.

**D-037** pino JSON logs with `requestId`. Sentry is initialised only when `SENTRY_DSN` is set (otherwise a no-op). PostHog from Phase 8.

**D-038 Production (Phase 9):** a single Hetzner or DO VPS running Docker + Caddy (auto-HTTPS), managed Postgres (Neon or DO) with PITR, R2, Resend. Scaling path: separate worker box, then a managed Redis, then horizontal API replicas (sockets already use the Redis adapter).

---

## 9. Design system proposal (for approval before UI work)

**D-040 Palette (KorvenzaTech family).** All text/background pairs below meet WCAG AA; I'll verify the final pairs with a contrast script.

| Token                                     | Dark (default)                                | Light                                         |
| ----------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| `bg`                                      | `#07110E`                                     | `#F6FAF8`                                     |
| `surface`                                 | `#0C1A15`                                     | `#FFFFFF`                                     |
| `surface-2`                               | `#12241D`                                     | `#EEF5F1`                                     |
| `border`                                  | `#1E3A2F`                                     | `#D9E6E0`                                     |
| `text`                                    | `#E8F3EE`                                     | `#0B1A14`                                     |
| `text-muted`                              | `#8FA89C`                                     | `#4E6159`                                     |
| `primary` (actions)                       | `#19C784` (text on it: `#07110E`)             | `#087F5B` (text on it: `#FFFFFF`)             |
| `primary-hover`                           | `#3DD69A`                                     | `#066B4C`                                     |
| `focus-ring`                              | `#19C784`                                     | `#087F5B`                                     |
| `success` / `warning` / `danger` / `info` | `#19C784` / `#F5B544` / `#F0616D` / `#5AB4F0` | `#087F5B` / `#A86B00` / `#C2313E` / `#1F6FB2` |

**Glass:** only on overlays (command palette, popovers, modals) and the marketing site: `backdrop-blur(16px)` + translucent surface + 1px light border. Main app surfaces stay solid, for contrast and for speed (brief principle 3).

**D-041 Type:** Geist Sans + Geist Mono (OFL, self-hosted through `next/font`, no layout shift).

- Scale: 12 / 13 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48 / 60.
- Base 14px in the app (dense), 16px on marketing pages.
- Line-height 1.5 for body, 1.2 for headings. Tabular numbers for money and progress.

**D-042 Components:** shadcn/ui on Radix (accessible primitives); 8px radius (12 on cards); 4px spacing grid; Lucide icons; ⌘K palette via `cmdk` (Phase 1+). Skeletons over spinners.

**D-043 Product mark:** a simple geometric "G" built from a stacked glass pane + progress arc in emerald, set beside the KorvenzaTech K in the "by KorvenzaTech" lockup. Phase 0 uses a text lockup; the final mark comes in Phase 8. Please send me the KorvenzaTech K logo as an SVG.

---

**D-044 Marketing typography is an open design item.** Geist stays for the app. For the marketing site (Phase 8) we may align with korvenzatech.com typography; decide then.

**D-045 Fees are admin-configurable settings, never hard-coded.** _Accepted._ `platform_settings` keys: `fees.buyer_service_bps`, `fees.buyer_service_min_amount`, `fees.seller_commission_bps`, `fees.seller_commission_min_amount` (basis points + minor units). Phase 0 seeds placeholder zeros clearly marked as dev values; real values are set before Phase 3.

---

## 9b. Phase 1 — accounts & profiles (2026-10-11)

**D-050 Public profiles may show the owner's published avatar/portfolio images.** Files are owner-only by default (D-030). A file linked from a _public_ profile (avatar or portfolio image, status `clean`) is served via a 5-minute presigned GET in the profile response, because the owner chose to publish it. Nothing else becomes readable. The public profile page is rendered with `cache: 'no-store'` because those URLs expire.

**D-051 Seller opt-in, not a separate account.** "Become a seller" adds the `seller` role and creates a `seller_profiles` row; `users.active_mode` is the buyer/seller switch and can only be `seller` if the role exists. A seller profile is hidden publicly until `onboarding_completed_at` is set, which requires profile (headline, bio, country), at least one skill and an hourly rate. Payout method and identity steps are placeholders (free-text preference, no account data) until Q1/Q6 and Phase 5.

**D-052 Organizations and invites.** Roles `owner | admin | member`. Invite tokens are random 32 bytes, only the SHA-256 is stored, they expire in 7 days and are single-use. Only a signed-in user whose _verified_ email equals the invited address can accept; every other failure returns the same 404. Non-members get 404 on org reads (D-011). Only the owner changes roles; the owner cannot be removed.

**D-053 Sessions and 2FA.** Session list/revoke/log-out-everywhere go through Better Auth (so the Redis session cache is invalidated too), scoped to the caller; another user's session id returns 404. TOTP uses Better Auth's `twoFactor` plugin (secrets encrypted by the plugin). ⚠ Verifying a TOTP code rotates the session cookie (the old one stops working), which is the secure behaviour and is covered by a test.

**D-054 Admin skeleton.** `admin` role gates every `/v1/admin/*` route at the guard; assigning admin scopes additionally requires the `product` scope, and is audit-logged with before/after. Scopes stay data (D-003). The web `/admin` shell returns 404 to non-admins.

**D-055 Bug found by e2e: CORS blocked PATCH/PUT/DELETE.** `@fastify/cors` defaults to GET/HEAD/POST, so browser mutations failed while in-process API tests passed. Fixed by listing methods explicitly (origins stay the allow-list, credentials on) and added a preflight test that also asserts a foreign origin is refused.

**D-056 e2e vs. auth rate limiting.** The limiter (10 sign-in/up per minute per IP) works as designed and trips the e2e suite. The default stays 10. e2e runs set `AUTH_RATE_LIMIT_MAX=500` (CI job and local `.env`, documented in SETUP.md). Note `/request-password-reset` is limited to 3/min per IP, so don't re-run the accounts e2e within a minute of a previous run.

---

## 9c. Phase 2 — services & discovery (2026-10-11)

**D-060 Search = Postgres FTS + pg_trgm behind `SearchService`.** Weighted `tsvector` (title A, description B) as a generated column with a GIN index, `websearch_to_tsquery` for the query, and `similarity(title, q)` (trigram GIN index) so small typos still match. Rank = `ts_rank_cd + similarity`. `PostgresSearchService` is injected through the abstract `SearchService`, so Meilisearch can replace it without touching controllers. Cursors are opaque offsets (capped at 10k): relevance scores aren't keyset-friendly. ⚠ Prefix/partial-word search ("zebr" → "zebra") is not supported; that is a known limit of this approach and a reason to revisit Meilisearch if discovery quality matters.

**D-061 Filters shipped vs. deferred.** Shipped: text, category, budget (any package within range), delivery time, sort (best match, newest, price ↑/↓). **Deferred with a visible note:** rating, seller level and verified-only. Their data (reviews, verifications, levels) doesn't exist until Phase 5, and showing filters over empty data would be fabricated UX (brief principle 4).

**D-062 Moderation lifecycle.** `draft → pending_review → live` (or `rejected` with a reason, resubmittable), `live ⇄ paused`. Sellers cannot self-approve; `operations` or `product` admins approve/reject (audited with before/after status). **Editing a live service sends it back to `pending_review` and hides it**, so approved text can't be swapped after approval. A service is publicly visible only if it is `live`, its seller finished onboarding and the seller isn't banned. Deleting is blocked while live/pending (Phase 3 will also block it when orders exist).

**D-063 "Operated by KorvenzaTech" (D-002 implemented).** `services.operated_by_platform` is a display flag settable only by `product` admins (audited). The search ORDER BY is documented as forbidden from reading it, and an integration test flips the flag on identical listings and asserts the result order never changes. Terms wording comes in Phase 8.

**D-064 Categories are reference data in the migration** (idempotent `INSERT … ON CONFLICT DO NOTHING`), not dev seed, because production needs them. They are a taxonomy, not marketplace content. Listing images reuse the `portfolio` upload purpose (owner-only until published, then served via short-lived presigned URLs like D-050).

**D-065 Public pages are never cached** (`cache: 'no-store'`) because they embed 5-minute presigned image URLs. When a CDN is added (Phase 9) images should move behind a public-read prefix or signed-cookie scheme. `robots.ts` disallows everything on localhost/staging and only opens public discovery routes once `NEXT_PUBLIC_WEB_URL` is a real domain; `sitemap.xml` lists live services.

---

## 9d. Phase 3 — orders, escrow & payments (2026-10-11)

**D-066 Packages become 3 milestones; custom offers wait for chat.** A package order is split by percentage into milestones (default **30 / 40 / 30**: Kickoff & plan, Build, Delivery & handover; `service_packages.milestone_template` can override it per package via the API). Amounts use exact integer math and the remainder goes to the last milestone, so the parts always sum to the price (unit-tested). Extras are added to the total before the split. Custom offers "from chat" move to Phase 4 because chat doesn't exist yet; the same project factory (`ProjectsService.create`) will serve them.

**D-067 Test-mode provider that runs the real pipeline.** There are no Stripe keys yet, so `PAYMENTS_PROVIDER=test` (default) uses a built-in `TestPaymentsProvider`: checkout "redirects" to `/pay/test/:id`, and the result comes back as an **HMAC-signed webhook** through the same code path as Stripe (signature → raw event stored → idempotent processing). `StripePaymentsProvider` is implemented (Checkout Sessions, refunds, webhook verification) and its signature handling is unit-tested with Stripe's own test-header helper, but **its API calls have not been exercised against Stripe** (no keys). The test provider is refused in production, live keys are refused unless `PAYMENTS_LIVE_ENABLED=true`, and both are unit-tested.

**D-068 Money rules (all enforced server-side).**

- Amounts are always recomputed from DB prices; client-sent amounts are ignored (tested).
- Buyer service fee is added on top and recognised as revenue at charge; **seller commission is fixed when the milestone is funded** (stored on the escrow hold) so later settings changes never alter in-flight milestones. Both are admin settings (product scope, audited), placeholder 0 until Q4.
- A full refund returns the buyer fee too (the platform didn't deliver).
- One live payment per milestone (partial unique index); re-opening a pending checkout never creates a second charge. A payment for a milestone that is no longer fundable, or for the wrong amount, is **not** applied: the webhook event is stored with its error and shown to Operations for replay/refund.
- `Idempotency-Key` is required on orders, funding, proposal acceptance and payout requests (same key+body replays; same key+different body → 422; concurrent duplicate → 409).

**D-069 Ledger.** Append-only double-entry: debits positive, credits negative. Accounts: `platform_cash`, `escrow:{milestone}`, `seller_payable:{seller}`, `platform_revenue`, `payout_clearing`. Charge: cash↑ / escrow / revenue(fee). Release: escrow → seller_payable (net) + revenue (commission). Payout request reserves `seller_payable → payout_clearing`; paid moves `payout_clearing → cash`; failed reverses. A **deferred constraint trigger** rejects any transaction whose entries don't sum to zero at commit, and UPDATE/DELETE on ledger/activity tables is blocked by triggers (tested directly against Postgres). Admin "Ledger health" shows the trial balance (must be 0).

**D-070 Timers: the worker owns the clock, the API owns the logic.** Submitting a milestone enqueues delayed BullMQ jobs (auto-approve after N days, default 5; reminders 3 and 1 days before). The worker calls `POST /v1/internal/milestones/:id/{auto-approve,remind}` with a shared `INTERNAL_API_TOKEN`; the API re-checks everything (still `submitted`, due, project active so timers freeze while paused) and is idempotent. This keeps all money logic in one place and was verified end to end against the real worker container.

**D-071 Payout rails.** Only `manual_bank` is live: seller requests (min $20, serialised per seller with an advisory lock), Operations marks it paid (bank reference required) or failed (balance returns). Stripe Connect/Global Payouts are listed as unavailable in the API response until Q1/Q6 are answered. Stripe Connect Express onboarding is therefore **not built**.

**D-072 Known money edge cases (documented, not hidden).**

- If the provider refund succeeds but the DB transaction then fails, retrying the same action completes it (the provider call is idempotent per payment).
- Disputes/partial refunds/splits arrive in Phase 5; until then only funded-but-unstarted milestones can be refunded by Operations.
- Receipts are generated on demand from stored line items (not stored PDFs). Legal entity text on them is a placeholder until Q2.
- UUIDv7 id prefixes are time-based and **not unique**; admin UIs show names and the random id tail (found by an e2e collision).

---

## 9e. Phase 4 — Live Project Room (2026-10-11)

**D-073 One access policy for REST and sockets.** `AccessService` is the only place that answers "may this user see that?" (project role, conversation membership, file readability). Controllers and the Socket.io gateway both call it. Everything unauthorised, malformed or unknown looks identical to the caller (404 / `{ok:false}`), so existence never leaks. **File reads:** a file is downloadable only when it is `clean` AND (owned by the caller, or delivered in a project they participate in, or attached to a conversation they belong to). The old owner-only `/me/files/:id` is unchanged.

**D-074 Health is computed, never stored.** `computeHealth` (shared, unit-tested) derives on-track / at-risk / blocked + a plain-English reason from facts on every read: paused/disputed/cancelled → blocked; next milestone waiting for the buyer to fund → blocked; past planned date, >3 days waiting for review, or 3+ revision rounds → at risk. The `projects.health` columns are therefore unused. **Progress** now feeds task completion into in-progress milestones (up to 60% of a milestone), then submitted 80%, approved/released 100%, weighted by amount; the acceptance test asserts exact values at every step.

**D-075 Realtime model.** One authenticated socket per page. Rooms: `user:{id}`, `conv:{id}`, `project:{id}`; the server verifies membership on every `room:join` and only relays typing for rooms the socket joined. Every client payload is zod-validated. The server emits a lightweight `project:event` and clients refetch (no state duplication, no polling); messages and notifications are pushed directly. Presence is **per user across sockets** (online while any socket is connected; "offline" is emitted to rooms when the last socket closes), kept in Redis sets so it works across API instances. Closing a browser abruptly can take socket.io's ping timeout (~45 s) to register.

**D-076 Chat.** Project chat is created lazily for exactly the project's participants; direct chats exist per buyer↔seller pair (only with a published seller, so strangers can't be spammed). 30 messages/minute/user (429). Attachments are the sender's own clean `message` files, readable by conversation members only. Read receipts only move forward. Notifications for chat collapse into one unread row per conversation. `safety_flags` is reserved for Phase 5 chat-safety checks.

**D-077 Custom offers (moved from Phase 3).** A published seller sends an offer (title, description, milestone plan) in a direct chat; the buyer accepts with an `Idempotency-Key`, which creates the project through the same factory as orders and proposals. Decline (buyer) / withdraw (seller) are final and post a system message.

**D-078 Deliverables.** Versioned per milestone; a new upload supersedes earlier ones; the milestone decision is mirrored onto the latest version (revision requested / approved). Submitting a milestone does **not** yet require a deliverable (a link-only or service-only delivery is legitimate); revisit in Phase 9. Feedback is pinned with an anchor (`page`, `region` as 0–1 fractions, `timecode`); the UI offers click-to-pin on images and page/time inputs for others. Preview links are https-only (no `javascript:`/`http:`) and carry "last updated".

**D-079 Notifications.** One service fans out per recipient to in-app (+ realtime), email (queue) and web push, honouring per-type preferences with sensible defaults (money/milestone/offer emails on; chat/comment emails off). Web push needs VAPID keys, is disabled without them, and **is verified only at the unit level (mocked push service); a real browser has not been tested** (needs HTTPS or localhost with keys).

**D-080 File scanning (ClamAV) is opt-in.** `SCAN_MODE=off` (default, dev) marks uploads clean immediately; `SCAN_MODE=clamav` keeps them `uploaded` (not downloadable) until the worker streams the object to clamd (`zINSTREAM`) and reports a verdict to the API (token-authenticated internal route; verdicts are final; infected objects are deleted best-effort). Production **refuses** `SCAN_MODE=off`. The clamd client is tested against a protocol-faithful fake server (clean, EICAR/FOUND, chunking, error replies never treated as clean); **the real ClamAV container has not been run** (≈1–1.5 GB RAM, large image: `docker compose --profile scan up -d clamav`).

**D-081 Mobile header.** Browse and Dashboard collapse to icons below 640 px so the "by KorvenzaTech" lockup stays intact next to the notification bell.

---

## 9f. Phase 5 — Trust (2026-10-11)

**D-082 Reviews.** Two kinds only: **private milestone feedback** (buyer → seller, after a milestone is paid; never public, never in ratings) and **one public final review** per project with four ratings (overall, communication, quality, timeliness). Eligibility is enforced server-side: the paying buyer of a **completed** project with at least one **released** milestone; once; it moves the project `completed → reviewed`. The seller may reply **once** to a public review. Reviewers are shown as first name + last initial (never email). Unique partial indexes make "once" a database guarantee.

**D-083 Seller levels are computed, never stored or granted.** `computeSellerLevel` (shared, unit-tested, criteria published at `/seller-levels` and `GET /v1/seller-levels`) needs ALL of: completed projects, public review count, average rating and on-time delivery (milestone submitted on/before the planned date). Levels: New → Level 1 (3 / 3 / 4.0 / 80%) → Level 2 (10 / 8 / 4.5 / 90%) → Top rated (25 / 20 / 4.7 / 95%). The thresholds are monotonic (tested), so the search "minimum level" filter is well-defined. Response time is **not** a criterion yet (we don't measure it honestly). The same SQL aggregates feed profiles, cards and filters via `SellerStatsService`.

**D-084 Search trust filters, now with real data.** Minimum rating, minimum level, verified-only and a "top rated" sort. Sellers without reviews never match a rating filter (no data ≠ 0 stars). The ranking `ORDER BY` still never reads `operated_by_platform` (D-063 test unchanged and passing).

**D-085 Verifications.** A badge is shown only while `status = verified`, never while pending or rejected. Store-listing links must point at the real store domains; identity needs a scanned `evidence` file that only admins (operations/product) can open, through a dedicated audited route. **A linked GitHub OAuth account counts automatically** (the platform can prove it), with no admin review. Skill tests are admin-granted.

**D-086 Change requests.** Either party proposes, the **other** party answers; one open request per project; project must be active. Acceptance (transactional, row-locked) appends the proposed milestones **unfunded** (so the buyer funds them like any milestone), raises the project total, and shifts open milestones' planned dates. It never touches funds already held. Negative price changes are not supported.

**D-087 Disputes.** Either party can open one on a **funded, unfinished** milestone (in progress / submitted / revision requested) while the project is active. The milestone and project freeze (auto-approve skips non-`submitted` milestones; tested), and an evidence **case file is snapshotted automatically** (project chat, deliverable versions + feedback counts, event timeline, scope changes, milestone dates/notes). Parties add notes/scanned evidence files, which both parties (and admins) can read. **Resolution (operations/product only, reason required, audited):**

- **Release:** like an approval (commission fixed at funding).
- **Refund:** full refund of milestone **and** buyer fee; provider refund is idempotent.
- **Split:** `refundAmount` returned to the buyer (1 … amount−1); the seller receives the rest minus a **pro-rated commission**; the buyer fee is **kept** (service was provided). Ledger arithmetic is tested to the cent.
  The project returns to active (work remains), completes (something was paid) or is cancelled (nothing paid) only when its **last** open dispute closes. Withdrawing a dispute is not supported yet.

**D-088 Chat safety.** In **direct (pre-order) chats only**, messages are scanned for emails, phone numbers, external messengers and off-platform payment phrases. The message is **never blocked or altered**; it is flagged, an audit row is written, and both parties see the warning. The detector is a conservative heuristic with tests for false positives (e.g. "signal handling", prices, versions); false negatives are expected. After an order exists the project chat is not scanned.

**D-089 Reports and moderation.** Users can report users, live services, messages in their own conversations and public reviews (self-reports refused, one open report per target, 10/hour). Operations/product admins decide with a note, and can **ban** (sessions deleted, live listings paused, staff accounts protected, audited), **unban**, or **take down** a listing with a reason shown to the seller. A banned account is treated as signed out **everywhere** (HTTP and sockets) because `SessionService.resolve` checks `banned_at` on every request, even with a still-cached session. ⚠ A banned user can still complete the sign-in form (it yields a dead session); blocking at sign-in is a follow-up.

**D-090 Moved/limits.** No re-open/withdraw for disputes, no automatic escalation of cancellation requests, no reviewer-visible "response time" metric. Reports about reviews/messages are triaged manually.

---

## 9g. Phase 6 — AI (2026-10-12)

**D-091 One door to the model.** All AI goes through `AiService` → `AiProvider` (`stub` | `anthropic` | `off`, env `AI_PROVIDER`). The model never gets tools; user text is passed inside tagged blocks described as data; every answer is validated against a zod schema (structured outputs via the official `@anthropic-ai/sdk`). Default model `claude-opus-5-5`, effort `medium`, both configurable. Refusals and truncations become a clean 503. ⚠ The Anthropic calls are **unverified against the live API** (no key yet); they are unit-tested with a fake client only. Server-side refusal fallbacks are not enabled.

**D-092 Metering and caps.** Every call (including failures) writes `ai_usage` with real token counts and cost in micro-USD (integer, rounded up; unknown models are priced as the most expensive known). Before each call: per-user hourly rate limit (default 30), per-user daily cap (default $1) and platform daily cap (default $20), all UTC, all 429 with a clear message. These are pre-checks, so one in-flight call can overshoot slightly. Admins (operations/product) see cost per feature per day, never prompts or outputs.

**D-093 Stub provider.** In dev/CI the stub returns deterministic answers from the same real data (rules-based fallbacks) and simulates token usage so caps are testable. It is refused in production; `off` disables features. Rules text is never labelled "AI".

**D-094 Brief builder.** Idea → up to 4 clarifying questions → structured brief (goals, stories, platforms, integrations, milestones, budget/timeline **estimates**, open questions). The buyer edits, then posts it as an ordinary request (`briefs.aiGenerated`). Estimates are labelled "not a quote" everywhere.

**D-095 Matching is rules first, AI explains.** Ranking is deterministic from real data (skills 35%, reviews 20%, budget fit 15%, verified 10%, reply speed 10%, availability 10%); a seller with no relevant skill is never suggested; no reviews scores low-neutral. The AI only writes the explanation from the factor JSON; if it fails, a plain-language summary of the same factors is shown. Response time is a real median first-reply time from direct chats others started (90 days).

**D-096 Progress reports.** Facts come from real rows (tasks, milestone dates, change requests, disputes). Drafts are private to the seller; the seller edits and sends; only then does the buyer see it and get notified. Weekly: a BullMQ scheduler (Mon 07:00 UTC) calls an internal route that drafts for active projects with activity and no report in 6 days; it never sends. If the AI is capped or off, the draft uses the rules text.

**D-097 Meeting notes to tasks.** The seller pastes notes (recording and transcripts arrive with video in Phase 7); suggestions are not saved until the seller confirms; created tasks have `source = meeting_ai`. Non-seller participants get 422, outsiders 404.

**D-098 Seller analytics.** Earnings (transfers net of commission, USD only for now), escrow held, proposal conversion, median reply time, on-time rate, repeat buyers, completed count and rating are computed live, with seed data excluded (D-027). Nothing to measure shows `null` ("not enough data yet"), never zero.

---

## 10. Open questions for Rashid (non-blocking unless marked)

Answers so far (2026-10-11):

- Q1: undecided; the partners will decide with an accountant/lawyer before Phase 3. Everything stays provider-agnostic.
- Q4: undecided; build as admin settings (D-045).
- Q5: provisional; roles stay configurable (D-003).
- Q7: private repo coming; remote gets added when Rashid sends the URL. Doesn't block Phase 0.
- Logo: the SVG wasn't in the message or the folder; Phase 0 uses a text lockup until it arrives.

1. **Q1 — Legal entity & country for the Stripe platform account** (blocks _live_ payments only; test mode goes ahead). Which registered entity operates Glasswork's payments?
   - A US LLC (e.g. via Stripe Atlas) or a UK Ltd unlocks Connect + Global Payouts to Pakistan.
   - A Pakistan-only entity can't open a Stripe platform account at all.
   - Talk to an accountant/lawyer about tax and money-transmission obligations.
2. **Q2 — Registered company name + address** for Terms, Privacy, Seller Agreement and invoices.
3. **Q3 — Domain** for Glasswork. Interim suggestion: `glasswork.korvenzatech.com` for staging.
4. **Q4 — Fee model** (needed by Phase 3): e.g. buyer service fee X% + seller commission Y%? Any minimums?
5. **Q5 — Admin role mapping** in D-003: correct?
6. **Q6 — Payout rails priority** for Pakistani sellers: Global Payouts (needs US/UK entity), Payoneer, or manual bank transfer to start?
7. **Q7 — GitHub:** create a **private** repo (`Muhammad-Rashid-172002/glasswork` or a KorvenzaTech org?) so CI can run. I'll set the remote once you create it.
8. **Q8 — Hosting region:** Hetzner (EU/US, cheapest) or DigitalOcean (has Bangalore/Singapore, closer to PK)? Depends on where buyers are; I lean US-East or EU for international buyers.
9. **Q9 — Email sender domain** for Resend (needs DNS records on the final domain).
10. **Q10 — Auto-approval window:** OK with 5 days (D-022)?
