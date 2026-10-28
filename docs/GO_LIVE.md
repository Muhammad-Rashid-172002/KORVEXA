# Going live: a step-by-step guide

Written for a non-DevOps person. Follow it top to bottom. **Nothing here deploys until you press the "Run workflow" button in step 9.** Anything marked ⏸ can wait; the site works without it (the feature simply stays hidden or neutral).

Replace `example.com` with your real domain everywhere. "The server" is the VPS you rent in step 2.

## 0. What you will end up with

| Address                   | What it is                                           |
| ------------------------- | ---------------------------------------------------- |
| `https://example.com`     | The website                                          |
| `https://api.example.com` | The API (the website talks to it; you never open it) |
| Cloudflare R2             | Where uploaded files live (private)                  |
| Managed Postgres          | The database, with automatic backups                 |

## 1. Accounts to create (in this order)

1. **GitHub** – the repository already exists. Create the GitHub **Environment** called `production` (repo → Settings → Environments → New environment) and add yourself under "Required reviewers". This makes every deploy need your approval.
2. **Domain registrar + Cloudflare** – buy the domain, then add it to Cloudflare (free plan) and point the registrar's nameservers to Cloudflare.
3. **VPS** – Hetzner Cloud (cheapest) or DigitalOcean. Pick Ubuntu 24.04, 2 vCPU / 4 GB RAM is a good start. Choose a region near most buyers.
4. **Managed Postgres** – Neon or DigitalOcean Managed Postgres. Turn on backups / point-in-time recovery.
5. **Cloudflare R2** – two private buckets: `glasswork-files` and `glasswork-backups`.
6. **Resend** – for email. Add and verify your domain.
7. **Stripe** – create the account **in test mode first**. Live mode needs your legal entity decision.
8. ⏸ **Anthropic** (AI), **Sentry** (errors), **PostHog** (analytics), **Daily** (video calls), **Google/GitHub OAuth apps** (social login), **GitHub App** (code activity), **uptime monitor** (e.g. UptimeRobot or Better Stack, free).

## 2. Prepare the server (10 minutes)

1. On your Mac create a deploy key (only for this): `ssh-keygen -t ed25519 -f ~/.ssh/glasswork_deploy -C glasswork-deploy` (press Enter for no passphrase on the CI key).
2. Log in to the new server as root (the provider shows the IP): `ssh root@SERVER_IP`.
3. Copy `infra/prod/scripts/server-setup.sh` onto the server and run it, passing the **public** key:
   `bash server-setup.sh "$(cat glasswork_deploy.pub)"`
4. From now on log in with `ssh -i ~/.ssh/glasswork_deploy deploy@SERVER_IP` (root login is disabled).

## 3. DNS records (in Cloudflare → DNS)

Set every proxy to **DNS only (grey cloud)** for the first deploy so HTTPS certificates can be issued.

| Type | Name  | Value     |
| ---- | ----- | --------- |
| A    | `@`   | SERVER_IP |
| A    | `www` | SERVER_IP |
| A    | `api` | SERVER_IP |

Email records are shown inside Resend after you add the domain. Copy them exactly: SPF (TXT), DKIM (CNAME/TXT) and DMARC. Start DMARC with `v=DMARC1; p=none; rua=mailto:you@example.com`; after a week of clean reports change `p=none` to `p=quarantine`.

## 4. Database

1. Create a database called `glasswork` and two users: `glasswork_app` (normal) and `glasswork_migrate` (owner, can change tables). If your provider only gives one user, use it for both.
2. Copy the connection strings. They must end with `?sslmode=require`.

## 5. File storage (R2)

1. R2 → create API token with **Object Read & Write** on the two buckets.
2. On bucket `glasswork-files` → Settings → CORS policy, paste:

```json
[
  {
    "AllowedOrigins": ["https://example.com"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

3. Keep both buckets **private** (no public access).

## 6. Secrets on the server

On the server: `cd /opt/glasswork/infra/prod` (it is created by the first deploy; run `mkdir -p /opt/glasswork/infra/prod` if you want to do this earlier), then create `.env.production` from `.env.production.example`:

```
cp .env.production.example .env.production && chmod 600 .env.production && nano .env.production
```

Fill every line marked REQUIRED. Generate secrets with `openssl rand -hex 32`. **Never paste these anywhere else and never commit them.**

## 7. GitHub secrets and variables

Repo → Settings → Environments → `production`:

**Secrets**: `DEPLOY_HOST` (server IP), `DEPLOY_SSH_KEY` (contents of the private file `glasswork_deploy`), `DEPLOY_KNOWN_HOSTS` (output of `ssh-keyscan SERVER_IP`).

**Variables** (these are public by design, baked into the website):
`NEXT_PUBLIC_WEB_URL=https://example.com`, `NEXT_PUBLIC_API_URL=https://api.example.com`, `NEXT_PUBLIC_UPLOAD_ORIGIN=` (your R2 endpoint origin), and optionally `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`.

