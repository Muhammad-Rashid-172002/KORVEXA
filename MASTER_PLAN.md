# MASTER_PLAN — Glasswork by KorvenzaTech

Source of truth for progress. Built from docs/BRIEF.md §12; decisions live in DECISIONS.md.
Rule (brief §3): continue from the first unchecked item and never redo ticked work. Each ticked item records files changed, known issues and what to test manually.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (reason inline)

---

## Phase 0 — Foundation  ·  branch `phase/0-foundation`

### 0.A Planning (CHECKPOINT A: approval needed before any code)
- [x] Read CLAUDE.md + docs/BRIEF.md; check the environment (Mac: Node 22.18.0, pnpm 12.11.2, Docker 29.8.2, Compose v5.5.1)
- [x] MASTER_PLAN.md (this file)
- [x] DECISIONS.md: stack + exact versions, auth, folder structure, payments abstraction, open questions
- [x] docs/ERD.md: database ERD (Mermaid)
- [x] docs/STATE_MACHINE.md: project + milestone state machines (Mermaid)
- [x] **Rashid approves DECISIONS.md + ERD** (2026-10-11)

### 0.B Repo & tooling
- [ ] `git init`, `.gitignore`, `.editorconfig`, `.nvmrc`, `packageManager` pin, README.md, SETUP.md
- [ ] pnpm workspaces + Turborepo (`build`, `dev`, `lint`, `typecheck`, `test`, `test:e2e` pipelines)
- [ ] Shared tsconfig base (strict), ESLint flat config, Prettier, lint-staged + husky pre-commit
- [ ] `packages/shared`: brand.ts (Glasswork), env schema (zod), enums, state-machine definitions + unit tests, typed socket events
- [ ] `packages/ui`: Tailwind v4 preset with brand tokens, shadcn/ui base (Button, Input, Card, Label, Form), dark + light theme

### 0.C Infrastructure
- [ ] `infra/docker-compose.yml`: postgres, redis, minio (+ bucket bootstrap), mailpit, api, worker, web, with healthchecks
- [ ] Dockerfiles (multi-stage, non-root) for api, worker, web
- [ ] `.env.example` (every variable documented); config validated with zod at boot (fail fast)
- [ ] One command: `pnpm dev:up` (whole stack in Docker) plus `pnpm dev` (infra in Docker, apps on host with hot reload)

### 0.D Database
- [ ] `packages/db`: Drizzle schema for the Phase 0 tables (users, accounts, sessions, verifications, profiles, audit_logs, files) + enums for the whole ERD
- [ ] First migration generated and committed; `pnpm db:migrate`
- [ ] Seed script (dev only, refuses to run when NODE_ENV=production; every seeded row tagged `is_seed=true`)

### 0.E API (NestJS + Fastify)
- [ ] App bootstrap: Fastify adapter, pino logging, helmet/security headers, CORS allow-list, global zod validation, standard error format, `/v1` prefix, `/health` + `/ready`
- [ ] OpenAPI generation (`/v1/docs` in dev; spec exported to `packages/shared/openapi.json`)
- [ ] Rate limiting (Redis-backed) on auth routes
- [ ] Sentry wiring (no-op when `SENTRY_DSN` is empty)

### 0.F Auth end-to-end
- [ ] Better Auth mounted at `/v1/auth/*`, Drizzle adapter, argon2id password hashing
- [ ] Register → verification email (React Email → Mailpit) → verify → login → logout
- [ ] Google + GitHub OAuth wired (keys are TODO; buttons hidden when keys are absent)
- [ ] httpOnly, Secure, SameSite=Lax session cookie; bearer plugin enabled for the future Flutter app

### 0.G Authorization proof
- [ ] Policy layer (`@Policy()` decorator + guard + explicit policy functions) and a scoped repository pattern
- [ ] One protected endpoint (`GET /v1/me/files/:id`) + policy tests: owner OK, other user 404, anonymous 401

### 0.H Realtime
- [ ] Socket.io gateway with Redis adapter, session-cookie handshake auth, rejects unauthenticated sockets, typed `ping`/`pong` event; tests for auth reject/accept

### 0.I Files
- [ ] Presigned PUT upload to MinIO (size + MIME allow-list, per-user key prefix), `files` row, presigned GET only for the owner; tests for the cross-user denial

### 0.J Worker
- [ ] BullMQ worker app: `email` queue (verification mail sent via the queue), graceful shutdown, health

### 0.K Web (Next.js)
- [ ] App Router shell with the "Glasswork by KorvenzaTech" header/footer from brand.ts, themes
- [ ] Pages: /signup, /login, /verify-email, /dashboard (protected), logout; typed API client generated from OpenAPI
- [ ] Demo widgets on /dashboard: socket connection status + file upload

### 0.L Quality & CI
- [ ] Vitest unit tests (shared, api); integration tests against real Postgres/Redis (Testcontainers in CI, local services in the sandbox)
- [ ] Playwright e2e: signup → Mailpit verify → login → dashboard → upload → logout; screenshots at 1440 and 390 into git-ignored `artifacts/`
- [ ] GitHub Actions: install, lint, typecheck, unit, integration, e2e, build, `pnpm audit`
- [ ] All green locally in the sandbox

### 0.M Checkpoint report (CHECKPOINT B)
- [ ] One-command run instructions, demo script, screenshots, test results, TODO keys/accounts list
- [ ] Rashid confirms `pnpm dev:up` on the Mac → merge `phase/0-foundation` into `main`

---

## Phase 1 — Accounts & profiles
- [ ] Buyer/seller mode switch (one account, both roles)
- [ ] Profiles (public profile, avatar via presigned upload)
- [ ] Organizations + org_members (buyer teams, seller agencies) with invites
- [ ] Seller onboarding wizard: profile, skills, portfolio, rates, payout method placeholder, identity verification placeholder
- [ ] Portfolio items CRUD
- [ ] Session list + "log out everywhere"; password reset; optional TOTP 2FA
- [ ] Admin skeleton: role-gated layout, users list, audit log viewer; admin roles (Product/Tech, Growth, Operations)
- [ ] Policy tests for every new endpoint
- [ ] CHECKPOINT: demo script, screenshots, TODOs, Phase 2 plan

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
