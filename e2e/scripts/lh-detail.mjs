import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import { chromium } from '@playwright/test';
const url = process.argv[2];
const chrome = await chromeLauncher.launch({
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox'],
});
const r = await lighthouse(url, {
  port: chrome.port,
  output: 'json',
  logLevel: 'error',
  onlyCategories: ['performance', 'seo'],
  throttlingMethod: 'simulate',
});
const a = r.lhr.audits;
console.log(
  'lcpEl',
  Object.keys(a)
    .filter((k) => /lcp/i.test(k))
    .join(','),
  JSON.stringify(
    a['largest-contentful-paint-element']?.details ?? a['lcp-breakdown-insight']?.details ?? null,
  ).slice(0, 700),
);
console.log('bench', r.lhr.environment.benchmarkIndex);
console.log(
  'perf',
  r.lhr.categories.performance.score,
  'fcp',
  a['first-contentful-paint'].displayValue,
  'lcp',
  a['largest-contentful-paint'].displayValue,
  'tbt',
  a['total-blocking-time'].displayValue,
);
console.log('crawlable:', JSON.stringify(a['is-crawlable'].details?.items?.slice(0, 2)));
for (const id of ['bootup-time', 'unused-javascript'])
  console.log(
    id,
    a[id].displayValue,
    JSON.stringify(
      (a[id].details?.items ?? [])
        .slice(0, 8)
        .map((i) => [
          (i.url ?? '').replace(/^https?:\/\/[^/]+/, '').slice(0, 70),
          Math.round(i.total ?? i.wastedBytes ?? 0),
        ]),
    ),
  );
const nets = a['network-requests'].details.items
  .filter((i) => i.resourceType === 'Script')
  .sort((x, y) => y.transferSize - x.transferSize)
  .slice(0, 8);
console.log(
  'scripts',
  nets.map((n) => [
    n.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 60),
    Math.round(n.transferSize / 1024) + 'kB',
  ]),
);
console.log(
  'total script kB',
  Math.round(
    a['network-requests'].details.items
      .filter((i) => i.resourceType === 'Script')
      .reduce((s, i) => s + i.transferSize, 0) / 1024,
  ),
);
await chrome.kill();
