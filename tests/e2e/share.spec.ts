import { expect, test } from '@playwright/test';

/**
 * Product sharing — WhatsApp, email, copy link.
 *
 * Two of the three are plain anchors built on the server, so they are asserted
 * against their `href` rather than by driving a browser out to WhatsApp. The
 * third needs script and is asserted by behaviour.
 *
 * THE ENCODING ASSERTIONS ARE THE VALUABLE ONES. `src/lib/share.test.ts` proves
 * the builder encodes correctly; these prove the encoded string survives being
 * written into an attribute and parsed back out of the built HTML, which is a
 * different failure. A `+` arriving at a mail client as a space, or a `#`
 * truncating the link off the end of the message, produces a share that sends
 * and arrives wrong — nothing throws and no gate goes red.
 */

// Chosen because its Material row is "White aluminium frame + iron back cover +
// glass LGP" — two real `+` characters from src/data/products.json.
const PRODUCT = '/products/slim-led-panels';
const PRODUCT_NAME = 'Slim LED Panels';

/*
 * Every locator below is scoped to the share row, never to the page.
 *
 * This is not tidiness. The page also carries the footer's `mailto:` contact
 * link and the enquiry island's own `role="status"` live region, and an unscoped
 * `getByRole` collects both — which showed up first as a strict-mode violation
 * on the mobile project and would otherwise have been a test quietly asserting
 * against the wrong element.
 */
const ROW = '[data-share]';

test.describe('the share row', () => {
  test('offers all three controls, named by their visible text', async ({ page }) => {
    await page.goto(PRODUCT);

    const group = page.getByRole('group', { name: 'Share this product' });
    await expect(group).toBeVisible();

    /*
     * Queried by role AND accessible name, which is what makes this a WCAG 2.5.3
     * (Label in Name) check rather than a presence check. The catalogue shipped a
     * serious failure of exactly this on every product card — a button reading
     * ENQUIRE whose accessible name was "Add <product> to enquiry list" — and
     * axe's rule for it is experimental and off by default, so the a11y sweep
     * said nothing. A locator built from the visible word cannot pass if an
     * `aria-label` has replaced it.
     */
    await expect(group.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
    await expect(group.getByRole('link', { name: 'Email' })).toBeVisible();
    await expect(group.getByRole('button', { name: 'Copy link' })).toBeVisible();
  });

  test('the WhatsApp link carries the name, the specs and the absolute URL', async ({ page }) => {
    await page.goto(PRODUCT);

    const href = await page
      .locator(ROW)
      .getByRole('link', { name: 'WhatsApp' })
      .getAttribute('href');
    expect(href).toBeTruthy();
    expect(href!.startsWith('https://wa.me/?text=')).toBe(true);

    const text = decodeURIComponent(href!.slice('https://wa.me/?text='.length));
    expect(text).toContain(PRODUCT_NAME);
    expect(text).toContain('White aluminium frame');
    // Absolute, and the real origin of the page — a relative path is worthless
    // the moment the message leaves the browser.
    expect(text).toMatch(new RegExp(`https?://[^\\s]+${PRODUCT}$`));
  });

  test('encodes a `+` from a spec value instead of shipping it raw', async ({ page }) => {
    await page.goto(PRODUCT);

    const row = page.locator(ROW);
    const wa = await row.getByRole('link', { name: 'WhatsApp' }).getAttribute('href');
    const mail = await row.getByRole('link', { name: 'Email' }).getAttribute('href');

    // Raw, a `+` in a query string decodes to a space: the material row would
    // read "White aluminium frame  iron back cover".
    expect(wa).toContain('%2B');
    expect(mail).toContain('%2B');
    expect(decodeURIComponent(wa!)).toContain('frame + iron back cover');
  });

  test('the email link carries a subject and a body, with no recipient', async ({ page }) => {
    await page.goto(PRODUCT);

    const href = await page.locator(ROW).getByRole('link', { name: 'Email' }).getAttribute('href');
    // No recipient: the sender picks who it goes to. `mailto:sales@…` would send
    // the product to Spartan, which is the opposite of the point.
    expect(href!.startsWith('mailto:?subject=')).toBe(true);

    const params = new URLSearchParams(href!.slice('mailto:?'.length));
    expect(params.get('subject')).toBe(`${PRODUCT_NAME} — Spartan`);
    expect(params.get('body')).toContain(PRODUCT_NAME);
    expect(params.get('body')).toContain(PRODUCT);
  });

  test('copy link puts the URL on the clipboard and says so', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(PRODUCT);

    const row = page.locator(ROW);
    await row.getByRole('button', { name: 'Copy link' }).click();

    // The label swaps AND the same word is written to a role="status" region.
    // A visible-only change is invisible to a screen reader, and swapping the
    // label alone is not reliably announced when focus is already on the button.
    await expect(row.getByRole('button', { name: 'Copied' })).toBeVisible();
    await expect(row.locator('[data-share-status]')).toHaveText('Copied');

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain(PRODUCT);
  });

  test('the label returns to Copy link, so a second share is obviously possible', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(PRODUCT);

    const row = page.locator(ROW);
    await row.getByRole('button', { name: 'Copy link' }).click();
    await expect(row.getByRole('button', { name: 'Copied' })).toBeVisible();
    // 2400ms revert, generously waited for.
    await expect(row.getByRole('button', { name: 'Copy link' })).toBeVisible({ timeout: 8000 });
  });

  test('every product page has the row, not just the one under test', async ({ page }) => {
    // Sampled across both divisions and a product with an EN 388 table, since
    // the row renders after those blocks.
    for (const path of ['/products/grip-guard-gp5', '/products/safety-helmets']) {
      await page.goto(path);
      await expect(page.getByRole('group', { name: 'Share this product' })).toBeVisible();
      await expect(page.locator(ROW).getByRole('link', { name: 'WhatsApp' })).toBeVisible();
    }
  });
});

test.describe('the share row without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  /*
   * The two anchors are the whole reason sharing was built this way. A visitor
   * with no script — or a crawler — still gets two working share routes, and the
   * one control that genuinely needs script is removed rather than left dead.
   * That is the same rule the enquiry buttons, the quick-enquiry forms and the
   * catalogue filter bar follow.
   */
  test('keeps WhatsApp and email, and drops the copy button entirely', async ({ page }) => {
    await page.goto(PRODUCT);

    await expect(page.locator('html')).not.toHaveAttribute('data-js', /.*/);

    const row = page.locator(ROW);
    await expect(row.getByRole('link', { name: 'WhatsApp' })).toBeVisible();
    await expect(row.getByRole('link', { name: 'Email' })).toBeVisible();

    // Server-rendered, so it is in the DOM; `html[data-js]` gating is what keeps
    // it off the screen. Asserting hidden rather than absent is the honest test
    // of the mechanism actually used.
    await expect(page.locator('button[data-share-copy]')).toBeHidden();
  });
});
