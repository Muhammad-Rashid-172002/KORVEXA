import { expect, test } from '@playwright/test';
import { Queue } from 'bullmq';
import { Pool } from 'pg';
import {
  adminContext,
  apiCall,
  idemKey,
  liveService,
  publishedSeller,
  SEED_PASSWORD,
  shot,
  signUpAndVerify,
  uniqueEmail,
  API_URL,
} from './helpers';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://glasswork:glasswork@localhost:5432/glasswork';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

interface Project {
  id: string;
  status: string;
  progress: number;
  escrow: { held: number; released: number };
  milestones: { id: string; status: string; position: number; amount: number }[];
}

test.describe('Phase 3 orders & payments', () => {
  test('order → test checkout → accept → deliver → revise → approve → payout → receipt', async ({
    page,
    browser,
  }, info) => {
    const baseURL = info.project.use.baseURL;
    const title = `I will build your ${info.project.name} payments dashboard ${Date.now() % 100000}`;

    // Seller + a live service (priced $900.00 → milestones 30/40/30 = $270 / $360 / $270)
    const sellerEmail = await publishedSeller(page, `${info.project.name}-pay-seller`);
    const admin = await adminContext(browser, baseURL);
    const svc = await liveService(page, admin.page, title, 90_000);

    // Buyer opens the public page and orders
    const buyerCtx = await browser.newContext({ baseURL });
    const buyer = await buyerCtx.newPage();
    await signUpAndVerify(
      buyer,
      uniqueEmail(`${info.project.name}-pay-buyer`),
      'Pat Payer',
      'e2e-password-123',
    );
    await buyer.goto(`/services/${svc.slug}`);
    await expect(buyer.getByTestId('price-breakdown')).toContainText('$900');
    await expect(buyer.getByTestId('due-now')).toHaveText('$270');
    await shot(buyer, info, '30-order-panel');
    await buyer.getByRole('button', { name: 'Order & pay first milestone' }).click();

    // Simulated hosted checkout (test mode banner), then back on the project
    await expect(buyer).toHaveURL(/\/pay\/test\//);
    await expect(buyer.getByText('Test mode.')).toBeVisible();
    await shot(buyer, info, '31-test-checkout');
    await buyer.getByRole('button', { name: 'Pay (simulate success)' }).click();
    await expect(buyer).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    const projectId = new URL(buyer.url()).pathname.split('/').pop()!;
    await expect(buyer.getByTestId('milestone-1').getByTestId('milestone-status')).toContainText('Funded');
    await expect(buyer.getByTestId('escrow-held')).toHaveText('$270');
    await expect(buyer.getByTestId('progress-value')).toHaveText('0%');
    await expect(buyer.getByText('Waiting for the seller')).toBeVisible();

    // Seller accepts and starts
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByText('The first milestone is funded.')).toBeVisible();
    await page.getByRole('button', { name: 'Accept order' }).click();
    await expect(page.getByTestId('project-status')).toHaveText('active');
    await page.getByRole('button', { name: 'Start work' }).click();
    await expect(page.getByTestId('milestone-1').getByTestId('milestone-status')).toHaveText('In progress');
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.getByLabel('Note for the buyer (optional)').fill('First cut is ready');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByTestId('milestone-1').getByTestId('milestone-status')).toContainText(
      'Waiting for buyer review',
    );
    await shot(page, info, '32-seller-submitted');

    // Buyer asks for changes, seller resubmits, buyer approves → paid
    await buyer.reload();
    await expect(buyer.getByText('Seller note: First cut is ready')).toBeVisible();
    await buyer.getByRole('button', { name: 'Request changes' }).click();
    await buyer.getByLabel('What should change?').fill('Please adjust the header spacing');
    await buyer.getByRole('button', { name: 'Send request' }).click();
    await expect(buyer.getByTestId('milestone-1').getByTestId('milestone-status')).toHaveText(
      'Changes requested',
    );
    await page.reload();
    await expect(page.getByText('Requested changes: Please adjust the header spacing')).toBeVisible();
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByTestId('milestone-1').getByTestId('milestone-status')).toContainText(
      'Waiting for buyer review',
    );
    await buyer.reload();
    await buyer.getByRole('button', { name: 'Approve & release payment' }).click();
    await expect(buyer.getByTestId('milestone-1').getByTestId('milestone-status')).toHaveText(
      'Paid to seller',
    );
    await expect(buyer.getByTestId('escrow-released')).toHaveText('$270');
    await expect(buyer.getByTestId('escrow-held')).toHaveText('$0');
    await expect(buyer.getByTestId('progress-value')).toHaveText('30%');
    await shot(buyer, info, '33-released');

    // Seller earnings → payout request → admin marks it paid
    await page.goto('/earnings');
    await expect(page.getByTestId('available')).toHaveText('$270');
    await page.getByLabel(/Amount \(USD\)/).fill('100');
    await page.getByRole('button', { name: 'Request payout' }).click();
    await expect(page.getByText('Payout requested.')).toBeVisible();
    await expect(page.getByTestId('available')).toHaveText('$170');
    await expect(page.getByTestId('pending-payout')).toHaveText('$100');
    await shot(page, info, '34-earnings');

    await admin.page.goto('/admin/payouts');
    const adminUi = await browser.newContext({ baseURL });
    const adminTab = await adminUi.newPage();
    await adminTab.goto('/login');
    await adminTab.getByLabel('Email').fill('admin@dev.glasswork.test');
    await adminTab.getByLabel('Password').fill(SEED_PASSWORD);
    await adminTab.getByRole('button', { name: 'Log in' }).click();
    await expect(adminTab).toHaveURL(/\/dashboard/);
    await adminTab.goto('/admin/payouts');
    // Other runs share this dev database, so pick THIS seller's payout row.
    const me = await apiCall<{ id: string; displayName: string }>(page, 'GET', '/me');
    const row = adminTab
      .getByTestId('open-payouts')
      .locator('li', { hasText: `Seller ${me.displayName} (${me.id.slice(-6)})` });
    await row.getByLabel('Bank reference for $100 payout').fill(`E2E-REF-${Date.now()}`);
    await row.getByRole('button', { name: 'Mark paid' }).click();
    await expect(row).toHaveCount(0);
    await adminTab.getByRole('link', { name: 'Payments' }).click();
    await expect(adminTab.getByTestId('ledger')).toContainText('Trial balance (must be 0)');
    await expect(
      adminTab.getByTestId('ledger').locator('div', { hasText: 'Trial balance' }).locator('dd'),
    ).toHaveText('$0');
    await shot(adminTab, info, '35-admin-ledger');
    await adminUi.close();

    await page.reload();
    await expect(page.getByTestId('paid-out')).toHaveText('$100');
    expect(sellerEmail).toContain('@');

    // Buyer's receipt: list + real PDF over the cookie session
    await buyer.goto('/billing');
    await expect(buyer.getByTestId('invoice-list')).toContainText('GW-INV-');
    const href = await buyer
      .getByRole('link', { name: /Download receipt/ })
      .first()
      .getAttribute('href');
    const pdf = await buyer.request.get(href!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
    expect((await page.request.get(href!)).status()).toBe(404); // the seller can't read the buyer's receipt

    // Fund + deliver the rest through the API; the project completes at 100%
    const p = await apiCall<Project>(buyer, 'GET', `/projects/${projectId}`);
    for (const m of p.milestones.slice(1)) {
      const f = await apiCall<{ paymentId: string }>(buyer, 'POST', `/milestones/${m.id}/fund`, undefined, {
        'idempotency-key': idemKey(),
      });
      await apiCall(buyer, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' });
      await apiCall(page, 'POST', `/milestones/${m.id}/start`);
      await apiCall(page, 'POST', `/milestones/${m.id}/submit`, {});
      await apiCall(buyer, 'POST', `/milestones/${m.id}/approve`);
    }
    await buyer.goto(`/projects/${projectId}`);
    await expect(buyer.getByTestId('project-status')).toHaveText('completed');
    await expect(buyer.getByTestId('progress-value')).toHaveText('100%');
    await expect(buyer.getByTestId('escrow-released')).toHaveText('$900');

    await admin.ctx.close();
    await buyerCtx.close();
  });

  test('the real worker auto-approves a submitted milestone once its timer is due', async ({
    page,
    browser,
  }, info) => {
    const baseURL = info.project.use.baseURL;
    await publishedSeller(page, `${info.project.name}-timer-seller`);
    const admin = await adminContext(browser, baseURL);
    const svc = await liveService(
      page,
      admin.page,
      `Timer driven ${info.project.name} service ${Date.now() % 100000}`,
      60_000,
    );

    const buyerCtx = await browser.newContext({ baseURL });
    const buyer = await buyerCtx.newPage();
    await signUpAndVerify(
      buyer,
      uniqueEmail(`${info.project.name}-timer-buyer`),
      'Timer Buyer',
      'e2e-password-123',
    );
    const order = await apiCall<{ projectId: string; firstMilestoneId: string }>(
      buyer,
      'POST',
      '/orders',
      { packageId: svc.packageId },
      { 'idempotency-key': idemKey() },
    );
    const f = await apiCall<{ paymentId: string }>(
      buyer,
      'POST',
      `/milestones/${order.firstMilestoneId}/fund`,
      undefined,
      { 'idempotency-key': idemKey() },
    );
    await apiCall(buyer, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' });
    await apiCall(page, 'POST', `/projects/${order.projectId}/accept`);
    await apiCall(page, 'POST', `/milestones/${order.firstMilestoneId}/start`);
    await apiCall(page, 'POST', `/milestones/${order.firstMilestoneId}/submit`, {});

    // Submission scheduled the real timer jobs in Redis (auto-approve + reminders).
    const queue = new Queue('milestones', { connection: { url: REDIS_URL } });
    const scheduled = await queue.getJobs(['delayed']);
    expect(
      scheduled.some((j) => j.data.milestoneId === order.firstMilestoneId && j.data.kind === 'auto-approve'),
    ).toBe(true);

    // Make the milestone due, then fire the job now. The worker container calls the API with the shared token.
    const pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query("update milestones set auto_approve_at = now() - interval '1 minute' where id = $1", [
      order.firstMilestoneId,
    ]);
    await pool.end();
    await queue.add('auto-approve', { kind: 'auto-approve', milestoneId: order.firstMilestoneId });
    await queue.close();

    await expect
      .poll(
        async () =>
          (await apiCall<Project>(buyer, 'GET', `/projects/${order.projectId}`)).milestones[0]!.status,
        { timeout: 30_000 },
      )
      .toBe('released');
    const done = await apiCall<Project>(buyer, 'GET', `/projects/${order.projectId}`);
    expect(done.escrow.released).toBe(18_000);

    // The worker's internal route cannot be called without the shared secret.
    const denied = await buyer.request.post(
      `${API_URL}/v1/internal/milestones/${order.firstMilestoneId}/auto-approve`,
    );
    expect(denied.status()).toBe(403);

    await admin.ctx.close();
    await buyerCtx.close();
  });

  test('requests board: post a request → seller proposes → buyer accepts → project with the proposed milestones', async ({
    page,
    browser,
  }, info) => {
    const baseURL = info.project.use.baseURL;
    await publishedSeller(page, `${info.project.name}-req-seller`);

    const buyerCtx = await browser.newContext({ baseURL });
    const buyer = await buyerCtx.newPage();
    await signUpAndVerify(
      buyer,
      uniqueEmail(`${info.project.name}-req-buyer`),
      'Req Buyer',
      'e2e-password-123',
    );
    const unique = `quokka${Math.random()
      .toString(36)
      .replace(/[^a-z]/g, '')
      .slice(0, 6)}`;
    await buyer.goto('/requests/new');
    await buyer.getByLabel('Title').fill(`Need a ${unique} booking platform`);
    await buyer
      .getByLabel('What do you need?')
      .fill(
        'A web booking platform with payments, reminders and an admin dashboard for our staff, built in clear milestones.',
      );
    await buyer.getByLabel('Budget from (USD, optional)').fill('1000');
    await buyer.getByLabel('Budget up to (USD, optional)').fill('3000');
    await buyer.getByRole('button', { name: 'Post request' }).click();
    await expect(buyer).toHaveURL(/\/requests\/[0-9a-f-]{36}$/);
    const requestUrl = buyer.url();

    // Seller finds it on the board and proposes
    await page.goto(`/requests?q=${unique}`);
    await expect(page.getByTestId('request-board')).toContainText(unique);
    await page.getByTestId('request-board').getByRole('link').first().click();
    await page
      .getByLabel('Cover letter')
      .fill('I have built several booking platforms and can start immediately with a clear plan.');
    await page.getByLabel('Price (USD)').nth(0).fill('500');
    await page.getByLabel('Price (USD)').nth(1).fill('900');
    await page.getByLabel('Price (USD)').nth(2).fill('400');
    await expect(page.getByTestId('proposal-total')).toHaveText('$1,800');
    await shot(page, info, '36-proposal-form');
    await page.getByRole('button', { name: 'Send proposal' }).click();
    await expect(page.getByRole('heading', { name: 'Your proposal' })).toBeVisible();

    // Buyer reviews and accepts
    await buyer.goto(requestUrl);
    await expect(buyer.getByTestId('proposal')).toContainText('$1,800');
    await shot(buyer, info, '37-proposals');
    await buyer.getByRole('button', { name: 'Accept & start project' }).click();
    await expect(buyer).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(buyer.getByTestId('milestone-1')).toContainText('$500');
    await expect(buyer.getByTestId('milestone-2')).toContainText('$900');
    await expect(buyer.getByTestId('milestone-3')).toContainText('$400');
    await expect(buyer.getByText('Fund the first milestone so the seller can accept.')).toBeVisible();

    await buyerCtx.close();
  });
});
