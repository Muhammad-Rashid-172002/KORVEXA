# MASTER_PLAN — Glasswork by KorvenzaTech

Source of truth for progress. Built from docs/BRIEF.md §12; decisions live in DECISIONS.md.
Rule (brief §3): continue from the first unchecked item and never redo ticked work. Each ticked item records files changed, known issues and what to test manually.

## ▶ RESUME HERE (updated 2026-10-28)

Phases 0–8 done. **2026-10-28: Rashid switched to FULL AUTONOMY MODE** (no checkpoints; the agent self-reviews). Work this session on branch `phase/9-hardening`: Phase 8 self-review and fixes, Phase 9 hardening, Phase 10 preparation (nothing deployed). See "Autonomy session log" at the end of this file for the exact state, then continue from the first unchecked item.

- Local stack: `pnpm dev:up && pnpm db:seed:demo` (site http://localhost:3000, accounts in the log below).
- Disk rules: single-service rebuilds (`pnpm dev:up:web|api|worker`), `pnpm dev:clean` after full runs, `docker builder prune -af` if the Docker cache balloons (it reached 116 GB once), warn under 15 GB free.
- **Deployment rule unchanged: nothing is deployed until Rashid says "deploy".**

## ⏳ WAITING ON RASHID

| Item                                                                  | Needed for                                                                                         | Status                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Legal entity + country for the Stripe platform account (Q1)           | Live payments (Phase 3+); test mode works without it                                               | Partners deciding with accountant/lawyer                     |
| Stripe TEST keys (`sk_test_…`) + webhook secret                       | Verifying the real Stripe adapter (checkout/refund); the built-in test provider works without them | Not provided; app runs on the test provider                  |
| Fee values: buyer service fee %, seller commission %, minimums (Q4)   | Phase 3 checkout                                                                                   | Admin settings exist, set to 0                               |
| Admin role mapping confirmation (Q5)                                  | Admin area                                                                                         | Provisional: Rashid=product, Taha=growth, Suliman=operations |
| KorvenzaTech K logo SVG                                               | Header lockup, product mark                                                                        | Text lockup in use                                           |
| Domain (Q3), registered company name + address (Q2)                   | brand.ts, legal pages, cookies, email DNS                                                          | TODO in brand.ts                                             |
| Google + GitHub OAuth keys                                            | Social login                                                                                       | Buttons hidden until set                                     |
| Anthropic API key (`ANTHROPIC_API_KEY`, then `AI_PROVIDER=anthropic`) | Real AI answers (Phase 6)                                                                          | Not provided; runs on the offline stub                       |
| Resend API key + sender domain (Q9), Sentry DSNs                      | Production email, error tracking                                                                   | Off locally (Mailpit / no-op Sentry)                         |
| **Phase 10 — production accounts (see Phase 10 for detail)**          |                                                                                                    |                                                              |
| Domain registered + DNS access (Cloudflare recommended) (Q3)          | Caddy HTTPS, email SPF/DKIM/DMARC, R2 custom domain                                                | Not started                                                  |
| VPS account (Hetzner or DigitalOcean, Q8) + SSH public key            | Production host                                                                                    | Not started                                                  |
| Managed Postgres (Neon or DO Managed Postgres) with backups/PITR      | Production database                                                                                | Not started                                                  |
| Cloudflare account: R2 bucket + API token                             | Production file storage                                                                            | Not started                                                  |
| Stripe LIVE keys + live webhook secret (after Q1 entity decision)     | Real payments                                                                                      | Blocked on Q1                                                |
| Resend account, domain verified (SPF/DKIM/DMARC records)              | Production email                                                                                   | Not started                                                  |
| Anthropic production API key + spend limit                            | Real AI                                                                                            | Not started                                                  |
| Sentry project (web + api DSNs); PostHog project key                  | Errors, analytics                                                                                  | Not started                                                  |
| Daily (or LiveKit) account + API key                                  | Real video calls                                                                                   | Not started                                                  |
| GitHub App (created under the KorvenzaTech org) + private key         | Code activity                                                                                      | Not started                                                  |
| GitHub Actions secrets + deploy SSH key; uptime monitor account       | Zero-downtime deploys, alerting                                                                    | Not started                                                  |
| Lawyer review of the legal drafts (Phase 8)                           | Publishing Terms/Privacy                                                                           | Not started                                                  |

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

## Phase 2 — Services & discovery · branch `phase/2-services`

- [x] Services (gigs) CRUD with Basic/Standard/Premium packages, extras, FAQs, gallery (up to 6 images), requirements form, delivery times — `/sell/services`
- [x] Gig moderation queue (admin) — `/admin/services` (approve/reject with reason; scopes operations|product)
- [x] SearchService (Postgres FTS + pg_trgm) behind an interface; filters: category, budget, delivery time; sort: best match / newest / price. _Seller level, verified-only and rating filters deferred to Phase 5 (no real data yet, D-061)_
- [x] Public SEO gig pages with JSON-LD (`Service` + `Offer`s) and `sitemap.xml`; `robots.ts`
- [x] Favorites, saved searches — `/favorites`
- [x] "Operated by KorvenzaTech" label; ranking-neutrality test (D-063)
- [x] CHECKPOINT (log only)

### Phase 2 log (2026-10-11)

**Tested on the real Docker stack:** lint/typecheck/unit, 49 integration tests (15 new: ownership 404s, validation, moderation + scope checks, FTS/typo/category/price/delivery/sort/pagination, banned seller hidden, ranking neutrality, favorites, saved searches), Playwright e2e on desktop + mobile: seller creates a service with a gallery image → submits → admin approves → anonymous visitor finds it with filters, sees JSON-LD, sitemap lists it → buyer favorites + saves a search → seller pauses and it vanishes.

**Files (by area):** `packages/db/src/schema/catalogue.ts`, migration `0004` (pg_trgm, tables, categories), `packages/shared/src/catalogue.ts`, `apps/api/src/modules/services/*`, `apps/web/app/{services,sell/services,favorites,admin/services}`, `apps/web/components/{service-card,favorite-button}.tsx`, `apps/web/app/{sitemap,robots}.ts`, `e2e/tests/services.spec.ts`.

**Bugs found by e2e and fixed:** favorite button acted as "unfavorite" if clicked before the favorites list loaded (now disabled while loading); "Save this search" was nested inside the filter `<form>` and reloaded the page (moved out); mobile header overlap from the new Browse link (icon on narrow screens); an empty `public/` broke the Docker build (`.gitkeep`).

**Known issues / follow-ups:**

- No prefix search (D-060); offset cursors.
- Ordering is not possible yet: the detail page says so explicitly. Checkout arrives in Phase 3.
- Seller public profile page (`/u/…`) has no JSON-LD or link list of the seller's services yet.
- Requirements-form field type is always "long text" in the editor (API supports text/longtext/file).
- Gallery editor can only add/clear images (no reorder).

**Manual test:** sign in as `seller@dev.glasswork.test` → `/sell/services` → New service → Submit → sign in as `admin@dev.glasswork.test` → `/admin/services` → Approve → open `/services` signed out, search/filter, open the service → sign in as a buyer → ♥ favorite, "Save this search" → `/favorites`.

## Phase 3 — Orders & payments (Stripe test mode) · branch `phase/3-payments`

- [x] PaymentsProvider/PayoutsService interfaces; adapters: built-in `test` provider (default, no keys) + Stripe (Checkout Sessions; webhook verification unit-tested, **API calls untested until keys exist**)
- [x] Package checkout → project + 3 milestones (exact integer split, DB prices only); `Idempotency-Key` on orders/funding/payouts/proposal acceptance
- [x] Milestone funding (one charge per milestone) + escrow_holds; seller commission fixed at funding
- [x] Double-entry ledger (append-only, DB zero-sum trigger) + invariant tests + admin ledger health
- [~] Payout rails: manual-bank done (request → ops marks paid/failed). **Stripe Connect Express onboarding not built**: depends on Q1/Q6 (D-071)
- [x] Release on approval → transfer + seller balance; auto-approve timer (worker → internal API, reminders 3/1 days before), verified with the real worker container
- [x] Webhooks: signature verification, raw event store, idempotent processing, admin replay
- [x] Fee settings (product scope, audited) + transparent fee breakdown before payment; invoices/receipts PDF
- [x] Buyer requests board + proposals with milestone plans → accept creates the project
- [→] Custom offers from chat — **moved to Phase 4** (needs chat, D-066)
- [x] CHECKPOINT (log only)

### Phase 3 log (2026-10-11)

**Tested on the real Docker stack:** lint/typecheck/unit (30 shared, 7 api, 6 worker unit tests incl. Stripe webhook + env safety rails), **77 integration tests** (23 payments + 5 requests/proposals new: idempotency, webhook attacks, concurrent approvals/deliveries/payouts, fee math, refunds, payouts, DB trigger guarantees, auth/ownership 404s), **26 Playwright e2e** (desktop + mobile). New e2e: order → test checkout → accept → deliver → request changes → approve → payout → ops marks paid → receipt PDF → project completes at 100%; the real worker auto-approving a due milestone; requests board → proposal → accept.

**Files (by area):** `packages/db/src/schema/{commerce,money}.ts`, migrations `0005` (+ledger triggers) / `0006`, `packages/shared/src/{money,commerce}.ts`, `apps/api/src/modules/{payments,orders,briefs}`, `apps/worker/src/processors/milestone.processor.ts`, `apps/web/app/{projects,pay,billing,earnings,requests}` + `admin/{payouts,payments,settings}`, `e2e/tests/payments.spec.ts`.

**Found by tests and fixed:** Nest swallows DI errors when logging is off (tests now boot with `abortOnError:false`); admin UI showed non-unique UUIDv7 prefixes (collision between two sellers → wrong payout row); e2e exceeded the general 300 req/min limit (e2e-only override, documented); order-panel fee breakdown now comes from the server quote endpoint.

**Known issues / follow-ups:**

- Stripe adapter API calls (checkout, refund) unverified against Stripe; needs test keys. Webhook secret setup in SETUP.md.
- No Connect onboarding; payouts are manual-bank only.
- Disputes, partial refunds, change requests (new funding) are Phase 5. No notifications for payment events yet (Phase 4).
- Project page is the money view only; the full Live Project Room (board, deliverables, activity feed, chat) is Phase 4.
- Seller-side milestone template editor not in the UI (API supports it).

**Manual test:** as a buyer open any live service → pick a package → Order & pay → "Pay (simulate success)" → on the project, the seller accepts, starts, submits; approve as buyer; seller `/earnings` → request payout; admin `/admin/payouts` → Mark paid; `/admin/payments` for ledger health; `/billing` for the receipt PDF. Also `/requests` for the requests board.

## Phase 4 — Live Project Room · branch `phase/4-room` (MVP CHECKPOINT)

- [x] Overview: weighted % progress (task completion feeds in-progress milestones), current milestone, next deadline, computed health + reason, escrow held vs released
- [x] Timeline: planned vs actual per milestone
- [x] Board: Kanban tasks linked to milestones (seller manages incl. drag & drop, buyer views + comments)
- [x] Deliverables: versioned uploads, request-changes/approve mirrored per version, feedback pinned (image click / page / timecode); downloads only when scanned clean
- [x] Preview links (staging, Figma, APK/TestFlight, video) with "last updated"
- [x] Activity feed (filterable, paginated)
- [x] Realtime chat: attachments, read receipts, typing, presence; every socket event authorised
- [x] Notifications: in-app (live bell + inbox), email, per-type preferences; web push implemented (**unverified in a real browser**, needs VAPID keys)
- [x] Custom offers from chat (moved from Phase 3)
- [x] File-scan pipeline (SCAN_MODE=clamav, worker + clamd client; **real ClamAV not run**)
- [x] ACCEPTANCE: a buyer follows a 3-milestone project end to end with accurate progress at every step, live (Playwright desktop + mobile, buyer never reloads)
- [x] CHECKPOINT: report to Rashid

### Phase 4 log (2026-10-11)

**Tested on the real Docker stack:** lint/typecheck/unit, **integration** (new: 13 room, 14 chat/realtime/offers incl. real Socket.io clients, 4 scan, plus push sender / clamd / scan processor unit tests), Playwright e2e **desktop + mobile**: acceptance flow with exact progress 0 → 9 → 18 → 24 → 18 → 24 → 30 → 62 → 70 → 94 → 100 %, chat (typing, seen, presence, attachment download), live notification bell + preferences, direct message → custom offer → project, outsiders get 404.

**Files (by area):** `packages/db/src/schema/{room,chat}.ts` (migration 0007), `packages/shared/src/{room.ts,realtime.ts}`, `apps/api/src/modules/{access,notifications,room,chat,realtime}`, file scan: `apps/api/src/modules/files/internal-files.controller.ts`, `apps/worker/src/{clamd.ts,processors/scan.processor.ts}`, web: `apps/web/app/projects/[id]/*`, `components/room/*`, `lib/{realtime,use-load}.ts*`, `app/{messages,notifications,settings/notifications}`, `public/sw.js`, `e2e/tests/room.spec.ts`.

**Found by tests and fixed:** DI failure from a test-seam constructor param; fire-and-forget Redis presence calls racing shutdown; infected-file verdict failed when storage deletion failed (now best-effort); mobile header overlap (bell) and board "Post" overflow; e2e hydration race on the test checkout button.

**Known issues / follow-ups:**

- Web push and the real ClamAV daemon are unverified (see D-079/D-080).
- Presence is per user (not per room) and abrupt disconnects take up to ~45 s to show offline.
- A milestone can be submitted without a deliverable (D-078).
- Feedback region is a point pin (no drag-rectangle); PDF page anchors are numeric inputs, not a PDF viewer.
- No chat-safety warnings yet (Phase 5); no meeting/video (Phase 7).

## Phase 5 — Trust · branch `phase/5-trust`

- [x] Reviews: private per-milestone feedback, public final review with sub-ratings, one seller reply, only paying buyers with completed work
- [x] Seller levels computed from real metrics, criteria published (`/seller-levels`); rating / level / verified-only search filters + "top rated" sort (deferred from Phase 2)
- [x] Verifications + badges (identity, GitHub incl. automatic via OAuth link, Play/App Store link, portfolio reviewed, skill test); shown only when verified
- [x] Change requests (price/time impact → milestones appended → funding required)
- [x] Disputes: auto-built case file, evidence, admin resolution (release / refund / split) with exact ledger
- [x] Chat safety warnings in pre-order chats (log + warn, never block)
- [x] Reports (user/service/message/review) + admin handling; ban/unban; listing takedown
- [x] CHECKPOINT (log only)

### Phase 5 log (2026-10-11)

**Tested on the real Docker stack:** unit (levels, chat-safety detector incl. false-positive cases, env), **135+ integration tests** (new: reviews/levels/verifications/search filters, change requests, disputes with release/refund/split ledger math, chat safety, reports, bans, takedown), Playwright e2e desktop + mobile for every flow above through the real UI.

**Files (by area):** `packages/db/src/schema/trust.ts` (migration 0008), `packages/shared/src/{trust,chat-safety}.ts`, `apps/api/src/modules/trust/*`, `apps/api/src/modules/orders/{change-requests,disputes}.*` + `milestones.service.ts` (resolution), `apps/api/src/auth/session.service.ts` (ban check), web: `components/{trust,report-button}.tsx`, `components/room/{reviews-panel,changes,disputes}.tsx`, `app/{u/[slug],seller/verification,seller-levels}`, `app/admin/{disputes,verifications,reports}`, `e2e/tests/trust.spec.ts`.

**Found by tests and fixed:** the admin nav overflowed on 390 px screens once it had nine links (links were off-screen and unclickable; now wraps); a chat-safety false positive on "signal handling"; mobile header collisions for anonymous visitors; prettier reflowing code broke several scripted edits (caught by lint/typecheck).

**Known issues / follow-ups:**

- Environment: the Mac's disk reached 100% because Docker build cache grew to ~74 GB from repeated rebuilds (tests then failed with ENOSPC). Run `docker builder prune` / Docker Desktop → Clean up occasionally.
- A banned user can still submit the sign-in form (the resulting session is dead). Block at sign-in later.
- No dispute withdraw; no seller "response time" metric; levels have no manual override by design.
- Evidence/identity files rely on SCAN_MODE (off in dev); real ClamAV still unverified.
- Reviews are not re-checkable after being posted (no edit/delete flow); moderation of a review is via reports only.

## Phase 6 — AI · branch `phase/6-ai`

- [x] AI module: Claude API server-side, per-user rate limits, daily cost caps, usage table
- [x] AI Brief Builder
- [x] AI Matching with explanations
- [x] Weekly + on-demand progress reports (seller edits before sending)
- [x] Meeting notes → Board tasks
- [x] Seller analytics dashboard (real data only)
- [x] CHECKPOINT (log only)

### Phase 6 log (2026-10-12)

**Tested on the real Docker stack:** unit (cost maths, env rails, provider with a fake Anthropic client, rules fallbacks, worker processor), 13 AI integration tests (ownership, caps, rate limit, matching, report privacy/immutability, weekly job, meeting notes, analytics, admin usage) and Playwright e2e on desktop + mobile for all six flows.

**Files:** `packages/shared/src/ai.ts`, `packages/db/src/schema/ai.ts` (migration 0009), `apps/api/src/modules/ai/*`, `room.service.ts` (`createMany`), worker `reports.processor.ts` + weekly scheduler; web `app/requests/new/ai`, `app/match`, `app/seller/analytics`, `components/room/{reports,meeting-notes}.tsx`; `e2e/tests/ai.spec.ts`.

**Known issues / waiting:**

- Needs `ANTHROPIC_API_KEY` and `AI_PROVIDER=anthropic` to use the real model; the live API path is unverified.
- Caps are pre-checks (a concurrent call can overshoot slightly). Analytics earnings are USD only.
- Meeting notes are pasted text until video/recording (Phase 7).
- e2e is timing-sensitive under heavy machine load (a load average near 200 from macOS storage indexing made 4 older tests time out); `pnpm --filter @glasswork/e2e exec playwright test --workers=1` passes 58/58. The AI cap test cleans up its own spend rows because the platform daily cap is shared.
- Environment: the Mac disk reached ~100% from Docker build cache; run `docker builder prune --keep-storage 8GB` now and then.

## Phase 7 — Meetings & integrations · branch `phase/7-meetings`

- [x] VideoService interface + adapters (`stub` for dev/CI, `daily` behind env); consent-gated recording (recording starts only when every participant has consented)
- [x] GitHub App code activity: commits, PRs and deployments in plain language, signature-verified webhooks, once per delivery
- [x] Calendar invites (ICS)
- [x] Web UI: meetings panel in the project room, call page, code-activity panel; meeting notes feed the Phase 6 notes-to-tasks flow
- [x] CHECKPOINT (log only)

### Phase 7 log (2026-10-15)

**Verified 2026-10-15 on the real Docker stack:** 161 API integration tests (16 files, includes meetings), 4 Playwright e2e tests for meetings and code activity (desktop + mobile).

**Files:** `packages/db/src/schema/meetings.ts` (migrations 0010/0011), `packages/shared/src/meetings.ts`, `apps/api/src/modules/meetings/*`, web `components/room/{meetings,code-activity}.tsx`, `app/meetings/[id]/call/*`, `e2e/tests/meetings.spec.ts`.

**Known issues / waiting:** Daily and GitHub App calls are unverified against the real services (need accounts: see WAITING ON RASHID / Phase 10). CI: the first runs failed on the e2e step with no readable reason; the workflow now uses one worker plus GitHub annotations and runs on `phase/**` pushes.

## Phase 8 — Marketplace UI, design system & marketing · branch `phase/7-meetings` (continues the same branch; see log)

Scope set by Rashid on 2026-10-15: complete, realistic, premium marketplace UI; all pages; design system; dev-only realistic seed data; screenshots. Old Phase 8 items (3D landing, legal, SEO, analytics, cookie consent) are included.

- [x] Design system: tokens (glass, glow, gradients, motion), 12 new components in `packages/ui` (Avatar, Dialog, Dropdown, Progress, Tabs, Tooltip, Skeleton, Stat, EmptyState, PageHeader, Section), living style guide at `/design` (dev only)
- [x] Product mark + lockup, sticky glass header, ⌘K command palette, rich footer
- [x] Landing page: poster-first react-three-fiber hero (milestone panes + progress orb), reduced-motion/mobile/save-data fallbacks, how it works, project-room preview (labelled illustrative), features, categories, FAQ
- [x] Marketing pages: How it works, Fees & escrow, Trust & safety, For sellers, About, Contact
- [x] Legal drafts (flagged for lawyer review): Terms, Privacy, Seller Agreement, Buyer Protection, Acceptable Use, Cookies
- [x] Marketplace: browse (category chips, empty state), service cards with generated covers, service detail (seller card, sticky order panel), dashboard (stats, active projects)
- [x] Dev-only demo seed (`pnpm db:seed:demo`): 10 sellers, 11 services, 47 reviews through real completed projects, open requests; "Demo" badge in UI; excluded from analytics
- [x] SEO: sitemap includes marketing + legal pages, default OG image, robots; analytics: typed `track()` + consent banner, active only when `NEXT_PUBLIC_POSTHOG_KEY` is set
- [x] Smoke + screenshot pass over 67 page captures per viewport (`pnpm shots`): no HTTP errors, no console errors, no horizontal overflow at 390px
- [ ] Contract + NDA templates with in-app e-acceptance (needs lawyer-approved text first; moved to after legal review)
- [x] PostHog SDK loading: consent-gated lazy provider (`components/analytics-provider.tsx`), active with `NEXT_PUBLIC_POSTHOG_KEY`
- [x] CHECKPOINT: page list + screenshots folder reported to Rashid (2026-10-16); **waiting for feedback before Phase 9**

### Phase 8 log (2026-10-16)

**Verified on the real Docker stack (fresh DB + demo seed):** lint/typecheck/unit (23 turbo tasks), 161 integration tests, 62 Playwright e2e (desktop + mobile), `pnpm shots` on both viewports (0 issues). Screenshots: `artifacts/screenshots/phase8/{desktop,mobile}` (+ `light/`), index in `INDEX.md`.

**Found and fixed along the way:** ICS text never escaped semicolons (an old test asserted the wrong output); Phase 7 lint errors that would have failed CI; scroll-reveal content was invisible to a non-scrolling full-page screenshot (script now scrolls); every favorite button fetched the favorites list on its own (now one shared request per page); a `loading.tsx` on `/services` and `/dashboard` made 404s return 200 and duplicated DOM during streaming, so it was removed (do not add route-level `loading.tsx` to pages that call `notFound()`).

**Known issues / not done:**

- Secondary app pages (admin tables, settings, messages, requests, seller wizard) keep their existing, functional layout; they inherit the new header, footer, tokens and components but were not individually redesigned.
- The 3D hero rendered in headless Chromium; real-device performance and Lighthouse numbers are measured in Phase 9.
- No uploaded photos exist in dev, so covers are generated gradients; real seller images will replace them automatically.
- Legal text is draft (D-105); contract/NDA e-acceptance, PostHog loading and the KorvenzaTech K logo are still open.
- Demo data is invented and dev-only; the first `pnpm db:seed:demo` after `pnpm dev:reset` recreates it.

**Manual test:** `pnpm dev:up && pnpm db:seed:demo`, open http://localhost:3000 (landing, `/services`, a service, `/u/amara-okafor`, `/design`, legal pages, ⌘K). Sign in as `buyer@dev.glasswork.test` / `Glasswork-dev-123!` for the dashboard; demo sellers use `<first.last>@demo.glasswork.test` with the same password.

## Phase 9 — Hardening & launch · branch `phase/9-hardening`

- [x] Load tests (k6) on critical paths: `infra/load/*.js`, results in docs/PHASE9_REPORT.md
- [x] OWASP Top 10 review + fixes: docs/SECURITY_REVIEW.md (SSRF fix, write rate limit, 429 mapping, prod guards)
- [x] Accessibility audit (WCAG 2.2 AA): docs/ACCESSIBILITY.md, e2e/tests/a11y.spec.ts
- [x] Lighthouse ≥ 90 on public pages (see docs/PHASE9_REPORT.md for scores)
- [→] Production deploy, backups, restore verification, uptime monitoring — **moved to Phase 10**
- [x] Data export + account deletion flows (D-108; `/settings` → Your data; API tests + e2e)
- [x] Runbooks in docs/ (RUNBOOKS.md); launch checklist (LAUNCH_CHECKLIST.md)
- [ ] FINAL CHECKPOINT

## Phase 10 — Production launch (new, 2026-10-15)

**Rule: nothing is deployed, provisioned or paid for until Rashid says "deploy".** Until then this phase is code, config, scripts and docs only, all testable locally. Real providers are switched on **by environment variables only** (no code changes, no rebuild per provider); the dev stub/test providers stay the default and are refused in production.

- [x] **Production topology** (`infra/prod/`): one VPS (Hetzner or DigitalOcean, Q8) running Docker; `docker-compose.prod.yml` with web, api, worker, redis, Caddy; managed Postgres and Cloudflare R2 are external (no Postgres/storage containers in prod)
- [x] **Caddy**: automatic HTTPS, HTTP→HTTPS, security headers, gzip/zstd, `www`/apex redirect, WebSocket proxying for Socket.io, separate `api.` host (or path) per domain decision, health-gated upstreams
- [x] **Managed Postgres**: Neon or DO Managed (PITR on), TLS-only connection string, migrations run as an explicit deploy step (never at API boot), least-privilege app role vs migration role
- [x] **Backups**: provider PITR + nightly logical dump to a separate R2 bucket (encrypted), retention policy, **nightly restore-verification** script (restores into a scratch DB and runs sanity queries), alert on failure
- [x] **Cloudflare R2**: `S3_*` env only (private buckets, presigned URLs, CORS for the web origin, lifecycle rules for abandoned uploads); ClamAV scan service enabled (`SCAN_MODE=clamav`) and verified
- [x] **Zero-downtime deploys from GitHub Actions**: build and push versioned images (GHCR), `deploy.yml` triggered only by a manually approved GitHub Environment (`production`) so nothing ships on its own; pull → migrate (expand/contract-safe migrations) → start new containers → health-check → switch Caddy upstream → drain and stop old; automatic rollback on failed health check; `rollback` workflow to the previous image tag
- [x] **Production starts clean**: production boot refuses `is_seed` data, dev seed, stub providers and test-mode payments (env validation fails fast); a `bootstrap:admin` command creates the first admin accounts (Rashid, Taha, Suliman) with a one-time password-reset link instead of a seeded password; the seed script stays development-only (already refuses `NODE_ENV=production`); a CI test proves a fresh production DB contains zero seed rows
- [ ] **Real providers, env-only switch** (each documented in `docs/GO_LIVE.md` with the exact variables and a "how to verify" step):
  - [x] (documented, unverified without accounts) Stripe live (`PAYMENTS_PROVIDER=stripe`, live keys, live webhook endpoint + secret) — only after Q1
  - [x] (documented, unverified without accounts) Resend (`EMAIL_PROVIDER=resend`) with **SPF, DKIM and DMARC** records documented (start `p=none`, move to `quarantine` after a week of clean reports), bounce/complaint webhook
  - [x] (documented, unverified without accounts) Anthropic (`AI_PROVIDER=anthropic`) with daily caps set in prod env
  - [x] (documented, unverified without accounts) Sentry (api, worker, web incl. source maps) and PostHog analytics (cookie-consent gated)
  - [x] (documented, unverified without accounts) Daily or LiveKit video (`VIDEO_PROVIDER`), recording consent flow re-verified with the real provider
  - [x] (documented, unverified without accounts) GitHub App (webhook secret, private key, install flow) for code activity
  - [x] (documented, unverified without accounts) OAuth redirect URIs for Google + GitHub on the production domain
- [x] **Monitoring**: external uptime checks on `/health` and `/ready`, alert routing (email + one chat channel), log shipping/retention, disk and memory alerts on the VPS, worker queue-depth alert
- [x] **Server hardening**: non-root deploy user, SSH keys only, firewall (22/80/443 only), unattended security updates, fail2ban, Docker log rotation, `disk:check` equivalent for the VPS
- [x] **`docs/GO_LIVE.md`** — step-by-step guide written for Rashid (non-engineer-friendly): accounts to create in order, what to click, which values to paste where, DNS records, how to say "deploy", how to verify, how to roll back
- [x] **Launch checklist** (`docs/LAUNCH_CHECKLIST.md`): legal pages lawyer-reviewed, entity + payments live-mode decision, test purchase with a real card and refund, email deliverability test (mail-tester ≥ 9/10), backup restore drill done, Sentry test event received, uptime alert test, rollback rehearsed, admin accounts + 2FA enabled, fee settings set, seed data confirmed absent, robots/sitemap on the final domain
- [x] Dry run on a **local production-like stack** (prod compose + Caddy with a local domain) without touching any paid account
- [ ] FINAL CHECKPOINT: report to Rashid and **wait for the word "deploy"**

Relationship to Phase 9: Phase 9 keeps load tests, OWASP, accessibility, Lighthouse, data export/deletion; its production-deploy and backup lines move here. Phase 10 follows Phase 9.

## Autonomy session log (2026-10-28, full autonomy mode)

Branch `phase/9-hardening`. Everything below was run on the real Docker stack; details and numbers in docs/PHASE9_REPORT.md.

**Phase 8 self-review (done):** link crawler (`pnpm crawl`) over four personas; axe + layout + placeholder checks; fixed link-only-colour text links (95), danger-button contrast, light-theme contrast tokens, unlabeled file input, hydration mismatches, layout shift on login. Placeholder sweep: brand `domain` / `legalAddress` / `supportEmail` are `null` (hidden), no TODO/example.com in UI; onboarding and admin "placeholder" copy rewritten. New real content: Help center (16 articles at `/help`), seller track on How it works, richer contact page. Better-than-Fiverr features made visible on the home page (featured real services, AI brief builder + matching + weekly report preview, milestone protection, dispute center, seller levels) and the dashboard was redesigned around next actions (diagnostics folded away). Project Room has a milestone stepper; admin has an operations overview. Before/after screenshots: `artifacts/design-review/{before,after}` (git-ignored).

**Phase 9 (done):** OWASP review (docs/SECURITY_REVIEW.md: SSRF fix on push endpoints, per-user write rate limit, 429 mapping), WCAG audit (docs/ACCESSIBILITY.md, `e2e/tests/a11y.spec.ts`), Lighthouse mobile perf >= 90 / a11y >= 99 on 16 public pages, k6 load tests (`infra/load`), runbooks, launch checklist. Full suite green: 140 unit, 169 integration, 76 e2e (desktop + mobile).

**Phase 10 (prepared, NOT deployed):** `infra/prod/*` (compose edge + blue/green app slots, Caddyfile, deploy / rollback / backup / restore-verify / monitor / server-setup scripts, `.env.production.example`), `.github/workflows/{deploy,rollback}.yml`, production guards (seed data, https, TRUST_PROXY, providers), `bootstrap-admin`. Dry run on the local machine proved zero-downtime switch, rollback, seed refusal, backup + restore verification. `docs/GO_LIVE.md` is the step-by-step for Rashid.

**Remaining for Rashid (everything needing accounts, keys or legal decisions):** see "WAITING ON RASHID" above and the final report; nothing else is blocking.

**Local accounts:** `buyer@dev.glasswork.test`, `seller@dev.glasswork.test`, `admin@dev.glasswork.test`, `support@dev.glasswork.test`, demo sellers `<first.last>@demo.glasswork.test` (e.g. `amara.okafor@`), password `Glasswork-dev-123!`. Site http://localhost:3000, Mailpit http://localhost:8025.
