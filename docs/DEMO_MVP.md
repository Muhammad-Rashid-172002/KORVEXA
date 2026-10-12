# MVP demo script (Phases 0–4: accounts → service → order → escrow → Project Room)

A click-through you can do in the browser in about 15 minutes. Everything runs locally in **test mode**: no real money moves and no real email is sent.
Every step below is also covered by the automated Playwright tests (`e2e/tests`), so the labels match the screen.

## 0. Start the stack

```bash
pnpm dev:up          # builds and starts web, api, worker, Postgres, Redis, storage, Mailpit
```

| What                               | Where                        |
| ---------------------------------- | ---------------------------- |
| The app                            | http://localhost:3000        |
| API health                         | http://localhost:4000/health |
| **Mailpit** (all emails land here) | http://localhost:8025        |

Open the app in a normal window for the **seller** and a **private/incognito window** for the **buyer**, so the two sessions stay separate. You will also use the admin once, in a third window (or after logging the seller out).

## Accounts

| Role                    | Email                                                   | Password             | Notes                                                                           |
| ----------------------- | ------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| **Admin** (all scopes)  | `admin@dev.glasswork.test`                              | `Glasswork-dev-123!` | Seeded. Needed once, to approve the service                                     |
| Seeded buyer / seller   | `buyer@dev.glasswork.test`, `seller@dev.glasswork.test` | `Glasswork-dev-123!` | Seeded dev personas; handy for quick looks, but this script uses fresh accounts |
| **Seller** (you create) | `demo.seller@example.test`                              | `Demo-pass-123!`     | Created in step 1                                                               |
| **Buyer** (you create)  | `demo.buyer@example.test`                               | `Demo-pass-123!`     | Created in step 5                                                               |

To repeat the demo, use new emails (e.g. `demo.seller2@example.test`) or run `pnpm dev:reset && pnpm dev:up` for a clean database.

## Seller side

**1. Sign up and verify (seller window)**