## 8. Put your real details in the product

Edit `packages/shared/src/brand.ts`: `domain`, `legalEntity`, `legalAddress`, `supportEmail`. Until they are filled in, the site simply hides them. Add the final logo SVG in `apps/web/components/product-mark.tsx` when you have it. Commit and push.

## 9. Deploy

1. GitHub → Actions → **Deploy (production)** → _Run workflow_ → approve when asked.
2. The workflow checks CI is green, builds the images, copies them to the server, runs the database migration, starts the new version next to the old one, checks it is healthy, switches traffic and stops the old version. If any check fails the old version keeps running.
3. Open `https://example.com`. Then `https://api.example.com/ready` should say ok.

## 10. Create the first admin accounts (once)

On the server:

```
docker run --rm -e DATABASE_URL="<your DATABASE_URL>" \
  -e BOOTSTRAP_ADMINS="you@example.com|Your Name|product,growth,operations;partner@example.com|Partner Name|growth" \
  ghcr.io/<github-owner>/glasswork-api:<tag> node node_modules/@glasswork/db/dist/bootstrap-admin.js
```

Then each person opens the site → Log in → **Forgot password**, uses the emailed link, and sets their own password. Turn on two-factor in Settings → Security.

## 11. Switch on the real services (any order)

Each is "paste the value into `.env.production`, then run Deploy again".

| Service      | Variables                                                                                                                                 | Verify                                                                   |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Stripe test  | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. In Stripe → Developers → Webhooks add endpoint `https://api.example.com/v1/webhooks/stripe` | Fund a milestone with card 4242 4242 4242 4242                           |
| Stripe LIVE  | Live keys and `PAYMENTS_LIVE_ENABLED=true`. **Only after your legal entity is decided.**                                                  | Real small purchase, then refund it                                      |
| Email        | `RESEND_API_KEY`, `EMAIL_FROM`                                                                                                            | Sign up with a real address; the verification email arrives, not in spam |
| AI           | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` (set a spend limit in the Anthropic console too)                                             | Use the AI brief builder                                                 |
| Video        | `VIDEO_PROVIDER=daily`, `DAILY_API_KEY`, `DAILY_DOMAIN`                                                                                   | Start a meeting from a project                                           |
| Google login | Redirect URI `https://api.example.com/v1/auth/callback/google`; `GOOGLE_CLIENT_ID/SECRET`                                                 | "Continue with Google" button appears and works                          |
| GitHub login | Redirect URI `https://api.example.com/v1/auth/callback/github`; `GITHUB_CLIENT_ID/SECRET`                                                 | Button appears and works                                                 |
| GitHub App   | Webhook URL `https://api.example.com/v1/webhooks/github`, secret = `GITHUB_WEBHOOK_SECRET`                                                | Link a repo on a project; push a commit                                  |
| Sentry       | `SENTRY_DSN` (and `NEXT_PUBLIC_SENTRY_DSN` variable)                                                                                      | Trigger a test error                                                     |
| Analytics    | `NEXT_PUBLIC_POSTHOG_KEY` variable                                                                                                        | Accept analytics in the cookie banner                                    |

Once DNS works you may switch the Cloudflare proxy (orange cloud) on for the site and API.

## 12. Monitoring

- Add two checks in your uptime monitor: `https://example.com/` and `https://api.example.com/ready` (every 1–5 minutes, alert by email).
- Put a Slack/Discord/Teams incoming-webhook URL in `ALERT_WEBHOOK_URL`: the server then reports downtime, a full disk, memory pressure and any failed backup or restore test by itself.

## 13. Rolling back

GitHub → Actions → **Rollback (production)** → Run workflow (leave the tag empty for "previous release"). Traffic switches back in seconds. Database changes are not undone; they are written so the previous version keeps working.

## 14. Restoring the database

See `docs/RUNBOOKS.md` → "Restore the database". Short version: your provider's point-in-time recovery first; the nightly encrypted dump in the backups bucket as the second copy.

## 15. Before you tell anyone

Work through `docs/LAUNCH_CHECKLIST.md`.
