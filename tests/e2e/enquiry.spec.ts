import { expect, test, type Page } from '@playwright/test';
import { ENQUIRY_OUTCOME, TEST_DB_UP } from './stack';

/**
 * The enquiry basket — the site's only conversion path.
 *
 * Nothing here is mocked. `/api/enquiry` is the real built endpoint, served by
 * tests/preview-server.mjs out of the bundle the Vercel adapter produced. With
 * neither `SUPABASE_*` nor `RESEND_*` in the environment both channels report
 * `unconfigured`, so it answers `200 { ok: true, recorded: false,
 * delivered: false }` and logs the enquiry — exactly what a deployment without
 * credentials does. The tests assert the confirmation and the *honest* "nothing
 * holds this" notice, and never that the enquiry reached anyone.
 *
 * Two mechanical notes.
 *
 * `client:visible` islands: the "Enquire" button ships in a
 * `visibility: hidden` pending state and only becomes operable once hydrated,
 * so `expect(button).toBeVisible()` is the hydration wait. The element has to be
 * scrolled into view first, and that scroll goes through `evaluate` rather than
 * `scrollIntoViewIfNeeded` — the latter runs actionability checks, which would
 * wait for a visibility the scroll is what unlocks.
 *
 * The endpoint rate-limits to 5 submissions per client IP per 10 minutes, in
 * one process's memory. `reuseExistingServer` means that process can outlive a
 * run, so the two tests that actually submit present themselves as distinct
 * clients (`submissionIp()` below) rather than sharing 127.0.0.1 and spending
 * the same bucket on every rerun. That exercises the limiter as written; it does
 * not disable it.
 */

const STORE_KEY = 'spartan.enquiry.v1';

interface BasketItem {
  slug: string;
  name: string;
  qty: number;
  note: string;
}

let submissions = 0;
/**
 * A distinct synthetic client per submitting test. The clock separates runs
 * (the server can outlive one), the pid separates parallel workers, and the
 * counter separates tests inside a worker.
 */
function submissionIp(): string {
  submissions += 1;
  const second = Math.floor(Date.now() / 1000) % 251;
  return `10.${second}.${process.pid % 251}.${submissions}`;
}

const readBasket = (page: Page): Promise<BasketItem[]> =>
  page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, STORE_KEY);

/**
 * Writes the same localStorage key the store writes, before any page script runs.
 *
 * Only when the key is absent. `addInitScript` runs on every navigation, so an
 * unconditional write would silently restore the seed on each reload — and the
 * tests that check an edit survived a reload would then be asserting against
 * the seed rather than against the store. (It did exactly that first time out.)
 */
async function seedBasket(page: Page, items: BasketItem[]) {
  await page.addInitScript(
    ([key, value]) => {
      if (window.localStorage.getItem(key as string) === null) {
        window.localStorage.setItem(key as string, value as string);
      }
    },
    [STORE_KEY, JSON.stringify(items)] as const,
  );
}

/** Adds a product through its card's real "Enquire" button. */
async function addFromCard(page: Page, slug: string) {
  const card = page.locator('article.card', {
    has: page.locator(`a[href="/products/${slug}"]`),
  });
  await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const button = card.locator('button.eq-add');
  await expect(button).toBeVisible();
  await button.click();
}

const badge = (page: Page) => page.locator('button.eq-badge');
const panel = (page: Page) => page.locator('[role="dialog"].eq-drawer__panel');

async function openDrawer(page: Page) {
  await expect(badge(page)).toBeVisible();
  await badge(page).focus();
  await page.keyboard.press('Enter');
  await expect(panel(page)).toBeVisible();
}

/* -------------------------------------------------------------- collecting -- */

