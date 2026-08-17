import { expect, test } from '@playwright/test';

/**
 * The redesigned home page.
 *
 * `src/pages/index.astro` renders Hero, Ticker, CategoryGrid and FeaturedLines
 * before the retained editorial sections. This file covers those four: the
 * headline (now real text, not artwork), the fifteen-category shelf and its
 * two honest empty tiles, and the featured strip's server-rendered cards plus
 * its client-side division filter — mouse, keyboard and no-JavaScript.
 *
 * motion.spec.ts covers the ticker's pause control and prefers-reduced-motion
 * separately; this file does not touch either.
 */

test.describe('the hero headline', () => {
  test('renders exactly one visible h1 with the real headline text', async ({ page }) => {
    await page.goto('/');

    // `h1`, not getByRole('heading', level: 1) — the assertion is about the
    // literal element, and the previous hero's h1 was present but sr-only, so
    // "exists" is not the bar here; "visible" is.
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toBeVisible();

    /*
     * `.textContent`, read directly, not Playwright's `toHaveText` — that
     * matcher collapses internal whitespace before comparing, which would
     * paper over exactly the defect this test exists to catch. The markup is
     * `Home and <br />industrial <br /><span>solutions.</span>`: a space was
     * added before each `<br />` because without it `textContent` runs the
     * words together ("Home andindustrial solutions.") — that has shipped
     * once already.
     */
    const text = await h1.evaluate((el) => el.textContent);
    expect(text).toBe('Home and industrial solutions.');
  });
});

test.describe('the hero carousel', () => {
  test('every slide is decorative, and the track carries a duplicate first', async ({ page }) => {
    await page.goto('/');

    // Six banners plus a seventh that repeats the first. The animation ends on
    // that duplicate at -600% and restarts at 0, which is invisible only
    // because the two frames are the same image — drop the repeat and the loop
    // either shows a blank frame or rewinds through five slides.
    const slides = page.locator('.hero__slide');
    await expect(slides).toHaveCount(7);
    await expect(page.locator('.hero__pip')).toHaveCount(6);

    // Decorative, exactly as the helmet it replaced was. These are marketing
    // posters whose content is baked-in text that alt cannot reproduce, and
    // every product they show is a real item in the catalogue below.
    const alts = await page.locator('.hero__slide img').evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).getAttribute('alt')),
    );
    expect(alts).toEqual(['', '', '', '', '', '', '']);
    await expect(page.locator('.hero__track')).toHaveAttribute('aria-hidden', 'true');
  });

  test('only the first slide is eager, so six posters cannot fight the LCP', async ({ page }) => {
    await page.goto('/');

    const loading = await page.locator('.hero__slide img').evaluateAll((els) =>
      els.map((el) => (el as HTMLImageElement).getAttribute('loading')),
    );
    expect(loading[0]).toBe('eager');
    expect(loading.slice(1)).toEqual(['lazy', 'lazy', 'lazy', 'lazy', 'lazy', 'lazy']);
  });

  test('auto-advancing motion has a pause mechanism that works without JavaScript', async ({
    page,
  }) => {
    await page.goto('/');

    // WCAG 2.2.2: motion that starts automatically and runs past five seconds
    // needs a pause. axe does not test for it — the same blind spot that left a
    // serious Label in Name failure on every product card at a green score.
    const toggle = page.locator('#hero-carousel-pause');
    const track = page.locator('.hero__track');

    await expect(track).toHaveCSS('animation-play-state', 'running');

    // Driven through the label, which is what a visitor actually clicks, rather
    // than by checking the input directly.
    await page.locator('.hero__pause').click();
    await expect(toggle).toBeChecked();
    await expect(track).toHaveCSS('animation-play-state', 'paused');

    // The pips have to stop with the track or the lit pip drifts away from the
    // slide it is meant to be reporting.
    await expect(page.locator('.hero__pip').first()).toHaveCSS('animation-play-state', 'paused');

    await page.locator('.hero__pause').click();
    await expect(track).toHaveCSS('animation-play-state', 'running');
  });

  test('the pause control names itself the same way it reads', async ({ page }) => {
    await page.goto('/');

    // 2.5.3 Label in Name: the accessible name must contain the visible label,
    // or a voice-control user saying "click Pause" cannot operate it.
    const name = await page.locator('#hero-carousel-pause').getAttribute('aria-label');
    expect(name?.toLowerCase()).toContain('pause');
    await expect(page.locator('.hero__pause')).toHaveText(/pause/i);
  });
});