1. Go to `/signup`. Full name `Sam Seller`, email `demo.seller@example.test`, password `Demo-pass-123!`, click **Create account**.
2. You land on "verify your email". Open **Mailpit** (http://localhost:8025), open the newest email, click the verification link. You arrive on the dashboard.

**2. Become a seller and publish a profile**

1. Go to `/settings`, click **Become a seller** (the active mode switches to seller).
2. Go to `/seller/onboarding` and work through the wizard: Headline `Full-stack engineer`, About you `I ship software end to end.`, Country `PK`, click **Save**; Skills `React, Node.js`; add one portfolio item (title + link); set an hourly rate; payout preference (free text, e.g. `Bank transfer`).
3. Click **Publish seller profile** (it stays disabled until the required parts are filled).

**3. Create a service ("gig")**

1. Go to `/sell/services/new`.
2. Title `I will build your analytics dashboard`, Category `Web development`, Description (a few sentences).
3. Basic package: Name `Starter dashboard`, What is included `Up to five screens, auth and charts.`, Price `450`, Delivery `10` days, Revisions `2`.
4. Optional: **Add extra** (`Source handover`, `50`), **Add FAQ**, upload an image.
5. Click **Create draft**. In "My services" it shows as `draft`; click **Submit for review** (status becomes `pending review`).

**4. Approve it as admin (third window)**

1. Go to `/login`, sign in as `admin@dev.glasswork.test` / `Glasswork-dev-123!`.
2. Go to `/admin/services`. In the moderation queue click **Approve I will build your analytics dashboard**.
3. The service is now live: open `/services` and you will find it (try the category and price filters).

## Buyer side

**5. Sign up and order (buyer window)**

1. Go to `/signup`: Full name `Bea Buyer`, email `demo.buyer@example.test`, password `Demo-pass-123!`; verify through Mailpit as before.
2. Go to `/services`, open the service. The page shows the price breakdown: **$450**, and **Due now: $135** (the first of three milestones: 30% / 40% / 30% = $135 / $180 / $135).
3. Fill the requirement questions if shown, then click **Order & pay first milestone**.
4. You are taken to the **Test checkout** page ("Test mode: no real money is charged"). Press **Pay (simulate success)**.
5. You land in the **Project Room**. Check: milestone 1 reads **Funded · held until approved**, "Held for milestones" shows **$135**, progress is **0%**, and the page says "Waiting for the seller".

## Project Room: seller and buyer

**6. Seller accepts and works (seller window)**

1. Open the notification bell, or go to `/projects` and open the project.
2. "The first milestone is funded." Click **Accept order**; the status becomes `active`.
3. Open the **Board** tab: add two tasks (type in "New task", pick the milestone, **Add task**). Move one to `done`: the **buyer's progress bar moves by itself without a reload** (9% in the example). That is the live update.
4. Back on **Overview**, click **Start work** (milestone 1 becomes `In progress`).
5. **Deliverables** tab: upload a PNG for milestone 1. **Previews** tab: add a staging link. (Buyer's progress jumps live and the bell lights up when you submit.)
6. Click **Submit for review**, write `First cut is ready`, click **Submit**. The milestone now says "Waiting for buyer review".

**7. Buyer reviews (buyer window)**

1. On the project **Overview** you see `Seller note: First cut is ready` (live, no reload).
2. To see the revision loop: click **Request changes**, write `Please adjust the header spacing`, **Send request**. The seller sees `Requested changes: …` and resubmits (**Submit for review** → **Submit**).
3. Click **Approve & release payment**.
4. Check: milestone 1 is **Paid to seller**; **Held** $0, **Paid to seller** $135; progress **30%**.

**8. Seller sees the money**

1. Seller window: `/earnings`. **Available: $135**. Fill **Amount (USD)** `100`, click **Request payout** ("Payout requested.").
2. Admin window: `/admin/payouts`, find the payout, enter a bank reference (any text), click **Mark paid**. Then `/admin/payments`: the ledger shows **Trial balance (must be 0)** = $0.

**9. Finish the project and review (milestones 2 and 3)**

1. Buyer: on the Overview click **Fund milestone** for milestone 2, pay at the test checkout. Seller: **Start work** → **Submit for review**. Buyer: **Approve & release payment**. Repeat for milestone 3.
2. After milestone 3 is paid the project status is **completed** and progress is **100%**.
3. Buyer: the **Overview** shows the review form. Choose ratings (e.g. Timeliness `4`), write `Great collaboration and clear communication.`, click **Post review** ("Thank you. Your review is now public.").
4. Anyone (even logged out) can now open the seller's public page `/u/<seller-slug>` and see the review, the rating and the completed-project count.
5. Buyer: `/billing` lists invoices (`GW-INV-…`) with **Download receipt**.

## Things worth poking at while you are there

- **Pinned feedback:** buyer, Deliverables tab → preview the image → click on it → add feedback; then **Request changes**; the seller uploads v2.
- **Chat tab:** typing indicator, send, attach a file, "Seen" receipts and the online dot, in both windows at once.
- **Custom offer:** buyer opens a service → **Message seller**; the seller sends a custom offer from the conversation; the buyer accepts and a new project appears.
- **Notifications:** bell in the header, `/notifications`, and `/settings/notifications` to mute event types.
- **Timeline**, **Changes**, **Disputes**, **Reports**, **Activity** tabs in the Project Room (Activity can filter by Money / Tasks).
- Light/dark toggle in the header; resize to a phone width (everything is responsive).
- Mailpit shows every notification email (order, funding, approval).
- Fees are seeded at **0%** (placeholder values until you decide, see the WAITING list); change them in `/admin/settings` and the checkout breakdown updates for new orders.
- `/admin/audit` shows who did what.

## Known limits of the MVP (honest list)

- Payments run on the built-in **test provider**; the real Stripe adapter is written but not verified (needs your Stripe test keys).
- Payouts are **manual bank transfers** recorded by an admin.
- File virus scanning is off in dev (`SCAN_MODE=off`); email is Mailpit only.