test.describe('collecting products', () => {
  test('two products from cards give a total on the badge, and a repeat add increments one line', async ({
    page,
  }) => {
    await page.goto('/catalogue/hand-protection');

    // No badge at zero: an empty basket has nothing to open and nothing to say.
    await expect(badge(page)).toHaveCount(0);

    await addFromCard(page, 'grip-guard-gp1');
    await expect(badge(page)).toBeVisible();
    await expect(page.locator('.eq-badge__pip')).toHaveText('1');

    await addFromCard(page, 'grip-guard-gp3');
    await expect(page.locator('.eq-badge__pip')).toHaveText('2');
    await expect(badge(page)).toHaveAttribute('aria-label', 'Open enquiry list, 2 items');

    // The same product again: units go up, lines do not.
    await addFromCard(page, 'grip-guard-gp1');
    await expect(page.locator('.eq-badge__pip')).toHaveText('3');
    await expect(badge(page)).toHaveAttribute('aria-label', 'Open enquiry list, 3 items');

    const basket = await readBasket(page);
    expect(basket).toHaveLength(2);
    expect(basket.map((i) => [i.slug, i.qty])).toEqual([
      ['grip-guard-gp1', 2],
      ['grip-guard-gp3', 1],
    ]);

    await openDrawer(page);
    const lines = page.locator('li.eq-item');
    await expect(lines).toHaveCount(2);
    await expect(lines.first().locator('.eq-item__name')).toHaveText('Grip Guard GP1');
    await expect(lines.first().locator('.eq-qty__field')).toHaveValue('2');
    await expect(page.locator('.eq-drawer__count')).toHaveText('3 items');
  });

  test('the enquiry button confirms in words, not by colour alone', async ({ page }) => {
    await page.goto('/products/grip-guard-gp5');

    // `--solid` is the page's own CTA. The related-products strip below it
    // renders four more `.eq-add` buttons, in the `--card` variant.
    const button = page.locator('button.eq-add--solid');
    await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(button).toHaveText(/Add to enquiry/);
    await button.click();
    await expect(button).toHaveText(/In your list/);
    await expect(
      page.locator('.eq-add-wrap:has(button.eq-add--solid) [role="status"]'),
    ).toHaveText('Grip Guard GP5 added to your enquiry list. Quantity 1.');
  });

  /**
   * The state is the store, not a timer. It used to be a 2.4s "Added" flash, so
   * a product already on the list looked exactly like one that was not and a
   * second click raised the quantity with nothing on screen saying so.
   */
  test('the enquiry button still says so after a reload, and counts a second add', async ({
    page,
  }) => {
    await page.goto('/products/grip-guard-gp5');
    const button = page.locator('button.eq-add--solid');
    await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await button.click();
    await expect(button).toHaveText(/In your list/);

    await page.reload();
    await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(button).toHaveText(/In your list/);
    await expect(button).toHaveAttribute('aria-label', 'In your list: Grip Guard GP5');

    // Repeat-add is kept on purpose; what changed is that it is now visible.
    await button.click();
    await expect(button).toHaveText(/In your list \(2\)/);
    expect((await readBasket(page)).map((i) => [i.slug, i.qty])).toEqual([
      ['grip-guard-gp5', 2],
    ]);
  });

  test('a keyboard Enter on the enquiry button adds the product', async ({ page }) => {
    await page.goto('/products/grip-guard-gp5');

    const button = page.locator('button.eq-add--solid');
    await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(button).toBeVisible();
    await button.focus();
    await page.keyboard.press('Enter');

    await expect(badge(page)).toBeVisible();
    expect((await readBasket(page)).map((i) => i.slug)).toEqual(['grip-guard-gp5']);
  });

  test('the basket survives a reload and a navigation', async ({ page }) => {
    await page.goto('/catalogue/hand-protection');
    await addFromCard(page, 'grip-guard-gp1');
    await addFromCard(page, 'grip-guard-gp1');
    await expect(page.locator('.eq-badge__pip')).toHaveText('2');

    await page.reload();
    await expect(page.locator('.eq-badge__pip')).toHaveText('2');

    await page.goto('/about');
    await expect(page.locator('.eq-badge__pip')).toHaveText('2');

    await page.goto('/enquiry');
    await expect(page.locator('li.ef-item')).toHaveCount(1);
    await expect(page.locator('.ef-item__name')).toHaveText('Grip Guard GP1');
    await expect(page.locator('.ef-list__count')).toHaveText('1 line · 2 units');
  });
});

/* ------------------------------------------------------------------ drawer -- */

