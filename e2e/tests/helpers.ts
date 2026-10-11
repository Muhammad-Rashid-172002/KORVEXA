import { expect, type Browser, type Page, type TestInfo } from '@playwright/test';
import { brand } from '@glasswork/shared/brand';
import path from 'node:path';

export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

/** Polls Mailpit's API for the newest message to `to` and returns the first link matching `pattern`. */
export async function waitForMailLink(to: string, pattern: RegExp, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (search.ok) {
      const { messages } = (await search.json()) as { messages: { ID: string }[] };
      if (messages?.[0]) {
        const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json()) as {
          HTML: string;
          Text: string;
        };
        const match = (msg.Text + msg.HTML).match(pattern);
        if (match) return match[0].replace(/&amp;/g, '&');
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No matching email for ${to} within ${timeoutMs}ms`);
}

export const waitForVerificationLink = (to: string, timeoutMs?: number) =>
  waitForMailLink(to, /https?:\/\/[^\s"'<>]+\/v1\/auth\/verify-email\?[^\s"'<>]+/, timeoutMs);

export const waitForResetLink = (to: string, timeoutMs?: number) =>
  waitForMailLink(to, /https?:\/\/[^\s"'<>]+\/v1\/auth\/reset-password\/[^\s"'<>]+/, timeoutMs);

/** Signs up through the UI, verifies via Mailpit, and lands signed-in on the dashboard. */
export async function signUpAndVerify(page: Page, email: string, name: string, password: string) {
  await page.goto('/signup');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL(/\/verify-email/);
  await page.goto(await waitForVerificationLink(email));
  await page.waitForURL(/\/dashboard/);
}

export async function shot(page: Page, info: TestInfo, name: string): Promise<void> {
  await page.screenshot({
    path: path.resolve(__dirname, '../../artifacts/screenshots', `${info.project.name}-${name}.png`),
    fullPage: true,
  });
}

/** A tiny valid PNG (1×1) for upload tests. */
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export const WEB_ORIGIN = { origin: 'http://localhost:3000' };
/** Dev-seed password (mirrors packages/db seed: "<product>-dev-123!"). */
export const SEED_PASSWORD = `${brand.productName}-dev-123!`;

/** Calls the API with the page's cookies (same session as the browser). Fails the test on a non-2xx unless `allow` says so. */
export async function apiCall<T = unknown>(
  page: Page,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  data?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const res = await page.request.fetch(`${API_URL}/v1${path}`, {
    method,
    data,
    headers: { ...WEB_ORIGIN, ...headers },
  });
  expect(res.ok(), `${method} ${path} → ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json().catch(() => ({}))) as T;
}

let idem = 0;
export const idemKey = (p = 'e2e') => `${p}-${Date.now()}-${Math.floor(Math.random() * 1e6)}-${++idem}`;

/** Signs up, becomes a seller and publishes the seller profile through the API (the wizard has its own e2e). */
export async function publishedSeller(page: Page, tag: string) {
  const email = uniqueEmail(tag);
  await signUpAndVerify(page, email, `Seller ${tag}`, 'e2e-password-123');
  await apiCall(page, 'POST', '/me/seller');
  await apiCall(page, 'PATCH', '/me/profile', { headline: 'Engineer', bio: 'Builds things', country: 'PK' });
  await apiCall(page, 'PUT', '/me/seller/skills', { skills: ['React'] });
  await apiCall(page, 'PATCH', '/me/seller', { hourlyRateAmount: 4000 });
  await apiCall(page, 'POST', '/me/seller/onboarding/complete');
  return email;
}

/** A browser context signed in as the seeded dev admin (all scopes). */
export async function adminContext(browser: Browser, baseURL: string | undefined) {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  const res = await page.request.post(`${API_URL}/v1/auth/sign-in/email`, {
    data: { email: 'admin@dev.glasswork.test', password: SEED_PASSWORD },
    headers: WEB_ORIGIN,
  });
  expect(res.ok(), `admin sign-in → ${res.status()}`).toBeTruthy();
  return { ctx, page };
}

