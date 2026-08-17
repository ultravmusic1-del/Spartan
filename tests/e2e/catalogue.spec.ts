import { expect, test, type Page } from '@playwright/test';

/**
 * Catalogue coverage — the 96 static pages.
 *
 * Everything here runs against the built output (see playwright.config.ts), so
 * what is asserted is what would deploy. The two things this file exists to
 * protect are both cases where a plausible "improvement" would be a lie:
 *
 *  - the remaining expanding category must stay empty and say so, rather than
 *    borrow a product from somewhere else;
 *  - Chem Guard's EN 388 tear level is a printed `0`, and `0` and `X` are
 *    different claims about a glove. Collapsing them would misreport a safety
 *    rating.
 *
 * Spill Control was one of two empty categories until 2026-08-17, when the
 * campaign banners supplied a real seven-SKU range for it. Electrical
 * Accessories is now the only one, and the reason it is still empty is
 * unchanged: the brochure has nothing to put in it (handoff.md §6).
 */

// 72 from the brochure + 13 from the datasheet PDFs (7 industrial fans, 3
// portable air coolers, 3 consumer fans) + 10 from the campaign banners.
const TOTAL_PRODUCTS = 94;
const TOTAL_CATEGORIES = 15;

/*
 * Named rather than inline, because the combined-filter test below compares
 * three of these against each other and the last time they drifted apart the
 * test kept passing while asserting nothing (see its own note). Both are facts
 * about `src/data/products.json`; if either changes, that test's arithmetic has
 * to be re-derived rather than nudged.
 */
const HAND_PROTECTION = 12;
/** Of the 9 products matching "leather", 3 are in Hand Protection. */
const LEATHER_IN_HAND_PROTECTION = 3;

/** The filter island is `client:idle` and ships inert; this is it becoming live. */
async function filtersReady(page: Page) {
  await expect(page.locator('.cf')).not.toHaveClass(/cf--pending/);
}

