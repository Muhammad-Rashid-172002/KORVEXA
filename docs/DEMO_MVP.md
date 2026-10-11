# MVP demo script (Phase 4 checkpoint)

Everything runs locally in **test mode**: no real money, no real emails (Mailpit). Start the stack with `pnpm dev:up`.
Dev accounts (password `Glasswork-dev-123!`): `seller@dev.glasswork.test`, `admin@dev.glasswork.test`, `buyer@dev.glasswork.test`.
Use two browser windows (one normal, one private) so you can be buyer and seller at once and watch things update live.

1. **Create a service (seller window).** Log in as `seller@…` → `/sell/services` → _New service_ → fill title, category, description, a Basic package (e.g. $900, 10 days), save → _Submit for review_.
2. **Approve it (admin).** In a third private window log in as `admin@…` → `/admin/services` → _Approve_.
3. **Order (buyer window).** Sign up a new buyer (verify via Mailpit http://localhost:8025) → `/services` → open the service → check the price breakdown → _Order & pay first milestone_ → on the **Test checkout** page press _Pay (simulate success)_.
4. **Open the Room** (you land on it). Overview shows progress 0 %, $270 held, health, next deadline. Tabs: Overview · Timeline · Board · Deliverables · Previews · Activity · Chat.
5. **Seller accepts and works.** Seller window → `/projects` → the project → _Accept order_ → _Start work_. Board tab: add two tasks, set them _Done_ one by one → the buyer's progress moves 9 % → 18 % **without reloading**.
6. **Deliver.** Seller: Deliverables tab → upload a PNG; Previews tab → add a staging link; Overview → _Submit for review_ (buyer's progress jumps to 24 % live and the bell lights up).
7. **Review.** Buyer: Deliverables → _Preview image to pin feedback_ → click the image → add feedback → Overview → _Request changes_ (progress 18 %). Seller uploads v2 and resubmits; buyer _Approve & release payment_ → 30 %, $270 paid to the seller.
8. **Chat.** Both open the Chat tab: type (typing indicator), send, attach a file, watch _Seen_ and the online dot.
9. **Next milestones.** Buyer funds milestone 2 → seller starts/submits → buyer approves; repeat for 3 → **100 %, project completed**. Check Timeline and Activity (filter by Money / Tasks).
10. **Money.** Seller `/earnings` → request a payout; admin `/admin/payouts` → _Mark paid_ with a reference; `/admin/payments` shows the ledger trial balance (must be $0). Buyer `/billing` → download the receipt PDF.
11. **Custom offer.** Buyer → a service page → _Message seller_; seller sends a _custom offer_ from the conversation; buyer accepts → a new project appears.
12. **Notifications.** Bell in the header; `/notifications`; `/settings/notifications` to mute event types.