/** Creates a service for the signed-in seller, submits it and has the admin approve it. Returns slug + package id. */
export async function liveService(seller: Page, admin: Page, title: string, priceCents: number) {
  const cats = await apiCall<{ id: string; slug: string }[]>(seller, 'GET', '/categories');
  const svc = await apiCall<{ id: string; slug: string; packages: { id: string }[] }>(
    seller,
    'POST',
    '/me/services',
    {
      categoryId: cats[0]!.id,
      title,
      description:
        'A complete production-ready build with tests, CI and clear milestones for every stage of delivery.',
      packages: [
        {
          tier: 'basic',
          title: 'Standard build',
          description: 'Everything included in the build',
          priceAmount: priceCents,
          deliveryDays: 10,
          revisions: 2,
        },
      ],
    },
  );
  await apiCall(seller, 'POST', `/me/services/${svc.id}/submit`);
  await apiCall(admin, 'POST', `/admin/services/${svc.id}/approve`);
  return { serviceId: svc.id, slug: svc.slug, packageId: svc.packages[0]!.id };
}

/**
 * Presses "Pay (simulate success)" on the test checkout page and waits for the project page. The click can land
 * before the client component hydrates, so it retries; this is safe because webhook processing is idempotent.
 */
export async function payTestCheckout(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Pay (simulate success)' }).click({ timeout: 3000 });
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 4000 });
  }).toPass({ timeout: 30_000 });
}

export interface ProjectLite {
  id: string;
  milestones: { id: string; position: number }[];
}

/** Seller + published service + buyer + an ACTIVE project (m1 funded, accepted) — built through the API for speed. */
export async function activeRoom(
  { page, browser }: { page: Page; browser: Browser },
  info: TestInfo,
  tag: string,
  priceCents = 100_000,
) {
  const baseURL = info.project.use.baseURL;
  await publishedSeller(page, `${info.project.name}-${tag}-s`);
  const admin = await adminContext(browser, baseURL);
  const svc = await liveService(
    page,
    admin.page,
    `Room ${tag} ${info.project.name} service ${Date.now() % 100000}`,
    priceCents,
  );
  await admin.ctx.close();
  const buyerCtx = await browser.newContext({ baseURL });
  const buyer = await buyerCtx.newPage();
  await signUpAndVerify(buyer, uniqueEmail(`${info.project.name}-${tag}-b`), 'Bea Buyer', 'e2e-password-123');
  const order = await apiCall<{ projectId: string; firstMilestoneId: string }>(
    buyer,
    'POST',
    '/orders',
    { packageId: svc.packageId },
    { 'idempotency-key': idemKey() },
  );
  const f = await apiCall<{ paymentId: string }>(
    buyer,
    'POST',
    `/milestones/${order.firstMilestoneId}/fund`,
    undefined,
    { 'idempotency-key': idemKey() },
  );
  await apiCall(buyer, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' });
  await apiCall(page, 'POST', `/projects/${order.projectId}/accept`);
  const p = await apiCall<ProjectLite>(buyer, 'GET', `/projects/${order.projectId}`);
  return { buyer, buyerCtx, projectId: order.projectId, milestones: p.milestones, svc };
}

/** A browser context signed in as the seeded dev admin THROUGH THE UI (for admin screens). */
export async function adminUi(browser: Browser, baseURL: string | undefined) {
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@dev.glasswork.test');
  await page.getByLabel('Password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return { ctx, page };
}

/** Drives every milestone of an active room (m1 accepted, not started) to released through the API. */
export async function completeRoom(seller: Page, room: { buyer: Page; milestones: { id: string }[] }) {
  for (const [i, m] of room.milestones.entries()) {
    if (i > 0) {
      const f = await apiCall<{ paymentId: string }>(
        room.buyer,
        'POST',
        `/milestones/${m.id}/fund`,
        undefined,
        { 'idempotency-key': idemKey() },
      );
      await apiCall(room.buyer, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' });
    }
    await apiCall(seller, 'POST', `/milestones/${m.id}/start`);
    await apiCall(seller, 'POST', `/milestones/${m.id}/submit`, {});
    await apiCall(room.buyer, 'POST', `/milestones/${m.id}/approve`);
  }
}
