import { expect, test } from '@playwright/test';
import {
  activeRoom,
  adminUi,
  apiCall,
  completeRoom,
  PNG_1PX,
  payTestCheckout,
  publishedSeller,
  shot,
} from './helpers';

interface Me {
  id: string;
  displayName: string;
}
interface Profile {
  slug: string;
}

test.describe('Phase 5 trust', () => {
  test('reviews: buyer reviews a completed project, seller replies, profile and search show real ratings', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const room = await activeRoom({ page, browser }, info, 'rev');
    const { buyer, projectId, buyerCtx } = room;
    const slug = (await apiCall<Profile>(page, 'GET', '/me/profile')).slug;
    await completeRoom(page, room);

    await buyer.goto(`/projects/${projectId}`);
    await expect(buyer.getByTestId('project-status')).toHaveText('completed');
    await expect(buyer.getByTestId('review-form')).toBeVisible();
    await buyer.getByLabel('Timeliness').selectOption('4');
    await buyer.getByLabel('Your review').fill('Great collaboration and clear communication.');
    await shot(buyer, info, '60-review-form');
    await buyer.getByRole('button', { name: 'Post review' }).click();
    await expect(buyer.getByText('Thank you. Your review is now public.')).toBeVisible();
    await expect(buyer.getByTestId('project-status')).toHaveText('reviewed');

    // private per-milestone feedback only the seller can see
    await buyer.getByLabel('Feedback on Kickoff & plan').fill('Loved the kickoff workshop');
    await buyer.getByTestId('feedback-card').first().getByRole('button', { name: 'Send' }).click();
    await expect(buyer.getByTestId('feedback-given')).toContainText('Loved the kickoff workshop');

    // anonymous visitor sees the review, rating, completed count and level on the public profile
    const anon = await browser.newContext({ baseURL: info.project.use.baseURL });
    const visitor = await anon.newPage();
    await visitor.goto(`/u/${slug}`);
    await expect(visitor.getByTestId('review')).toContainText('Great collaboration and clear communication.');
    await expect(visitor.getByTestId('review')).toContainText('Bea B.'); // initial only, never the full name or email
    await expect(visitor.getByTestId('completed-count')).toHaveText('1 completed project');
    await expect(visitor.getByTestId('level-badge')).toHaveText('New seller');
    await expect(visitor.getByTestId('reviews-section')).not.toContainText('Loved the kickoff workshop'); // private
    await shot(visitor, info, '61-public-profile-reviews');

    // seller replies once, publicly
    await page.goto(`/u/${slug}`);
    await page.getByLabel('Reply to this review').fill('Thank you Bea, it was a pleasure!');
    await page.getByRole('button', { name: 'Post reply' }).click();
    await expect(page.getByTestId('review-reply')).toContainText('Thank you Bea, it was a pleasure!');
    await expect(page.getByTestId('reply-form')).toHaveCount(0);
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByTestId('feedback-given')).toContainText('Loved the kickoff workshop');

    // search: the rating filter now has real data behind it
    const title = (await apiCall<{ title: string }[]>(page, 'GET', '/me/services'))[0]!.title
      .split(' ')
      .slice(0, 3)
      .join(' ');
    await visitor.goto(`/services?q=${encodeURIComponent(title)}&minRating=4.5`);
    await expect(visitor.getByTestId('service-card').first()).toContainText('5.0');
    await visitor.goto(`/services?q=${encodeURIComponent(title)}&level=level_1`);
    await expect(visitor.getByTestId('no-results')).toBeVisible(); // not enough history for Level 1
    await page.goto('/seller/verification');
    await expect(page.getByTestId('level-gap')).toContainText('more completed project');
    await shot(page, info, '62-seller-trust');
    await visitor.goto('/seller-levels');
    await expect(visitor.getByTestId('level-criteria')).toContainText('Top rated');

    await anon.close();
    await buyerCtx.close();
  });

  test('verifications: request → admin verifies → badge appears; rejection shows the reason', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000);
    const baseURL = info.project.use.baseURL;
    await publishedSeller(page, `${info.project.name}-ver`);
    const me = await apiCall<Me>(page, 'GET', '/me');
    const slug = (await apiCall<Profile>(page, 'GET', '/me/profile')).slug;

    await page.goto('/seller/verification');
    await page
      .getByTestId('verification-form-portfolio')
      .getByLabel('portfolio link')
      .fill('https://portfolio.example.com/work');
    await page
      .getByTestId('verification-form-portfolio')
      .getByRole('button', { name: 'Request verification' })
      .click();
    await expect(page.getByTestId('verification-portfolio').getByTestId('verification-status')).toHaveText(
      'pending',
    );
    await page
      .getByTestId('verification-form-play_store')
      .getByLabel('play_store link')
      .fill('https://play.google.com/store/apps/dev?id=123');
    await page
      .getByTestId('verification-form-play_store')
      .getByRole('button', { name: 'Request verification' })
      .click();
    await expect(page.getByTestId('verification-play_store').getByTestId('verification-status')).toHaveText(
      'pending',
    );

    // a pending request is NOT a badge
    const anon = await browser.newContext({ baseURL });
    const visitor = await anon.newPage();
    await visitor.goto(`/u/${slug}`);
    await expect(visitor.getByTestId('verified-badges')).toHaveCount(0);

    const admin = await adminUi(browser, baseURL);
    await admin.page.goto('/admin/verifications');
    const mine = admin.page.getByTestId('verification-queue').locator('li', { hasText: me.displayName });
    await expect(mine).toHaveCount(2);
    await shot(admin.page, info, '63-admin-verifications');
    await mine
      .filter({ hasText: 'Portfolio reviewed' })
      .getByRole('button', { name: 'Verify Portfolio reviewed' })
      .click();
    await mine
      .filter({ hasText: 'Play Store' })
      .getByLabel(/Note for/)
      .fill('Link does not belong to this seller');
    await mine
      .filter({ hasText: 'Play Store' })
      .getByRole('button', { name: /Reject/ })
      .click();
    await expect(mine).toHaveCount(0);

    await visitor.goto(`/u/${slug}`);
    await expect(visitor.getByTestId('verified-badges')).toContainText('Portfolio reviewed');
    await expect(visitor.getByTestId('verified-badges')).not.toContainText('Play Store');
    await shot(visitor, info, '64-verified-badge');
    await page.goto('/seller/verification');
    await expect(page.getByTestId('verification-play_store')).toContainText(
      'Link does not belong to this seller',
    );
    await expect(page.getByTestId('verification-portfolio').getByTestId('verification-status')).toHaveText(
      'verified',
    );

    // verified-only search
    await admin.ctx.close();
    await anon.close();
  });

  test('change request: proposed, accepted by the other party, adds a milestone that must be funded', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(90_000);
    const room = await activeRoom({ page, browser }, info, 'chg');
    const { buyer, projectId, buyerCtx } = room;
    await apiCall(page, 'POST', `/milestones/${room.milestones[0]!.id}/start`);

    await buyer.goto(`/projects/${projectId}?tab=changes`);
    await buyer.getByLabel('Change title').fill('Add an admin panel');
    await buyer
      .getByLabel('Change description')
      .fill('We would also like a small admin panel for our staff.');
    await buyer.getByLabel('New milestone 1 title').fill('Admin panel');
    await buyer.getByLabel('New milestone 1 price (USD)').fill('150');
    await buyer.getByRole('button', { name: 'Send proposal' }).click();
    await expect(buyer.getByTestId('change-request')).toContainText('+$150');
    await expect(buyer.getByTestId('change-status')).toHaveText('proposed');
    await expect(buyer.getByRole('button', { name: 'Accept change' })).toHaveCount(0); // not your own proposal

    await page.goto(`/projects/${projectId}?tab=changes`);
    await shot(page, info, '65-change-request');
    await page.getByRole('button', { name: 'Accept change' }).click();
    await expect(page.getByTestId('change-status')).toHaveText('accepted');

    await buyer.goto(`/projects/${projectId}`);
    await expect(buyer.getByTestId('milestone-4')).toContainText('Admin panel');
    await expect(buyer.getByTestId('milestone-4')).toContainText('$150');
    await buyer.getByTestId('milestone-4').getByRole('button', { name: 'Fund milestone' }).click();
    await payTestCheckout(buyer);
    await expect(buyer.getByTestId('milestone-4').getByTestId('milestone-status')).toContainText('Funded');
    await buyerCtx.close();
  });

  test('dispute: opened in the room, evidence from both sides, admin splits the funds', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const baseURL = info.project.use.baseURL;
    const room = await activeRoom({ page, browser }, info, 'dsp');
    const { buyer, projectId, buyerCtx } = room;
    const m1 = room.milestones[0]!.id;
    await apiCall(page, 'POST', `/milestones/${m1}/start`);
    await apiCall(page, 'POST', `/milestones/${m1}/submit`, { note: 'Done as agreed' });
    const code = (await apiCall<{ code: string }>(buyer, 'GET', `/projects/${projectId}`)).code;

    await buyer.goto(`/projects/${projectId}`);
    await buyer.getByTestId('milestone-1').getByRole('button', { name: 'Open a dispute' }).click();
    await buyer
      .getByLabel(/Describe the problem/)
      .fill('The delivered work does not match the agreed acceptance criteria at all.');
    await buyer.getByRole('button', { name: 'Open dispute' }).click();
    await expect(buyer).toHaveURL(/tab=disputes/);
    await expect(buyer.getByTestId('dispute-status')).toHaveText('open');
    await expect(buyer.getByTestId('dispute-banner')).toBeVisible();
    await buyer.getByLabel('Evidence note').fill('Here is the broken checkout page');
    await buyer
      .getByTestId('evidence-file')
      .setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: PNG_1PX });
    await buyer.getByRole('button', { name: 'Add evidence' }).click();
    await expect(buyer.getByTestId('evidence-list')).toContainText('broken.png');
    await shot(buyer, info, '66-dispute-buyer');

    await page.goto(`/projects/${projectId}?tab=disputes`);
    await expect(page.getByTestId('evidence-list')).toContainText('broken.png'); // the other party sees the evidence
    await page.getByLabel('Evidence note').fill('Everything on the criteria list was delivered');
    await page.getByRole('button', { name: 'Add evidence' }).click();
    await expect(page.getByTestId('evidence-list')).toContainText('Everything on the criteria list');
    // frozen: the buyer can no longer approve, the milestone shows disputed
    await buyer.goto(`/projects/${projectId}`);
    await expect(buyer.getByTestId('milestone-1').getByTestId('milestone-status')).toHaveText('Disputed');
    await expect(buyer.getByRole('button', { name: 'Approve & release payment' })).toHaveCount(0);

    // admin reviews the auto-built case file and splits
    const admin = await adminUi(browser, baseURL);
    await admin.page.goto('/admin/disputes');
    await admin.page
      .getByTestId('dispute-queue')
      .getByRole('link', { name: new RegExp(code) })
      .first()
      .click();
    await expect(admin.page.getByTestId('case-evidence')).toContainText('Here is the broken checkout page');
    await expect(admin.page.getByTestId('case-evidence')).toContainText('Everything on the criteria list');
    await expect(admin.page.getByTestId('case-timeline')).toContainText('milestone.submitted');
    await shot(admin.page, info, '67-admin-case-file');
    await admin.page.getByLabel(/^Split/).check();
    await admin.page.getByLabel(/Refund to buyer/).fill('100');
    await admin.page
      .getByLabel('Resolution note')
      .fill('Part of the scope was missing; splitting the milestone.');
    await admin.page.getByRole('button', { name: 'Resolve dispute' }).click();
    await expect(admin.page.getByText('Resolved: split')).toBeVisible();

    await buyer.goto(`/projects/${projectId}?tab=disputes`);
    await expect(buyer.getByTestId('dispute-status')).toHaveText('resolved');
    await expect(buyer.getByTestId('dispute')).toContainText('$100 returned to the buyer');
    await buyer.goto(`/projects/${projectId}`);
    await expect(buyer.getByTestId('project-status')).toHaveText('active');
    await expect(buyer.getByTestId('milestone-1').getByTestId('milestone-status')).toHaveText(
      'Paid to seller',
    );
    await admin.page.goto('/admin/payments');
    await expect(
      admin.page.getByTestId('ledger').locator('div', { hasText: 'Trial balance' }).locator('dd'),
    ).toHaveText('$0');
    await admin.ctx.close();
    await buyerCtx.close();
  });

  test('chat safety warning, report, admin ban: banned seller is signed out and delisted', async ({
    page,
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const baseURL = info.project.use.baseURL;
    const room = await activeRoom({ page, browser }, info, 'saf');
    const { buyer, buyerCtx, svc } = room;
    const sellerId = (await apiCall<Me>(page, 'GET', '/me')).id;
    const title = svc.slug.split('-').slice(0, 3).join(' ');

    await buyer.goto(`/services/${svc.slug}`);
    await buyer.getByRole('button', { name: 'Message seller' }).click();
    await expect(buyer).toHaveURL(/\/messages\//);
    const url = buyer.url();
    await buyer.getByTestId('chat-input').fill('Hello, is this still available?');
    await buyer.getByTestId('chat-send').click();
    await page.goto(url);
    await expect(page.getByTestId('chat-messages')).toContainText('still available');
    await page
      .getByTestId('chat-input')
      .fill('Yes! Email me at sam@gmail.com and pay via PayPal to skip the fees.');
    await page.getByTestId('chat-send').click();

    // not blocked, but both sides get the warning
    await expect(page.getByTestId('safety-warning')).toContainText(
      'keep payments and conversations on the platform',
    );
    await expect(buyer.getByTestId('safety-warning')).toBeVisible();
    await shot(buyer, info, '68-safety-warning');

    // the buyer reports the message
    await buyer.getByTestId('chat-messages').getByRole('button', { name: 'Report' }).click();
    await buyer.getByLabel('Reason').selectOption('Off-platform payment request');
    await buyer.getByRole('button', { name: 'Send report' }).click();
    await expect(buyer.getByText('Thanks. Our team will review your report.')).toBeVisible();

    // admin sees it with context and bans the seller
    const admin = await adminUi(browser, baseURL);
    await admin.page.goto('/admin/reports');
    const item = admin.page.getByTestId('report-queue').locator('li', { hasText: 'sam@gmail.com' }).first();
    await expect(item).toContainText('Off-platform payment request');
    await shot(admin.page, info, '69-admin-report');
    await item.getByLabel(/Note for report/).fill('Repeated off-platform payment solicitation.');
    await item.getByRole('button', { name: 'Ban user' }).click();
    await expect(
      admin.page.getByTestId('report-queue').locator('li', { hasText: 'sam@gmail.com' }),
    ).toHaveCount(0);

    // the banned seller is signed out immediately and the listing is gone
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    const anon = await browser.newContext({ baseURL });
    const visitor = await anon.newPage();
    await visitor.goto(`/services?q=${encodeURIComponent(title)}`);
    await expect(visitor.getByTestId('service-card').filter({ hasText: svc.slug })).toHaveCount(0);
    expect((await visitor.goto(`/services/${svc.slug}`))?.status()).toBe(404);

    // cleanup: unban so the shared dev database isn't polluted with a banned account
    await apiCall(admin.page, 'POST', `/admin/users/${sellerId}/unban`, { reason: 'e2e cleanup after test' });
    await admin.ctx.close();
    await anon.close();
    await buyerCtx.close();
  });
});
