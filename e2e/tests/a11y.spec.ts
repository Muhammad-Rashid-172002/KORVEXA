import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { API_URL, SEED_PASSWORD, WEB_ORIGIN } from './helpers';

/** WCAG 2.2 AA: keyboard-only flows and automated axe scans on key pages (run for desktop and mobile). */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function scan(page: Page, label: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map(
      (v) =>
        `${v.id}: ${v.nodes
          .slice(0, 2)
          .map((n) => n.target.join(' '))
          .join(' | ')}`,
    ),
    `axe violations on ${label}`,
  ).toEqual([]);
}

test.describe('Accessibility (WCAG 2.2 AA)', () => {
  test('public pages have no serious or critical axe violations', async ({ page }) => {
    for (const path of [
      '/',
      '/services',
      '/how-it-works',
      '/pricing',
      '/trust',
      '/help',
      '/help/escrow-and-fees',
      '/login',
      '/signup',
      '/seller-levels',
      '/contact',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await scan(page, path);
    }
  });

  test('skip link is the first tab stop and moves focus to the main content', async ({ page }) => {
    await page.goto('/about');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('keyboard only: log in, reach the dashboard, open the command palette, navigate and close it', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').focus();
    await page.keyboard.type('buyer@dev.glasswork.test');
    await page.keyboard.press('Tab');
    await page.keyboard.type(SEED_PASSWORD);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scan(page, '/dashboard');

    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.keyboard.type('Settings');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/settings$/);
    await scan(page, '/settings');

    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  });

  test('every interactive element shows a visible focus indicator', async ({ page }) => {
    await page.goto('/');
    const missing: string[] = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        const cs = getComputedStyle(el);
        const visible =
          (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none';
        return {
          visible,
          name: `${el.tagName.toLowerCase()} ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 30)}`,
        };
      });
      if (info && !info.visible) missing.push(info.name);
    }
    expect(missing).toEqual([]);
  });

  test('keyboard only: browse services, open a card, reach the order panel', async ({ page }) => {
    await page.goto('/services');
    const first = page.getByTestId('service-card').first().getByRole('link').first();
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/services\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scan(page, 'service detail');
  });

  test('authenticated key pages (project room, messages, billing) pass axe', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    const res = await page.request.post(`${API_URL}/v1/auth/sign-in/email`, {
      data: { email: 'buyer@dev.glasswork.test', password: SEED_PASSWORD },
      headers: WEB_ORIGIN,
    });
    expect(res.ok()).toBeTruthy();
    for (const path of ['/projects', '/messages', '/billing', '/favorites', '/requests/new/ai', '/match']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await scan(page, path);
    }
    await page.goto('/projects');
    const link = page.locator('a[href^="/projects/"]').first();
    if (await link.count()) {
      await link.click();
      await page.waitForLoadState('networkidle');
      await scan(page, 'project room');
    }
    await ctx.close();
  });
});