test.describe('catalogue index', () => {
  test('every category tile links to a page that returns 200', async ({ page, request }) => {
    await page.goto('/catalogue');

    const tiles = page.locator('li[data-category-tile] a');
    await expect(tiles).toHaveCount(TOTAL_CATEGORIES);

    const hrefs = await tiles.evaluateAll((links) =>
      links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
    );

    // Every tile points somewhere distinct under /catalogue/.
    expect(new Set(hrefs).size).toBe(TOTAL_CATEGORIES);
    for (const href of hrefs) expect(href).toMatch(/^\/catalogue\/[a-z0-9-]+$/);

    const statuses = await Promise.all(
      hrefs.map(async (href) => [href, (await request.get(href)).status()] as const),
    );
    expect(statuses).toEqual(hrefs.map((href) => [href, 200]));
  });

  test('every product is server-rendered and the filter bar hydrates', async ({ page }) => {
    await page.goto('/catalogue');

    await expect(page.locator('li[data-product]')).toHaveCount(TOTAL_PRODUCTS);
    await filtersReady(page);
    await expect(page.locator('.cf__count')).toHaveText(
      `Showing ${TOTAL_PRODUCTS} of ${TOTAL_PRODUCTS} products`,
    );
  });

  /*
   * Search narrows the same server-rendered DOM the division and category
   * controls do. `searchProducts` in catalog.ts and this box share one rule
   * (src/lib/search.ts), baked into each card's `data-search` at build time —
   * so these are also the check that the two routes agree. A product findable
   * one way and not the other reads to a buyer as missing stock.
   */
  test('search narrows by name and by printed specification', async ({ page }) => {
    await page.goto('/catalogue');
    await filtersReady(page);

    const visible = page.locator('li[data-product]:not([hidden])');
    const search = page.getByLabel('Search', { exact: true });

    /*
     * Wait on the count line, not on a product being visible.
     *
     * "the safety-helmets card is visible" is already true of the unfiltered
     * page — it is one of the 72 — so it settles instantly and the count read
     * after it can still be the unfiltered 72. The status line is the only
     * assertion here that is false before the filter applies and true after.
     */
    const count = page.locator('.cf__count');
    const unfiltered = `Showing ${TOTAL_PRODUCTS} of ${TOTAL_PRODUCTS} products`;

    await search.fill('helmet');
    await expect(count).not.toHaveText(unfiltered);
    await expect(
      page.locator('li[data-product]:not([hidden]) a[href="/products/safety-helmets"]'),
    ).toHaveCount(1);
    const forHelmet = await visible.count();
    expect(forHelmet).toBeGreaterThan(0);
    expect(forHelmet).toBeLessThan(TOTAL_PRODUCTS);

    // A spec value, not a name — the term appears in no product title, so a
    // name-only search would return nothing here.
    await search.fill('polycarbonate');
    await expect(count).not.toHaveText(unfiltered);
    await expect(count).not.toHaveText(`Showing 0 of ${TOTAL_PRODUCTS} products`);
    expect(await visible.count()).toBeGreaterThan(0);

    /*
     * The variant label, which is the only thing telling the two ear muffs
     * apart: the difference appears in no other field. Asserting the 20dB one
     * is *gone* is the point — it is visible before the filter applies, so this
     * cannot pass on an unsettled page the way "the 25dB one is here" could.
     */
    await search.fill('NRR 25');
    await expect(
      page.locator('li[data-product]:not([hidden]) a[href="/products/ear-muff-nrr-20db"]'),
    ).toHaveCount(0);
    await expect(
      page.locator('li[data-product]:not([hidden]) a[href="/products/ear-muff-nrr-25db"]'),
    ).toHaveCount(1);

    await search.fill('');
    await expect(visible).toHaveCount(TOTAL_PRODUCTS);
  });

  /*
   * FIXED 2026-08-17. This test had been failing since `d7a36a9` added PVC Gloves
   * and took Hand Protection from 11 products to 12. The count above was updated
   * to 12 and the two `11`s below were not, which broke it twice over: the
   * status-line wait became a no-op — it waited for the line not to read
   * "Showing 11", which was already true at 12, so it settled instantly and the
   * count was read before the search had applied — and the bound then compared
   * the unfiltered 12 against `< 11`.
   *
   * It is rewritten rather than renumbered, because "glove" could never have
   * tested what this test claims to. All four of its matches are in Hand
   * Protection, so a search that ignored the category filter completely would
   * return the same four and pass.
   */
  test('search combines with the category filter rather than replacing it', async ({ page }) => {
    await page.goto('/catalogue');
    await filtersReady(page);

    const visible = page.locator('li[data-product]:not([hidden])');

    await page.locator('#cf-category').selectOption('hand-protection');
    await expect(visible).toHaveCount(HAND_PROTECTION);

    /*
     * "leather" is chosen because it SPANS categories: 9 products match it and
     * only 3 are in Hand Protection. That is what makes the three outcomes
     * distinguishable, and therefore what makes this test able to fail.
     *    3 → the filters combine, which is the promise
     *    9 → the search replaced the category filter
     *   12 → the category filter replaced the search
     */
    await page.getByLabel('Search', { exact: true }).fill('leather');

    // False before the search applies — the line reads 12 at this point — and
    // true after. `toHaveCount` then retries, so nothing is read off an
    // unsettled page.
    await expect(page.locator('.cf__count')).not.toHaveText(
      `Showing ${HAND_PROTECTION} of ${TOTAL_PRODUCTS} products`,
    );
    await expect(visible).toHaveCount(LEATHER_IN_HAND_PROTECTION);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(visible).toHaveCount(TOTAL_PRODUCTS);
  });

  /*
   * The two empty states say different things and only one of them is about
   * Spartan's range. Telling a buyer "no products in this range yet" because
   * their search term missed would be a claim about the catalogue that is not
   * true.
   */
  test('a search that matches nothing says so, and does not blame the range', async ({ page }) => {
    await page.goto('/catalogue');
    await filtersReady(page);

    await page.getByLabel('Search', { exact: true }).fill('zzzznotaproduct');

    await expect(page.locator('li[data-product]:not([hidden])')).toHaveCount(0);
    await expect(page.locator('[data-product-none-search]')).toBeVisible();
    await expect(page.locator('[data-product-none-search]')).toContainText('Nothing matches');
    await expect(page.locator('[data-product-none]')).toBeHidden();
    await expect(page.locator('.cf__count')).toHaveText(`Showing 0 of ${TOTAL_PRODUCTS} products`);
  });

  test('an empty range still blames the range, not the search', async ({ page }) => {
    await page.goto('/catalogue');
    await filtersReady(page);

    // Electrical Accessories is the only category with no published products.
    await page.locator('#cf-category').selectOption('electrical-accessories');

    await expect(page.locator('[data-product-none]')).toBeVisible();
    await expect(page.locator('[data-product-none]')).toContainText('No products in this range yet');
    await expect(page.locator('[data-product-none-search]')).toBeHidden();
  });

  test('filters narrow the visible products and clearing restores them all', async ({ page }) => {
    await page.goto('/catalogue');
    await filtersReady(page);

    const visible = page.locator('li[data-product]:not([hidden])');
    await expect(visible).toHaveCount(TOTAL_PRODUCTS);

    // Hand Protection holds 12: 11 from the brochure — the datasheet products
    // all landed in `fans` — plus the PVC gloves from the campaign banners.
    await page.locator('#cf-category').selectOption('hand-protection');
    await expect(visible).toHaveCount(12);
    await expect(page.locator('.cf__count')).toHaveText(`Showing 12 of ${TOTAL_PRODUCTS} products`);

    // Narrowing by division alone.
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(visible).toHaveCount(TOTAL_PRODUCTS);

    await page.getByRole('radio', { name: 'Spartan Electricals' }).check();
    // 19 brochure products + 13 from the datasheets (7 industrial fans, 3
    // portable air coolers, 3 consumer fans) + 2 from the campaign banners
    // (solar street lights, the FW-40W orbit fan).
    await expect(visible).toHaveCount(33);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(visible).toHaveCount(TOTAL_PRODUCTS);
    await expect(page.locator('.cf__count')).toHaveText(
      `Showing ${TOTAL_PRODUCTS} of ${TOTAL_PRODUCTS} products`,
    );
  });

  test('filtering to an expanding range shows the empty panel, not an empty grid', async ({
    page,
  }) => {
    await page.goto('/catalogue');
    await filtersReady(page);

    await page.locator('#cf-category').selectOption('electrical-accessories');
    await expect(page.locator('li[data-product]:not([hidden])')).toHaveCount(0);
    await expect(page.locator('[data-product-grid]')).toBeHidden();
    await expect(page.locator('[data-product-none]')).toBeVisible();
    await expect(page.locator('[data-product-none]')).toContainText('No products in this range yet');
  });
});

