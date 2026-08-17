import { expect, test } from '@playwright/test';

/**
 * The primary navigation.
 *
 * Three flat items — Catalogue, Electricals, Safety — became one "Categories"
 * item with a dropdown on 2026-08-17, at the client's request. These tests exist
 * because that change moves the whole product IA behind one label: if the panel
 * fails to open, or a division is missing from one of the two renderers, an
 * entire range is unreachable from the primary nav with the page still looking
 * completely normal. That exact failure — the catalogue index reachable from
 * nowhere in the nav — is what this spec was originally written for.
 *
 * The desktop `<ul>` is server-rendered at every width and hidden by CSS below
 * 1081px, so the semantic assertions below hold in both projects. Only the
 * visibility checks are width-dependent, and they are guarded.
 */

const NAV_LINK = 'header .nav__menu > ul > li > .nav__link';
const PANEL = 'header .nav__panel';

// Pinned, as in tests/e2e/catalogue.spec.ts. A category that stops appearing in
// the menu is the failure being guarded, so the number cannot be read off the
// menu itself.
const TOTAL_CATEGORIES = 15;

test.describe('the primary navigation', () => {
  test('is five items, with Categories heading the product routes', async ({ page }) => {
    await page.goto('/');

    /*
     * `allTextContents`, not `allInnerTexts`. These links are
     * `text-transform: uppercase`, so innerText returns what is PAINTED —
     * "HOME", "ABOUT" — while the markup says "Home". Asserting the painted
     * casing would pin a styling decision inside a test about information
     * architecture, and it would break the moment the design lower-cased the nav.
     */
    await expect(page.locator(NAV_LINK)).toHaveCount(5);
    const labels = await page.locator(NAV_LINK).allTextContents();
    expect(labels.map((l) => l.replace(/\s+/g, ' ').trim())).toEqual([
      'Home',
      'About',
      'Categories',
      'Industries',
      'Contact',
    ]);
  });

  /*
   * The item is a real link, not a dead menu label. Without this a visitor with
   * no JavaScript — and a crawler — would have a "Categories" control that is
   * hoverable and goes nowhere, and `/catalogue` reaching the primary nav at all
   * was its own fix once.
   */
  test('Categories is itself a link to the full catalogue', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator(NAV_LINK, { hasText: 'Categories' })).toHaveAttribute(
      'href',
      '/catalogue',
    );
  });

  test('marks Categories as the current page on the catalogue index', async ({ page }) => {
    await page.goto('/catalogue');

    const lit = page.locator('header .nav__link--on');
    await expect(lit).toHaveCount(1);
    await expect(lit).toHaveAttribute('aria-current', 'page');
  });

  /*
   * The distinction this test protects: on a category page the Categories link is
   * lit, because that is the section you are in, but it is NOT the page you are
   * on. `aria-current="page"` there would tell a screen reader the user is
   * somewhere they are not.
   */
  test('lights Categories on a category page without claiming it is the page', async ({ page }) => {
    await page.goto('/catalogue/hand-protection');

    const lit = page.locator('header .nav__link--on');
    await expect(lit).toHaveCount(1);
    await expect(lit).not.toHaveAttribute('aria-current', /.*/);
  });

  /*
   * THIS IS WHAT `owns` BEING A LIST BUYS. Electricals and Safety used to be
   * their own top-level items and each lit itself. Folded into Categories, one
   * item now has to cover three separate subtrees — /catalogue, /electricals and
   * /safety — and a single section string could only ever describe one.
   */
  for (const path of ['/electricals', '/safety']) {
    test(`lights Categories on ${path}`, async ({ page }) => {
      await page.goto(path);

      const lit = page.locator('header .nav__link--on');
      await expect(lit).toHaveCount(1);
      await expect(lit).toContainText('Categories');
      // The division page is not the catalogue index, so nothing claims to be it.
      await expect(lit).not.toHaveAttribute('aria-current', /.*/);
    });
  }

  test('lights nothing on a product page', async ({ page }) => {
    await page.goto('/products/grip-guard-gp5');

    await expect(page.locator('header .nav__link--on')).toHaveCount(0);
    await expect(page.locator(`${NAV_LINK}[aria-current]`)).toHaveCount(0);
  });
});

