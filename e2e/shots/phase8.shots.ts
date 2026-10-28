import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { API_URL, WEB_ORIGIN, apiCall, idemKey, SEED_PASSWORD } from '../tests/helpers';

const OUT = process.env.SHOTS_OUT
  ? path.resolve(process.env.SHOTS_OUT)
  : path.resolve(__dirname, '../../artifacts/screenshots/phase8');
const DEMO_SELLER = 'amara.okafor@demo.glasswork.test';
const DEMO_SERVICE = 'demo-nextjs-saas-mvp';

type Entry = { group: string; name: string; url: string };
interface Finding {
  viewport: string;
  theme: string;
  file: string;
  url: string;
  status: number;
  consoleErrors: string[];
  overflowX: boolean;
}
const findings: Finding[] = [];

async function login(
  browser: Browser,
  baseURL: string | undefined,
  email: string,
  theme: 'dark' | 'light' = 'dark',
) {
  const ctx = await browser.newContext({ baseURL });
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem('theme', t);
    } catch {
      /* ignore */
    }
  }, theme);
  const page = await ctx.newPage();
  if (email) {
    const res = await page.request.post(`${API_URL}/v1/auth/sign-in/email`, {
      data: { email, password: SEED_PASSWORD },
      headers: WEB_ORIGIN,
    });
    expect(res.ok(), `sign-in ${email} → ${res.status()}`).toBeTruthy();
  }
  return { ctx, page };
}

