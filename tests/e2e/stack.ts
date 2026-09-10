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
import { expect } from '@playwright/test';

export const TEST_DB_UP = existsSync(fileURLToPath(new URL('../../.test-db.json', import.meta.url)));

export const ENQUIRY_OUTCOME = {
  ok: true,
  recorded: TEST_DB_UP,
  delivered: false,
} as const;

/** A v4 UUID — what `recordEnquiry` returns as the row's id. */
const REFERENCE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Assert the enquiry endpoint's whole response body.
 *
 * WHY THIS IS A FUNCTION AND NOT ANOTHER OBJECT TO `toEqual`. `reference` is
 * the row's own id, so it exists only when a row was written and its value is
 * different on every submission — it cannot be a literal in `ENQUIRY_OUTCOME`
 * the way the three booleans can. Splitting it off keeps the rest of the body
 * asserted EXHAUSTIVELY, which is the property this module exists for: a field
 * silently appearing in or vanishing from the contract is what the two clients
 * key their honesty off, and `toMatchObject` would have let exactly that
 * through.
 *
 * IT IS ALSO THE BUG THIS FILE SHIPPED WITH. `feat(enquiry): the success screen
 * becomes a receipt` (da32ce3, 2026-08-30) added `reference` to the response
 * and did not come here, so every run WITH a database saw a fourth key and
 * failed the exhaustive compare — while every run without one passed, because
 * no row means no reference. That is 18 red CI runs and a green local suite
 * from the same commit. Docker does not run on the machine this is developed
 * on, so `--full` is CI-only and the branch below was never executed locally.
 *
 * The presence of the reference is now part of the contract rather than an
 * exception to it: with a row there must be one and it must be a real id;
 * without a row there must be none, because a reference that resolves to
 * nothing is the "reported as sent when it was not" the endpoint is built to
 * avoid.
 */
export function expectEnquiryBody(body: unknown): void {
  const { reference, ...rest } = (body ?? {}) as Record<string, unknown>;

  expect(rest).toEqual(ENQUIRY_OUTCOME);

  if (TEST_DB_UP) expect(String(reference)).toMatch(REFERENCE);
  else expect(reference).toBeUndefined();
}
