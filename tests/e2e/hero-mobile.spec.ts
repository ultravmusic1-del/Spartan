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
  /** What the eye sees, top to bottom — not what the document says. */
  const painted = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('.hero h1, .hero__stage, .hero__actions')]
        .map((n) => ({
          key: n.tagName === 'H1' ? 'headline' : n.className.split(' ')[0],
          top: n.getBoundingClientRect().top,
        }))
        .sort((a, b) => a.top - b.top)
        .map((n) => n.key),
    );

  /*
   * THIS ASSERTS PAINT ORDER, AND USED TO ASSERT DOCUMENT ORDER. The change is
   * the point of the test now, so it is worth saying why.
   *
   * Since 2026-09-12 the two orders DIFFER on a phone: the band is lifted above
   * the buttons by `order` in a media query while staying after them in the
   * document, because `order` was the only way to do it without giving desktop
   * the same mismatch. A document-order assertion would therefore have gone on
   * passing while the phone layout was the exact opposite of what it claimed —
   * green, and describing nothing.
   */
  test('puts the campaign band above the CTAs on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    expect(await painted(page)).toEqual(['headline', 'hero__stage', 'hero__actions']);
  });

  test('and keeps it below them on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    /*
     * Unchanged since 2026-09-03, and the reason the phone change is a media
     * query rather than a new document order: the band closing the hero is what
     * keeps the primary CTA following the lede directly here.
     */
    expect(await painted(page)).toEqual(['headline', 'hero__actions', 'hero__stage']);
  });

  test('the document order never moved, so reading order did not either', async ({ page }) => {
    await page.goto('/');

    /*
     * `.hero__actions` was lifted out of `.hero__copy` to make the phone order
     * expressible — `order` only reorders siblings. It was the last thing in
     * `.hero__copy`, so it sits in exactly the same place in the document, and
     * a screen reader hears headline, lede, both CTAs, then the band's pause
     * control at every width.
     */
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.hero h1, .hero__stage, .hero__actions')].map((n) =>
        n.tagName === 'H1' ? 'headline' : n.className.split(' ')[0],
      ),
    );
    expect(order).toEqual(['headline', 'hero__actions', 'hero__stage']);
  });
});

test.describe('the division doors', () => {
  /*
   * Hidden on phones from 2026-09-12, kept on desktop. They repeat what section
   * 02 says one screen further down — both divisions, the same counted totals, a
   * link each — and on a phone they are two more full-width cards saying it
   * again. `display: none`, so the markup and every unit test that counts them
   * are untouched; a `toHaveCount` assertion cannot tell the difference, which
   * is why this measures the box instead.
   */
  test('are gone on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('.hero__doors')).toBeHidden();
    const boxes = await page
      .locator('.hero__door')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
    expect(boxes.every((h) => h === 0)).toBe(true);
  });

  test('and still open both divisions on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const doors = page.locator('.hero__door');
    await expect(doors).toHaveCount(2);
    await expect(doors.nth(0)).toBeVisible();
    await expect(doors.nth(1)).toBeVisible();
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

    test(`the banner band spans the whole screen on ${size.name}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto('/');

      /*
       * WAS "spans the column" — 20px of --wrap-pad each side — until
       * 2026-09-12, when the client asked for a more prominent band on the
       * phone. It escapes the wrap's padding instead of being cropped taller:
       * the 4:1 ratio is its own client decision, because the artwork carries a
       * headline and a QR code that a taller crop cuts off the sides
       * (docs/TRAPS.md). Width was the only lever that costs no artwork.
       *
       * Both halves matter. Edge to edge is the point, and NOT ONE PIXEL WIDER
       * is what stops a negative margin quietly handing the whole page a
       * sideways scroll — which is exactly how this technique usually fails.
       */
      const stage = await page
        .locator('.hero__stage')
        .evaluate((el) => { const b = el.getBoundingClientRect(); return { left: b.left, width: b.width }; });
      expect(stage.left).toBeCloseTo(0, 0);
      expect(stage.width).toBeCloseTo(size.width, 0);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
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
