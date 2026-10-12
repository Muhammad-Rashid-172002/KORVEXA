import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { activeRoom, API_URL, shot } from './helpers';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET ?? 'dev-only-github-webhook-secret';

/** `YYYY-MM-DDTHH:mm` in the machine's local time, which is what a datetime-local input expects. */
const localInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

test.describe('Phase 7 meetings and code activity', () => {
  test('schedule a meeting, record only with everyone’s consent, join, calendar invite', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const room = await activeRoom({ page, browser }, info, 'mtg7');
    const { buyer, buyerCtx, projectId } = room;

    await buyer.goto(`/projects/${projectId}?tab=meetings`);
    await buyer.getByLabel('Meeting title').fill('Kickoff call');
    await buyer.getByLabel('Meeting start').fill(localInput(new Date(Date.now() + 5 * 60_000)));
    await buyer.getByLabel('Meeting agenda').fill('Walk through the milestones');
    await buyer.getByText('Ask everyone for consent to record this meeting').click();
    await buyer.getByRole('button', { name: 'Schedule meeting' }).click();
    const mine = buyer.getByTestId('upcoming-meetings').getByTestId('meeting').first();
    await expect(mine).toContainText('Kickoff call');
    await expect(mine.getByTestId('meeting-status')).toHaveText('scheduled');
    await expect(mine.getByTestId('recording-state')).toContainText('will NOT be recorded'); // seller has not answered yet

    // the seller sees it live, and the notification
    await page.goto(`/projects/${projectId}?tab=meetings`);
    const theirs = page.getByTestId('upcoming-meetings').getByTestId('meeting').first();
    await expect(theirs).toContainText('Kickoff call');
    await expect(theirs).toContainText('Walk through the milestones');
    await shot(page, info, '80-meeting-seller');
    await theirs.getByRole('button', { name: 'I do not agree' }).click();
    await expect(theirs.getByTestId('recording-state')).toContainText('will NOT be recorded');
    await theirs.getByRole('button', { name: 'I agree to recording' }).click();
    await expect(theirs.getByTestId('recording-state')).toContainText('will be recorded');
    // the buyer's open page updates without a reload
    await expect(mine.getByTestId('recording-state')).toContainText('Everyone agreed');
    await shot(buyer, info, '81-meeting-consent');

    // calendar invite
    const href = await theirs.getByRole('link', { name: 'Add to calendar' }).getAttribute('href');
    const ics = await page.request.get(href!);
    expect(ics.status()).toBe(200);
    expect(ics.headers()['content-type']).toContain('text/calendar');
    expect((await ics.text()).replace(/\r\n /g, '')).toContain('SUMMARY:Kickoff call');

    // joining opens the call page (no real video vendor in dev)
    await theirs.getByRole('button', { name: 'Join meeting' }).click();
    await expect(page).toHaveURL(/\/meetings\/[0-9a-f-]{36}\/call/);
    await expect(page.getByTestId('call-panel')).toContainText('Kickoff call');
    await page.getByRole('button', { name: 'Join now' }).click();
    await expect(page.getByTestId('stub-call')).toContainText('Everyone agreed to recording');
    await shot(page, info, '82-call-page');

    // organizer cancels → no longer joinable
    await buyer.reload();
    await buyer.getByRole('button', { name: 'Cancel meeting' }).click();
    await expect(buyer.getByTestId('upcoming-meetings')).toContainText('Nothing scheduled.');
    await buyerCtx.close();
  });

  test('GitHub activity appears in plain language, live, once per delivery', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const room = await activeRoom({ page, browser }, info, 'code7');
    const { buyer, buyerCtx, projectId } = room;
    const repo = `acme-${Date.now() % 1_000_000}/shop-site`;

    await buyer.goto(`/projects/${projectId}?tab=code`);
    await expect(buyer.getByText('No code activity yet.')).toBeVisible();
    await expect(buyer.getByRole('button', { name: 'Connect repository' })).toHaveCount(0); // seller only

    await page.goto(`/projects/${projectId}?tab=code`);
    await page.getByLabel('GitHub repository').fill('not a repo');
    await page.getByRole('button', { name: 'Connect repository' }).click();
    await page.getByLabel('GitHub repository').fill(repo);
    await page.getByRole('button', { name: 'Connect repository' }).click();
    await expect(page.getByTestId('code-links')).toContainText(repo);

    const send = async (event: string, payload: unknown, delivery: string, secret = WEBHOOK_SECRET) => {
      const body = JSON.stringify(payload);
      return page.request.post(`${API_URL}/v1/webhooks/github`, {
        data: body,
        headers: {
          'content-type': 'application/json',
          'x-github-event': event,
          'x-github-delivery': delivery,
          'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
        },
      });
    };
    const id = `e2e-${Date.now()}`;
    const push = {
      ref: 'refs/heads/main',
      pusher: { name: 'sam' },
      repository: { full_name: repo },
      commits: [{ message: 'Add login page' }, { message: 'Fix the footer' }],
    };
    expect((await send('push', push, `${id}-a`, 'wrong-secret')).status()).toBe(401);
    expect((await send('push', push, `${id}-a`)).status()).toBe(200);
    await send('push', push, `${id}-a`); // redelivery
    await send(
      'pull_request',
      {
        action: 'closed',
        repository: { full_name: repo },
        pull_request: {
          title: 'Checkout flow',
          merged: true,
          changed_files: 3,
          merged_at: new Date().toISOString(),
          user: { login: 'sam' },
        },
      },
      `${id}-b`,
    );
    await send(
      'deployment_status',
      {
        repository: { full_name: repo },
        deployment: { environment: 'production' },
        deployment_status: {
          state: 'success',
          environment_url: 'https://shop.example.com',
          created_at: new Date().toISOString(),
        },
      },
      `${id}-c`,
    );

    // the buyer never reloads: events arrive live
    const feed = buyer.getByTestId('code-feed');
    await expect(feed.getByTestId('code-event')).toHaveCount(3);
    await expect(feed).toContainText('sam saved 2 changes to main');
    await expect(feed).toContainText('Merged into the main code: Checkout flow');
    await expect(feed).toContainText('3 files changed');
    await expect(feed).toContainText('Deployed to the live site');
    await shot(buyer, info, '83-code-activity');
    await buyerCtx.close();
  });
});
