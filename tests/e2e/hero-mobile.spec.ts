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
import { expect, test } from '@playwright/test';

/** The primary CTA. The whole site converts on this one. */
const PRIMARY = '.hero__actions a[href="/catalogue"]';

test.describe('the hero source order', () => {
  test('stacks headline, then helmet, then CTAs', async ({ page }) => {
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

test.describe('short screens buy the primary CTA back by spending helmet', () => {
  /*
   * The commit that introduced this made a specific, falsifiable claim: with the
   * stage shrunk to 58vw the primary CTA is fully visible without scrolling on
   * both of these. If a later change to spacing, the header, or the stage breaks
   * that, the trade has stopped paying for itself and somebody should re-take
   * the decision rather than discover it on a phone.
   */
  for (const size of [
    { width: 375, height: 667, name: 'iPhone SE' },
    { width: 360, height: 640, name: 'a 360-wide Android' },
  ]) {
    test(`"Browse catalogue" is above the fold on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/');

      const box = await page.locator(PRIMARY).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(size.height);
    });

    test(`the stage is shrunk to 58vw on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/');

      const width = await page
        .locator('.hero__stage')
        .evaluate((el) => el.getBoundingClientRect().width);
      expect(width).toBeCloseTo(size.width * 0.58, 0);
    });
  }

  test('a tall phone keeps the full-size helmet', async ({ page }) => {
    // Keyed on height, so 390x844 has the vertical budget and pays nothing.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const width = await page
      .locator('.hero__stage')
      .evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeCloseTo(390 * 0.76, 0);
  });
});