test.describe('the Categories dropdown', () => {
  test('carries both divisions and every category', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator(PANEL);
    await expect(panel.locator('.nav__division')).toHaveText([
      'Spartan Electricals',
      'Spartan Safety',
    ]);
    await expect(panel.locator('.nav__division').nth(0)).toHaveAttribute('href', '/electricals');
    await expect(panel.locator('.nav__division').nth(1)).toHaveAttribute('href', '/safety');

    // Every category, exactly once. A range silently dropped from the menu is
    // the whole reason this spec exists.
    const subs = panel.locator('.nav__sub');
    await expect(subs).toHaveCount(TOTAL_CATEGORIES);
    const hrefs = await subs.evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(new Set(hrefs).size).toBe(TOTAL_CATEGORIES);
    expect(hrefs.every((h) => h!.startsWith('/catalogue/'))).toBe(true);

    await expect(panel.locator('.nav__all')).toHaveAttribute('href', '/catalogue');
  });

  test('is closed until asked for, so its links are out of the tab order', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the panel is desktop-only');
    await page.goto('/');

    // `visibility: hidden` rather than transparency — 18 focusable links sitting
    // invisibly in the tab order would be worse than no menu at all.
    await expect(page.locator(PANEL)).toBeHidden();
    await expect(page.locator(`${PANEL} .nav__division`).first()).toBeHidden();
  });

  test('opens on hover', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the panel is desktop-only');
    await page.goto('/');

    await page.locator('header .nav__item--menu').hover();
    await expect(page.locator(PANEL)).toBeVisible();
    await expect(page.locator(PANEL).getByText('Spartan Electricals')).toBeVisible();
  });

  /*
   * THE KEYBOARD PATH, WHICH IS THE ONE THAT SILENTLY GOES MISSING.
   *
   * A dropdown opened only by `:hover` is a WCAG 2.1.1 failure and looks
   * completely fine to anyone using a mouse. `:focus-within` on the `<li>` is
   * what makes it operable: focusing the Categories link opens the panel, which
   * makes the panel's links focusable, which keeps `:focus-within` true as Tab
   * walks into them.
   */
  test('opens when Categories takes focus, and Tab then walks into it', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the panel is desktop-only');
    await page.goto('/');

    await page.locator('header .nav__item--menu .nav__link').focus();
    await expect(page.locator(PANEL)).toBeVisible();

    // The next tab stop after Categories must be the first thing in the panel.
    await page.keyboard.press('Tab');
    await expect(page.locator(`${PANEL} .nav__division`).first()).toBeFocused();
    await expect(page.locator(PANEL)).toBeVisible();
  });

  test('closes again once focus leaves it entirely', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the panel is desktop-only');
    await page.goto('/');

    await page.locator('header .nav__item--menu .nav__link').focus();
    await expect(page.locator(PANEL)).toBeVisible();

    await page.locator('header .nav__logo').focus();
    await expect(page.locator(PANEL)).toBeHidden();
  });

  /*
   * No script is involved in opening this menu, which is the point of building it
   * in CSS. The panel is in the DOM and the links are real hrefs, so a crawler
   * sees the whole IA and a visitor without JavaScript can still hover it open.
   */
  test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('still opens on hover and still lists every range', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', 'the panel is desktop-only');
      await page.goto('/');

      await expect(page.locator('html')).not.toHaveAttribute('data-js', /.*/);
      await expect(page.locator(`${PANEL} .nav__sub`)).toHaveCount(TOTAL_CATEGORIES);

      await page.locator('header .nav__item--menu').hover();
      await expect(page.locator(PANEL)).toBeVisible();
    });
  });

  test('marks the one range that stocks nothing, and only that one', async ({ page }) => {
    await page.goto('/');

    // Electrical Accessories is `status: expanding` with productCount 0. Spill
    // Control was the second such category until seven SKUs landed, which is
    // exactly why the marker keys off the count and not the flag alone.
    const marked = page.locator(`${PANEL} .nav__soon`);
    await expect(marked).toHaveCount(1);
    await expect(page.locator(`${PANEL} .nav__sub`, { hasText: 'Electrical Accessories' })).toContainText(
      'Soon',
    );
  });
});

test.describe('the navigation row still fits', () => {
  test('does not overflow at 1081px, panel open or closed', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop menu is hidden below 1081px');

    // 1081px is the narrowest width at which the desktop menu is shown at all —
    // one pixel below it the mobile trigger takes over.
    await page.setViewportSize({ width: 1081, height: 900 });
    await page.goto('/catalogue');

    const menu = page.locator('header .nav__menu');
    await expect(menu).toBeVisible();

    const overflows = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
    expect(await overflows()).toBe(false);

    // The menu must not run into the logo on its left or the phone number on
    // its right. Touching is a collision; this asserts real clearance.
    const box = async (selector: string) => {
      const b = await page.locator(selector).boundingBox();
      if (!b) throw new Error(`${selector} has no box`);
      return b;
    };
    const logo = await box('header .nav__logo');
    const tel = await box('header .nav__tel');
    const list = await box('header .nav__menu');

    expect(list.x).toBeGreaterThan(logo.x + logo.width);
    expect(tel.x).toBeGreaterThan(list.x + list.width);

    /*
     * And with the panel open. It is 560px wide and centred on its item, so it
     * is the one element here that could push a horizontal scrollbar onto the
     * narrowest desktop width — which would be a page-wide defect introduced by
     * a menu.
     */
    await page.locator('header .nav__item--menu').hover();
    await expect(page.locator(PANEL)).toBeVisible();
    expect(await overflows()).toBe(false);

    const panel = await box(PANEL);
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(1081);
  });
});

test.describe('the mobile panel', () => {
  test('lists both divisions and every category', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the panel only exists below 1081px');

    await page.goto('/');
    await page.locator('.nav__mobile button').first().click();

    const panel = page.locator('.mnav-list');
    await expect(panel).toBeVisible();

    // Categories itself still reaches the full index.
    await expect(panel.getByRole('link', { name: 'Categories', exact: true })).toHaveAttribute(
      'href',
      '/catalogue',
    );

    await expect(panel.locator('.mnav-division')).toHaveText([
      'Spartan Electricals',
      'Spartan Safety',
    ]);

    /*
     * The count has to match the desktop panel's. A range present on one
     * breakpoint and missing on the other is the hardest version of this bug to
     * notice, because whichever one you happen to be testing looks correct.
     */
    await expect(panel.locator('.mnav-sub')).toHaveCount(TOTAL_CATEGORIES);
  });

  test('gives every sub-item a 44px touch target', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the panel only exists below 1081px');

    await page.goto('/');
    await page.locator('.nav__mobile button').first().click();

    const heights = await page
      .locator('.mnav-sub')
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights).toHaveLength(TOTAL_CATEGORIES);
    // WCAG 2.5.5. Fifteen links in a scrolling panel on a phone is exactly where
    // a cramped target costs a tap.
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });
});