test.describe('the drawer', () => {
  test('focus enters it, Tab stays inside it, and Escape closes it and restores focus', async ({
    page,
  }) => {
    await seedBasket(page, [
      { slug: 'grip-guard-gp1', name: 'Grip Guard GP1', qty: 2, note: '' },
      { slug: 'chem-guard', name: 'Chem Guard', qty: 1, note: '' },
    ]);
    await page.goto('/catalogue/hand-protection');

    await openDrawer(page);

    // It announces itself as a modal dialog with a name.
    await expect(panel(page)).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('#eq-drawer-title')).toHaveText('Enquiry list');

    // Focus enters the panel, on its close button.
    await expect(page.locator('.eq-drawer__close')).toBeFocused();

    // Tab all the way round twice over and focus never leaves the panel.
    const focusables = await panel(page)
      .locator('a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])')
      .count();
    expect(focusables).toBeGreaterThan(1);

    for (let i = 0; i < focusables + 2; i += 1) {
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() => {
          const active = document.activeElement;
          const dialog = document.querySelector('.eq-drawer__panel');
          return !!(active && dialog && dialog.contains(active));
        }),
      ).toBe(true);
    }

    // And backwards off the first element, which wraps rather than escaping.
    await page.locator('.eq-drawer__close').focus();
    await page.keyboard.press('Shift+Tab');
    expect(
      await page.evaluate(() => {
        const active = document.activeElement;
        const dialog = document.querySelector('.eq-drawer__panel');
        return !!(active && dialog && dialog.contains(active));
      }),
    ).toBe(true);

    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(badge(page)).toBeFocused();
  });

  test('quantity and removal inside the drawer write through to the store', async ({ page }) => {
    await seedBasket(page, [
      { slug: 'grip-guard-gp1', name: 'Grip Guard GP1', qty: 1, note: '' },
      { slug: 'chem-guard', name: 'Chem Guard', qty: 1, note: '' },
    ]);
    await page.goto('/catalogue/hand-protection');
    await openDrawer(page);

    await page.getByRole('button', { name: 'Increase quantity of Grip Guard GP1' }).click();
    await expect(page.locator('li.eq-item').first().locator('.eq-qty__field')).toHaveValue('2');
    expect((await readBasket(page)).find((i) => i.slug === 'grip-guard-gp1')?.qty).toBe(2);

    await page.getByRole('button', { name: 'Remove Chem Guard from enquiry list' }).click();
    await expect(page.locator('li.eq-item')).toHaveCount(1);
    expect((await readBasket(page)).map((i) => i.slug)).toEqual(['grip-guard-gp1']);
  });
});

/* ------------------------------------------------------------------ /enquiry -- */

