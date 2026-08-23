import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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

/**
 * THE AUTHENTICATED ADMIN TESTS SAVE THINGS, so they need a database that is
 * allowed to be broken.
 *
 * `npm run test:db:start` brings up a throwaway Supabase stack and writes
 * `.test-db.json`. When that file is there, the preview server below is given
 * its credentials, so the build reads the catalogue from it and every admin
 * save writes to it. When it is not, nothing changes and the rest of the suite
 * runs exactly as before — `tests/e2e/admin-catalogue.spec.ts` fails loudly on
 * its own rather than being quietly skipped.
 *
 * `VERCEL_DEPLOY_HOOK_URL` IS FORCED EMPTY, and that is not tidiness. With a
 * real hook inherited from `.env`, the publish test would deploy the production
 * site — from a test run, on every push. Empty is also the state the test
 * asserts: publishing refuses when it is unconfigured.
 *
 * `reuseExistingServer` goes false in this mode for the same class of reason. A
 * preview server left running from ordinary work holds the LIVE credentials,
 * and reusing it would point tests that edit and publish at the client's real
 * catalogue. Refusing to start on an occupied port is a loud failure; reusing
 * that server is a silent catastrophe.
 */
const STACK_FILE = fileURLToPath(new URL('./.test-db.json', import.meta.url));
const stack: { url: string; anonKey: string; serviceKey: string } | null = existsSync(STACK_FILE)
  ? JSON.parse(readFileSync(STACK_FILE, 'utf8'))
  : null;

const testDbEnv: Record<string, string> = stack
  ? {
      SUPABASE_URL: stack.url,
      SUPABASE_ANON_KEY: stack.anonKey,
      SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey,
      CATALOGUE_SOURCE: 'postgres',
      VERCEL_DEPLOY_HOOK_URL: '',
      /*
       * Blanked for the same reason as the deploy hook. The enquiry tests
       * submit real forms, and a Resend key inherited from `.env` would post
       * them to the client's actual inbox on every run. Unconfigured mail is
       * also what tests/e2e/stack.ts's expected outcome assumes.
       */
      RESEND_API_KEY: '',
      ENQUIRY_TO_EMAIL: '',
    }
  : {};

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
      /*
       * The authenticated admin tests run once, on desktop only. They assert
       * what the database ends up holding rather than how anything looks, and
       * a second project running them concurrently would have two browsers
       * editing the same seeded product — an intermittent failure on the one
       * screen whose job is to be trusted about the data. The admin's layout
       * is covered on mobile by a11y.spec.ts and contrast.spec.ts.
       */
      testIgnore: /admin-catalogue\.spec\.ts/,
    },
  ],

  webServer: {
    command: 'npm run build && npm run preview',
    url: baseURL,
    reuseExistingServer: stack === null,
    env: testDbEnv,
    timeout: 240_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
