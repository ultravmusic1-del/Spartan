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

test.describe('the hero banner band', () => {
  /*
   * THE COVERAGE THAT USED TO BE HERE HAS MOVED, IN TWO DIRECTIONS.
   *
   * Two tests sat here asserting the band was EMPTY — no slides, no pips, no
   * pause control. They were honest when written on 2026-08-20, when the client
   * had just had the six portrait posters deleted. They stopped being honest on
   * 2026-08-23 when banners were uploaded again, and **nothing noticed for four
   * days**, because `--full` builds against a test database whose banner table
   * was empty. Green on a state production had left.
   *
   * Markup — slide and pip counts, the loop duplicate, the empty alts, the
   * eager first image, and the empty-band branch itself — is now in
   * `src/components/sections/Hero.test.ts`, which renders the component with
   * whatever banner list it is handed and so covers BOTH states in one run,
   * with no build and no database.
   *
   * Behaviour that needs a browser — the pause control actually stopping the
   * animation, WCAG 2.2.2 — is in `tests/e2e/hero-carousel.spec.ts`, against a
   * seeded fixture rather than an accident of configuration.
   *
   * What is left here is the home page's own concern: that the band is on the
   * page, before the shelf, and silent.
   */
  test('is present in the hero, above the category shelf', async ({ page }) => {
    await page.goto('/');

    const stage = page.locator('.hero__stage');
    await expect(stage).toBeVisible();

    // Either state passes here — this file does not own which one the build is
    // in, only that the band exists and comes before the shelf.
    const band = await stage.evaluate((el) => ({
      hasCarousel: !!el.querySelector('.hero__track'),
      hasSlot: !!el.querySelector('.hero__slot'),
    }));
    expect(band.hasCarousel || band.hasSlot).toBe(true);

    const shelfFollows = await page.evaluate(() => {
      const s = document.querySelector('.hero__stage');
      const shelf = document.querySelector('.cg__grid');
      if (!s || !shelf) return false;
      return Boolean(s.compareDocumentPosition(shelf) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(shelfFollows).toBe(true);
  });

  /**
   * The band carries marketing posters whose content is baked-in text that alt
   * cannot reproduce, and every product on them is in the catalogue below — so
   * it is decorative in either state and must not be announced. The <h1> and
   * the two CTAs carry the hero's meaning.
   */
  test('is decorative in whichever state it is in, so it is not announced', async ({ page }) => {
    await page.goto('/');

    const hidden = await page.evaluate(() => {
      const el = document.querySelector('.hero__track') ?? document.querySelector('.hero__slot');
      return el?.getAttribute('aria-hidden');
    });
    expect(hidden).toBe('true');

    // The mockup's "or browse files" affordance is never rendered — it would be
    // a link that does nothing.
    await expect(page.getByText(/browse files/i)).toHaveCount(0);
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