test.describe('/enquiry', () => {
  test('lists the basket and persists quantity edits to the store', async ({ page }) => {
    await seedBasket(page, [
      { slug: 'grip-guard-gp1', name: 'Grip Guard GP1', qty: 1, note: '' },
      { slug: 'chem-guard', name: 'Chem Guard', qty: 3, note: '' },
    ]);
    await page.goto('/enquiry');

    const lines = page.locator('li.ef-item');
    await expect(lines).toHaveCount(2);
    await expect(page.locator('.ef-item__name')).toHaveText(['Grip Guard GP1', 'Chem Guard']);
    await expect(page.locator('.ef-list__count')).toHaveText('2 lines · 4 units');

    // Typed edit.
    const field = lines.first().locator('.ef-qty__field');
    await field.fill('5');
    await field.blur();
    await expect(page.locator('.ef-list__count')).toHaveText('2 lines · 8 units');
    expect((await readBasket(page)).find((i) => i.slug === 'grip-guard-gp1')?.qty).toBe(5);

    // Stepper edit.
    await page.getByRole('button', { name: 'Decrease quantity of Chem Guard' }).click();
    expect((await readBasket(page)).find((i) => i.slug === 'chem-guard')?.qty).toBe(2);

    // And the edits survive a reload, so they are in the store and not in the DOM.
    await page.reload();
    await expect(page.locator('.ef-list__count')).toHaveText('2 lines · 7 units');
  });

  test('a note written on a line is kept', async ({ page }) => {
    await seedBasket(page, [{ slug: 'chem-guard', name: 'Chem Guard', qty: 1, note: '' }]);
    await page.goto('/enquiry');

    await page.getByLabel('Note for Chem Guard').fill('Size 9, nitrile cuff');
    expect((await readBasket(page))[0]?.note).toBe('Size 9, nitrile cuff');
  });

  test('a valid submission confirms and clears the basket', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': submissionIp() });
    await seedBasket(page, [{ slug: 'grip-guard-gp1', name: 'Grip Guard GP1', qty: 2, note: '' }]);
    await page.goto('/enquiry');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/enquiry')),
      (async () => {
        await page.getByLabel('Name', { exact: false }).first().fill('Dana Okoye');
        await page.getByLabel('Email', { exact: false }).first().fill('dana@example.com');
        await page.getByRole('button', { name: 'Send enquiry' }).click();
      })(),
    ]);

    expect(response.status()).toBe(200);

    const heading = page.getByRole('heading', { name: 'Enquiry received.' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();

    /*
     * The confirmation says what actually happened, and which of the two things
     * happened depends on whether this run has a database — see
     * tests/e2e/stack.ts. Without one the site says so rather than implying a
     * mail nobody sent; with one the enquiry really is held, and the "not
     * configured" paragraph must NOT appear, because it would send a buyer
     * chasing an email for an enquiry that was already captured.
     */
    expect(await response.json()).toEqual(ENQUIRY_OUTCOME);
    const pending = page.locator('.ef-done__pending');
    if (TEST_DB_UP) {
      await expect(pending).toHaveCount(0);
    } else {
      await expect(pending).toBeVisible();
    }

    expect(await readBasket(page)).toEqual([]);
    await page.reload();
    await expect(page.locator('.ef-list__empty-title')).toBeVisible();
    await expect(badge(page)).toHaveCount(0);
  });

  test('an invalid email is reported beside the field, takes focus, and leaves the basket alone', async ({
    page,
  }) => {
    await seedBasket(page, [{ slug: 'grip-guard-gp1', name: 'Grip Guard GP1', qty: 2, note: '' }]);

    const posted: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/enquiry')) posted.push(request.url());
    });

    await page.goto('/enquiry');
    await page.getByLabel('Name', { exact: false }).first().fill('Dana Okoye');
    await page.getByLabel('Email', { exact: false }).first().fill('dana@@example');
    await page.getByRole('button', { name: 'Send enquiry' }).click();

    const error = page.locator('#ef-email-error');
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute('role', 'alert');

    const email = page.locator('#ef-email');
    await expect(email).toHaveAttribute('aria-invalid', 'true');
    await expect(email).toHaveAttribute('aria-describedby', 'ef-email-error');
    // Focus goes to the field, which the message now describes — so the error
    // is announced with the control the user has to fix.
    await expect(email).toBeFocused();

    // The whole point: a mistyped address must not also cost the buyer the list.
    expect(await readBasket(page)).toHaveLength(1);
    expect((await readBasket(page))[0]?.qty).toBe(2);
    await expect(page.locator('li.ef-item')).toHaveCount(1);

    // Rejected in the browser, so nothing was sent and no rate-limit slot spent.
    expect(posted).toEqual([]);
  });

  test('an empty basket still sends a general enquiry', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': submissionIp() });
    await page.goto('/enquiry');

    await expect(page.locator('.ef-list__empty-title')).toHaveText('No products on your list.');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/enquiry')),
      (async () => {
        await page.getByLabel('Name', { exact: false }).first().fill('Sam Reyes');
        await page.getByLabel('Email', { exact: false }).first().fill('sam@example.com');
        await page
          .getByLabel('Message', { exact: false })
          .fill('Looking for LED high bays, 150W, quantity 40.');
        await page.getByRole('button', { name: 'Send enquiry' }).click();
      })(),
    ]);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(ENQUIRY_OUTCOME);
    await expect(page.getByRole('heading', { name: 'Enquiry received.' })).toBeVisible();
  });
});

/* ---------------------------------------------------------- corrupt storage -- */

test('a corrupt basket in localStorage does not break the page', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript((key) => window.localStorage.setItem(key as string, '{not json'), STORE_KEY);

  // The inline head script reads the same key, so it is exercised too.
  await page.goto('/catalogue');
  await expect(page.locator('.cf')).not.toHaveClass(/cf--pending/);
  await expect(page.locator('li[data-product]')).toHaveCount(94);
  await expect(badge(page)).toHaveCount(0);

  await page.goto('/enquiry');
  await expect(page.locator('.ef-list__empty-title')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send enquiry' })).toBeEnabled();

  // And it recovers: the next add writes a valid basket over the rubbish.
  await page.goto('/catalogue/hand-protection');
  await addFromCard(page, 'grip-guard-gp1');
  expect(await readBasket(page)).toEqual([
    { slug: 'grip-guard-gp1', name: 'Grip Guard GP1', qty: 1, note: '' },
  ]);

  expect(pageErrors).toEqual([]);
});
