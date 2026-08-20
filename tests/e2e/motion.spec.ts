import { expect, test } from '@playwright/test';

/**
 * Motion on the home page: the ticker's pause control and the
 * prefers-reduced-motion branch across Hero, Ticker and Featured Lines.
 *
 * The pause mechanism is pure CSS — a `role="switch"` checkbox and a
 * `:has()` selector in Ticker.astro, no script. It exists because WCAG 2.2.2
 * (Pause, Stop, Hide) applies to the scrolling category band: it starts
 * automatically, moves, and runs well past five seconds.
 */

test.describe('the ticker pause switch', () => {
  /*
   * The control is now revealed by hover rather than shown permanently, and on
   * a touch screen it is not present at all — a client decision taken on
   * 2026-08-13 with the cost stated. Both tests below branch on the device's
   * real hover capability rather than on the project name, because that is the
   * thing the stylesheet actually keys on.
   */
  test('is absent on a touch screen, and the band keeps moving anyway', async ({ page }) => {
    await page.goto('/');

    const touch = await page.evaluate(() => matchMedia('(hover: none)').matches);
    test.skip(!touch, 'Pointer device — covered by the test below.');

    await expect(page.locator('.ticker__btn')).toBeHidden();
    await expect(page.locator('#ticker-pause')).toBeHidden();

    /*
     * Asserted deliberately, and it is not an endorsement. This is a WCAG 2.2.2
     * Level A failure held in place on purpose: moving content that runs past
     * five seconds with no mechanism to pause it. The assertion exists so the
     * failure is a recorded decision with a test naming it, rather than
     * something a later reader discovers and mistakes for an oversight — and so
     * that reversing it breaks a test and forces the decision to be retaken.
     */
    await expect(page.locator('.ticker__track')).toHaveCSS('animation-play-state', 'running');
  });

  test('is revealed by hover and by keyboard focus on a pointer device', async ({ page }) => {
    await page.goto('/');

    const hover = await page.evaluate(() => matchMedia('(hover: hover)').matches);
    test.skip(!hover, 'Touch screen — covered by the test above.');

    const btn = page.locator('.ticker__btn');

    // Present and laid out, but not shown: `opacity`, not `display`, so the
    // reveal cannot reflow the band. Playwright counts an opacity-0 element as
    // visible, so the computed value is what has to be read.
    await expect(btn).toHaveCSS('opacity', '0');

    await page.locator('.ticker').hover();
    await expect(btn).toHaveCSS('opacity', '1');

    // The keyboard route matters more than the pointer one: it is what keeps
    // this a mechanism for someone who never hovers anything.
    await page.mouse.move(0, 0);
    await expect(btn).toHaveCSS('opacity', '0');
    await page.locator('#ticker-pause').focus();
    await expect(btn).toHaveCSS('opacity', '1');
  });

  test('is exposed as a switch with a static accessible name that pauses the band', async ({
    page,
  }) => {
    await page.goto('/');

    const toggle = page.locator('#ticker-pause');
    const track = page.locator('.ticker__track');

    const hover = await page.evaluate(() => matchMedia('(hover: hover)').matches);
    test.skip(!hover, 'No control on a touch screen — see the first test.');

    await expect(toggle).toHaveAttribute('role', 'switch');
    await expect(toggle).not.toBeChecked();

    const nameBefore = await toggle.getAttribute('aria-label');

    // Running before the switch is touched — this has to be false first, or
    // toggling and reading "paused" afterwards would prove nothing.
    await expect(track).toHaveCSS('animation-play-state', 'running');

    /*
     * Keyboard, not a click on the label. WCAG 2.2.2 requires a *mechanism*;
     * a control reachable only by mouse is not one. The input is visually
     * hidden (opacity: 0, 1x1px) so it can receive focus without a visible
     * duplicate of the label, but it is still a real, focusable checkbox —
     * Space is its native toggle key.
     */
    await toggle.focus();
    await page.keyboard.press('Space');

    await expect(track).toHaveCSS('animation-play-state', 'paused');
    await expect(toggle).toBeChecked();

    /*
     * The accessible name must not move. A name that flips to "Play" against
     * a visible "Pause" caption is a WCAG 2.5.3 Label in Name failure — this
     * project shipped exactly that defect on every product card once. The
     * checked state here is a sighted-only cue (background/colour swap on
     * .ticker__btn); aria-label stays the fixed string describing what the
     * control does, not its current state.
     */
    const nameAfter = await toggle.getAttribute('aria-label');
    expect(nameAfter).toBe(nameBefore);
  });
});

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

  test('cancels the hero animations without stranding the copy, and hides the ticker control', async ({
    page,
  }) => {
    await page.goto('/');

    /*
     * THE HERO HAS NOTHING MOVING IN IT TO CANCEL, as of 2026-08-20.
     *
     * Three assertions used to sit here — the track and the pips resolving to
     * `animation-name: none`, the track resting at translateX(0) rather than
     * mid-slide, and the pause control hiding because a control that pauses
     * something already stopped is a lie about what it does.
     *
     * `.hero__glow` went first, with the white theme: a pulsing red bloom is a
     * dark-surface device that reads as a pink smudge on white. The track, the
     * pips and the pause went with the banners, which the client had deleted
     * because they are portrait and the slot is a 4:1 band.
     *
     * They are asserted ABSENT rather than dropped. A `toHaveCSS` against a
     * selector matching nothing is not a passing assertion, it is one that
     * cannot run — and dropping the lines would leave nothing to notice if a
     * carousel came back with no reduced-motion handling at all. That
     * restoration is a P1 item in BACKLOG.md, and this is the marker for it.
     */
    await expect(page.locator('.hero__glow')).toHaveCount(0);
    await expect(page.locator('.hero__track')).toHaveCount(0);
    await expect(page.locator('.hero__pip')).toHaveCount(0);
    await expect(page.locator('.hero__pause')).toHaveCount(0);

    // The title and actions use an entrance animation with `both` fill mode.
    // Cancelling that animation without also resetting opacity/transform
    // would stick them at the animation's 0%-keyframe (opacity: 0) forever —
    // Hero.astro's reduced-motion block sets opacity: 1 explicitly to avoid
    // exactly that.
    const title = page.locator('.hero__title');
    const actions = page.locator('.hero__actions');
    await expect(title).toBeVisible();
    await expect(title).toHaveCSS('opacity', '1');
    await expect(actions).toBeVisible();
    await expect(actions).toHaveCSS('opacity', '1');

    // A pause control for content that does not move is noise, not a
    // mechanism, so Ticker.astro removes it under reduced motion instead of
    // leaving it live.
    await expect(page.locator('.ticker__btn')).toBeHidden();

    /*
     * DELIBERATELY NOT ASSERTED: `.ticker__track`'s `animation-play-state`
     * under reduced motion.
     *
     * src/styles/global.css forces `animation-duration: 0.01ms !important`
     * and `animation-iteration-count: 1 !important` on every element here —
     * it does not touch `animation-name`, which is why the three assertions
     * above still work, but it does mean the ticker's own animation runs to
     * completion in 0.01ms instead of being cancelled. A play-state read
     * after that has already happened still computes as "running": the
     * animation finished, but nothing told the browser to call it paused, and
     * `animation-play-state: paused` cannot restart or re-flag an animation
     * that already completed. So "running" here is correct behaviour, not a
     * bug — asserting "paused" would fail against a page that is doing
     * exactly what it should.
     */
  });
});
