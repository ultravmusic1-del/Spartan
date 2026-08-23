/**
 * Whether this run has a database behind it, and what that means for the
 * enquiry endpoint's answer.
 *
 * NOT A SPEC FILE — Playwright only loads `*.spec.ts` from `testDir`, so this
 * sits beside them without being collected.
 *
 * `npm run test:db:start` brings up a throwaway Supabase stack and writes
 * `.test-db.json`; `playwright.config.ts` then hands its credentials to the
 * preview server. That is what the authenticated admin tests need, and it also
 * changes an answer three other tests assert on: with Postgres reachable, a
 * submitted enquiry is genuinely RECORDED, where before it was recorded
 * nowhere.
 *
 * SO THE EXPECTED OUTCOME IS DERIVED FROM THE CONFIGURATION RATHER THAN PINNED,
 * and both branches are asserted in full. The alternative was to relax those
 * assertions to accept either answer, which would have deleted the property
 * they exist for: the response has to describe what actually happened to the
 * enquiry, and a test that accepts both answers cannot tell a correct one from
 * a lie. `src/lib/enquiry-outcome.test.ts` still covers all nine channel
 * combinations directly, including the unconfigured one, without a database.
 *
 * `delivered` is false in both branches because no run of this suite ever has
 * mail credentials — playwright.config.ts blanks them, so a test can never send
 * a real notification to the client's inbox.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const TEST_DB_UP = existsSync(fileURLToPath(new URL('../../.test-db.json', import.meta.url)));

export const ENQUIRY_OUTCOME = {
  ok: true,
  recorded: TEST_DB_UP,
  delivered: false,
} as const;
