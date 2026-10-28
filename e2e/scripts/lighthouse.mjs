// Lighthouse over public pages (mobile profile = Lighthouse default). Usage: node scripts/lighthouse.mjs [desktop]
// Writes artifacts/lighthouse/summary.json. Needs the stack running; uses Playwright's Chromium.
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const base = process.env.WEB_URL ?? 'http://localhost:3000';
const preset = process.argv[2] === 'desktop' ? 'desktop' : 'mobile';
const pages = [
  '/',
  '/services',
  '/services/demo-nextjs-saas-mvp',
  '/u/amara-okafor',
  '/how-it-works',
  '/pricing',
  '/trust',
  '/for-sellers',
  '/about',
  '/contact',
  '/help',
  '/help/escrow-and-fees',
  '/seller-levels',
  '/login',
  '/signup',
  '/legal/terms',
];
const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
});
const out = [];
for (const p of pages) {
  const r = await lighthouse(base + p, {
    port: chrome.port,
    output: 'json',
    logLevel: 'error',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    formFactor: preset,
    screenEmulation:
      preset === 'desktop'
        ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
        : undefined,
    throttlingMethod: 'simulate',
  });
  const c = r.lhr.categories;
  const row = {
    page: p,
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c['best-practices'].score * 100),
    seo: Math.round(c.seo.score * 100),
    lcp: Math.round(r.lhr.audits['largest-contentful-paint'].numericValue),
    cls: +r.lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3),
    tbt: Math.round(r.lhr.audits['total-blocking-time'].numericValue),
    failing: Object.values(r.lhr.audits)
      .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode === 'binary')
      .map((a) => a.id)
      .slice(0, 8),
  };
  out.push(row);
  console.log(JSON.stringify(row));
}
await chrome.kill();
fs.mkdirSync('../artifacts/lighthouse', { recursive: true });
fs.writeFileSync(`../artifacts/lighthouse/summary-${preset}.json`, JSON.stringify(out, null, 2));
