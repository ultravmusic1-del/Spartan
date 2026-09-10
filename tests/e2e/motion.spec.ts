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

  test('leaves every section visible and every number final without the motion layer', async ({
    page,
  }) => {
    await page.goto('/');
    // Under reduced motion the module does nothing: nothing is set to opacity
    // 0, and the proof strip keeps its server-rendered values from the start.
    const dim = await page.locator('.sec, .cg__grid > li, .sp__grid > li').evaluateAll(
      (els) => els.filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99).length,
    );
    expect(dim).toBe(0);
    await expect(page.locator('.hero__proof dd').first()).toHaveText('94');
  });

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

  test('the About drill stops working, on both halves of the motion', async ({ page }) => {
    await page.goto('/');
    await page.locator('#about').scrollIntoViewIfNeeded();

    /*
     * The drill's "in use" cue is THREE composed animations on three elements —
     * the press on `.about__rig`, the chatter on `.about__shake` and the
     * blurred chuck fading in on `.about__spin` — and `About.astro` turns them
     * off in three separate rules rather than one shared selector list, because
     * dropping a selector from a list takes the whole rule with it and the page
     * still looks perfectly correct (docs/TRAPS.md, and it has happened here
     * before with `.hero__glow`). Asserting each name is what makes that
     * mistake fail.
     */
    await expect(page.locator('.about__rig')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.about__shake')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.about__spin')).toHaveCSS('animation-name', 'none');

    /*
     * And the blurred chuck has to be GONE, not merely paused. Its resting
     * opacity is declared outside the keyframes, so `animation: none` leaves it
     * at 0 — but that stops being true the moment anyone gives the spin layer a
     * fill mode, and the drill would sit permanently out of focus for every
     * reduced-motion reader while looking perfectly fine to everybody else.
     */
    await expect(page.locator('.about__spin')).toHaveCSS('opacity', '0');
    await expect(page.locator('.about__still')).toBeVisible();
  });
});

test.describe('the motion layer', () => {
  /*
   * anime.js reveals sections as they scroll into view and counts the proof
   * strip up to its real totals. Two things it must never do: leave an
   * element invisible after it has been scrolled past, and end a count on a
   * number other than the server-rendered one.
   */
  test('reveals every section by the time the page has been scrolled through', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 400) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    // Reveals last 720ms plus a stagger; give the slowest one time to land.
    await page.waitForTimeout(1600);
    const dim = await page.locator('.sec, .cg__grid > li, .sp__grid > li, .faq__item').evaluateAll(
      (els) => els.filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99).length,
    );
    expect(dim).toBe(0);
  });

  test('counts the proof strip up to the counted totals, not past them', async ({ page }) => {
    await page.goto('/');
    await page.locator('.hero__proof').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800);
    // 14 categories, not the catalogue's 15: the strip counts what a buyer can
    // reach, and Electrical Accessories stocks nothing (docs/TRAPS.md).
    const values = await page.locator('.hero__proof dd').allTextContents();
    expect(values.map((v) => v.trim())).toEqual(['94', '14', '2015', 'India & China']);
  });
});

test.describe('the side rails', () => {
  /*
   * Desktop-only furniture for the margins: a scroll-spy section index on the
   * left and a brand line on the right, `display: none` below 1680px.
   */
  test('are absent on a phone and on a 1440 desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('[data-rail]')).toBeHidden();
  });

  test('list every numbered section as a working anchor, and follow the scroll', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    const rail = page.locator('[data-rail]');
    await expect(rail).toBeVisible();

    // One link per numbered section, in the same order and with the same
    // numbers the page's own numerals carry.
    const numerals = (await page.locator('.section-index').allTextContents()).map((t) => t.trim());
    const railNumbers = (await rail.locator('.rail__n').allTextContents()).map((t) => t.trim());
    expect(railNumbers).toEqual(numerals);

    // Every href resolves to a real element.
    const missing = await rail.locator('[data-rail-link]').evaluateAll((els) =>
      els.map((a) => (a as HTMLAnchorElement).dataset.railLink ?? '').filter((id) => !document.getElementById(id)),
    );
    expect(missing).toEqual([]);

    // The spy lights the section under the reader.
    await expect(rail.locator('[aria-current="true"]')).toHaveAttribute('data-rail-link', 'top');
    await page.locator('#about').scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const el = document.getElementById('about')!;
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 40);
    });
    await expect(rail.locator('[aria-current="true"]')).toHaveAttribute('data-rail-link', 'about');
  });

  /*
   * THE RAILS MUST NEVER PAINT OVER THE FOOTER. Both are `position: fixed` and
   * centred on the viewport, so at the bottom of the page they used to print
   * light grey mono type across the near-black footer. `railAbsorb()` masks
   * each one at the footer's own top edge.
   *
   * The assertion is the invariant rather than the mechanism: the lowest
   * painted pixel of a rail is its top plus `--rail-cut`, and that must not
   * pass the footer's top. Asserting the mask exists would pass just as well
   * with the cut frozen at a wrong value.
   */
  const railsClearTheFooter = async (page: import('@playwright/test').Page) => {
    return page.evaluate(() => {
      const footerTop = document.querySelector('footer')!.getBoundingClientRect().top;
      return [...document.querySelectorAll<HTMLElement>('[data-rail-absorb]')].map((rail) => {
        const box = rail.getBoundingClientRect();
        const cut = parseFloat(getComputedStyle(rail).getPropertyValue('--rail-cut'));
        return {
          side: rail.className.includes('left') ? 'left' : 'right',
          overshoot: Math.round(box.top + cut - footerTop),
          opacity: Number(getComputedStyle(rail).opacity),
        };
      });
    });
  };

  test('are eaten by the footer rather than printed over it', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('[data-rail]')).toBeVisible();

    const stops = await page.evaluate(() => {
      const max = document.body.scrollHeight - window.innerHeight;
      return [0, max - 520, max - 260, max];
    });

    for (const y of stops) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(260);
      for (const rail of await railsClearTheFooter(page)) {
        // 1px of slack for sub-pixel rounding in the mask stop.
        expect(rail.overshoot, `${rail.side} rail at scrollY ${y}`).toBeLessThanOrEqual(1);
      }
    }

    /*
     * And the left rail is GONE at the bottom, not merely clipped. It is a
     * numbered list: the mask eats it from the bottom up, which at the end of
     * the page removes exactly the entries the scroll-spy has lit, leaving an
     * index whose current item is the one you cannot see. The right rail is a
     * continuous line and stays — running under the footer edge is the effect.
     */
    const atBottom = await railsClearTheFooter(page);
    expect(atBottom.find((r) => r.side === 'left')!.opacity).toBe(0);
    expect(atBottom.find((r) => r.side === 'right')!.opacity).toBe(1);
  });

  test.describe('under reduced motion', () => {
    // `contextOptions.reducedMotion`, never the top-level key — docs/TRAPS.md.
    test.use({ contextOptions: { reducedMotion: 'reduce' } });

    test('the footer still absorbs them, because the overlap is a defect not a flourish', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);

      // `railAbsorb()` sits outside landing-motion's `if (!reduced)` branch.
      // Moving it inside would restore the bleed for exactly the readers who
      // asked for less, and every other test here would still pass.
      for (const rail of await railsClearTheFooter(page)) {
        expect(rail.overshoot, `${rail.side} rail`).toBeLessThanOrEqual(1);
      }
    });
  });
});