test.describe('catalogue index without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('every product is listed and the filter bar is hidden', async ({ page }) => {
    await page.goto('/catalogue');

    // Not just present in the DOM — actually rendered, since the whole point is
    // that the listing does not depend on the island.
    const products = page.locator('li[data-product]');
    await expect(products).toHaveCount(TOTAL_PRODUCTS);
    await expect(products.first()).toBeVisible();
    await expect(products.nth(TOTAL_PRODUCTS - 1)).toBeVisible();
    await expect(page.locator('li[data-category-tile]')).toHaveCount(TOTAL_CATEGORIES);

    // `data-js` is set by an inline script, so without script it is never there
    // and the bar collapses instead of sitting inert.
    await expect(page.locator('html')).not.toHaveAttribute('data-js', /.*/);
    await expect(page.locator('.cf')).toBeHidden();
    await expect(page.locator('#cf-category')).toBeHidden();

    // A control that cannot work is removed rather than left dead.
    await expect(page.locator('button.eq-add').first()).toBeHidden();
  });

  test('the expanding category still says so without JavaScript', async ({ page }) => {
    await page.goto('/catalogue/electrical-accessories');
    await expect(page.getByRole('heading', { name: 'This range is expanding.' })).toBeVisible();
  });
});

test.describe('category pages', () => {
  test('a populated category lists its products', async ({ page }) => {
    await page.goto('/catalogue/hand-protection');

    await expect(page.getByRole('heading', { level: 1, name: 'Hand Protection' })).toBeVisible();
    await expect(page.locator('ul.grid > li')).toHaveCount(12);
    await expect(page.locator('.cp__count')).toHaveText('12 products');
  });

  for (const slug of ['electrical-accessories']) {
    test(`${slug} shows the expanding message and no product grid`, async ({ page }) => {
      await page.goto(`/catalogue/${slug}`);

      // The honest empty state, not a stub: no borrowed photograph and no
      // invented placeholder product.
      await expect(page.getByRole('heading', { name: 'This range is expanding.' })).toBeVisible();
      await expect(page.getByText('Contact us for current availability')).toBeVisible();

      await expect(page.locator('ul.grid')).toHaveCount(0);
      await expect(page.locator('article.card')).toHaveCount(0);
      await expect(page.locator('.cp__count')).toHaveCount(0);

      // And a way to ask, which is what the page is for.
      await expect(page.getByRole('link', { name: 'Send an enquiry' })).toBeVisible();
    });
  }
});

