import { expect, test } from '@playwright/test';

/**
 * The primary navigation.
 *
 * Catalogue was missing from it entirely. On a catalogue site that meant the
 * catalogue index was reachable only from CTAs on the home page and the
 * footer's per-category links — from a product page or About there was no route
 * to the full range at all. These tests exist so it cannot quietly go again.
 *
 * The desktop `<ul>` is server-rendered at every width and hidden by CSS below
 * 1081px, so the semantic assertions below hold in both projects. Only the
 * visibility checks are width-dependent, and they are guarded.
 */

const NAV_LINK = 'header .nav__link';

test.describe('the primary navigation', () => {
  test('lists Catalogue among the product-browsing routes', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator(NAV_LINK)).toHaveText([
      'Home',
      'About',
      'Catalogue',
      'Electricals',
      'Safety',
      'Industries',
      'Contact',
    ]);

    await expect(page.locator(`${NAV_LINK}`, { hasText: 'Catalogue' })).toHaveAttribute(
      'href',
      '/catalogue',
    );
  });

  test('marks Catalogue as the current page on the catalogue index', async ({ page }) => {
    await page.goto('/catalogue');

    const lit = page.locator('header .nav__link--on');
    await expect(lit).toHaveText(['Catalogue']);
    await expect(lit).toHaveAttribute('aria-current', 'page');
  });

  /*
   * The distinction this test protects: on a category page the Catalogue link is
   * lit, because that is the section you are in, but it is NOT the page you are
   * on. `aria-current="page"` there would tell a screen reader the user is
   * somewhere they are not.
   */
  test('lights Catalogue on a category page without claiming it is the page', async ({ page }) => {
    await page.goto('/catalogue/hand-protection');

    const lit = page.locator('header .nav__link--on');
    await expect(lit).toHaveText(['Catalogue']);
    await expect(lit).not.toHaveAttribute('aria-current', /.*/);
  });

  /*
   * Product pages sit at /products/… and are deliberately outside the section:
   * their breadcrumb already says where they are, and lighting a nav item that
   * does not contain them would be a claim about the IA that is not true.
   */
  test('lights nothing on a product page', async ({ page }) => {
    await page.goto('/products/grip-guard-gp5');

    await expect(page.locator('header .nav__link--on')).toHaveCount(0);
    await expect(page.locator(`${NAV_LINK}[aria-current]`)).toHaveCount(0);
  });

  test('the desktop menu fits its row without overflowing the page', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop menu is hidden below 1081px');

    // 1081px is the narrowest width at which the desktop menu is shown at all —
    // one pixel below it the mobile trigger takes over. A seventh item is the
    // kind of change that fits at 1440 and collides here.
    await page.setViewportSize({ width: 1081, height: 900 });
    await page.goto('/catalogue');

    const menu = page.locator('header .nav__menu');
    await expect(menu).toBeVisible();

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows).toBe(false);

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
  });

  test('the mobile panel offers Catalogue too', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the panel only exists below 1081px');

    await page.goto('/');
    await page.locator('.nav__mobile button').first().click();

    const panel = page.locator('.mnav-list');
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Catalogue', exact: true })).toHaveAttribute(
      'href',
      '/catalogue',
    );
  });
});
