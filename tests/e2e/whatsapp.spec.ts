import { expect, test, type Page } from '@playwright/test';

/**
 * The two WhatsApp controls that address Spartan.
 *
 * The site carries THREE WhatsApp links and only two of them are about
 * contacting the company. The share row's control has NO recipient — it opens
 * WhatsApp with a product described and lets the buyer pick who to forward it
 * to. The floating button and the product page's "Enquire on WhatsApp" are
 * addressed to Spartan's own number and are leads.
 *
 * The guard at the bottom of this file is the one that matters most: it pins
 * the share link as recipient-less. If the two implementations ever converge,
 * every share button on the site quietly starts messaging the company instead
 * of the buyer's colleague, and nothing else would notice.
 *
 * LOCATORS ARE STRUCTURAL, NOT ORDINAL. The float is the last element in the
 * body, so `.last()` on a role query finds the FLOAT and not the product
 * button — which is exactly backwards, and passed the first time out by
 * matching the wrong element.
 */

const NUMBER = '97338000458';
const AMPERSAND = { slug: 'cotton-pants-shirts', name: 'Cotton Pants & Shirts' };

const float = (page: Page) => page.locator('a[data-whatsapp-float]');
/** The product page's own control, scoped to the action row it lives in. */
const productButton = (page: Page) =>
  page.locator('.pd__actions a[href^="https://wa.me/"]');

/** The `text=` parameter of a wa.me link, decoded back to what WhatsApp receives. */
const sentMessage = (href: string): string =>
  decodeURIComponent(new URL(href).searchParams.get('text') ?? '');

/* ------------------------------------------------------------- the float -- */

test.describe('the floating WhatsApp button', () => {
  for (const path of ['/', '/catalogue', '/safety', `/products/${AMPERSAND.slug}`, '/contact']) {
    test(`is on ${path}`, async ({ page }) => {
      await page.goto(path);
      await expect(float(page)).toHaveCount(1);
    });
  }

  test('addresses the company number and opens in a new tab', async ({ page }) => {
    await page.goto('/');

    const link = float(page);
    await expect(link).toHaveAttribute('href', new RegExp(`^https://wa\\.me/${NUMBER}\\?text=`));
    await expect(link).toHaveAttribute('target', '_blank');
    // Without `noopener` the opened tab can reach back through `window.opener`.
    await expect(link).toHaveAttribute('rel', /noopener/);
  });

  test('has an accessible name, since it is a bare glyph', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: 'Chat with Spartan on WhatsApp' }),
    ).toHaveCount(1);
  });

  /** WCAG 2.5.5. This is a thumb target reached one-handed; 44px is the floor. */
  test('is at least a 44px touch target', async ({ page }) => {
    await page.goto('/');
    const box = await float(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  /**
   * It names the SITE, not the page. A floating control that reports which URL
   * somebody was reading when they tapped it reads as surveillance; the product
   * page has its own button for the case where the buyer chose to name one.
   */
  test('does not report which page the buyer was on', async ({ page }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);

    const message = sentMessage((await float(page).getAttribute('href'))!);
    expect(message).toContain("I'd like to enquire about your products.");
    expect(message).not.toContain('/products/');
  });

  test('is absent from the admin area, which has its own layout', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(float(page)).toHaveCount(0);
  });
});

/* --------------------------------------------------- the product control -- */

test.describe('"Enquire on WhatsApp" on a product page', () => {
  test('names the product and links to its page', async ({ page }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);

    const href = (await productButton(page).getAttribute('href'))!;
    expect(href.startsWith(`https://wa.me/${NUMBER}?text=`)).toBe(true);

    const message = sentMessage(href);
    expect(message).toContain("I'd like to enquire about:");
    // `&` starts the next parameter in a query string, so an unencoded name
    // arrives as "Cotton Pants " with the rest silently gone.
    expect(message).toContain(AMPERSAND.name);
    expect(message).toContain(`/products/${AMPERSAND.slug}`);
  });

  test('is labelled by its visible text', async ({ page }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);
    await expect(productButton(page)).toContainText('Enquire on WhatsApp');
    // Label in Name: the accessible name must contain the visible label.
    await expect(
      page.getByRole('link', { name: /Enquire on WhatsApp/ }).and(productButton(page)),
    ).toHaveCount(1);
  });

  test('carries the variant label, because a name alone is the wrong product', async ({ page }) => {
    await page.goto('/products/ventilation-fans-6-8-10-inch');

    const href = (await productButton(page).getAttribute('href'))!;
    expect(sentMessage(href)).toContain('Ventilation Fans 6" · 8" · 10"');
  });

  test('is a plain link, so it works with JavaScript off', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/products/${AMPERSAND.slug}`);

    await expect(productButton(page)).toBeVisible();
    await expect(float(page)).toHaveCount(1);
    await context.close();
  });
});

/* ------------------------------------------------------------- the guard -- */

test.describe('the share row is not this', () => {
  /**
   * The share control must stay recipient-less. `https://wa.me/?text=` opens
   * WhatsApp's contact picker; `https://wa.me/<number>?text=` opens a chat with
   * that number. One path segment of difference turns "send this to a
   * colleague" into "message the supplier".
   */
  test('its WhatsApp link still has no recipient', async ({ page }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);

    const href = (await page.locator('[data-share-whatsapp]').getAttribute('href'))!;
    expect(href.startsWith('https://wa.me/?text=')).toBe(true);
    expect(href).not.toContain(NUMBER);
  });

  /** Three WhatsApp links on one page, and each has a name of its own. */
  test('a product page carries all three, told apart by their names', async ({ page }) => {
    await page.goto(`/products/${AMPERSAND.slug}`);

    await expect(page.getByRole('link', { name: 'Chat with Spartan on WhatsApp' })).toHaveCount(1);
    await expect(productButton(page)).toHaveCount(1);
    await expect(page.locator('[data-share-whatsapp]')).toHaveCount(1);
  });
});
