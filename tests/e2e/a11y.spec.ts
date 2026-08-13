import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automated accessibility scanning.
 *
 * axe catches a minority of WCAG failures, so a clean run here is a floor and
 * not a certificate — the contrast contract in handoff.md §3, the 44px touch
 * targets and the focus behaviour in enquiry.spec.ts are the rest of it.
 *
 * The tags are the ones the project is held to: WCAG 2.0 A and AA plus the
 * 2.1 AA additions. Best-practice rules are deliberately not included; they are
 * advice, and a suite that fails on advice gets loosened.
 *
 * IF A COLOUR-CONTRAST VIOLATION APPEARS HERE, DO NOT RELAX THIS TEST.
 *
 * ---------------------------------------------------------------------------
 * RESOLVED — this block previously documented a colour-contrast defect that
 * failed these tests on `/`, `/catalogue`, `/enquiry`, `/electricals`,
 * `/safety`, `/why-spartan` and `/industries`. Kept because the mistake behind
 * it is easy to make again.
 *
 * handoff.md §3 recorded "red on black 4.65:1 — passes AA at any size" and
 * generalised it to "on dark, red is fine at any size". That measurement was
 * taken against `--color-black` (#08080a) only. The site has three dark
 * surfaces, and brand red does not clear AA on the other two:
 *
 *   #eb2927 on #08080a (--color-black)  4.65:1  passes
 *   #eb2927 on #0e0e11 (--color-panel)  4.48:1  FAILS  (AA needs 4.5:1)
 *   #eb2927 on #151519 (--color-card)   4.23:1  FAILS
 *
 * Fixed by adding `--color-red-light: #ef3a38` (5.08 / 4.89 / 4.62:1 on the
 * three surfaces) and using it for small red TEXT on dark. `--color-red` is
 * unchanged and remains the colour for large text, icons, rules, borders and
 * decorative fills. `design/direction-b-forge.html` still has the original
 * failure — it came in with the approved design — so that file is not a
 * reference for this particular pairing.
 *
 * AXE HAS A BLIND SPOT HERE. It reported the 11px and 11.5px labels but never
 * flagged `.en td` in En388Table.astro — 16px/800, which is 12pt bold and so
 * still normal-size text by WCAG — at 4.48:1 on `--color-panel` inside the
 * home Spotlight. That one was found by measuring the rendered colour against
 * the resolved background in the browser. A clean run here is a floor, not a
 * certificate; re-measure rather than trusting the scan.
 * ---------------------------------------------------------------------------
 */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

/**
 * One of each page type, plus every page the contrast audit above found a
 * violation on. The list is chosen by what the site is, not by what currently
 * passes — trimming it to keep the suite green would be the same mistake as
 * loosening the assertion.
 */
const PATHS = [
  '/',
  '/catalogue',
  '/catalogue/hand-protection',
  '/catalogue/spill-control',
  '/products/grip-guard-gp5',
  '/enquiry',
  '/contact',
  '/about',
  '/404',
  '/electricals',
  '/safety',
  '/why-spartan',
  '/industries',
  /*
   * The only admin surface axe can reach. Every other `/admin` route is behind
   * the session guard and CI holds no credentials, so this list can never cover
   * the inbox, the detail view or the demand report — a real gap, recorded in
   * handoff.md §13 rather than papered over. `/admin/login` is worth scanning
   * on its own account: it is a form an operator uses daily, it renders an
   * error state, and AdminLayout is a completely separate stylesheet from the
   * public site, so nothing verified about the pages above says anything at all
   * about it.
   */
  '/admin/login',
];

for (const path of PATHS) {
  test(`${path} has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    // The catalogue filter bar and the enquiry buttons are inert until they
    // hydrate, and an inert control is a different tree from a live one. Scan
    // the live one.
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    expect(summarise(results.violations)).toEqual([]);
  });
}

/**
 * The drawer is a modal dialog rendered only while open, so a scan of the page
 * behind it sees none of it — including the aria-modal container that is
 * supposed to hide everything else.
 */
test('the open enquiry drawer has no detectable accessibility violations', async ({ page }) => {
  await page.addInitScript(() =>
    window.localStorage.setItem(
      'spartan.enquiry.v1',
      JSON.stringify([
        { slug: 'grip-guard-gp1', name: 'Grip Guard GP1', qty: 2, note: '' },
        { slug: 'chem-guard', name: 'Chem Guard', qty: 1, note: 'Size 9' },
      ]),
    ),
  );

  await page.goto('/catalogue/hand-protection');
  const badge = page.locator('button.eq-badge');
  await expect(badge).toBeVisible();
  await badge.click();
  await expect(page.locator('[role="dialog"].eq-drawer__panel')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(summarise(results.violations)).toEqual([]);
});

/** The mobile navigation panel is the site's other modal, and equally invisible when shut. */
test('the open mobile navigation has no detectable accessibility violations', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'The trigger only exists below 1080px.');

  // Hosted on a page that is itself clean, so what this reports is the panel
  // and not the contrast defect on the page behind it.
  await page.goto('/catalogue/spill-control');
  await page.locator('.nav__mobile button').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();

  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(summarise(results.violations)).toEqual([]);
});

/**
 * `toEqual([])` on the raw violations prints a wall of axe internals on failure.
 * This keeps the assertion exactly as strict — an empty array either way — and
 * makes the report say which rule, which element and, for contrast, the measured
 * ratio, which is the number that decides what the fix is.
 */
function summarise(violations: { id: string; nodes: { target: unknown[]; failureSummary?: string }[] }[]) {
  return violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      rule: violation.id,
      element: node.target.join(' '),
      detail: node.failureSummary?.replace(/\s+/g, ' ').trim(),
    })),
  );
}
