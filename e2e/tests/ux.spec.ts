import { expect, test } from '@playwright/test';
import {
  PNG_1PX,
  activeRoom,
  apiCall,
  payTestCheckout,
  publishedSeller,
  shot,
  signUpAndVerify,
  uniqueEmail,
} from './helpers';

/** First-time-user journeys. Product tours are ON here (other specs skip them via navigator.webdriver). */
const SHOW_TOUR = {
  name: 'gw-show-tour',
  value: '1',
  domain: 'localhost',
  path: '/',
  expires: -1,
  httpOnly: false,
  secure: false,
  sameSite: 'Lax' as const,
};
test.use({ storageState: { cookies: [SHOW_TOUR], origins: [] } });

test.describe('UX: first-time visitor', () => {
  test('understands the home page in seconds and reaches a gig in 3 clicks', async ({ page }, info) => {
    await page.goto('/');
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('Hire verified experts');
    await expect(h1).toContainText('progress live');
    await expect(page.getByRole('link', { name: 'Find an expert' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start selling' }).first()).toBeVisible();
    await expect(page.getByTestId('live-demo')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Describe your project' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pick a verified expert' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /pay step by step/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /not a regular freelance site/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Websites & web apps' })).toBeVisible();
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const jargon of ['escrow', 'ledger', 'webhook'])
      expect(text, `home page should not say "${jargon}"`).not.toContain(jargon);
    await shot(page, info, '60-home');

    // click 1: Find an expert → click 2: a gig card → the gig page
    await page.getByRole('link', { name: 'Find an expert' }).first().click();
    await expect(page).toHaveURL(/\/services/);
    const card = page.getByTestId('service-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('svg[data-autogen], img').first()).toBeVisible(); // never an empty cover
    await shot(page, info, '61-browse');
    await card.getByRole('link').first().click();
    await expect(page).toHaveURL(/\/services\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await shot(page, info, '62-gig-page');
  });

  test('a category card leads to a gig in 2 clicks', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Websites & web apps/ }).click();
    await expect(page).toHaveURL(/category=web-development/);
    await page.getByTestId('service-card').first().getByRole('link').first().click();
    await expect(page).toHaveURL(/\/services\/[^/]+$/);
  });
});

test.describe('UX: new seller', () => {
  test('welcome step → guided checklist → publishes a complete gig with the wizard', async ({
    page,
  }, info) => {
    await signUpAndVerify(
      page,
      uniqueEmail(`${info.project.name}-ux-seller`),
      'Sana Seller',
      'e2e-password-123',
    );
    await page.goto('/welcome');
    await shot(page, info, '63-welcome');
    await page.getByTestId('welcome-sell').click();
    await expect(page).toHaveURL(/\/seller\/onboarding/);

    // finish the profile through the API, then the dashboard shows the guided checklist and tour
    await apiCall(page, 'PATCH', '/me/profile', {
      headline: 'Flutter developer',
      bio: 'I build apps for small businesses.',
      country: 'PK',
    });
    await apiCall(page, 'PUT', '/me/seller/skills', { skills: ['Flutter'] });
    await apiCall(page, 'PATCH', '/me/seller', { hourlyRateAmount: 2500 });
    await apiCall(page, 'POST', '/me/seller/onboarding/complete');
    await page.goto('/dashboard');
    await expect(page.getByTestId('product-tour')).toBeVisible();
    await shot(page, info, '64-seller-tour');
    await page.getByRole('button', { name: 'Skip tour' }).click();
    await expect(page.getByTestId('getting-started')).toContainText('Create your first service');
    await shot(page, info, '65-seller-dashboard');

    await page.goto('/sell/services');
    await expect(page.getByText('Create your first service').first()).toBeVisible();
    await page.getByRole('link', { name: 'Create a service' }).first().click();
    await expect(page).toHaveURL(/\/sell\/services\/new/);
    await shot(page, info, '66-wizard-1-overview');

    // 1 overview + AI title helper
    await page.getByLabel('Gig title').fill('flutter app for my shop');
    await page.getByTestId('ai-title').click();
    await expect(page.getByTestId('ai-suggestion')).toContainText('I will');
    await page.getByRole('button', { name: 'Use this' }).click();
    await expect(page.getByLabel('Gig title')).toHaveValue(/^I will/);
    await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Mobile apps' });
    await page.getByLabel('More specific').selectOption({ label: 'Cross-platform (Flutter, React Native)' });
    await expect(page.getByTestId('gig-preview').first()).toContainText('I will');
    // validation in plain words
    await page.getByLabel('Gig title').fill('short');
    await page.getByTestId('wizard-next').click();
    await expect(page.locator('#title-err')).toContainText('at least 10 characters');
    await page.getByLabel('Gig title').fill('I will build a Flutter app for your small business');
    await page.getByTestId('wizard-next').click();

    // 2 pricing + AI packages
    await shot(page, info, '67-wizard-2-pricing');
    await page.getByTestId('ai-packages').click();
    await page.getByRole('button', { name: 'Use this' }).click();
    await expect(page.getByLabel('Price (USD)').first()).not.toHaveValue('');
    await expect(page.getByTestId('save-state')).toBeVisible();
    await page.getByTestId('wizard-next').click();

    // 3 description + FAQ via AI
    await page.getByRole('button', { name: 'Use the guided template' }).click();
    await page
      .getByLabel('Your description')
      .fill(
        'What you get: a working Flutter app for Android and iPhone. How it works: we agree the screens, I build in steps and you check each step. Why me: I have built apps for small shops for years.',
      );
    await page.getByTestId('ai-faqs').click();
    await page.getByRole('button', { name: 'Use this' }).click();
    await shot(page, info, '68-wizard-3-description');
    await page.getByTestId('wizard-next').click();

    // 4 requirements: ready-made questions
    await page.getByRole('button', { name: /Describe what the app should do/ }).click();
    await shot(page, info, '69-wizard-4-requirements');
    await page.getByTestId('wizard-next').click();

    // 5 gallery
    await page
      .getByTestId('gallery-input')
      .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG_1PX });
    await shot(page, info, '70-wizard-5-crop');
    await page.getByTestId('crop-confirm').click();
    await expect(page.getByTestId('image-count')).toContainText('1 of 6');
    await shot(page, info, '71-wizard-5-gallery');
    await page.getByTestId('wizard-next').click();

    // 6 publish
    await expect(page.getByTestId('quality-score')).toHaveText(/^(8|9|10)\d?0?$/);
    await shot(page, info, '72-wizard-6-publish');
    await page.getByTestId('submit-gig').click();
    await expect(page).toHaveURL(/\/sell\/services\?submitted=/);
    await expect(page.getByText('Thank you!')).toBeVisible();
    const row = page.getByTestId('my-services').locator('li').first();
    await expect(row.getByTestId('service-status')).toHaveText('pending review');
    await expect(row.locator('img')).toBeVisible(); // the uploaded cover, not an auto-generated one
    await shot(page, info, '73-my-services');
  });

  test('a gig without an image gets a branded auto-generated cover and says so', async ({ page }, info) => {
    await publishedSeller(page, `${info.project.name}-ux-nocover`);
    const cats = await apiCall<{ id: string; slug: string }[]>(page, 'GET', '/categories');
    const web = cats.find((c) => c.slug === 'web-development')!;
    await apiCall(page, 'POST', '/me/services', {
      categoryId: web.id,
      title: 'I will build your business website fast',
      description:
        'A clean, fast website for your business with a contact form and basic SEO included for you.',
      packages: [
        {
          tier: 'basic',
          title: 'Starter',
          description: 'One page website with contact form',
          priceAmount: 15000,
          deliveryDays: 5,
          revisions: 1,
        },
      ],
    });
    await page.goto('/sell/services');
    await expect(page.getByTestId('autogen-note')).toContainText('Auto-generated cover');
    await expect(page.locator('svg[data-autogen="true"]').first()).toBeVisible();
  });
});

