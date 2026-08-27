import { expect, test, type Page } from '@playwright/test';

/**
 * A product carried from its page into the message box.
 *
 * /contact tells buyers to raise a product-specific request from the catalogue
 * "so nobody has to work out which of four ventilation fan sizes you meant" —
 * and then, until now, handed them an empty box. These are the two journeys
 * that make that copy true.
 *
 * The two products are chosen rather than arbitrary. `Cotton Pants & Shirts`
 * carries an `&`, which in a query string starts the next parameter, so an
 * unencoded name would arrive as "Cotton Pants " with the rest silently gone —
 * the same class of failure as the share links in handoff.md §19. And the
 * ventilation fan is literally the product the contact page complains about:
 * four records that differ only by the sizes in their names.
 *
 * Nothing here is mocked. The links are the built product pages' real hrefs and
 * the prefill is the shipped script running in a browser.
 */

const AMPERSAND = { slug: 'cotton-pants-shirts', name: 'Cotton Pants & Shirts' };
const FAN = { slug: 'ventilation-fans-6-8-10-inch', name: 'Ventilation Fans 6" · 8" · 10"' };

const STORE_KEY = 'spartan.enquiry.v1';

const contactMessage = (page: Page) => page.locator('#c-message');
const enquiryMessage = (page: Page) => page.locator('form textarea[name="message"]');

/** The basket, read from the key the store writes. */
const readBasket = (page: Page) =>
  page.evaluate((key) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '[]');
      return Array.isArray(parsed) ? (parsed as { slug: string; qty: number }[]) : [];
    } catch {
      return [];
    }
  }, STORE_KEY);

/* ------------------------------------------------- ask about this product -- */

test.describe('"Ask about this product"', () => {
  test('lands on /contact with the product named and an information request', async ({ page }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);
    await page.getByRole('link', { name: 'Ask about this product' }).click();

    await expect(page).toHaveURL(/\/contact/);
    await expect(contactMessage(page)).not.toHaveValue('');

    const message = await contactMessage(page).inputValue();
    expect(message).toContain("I'd like more information about:");
    // The ampersand is the point: unencoded, everything from `&` onwards would
    // have been read as the next parameter and lost without an error.
    expect(message).toContain(AMPERSAND.name);
    expect(message).toContain(`/products/${AMPERSAND.slug}`);
    expect(message).not.toContain('quotation');
  });

  /**
   * The product page's own promise. Four ventilation fan records differ only by
   * the sizes in their name, so the name is the whole of the disambiguation.
   */
  test('carries the size variant that tells four fans apart', async ({ page }) => {
    await page.goto(`/products/${FAN.slug}`);
    await page.getByRole('link', { name: 'Ask about this product' }).click();

    await expect(contactMessage(page)).not.toHaveValue('');
    expect(await contactMessage(page).inputValue()).toContain(FAN.name);
  });

  test('leaves the box empty for a buyer who arrived at /contact directly', async ({ page }) => {
    await page.goto('/contact');
    await expect(contactMessage(page)).toHaveValue('');
  });

  test('ignores a product that is not a catalogue slug', async ({ page }) => {
    await page.goto('/contact?product=..%2F..%2Fadmin&name=Anything&intent=info');
    await expect(contactMessage(page)).toHaveValue('');
  });

  /**
   * The link line is built from the slug against this page's own origin, so a
   * crafted `name` cannot become the destination. It still appears as the
   * product's name — that line is plain text in the buyer's own message box,
   * which they can read and delete, and they could have typed it themselves.
   * What must never happen is the *link* pointing somewhere else.
   */
  test('builds the product link from the slug, never from the name', async ({ page }) => {
    await page.goto('/contact?product=pumps&name=https%3A%2F%2Fevil.example&intent=info');
    await expect(contactMessage(page)).not.toHaveValue('');

    const lines = (await contactMessage(page).inputValue()).split('\n');
    const origin = new URL(page.url()).origin;
    expect(lines[3]).toBe(`${origin}/products/pumps`);
  });
});

/* -------------------------------------------------------- request a quote -- */

test.describe('"Request a quote"', () => {
  test('lands on /enquiry with the product on the list and a quotation request', async ({
    page,
  }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);
    await page.getByRole('link', { name: 'Request a quote' }).click();

    await expect(page).toHaveURL(/\/enquiry/);
    await expect(enquiryMessage(page)).not.toHaveValue('');

    const message = await enquiryMessage(page).inputValue();
    expect(message).toContain('Please send a quotation for:');
    expect(message).toContain(AMPERSAND.name);
    expect(message).toContain(`/products/${AMPERSAND.slug}`);
    expect(message).not.toContain('more information');

    // The basket is the site's conversion mechanism: arriving with the message
    // alone would still leave the enquiry with no line item on it.
    await expect(page.locator('.ef-item__name')).toHaveText(AMPERSAND.name);
    expect(await readBasket(page)).toEqual([
      expect.objectContaining({ slug: AMPERSAND.slug, qty: 1 }),
    ]);
  });

  test('adds to a basket that already has something in it', async ({ page }) => {
    await page.goto(`/products/${FAN.slug}`);
    await page.getByRole('link', { name: 'Request a quote' }).click();
    await expect(page.locator('.ef-item__name')).toHaveCount(1);

    await page.goto(`/products/${AMPERSAND.slug}`);
    await page.getByRole('link', { name: 'Request a quote' }).click();

    await expect(page.locator('.ef-item__name')).toHaveCount(2);
    expect((await readBasket(page)).map((i) => i.slug)).toEqual([FAN.slug, AMPERSAND.slug]);
  });
});

/* ------------------------------------------------------------ second time -- */

test.describe('arriving twice', () => {
  /**
   * The failure this guards is silent and expensive. `addItem` increments an
   * existing line, so if the parameters survived in the address bar a buyer who
   * refreshed three times would be asking for four of something they wanted one
   * of, with nothing on screen to explain it.
   */
  test('a reload does not add the product again', async ({ page }) => {
    await page.goto(`/products/${FAN.slug}`);
    await page.getByRole('link', { name: 'Request a quote' }).click();
    await expect(page.locator('.ef-item__name')).toHaveText(FAN.name);

    await page.reload();
    await page.reload();

    await expect(page.locator('.ef-item__name')).toHaveCount(1);
    expect(await readBasket(page)).toEqual([expect.objectContaining({ slug: FAN.slug, qty: 1 })]);
  });

  test('the parameters are dropped from the address bar', async ({ page }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);
    await page.getByRole('link', { name: 'Ask about this product' }).click();

    await expect(contactMessage(page)).not.toHaveValue('');
    await expect(page).toHaveURL((url) => !url.searchParams.has('product'));
  });

  /**
   * What the buyer wrote survives. Losing it would be a worse failure than
   * never having helped them write it.
   *
   * NAMED HONESTLY: this passes because the parameters were already cleaned
   * from the URL, so the second load has nothing to prefill from. The
   * empty-box check in the prefill itself is a second, independent guard for
   * the case where a browser restores a form on back-navigation — real
   * behaviour, but not something a test can force deterministically, so it is
   * covered by reading rather than by running.
   */
  test('a reload does not replace what the buyer typed', async ({ page }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);
    await page.getByRole('link', { name: 'Ask about this product' }).click();
    await expect(contactMessage(page)).not.toHaveValue('');

    await contactMessage(page).fill('We need 200 units before the end of the month.');
    await page.reload();

    expect(await contactMessage(page).inputValue()).not.toContain('more information about');
  });
});
