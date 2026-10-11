# MASTER_PLAN — Glasswork by KorvenzaTech

Source of truth for progress. Built from docs/BRIEF.md §12; decisions live in DECISIONS.md.
Rule (brief §3): continue from the first unchecked item and never redo ticked work. Each ticked item records files changed, known issues and what to test manually.

## ▶ RESUME HERE (updated 2026-10-11)

Phases 0–1 done and on `main` (Phase 1 commits were made directly on `main`; `phase/1-accounts` is a marker branch at the same commit). Next: **Phase 2 — Services & discovery** on branch `phase/2-services`.

- Verified 2026-10-11: `pnpm dev:up` (7 services healthy, `/ready` ok, RustFS storage smoke test ok), lint/typecheck/unit (23 turbo tasks), 34 integration tests, 16 Playwright e2e tests (desktop + mobile).
- Remaining unverified: first GitHub Actions run (no repo yet), OAuth with real keys.

## ⏳ WAITING ON RASHID

| Item                                                                | Needed for                                           | Status                                                                                                                                           |
| ------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Legal entity + country for the Stripe platform account (Q1)         | Live payments (Phase 3+); test mode works without it | Partners deciding with accountant/lawyer                                                                                                         |
| Fee values: buyer service fee %, seller commission %, minimums (Q4) | Phase 3 checkout                                     | Admin settings exist, set to 0                                                                                                                   |
| Admin role mapping confirmation (Q5)                                | Admin area                                           | Provisional: Rashid=product, Taha=growth, Suliman=operations                                                                                     |
| GitHub repo URL (Q7)                                                | CI first run, push                                   | A remote `origin` → github.com/Muhammad-Rashid-172002/KORVEXA exists (not added by me). Confirm it is the intended repo; nothing has been pushed |
| KorvenzaTech K logo SVG                                             | Header lockup, product mark                          | Text lockup in use                                                                                                                               |
| Domain (Q3), registered company name + address (Q2)                 | brand.ts, legal pages, cookies, email DNS            | TODO in brand.ts                                                                                                                                 |
| Google + GitHub OAuth keys                                          | Social login                                         | Buttons hidden until set                                                                                                                         |
| Resend API key + sender domain (Q9), Sentry DSNs                    | Production email, error tracking                     | Off locally (Mailpit / no-op Sentry)                                                                                                             |

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (reason inline)

---

## Phase 0 — Foundation · branch `phase/0-foundation`

### 0.A Planning (CHECKPOINT A: approval needed before any code)

- [x] Read CLAUDE.md + docs/BRIEF.md; check the environment (Mac: Node 22.18.0, pnpm 12.11.2, Docker 29.8.2, Compose v5.5.1)
- [x] MASTER_PLAN.md (this file)
- [x] DECISIONS.md: stack + exact versions, auth, folder structure, payments abstraction, open questions
- [x] docs/ERD.md: database ERD (Mermaid)
- [x] docs/STATE_MACHINE.md: project + milestone state machines (Mermaid)
- [x] **Rashid approves DECISIONS.md + ERD** (2026-10-11)

### 0.B Repo & tooling

- [x] `git init`, `.gitignore`, `.editorconfig`, `.nvmrc`, `packageManager` pin, README.md, SETUP.md
- [x] pnpm workspaces + Turborepo (`build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e` pipelines)
- [x] Shared tsconfig base (strict), ESLint flat config, Prettier, lint-staged + husky pre-commit
- [x] `packages/shared`: brand.ts (Glasswork), env schema (zod), enums, state-machine definitions + unit tests, typed socket events
- [x] `packages/ui`: Tailwind v4 preset with brand tokens, shadcn/ui base (Button, Input, Card, Label, Alert, Badge), dark + light theme

### 0.C Infrastructure

- [x] `infra/docker-compose.yml`: postgres, redis, rustfs (bucket bootstrapped by the API), mailpit, api, worker, web, with healthchecks
- [x] Dockerfiles (multi-stage, non-root) for api, worker, web
- [x] `.env.example` (every variable documented); config validated with zod at boot (fail fast)
- [x] One command: `pnpm dev:up` (whole stack in Docker) plus `pnpm dev` (infra in Docker, apps on host with hot reload)

### 0.D Database

