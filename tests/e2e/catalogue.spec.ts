import { expect, test, type Page } from '@playwright/test';

/**
 * Catalogue coverage — the 96 static pages.
 *
 * Everything here runs against the built output (see playwright.config.ts), so
 * what is asserted is what would deploy. The two things this file exists to
 * protect are both cases where a plausible "improvement" would be a lie:
 *
 *  - the two expanding categories must stay empty and say so, rather than
 *    borrow a product from somewhere else;
 *  - Chem Guard's EN 388 tear level is a printed `0`, and `0` and `X` are
 *    different claims about a glove. Collapsing them would misreport a safety
 *    rating.
 */

// 72 from the brochure + 6 industrial fans from the datasheet PDFs.
const TOTAL_PRODUCTS = 78;
const TOTAL_CATEGORIES = 15;

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

  test('filters narrow the visible products and clearing restores them all', async ({ page }) => {
    await page.goto('/catalogue');
    await filtersReady(page);

    const visible = page.locator('li[data-product]:not([hidden])');
    await expect(visible).toHaveCount(TOTAL_PRODUCTS);

    // Hand Protection holds 11 of the 72.
    await page.locator('#cf-category').selectOption('hand-protection');
    await expect(visible).toHaveCount(11);
    await expect(page.locator('.cf__count')).toHaveText(`Showing 11 of ${TOTAL_PRODUCTS} products`);

    // Narrowing by division alone: Spartan Electricals holds 19.
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(visible).toHaveCount(TOTAL_PRODUCTS);

    await page.getByRole('radio', { name: 'Spartan Electricals' }).check();
    // 19 brochure products + 6 industrial fans from the datasheets.
    await expect(visible).toHaveCount(25);

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

    await page.locator('#cf-category').selectOption('spill-control');
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

  test('the two expanding categories still say so without JavaScript', async ({ page }) => {
    await page.goto('/catalogue/spill-control');
    await expect(page.getByRole('heading', { name: 'This range is expanding.' })).toBeVisible();
  });
});

test.describe('category pages', () => {
  test('a populated category lists its products', async ({ page }) => {
    await page.goto('/catalogue/hand-protection');

    await expect(page.getByRole('heading', { level: 1, name: 'Hand Protection' })).toBeVisible();
    await expect(page.locator('ul.grid > li')).toHaveCount(11);
    await expect(page.locator('.cp__count')).toHaveText('11 products');
  });

  for (const slug of ['electrical-accessories', 'spill-control']) {
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
