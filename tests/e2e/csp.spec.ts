import { expect, test } from '@playwright/test';

/**
 * The Content-Security-Policy, tested against real page loads.
 *
 * This is the test the policy exists for. A CSP that blocks Astro's island
 * bootstraps produces a site that renders perfectly and never hydrates — every
 * enquiry button stuck in its pending state, the filter bar collapsed, the
 * basket dead — and it fails only in production, because a preview that serves
 * no policy cannot show it. `tests/preview-server.mjs` therefore applies the
 * `headers` rules from vercel.json, so what these tests load is what Vercel
 * sends.
 *
 * `script-src` uses hashes and NOT `'unsafe-inline'`, so any inline script that
 * is not in the generated set is blocked. That makes these tests the check on
 * `tools/csp.mjs` as well: if it ever misses a script — a new client directive,
 * a new inline block — the page stops working here rather than on the site.
 */

/** Anything the browser refused to load or run, in the browser's own words. */
async function violationsOn(page: import('@playwright/test').Page, path: string) {
  const violations: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (/Content Security Policy|Refused to (execute|load|apply|connect)/i.test(text))
      violations.push(text);
  });
  page.on('pageerror', (error) => violations.push(`pageerror: ${error.message}`));

  await page.goto(path);
  await page.waitForLoadState('networkidle');
  return violations;
}

test.describe('the security headers', () => {
  test('arrive on an HTML response', async ({ request }) => {
    const headers = (await request.get('/')).headers();

    expect(headers['content-security-policy']).toContain("default-src 'self'");
    expect(headers['content-security-policy']).toContain("object-src 'none'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).toContain("form-action 'self'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['strict-transport-security']).toContain('max-age=');
    expect(headers['permissions-policy']).toContain('geolocation=()');
  });

  /*
   * `'unsafe-inline'` in script-src would silently undo most of the value of
   * having a policy at all: it permits exactly the injected inline script an
   * attacker wants. It is easy to reintroduce while debugging a broken page and
   * easy to forget, so it is asserted against directly.
   */
  test('do not permit inline script', async ({ request }) => {
    const csp = (await request.get('/')).headers()['content-security-policy'];
    const scriptSrc = csp.split(';').find((d) => d.trim().startsWith('script-src'))!;

    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');
    expect(scriptSrc).toContain('sha256-');
  });

  test('fonts are cached for a year', async ({ request }) => {
    // 84 KB of preloaded fonts sat on unhashed URLs with no cache header, so
    // they were revalidated on every visit.
    //
    // This covered /video/ too until the scroll-scrubbed hero was replaced with
    // a static still and 2.9 MB of MP4 was deleted. The rule went with it; there
    // is no /video/ to cache. Astro's own /_astro/ assets are content-hashed and
    // were already covered.
    const font = (await request.get('/fonts/archivo-variable.woff2')).headers();

    expect(font['cache-control']).toContain('immutable');
    expect(font['cache-control']).toContain('max-age=31536000');
  });
});

test.describe('the policy does not break the site', () => {
  for (const path of ['/', '/catalogue', '/catalogue/hand-protection', '/contact', '/enquiry']) {
    test(`${path} loads with no CSP violations`, async ({ page }) => {
      expect(await violationsOn(page, path)).toEqual([]);
    });
  }

  /*
   * The end of the conversion path, under the real policy. Hydration is what a
   * blocked bootstrap kills, and a button that never leaves its pending state
   * looks like a slow page rather than a broken one — so this asserts the
   * island is actually operable, not merely present.
   */
  test('islands still hydrate and the basket still works', async ({ page }) => {
    const violations = await violationsOn(page, '/products/grip-guard-gp5');

    // The button ships `visibility: hidden` and only becomes operable once the
    // island hydrates, so the scroll goes through `evaluate`:
    // `scrollIntoViewIfNeeded` runs actionability checks and would wait on the
    // very visibility the scroll unlocks. `toBeVisible()` is the hydration wait,
    // and under a broken policy it is what would never arrive.
    const button = page.locator('button.eq-add').first();
    await button.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(button).toBeVisible();
    await button.click();

    // "In your list" is the post-add state; under a broken policy the island
    // never hydrates and the label never leaves "Enquire"/"Add to enquiry".
    await expect(button).toHaveText(/In your list/i);
    expect(violations).toEqual([]);
  });

  test('the enquiry form can still post to /api/enquiry', async ({ page }) => {
    // form-action 'self' and connect-src 'self' both have to allow this. A
    // policy that blocked it would lose every enquiry on the site.
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': '12.0.0.1' });
    const violations = await violationsOn(page, '/contact');

    const form = page.locator('form.cf2');
    await expect(form).toHaveAttribute('data-state', 'idle');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/enquiry')),
      (async () => {
        await form.getByLabel('Name', { exact: true }).fill('Iris Bello');
        await form.getByLabel('Email', { exact: true }).fill('iris@example.com');
        await form.getByRole('button', { name: 'Send enquiry' }).click();
      })(),
    ]);

    expect(response.status()).toBe(200);
    expect(violations).toEqual([]);
  });
});
