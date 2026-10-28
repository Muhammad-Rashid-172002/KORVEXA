import { test, type Browser, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';
import { API_URL, WEB_ORIGIN, SEED_PASSWORD } from '../tests/helpers';

/**
 * Link crawler (`pnpm crawl`): for each persona, starts at a set of seeds and follows every same-origin link,
 * recording broken links, 4xx/5xx, console errors, failed requests, layout shift, overflowing elements,
 * axe violations (incl. colour contrast) and visible placeholder text. Report: artifacts/crawl/report-<viewport>.json.
 */
const OUT = path.resolve(__dirname, '../../artifacts/crawl');
const MAX_PAGES = Number(process.env.CRAWL_MAX ?? 70); // per persona
const PLACEHOLDER =
  /\b(lorem ipsum|todo|tbd|coming soon|placeholder|example\.com|foo bar|asdf|undefined|NaN|\[object Object\])\b/i;
// Never follow links that sign out, delete or leave the app.
const SKIP = /\/(logout|sign-out)|^\/design|\/pay\/test|\/api\//;

const PERSONAS: { name: string; email: string; seeds: string[] }[] = [
  { name: 'visitor', email: '', seeds: ['/', '/services', '/requests', '/login', '/signup'] },
  {
    name: 'buyer',
    email: 'buyer@dev.glasswork.test',
    seeds: [
      '/dashboard',
      '/projects',
      '/messages',
      '/notifications',
      '/favorites',
      '/billing',
      '/settings',
      '/orgs',
      '/requests/new',
      '/requests/new/ai',
      '/requests/mine',
      '/match',
    ],
  },
  {
    name: 'seller',
    email: 'amara.okafor@demo.glasswork.test',
    seeds: [
      '/dashboard',
      '/projects',
      '/sell/services',
      '/sell/services/new',
      '/earnings',
      '/seller/analytics',
      '/seller/verification',
      '/seller/onboarding',
    ],
  },
  {
    name: 'admin',
    email: 'admin@dev.glasswork.test',
    seeds: [
      '/admin',
      '/admin/users',
      '/admin/services',
      '/admin/verifications',
      '/admin/disputes',
      '/admin/reports',
      '/admin/payments',
      '/admin/payouts',
      '/admin/settings',
      '/admin/audit',
    ],
  },
];

interface Issue {
  persona: string;
  url: string;
  kind: string;
  detail: string;
}

async function newPersonaPage(browser: Browser, baseURL: string | undefined, email: string, theme: string) {
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
    if (!res.ok()) throw new Error(`sign-in ${email} → ${res.status()}`);
  }
  return { ctx, page };
}

async function audit(page: Page, persona: string, url: string, viewport: string, issues: Issue[]) {
  const add = (kind: string, detail: string) =>
    issues.push({ persona, url, kind, detail: detail.slice(0, 300) });
  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > vw + 1) {
      for (const el of Array.from(document.body.querySelectorAll('*'))) {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
          out.push(`${el.tagName.toLowerCase()}.${String((el as HTMLElement).className).slice(0, 60)}`);
          if (out.length >= 3) break;
        }
      }
      if (!out.length) out.push('document wider than viewport');
    }
    return out;
  });
  if (overflow.length) add('overflow-x', overflow.join(' | '));
  const text = await page.evaluate(() => document.body.innerText);
  const m = text.match(PLACEHOLDER);
  if (m) add('placeholder-text', m[0]);
  const cls = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let v = 0;
        try {
          new PerformanceObserver((l) => {
            for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean }[])
              if (!e.hadRecentInput) v += e.value;
          }).observe({ type: 'layout-shift', buffered: true });
        } catch {
          /* unsupported */
        }
        setTimeout(() => resolve(v), 300);
      }),
  );
  if (cls > 0.1) add('layout-shift', `CLS ${cls.toFixed(3)}`);
  if (viewport === 'desktop') {
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    for (const v of axe.violations)
      add(`a11y:${v.id}`, `${v.impact} · ${v.nodes.length} nodes · ${v.nodes[0]?.target.join(' ')}`);
  }
}

