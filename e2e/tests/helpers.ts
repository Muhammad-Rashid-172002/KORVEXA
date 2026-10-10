import type { Page, TestInfo } from '@playwright/test';
import path from 'node:path';

export const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
export const API_URL = process.env.API_URL ?? 'http://localhost:4000';

export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;

/** Polls Mailpit's API for the newest message to `to` and returns the verification link inside it. */
export async function waitForVerificationLink(to: string, timeoutMs = 20_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const search = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    if (search.ok) {
      const { messages } = (await search.json()) as { messages: { ID: string }[] };
      if (messages?.[0]) {
        const msg = (await (await fetch(`${MAILPIT_URL}/api/v1/message/${messages[0].ID}`)).json()) as { HTML: string; Text: string };
        const match = (msg.Text + msg.HTML).match(/https?:\/\/[^\s"'<>]+\/v1\/auth\/verify-email\?[^\s"'<>]+/);
        if (match) return match[0].replace(/&amp;/g, '&');
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No verification email for ${to} within ${timeoutMs}ms`);
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