- [x] `packages/db`: Drizzle schema for the Phase 0 tables (users, accounts, sessions, verifications, profiles, audit_logs, files) + enums for the whole ERD
- [x] First migration generated and committed; `pnpm db:migrate`
- [x] Seed script (dev only, refuses to run when NODE_ENV=production; every seeded row tagged `is_seed=true`)

### 0.E API (NestJS + Fastify)

- [x] App bootstrap: Fastify adapter, pino logging, helmet/security headers, CORS allow-list, global zod validation, standard error format, `/v1` prefix, `/health` + `/ready`
- [x] OpenAPI generation (`/v1/docs` in dev; spec exported to `packages/shared/openapi.json`)
- [x] Rate limiting (Redis-backed) on auth routes
- [x] Sentry wiring (no-op when `SENTRY_DSN` is empty)

### 0.F Auth end-to-end

- [x] Better Auth mounted at `/v1/auth/*`, Drizzle adapter, argon2id password hashing
- [x] Register → verification email (React Email → Mailpit) → verify → login → logout
- [x] Google + GitHub OAuth wired (keys are TODO; buttons hidden when keys are absent) — _not exercised against real providers until keys exist_
- [x] httpOnly, Secure, SameSite=Lax session cookie; bearer plugin enabled for the future Flutter app

### 0.G Authorization proof

- [x] Policy layer (`@Policy()` decorator + guard + explicit policy functions) and a scoped repository pattern
- [x] One protected endpoint (`GET /v1/me/files/:id`) + policy tests: owner OK, other user 404, anonymous 401

### 0.H Realtime

- [x] Socket.io gateway with Redis adapter, session-cookie handshake auth, rejects unauthenticated sockets, typed `ping`/`pong` event; tests for auth reject/accept

### 0.I Files

- [x] Presigned PUT upload to S3 storage (RustFS locally) (size + MIME allow-list, per-user key prefix), `files` row, presigned GET only for the owner; tests for the cross-user denial

### 0.J Worker

- [x] BullMQ worker app: `email` queue (verification mail sent via the queue), graceful shutdown, health

### 0.K Web (Next.js)

- [x] App Router shell with the "Glasswork by KorvenzaTech" header/footer from brand.ts, themes
- [x] Pages: /signup, /login, /verify-email, /dashboard (protected), logout; typed API client generated from OpenAPI
- [x] Demo widgets on /dashboard: socket connection status + file upload

### 0.L Quality & CI

- [x] Vitest unit tests (shared, api); integration tests against real Postgres/Redis (Testcontainers in CI, local services in the sandbox)
- [x] Playwright e2e: signup → Mailpit verify → login → dashboard → upload → logout; screenshots at 1440 and 390 into git-ignored `artifacts/`
- [~] GitHub Actions: install, lint, typecheck, unit, integration, e2e, build, `pnpm audit` — _written; first run happens when the GitHub repo exists_
- [x] All green locally in the sandbox

### 0.L+ Fixes after Mac run #1

- [x] Replace MinIO with RustFS; storage smoke test; `pnpm dev:pull` with retries; slow-network pnpm settings; ignore `Claude outputs/` and screenshot folders

### 0.M Checkpoint report (CHECKPOINT B)

- [x] One-command run instructions, demo script, screenshots, test results, TODO keys/accounts list
- [x] `pnpm dev:up` verified on the Mac (2026-10-11) → `phase/0-foundation` merged into `main`

---

### Phase 0 log (2026-10-11)

**Verified in the build sandbox:** lint, typecheck and unit tests across 9 workspaces; 16 API integration tests (auth flow, policy, realtime, rate limit) on real Postgres + Redis; 8 Playwright e2e tests (desktop 1440 + mobile 390) against the production builds of api/worker/web; the same e2e also passed against `pnpm dev`; the Docker build steps (install → turbo build → `pnpm deploy` bundles) replayed outside Docker, with migrations, seed, API and worker run from the pruned bundles.

**`[~]` = not verifiable in the sandbox** (it has no Docker engine): `docker compose up` itself, the RustFS/Mailpit images (the sandbox used S3/SMTP stand-ins), and the first CI run. Rashid's Mac checklist covers these.

**Files (by area):** `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.env.example`, `README.md`, `SETUP.md`, `.github/workflows/ci.yml`, `infra/docker-compose.yml`, `infra/docker/Dockerfile`, `scripts/wait-for-stack.mjs`, `packages/{config,shared,db,emails,ui}/**`, `apps/{api,worker,web}/**`, `e2e/**`.

