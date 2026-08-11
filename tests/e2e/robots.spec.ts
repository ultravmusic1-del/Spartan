import { expect, test } from '@playwright/test';

/**
 * robots.txt.
 *
 * It used to be a static file in `public/` with the domain typed into it by
 * hand, alongside `site` in astro.config.mjs. Two copies of one value, and
 * changing either without the other was silent — a crawler would be pointed at
 * a host that does not exist and nothing in the build would say so.
 *
 * `src/pages/robots.txt.ts` derives it from `Astro.site`, so the test that
 * matters is not "does the file exist" but "does it name the same origin the
 * pages claim as canonical". That is the invariant the old arrangement could
 * break; this asserts it directly rather than trusting that it cannot.
 */

test.describe('robots.txt', () => {
  test('is served as plain text with the crawl directives', async ({ request }) => {
    const response = await request.get('/robots.txt');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/plain');

    const body = await response.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
  });

  test('advertises a sitemap on the same origin the pages call canonical', async ({
    page,
    request,
  }) => {
    const body = await (await request.get('/robots.txt')).text();

    const sitemap = body.match(/^Sitemap:\s*(\S+)$/m)?.[1];
    expect(sitemap, 'robots.txt must advertise a sitemap').toBeTruthy();

    await page.goto('/');
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBeTruthy();

    // The whole point of the endpoint. These two came from one value, so they
    // agree by construction — and if a future change reintroduces a second
    // copy of the domain, this is what notices.
    expect(new URL(sitemap!).origin).toBe(new URL(canonical!).origin);
    expect(new URL(sitemap!).pathname).toBe('/sitemap-index.xml');
  });

  test('the advertised sitemap is the one the build actually emitted', async ({ request }) => {
    const body = await (await request.get('/robots.txt')).text();
    const sitemap = body.match(/^Sitemap:\s*(\S+)$/m)?.[1];

    // Fetched by path, because the origin in the file is the configured domain
    // and the preview server answers on 127.0.0.1.
    const response = await request.get(new URL(sitemap!).pathname);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('<sitemapindex');
  });
});
