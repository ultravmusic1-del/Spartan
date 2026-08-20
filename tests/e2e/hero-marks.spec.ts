import { expect, test } from '@playwright/test';

/**
 * The client raised this against their own mockup: in the mobile comp the
 * bottom crop marks sit on top of the CTA buttons. Marks are decoration and the
 * CTAs are the conversion path, so this is not a taste question — it is
 * decoration landing on a tap target.
 *
 * BELOW 640px THE BOTTOM PAIR IS DROPPED RATHER THAN REPOSITIONED. At 375px the
 * CTAs go full-width and stacked, so the bottom corners of the hero are inside
 * the button column and there is nowhere to move a mark to; shifting it only
 * relocates the collision. A dropped mark passes by not existing, which is the
 * intended outcome — so this also asserts at least one mark is visible at every
 * width, otherwise deleting all four would read as a passing fix.
 *
 * `display: none` elements are filtered out rather than measured:
 * getBoundingClientRect returns an all-zero box for them, which sits at the
 * origin and would collide with nothing, quietly passing for the wrong reason.
 */
const WIDTHS = [375, 768, 1280];

type Box = { x: number; y: number; w: number; h: number };

const boxes = (els: Element[]): Box[] =>
  els
    .filter((e) => getComputedStyle(e).display !== 'none')
    .map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });

for (const width of WIDTHS) {
  test(`hero crop marks clear the CTAs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const marks = page.locator('.hero__mark');
    const ctas = page.locator('.hero__actions a');

    await expect(ctas.first()).toBeVisible();

    const markBoxes: Box[] = await marks.evaluateAll(boxes);
    const ctaBoxes: Box[] = await ctas.evaluateAll(boxes);

    expect(
      markBoxes.length,
      'every crop mark hidden would pass a bare non-overlap assertion',
    ).toBeGreaterThan(0);
    expect(ctaBoxes.length, 'the CTAs must be on screen for this to mean anything').toBeGreaterThan(
      0,
    );

    for (const m of markBoxes) {
      for (const c of ctaBoxes) {
        const overlaps = m.x < c.x + c.w && m.x + m.w > c.x && m.y < c.y + c.h && m.y + m.h > c.y;
        expect(
          overlaps,
          `a crop mark at (${Math.round(m.x)}, ${Math.round(m.y)}) ${m.w}x${m.h} overlaps ` +
            `a CTA at (${Math.round(c.x)}, ${Math.round(c.y)}) ${Math.round(c.w)}x${Math.round(c.h)} ` +
            `at ${width}px`,
        ).toBe(false);
      }
    }
  });
}
