import { defineConfig, devices } from '@playwright/test';

/** Screenshot + smoke pass over every page (`pnpm shots`). Separate from the e2e suite; needs `pnpm db:seed:demo`. */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './shots',
  testMatch: '**/*.shots.ts',
  timeout: 15 * 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: '../artifacts/test-results-shots',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    launchOptions: { executablePath },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
