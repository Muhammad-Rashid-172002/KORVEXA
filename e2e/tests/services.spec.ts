import { expect, test, type Browser } from '@playwright/test';
import {
  API_URL,
  PNG_1PX,
  publishedSeller,
  SEED_PASSWORD,
  shot,
  signUpAndVerify,
  uniqueEmail,
} from './helpers';

const word = () =>
  `zephyr${Math.random()
    .toString(36)
    .replace(/[^a-z]/g, '')
    .slice(0, 8)}`;

async function adminPage(browser: Browser, baseURL: string | undefined) {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@dev.glasswork.test');
  await page.getByLabel('Password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return { ctx, page };
}

test.describe('Phase 2 services & discovery', () => {
  test('seller lists a service → admin approves → visitor finds it → buyer favorites and saves a search', async ({
    page,
    browser,
  }, info) => {
    const unique = word();
    const title = `I will build your ${unique} React dashboard`;
    const baseURL = info.project.use.baseURL;

    // 1. Seller creates a draft with a gallery image
    await publishedSeller(page, `${info.project.name}-svc`);
    await page.goto('/sell/services/new');
    // Step 1: overview
    await page.getByLabel('Gig title').fill(title);
    await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Web development' });
    await page.getByLabel('More specific').selectOption({ label: 'Web applications' });
    await page.getByLabel('Search tags').fill('dashboard');
    await page.getByLabel('Search tags').press('Enter');
    await page.getByTestId('wizard-next').click();
    // Step 2: pricing (one package + one extra)
    await page.getByLabel('I only want to offer one package').check();
    await page.getByLabel('Name').fill('Starter dashboard');
    await page.getByLabel('What is included').fill('Up to five screens, auth and charts.');
    await page.getByLabel('Price (USD)').fill('450');
    await page.getByLabel('Delivery (days)').fill('10');
    await page.getByRole('button', { name: 'Add an extra' }).click();
    await page.getByLabel('Extra', { exact: true }).fill('Source handover');
    await page.getByLabel('Price (USD)').nth(1).fill('50');
    await page.getByTestId('wizard-next').click();
    // Step 3: description and FAQ
    await page
      .getByLabel('Your description')
      .fill(
        `A complete ${unique} dashboard with charts, auth and an API, delivered in clear milestones with tests.`,
      );
    await page.getByRole('button', { name: 'Add a question' }).click();
    await page.getByLabel('Question', { exact: true }).fill('Do you sign NDAs?');
    await page.getByLabel('Answer').fill('Yes, on request.');
    await page.getByTestId('wizard-next').click();
    // Step 4: requirements (skip), Step 5: gallery with cropping
    await page.getByTestId('wizard-next').click();
    await page
      .getByTestId('gallery-input')
      .setInputFiles({ name: 'shot.png', mimeType: 'image/png', buffer: PNG_1PX });
    await page.getByTestId('crop-confirm').click();
    await expect(page.getByTestId('image-count')).toContainText('1 of 6 images');
    await shot(page, info, '20-service-form');
    await page.getByTestId('wizard-next').click();
    // Step 6: publish → save as a draft first
    await expect(page.getByTestId('quality-score')).toBeVisible();
    await page.getByRole('button', { name: 'Save as draft' }).click();

    await expect(page).toHaveURL(/\/sell\/services$/);
    const row = page.getByTestId('my-services').locator('li', { hasText: title });
    await expect(row.getByTestId('service-status')).toHaveText('draft');

    // 2. Drafts are not public
    const anon = await browser.newContext({ baseURL });
    const visitor = await anon.newPage();
    await visitor.goto(`/services?q=${unique}`);
    await expect(visitor.getByTestId('no-results')).toBeVisible();

    // 3. Submit for review
    await row.getByRole('button', { name: 'Submit for review' }).click();
    await expect(row.getByTestId('service-status')).toHaveText('pending review');

    // 4. Admin approves from the moderation queue
    const admin = await adminPage(browser, baseURL);
    await admin.page.goto('/admin/services');
    await expect(admin.page.getByTestId('moderation-queue')).toContainText(title);
    await shot(admin.page, info, '21-moderation');
    await admin.page.getByRole('button', { name: `Approve ${title}` }).click();
    await expect(admin.page.getByTestId('moderation-queue').getByText(title)).toHaveCount(0);
    await admin.ctx.close();

    // 5. Visitor finds it by keyword and filters; opens the detail page with structured data
    await visitor.goto(`/services?q=${unique}`);
    const card = visitor.getByTestId('service-card').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Starting at $450');
    await visitor.goto(`/services?q=${unique}&maxPrice=100`);
    await expect(visitor.getByTestId('no-results')).toBeVisible();
    await visitor.goto(`/services?q=${unique}&category=web-development&maxPrice=500&maxDelivery=14`);
    await card.getByRole('link').first().click();
    await expect(visitor.getByRole('heading', { name: title })).toBeVisible();
    await expect(visitor.getByTestId('package-basic')).toContainText('$450');
    await expect(visitor.getByText('Do you sign NDAs?')).toBeVisible();
    const ld = JSON.parse(
      (await visitor.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
    );
    expect(ld['@type']).toBe('Service');
    expect(ld.name).toBe(title);
    expect(ld.offers[0].price).toBe('450.00');
    const slug = new URL(visitor.url()).pathname.split('/').pop()!;
    await shot(visitor, info, '22-service-detail');

    // 6. Sitemap lists the public page
    const sitemap = await visitor.request.get('/sitemap.xml');
    expect(await sitemap.text()).toContain(`/services/${slug}`);

    // 7. Buyer favorites it and saves a search
    const buyerCtx = await browser.newContext({ baseURL });
    const buyer = await buyerCtx.newPage();
    await signUpAndVerify(buyer, uniqueEmail(`${info.project.name}-buyer`), 'Buyer Bee', 'e2e-password-123');
    await buyer.goto(`/services?q=${unique}`);
    const fav = buyer.getByRole('button', { name: `Save ${title} to favorites` });
    await fav.click();
    await expect(buyer.getByRole('button', { name: `Remove ${title} from favorites` })).toBeVisible();
    await buyer.getByRole('button', { name: 'Save this search' }).click();
    await buyer.getByLabel('Saved search name').fill('My zephyr search');
    await buyer.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(buyer.getByText('Search saved.')).toBeVisible();

    await buyer.goto('/favorites');
    await expect(buyer.getByTestId('favorites-grid')).toContainText(title);
    await expect(buyer.getByTestId('saved-searches')).toContainText('My zephyr search');
    await shot(buyer, info, '23-favorites');
    await buyer.getByRole('button', { name: 'Remove ' + title + ' from favorites' }).click();
    await buyer.reload();
    await expect(buyer.getByTestId('favorites-grid')).toHaveCount(0);
    await buyer.getByRole('button', { name: 'Delete saved search My zephyr search' }).click();
    await expect(buyer.getByTestId('saved-searches')).toHaveCount(0);

    // 8. Seller pauses → disappears from public search
    await page.goto('/sell/services');
    const liveRow = page.getByTestId('my-services').locator('li', { hasText: title });
    await expect(liveRow.getByTestId('service-status')).toHaveText('live');
    await liveRow.getByRole('button', { name: 'Pause' }).click();
    await expect(liveRow.getByTestId('service-status')).toHaveText('paused');
    await visitor.goto(`/services?q=${unique}`);
    await expect(visitor.getByTestId('no-results')).toBeVisible();

    await anon.close();
    await buyerCtx.close();
  });

  test('admin pages are hidden from non-admins', async ({ page }, info) => {
    await signUpAndVerify(page, uniqueEmail(`${info.project.name}-na`), 'Nobody', 'e2e-password-123');
    const res = await page.goto('/admin/services');
    expect(res?.status()).toBe(404);
    const apiRes = await page.request.get(`${API_URL}/v1/admin/services`);
    expect(apiRes.status()).toBe(403);
  });
});
