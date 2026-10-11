import type { Page, TestInfo } from '@playwright/test';
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
