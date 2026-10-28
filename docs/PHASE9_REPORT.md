# Phase 9 report: hardening (2026-10-28)

## Test results (all on the real Docker stack, fresh DB + demo seed)

| Suite                                                                                  | Result                                                                                                                         |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Lint, typecheck, build (turbo, 23 tasks)                                               | green                                                                                                                          |
| Unit (shared 95, api 28, worker 16, emails 1)                                          | 140 passed                                                                                                                     |
| API integration (Testcontainers Postgres + Redis, 19 files)                            | 169 passed                                                                                                                     |
| Playwright e2e, desktop + mobile (includes the new a11y spec)                          | 76 passed                                                                                                                      |
| Link crawler (`pnpm crawl`): 4 personas, 70 pages each, desktop + mobile, dark + light | 0 broken links, 0 HTTP errors, 0 console errors, 0 overflow, 0 axe violations (only API download links reported as "external") |
| Screenshot pass (`pnpm shots`)                                                         | 67 pages per viewport, 0 issues                                                                                                |

## Lighthouse (mobile profile, simulated slow 4G, local production build)

| Page                             | Perf | A11y | Best practices | LCP   | TBT    | CLS |
| -------------------------------- | ---- | ---- | -------------- | ----- | ------ | --- |
| `/`                              | 90   | 100  | 96             | 3.5 s | 148 ms | 0   |
| `/services`                      | 98   | 99   | 96             | 2.3 s | 111 ms | 0   |
| `/services/demo-nextjs-saas-mvp` | 92   | 100  | 92             | 2.1 s | 303 ms | 0   |
| `/u/amara-okafor`                | 92   | 100  | 100            | 3.3 s | 107 ms | 0   |
| `/how-it-works`                  | 98   | 100  | 100            | 2.1 s | 130 ms | 0   |
| `/pricing`                       | 97   | 100  | 100            | 2.3 s | 142 ms | 0   |
| `/trust`                         | 99   | 100  | 100            | 2.1 s | 89 ms  | 0   |
| `/for-sellers`                   | 92   | 100  | 100            | 3.2 s | 120 ms | 0   |
| `/about`                         | 98   | 100  | 100            | 2.1 s | 118 ms | 0   |
| `/contact`                       | 98   | 100  | 100            | 2.3 s | 98 ms  | 0   |
| `/help`                          | 90   | 100  | 100            | 2.1 s | 361 ms | 0   |
| `/help/escrow-and-fees`          | 98   | 100  | 100            | 2.1 s | 107 ms | 0   |
| `/seller-levels`                 | 98   | 100  | 100            | 2.1 s | 129 ms | 0   |
| `/login`                         | 98   | 100  | 100            | 2.3 s | 104 ms | 0   |
| `/signup`                        | 98   | 100  | 100            | 2.3 s | 101 ms | 0   |
| `/legal/terms`                   | 97   | 100  | 100            | 2.3 s | 129 ms | 0   |

Targets: performance at least 90 (min 90), accessibility at least 95 (min 99). **SEO shows 63 locally only** because `robots.txt` intentionally says `Disallow: /` on `localhost`; the same page on a real domain passes (re-check after launch). Measured on a quiet machine: scores drop by 10 to 30 points when the Mac is busy (Docker compaction, builds), so re-run `node e2e/scripts/lighthouse.mjs` when idle. Under real throttling (4x CPU, slow 4G) the largest paint on the home and about pages is about 0.8 to 0.9 s.

What moved the numbers: lazy-loaded command palette, notification bell and toaster; removed the animation library (IntersectionObserver reveal); dropped the unused monospace font preload; server-rendered login and signup (no layout shift); poster-first hero (already in place).

## Load tests (k6, `infra/load/`, local stack with raised rate limits)

| Scenario                                                        | Load                           | p95                    | Errors              |
| --------------------------------------------------------------- | ------------------------------ | ---------------------- | ------------------- |
| Public pages + search API                                       | ramp to 50 virtual users, 70 s | pages 93 ms, API 36 ms | 0 of 5,640 requests |
| Signed in: login, projects, project room, events, notifications | ramp to 40 users, 70 s         | 264 ms                 | 0 of 6,426 requests |

## Production dry run (local, no accounts, nothing deployed)

Run with the real scripts, Caddy with its local CA, and the dev images retagged:

- First deploy: migrations applied to an empty database, API booted in `NODE_ENV=production`, Caddy served HTTPS with HSTS, CSP and `nosniff`.
- Second deploy (blue to green) while a loop requested the site and API every 0.3 s: **136 of 136 responses were 200**, no failed request.
- Rollback to the previous tag switched back in seconds. A deploy of a missing image stopped before touching the live slot.
- The production API **refused to start on the seeded dev database** ("contains dev/demo seed data").
- Backup: `backup.sh` produced an encrypted dump and `restore-verify.sh` restored it into a throwaway Postgres and ran sanity queries (users, migrations, ledger).
- `bootstrap-admin` created an admin without a password; the "Forgot password" flow then set one and login worked.
- Not exercised locally: real Hetzner/DigitalOcean host hardening (`server-setup.sh`), GHCR push, ClamAV container, R2, Resend, Stripe live, Sentry, Daily, GitHub App, uptime monitor. These need Rashid's accounts (see docs/GO_LIVE.md).

## What changed in code this phase

Data export and account deletion (earlier), OWASP fixes (push-endpoint SSRF allow-list, per-user write rate limit, proper 429/4xx instead of 500), production env guards and seed guard, accessibility fixes, performance work, crawler and Lighthouse tooling, k6 scripts, deploy/rollback/backup/monitor scripts and GitHub workflows, runbooks, launch checklist.

Details: docs/SECURITY_REVIEW.md, docs/ACCESSIBILITY.md, docs/RUNBOOKS.md, docs/LAUNCH_CHECKLIST.md, docs/GO_LIVE.md.
