// Viewport screenshot helper: node scripts/vs.mjs <path> <out.png> [width=1440] [height=900] [theme=dark] [email] [scrollY=0]
import { chromium } from '@playwright/test';
const [path, out, w = '1440', h = '900', theme = 'dark', email = '', scrollY = '0'] = process.argv.slice(2);
const base = process.env.WEB_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h },
  baseURL: base,
  deviceScaleFactor: +w < 500 ? 2 : 1,
});
await ctx.addInitScript((t) => localStorage.setItem('theme', t), theme);
if (email) {
  const r = await ctx.request.post('http://localhost:4000/v1/auth/sign-in/email', {
    data: { email, password: 'Glasswork-dev-123!' },
    headers: { Origin: base },
  });
  if (!r.ok()) throw new Error('login ' + r.status());
}
const page = await ctx.newPage();
await page.goto(path, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
await page.evaluate((y) => window.scrollTo(0, y), +scrollY);
await page.waitForTimeout(800);
await page.screenshot({ path: out });
await browser.close();