**Known issues / follow-ups:**

- 2026-10-11 Mac run #1 failed: the MinIO image is no longer pullable. Fixed by switching local storage to RustFS 1.0.1 (D-046), adding `pnpm dev:pull` with retries (D-047), and adding a storage smoke test at the end of `dev:up`. RustFS itself can't run in the sandbox (no Docker, no access to its binaries), so the smoke test on the Mac is the first real RustFS check.
- OAuth is untested until real Google/GitHub keys exist.
- CSP uses `'unsafe-inline'` for scripts (Next.js hydration); nonce-based CSP is planned for Phase 9.
- Rotating refresh tokens for mobile: Phase 1 (D-010).
- No ClamAV yet; files are owner-only until Phase 4 (D-030).
- Logo SVG not received; the header uses a text lockup.

**Manual test:** see the Phase 0 checkpoint demo script (in the chat report and SETUP.md §2).

---

## Phase 1 — Accounts & profiles · branch `phase/1-accounts`

- [x] Buyer/seller mode switch (one account, both roles) — `PATCH /v1/me/mode`, `POST /v1/me/seller`, `/settings`
- [x] Profiles (public profile `/u/[slug]`, avatar via presigned upload)
- [x] Organizations + org_members (buyer teams, seller agencies) with email invites — `/orgs`, `/invites/accept`
- [x] Seller onboarding wizard: profile, skills, portfolio, rates, payout placeholder, identity placeholder — `/seller/onboarding`
- [x] Portfolio items CRUD (images via presigned upload are supported by the API; the wizard UI takes title/link/description)
- [x] Session list + "log out everywhere"; password reset (`/forgot-password`, `/reset-password`); optional TOTP 2FA (`/settings`, `/two-factor`)
- [x] Admin skeleton: role-gated layout, users list (search), audit log viewer (filter), product-scope admin-scope assignment (API)
- [x] Policy tests for every new endpoint (`apps/api/test/accounts.int.test.ts`, 17 tests + CORS preflight test)
- [x] CHECKPOINT (log only): see Phase 1 log below

### Phase 1 log (2026-10-11)

**Tested on the real Docker stack:** lint + typecheck + unit (23 turbo tasks), 34 integration tests (Testcontainers Postgres/Redis), 16 Playwright e2e tests (desktop 1440 + mobile 390) incl. seller wizard → publish → anonymous visitor sees the public profile, forgot-password via Mailpit, org create/invite, sessions panel, admin 404 vs. seeded admin.

**Files (by area):** `packages/db/src/schema/accounts.ts` (+ auth.ts, enums.ts), migrations `0002`/`0003`, `packages/shared/src/accounts.ts`, `packages/emails` (org-invite), `apps/api/src/modules/{profiles,orgs,sessions,admin}`, `apps/api/src/auth/auth.ts` (twoFactor), `apps/api/src/bootstrap.ts` (CORS fix), `apps/web/app/{settings,seller,u,orgs,invites,admin,forgot-password,reset-password,two-factor}`, `apps/web/lib/{gw,server-gw,safe-next}.ts`, `e2e/tests/accounts.spec.ts`, seed (dev seller `dev-seller`).

**Known issues / follow-ups:**

- Admin UI is read-only; assigning scopes is API-only for now (no user ban/verify tools yet; those come with Phase 5 trust tooling).
- Portfolio image upload exists in the API but the wizard has no image picker yet.
- The 2FA UI (setup, `/two-factor` step) has no browser e2e; the full flow is covered at API level with real TOTP codes.
- Invite emails go to Mailpit locally; accepting requires logging in with the invited address.
- Refresh-token rotation for the future Flutter app (D-010 pushback) still pending; revisit before a mobile client exists.

**Manual test:** sign up → `/settings` → Become a seller → switch mode → `/seller/onboarding` → fill the steps → Publish → open the public link in a private window. Then `/orgs` → create a team → invite an email (check Mailpit). Log in as `admin@dev.glasswork.test` / `Glasswork-dev-123!` → `/admin`.

## Phase 2 — Services & discovery

