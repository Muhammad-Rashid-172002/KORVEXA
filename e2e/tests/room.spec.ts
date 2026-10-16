import { expect, test, type Page } from '@playwright/test';
import {
  activeRoom,
  adminContext,
  apiCall,
  idemKey,
  liveService,
  payTestCheckout,
  PNG_1PX,
  publishedSeller,
  shot,
  signUpAndVerify,
  uniqueEmail,
} from './helpers';

const progress = (p: Page, pct: number) => expect(p.getByTestId('progress-value')).toHaveText(`${pct}%`);

test.describe('Phase 4 Live Project Room', () => {
  test('ACCEPTANCE: a buyer follows a 3-milestone project end to end with accurate progress at every step, live', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const room = await activeRoom({ page, browser }, info, 'accept'); // $1,000 → $300 / $400 / $300
    const { buyer, projectId, milestones } = room;
    const [m1, m2, m3] = milestones.map((m) => m.id) as [string, string, string];

    // The buyer opens the room once and NEVER reloads: every change below must arrive live.
    await buyer.goto(`/projects/${projectId}`);
    await expect(buyer.getByTestId('live-indicator')).toHaveAttribute('data-connected', 'true');
    await expect(buyer.getByTestId('project-status')).toHaveText('active');
    await expect(buyer.getByTestId('project-health')).toHaveText('On track');
    await expect(buyer.getByTestId('escrow-held')).toHaveText('$300');
    await expect(buyer.getByTestId('escrow-released')).toHaveText('$0');
    await progress(buyer, 0);
    await shot(buyer, info, '40-room-start');

    // ── Milestone 1: tasks feed the in-progress share (up to 60% of the milestone)
    await page.goto(`/projects/${projectId}?tab=board`);
    for (const title of ['Set up the repository', 'Build the landing page']) {
      await page.getByLabel('New task').fill(title);
      await page.getByRole('combobox', { name: 'Milestone' }).selectOption({ index: 1 });
      await page.getByRole('button', { name: 'Add task' }).click();
      await expect(page.getByTestId('column-todo')).toContainText(title);
    }
    await page.goto(`/projects/${projectId}`);
    await page.getByRole('button', { name: 'Start work' }).click();
    await expect(buyer.getByTestId('current-milestone')).toContainText('in progress');
    await progress(buyer, 0); // started, no task done yet

    await page.goto(`/projects/${projectId}?tab=board`);
    await page.getByLabel('Status of Set up the repository').selectOption('done');
    await progress(buyer, 9); // 1 of 2 tasks → 0.5 × 60% × $300/$1,000
    await page.getByLabel('Status of Build the landing page').selectOption('in_review');
    await expect(page.getByTestId('column-in_review')).toContainText('Build the landing page');
    await page.getByLabel('Status of Build the landing page').selectOption('done');
    await progress(buyer, 18); // all tasks done → 60% of the milestone

    // buyer follows the board read-only and comments
    await buyer.goto(`/projects/${projectId}?tab=board`);
    await expect(buyer.getByTestId('column-done')).toContainText('Set up the repository');
    await expect(buyer.getByLabel('Status of Set up the repository')).toHaveCount(0); // seller-only control
    await buyer.getByRole('button', { name: 'Comments on Build the landing page' }).click();
    await buyer.getByLabel('Comment on Build the landing page').fill('Looks good, thanks!');
    await buyer.getByRole('button', { name: 'Post' }).click();
    await expect(buyer.getByTestId('task-comments')).toContainText('Looks good, thanks!');
    await shot(buyer, info, '41-board');
    await buyer.goto(`/projects/${projectId}`);

    // deliverable (real presigned upload) + preview link, then submit
    await page.goto(`/projects/${projectId}?tab=deliverables`);
    await page
      .getByTestId('deliverable-input-1')
      .setInputFiles({ name: 'landing.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.getByRole('button', { name: 'Upload deliverable', exact: true }).click();
    await expect(page.getByTestId('deliverable')).toContainText('v1 · landing.png');
    await page.goto(`/projects/${projectId}?tab=previews`);
    await page.getByLabel('Label').fill('Staging site');
    await page.getByLabel('URL (https)').fill('https://staging.example.com');
    await page.getByRole('button', { name: 'Add link' }).click();
    await expect(page.getByTestId('preview-list')).toContainText('Staging site');
    await page.goto(`/projects/${projectId}`);
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.getByLabel('Note for the buyer (optional)').fill('First version is ready');
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await progress(buyer, 24); // submitted counts as 80%
    await expect(buyer.getByTestId('milestone-1').getByTestId('milestone-status')).toContainText(
      'Waiting for buyer review',
    );

    // buyer reviews the deliverable, pins feedback on the image, requests changes
    await buyer.goto(`/projects/${projectId}?tab=deliverables`);
    await expect(buyer.getByTestId('deliverable-status')).toHaveText('submitted');
    await buyer.getByRole('button', { name: 'Preview image to pin feedback' }).click();
    await buyer.getByTestId('feedback-image').click({ position: { x: 1, y: 1 } });
    await buyer.getByLabel('Feedback', { exact: true }).fill('The hero spacing is off');
    await buyer.getByRole('button', { name: 'Add feedback' }).click();
    await expect(buyer.getByTestId('feedback-list')).toContainText('The hero spacing is off');
    await expect(buyer.getByTestId('feedback-list')).toContainText('pinned');
    await shot(buyer, info, '42-deliverable-feedback');
    await buyer.goto(`/projects/${projectId}`);
    await buyer.getByRole('button', { name: 'Request changes' }).click();
    await buyer.getByLabel('What should change?').fill('Please fix the hero spacing');
    await buyer.getByRole('button', { name: 'Send request' }).click();
    await progress(buyer, 18); // revision requested counts as 60%

    // seller sees the feedback, uploads v2, resubmits
    await page.goto(`/projects/${projectId}?tab=deliverables`);
    await expect(page.getByTestId('feedback-list')).toContainText('The hero spacing is off');
    await page
      .getByTestId('deliverable-input-1')
      .setInputFiles({ name: 'landing-v2.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.getByRole('button', { name: 'Upload new version' }).click();
    await expect(page.getByTestId('deliverable').first()).toContainText('v2 · landing-v2.png');
    await page.goto(`/projects/${projectId}`);
    await page.getByRole('button', { name: 'Submit for review' }).click();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await progress(buyer, 24);

    // buyer approves → paid, still without a reload
    await buyer.getByRole('button', { name: 'Approve & release payment' }).click();
    await progress(buyer, 30);
    await expect(buyer.getByTestId('escrow-released')).toHaveText('$300');
    await expect(buyer.getByTestId('escrow-held')).toHaveText('$0');
    await expect(buyer.getByTestId('project-health')).toHaveText('Blocked'); // next milestone waits for funding
    await expect(buyer.getByTestId('health-reason')).toHaveText('Waiting for the buyer to fund milestone 2');
    await shot(buyer, info, '43-after-m1');

    // ── Milestone 2: fund through the UI (test checkout), seller starts and submits
    await buyer.getByTestId('milestone-2').getByRole('button', { name: 'Fund milestone' }).click();
    await expect(buyer).toHaveURL(/\/pay\/test\//);
    await payTestCheckout(buyer);
    await expect(buyer.getByTestId('escrow-held')).toHaveText('$400');
    await expect(buyer.getByTestId('project-health')).toHaveText('On track');
    await progress(buyer, 30);
    await page.goto(`/projects/${projectId}`);
    await page.getByTestId('milestone-2').getByRole('button', { name: 'Start work' }).click();
    await expect(buyer.getByTestId('current-milestone')).toContainText('2. Build');
    await progress(buyer, 30);
    await page.getByTestId('milestone-2').getByRole('button', { name: 'Submit for review' }).click();
    await page.getByRole('button', { name: 'Submit', exact: true }).click();
    await progress(buyer, 62); // 30 + 0.8 × 40
    await buyer.getByRole('button', { name: 'Approve & release payment' }).click();
    await progress(buyer, 70);

    // ── Milestone 3
    await apiCall<{ paymentId: string }>(buyer, 'POST', `/milestones/${m3}/fund`, undefined, {
      'idempotency-key': idemKey(),
    }).then((f) => apiCall(buyer, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' }));
    await expect(buyer.getByTestId('escrow-held')).toHaveText('$300');
    await apiCall(page, 'POST', `/milestones/${m3}/start`);
    await apiCall(page, 'POST', `/milestones/${m3}/submit`, {});
    await progress(buyer, 94); // 70 + 0.8 × 30
    await buyer.getByRole('button', { name: 'Approve & release payment' }).click();
    await progress(buyer, 100);
    await expect(buyer.getByTestId('project-status')).toHaveText('completed');
    await expect(buyer.getByTestId('escrow-released')).toHaveText('$1,000');
    await expect(buyer.getByTestId('escrow-held')).toHaveText('$0');
    await shot(buyer, info, '44-completed');

    // Timeline: planned vs actual for every milestone
    await buyer.goto(`/projects/${projectId}?tab=timeline`);
    for (const n of [1, 2, 3]) {
      const row = buyer.getByTestId(`timeline-${n}`);
      await expect(row).toContainText('released');
      await expect(row).toContainText('Planned due');
    }
    await shot(buyer, info, '45-timeline');

    // Activity feed tells the whole story, and filters work
    await buyer.goto(`/projects/${projectId}?tab=activity`);
    await expect(buyer.getByTestId('activity-feed')).toContainText('All milestones are complete'); // newest first
    await buyer.getByRole('button', { name: 'Milestones', exact: true }).click();
    await expect(buyer.getByTestId('activity-feed')).toContainText('placed the order');
    await expect(buyer.getByTestId('activity-feed')).toContainText('requested changes on “Kickoff & plan”');
    await buyer.getByRole('button', { name: 'Tasks', exact: true }).click();
    await expect(buyer.getByTestId('activity-item').first()).toContainText(/task|“/);
    await expect(buyer.getByTestId('activity-feed')).not.toContainText('placed the order');
    await buyer.getByRole('button', { name: 'Money', exact: true }).click();
    await expect(buyer.getByTestId('activity-feed')).toContainText('funded');
    await shot(buyer, info, '46-activity');

    expect(m1 && m2).toBeTruthy();
    await room.buyerCtx.close();
  });

  test('chat: realtime messages, typing, read receipts, presence and attachments', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const room = await activeRoom({ page, browser }, info, 'chat');
    const { buyer, projectId } = room;
    await buyer.goto(`/projects/${projectId}?tab=chat`);
    await page.goto(`/projects/${projectId}?tab=chat`);
    await expect(page.getByTestId('chat-panel')).toBeVisible();
    await expect(buyer.getByTestId('chat-panel')).toBeVisible();

    // presence: both are in the room
    await expect(buyer.getByTestId('presence-dot')).toHaveAttribute('data-online', 'true');
    await expect(page.getByTestId('presence-dot')).toHaveAttribute('data-online', 'true');

    // typing indicator reaches the other side, then clears
    await page.getByTestId('chat-input').pressSequentially('Hel', { delay: 40 });
    await expect(buyer.getByTestId('typing-indicator')).toContainText('is typing');

    // message arrives live, with no reload
    await page.getByTestId('chat-input').fill('Hello Bea, ready when you are');
    await page.getByTestId('chat-send').click();
    await expect(buyer.getByTestId('chat-messages')).toContainText('Hello Bea, ready when you are');
    await expect(buyer.getByTestId('typing-indicator')).toHaveText('');
    // buyer's tab marks it read → the seller's own message flips from Sent to Seen
    await expect(page.getByTestId('seen-indicator')).toHaveAttribute('data-seen', 'true');

    // reply with an attachment (real presigned upload) and open it
    await buyer
      .getByTestId('chat-file-input')
      .setInputFiles({ name: 'brief.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect(buyer.getByTestId('pending-attachment')).toContainText('brief.png');
    await buyer.getByTestId('chat-input').fill('Here is the brief');
    await buyer.getByTestId('chat-send').click();
    await expect(page.getByTestId('chat-messages')).toContainText('Here is the brief');
    const attach = page.getByRole('button', { name: 'brief.png' });
    await expect(attach).toBeVisible();
    // Attachments download through a short-lived presigned URL (Content-Disposition: attachment).
    const downloadPromise = page.waitForEvent('download');
    await attach.click();
    const download = await downloadPromise;
    expect(download.url()).toContain('X-Amz-Signature');
    expect(download.suggestedFilename()).toBe('brief.png');
    await shot(page, info, '47-chat');

    // presence flips when the buyer leaves
    await room.buyerCtx.close();
    await expect(page.getByTestId('presence-dot')).toHaveAttribute('data-online', 'false', {
      // Abrupt disconnects are detected by the presence TTL (up to ~45 s, see Phase 4 known issues).
      timeout: 55_000,
    });
  });

  test('notifications: live bell count, inbox, mark read, preferences', async ({ page, browser }, info) => {
    test.setTimeout(90_000);
    const room = await activeRoom({ page, browser }, info, 'notif');
    const { buyer, projectId, milestones } = room;
    await buyer.goto('/dashboard');
    await expect(buyer.getByTestId('bell')).toBeVisible();
    const before = Number(
      (await buyer
        .getByTestId('bell-count')
        .textContent({ timeout: 2000 })
        .catch(() => '0')) ?? 0,
    );

    await apiCall(page, 'POST', `/milestones/${milestones[0]!.id}/start`);
    await apiCall(page, 'POST', `/milestones/${milestones[0]!.id}/submit`, { note: 'ready' });
    // the count rises while the buyer's page stays untouched
    await expect(buyer.getByTestId('bell-count')).toHaveText(String(before + 1), { timeout: 15_000 });

    await buyer.getByTestId('bell').click();
    await expect(buyer.getByTestId('bell-panel')).toContainText('is ready for your review');
    await shot(buyer, info, '48-bell');
    await buyer.getByTestId('bell-item').first().click();
    await expect(buyer).toHaveURL(new RegExp(`/projects/${projectId}`));
    // the opened one is read; only the earlier, still-unread notification remains
    if (before > 0) await expect(buyer.getByTestId('bell-count')).toHaveText(String(before));
    else await expect(buyer.getByTestId('bell-count')).toHaveCount(0);

    await buyer.goto('/notifications');
    await expect(buyer.getByTestId('notification-list')).toContainText('is ready for your review');

    // preferences: mute one type, defaults elsewhere, push explained as unconfigured
    await buyer.goto('/settings/notifications');
    await expect(buyer.getByText('Push is not configured on this server yet')).toBeVisible();
    await buyer.getByLabel('A milestone was submitted for review: in-app').uncheck();
    await buyer.getByRole('button', { name: 'Save preferences' }).click();
    await expect(buyer.getByText('Preferences saved.')).toBeVisible();
    await buyer.reload();
    await expect(buyer.getByLabel('A milestone was submitted for review: in-app')).not.toBeChecked();
    await expect(buyer.getByLabel('A milestone was funded: in-app')).toBeChecked();
    await shot(buyer, info, '49-notification-settings');
    await room.buyerCtx.close();
  });

  test('direct message → custom offer → accepted into a project; outsiders see nothing', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000);
    const baseURL = info.project.use.baseURL;
    await publishedSeller(page, `${info.project.name}-dm-s`);
    const admin = await adminContext(browser, baseURL);
    const svc = await liveService(
      page,
      admin.page,
      `Direct message ${info.project.name} service ${Date.now() % 100000}`,
      50_000,
    );
    await admin.ctx.close();

    const buyerCtx = await browser.newContext({ baseURL });
    const buyer = await buyerCtx.newPage();
    await signUpAndVerify(buyer, uniqueEmail(`${info.project.name}-dm-b`), 'Dana Direct', 'e2e-password-123');
    await buyer.goto(`/services/${svc.slug}`);
    await buyer.getByRole('button', { name: 'Message seller' }).click();
    await expect(buyer).toHaveURL(/\/messages\/[0-9a-f-]{36}$/);
    const conversationUrl = buyer.url();
    await buyer.getByTestId('chat-input').fill('Hi! Could you build something a bit different?');
    await buyer.getByTestId('chat-send').click();

    // the seller gets it live in the same conversation and sends a custom offer
    await page.goto(conversationUrl);
    await expect(page.getByTestId('chat-messages')).toContainText('something a bit different');
    await page.getByRole('button', { name: 'Send a custom offer' }).click();
    await page.getByLabel('Offer title').fill('Tailored booking widget');
    await page
      .getByLabel('What is included')
      .fill('A booking widget tailored to your studio, with calendar sync.');
    await page.getByLabel('Price (USD)').nth(0).fill('200');
    await page.getByLabel('Price (USD)').nth(1).fill('300');
    await shot(page, info, '50-offer-form');
    await page.getByRole('button', { name: 'Send offer' }).click();

    await expect(buyer.getByTestId('offer-card')).toContainText('Tailored booking widget');
    await expect(buyer.getByTestId('offer-card')).toContainText('$500');
    await shot(buyer, info, '51-offer-received');
    await buyer.getByRole('button', { name: 'Accept offer' }).click();
    await expect(buyer).toHaveURL(/\/projects\/[0-9a-f-]{36}$/);
    await expect(buyer.getByTestId('milestone-1')).toContainText('$200');
    await expect(buyer.getByTestId('milestone-2')).toContainText('$300');
    await expect(page.getByTestId('offer-status')).toHaveText('Status: accepted');
    const projectUrl = buyer.url();

    // a third user cannot see the conversation or the project
    const outCtx = await browser.newContext({ baseURL });
    const outsider = await outCtx.newPage();
    await signUpAndVerify(
      outsider,
      uniqueEmail(`${info.project.name}-dm-o`),
      'Olive Outsider',
      'e2e-password-123',
    );
    expect((await outsider.goto(conversationUrl))?.status()).toBe(404);
    expect((await outsider.goto(projectUrl))?.status()).toBe(404);
    await outCtx.close();
    await buyerCtx.close();
  });
});
