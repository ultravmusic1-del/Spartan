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
 * KNOWN OPEN DEFECT — these tests fail on `/`, `/catalogue`, `/enquiry`,
 * `/electricals`, `/safety`, `/why-spartan` and `/industries`, and they are
 * right to.
 *
 * handoff.md §3 records "red on black 4.65:1 — passes AA at any size" and
 * generalises it to "on dark, red is fine at any size". That measurement was
 * taken against `--color-black` (#08080a) only. The site has three dark
 * surfaces, and brand red does not clear AA on the other two:
 *
 *   #eb2927 on #08080a (--color-black)  4.65:1  passes
 *   #eb2927 on #0e0e11 (--color-panel)  4.47:1  FAILS  (AA needs 4.5:1)
 *   #eb2927 on #151519 (--color-card)   4.23:1  FAILS
 *
 * Five components put small bold red text on those two surfaces:
 *
 *   .eyebrow        Eyebrow.astro           11px/700 on --color-panel   4.47:1
 *   .tile__count    CategoryTile.astro      11px/700 on --color-card    4.23:1
 *   .card__variant  ProductCard.astro     11.5px/700 on --color-card    4.23:1
 *   .ind__count     industries.astro        11px/700 on --color-card    4.23:1
 *   .ef-field__req  enquiry.astro           11px/700 on --color-card    4.23:1
 *
 * CategoryTile.astro even carries the wrong figure in a comment ("Red on
 * --color-card measures 4.65:1"); that is the black number.
 *
 * It is not fixed here because every fix is a brand decision and none of them
 * is local: (a) a lighter red — there is no such token, all four reds are at or
 * below brand red, so it means adding one; (b) dropping red for these labels in
 * favour of --color-grey-lt, which changes the approved comp's accent system;
 * (c) moving these components onto --color-black, which changes the surface
 * system. `design/direction-b-forge.html` has the same failure, so it came in
 * with the approved design rather than with the implementation.
 *
 * Task 16's brief is explicit that a violation needing a design decision is
 * escalated rather than papered over, and its scope bars edits to
 * `src/styles/tokens.css`. So the test stays strict and the defect stays
 * visible. It is a launch blocker for Task 17.
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