test.describe('the category shelf', () => {
  test('lists fifteen categories with exactly one marked empty', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.cg__grid li')).toHaveCount(15);

    // Electrical Accessories stocks nothing. The design mockup filled its tile
    // with a borrowed product photo from another category — a picture in a
    // range that has no stock is a false claim, so it must render the
    // marked-empty state instead.
    //
    // This was 2 until 2026-08-17: Spill Control stocked nothing either, until
    // the campaign banners supplied a real seven-SKU range for it. The count is
    // asserted rather than the mere presence of an empty tile, so a category
    // quietly acquiring or losing stock fails here.
    await expect(page.locator('.cg__empty')).toHaveCount(1);
  });

  test('shows the catalogue-derived count on the Fans & Ventilation tile', async ({ page }) => {
    await page.goto('/');

    // Scoped to the one tile, not asserted as a bare string search on the
    // page — Body Protection legitimately shows "4 items" and a page-wide
    // search for that text would pass for the wrong reason.
    const fansTile = page
      .locator('.cg__grid li')
      .filter({ has: page.locator('.cg__name', { hasText: 'Fans & Ventilation' }) });
    await expect(fansTile).toHaveCount(1);

    // The design mockup hardcoded "4 items" here from the pre-datasheet
    // catalogue. The real count, from getCategories(), is 17 — this is the
    // assertion that would catch a copy-paste of the mockup's static array.
    await expect(fansTile.locator('.cg__count')).toHaveText('17 items');
  });
});

test.describe('featured lines', () => {
  test('server-renders eight cards, four per division', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.fl__grid li')).toHaveCount(8);
  });

  test('reveals the tab row and filters by division on click', async ({ page }) => {
    await page.goto('/');

    const tabs = page.locator('[data-featured-tabs]');
    const items = page.locator('.fl__grid li:not([hidden])');

    // Server-rendered with `hidden` on the tab row; the script removes it.
    // Asserting "visible" here is safe precisely because it is false first —
    // the row starts hidden and only becomes visible once the island runs.
    await expect(tabs).toBeVisible();

    await tabs.getByRole('button', { name: 'Electricals' }).click();
    // Four of the eight curated cards are Electricals by construction
    // (src/lib/featured.ts). Unfiltered is 8, so waiting on 4 here cannot
    // settle instantly against the pre-filter state.
    await expect(items).toHaveCount(4);

    await tabs.getByRole('button', { name: 'All' }).click();
    await expect(items).toHaveCount(8);
  });

  test('filters on Enter when a tab is activated by keyboard', async ({ page }) => {
    await page.goto('/');

    const tabs = page.locator('[data-featured-tabs]');
    await expect(tabs).toBeVisible();

    const items = page.locator('.fl__grid li:not([hidden])');
    const safetyTab = tabs.getByRole('button', { name: 'Safety' });

    // Keyboard activation of a <button>, not a click. This project's tab and
    // pill controls have a history of harnesses that never synthesised a
    // click from Enter on a real <button> element — Playwright does, so this
    // is the test that would have caught it.
    await safetyTab.focus();
    await page.keyboard.press('Enter');

    await expect(items).toHaveCount(4);
    await expect(safetyTab).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('featured lines without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows all eight cards and keeps the tab row hidden', async ({ page }) => {
    await page.goto('/');

    // The script that unhides the tab row and wires the filter never runs.
    // Showing a filter that cannot filter would be worse than showing none,
    // so all eight cards stay, unfiltered, and the tab row stays hidden
    // rather than sitting inert on the page.
    await expect(page.locator('.fl__grid li')).toHaveCount(8);
    await expect(page.locator('.fl__grid li[hidden]')).toHaveCount(0);
    await expect(page.locator('[data-featured-tabs]')).toBeHidden();
  });
});
