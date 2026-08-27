import { expect, test, type Page } from '@playwright/test';

/**
 * The hero carousel, in a browser.
 *
 * WHAT IS HERE AND WHAT IS NOT. The carousel's MARKUP — slide and pip counts,
 * the loop duplicate, the empty alts, the eager first image, the derived clock,
 * and the empty-band branch — is covered by `src/components/sections/Hero.test.ts`,
 * which renders the component directly and needs no build, no Docker and no
 * database. What is left here is the half that markup cannot answer: whether
 * the thing actually stops when you press Pause.
 *
 * WHY THAT MATTERS MORE THAN IT LOOKS. The band auto-advances and runs well past
 * five seconds, so **WCAG 2.2.2 requires a control that stops it** — and axe
 * does not test for this. Between 2026-08-23, when the client enabled the first
 * banners, and 2026-08-27 there was NO test of any kind on that control: the
 * ones that existed asserted an empty band and passed against a test database
 * with no banners in it. This file and the container tests are its only guards.
 *
 * THE FIXTURE IS SEEDED, NOT ASSUMED. `npm run test:db:start` writes three
 * banners into the throwaway stack (`tools/seed-banners.mjs`), so `--full`
 * builds the carousel production is in. Nothing below hard-codes three: the
 * tests read the counts out of the DOM and assert the RELATIONSHIPS between
 * them, so the fixture can change size without touching a spec.
 */

const stage = (page: Page) => page.locator('.hero__stage');
const track = (page: Page) => page.locator('.hero__track');
const pips = (page: Page) => page.locator('.hero__pip');
const pauseLabel = (page: Page) => page.locator('.hero__pause');
const pauseInput = (page: Page) => page.locator('#hero-carousel-pause');

const playState = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationPlayState);

/**
 * Refuses rather than skips when the build has no banners.
 *
 * A spec that quietly passed against an empty band is the exact failure this
 * file was written to end — the same reasoning `admin-catalogue.spec.ts` uses
 * for the test database. If this throws, the stack was started without the
 * banner fixture: run `npm run test:db:start`.
 */
async function requireCarousel(page: Page) {
  await page.goto('/');
  const slides = await page.locator('.hero__slide').count();
  expect(
    slides,
    'the hero has no banners, so this build cannot exercise the carousel — ' +
      'run `npm run test:db:start`, which seeds the fixture (tools/seed-banners.mjs)',
  ).toBeGreaterThan(0);
}

test.describe('the carousel is what the build renders', () => {
  test('the band holds slides, pips and a pause control', async ({ page }) => {
    await requireCarousel(page);

    await expect(track(page)).toHaveCount(1);
    await expect(page.locator('.hero__slot')).toHaveCount(0);
    await expect(pauseLabel(page)).toHaveCount(1);

    /*
     * One more slide than pips: the last is a duplicate of the first so the
     * loop's reset lands on an identical frame. Asserted as a relationship
     * rather than as two numbers, so the fixture size is free to change.
     */
    const slideCount = await page.locator('.hero__slide').count();
    const pipCount = await pips(page).count();
    expect(pipCount).toBeGreaterThanOrEqual(2);
    expect(slideCount).toBe(pipCount + 1);
  });

  test('the track is actually animating before anything is pressed', async ({ page }) => {
    await requireCarousel(page);

    // The premise of every test below. If this is `paused` at rest, the pause
    // tests would pass while proving nothing.
    expect(await playState(page, '.hero__track')).toBe('running');
    expect(await playState(page, '.hero__pip')).toBe('running');
  });
});

/* ------------------------------------------------------------ WCAG 2.2.2 -- */

test.describe('the pause control', () => {
  /**
   * The requirement itself. Both have to stop TOGETHER — if only the track
   * stops, the lit pip carries on and drifts away from the visible slide, which
   * is a worse state than not pausing at all.
   */
  test('stops the track and the pips together', async ({ page }) => {
    await requireCarousel(page);

    await pauseLabel(page).click();
    await expect(pauseInput(page)).toBeChecked();

    expect(await playState(page, '.hero__track')).toBe('paused');
    expect(await playState(page, '.hero__pip')).toBe('paused');

    // Every pip, not just the first: they carry staggered delays and are
    // stopped by a selector that has to reach all of them.
    const states = await pips(page).evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).animationPlayState),
    );
    expect(states.every((s) => s === 'paused')).toBe(true);
  });

  test('starts it again, so the control is a toggle and not a one-way door', async ({ page }) => {
    await requireCarousel(page);

    await pauseLabel(page).click();
    expect(await playState(page, '.hero__track')).toBe('paused');

    await pauseLabel(page).click();
    await expect(pauseInput(page)).not.toBeChecked();
    expect(await playState(page, '.hero__track')).toBe('running');
    expect(await playState(page, '.hero__pip')).toBe('running');
  });

  test('is reachable and operable from the keyboard', async ({ page }) => {
    await requireCarousel(page);

    await pauseInput(page).focus();
    await expect(pauseInput(page)).toBeFocused();
    await page.keyboard.press('Space');

    await expect(pauseInput(page)).toBeChecked();
    expect(await playState(page, '.hero__track')).toBe('paused');
  });

  /**
   * The reason it is a checkbox read by `:has()` rather than an island. A pause
   * button that needs JavaScript to exist is no use to a visitor whose
   * JavaScript is off — and the animation runs for them regardless, so the
   * obligation does not go away with the script.
   */
  test('works with JavaScript disabled, because the motion does not need it', async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/');

    expect(await page.locator('.hero__slide').count()).toBeGreaterThan(0);
    expect(await playState(page, '.hero__track')).toBe('running');

    await pauseLabel(page).click();
    expect(await playState(page, '.hero__track')).toBe('paused');
    expect(await playState(page, '.hero__pip')).toBe('paused');

    await context.close();
  });

  /** 2.5.3 Label in Name: the accessible name has to start with the visible text. */
  test('its accessible name starts with the word on the control', async ({ page }) => {
    await requireCarousel(page);

    await expect(pauseLabel(page)).toHaveText('Pause');
    const name = await pauseInput(page).getAttribute('aria-label');
    expect(name?.startsWith('Pause')).toBe(true);
  });
});

