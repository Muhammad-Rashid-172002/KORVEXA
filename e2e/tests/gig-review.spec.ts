import { expect, test } from '@playwright/test';
import { PNG_1PX, adminUi, apiCall, publishedSeller, shot } from './helpers';

/**
 * The exact journey that broke for a real user: a seller builds a gig in the wizard, submits it, previews it, and
 * an admin finds it in the moderation queue (and is told about it). Guards against: the submit not reaching
 * "pending review", duplicate drafts from autosave, no way to preview a gig that is not live, and the admin not
 * seeing it.
 */
test('seller creates a gig in the wizard → submits → previews → admin sees, is notified and approves', async ({
  page,
  browser,
}, info) => {
  const baseURL = info.project.use.baseURL;
  const unique = `zq${Math.random()
    .toString(36)
    .replace(/[^a-z]/g, '')
    .slice(0, 7)}`;
  const title = `I will build your ${unique} business website`;
  await publishedSeller(page, `${info.project.name}-review`);

  // ---- seller: the whole wizard ----
  await page.goto('/sell/services/new');
  await page.getByLabel('Gig title').fill(title);
  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Web development' });
  await page.getByTestId('wizard-next').click();
  await page.getByLabel('I only want to offer one package').check();
  await page.getByLabel('Name').fill('Starter site');
  await page.getByLabel('What is included').fill('One page website with a contact form.');
  await page.getByLabel('Price (USD)').fill('150');
  await page.getByLabel('Delivery (days)').fill('5');
  await page.getByTestId('wizard-next').click();
  await page
    .getByLabel('Your description')
    .fill(
      `A clean, fast ${unique} website for your business with a contact form and basic SEO, built in clear steps.`,
    );
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('wizard-next').click(); // requirements
  await page
    .getByTestId('gallery-input')
    .setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: PNG_1PX });
  await page.getByTestId('crop-confirm').click();
  await expect(page.getByTestId('image-count')).toContainText('1 of 6');
  await page.getByTestId('wizard-next').click();
  await page.getByTestId('submit-gig').click();

  // ---- seller: a clear "Submitted for review" state, and a preview ----
  await expect(page).toHaveURL(/\/sell\/services\?submitted=[0-9a-f-]{36}/);
  await expect(page.getByTestId('submitted-banner')).toContainText('Submitted for review');
  const mine = page.getByTestId('my-services').locator('li', { hasText: title });
  await expect(mine).toHaveCount(1); // exactly one copy: autosave must not create a duplicate
  await expect(mine.getByTestId('service-status')).toHaveText('pending review');
  await shot(page, info, '80-submitted');
  await mine.getByRole('link', { name: 'Preview' }).click();
  await expect(page).toHaveURL(/\/sell\/services\/[0-9a-f-]{36}\/preview/);
  await expect(page.getByTestId('preview-banner')).toContainText('Submitted for review');
  await expect(page.getByTestId('preview-status')).toHaveText('pending review');
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page.getByTestId('preview-package-basic')).toContainText('$150');
  await shot(page, info, '81-seller-preview');
  const serviceId = new URL(page.url()).pathname.split('/')[3]!;

  // the database agrees
  const row = await apiCall<{ status: string }>(page, 'GET', `/me/services/${serviceId}`);
  expect(row.status).toBe('pending_review');

  // ---- admin: overview card, queue, notification, review page, approval ----
  const admin = await adminUi(browser, baseURL);
  const a = admin.page;
  await a.goto('/admin');
  const card = a.getByRole('link', { name: /Gigs waiting for review/ });
  await expect(card).toBeVisible();
  await expect(card).toContainText(/[1-9]/);
  await shot(a, info, '82-admin-overview');
  await card.click();
  await expect(a).toHaveURL(/\/admin\/services$/);
  await expect(a.getByTestId('moderation-queue')).toContainText(title);

  const notes = await apiCall<{ items: { type: string; body: string | null }[] }>(
    a,
    'GET',
    '/me/notifications',
  );
  expect(notes.items.some((n) => n.type === 'service.submitted' && (n.body ?? '').includes(title))).toBe(
    true,
  );

  await a
    .getByTestId('moderation-queue')
    .locator('li', { hasText: title })
    .getByRole('link', { name: 'View the full gig' })
    .click();
  await expect(a).toHaveURL(new RegExp(`/admin/services/${serviceId}`));
  await expect(a.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await shot(a, info, '83-admin-review');
  await a.getByRole('button', { name: `Approve ${title}` }).click();

  // ---- seller: now live, public page works ----
  await page.goto('/sell/services');
  await expect(
    page.getByTestId('my-services').locator('li', { hasText: title }).getByTestId('service-status'),
  ).toHaveText('live');
  await admin.ctx.close();
});
