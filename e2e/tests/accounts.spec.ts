import { expect, test } from '@playwright/test';
import { shot, signUpAndVerify, uniqueEmail, waitForResetLink, PNG_1PX } from './helpers';

const SEED_PASSWORD = 'Glasswork-dev-123!';

test.describe('Phase 1 accounts', () => {
  test('buyer becomes a seller, switches mode, publishes a profile, anonymous visitor sees it', async ({
    page,
    browser,
  }, info) => {
    const email = uniqueEmail(`${info.project.name}-seller`);
    const name = `Sam ${info.project.name} Seller`;
    await signUpAndVerify(page, email, name, 'e2e-password-123');

    await page.goto('/settings');
    await expect(page.getByTestId('active-mode')).toHaveText('buyer');
    await page.getByRole('button', { name: 'Become a seller' }).click();
    await expect(page.getByTestId('active-mode')).toHaveText('seller');
    await page.getByRole('button', { name: 'Switch to buyer' }).click();
    await expect(page.getByTestId('active-mode')).toHaveText('buyer');
    await page.getByRole('button', { name: 'Switch to seller' }).click();
    await expect(page.getByTestId('active-mode')).toHaveText('seller');

    // avatar via presigned upload
    await page
      .getByTestId('avatar-input')
      .setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect(page.getByAltText('Your avatar')).toBeVisible();

    // wizard
    await page.goto('/seller/onboarding');
    await expect(page.getByRole('button', { name: 'Publish seller profile' })).toBeDisabled();
    await page.getByLabel('Headline').fill('Full-stack engineer');
    await page.getByLabel('About you').fill('I ship software end to end.');
    await page.getByLabel('Country (2-letter code)').fill('pk');
    await page.getByRole('button', { name: 'Save' }).first().click();
    await expect(page.getByText('Saved.')).toBeVisible();

    await page.getByLabel('Skills, comma separated').fill('React, Node.js');
    const skillsSaved = page.waitForResponse(
      (r) => r.url().endsWith('/v1/me/seller/skills') && r.request().method() === 'PUT',
    );
    await page.getByRole('button', { name: 'Save' }).nth(1).click();
    expect((await skillsSaved).status()).toBe(200);
    await page.reload();
    await expect(page.getByLabel('Skills, comma separated')).toHaveValue('Node.js, React');

    await page.getByLabel('Project title').fill('Shop app');
    await page.getByLabel('Link (https://…)').fill('https://example.com/shop');
    await page.getByRole('button', { name: 'Add item' }).click();
    await expect(page.getByText('Portfolio item added.')).toBeVisible();

    await page.getByLabel(/Hourly rate/).fill('45');
    await page.getByRole('button', { name: 'Save' }).nth(2).click();
    await expect(page.getByRole('button', { name: 'Publish seller profile' })).toBeEnabled();
    await shot(page, info, '10-seller-onboarding');
    await page.getByRole('button', { name: 'Publish seller profile' }).click();
    await expect(page.getByText('Your seller profile is published.')).toBeVisible();

    const link = page.getByRole('link', { name: 'View public profile →' });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/u\//);

    // anonymous visitor
    const anon = await browser.newContext({ baseURL: info.project.use.baseURL });
    const anonPage = await anon.newPage();
    await anonPage.goto(href!);
    await expect(anonPage.getByRole('heading', { name: name })).toBeVisible();
    await expect(anonPage.getByText('Full-stack engineer')).toBeVisible();
    await expect(anonPage.getByText('React', { exact: true })).toBeVisible();
    await expect(anonPage.getByText('Shop app')).toBeVisible();
    await expect(anonPage.getByText(email)).toHaveCount(0);
    await shot(anonPage, info, '11-public-profile');
    await anon.close();
  });

  test('forgot password → email link → new password → login', async ({ page }, info) => {
    const email = uniqueEmail(`${info.project.name}-reset`);
    await signUpAndVerify(page, email, 'Reset Tester', 'old-password-123');
    await page.getByRole('button', { name: 'Log out' }).click();

    await page.goto('/forgot-password');
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('If an account exists')).toBeVisible();

    await page.goto(await waitForResetLink(email));
    await expect(page).toHaveURL(/\/reset-password\?token=/);
    await page.getByLabel('New password').fill('brand-new-password-456');
    await page.getByRole('button', { name: 'Set new password' }).click();
    await expect(page).toHaveURL(/\/login\?reset=1/);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('brand-new-password-456');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('team: owner creates an organization and sees the invite flow; sessions panel lists this device', async ({
    page,
  }, info) => {
    const email = uniqueEmail(`${info.project.name}-org`);
    await signUpAndVerify(page, email, 'Org Owner', 'e2e-password-123');

    await page.goto('/orgs');
    await page.getByLabel('Name').fill('Acme Studio');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/\/orgs\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Acme Studio' })).toBeVisible();
    await expect(page.getByTestId('member-list')).toContainText('Org Owner');

    await page.getByLabel('Email').fill('teammate@example.test');
    await page.getByRole('button', { name: 'Send invitation' }).click();
    await expect(page.getByText('Invitation sent.')).toBeVisible();
    await expect(page.getByTestId('invite-list')).toContainText('teammate@example.test');
    await shot(page, info, '12-org');

    await page.goto('/settings');
    await expect(page.getByTestId('session-list')).toContainText('this device');
    await shot(page, info, '13-settings');
  });

  test('admin area: seeded admin can open it; a regular user gets 404', async ({ page, context }, info) => {
    const email = uniqueEmail(`${info.project.name}-noadmin`);
    await signUpAndVerify(page, email, 'Plain User', 'e2e-password-123');
    const res = await page.goto('/admin/users');
    expect(res?.status()).toBe(404);
    await page
      .getByRole('link', { name: /home|glasswork/i })
      .first()
      .click()
      .catch(() => undefined);
    await context.clearCookies();

    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@dev.glasswork.test');
    await page.getByLabel('Password').fill(SEED_PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/admin/users?q=admin%40dev.glasswork.test');
    await expect(page.getByTestId('admin-users')).toContainText('admin@dev.glasswork.test');
    await page.getByRole('link', { name: 'Audit log' }).click();
    await expect(page.getByTestId('admin-audit')).toContainText('user.created');
    await shot(page, info, '14-admin');
  });
});
