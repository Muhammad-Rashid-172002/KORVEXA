# MASTER_PLAN — Glasswork by KorvenzaTech

Source of truth for progress. Built from docs/BRIEF.md §12; decisions live in DECISIONS.md.
Rule (brief §3): continue from the first unchecked item and never redo ticked work. Each ticked item records files changed, known issues and what to test manually.

## ▶ RESUME HERE (updated 2026-10-11)

Phases 0–4 done and merged to `main` (Phase 1 commits were made directly on `main`; `phase/1-accounts` is a marker branch at the same commit). Phase 3 done (merged to `main`). Phase 4 done = **MVP checkpoint reached; report sent to Rashid, waiting for feedback before Phase 5**. Next: Phase 5 — Trust on branch `phase/5-trust` (in progress; see slices in the Phase 5 section).

- Verified 2026-10-11: `pnpm dev:up` (7 services healthy, `/ready` ok, RustFS storage smoke test ok), lint/typecheck/unit (23 turbo tasks), 77 integration tests, 26 Playwright e2e tests (desktop + mobile).
- Remaining unverified: first GitHub Actions run (no repo yet), OAuth with real keys.

## ⏳ WAITING ON RASHID

| Item                                                                | Needed for                                                                                         | Status                                                                                                                                           |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Legal entity + country for the Stripe platform account (Q1)         | Live payments (Phase 3+); test mode works without it                                               | Partners deciding with accountant/lawyer                                                                                                         |
| Stripe TEST keys (`sk_test_…`) + webhook secret                     | Verifying the real Stripe adapter (checkout/refund); the built-in test provider works without them | Not provided; app runs on the test provider                                                                                                      |
| Fee values: buyer service fee %, seller commission %, minimums (Q4) | Phase 3 checkout                                                                                   | Admin settings exist, set to 0                                                                                                                   |
| Admin role mapping confirmation (Q5)                                | Admin area                                                                                         | Provisional: Rashid=product, Taha=growth, Suliman=operations                                                                                     |
| GitHub repo URL (Q7)                                                | CI first run, push                                                                                 | A remote `origin` → github.com/Muhammad-Rashid-172002/KORVEXA exists (not added by me). Confirm it is the intended repo; nothing has been pushed |
| KorvenzaTech K logo SVG                                             | Header lockup, product mark                                                                        | Text lockup in use                                                                                                                               |
| Domain (Q3), registered company name + address (Q2)                 | brand.ts, legal pages, cookies, email DNS                                                          | TODO in brand.ts                                                                                                                                 |
| Google + GitHub OAuth keys                                          | Social login                                                                                       | Buttons hidden until set                                                                                                                         |
| Resend API key + sender domain (Q9), Sentry DSNs                    | Production email, error tracking                                                                   | Off locally (Mailpit / no-op Sentry)                                                                                                             |

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

Slices: **A** schema · **B** reviews (private milestone feedback, public final review + sub-ratings, one seller reply) + seller levels (computed, criteria public) + search filters (rating/level/verified) · **C** verifications + badges · **D** change requests · **E** disputes (auto case file, evidence, admin resolution release/refund/split) · **F** chat safety warnings · **G** reports + ban tools · **H** web UI · **I** e2e + docs.

- [ ] Reviews: per-milestone private feedback, public final review with sub-ratings, one seller reply, only paying buyers with completed work
- [ ] Seller levels from real metrics, criteria published; rating/level/verified-only search filters (deferred from Phase 2)
- [ ] Verifications + badges (identity, GitHub, Play/App Store link, portfolio reviewed, skill test) shown only when verified
- [ ] Change requests (time/price impact → milestones updated → funding required)
- [ ] Disputes: auto-built case file, evidence, admin resolution (refund/release/split)
- [ ] Chat safety warnings (contact/payment details before an order; log, don't block)
- [ ] Reports (user/gig/message/review) + admin handling + ban tools
- [ ] CHECKPOINT (log only)

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