async function snap(ctx: BrowserContext, page: Page, viewport: string, theme: string, e: Entry) {
  const errors: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => {
    // Failed network loads are reported (with their URL) by onResponse below.
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource'))
      errors.push(m.text().slice(0, 200));
  };
  // Expected noise: signed-out visitors get 401 from the favorites call; the not-found page is a 404 by design.
  const onResponse = (r: { status(): number; url(): string }) => {
    if (r.status() < 400) return;
    if (r.status() === 401 && r.url().includes('/me/favorites/ids')) return;
    if (r.status() === 404 && e.name === 'not-found') return;
    errors.push(`${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`);
  };
  page.on('console', onConsole);
  page.on('response', onResponse);
  const res = await page.goto(e.url, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  // Scroll through the page so scroll-triggered reveals run, then return to the top for the capture.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(900);
  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  const dir = path.join(OUT, viewport, theme === 'dark' ? '' : 'light');
  fs.mkdirSync(dir, { recursive: true });
  const file = `${e.group}-${e.name}.png`;
  await page.screenshot({ path: path.join(dir, file), fullPage: true });
  page.off('console', onConsole);
  page.off('response', onResponse);
  findings.push({
    viewport,
    theme,
    file,
    url: e.url,
    status: res?.status() ?? 0,
    consoleErrors: errors,
    overflowX,
  });
  void ctx;
}

test('phase 8 screenshots and smoke pass', async ({ browser }, info) => {
  test.setTimeout(15 * 60_000);
  const viewport = info.project.name;
  const baseURL = info.project.use.baseURL;
  fs.mkdirSync(OUT, { recursive: true });

  const buyer = await login(browser, baseURL, 'buyer@dev.glasswork.test');
  const seller = await login(browser, baseURL, DEMO_SELLER);
  const admin = await login(browser, baseURL, 'admin@dev.glasswork.test');
  const anon = await login(browser, baseURL, '');

  // A real, consistent active project built through the API (demo seller + dev buyer), advanced to 30%.
  const svc = await apiCall<{ id: string; packages: { id: string; tier: string }[] }>(
    anon.page,
    'GET',
    `/services/${DEMO_SERVICE}`,
  );
  const pkg = svc.packages.find((p) => p.tier === 'standard') ?? svc.packages[0]!;
  const order = await apiCall<{ projectId: string; firstMilestoneId: string }>(
    buyer.page,
    'POST',
    '/orders',
    { packageId: pkg.id },
    { 'idempotency-key': idemKey('shots') },
  );
  const fund = async (id: string) => {
    const f = await apiCall<{ paymentId: string }>(buyer.page, 'POST', `/milestones/${id}/fund`, undefined, {
      'idempotency-key': idemKey('shots'),
    });
    await apiCall(buyer.page, 'POST', `/payments/${f.paymentId}/simulate`, { outcome: 'succeeded' });
  };
  await fund(order.firstMilestoneId);
  await apiCall(seller.page, 'POST', `/projects/${order.projectId}/accept`);
  const proj = await apiCall<{ milestones: { id: string; position: number }[] }>(
    buyer.page,
    'GET',
    `/projects/${order.projectId}`,
  );
  const [m1, m2] = proj.milestones;
  await apiCall(seller.page, 'POST', `/milestones/${m1!.id}/start`);
  await apiCall(seller.page, 'POST', `/milestones/${m1!.id}/submit`, {
    note: 'Wireframes, data model and the project plan are ready for review.',
  });
  await apiCall(buyer.page, 'POST', `/milestones/${m1!.id}/approve`);
  await fund(m2!.id);
  await apiCall(seller.page, 'POST', `/milestones/${m2!.id}/start`);
  const pid = order.projectId;

  const publicPages: Entry[] = [
    ['home', '/'],
    ['how-it-works', '/how-it-works'],
    ['pricing', '/pricing'],
    ['trust', '/trust'],
    ['for-sellers', '/for-sellers'],
    ['about', '/about'],
    ['contact', '/contact'],
    ['seller-levels', '/seller-levels'],
    ['services', '/services'],
    ['services-filtered', '/services?category=web-development&minRating=4'],
    ['service-detail', `/services/${DEMO_SERVICE}`],
    ['seller-profile', '/u/amara-okafor'],
    ['requests', '/requests'],
    ['design-system', '/design'],
    ['login', '/login'],
    ['signup', '/signup'],
    ['forgot-password', '/forgot-password'],
    ['legal-terms', '/legal/terms'],
    ['legal-privacy', '/legal/privacy'],
    ['legal-seller-agreement', '/legal/seller-agreement'],
    ['legal-buyer-protection', '/legal/buyer-protection'],
    ['legal-acceptable-use', '/legal/acceptable-use'],
    ['legal-cookies', '/legal/cookies'],
    ['not-found', '/this-page-does-not-exist'],
  ].map(([name, url]) => ({ group: 'public', name: name!, url: url! }));

  const buyerPages: Entry[] = [
    ['dashboard', '/dashboard'],
    ['projects', '/projects'],
    ['project-room', `/projects/${pid}`],
    ['project-board', `/projects/${pid}?tab=board`],
    ['project-timeline', `/projects/${pid}?tab=timeline`],
    ['project-deliverables', `/projects/${pid}?tab=deliverables`],
    ['messages', '/messages'],
    ['notifications', '/notifications'],
    ['favorites', '/favorites'],
    ['billing', '/billing'],
    ['settings', '/settings'],
    ['notification-settings', '/settings/notifications'],
    ['orgs', '/orgs'],
    ['request-new', '/requests/new'],
    ['ai-brief-builder', '/requests/new/ai'],
    ['my-requests', '/requests/mine'],
    ['match', '/match'],
  ].map(([name, url]) => ({ group: 'buyer', name: name!, url: url! }));

  const sellerPages: Entry[] = [
    ['dashboard', '/dashboard'],
    ['project-room', `/projects/${pid}`],
    ['services', '/sell/services'],
    ['service-new', '/sell/services/new'],
    ['earnings', '/earnings'],
    ['analytics', '/seller/analytics'],
    ['verification', '/seller/verification'],
    ['onboarding', '/seller/onboarding'],
  ].map(([name, url]) => ({ group: 'seller', name: name!, url: url! }));

  const adminPages: Entry[] = [
    ['home', '/admin'],
    ['users', '/admin/users'],
    ['services', '/admin/services'],
    ['verifications', '/admin/verifications'],
    ['disputes', '/admin/disputes'],
    ['reports', '/admin/reports'],
    ['payments', '/admin/payments'],
    ['payouts', '/admin/payouts'],
    ['settings', '/admin/settings'],
    ['audit', '/admin/audit'],
  ].map(([name, url]) => ({ group: 'admin', name: name!, url: url! }));

  for (const e of publicPages) await snap(anon.ctx, anon.page, viewport, 'dark', e);
  for (const e of buyerPages) await snap(buyer.ctx, buyer.page, viewport, 'dark', e);
  for (const e of sellerPages) await snap(seller.ctx, seller.page, viewport, 'dark', e);
  for (const e of adminPages) await snap(admin.ctx, admin.page, viewport, 'dark', e);

  // Light theme pass on the pages that define the look.
  const light = await login(browser, baseURL, 'buyer@dev.glasswork.test', 'light');
  const lightAnon = await login(browser, baseURL, '', 'light');
  for (const e of publicPages.filter((p) =>
    ['home', 'services', 'service-detail', 'seller-profile', 'design-system', 'pricing'].includes(p.name),
  ))
    await snap(lightAnon.ctx, lightAnon.page, viewport, 'light', e);
  for (const e of buyerPages.filter((p) => ['dashboard', 'project-room'].includes(p.name)))
    await snap(light.ctx, light.page, viewport, 'light', e);

  fs.writeFileSync(path.join(OUT, `report-${viewport}.json`), JSON.stringify(findings, null, 2));
  const bad = findings.filter(
    (f) => f.status >= 500 || f.consoleErrors.length || (viewport === 'mobile' && f.overflowX),
  );
  console.warn(`pages: ${findings.length}, with issues: ${bad.length}`);
  for (const b of bad)
    console.warn(
      `  ${b.viewport}/${b.theme} ${b.url} status=${b.status} overflowX=${b.overflowX} errors=${b.consoleErrors.join(' | ')}`,
    );
  for (const c of [buyer, seller, admin, anon, light, lightAnon]) await c.ctx.close();
});
