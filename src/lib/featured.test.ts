import { describe, expect, it } from 'vitest';
import { FEATURED_SLUGS, getFeaturedProducts } from './featured';
import { getProducts } from './catalog';

describe('featured', () => {
  /*
   * The whole point of this module. A curated strip named by slug silently
   * empties when a slug is renamed — the page still builds, the grid just has
   * fewer cards, and nothing fails. This is the gate that turns that into a
   * test failure.
   */
  it('every curated slug resolves to a published product', async () => {
    const products = await getProducts();
    const known = new Set(products.map((p) => p.slug));
    const missing = FEATURED_SLUGS.filter((s) => !known.has(s));
    expect(missing).toEqual([]);
  });

  it('returns products in the curated order, not catalogue order', async () => {
    const featured = await getFeaturedProducts();
    expect(featured.map((p) => p.slug)).toEqual([...FEATURED_SLUGS]);
  });

  it('covers both divisions, because the tabs filter by division', async () => {
    const featured = await getFeaturedProducts();
    const divisions = new Set(featured.map((p) => p.divisionId));
    expect(divisions).toEqual(new Set(['electricals', 'safety']));
  });

  /*
   * The order test above compares the output against FEATURED_SLUGS itself, so
   * a duplicated entry mirrors into the expected value and passes. This is the
   * assertion that actually catches it — a repeat would render the same card
   * twice. `src/content.config.test.ts` guards the catalogue's own slugs the
   * same way.
   */
  it('names each product at most once', () => {
    expect(new Set(FEATURED_SLUGS).size).toBe(FEATURED_SLUGS.length);
  });
});
