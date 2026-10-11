import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import {
  activeRoom,
  adminContext,
  apiCall,
  completeRoom,
  liveService,
  publishedSeller,
  shot,
  signUpAndVerify,
  uniqueEmail,
} from './helpers';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://glasswork:glasswork@localhost:5432/glasswork';

interface Me {
  id: string;
}

test.describe('Phase 6 AI (offline stub provider)', () => {
  test('brief builder: idea → questions → editable brief with labelled estimates → posted request sellers can see', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000);
    const baseURL = info.project.use.baseURL;
    await signUpAndVerify(page, uniqueEmail(`${info.project.name}-brief`), 'Bea Buyer', 'e2e-password-123');

    await page.goto('/requests/new');
    await page.getByRole('link', { name: 'Let the AI brief builder help' }).click();
    await expect(page).toHaveURL(/\/requests\/new\/ai/);
    await page
      .getByLabel('Your idea')
      .fill('A mobile app for my dog-walking business where customers book walks and pay by card.');
    await page.getByRole('button', { name: 'Continue' }).click();
    const questions = page.getByTestId('brief-questions');
    await expect(questions).toBeVisible();
    for (const box of await questions.getByRole('textbox').all())
      await box.fill('Dog owners in my city on iPhone and Android');
    await shot(page, info, '70-brief-questions');
    await page.getByRole('button', { name: 'Create my brief' }).click();

    const draft = page.getByTestId('brief-draft');
    await expect(draft).toBeVisible();
    await expect(page.getByTestId('brief-estimate')).toContainText('Estimates, not a quote');
    await expect(draft.getByLabel('Platforms')).toHaveValue(/iOS/);
    await expect(page.getByTestId('brief-milestones').locator('li')).not.toHaveCount(0);
    const title = `Dog walking app ${Date.now() % 100000}`;
    await page.getByLabel('Brief title').fill(title);
    await shot(page, info, '71-brief-draft');
    await page.getByRole('button', { name: 'Post as a request' }).click();
    await expect(page).toHaveURL(/\/requests\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await expect(page.getByText('Estimates (not a quote)')).toBeVisible();

    // a published seller finds it on the board
    const sellerCtx = await browser.newContext({ baseURL });
    const seller = await sellerCtx.newPage();
    await publishedSeller(seller, `${info.project.name}-brief-s`);
    await seller.goto('/requests');
    await expect(seller.getByText(title)).toBeVisible();
    await sellerCtx.close();
  });

  test('matching: ranks a real seller on real data and explains why, honestly', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000);
    const baseURL = info.project.use.baseURL;
    const token = `zq${Date.now() % 1_000_000}x`;
    const sellerCtx = await browser.newContext({ baseURL });
    const seller = await sellerCtx.newPage();
    await publishedSeller(seller, `${info.project.name}-match-s`);
    const admin = await adminContext(browser, baseURL);
    await liveService(seller, admin.page, `Bespoke ${token} automation service`, 90_000);
    await admin.ctx.close();

    await signUpAndVerify(page, uniqueEmail(`${info.project.name}-match`), 'Bea Buyer', 'e2e-password-123');
    await page.goto('/match');
    await page
      .getByLabel('Describe your project')
      .fill(`We need ${token} automation for our new logistics platform.`);
    await page.getByLabel('Budget up to (USD, optional)').fill('5000');
    await page.getByRole('button', { name: 'Find matches' }).click();
    const first = page.getByTestId('match').first();
    await expect(first).toBeVisible();
    await expect(first.getByTestId('match-explanation')).toContainText('no reviews yet');
    await expect(first.getByTestId('match-explanation')).toContainText('fits your budget');
    await expect(first.getByTestId('match-score')).toContainText('/ 100');
    await shot(page, info, '72-matches');
    await first.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/u\//);

    await page.goto('/match');
    await page
      .getByLabel('Describe your project')
      .fill('Zzzzqx quuxplorp wibble wobble frobnicate unrelated thing.');
    await page.getByRole('button', { name: 'Find matches' }).click();
    await expect(page.getByTestId('no-matches')).toBeVisible();
    await sellerCtx.close();
  });

  test('progress report: seller drafts from real activity, edits, sends; buyer sees only the sent version', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const room = await activeRoom({ page, browser }, info, 'rpt');
    const { buyer, projectId, buyerCtx } = room;
    await apiCall(page, 'POST', `/milestones/${room.milestones[0]!.id}/start`);
    await apiCall(page, 'POST', `/milestones/${room.milestones[0]!.id}/submit`, { note: 'Kickoff done' });

    await buyer.goto(`/projects/${projectId}?tab=reports`);
    await expect(buyer.getByText('No reports have been sent yet.')).toBeVisible();
    await expect(buyer.getByRole('button', { name: 'Write a report' })).toHaveCount(0);

    await page.goto(`/projects/${projectId}?tab=reports`);
    await page.getByRole('button', { name: 'Write a report' }).click();
    const draft = page.getByTestId('report-draft');
    await expect(draft).toBeVisible();
    await expect(draft.getByTestId('report-status')).toHaveText('Not sent');
    await expect(draft.getByLabel('Decisions needed from you')).toHaveValue(/Please review and approve/);
    await shot(page, info, '73-report-draft');
    await draft
      .getByLabel('Summary')
      .fill('Kickoff is complete and waiting for your review. Thanks for the quick answers!');
    // still invisible to the buyer while it is a draft
    await buyer.reload();
    await expect(buyer.getByTestId('report')).toHaveCount(0);

    await draft.getByRole('button', { name: 'Send to client' }).click();
    await expect(page.getByTestId('report-draft')).toHaveCount(0);
    await expect(page.getByTestId('report').getByTestId('report-summary')).toContainText(
      'Thanks for the quick answers',
    );
    await expect(page.getByTestId('report')).toContainText('Edited by seller');

    await buyer.goto(`/projects/${projectId}?tab=reports`);
    await expect(buyer.getByTestId('report').getByTestId('report-summary')).toContainText(
      'Kickoff is complete',
    );
    await expect(buyer.getByTestId('report')).toContainText('Please review and approve');
    await shot(buyer, info, '74-report-buyer');
    await buyerCtx.close();
  });

  test('meeting notes: suggested tasks are only saved after the seller confirms, and are visible to the buyer', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000);
    const room = await activeRoom({ page, browser }, info, 'mtg');
    const { buyer, projectId, buyerCtx } = room;
    await page.goto(`/projects/${projectId}?tab=board`);
    await expect(buyer.getByTestId('meeting-notes')).toHaveCount(0);
    await page
      .getByLabel('Meeting notes')
      .fill(
        `Kickoff call.\n- Set up the staging site and share the link\n- Send brand colours and logo files\n- Add a contact form to the landing page\nNothing else decided.`,
      );
    await page.getByRole('button', { name: 'Suggest tasks' }).click();
    const sugg = page.getByTestId('suggested-tasks');
    await expect(sugg.getByLabel('Task 1 title')).toHaveValue('Set up the staging site and share the link');
    await expect(sugg.getByLabel('Task 3 title')).toHaveValue('Add a contact form to the landing page');
    await expect(page.getByText('Add a contact form to the landing page', { exact: true })).toHaveCount(0); // not on the board yet
    await sugg.getByLabel('Keep task 2').uncheck();
    await shot(page, info, '75-meeting-suggestions');
    await page.getByRole('button', { name: 'Add selected to board' }).click();
    await expect(page.getByText('2 tasks added to the board.')).toBeVisible();
    await buyer.goto(`/projects/${projectId}?tab=board`);
    await expect(buyer.getByText('Set up the staging site and share the link')).toBeVisible();
    await expect(buyer.getByText('Add a contact form to the landing page')).toBeVisible();
    await expect(buyer.getByText('Send brand colours and logo files')).toHaveCount(0);
    await buyerCtx.close();
  });

  test('seller analytics: a new seller sees an honest empty state, not invented zeros', async ({
    page,
  }, info) => {
    await publishedSeller(page, `${info.project.name}-an0-s`);
    await page.goto('/seller/analytics');
    await expect(page.getByTestId('analytics-empty')).toBeVisible();
    await expect(page.getByTestId('stat-earnings-total-value')).toHaveText('Not enough data yet');
    await expect(page.getByTestId('stat-conversion-value')).toHaveText('Not enough data yet');
    await expect(page.getByTestId('stat-response-value')).toHaveText('Not enough data yet');
    await shot(page, info, '76-analytics-empty');
  });

  test('seller analytics: real numbers appear after a completed project', async ({ page, browser }, info) => {
    test.setTimeout(120_000);
    const room = await activeRoom({ page, browser }, info, 'an');
    await completeRoom(page, room);
    await page.goto('/seller/analytics');
    await expect(page.getByTestId('analytics-empty')).toHaveCount(0);
    await expect(page.getByTestId('stat-earnings-total-value')).toContainText('$');
    await expect(page.getByTestId('stat-completed-value')).toHaveText('1');
    await expect(page.getByTestId('stat-ontime-value')).toContainText('%');
    await shot(page, info, '77-analytics');
    await room.buyerCtx.close();
  });

  test('spend cap: a user over their daily AI allowance gets a clear message and no model call is made', async ({
    page,
  }, info) => {
    test.setTimeout(60_000);
    await signUpAndVerify(page, uniqueEmail(`${info.project.name}-cap`), 'Cap Tester', 'e2e-password-123');
    const me = await apiCall<Me>(page, 'GET', '/me');
    const pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query(
      "insert into ai_usage (id, user_id, feature, provider, model, cost_micros) values (gen_random_uuid(), $1, 'matching', 'stub', 'claude-opus-5-5', 1100000)",
      [me.id],
    );
    await pool.end();
    await page.goto('/requests/new/ai');
    await page
      .getByLabel('Your idea')
      .fill('A booking platform for a small chain of yoga studios with class packs.');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByText(/daily AI allowance/)).toBeVisible();
    await expect(page.getByTestId('brief-questions')).toHaveCount(0);
    await shot(page, info, '78-ai-cap');
    // The platform-wide daily cap is shared by every test run, so this test must not leave spend behind.
    const cleanup = new Pool({ connectionString: DATABASE_URL });
    await cleanup.query('delete from ai_usage where user_id = $1', [me.id]);
    await cleanup.end();
  });
});
