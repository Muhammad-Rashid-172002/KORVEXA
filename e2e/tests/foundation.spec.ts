import { expect, test } from '@playwright/test';
import { brand } from '@glasswork/shared/brand';
import { PNG_1PX, shot, uniqueEmail, waitForVerificationLink } from './helpers';

test.describe('Phase 0 foundation', () => {
  test('home shows the brand lockup and no fabricated data', async ({ page }, info) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: brand.lockup })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toContainText(brand.lockup);
    await shot(page, info, '01-home');
  });

  test('dashboard redirects anonymous visitors to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('sign up → verify email (Mailpit) → dashboard → realtime → upload → logout → login', async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const password = 'e2e-password-123';

    // 1. Sign up
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.getByLabel('Full name').fill('E2E Tester');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await shot(page, info, '02-signup');
    await page.getByRole('button', { name: 'Create account' }).click();

    // 2. Check-your-inbox screen
    await expect(page).toHaveURL(/\/verify-email\?email=/);
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    await shot(page, info, '03-verify-email');

    // 3. Unverified login is refused with a helpful message
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Please verify your email first')).toBeVisible();

    // 4. Click the link from the email → signed in on the dashboard
    const link = await waitForVerificationLink(email);
    await page.goto(link);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome, E2E Tester/ })).toBeVisible();
    await expect(page.getByText('email verified')).toBeVisible();

    // 5. Authenticated websocket
    const status = page.getByTestId('realtime-status');
    await expect(status).toHaveAttribute('data-status', 'connected');
    await page.getByRole('button', { name: 'Ping' }).click();
    await expect(status).toContainText(/\d+ ms/);

    // 6. Presigned upload straight to object storage
    await page
      .getByTestId('file-input')
      .setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: PNG_1PX });
    await expect(page.getByTestId('file-list')).toContainText('proof.png');
    await expect(page.getByRole('button', { name: 'Download proof.png' })).toBeVisible();
    await shot(page, info, '04-dashboard');

    // 7. Logout → protected page is gone
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login$/);

    // 8. Log back in with the password
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('wrong-password-000');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    await shot(page, info, '05-login-error');
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByTestId('file-list')).toContainText('proof.png');
  });

  test('light theme renders', async ({ page }, info) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveClass(/light/);
    await shot(page, info, '06-login-light');
  });
});
