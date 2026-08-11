import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * TESTS RUN AGAINST THE BUILT OUTPUT, NOT THE DEV SERVER. The site is
 * `output: 'static'` with a handful of routes opting out, and almost everything
 * these tests assert — the prerendered pages, the no-JavaScript catalogue
 * listing, hydration boundaries, the `dist/client/` split — is a property of the
 * build rather than of the source. A dev-server run would test a different
 * artefact from the one that ships.
 *
 * `webServer.command` BUILDS FIRST, deliberately. The alternative — assuming a
 * build is already there — fails in the worst possible way: the suite passes
 * against yesterday's `dist/client/`, green, and says nothing about the code
 * that was just changed. A cold build here takes well under a minute, and
 * `reuseExistingServer` means an already-running `npm run preview` is used as
 * it stands, so the rebuild is skipped during iterative local work.
 *
 * `npm run preview` is NOT `astro preview`. `@astrojs/vercel` ships no preview
 * entrypoint, so `astro preview` exits with "The @astrojs/vercel adapter does
 * not support the preview command." The script now runs
 * `tests/preview-server.mjs`, which serves `dist/client/` and hands the routes
 * that `.vercel/output/config.json` marks `_render` to the SSR bundle the
 * adapter actually built. See that file's header.
 */
const PORT = Number(process.env.PORT ?? 4321);
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  /**
   * No retries locally. `/api/enquiry` rate-limits to 5 submissions per client
   * per 10 minutes, in memory, and a retried submission test would silently
   * spend one of those against a server that outlives the run. The submission
   * tests give themselves distinct `x-forwarded-for` addresses so they do not
   * share a bucket (see tests/e2e/enquiry.spec.ts); one retry on CI is within
   * what that leaves.
   */
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,

  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],

  timeout: 45_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // 393x851, touch, mobile user agent — the header collapses to the mobile
      // trigger here and the catalogue grid drops to two columns.
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
