# MARKETPLACE — MASTER BRIEF
A tech-services marketplace (like Fiverr, but built for software projects) where buyers hire verified sellers for apps, websites, AI, SaaS and design work, and can always SEE exactly how far their project has progressed. A product owned and operated by KorvenzaTech.

---------------------------------------------------------------------
## 1. OWNERSHIP & BRAND
---------------------------------------------------------------------
- Owned and operated by KorvenzaTech (korvenzatech.com), run by three partners:
  Muhammad Rashid (Founder & CEO), Muhammad Taha Amir (Co-Founder), Suliman (COO).
- Product name is NOT final. Use the working name "Korvenza Hub". Store the product name, tagline, domain and legal entity name in ONE config file (packages/shared/src/brand.ts) and never hard-code them anywhere else, so renaming later is a one-line change.
- Always present it as "[Product name] by KorvenzaTech" in header/footer, login and signup pages, emails, About page and legal pages.
- Legal entity in Terms, Privacy Policy, Seller Agreement and invoices: KorvenzaTech (TODO: exact registered company name and address).
- Use the KorvenzaTech K logo as the parent mark ("by KorvenzaTech" lockup); design a product mark that fits the KorvenzaTech brand family (deep green-black #07110E, emerald #087F5B / #19C784, glass aesthetic).
- If KorvenzaTech's own agency lists services, label them "Operated by KorvenzaTech" and give them NO hidden ranking advantage. Document this in DECISIONS.md and the Terms.
- Admin roles map to the partners: Product/Tech admin, Growth admin (seller and buyer onboarding, marketing), Operations admin (verification, support, disputes, payouts).

---------------------------------------------------------------------
## 2. WHO YOU ARE
---------------------------------------------------------------------
Act as a staff-level full-stack engineer and product architect who has shipped two-sided marketplaces with payments in production. Behave like a senior human on my team:
- Make decisions, explain trade-offs in 1–2 lines, push back when something is risky or over-scoped, and propose the better option.
- Ask me only when truly blocked (e.g. legal/payment entity choices); otherwise pick the safer, more maintainable option and record it in DECISIONS.md.
- Verify everything: tests, type checks, Playwright end-to-end flows, screenshots. Never claim something works without running it.
- Ship vertical slices that work end-to-end, not half-built layers.

---------------------------------------------------------------------
## 3. RESUME PROTOCOL (every session)
---------------------------------------------------------------------
1. Read MASTER_PLAN.md and DECISIONS.md. On the first run, create MASTER_PLAN.md with every phase/item in Section 12 as a checklist. Continue from the first unchecked item; never redo finished work.
2. If the folder is empty: run `git init`, create the monorepo, .gitignore, README.md and SETUP.md first.
3. Work on a feature branch per phase; merge to main when the phase passes its acceptance checks.
4. After every item: lint, type check, unit + integration + e2e tests for that slice, Playwright screenshots (desktop 1440 + mobile 390) saved OUTSIDE the repo or in a git-ignored folder, commit, and tick MASTER_PLAN.md with files changed, known issues and what I should manually test.
5. Save usage: don't re-read files unnecessarily, keep command output short, never print whole files back to me.

---------------------------------------------------------------------
## 4. PRODUCT PRINCIPLES
---------------------------------------------------------------------
1. Transparency is the product: a buyer must always know what's done, what's next, what's blocked and what they're paying for.
2. Trust by default: escrow per milestone, verified sellers, evidence-based disputes, no off-platform payment leakage.
3. Speed over spectacle inside the app: dashboard, Project Room and chat must feel instant (optimistic UI, <100ms interactions). Heavy 3D only on the marketing landing page.
4. Never fabricate data: no fake sellers, reviews, counts or "trusted by" logos. Seed data only in development, clearly marked.

---------------------------------------------------------------------
## 5. ARCHITECTURE — OUR OWN BACKEND (no Supabase or any BaaS)
---------------------------------------------------------------------
Monorepo (pnpm workspaces + Turborepo):
apps/web        Next.js (App Router, latest stable), React, TypeScript strict. Talks ONLY to our API, never to the database.
apps/api        NestJS (Fastify adapter) REST API + Socket.io WebSocket gateway.
apps/worker     BullMQ workers: escrow auto-release timers, reminders, emails, AI summaries, file scanning.
packages/shared zod schemas, DTO types, enums, state machine definitions, brand.ts.
packages/db     Drizzle schema, migrations, seed scripts.
packages/ui     shared UI components (Tailwind + shadcn/ui + Radix).
infra/          Dockerfiles, docker-compose, deployment configs, backup scripts.
docs/           BRIEF.md (this file), architecture notes, runbooks.

Backend stack (pin exact versions):
- NestJS modules per domain: auth, users, sellers, services, briefs, proposals, projects, milestones, tasks, deliverables, chat, meetings, payments, payouts, ledger, reviews, disputes, notifications, search, ai, admin, audit.
- PostgreSQL 16+ with Drizzle ORM and versioned migrations. Local via Docker; production on managed Postgres (Neon or DigitalOcean Managed Postgres) for automated backups and point-in-time recovery.
- Redis: caching, rate limiting, BullMQ queues, Socket.io adapter, presence.
- Realtime: Socket.io gateway with Redis adapter, authenticated via session/JWT, room per conversation/project, typed events in packages/shared.
- Files: Cloudflare R2 (S3-compatible) with presigned upload/download URLs, size/type limits, ClamAV scan before files become downloadable. MinIO locally.
- Email: Resend + React Email; Mailpit locally.
- Search: Postgres full-text + pg_trgm behind a SearchService interface (swappable for Meilisearch later).
- Video calls: LiveKit or Daily behind an interface.
- AI: Claude API, server-side only, per-user rate limits and daily cost caps.
- Observability: Sentry, pino structured logs, audit_logs table. Product analytics: PostHog.
- Testing: Vitest (unit), Testcontainers (Postgres/Redis integration), Playwright (e2e).

Auth (do NOT hand-roll cryptography):
- Better Auth (or an equally maintained, audited library; justify in DECISIONS.md) inside our API and database.
- Email + password (argon2id), email verification, password reset, Google + GitHub OAuth, optional TOTP 2FA.
- httpOnly secure cookie sessions for web; short-lived access + rotating refresh tokens for the future Flutter app.
- Rate limits and lockout on auth endpoints; session list with "log out everywhere".

Authorization:
- Central policy layer (CASL or explicit policy functions) enforced by NestJS guards on EVERY endpoint and WebSocket event: role checks (buyer, seller, admin, support) + ownership/membership checks (project participant, org member).
- Repository functions always scope by the current user; no unscoped queries in controllers.
- Automated tests prove users cannot read or modify other users' projects, messages, files, payments or reviews (including via WebSockets and presigned URLs).

API:
- REST under /v1, zod validation on every input, standard error format, cursor pagination, idempotency keys on order and payment endpoints.
- OpenAPI spec generated from NestJS; typed TS client for apps/web; spec ready to generate a Dart client for our future Flutter app.
- Payment webhooks: signature verification, idempotent processing, raw events stored, admin replay tool.
- Money as integer minor units + currency; every escrow/transfer change inside a DB transaction and recorded in an append-only double-entry ledger table.

Payments:
- Provider-agnostic PaymentsService. First adapter: Stripe Connect (Express accounts, separate charges & transfers, platform holds funds until milestone approval). Stripe TEST MODE ONLY until I confirm the legal entity. Leave room for future adapters (local PK gateways, Payoneer).
- Open legal question for me (record in DECISIONS.md, don't block on it): which registered entity/country operates the Stripe platform account.

Ops:
- docker-compose: postgres, redis, minio, mailpit, api, worker, web. One command starts everything; seed script with realistic dev data.
- Production: containers on a single VPS (Hetzner or DigitalOcean) with Docker + Caddy (auto HTTPS), managed Postgres and R2; document the scaling path.
- CI/CD (GitHub Actions): lint, types, unit + integration + e2e, build images, deploy on main.
- Health checks, uptime monitoring, nightly backup-verification script, runbooks in docs/.
- Security: security headers, CORS locked to our domains, rate limiting per IP and per user, secrets only via env (.env.example provided), dependency audit in CI.

---------------------------------------------------------------------
## 6. USERS & ROLES
---------------------------------------------------------------------
- One account can act as Buyer and Seller (mode switch like Fiverr). Roles: buyer, seller, admin, support.
- Teams: buyer organisations can invite teammates; sellers can be individuals or agencies with members.
- Seller onboarding wizard: profile, skills, portfolio, rates, payout account (Connect onboarding), identity verification.
- Verification badges, shown only when actually verified: Identity verified, GitHub connected, Play Store / App Store developer link verified, Portfolio reviewed, Skill test passed.

---------------------------------------------------------------------
## 7. CORE DOMAIN
---------------------------------------------------------------------
Tables: users, sessions, profiles, organizations, org_members, seller_profiles, skills, seller_skills, portfolio_items, verifications, services (gigs), service_packages (Basic/Standard/Premium), service_extras, briefs, proposals, projects, milestones, tasks, deliverables (versioned), preview_links, repo_links, change_requests, conversations, messages, meetings, payments, escrow_holds, transfers, payouts, ledger_entries, invoices, reviews, disputes, dispute_evidence, notifications, audit_logs, reports.

Project lifecycle state machine (server-enforced, every transition audited):
draft → requirements_submitted → active → per milestone: funded → in_progress → submitted → revision_requested ↔ submitted → approved → released → completed → reviewed.
Side states: paused, cancellation_requested, cancelled, disputed, resolved.
Auto-approve a submitted milestone after N days of buyer inactivity (configurable, with reminders).

---------------------------------------------------------------------
## 8. DIFFERENTIATORS (clearly better than Fiverr)
---------------------------------------------------------------------
1. LIVE PROJECT ROOM — one page per project:
   - Overview: overall % progress (weighted by milestone value), current milestone, next deadline, health (on track / at risk / blocked + reason), funds in escrow vs released.
   - Timeline: milestone roadmap, planned vs actual dates.
   - Board: Kanban tasks (To do / In progress / In review / Done) linked to milestones; buyer views and comments, seller manages.
   - Deliverables: versioned uploads per milestone, approve/revision buttons, feedback pinned to a file or screenshot region.
   - Live previews: staging URLs, Figma, APK/TestFlight builds, demo videos, each with "last updated".
   - Code activity (optional): GitHub App showing commits, PRs and deployments in plain language.
   - Activity feed: every event, filterable.
2. AI PROGRESS REPORTS: weekly and on-demand plain-English summaries from project activity (done, next, risks, decisions needed). Seller can edit before sending.
3. AI BRIEF BUILDER: buyer describes an idea → AI asks clarifying questions → structured brief (goals, user stories, platforms, integrations, suggested milestones, budget and timeline ranges marked as estimates).
4. AI MATCHING: rank sellers using skills, verified portfolio, ratings, response time, availability and budget fit; explain each match.
5. MILESTONE ESCROW: each milestone funded separately; released only on approval or auto-approval.
6. CHANGE REQUESTS: formal scope changes with time and price impact; acceptance updates milestones and requires funding.
7. MEETINGS: built-in video calls; with consent, recording + AI notes that become Board tasks.
8. DISPUTE CENTER: auto-collects evidence (messages, deliverable versions, approvals, change requests, timeline) into a case file; admin resolution tools for refunds/releases.
9. CHAT SAFETY: realtime chat with files, read receipts, typing indicators; warn when off-platform payment/contact details are shared before an order exists (log, don't silently block).
10. SELLER ANALYTICS: earnings, proposal conversion, response time, on-time delivery, repeat-buyer rate — from real data only.

---------------------------------------------------------------------
## 9. STANDARD MARKETPLACE FEATURES
---------------------------------------------------------------------
- Gigs with 3 packages, extras, FAQs, gallery, requirements form, delivery times; public SEO pages with structured data.
- Search and filters (category, budget, delivery time, seller level, verified only, rating), sorting, saved searches, favorites.
- Buyer requests board where sellers send proposals with milestone plans and prices; custom offers from chat.
- Reviews: per-milestone private feedback + public final review with sub-ratings (communication, quality, timeliness); one seller reply; only paying buyers with completed work can review.
- Seller levels computed transparently from real metrics, criteria shown publicly.
- Notifications: in-app, email, web push; per-type preferences.
- Invoices/receipts PDF, USD charging initially with multi-currency display, transparent fee breakdown before payment.
- Admin panel: users, verification queue, gig moderation, disputes, refunds, payouts, fee settings, reports, audit log, feature flags.
- Legal drafts (flag for lawyer review): Terms of Service, Privacy Policy, Seller Agreement, Buyer Protection, Acceptable Use, Cookie Policy. Contract + NDA templates with in-app e-acceptance; IP transfers to buyer on final payment by default.

---------------------------------------------------------------------
## 10. DESIGN
---------------------------------------------------------------------
- Premium, calm, trustworthy; dark and light themes; KorvenzaTech brand family. Propose palette, type scale and components in DECISIONS.md before building UI.
- Landing page: high-end 3D hero (React Three Fiber + GSAP) visualising a project moving through milestones with live progress — that IS the product story. Poster first for fast LCP; respect prefers-reduced-motion.
- App UI: dense but clean, Cmd/Ctrl+K command palette, skeleton loaders, optimistic updates, helpful empty states, mobile-first responsive, WCAG 2.2 AA.

---------------------------------------------------------------------
## 11. SECURITY & COMPLIANCE
---------------------------------------------------------------------
- Server-side authorisation on every mutation and socket event; policy tests in CI.
- Never trust client-sent amounts; idempotent, signature-verified webhooks.
- Rate limits (auth, messages, AI, proposals), zod validation, file limits, signed URLs, CSP + security headers.
- PII minimisation, data export and account deletion flows, audit logs for money and state changes.
- Secrets only in env vars; .env.example and SETUP.md always up to date.

---------------------------------------------------------------------
## 12. PHASES (stop and report to me at the end of each phase)
---------------------------------------------------------------------
Phase 0 — Foundation: git init, monorepo scaffold, docker-compose running all services, DECISIONS.md (stack, payments approach, open legal questions), ERD, state machine diagram, CI green, Sentry, seed script, brand.ts. Auth working end-to-end (register, verify email, log in, Google/GitHub OAuth, log out), one protected endpoint with a policy test, authenticated Socket.io connection, a presigned upload working.
  CHECKPOINT: show me DECISIONS.md, the ERD and the working foundation before any feature code.
Phase 1 — Accounts & profiles: buyer/seller mode switch, seller onboarding, profiles, portfolio, admin skeleton.
Phase 2 — Services & discovery: gigs with packages, search/filters, public SEO pages, favorites.
Phase 3 — Orders & payments (test mode): package checkout, milestone escrow, Connect onboarding, transfers on approval, ledger, invoices, fee breakdown, webhooks.
Phase 4 — Live Project Room: overview/progress, milestones, board, deliverables with versions and approvals, preview links, activity feed, realtime chat, notifications.
  ACCEPTANCE: a buyer can follow a 3-milestone project end-to-end and always see accurate progress.
Phase 5 — Trust: reviews, seller levels, verifications, change requests, disputes + admin resolution, chat safety warnings.
Phase 6 — AI: brief builder, matching, weekly progress reports, meeting notes → tasks (cost caps, rate limits).
Phase 7 — Meetings & integrations: video calls, GitHub App code activity, calendar invites.
Phase 8 — Landing page & marketing site with 3D hero, legal pages, SEO, analytics events.
Phase 9 — Hardening: load tests, OWASP Top 10 review, accessibility audit, Lighthouse ≥ 90 on public pages, backups, runbooks, launch checklist.

At the end of every phase give me: a short demo script (what to click), screenshots, TODOs I must handle (keys, accounts, legal), and the next phase plan.
