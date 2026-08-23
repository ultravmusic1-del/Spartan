/**
 * The admin boundary, tested against the real built app.
 *
 * Every test here is an UNAUTHENTICATED visitor, and what is asserted is that
 * such a visitor gets NOTHING. That property must hold whether or not the
 * deployment is configured, which is why nothing below depends on either.
 *
 * It used to depend on it by accident: the file said CI holds no Supabase
 * credentials, so `authConfigured()` is false and `currentAdmin()` returns null
 * for every request. Since 2026-08-23 CI runs a throwaway Supabase stack for
 * the authenticated tests, so auth IS configured and these pass for the reason
 * they always claimed to — no session, no admin. tests/e2e/admin-catalogue.spec.ts
 * is the other half: what happens once someone is in.
 */
import { test, expect } from '@playwright/test';

const PAGES = [
  '/admin',
  '/admin/demand',
  '/admin/enquiries/00000000-0000-0000-0000-000000000000',
  '/admin/catalogue',
  '/admin/banners',
  '/admin/catalogue/products/cut-flex',
  '/admin/catalogue/categories/hand',
];
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

  /*
   * The recovery pages are deliberately OUTSIDE the guard: someone locked out
   * has no session by definition, so guarding them would be circular. That
   * makes them the widest part of the unauthenticated surface, and these tests
   * exist to keep the widening honest — they must render, and they must give
   * nothing away.
   */
  for (const path of ['/admin/forgot', '/admin/reset']) {
    test(`${path} is reachable without a session`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }

  test('the reset page refuses to show a password form without a valid link', async ({ page }) => {
    await page.goto('/admin/reset');

    // No code, no session: the form must not be there to post to. This is the
    // assertion that matters, and it holds whether the deployment is configured
    // or not — CI is never configured, so the page renders its "not configured"
    // branch here and the point still stands.
    expect(await page.locator('input[name="password"]').count()).toBe(0);

    // And it is never a dead end: every state offers a route back.
    await expect(page.locator('a[href="/admin/login"]').first()).toBeVisible();
  });

  test('sign-in offers a way out for a forgotten password', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute(
      'href',
      '/admin/forgot',
    );
  });

  /*
   * Account enumeration. The confirmation names a CONDITION — "if that address
   * has an account" — rather than asserting delivery, so it cannot be used to
   * ask who has one. CI holds no credentials, so this exercises the
   * unconfigured branch; the wording under test is the same either way.
   */
  test('the reset request never says whether an address has an account', async ({ page }) => {
    await page.goto('/admin/forgot');
    const body = (await page.content()).toLowerCase();
    for (const leak of ['no such', 'not found', 'unknown address', 'no account with']) {
      expect(body).not.toContain(leak);
    }
  });

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