test.describe('product pages', () => {
  /*
   * "View on Kavalani" — present on the 10 products Kavalani actually carries
   * and absent on the other 84. Both halves matter, and the absent half is the
   * one that would fail quietly: an always-rendered button would send 84
   * products to a listing that does not exist.
   *
   * Grip Guard GP5 is the negative case on purpose. Kavalani carries a four-SKU
   * glove range and none of it is Spartan, so this is exactly the product a
   * careless "close enough" match would have linked.
   */
  test('offers a Kavalani link on a product Kavalani carries', async ({ page }) => {
    await page.goto('/products/pc-10-automatic-pump-controller');

    const link = page.getByRole('link', { name: 'View on Kavalani' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', /^https:\/\/(?:www\.)?kavalani\.com\//);
    // Leaves the site, so it must not hand the opener a window reference.
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('shows no Kavalani link on a product Kavalani does not carry', async ({ page }) => {
    await page.goto('/products/grip-guard-gp5');
    await expect(page.getByRole('link', { name: 'View on Kavalani' })).toHaveCount(0);
  });

  /*
   * No datasheet exists for any product yet, so this control renders nowhere.
   * Asserted rather than assumed: the field is optional and a default slipping
   * in would put a dead download on all 94 pages.
   */
  test('shows no datasheet button while no product has one', async ({ page }) => {
    await page.goto('/products/pc-10-automatic-pump-controller');
    await expect(page.getByRole('link', { name: 'Download datasheet' })).toHaveCount(0);
  });

  test('renders the product name as the h1 and shows its spec table', async ({ page }) => {
    await page.goto('/products/grip-guard-gp5');

    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText('Grip Guard GP5');

    const specs = page.locator('table.spec');
    await expect(specs).toBeVisible();
    // Labelled rows are `th scope="row"`, so each value is paired with its label.
    await expect(specs.locator('tbody tr')).toHaveCount(4);
    await expect(specs.locator('th[scope="row"]')).toHaveText([
      'Liner',
      'Coating',
      'Color',
      'Cuff Style',
    ]);
    await expect(specs.locator('tbody tr').first().locator('td')).toHaveText(
      'HPPE, Steel, Polyester, Spandex',
    );
  });

  test('breadcrumbs carry aria-current="page" on the last crumb only', async ({ page }) => {
    await page.goto('/products/grip-guard-gp5');

    const crumbs = page.locator('nav[aria-label="Breadcrumb"] li');
    await expect(crumbs).toHaveCount(3);

    const current = page.locator('nav[aria-label="Breadcrumb"] [aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText('Grip Guard GP5');

    // The current page is text, never a link back to where the user already is.
    await expect(page.locator('nav[aria-label="Breadcrumb"] a')).toHaveCount(2);
    await expect(page.locator('nav[aria-label="Breadcrumb"] a[aria-current]')).toHaveCount(0);
    await expect(crumbs.last().locator('[aria-current="page"]')).toHaveCount(1);
  });

  test('a category page breadcrumb marks only its own last crumb', async ({ page }) => {
    await page.goto('/catalogue/hand-protection');

    const crumbs = page.locator('nav[aria-label="Breadcrumb"] li');
    await expect(crumbs).toHaveCount(2);
    await expect(page.locator('nav[aria-label="Breadcrumb"] [aria-current="page"]')).toHaveText(
      'Hand Protection',
    );
    await expect(crumbs.first().locator('a')).toHaveAttribute('href', '/catalogue');
  });

  /**
   * EN 388: `0` is a tested result at the lowest level, `X` is "not submitted
   * for this test". Chem Guard prints both on one row — tear `0`, TDM cut `X` —
   * so it is the one product that proves the two are not being conflated.
   */
  test('Chem Guard shows tear level 0 and keeps 0 and X distinguishable', async ({ page }) => {
    await page.goto('/products/chem-guard');

    const cells = page.locator('table.en tbody td');
    await expect(page.locator('table.en thead th')).toHaveText([
      'Abrasion',
      'Blade cut',
      'Tear',
      'Puncture',
      'TDM cut',
    ]);
    await expect(cells).toHaveCount(5);

    // The printed characters, literally.
    await expect(cells.nth(0).locator('[aria-hidden="true"]')).toHaveText('4');
    await expect(cells.nth(1).locator('[aria-hidden="true"]')).toHaveText('1');
    await expect(cells.nth(2).locator('[aria-hidden="true"]')).toHaveText('0');
    await expect(cells.nth(3).locator('[aria-hidden="true"]')).toHaveText('1');
    await expect(cells.nth(4).locator('[aria-hidden="true"]')).toHaveText('X');

    // And the two are separately readable without sight: the visually-hidden
    // text in each cell says which of the two claims is being made. A `title`
    // alone would not reach a screen reader or a touch user.
    const tear = cells.nth(2);
    const tdm = cells.nth(4);
    await expect(tear.locator('.vh')).toHaveText('Tear: level 0');
    await expect(tdm.locator('.vh')).toHaveText('TDM cut: not tested for this glove');
    await expect(tear).toHaveAttribute('title', 'Tear: level 0');
    await expect(tdm).toHaveAttribute('title', 'TDM cut: not tested for this glove');

    const [tearText, tdmText] = await Promise.all([
      tear.locator('.vh').innerText(),
      tdm.locator('.vh').innerText(),
    ]);
    expect(tearText).not.toBe(tdmText);

    // The page also states it in words, because an X is present on this glove.
    await expect(
      page.getByText('X means the glove was not submitted for that test'),
    ).toBeVisible();
  });

  test('a glove with no printed rating renders no EN 388 table at all', async ({ page }) => {
    // 66 of the 72 products were never tested. An empty table or a row of
    // dashes would imply a result that does not exist.
    await page.goto('/products/latex-coated-gloves');
    await expect(page.locator('table.en')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'EN 388 resistance levels' })).toHaveCount(0);
  });
});

test('the 404 page renders and a missing route returns 404', async ({ page, request }) => {
  const response = await request.get('/no-such-page');
  expect(response.status()).toBe(404);

  await page.goto('/404');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
