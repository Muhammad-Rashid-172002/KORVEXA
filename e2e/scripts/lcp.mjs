import { chromium } from '@playwright/test';
const url = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 412, height: 823 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(process.argv[3] ?? 4) });
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await page.addInitScript(() => {
  window.__lcp = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries())
      window.__lcp.push([
        Math.round(e.startTime),
        e.element?.tagName,
        (e.element?.textContent || e.url || '').slice(0, 40),
      ]);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
});
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(3000);
console.log(
  JSON.stringify(
    await page.evaluate(() => ({
      lcp: window.__lcp,
      fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    })),
  ),
);
await b.close();