test.describe('UX: new buyer', () => {
  test('welcome step, getting-started checklist, then an order they understand', async ({
    page,
    browser,
  }, info) => {
    await signUpAndVerify(
      page,
      uniqueEmail(`${info.project.name}-ux-buyer`),
      'Bea Buyer',
      'e2e-password-123',
    );
    await page.goto('/welcome');
    await page.getByTestId('welcome-hire').click();
    await expect(page).toHaveURL(/\/services/);
    await page.goto('/dashboard');
    await expect(page.getByTestId('product-tour')).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(page.getByTestId('product-tour')).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId('product-tour')).toHaveCount(0); // shown once only
    await expect(page.getByTestId('getting-started')).toContainText('Describe your project');
    await expect(page.getByText('No active projects yet')).toBeVisible();
    await shot(page, info, '74-buyer-dashboard');
    await page.getByTestId('mode-switch').click();
    await expect(page.getByTestId('mode-switch')).toHaveAccessibleName(/Switch to buying/);
    await page.getByTestId('mode-switch').click();
    await expect(page.getByTestId('mode-switch')).toHaveAccessibleName(/Switch to selling/);

    // order on an existing live service and read the room
    const room = await activeRoom(
      { page: await browser.newPage({ baseURL: info.project.use.baseURL }), browser },
      info,
      'ux',
    );
    const b = room.buyer;
    await b.context().addCookies([SHOW_TOUR]);
    await b.goto(`/services/${room.svc.slug}`);
    await expect(b.getByTestId('what-next')).toContainText('What happens next');
    await shot(b, info, '75-order-panel');
    await b.goto(`/projects/${room.projectId}`);
    await expect(b.getByTestId('room-summary')).toBeVisible();
    await expect(b.getByTestId('summary-now')).not.toBeEmpty();
    await expect(b.getByTestId('summary-todo')).not.toBeEmpty();
    await expect(b.getByTestId('summary-pay')).toContainText('$');
    await expect(b.getByTestId('product-tour')).toBeVisible();
    await b.getByRole('button', { name: 'Skip tour' }).click();
    await shot(b, info, '76-project-room');
    void payTestCheckout;
  });
});
