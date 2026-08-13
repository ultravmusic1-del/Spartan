/**
 * The admin boundary, tested against the real built app.
 *
 * CI holds no Supabase credentials, so `authConfigured()` is false and
 * `currentAdmin()` returns null for every request. That is exactly the state
 * these tests need: an unauthenticated visitor. What is asserted here is that
 * such a visitor gets NOTHING — which is the property that matters most and the
 * one that must hold whether or not the deployment is configured.
 */
import { test, expect } from '@playwright/test';

const PAGES = ['/admin', '/admin/demand', '/admin/enquiries/00000000-0000-0000-0000-000000000000'];
const ENDPOINTS = ['/api/admin/export.csv'];

test.describe('the admin boundary', () => {
  for (const path of PAGES) {
    test(`${path} redirects an unauthenticated visitor to the login form`, async ({ page }) => {
      const response = await page.goto(path);
      expect(new URL(page.url()).pathname).toBe('/admin/login');
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Spartan admin' })).toBeVisible();
    });
  }

  for (const path of ENDPOINTS) {
    test(`${path} answers 401 rather than redirecting`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ ok: false, message: 'Not authorised.' });
    });
  }

  /*
   * The guard runs before any page code, so no combination of query parameters
   * can reach the reads behind it. Worth pinning because the inbox now takes
   * `page`, `status` and `notice` off the wire, and a future refactor that
   * moved any of that parsing ahead of the guard would still look correct.
   */
  test('query parameters cannot get past the guard', async ({ page }) => {
    for (const query of [
      '?page=-1',
      '?page=999999999999',
      '?page=NaN',
      '?status=archived',
      '?notice=<script>alert(1)</script>',
      '?notice=Session expired, sign in at evil.example',
    ]) {
      await page.goto(`/admin${query}`);
      expect(new URL(page.url()).pathname).toBe('/admin/login');
    }
  });

  /*
   * The login page renders its own `error` parameter, so it is the one admin
   * surface where a stranger's text can reach the DOM. It must arrive as text
   * and never as markup.
   */
  test('the login page does not render a query parameter as markup', async ({ page }) => {
    await page.goto('/admin/login?error=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    expect(await page.locator('script:not([src])').count()).toBe(0);
  });

  test('no enquiry data appears anywhere in an unauthenticated response', async ({ page }) => {
    await page.goto('/admin');
    const body = await page.content();
    for (const leak of ['@example.com', 'enquiries', 'Gulf Contracting']) {
      expect(body.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  test('the login page is noindex', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
  });

  /* The trap this whole phase is shaped around: `npm run csp` hashes inline
     scripts found in dist/client, and SSR admin pages are never there. An inline
     script here would ship unhashed and be blocked with nothing failing the
     build, so the only place it can be caught is at runtime under the real
     policy. */
  test('the login page runs with zero CSP violations', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('Content Security Policy')) violations.push(m.text());
    });
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
  });

  test('the login page carries no inline script at all', async ({ page }) => {
    await page.goto('/admin/login');
    const inline = await page.$$eval('script:not([src])', (nodes) =>
      nodes.filter((n) => n.textContent && n.textContent.trim().length > 0).length,
    );
    expect(inline).toBe(0);
  });
});