- [ ] Services (gigs) CRUD with Basic/Standard/Premium packages, extras, FAQs, gallery, requirements form, delivery times
- [ ] Gig moderation queue (admin)
- [ ] SearchService (Postgres FTS + pg_trgm) behind an interface; filters (category, budget, delivery time, seller level, verified only, rating) and sorting
- [ ] Public SEO gig/seller pages with JSON-LD structured data, sitemap
- [ ] Favorites, saved searches
- [ ] "Operated by KorvenzaTech" label; ranking-neutrality test
- [ ] CHECKPOINT

## Phase 3 — Orders & payments (Stripe test mode)

- [ ] PaymentsService + PayoutsService interfaces; Stripe adapter (test mode)
- [ ] Package checkout → project + milestones; idempotency keys
- [ ] Milestone funding (charge to the platform balance) + escrow_holds
- [ ] Double-entry ledger (append-only) + balance invariants test
- [ ] Payout-method onboarding (Connect Express where supported; payout rail per DECISIONS D-020)
- [ ] Release on approval → transfer/payout; auto-approve timer (worker)
- [ ] Webhooks: signature verification, raw event store, idempotent processing, admin replay
- [ ] Fee settings + transparent fee breakdown before payment; invoices/receipts PDF
- [ ] Buyer requests board + proposals with milestone plans; custom offers from chat
- [ ] CHECKPOINT

## Phase 4 — Live Project Room

- [ ] Overview: weighted % progress, current milestone, next deadline, health + reason, escrow vs released
- [ ] Timeline: planned vs actual
- [ ] Board: Kanban tasks linked to milestones (seller manages, buyer comments)
- [ ] Deliverables: versioned uploads, approve / request revision, feedback pinned to file/region; ClamAV scan before download
- [ ] Preview links (staging, Figma, APK/TestFlight, video) with "last updated"
- [ ] Activity feed (filterable)
- [ ] Realtime chat: files, read receipts, typing, presence
- [ ] Notifications: in-app, email, web push; per-type preferences
- [ ] ACCEPTANCE: a buyer follows a 3-milestone project end to end with accurate progress at every step (Playwright)
- [ ] CHECKPOINT

## Phase 5 — Trust

- [ ] Reviews: per-milestone private feedback, public final review with sub-ratings, one seller reply, only paying buyers with completed work
- [ ] Seller levels from real metrics, criteria published
- [ ] Verifications + badges (identity, GitHub, Play/App Store link, portfolio reviewed, skill test)
- [ ] Change requests (time/price impact → milestones updated → funding required)
- [ ] Disputes: auto-built case file, evidence, admin resolution (refund/release/split)
- [ ] Chat safety warnings (contact/payment details before an order; log, don't block)
- [ ] Reports (user/gig reporting) + admin handling
- [ ] CHECKPOINT

## Phase 6 — AI

- [ ] AI module: Claude API server-side, per-user rate limits, daily cost caps, usage table
- [ ] AI Brief Builder
- [ ] AI Matching with explanations
- [ ] Weekly + on-demand progress reports (seller edits before sending)
- [ ] Meeting notes → Board tasks
- [ ] Seller analytics dashboard (real data only)
- [ ] CHECKPOINT

## Phase 7 — Meetings & integrations

- [ ] VideoService interface + LiveKit or Daily adapter; consented recording
- [ ] GitHub App: commits, PRs and deployments in plain language
- [ ] Calendar invites (ICS)
- [ ] CHECKPOINT

## Phase 8 — Landing & marketing

- [ ] Landing page: R3F + GSAP 3D hero (project moving through milestones), poster-first LCP, reduced-motion support
- [ ] About page, "by KorvenzaTech" lockups, product mark
- [ ] Legal drafts (flagged for lawyer review): Terms, Privacy, Seller Agreement, Buyer Protection, Acceptable Use, Cookie Policy; contract + NDA templates with e-acceptance
- [ ] SEO (metadata, OG images, sitemap), PostHog analytics events, cookie consent
- [ ] CHECKPOINT

## Phase 9 — Hardening & launch

- [ ] Load tests (k6) on critical paths
- [ ] OWASP Top 10 review + fixes
- [ ] Accessibility audit (WCAG 2.2 AA)
- [ ] Lighthouse ≥ 90 on public pages
- [ ] Production deploy: VPS + Docker + Caddy, managed Postgres, R2; deploy on main
- [ ] Backups + nightly restore verification; uptime monitoring
- [ ] Data export + account deletion flows
- [ ] Runbooks in docs/; launch checklist
- [ ] FINAL CHECKPOINT