/* ------------------------------------------------------- reduced motion -- */

test.describe('with prefers-reduced-motion', () => {
  /*
   * `contextOptions.reducedMotion`, NOT `reducedMotion`. On the Playwright
   * version pinned here `test.use({ reducedMotion: 'reduce' })` compiles and
   * does nothing — `motion.spec.ts` carries the full note. Written the wrong
   * way first, and the only reason it was noticed is that these assertions
   * failed: a test that emulated nothing would otherwise have measured the
   * ordinary page and passed, which is a green tick for a state never entered.
   */
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  /**
   * The carousel stops on slide one and the control goes with it. A pause
   * button for something already stopped is a lie about what it does, and it
   * would be the only thing in the hero that can take focus and do nothing.
   */
  test('stops the carousel and removes the control that would then be a lie', async ({ page }) => {
    await requireCarousel(page);

    const trackAnimation = await track(page).evaluate(
      (el) => getComputedStyle(el).animationName,
    );
    expect(trackAnimation).toBe('none');

    await expect(pauseLabel(page)).toBeHidden();
    await expect(page.locator('.hero__toggle')).toBeHidden();
  });

  /** The copy must not be stranded at opacity 0 by a cancelled entrance. */
  test('leaves the headline and the CTAs visible', async ({ page }) => {
    await requireCarousel(page);

    await expect(page.locator('.hero__title')).toBeVisible();
    await expect(page.locator('.hero__actions a[href="/catalogue"]')).toBeVisible();
    const opacity = await page
      .locator('.hero__title')
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(Number(opacity)).toBe(1);
  });
});

/* ------------------------------------------------ the unresolved decision -- */

test.describe('what a phone does with a 4:1 banner', () => {
  /**
   * ACCEPTED FAILURE — THIS PINS A DECISION, NOT A DESIRED OUTCOME. Read this
   * before "fixing" the number.
   *
   * The empty slot opens out from 4:1 to 3:2 below 720px, because at 375px a
   * 4:1 band is 84px tall — too short to read as a banner. That rule was written
   * on `.hero__slot` and **was never extended to `.hero__frame`**, so the moment
   * real banners were enabled the live band went back to 84px on a phone.
   * Measured 2026-08-27 against a build from the client's own database:
   * **335 x 84 at 375px wide**, with the posters' headline, phone number and QR
   * code unreadable at that size.
   *
   * **The client was shown that cost on 2026-08-27 and chose to leave it.** So
   * the band is decorative on a phone by decision: every product on it is
   * reachable in the catalogue below, and the <h1> and the two CTAs carry the
   * hero's meaning, which is why this costs presentation rather than a lead.
   *
   * DO NOT SILENTLY REVERSE IT, AND DO NOT DELETE THIS TEST. Reversing is the
   * client's call and there are exactly two honest ways: crop the frame to 3:2
   * with `object-fit: cover`, which fills the space and cuts the sides off the
   * artwork; or supply a second, phone-shaped crop per banner. One 2800 x 700
   * artwork cannot fill both shapes, so there is no third option that merely
   * makes the band taller.
   *
   * This asserts what ships so that a reversal breaks a test and gets read —
   * which is what the ORIGINAL pin was supposed to do and could not, because it
   * measured the empty slot production had already stopped rendering.
   */
  test('is still 4:1 on a phone, which is 84px tall and is the accepted trade', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await requireCarousel(page);

    const box = await page.locator('.hero__frame').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width / box!.height).toBeCloseTo(4, 1);
    expect(box!.height).toBeLessThan(100);
  });

  test('and 4:1 on desktop, where that is the intended shape', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await requireCarousel(page);

    const box = await page.locator('.hero__frame').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width / box!.height).toBeCloseTo(4, 1);
  });
});
