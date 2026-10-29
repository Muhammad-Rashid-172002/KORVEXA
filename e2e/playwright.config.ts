import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack (`pnpm dev:up` locally, docker compose in CI).
 * Screenshots land in the git-ignored ../artifacts/screenshots folder.
 */
const executablePath = process.env.PW_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  // One worker on CI: the 2-vCPU runner is slow enough that parallel browsers cause timing flakes (as on a loaded laptop).
  workers: process.env.CI ? 1 : undefined,
  // `github` turns failures into annotations, which are readable through the API without log access.
  reporter: process.env.CI
    ? [['list'], ['github'], ['html', { open: 'never', outputFolder: '../artifacts/playwright-report' }]]
    : 'list',
  outputDir: '../artifacts/test-results',
  use: {
    baseURL: process.env.WEB_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
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
