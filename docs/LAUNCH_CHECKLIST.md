# Launch checklist

Tick every line before announcing. Owner in brackets.

## Legal and business

- [ ] Terms, Privacy, Seller Agreement, Buyer Protection, Acceptable Use and Cookies reviewed and edited by a lawyer; the "draft" notice removed (`apps/web/app/legal/[doc]/page.tsx`) [Lawyer]
- [ ] Registered company name and address in `packages/shared/src/brand.ts` [Rashid]
- [ ] Legal entity and country for the Stripe account decided; live keys created [Partners]
- [ ] Fee settings entered in Admin → Settings (buyer fee, seller commission, minimums) [Operations]
- [ ] Contract/NDA templates approved if you want them enabled [Lawyer]

## Accounts and secrets

- [ ] `docs/GO_LIVE.md` steps 1 to 8 done; `.env.production` complete and `chmod 600`
- [ ] Admin accounts created with `bootstrap-admin`; each admin has two-factor on
- [ ] No dev/demo data: the API refuses to start otherwise; `node packages/db/dist/prod-guard.js` prints "no seed data"

## Security

- [ ] `pnpm audit --prod` has no high/critical findings (CI runs it)
- [ ] Response headers checked at https://securityheaders.com (A or better)
- [ ] SSH is key-only, root login disabled, firewall shows only 22/80/443 (`sudo ufw status`)
- [ ] Stripe, Resend, R2 and database credentials are production-only and not reused elsewhere

## Payments (test mode first, then live)

- [ ] Test purchase end to end with test card; milestone approved; seller payout; refund
- [ ] After going live: one real small purchase and refund
- [ ] Webhook shows "succeeded" deliveries in Stripe

## Email

- [ ] SPF, DKIM, DMARC valid (Resend shows "verified"); mail-tester.com score 9/10 or better
- [ ] Verification and password-reset emails arrive in the inbox of Gmail and Outlook

## Reliability

- [ ] Backup ran and `restore-verify.sh` reported "restore verified"
- [ ] Sentry test event received; uptime monitor alert test received; `ALERT_WEBHOOK_URL` test message received
- [ ] Rollback rehearsed once with the Rollback workflow
- [ ] Malware scanning on (`SCAN_MODE=clamav`, clamav container healthy)

## Content

- [ ] `robots.txt` and `sitemap.xml` on the final domain return the right host
- [ ] Open Graph image looks right when a link is pasted into a chat
- [ ] Logo SVG installed; favicon set
- [ ] Cookie banner appears only if analytics is configured

## Performance and accessibility

- [ ] Lighthouse on the live home page: performance 90+, accessibility 95+ (see docs/PHASE9_REPORT.md for the local baseline)
- [ ] One keyboard-only pass: sign up, order, fund, approve, dispute