test('crawl', async ({ browser }, info) => {
  test.setTimeout(30 * 60_000);
  const viewport = info.project.name;
  const baseURL = info.project.use.baseURL!;
  const origin = new URL(baseURL).origin;
  const theme = process.env.CRAWL_THEME ?? 'dark';
  fs.mkdirSync(OUT, { recursive: true });
  const issues: Issue[] = [];
  const visited = new Set<string>();
  let total = 0;

  for (const persona of PERSONAS) {
    const { ctx, page } = await newPersonaPage(browser, baseURL, persona.email, theme);
    const queue = [...persona.seeds];
    let personaPages = 0;
    let pageUrl = '';
    const add = (kind: string, detail: string) =>
      issues.push({ persona: persona.name, url: pageUrl, kind, detail: detail.slice(0, 300) });
    page.on('console', (m) => {
      if (m.type() === 'error' && !m.text().startsWith('Failed to load resource'))
        add('console-error', m.text());
    });
    page.on('pageerror', (e) => add('page-error', e.message));
    page.on('requestfailed', (r) => {
      if (!r.failure()?.errorText.includes('ABORTED'))
        add('request-failed', `${r.url()} ${r.failure()?.errorText}`);
    });
    page.on('response', (r) => {
      if (r.status() < 400) return;
      const u = r.url().replace(/^https?:\/\/[^/]+/, '');
      if (r.status() === 401 && u.includes('/me/')) return; // signed-out visitors
      if (r.request().resourceType() === 'document') return; // reported below with the page itself
      add('http-' + r.status(), u);
    });
    while (queue.length && personaPages < MAX_PAGES) {
      const href = queue.shift()!;
      const key = `${persona.name}:${href}`;
      if (visited.has(key)) continue;
      visited.add(key);
      pageUrl = href;
      total++;
      personaPages++;
      const res = await page.goto(href, { waitUntil: 'domcontentloaded' }).catch((e: Error) => {
        add('navigation-failed', e.message);
        return null;
      });
      if (!res) continue;
      if (res.status() >= 400) add('http-' + res.status(), 'page itself');
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
      await audit(page, persona.name, href, viewport, issues);
      const links = await page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href]')).map((a) => (a as HTMLAnchorElement).href),
      );
      for (const l of links) {
        let u: URL;
        try {
          u = new URL(l);
        } catch {
          continue;
        }
        if (u.protocol === 'mailto:' || u.protocol === 'tel:') continue;
        if (u.origin !== origin) {
          if (/^https?:$/.test(u.protocol) && /example\.com|localhost:(?!3000)/.test(u.host))
            add('suspicious-external', l);
          continue;
        }
        const rel = u.pathname + u.search;
        if (SKIP.test(rel) || visited.has(`${persona.name}:${rel}`)) continue;
        // Cap fan-out of detail pages with identical templates.
        const tmpl = rel.replace(/[0-9a-f-]{20,}|\/[a-z0-9-]+-[a-z0-9]{4,}$/g, '/:id').split('?')[0];
        const seen = [...visited].filter((v) => v.startsWith(`${persona.name}:`) && v.includes(tmpl!)).length;
        if (seen < 3) queue.push(rel);
      }
    }
    await ctx.close();
  }
  const slim = new Map<string, Issue>();
  for (const i of issues) slim.set(`${i.persona}|${i.url}|${i.kind}|${i.detail}`, i);
  const out = [...slim.values()];
  fs.writeFileSync(path.join(OUT, `report-${viewport}-${theme}.json`), JSON.stringify(out, null, 2));
  console.warn(`crawled ${total} pages (${viewport}, ${theme}); issues: ${out.length}`);
  const byKind = new Map<string, number>();
  for (const i of out) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
  console.warn([...byKind].map(([k, n]) => `${k}=${n}`).join('  '));
});
