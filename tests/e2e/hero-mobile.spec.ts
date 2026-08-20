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

  test('the slot opens out to 3:2 on a phone, not the 4:1 it holds on desktop', async ({
    page,
  }) => {
    // 2800 x 700 is a 4:1 band, and the slot reserves exactly the shape it will
    // receive — but at 375px wide that is 84px tall, too short to read as a
    // banner or to hold its own label. The mobile mockup draws it near 3:2 and
    // that is what ships below 720px.
    //
    // This is a real tension rather than a detail, which is why it is pinned:
    // one 4:1 artwork cannot fill both, so when banners arrive either the phone
    // letterboxes them or a second crop is supplied. Nothing is cropped today
    // because the slot is empty.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const phone = await page.locator('.hero__slot').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    });
    expect(phone).toBeCloseTo(1.5, 1);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const desktop = await page.locator('.hero__slot').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.width / r.height;
    });
    expect(desktop).toBeCloseTo(4, 1);
  });
});
