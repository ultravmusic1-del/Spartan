import { expect, test } from '@playwright/test';

/**
 * Motion on the home page: the prefers-reduced-motion branch across the hero.
 *
 * THE CATEGORY TICKER LEFT THE LANDING PAGE ON 2026-09-03 and its pause-switch
 * tests went with it — the band was a second moving thing above the fold and
 * every category it linked is a tile in the catalogue section now. The
 * carousel's own pause control is covered in hero-carousel.spec.ts.
 */

test.describe('prefers-reduced-motion', () => {
  /*
   * `reducedMotion` is not a top-level TestOptions field on the Playwright
   * version pinned here (1.62.1) — only `contextOptions.reducedMotion` is;
   * `test.use({ reducedMotion: 'reduce' })` compiles (fixtures accept extra
   * keys) but is silently discarded, so `matchMedia('(prefers-reduced-motion:
   * reduce)').matches` stays false and every assertion below fails against a
   * page that never entered the reduced-motion branch. Verified empirically
   * against this install before writing the assertions around it.
   */
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('cancels the hero animations without stranding the copy', async ({
    page,
  }) => {
    await page.goto('/');

    /*
     * THE CAROUSEL IS BACK AND ITS REDUCED-MOTION BEHAVIOUR MOVED, 2026-08-27.
     *
     * This block used to assert the track, the pips and the pause control
     * ABSENT — a marker left when the client deleted the six posters on
     * 2026-08-20, saying plainly that a carousel returning with no
     * reduced-motion handling would have nothing to notice it.
     *
     * The marker outlived its usefulness in the worst way. Banners came back on
     * 2026-08-23 and these three lines went on passing anyway, because the test
     * database had none in it — so the assertions that existed to guard a
     * restoration were quietly guarding a state production had already left.
     *
     * The restored coverage is in `tests/e2e/hero-carousel.spec.ts`, which
     * asserts the track and the pips resolving to `animation-name: none` under
     * reduced motion and the control hiding with them, against a build whose
     * banners are seeded rather than accidental. `.hero__glow` stays asserted
     * absent here because that element is genuinely gone: a pulsing red bloom
     * was a dark-surface device that read as a pink smudge on white.
     */
    await expect(page.locator('.hero__glow')).toHaveCount(0);

    // The title and actions use an entrance animation with `both` fill mode.
    // Cancelling that animation without also resetting opacity/transform
    // would stick them at the animation's 0%-keyframe (opacity: 0) forever —
    // Hero.astro's reduced-motion block sets opacity: 1 explicitly to avoid
    // exactly that.
    for (const sel of ['.hero__title', '.hero__lede', '.hero__actions', '.hero__doors', '.hero__proof']) {
      const el = page.locator(sel);
      await expect(el).toBeVisible();
      await expect(el).toHaveCSS('opacity', '1');
    }

  });
});
