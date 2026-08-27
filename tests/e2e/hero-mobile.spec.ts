/**
 * The hero's mobile layout — the three decisions taken on 2026-08-12.
 *
 * All of them are trades rather than fixes, which is why they need a test: each
 * one looks like a defect from one angle and is deliberate from another, and
 * nothing else in the suite would notice if a later change quietly undid one.
 * The reasoning is in `Hero.astro` and `docs/TRAPS.md`; this file asserts the
 * measurable half.
 *
 * Every test sets its own viewport rather than relying on the project's, because
 * two of the three are keyed on HEIGHT and the mobile project (Pixel 5, 393x851)
 * is tall enough to miss them entirely. A test that silently exercises the wrong
 * branch is worse than no test.
 */
import { expect, test, type Page } from '@playwright/test';

/** The primary CTA. The whole site converts on this one. */
const PRIMARY = '.hero__actions a[href="/catalogue"]';

/**
 * Wait for the hero's entrance to finish before measuring anything vertical.
 *
 * `hero-rise` and `hero-rise-lean` start at `translateY(16px)` and settle over
 * about 0.9 seconds. A bounding box read before they end is therefore up to
 * 16px LOWER than the layout, which is a quarter of the clearance the
 * above-the-fold tests assert. That is what made this file flaky rather than
 * wrong: under contention it fails on one project and passes on retry on the
 * other, which is exactly how CI reported it on 2026-08-27.
 *
 * These tests are claims about where the layout RESTS — "fully visible without
 * scrolling" — so a frame of the motion is the wrong thing to measure. This
 * waits for the layout, and asserts against it unchanged.
 *
 * INFINITE ANIMATIONS ARE EXCLUDED, and the exclusion is load-bearing: the home
 * page carries the category ticker and, when there is artwork, the carousel
 * track. Their `finished` promise never resolves, so awaiting the unfiltered
 * list would hang until the test timed out — a worse flake than the one being
 * fixed.
 */
async function heroSettled(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming();
      return timing != null && timing.iterations !== Infinity;
    });
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
  });
}

test.describe('the hero source order', () => {
  test('stacks headline, then the carousel, then CTAs', async ({ page }) => {
    await page.goto('/');

    /*
     * Below 1080px `.hero` is `display: block`, so DOM order IS paint order and
     * this is the layout. Asserted as document position rather than as
     * coordinates so it holds at every width — on desktop the stage is
     * absolutely positioned and the same order is a no-op.
     */
    const order = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('.hero h1, .hero__stage, .hero__actions')];
      return nodes.map((n) => (n.tagName === 'H1' ? 'headline' : n.className.split(' ')[0]));
    });

    expect(order).toEqual(['headline', 'hero__stage', 'hero__actions']);
  });
});

test.describe('the CTAs below 560px', () => {
  test('stack into a column of equal width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const actions = page.locator('.hero__actions');
    await expect(actions).toHaveCSS('flex-direction', 'column');

    /*
     * Wrapping in a row gave two rectangles of 221px and 157px with no shared
     * edge — the ragged step this rule exists to remove. Neither primitive
     * declares a width, so `align-items: stretch` is what makes them match;
     * asserting equality catches a width creeping onto either one.
     */
    const widths = await page.locator('.hero__actions a').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().width)),
    );
    expect(widths).toHaveLength(2);
    expect(widths[0]).toBe(widths[1]);
  });

  test('sit in a row above 560px, and do not stretch to the copy width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await expect(page.locator('.hero__actions')).toHaveCSS('flex-direction', 'row');

    // An earlier version stretched them across the copy's 660px cap, which
    // produced a 660px-wide button on a tablet and on a phone held sideways.
    const width = await page
      .locator(PRIMARY)
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThan(400);
  });
});

test.describe('short screens buy the primary CTA back by spending card', () => {
  /*
   * The commit that introduced this made a specific, falsifiable claim: with the
   * stage shrunk the primary CTA is fully visible without scrolling on both of
   * these. If a later change to spacing, the header, or the stage breaks that,
   * the trade has stopped paying for itself and somebody should re-take the
   * decision rather than discover it on a phone.
   *
   * The number moved from 58vw to 38vw on 2026-08-17 and the claim held: a 4:5
   * portrait card is ~24% taller than the landscape helmet stage it replaced at
   * the same width, and the carousel added a control row that WCAG 2.2.2 does
   * not allow us to drop to buy the space back. Measured on the 360x640, the
   * tighter of the two: the primary CTA's bottom edge lands at 621px against a
   * 640px fold, which is 19px of clearance where the helmet had 12px.
   *
   * IT BROKE ONCE, AND THIS IS THE ENTRY THAT SAYS SO. The hero header restyle
   * of 2026-08-23 — crest, three-line oblique headline, closing rule — spent
   * that clearance and put the edge at 646px, 6px under the fold. Nothing
   * caught it for four commits because the full suite could not run locally
   * (handoff.md §29); CI caught it on 2026-08-27. The fix trimmed two rhythm
   * margins on short screens in `Hero.astro` and restored the edge to 620px.
   * So this test has now done the job the comment above claims for it, once —
   * which is the argument for keeping it rather than relaxing it.
   */
  for (const size of [
    { width: 375, height: 667, name: 'iPhone SE' },
    { width: 360, height: 640, name: 'a 360-wide Android' },
  ]) {
    test(`"Browse catalogue" is above the fold on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/');
      await heroSettled(page);

      const box = await page.locator(PRIMARY).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    });

    test(`the banner band spans the column on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/');

      // Was "shrunk to 38vw", which pinned a card floating beside the copy. The
      // centred stack of 2026-08-20 makes the band full-width, so what is worth
      // checking is that it fills the column and does not overflow it — 20px of
      // --wrap-pad each side below 640px.
      const width = await page
        .locator('.hero__stage')
        .evaluate((el) => el.getBoundingClientRect().width);
      expect(width).toBeCloseTo(size.width - 40, 0);
    });
  }

  /*
   * "THE SLOT OPENS OUT TO 3:2 ON A PHONE" WAS HERE, AND ITS REMOVAL IS THE
   * MOST INSTRUCTIVE THING IN THIS FILE.
   *
   * It measured `.hero__slot` — the EMPTY band — opening from 4:1 to 3:2 below
   * 720px, and it existed as a pin so that "what does a phone do with a 4:1
   * banner" stayed visible rather than being discovered later. It could not
   * do that job. Banners returned on 2026-08-23, `.hero__slot` stopped
   * rendering, and the rule was never extended to `.hero__frame` — so the live
   * band has been **84px tall on a phone** ever since, while this test went on
   * passing against a test database with no banners in it.
   *
   * A pin that measures the state you are not in is not a weaker pin, it is the
   * absence of one wearing its clothes. The replacement is in
   * `tests/e2e/hero-carousel.spec.ts`: it measures `.hero__frame`, which is what
   * ships, and asserts the 4:1 that is actually live while naming it as the
   * client's open decision. Deleted rather than skipped — a permanently skipped
   * test is another thing that reads as coverage on a report.
   */
});
