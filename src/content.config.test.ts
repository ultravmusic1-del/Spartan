import { describe, it, expect } from 'vitest';
import { productSchema, categorySchema, divisionSchema } from './content.config';
import products from './data/products.json';
import categories from './data/categories.json';
import divisions from './data/divisions.json';

describe('content data', () => {
  it('every division validates', () => {
    for (const d of divisions) expect(() => divisionSchema.parse(d)).not.toThrow();
  });

  it('every category validates and points at a real division', () => {
    const ids = new Set(divisions.map((d) => d.id));
    for (const c of categories) {
      expect(() => categorySchema.parse(c)).not.toThrow();
      expect(ids.has(c.divisionId)).toBe(true);
    }
  });

  it('every product validates and points at a real category', () => {
    const ids = new Set(categories.map((c) => c.id));
    for (const p of products) {
      expect(() => productSchema.parse(p)).not.toThrow();
      expect(ids.has(p.categoryId)).toBe(true);
    }
  });

  it('product slugs are unique', () => {
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  /*
   * `datasheetUrl` and `kavalaniUrl` — the two optional fields behind the
   * "Download datasheet" and "View on Kavalani" controls.
   *
   * Both are absent from every record right now, and these tests are the honest
   * record of that rather than a gap in coverage: there is no PDF anywhere in
   * this repository and no Kavalani product URL written down, and neither is a
   * value that may be guessed. What IS worth testing is that a wrong value
   * cannot get in quietly — a CMS field is going to be filled by someone who is
   * not a developer, and a datasheet button pointing at a web page or a Kavalani
   * button pointing off Kavalani are both lies the schema can refuse.
   */
  describe('the datasheet and Kavalani fields', () => {
    const base = products[0]!;

    it('are absent from every product today, so neither control renders', () => {
      const withDatasheet = products.filter((p) => 'datasheetUrl' in p);
      const withKavalani = products.filter((p) => 'kavalaniUrl' in p);
      expect(withDatasheet).toHaveLength(0);
      expect(withKavalani).toHaveLength(0);
    });

    it('accept a datasheet as a site-root path or an https PDF URL', () => {
      for (const url of ['/datasheets/led-floodlights.pdf', 'https://example.com/a/b.PDF']) {
        expect(() => productSchema.parse({ ...base, datasheetUrl: url })).not.toThrow();
      }
    });

    it('reject a datasheet that is not a PDF, so the button cannot lie', () => {
      // The control says "Download datasheet". A web page is not a datasheet
      // download, and http:// is not a link this site will emit.
      for (const url of [
        'https://example.com/products/floodlights',
        '/datasheets/floodlights',
        'http://example.com/a.pdf',
        'example.com/a.pdf',
        '',
      ]) {
        expect(() => productSchema.parse({ ...base, datasheetUrl: url })).toThrow();
      }
    });

    it('accept an absolute https Kavalani URL and reject anything else', () => {
      expect(() =>
        productSchema.parse({ ...base, kavalaniUrl: 'https://example.com/p/1' }),
      ).not.toThrow();
      for (const url of ['http://example.com/p/1', '/p/1', 'example.com', '']) {
        expect(() => productSchema.parse({ ...base, kavalaniUrl: url })).toThrow();
      }
    });

    /*
     * The gap this leaves, stated rather than hidden: nothing above can tell a
     * correct Kavalani URL from a valid one pointing at the wrong product, or at
     * a different site entirely. Pinning the host would close half of it and the
     * host is not recorded anywhere here, so it cannot be written down without
     * inventing it. Queued in BACKLOG.md.
     */
    it('cannot yet tell a Kavalani URL from any other https URL', () => {
      expect(() =>
        productSchema.parse({ ...base, kavalaniUrl: 'https://not-kavalani.example/p/1' }),
      ).not.toThrow();
    });
  });

  it('every category hero product exists, except expanding categories', () => {
    const slugs = new Set(products.map((p) => p.slug));
    for (const c of categories) {
      if (c.status === 'expanding') expect(c.heroProductSlug).toBeNull();
      else expect(slugs.has(c.heroProductSlug!)).toBe(true);
    }
  });

  // CategoryGrid.astro looks its hero up through getProducts(), which filters
  // to `status === 'published'` — so a hero slug that exists but has flipped
  // to `draft` falls into the exact same empty branch as a genuinely empty
  // category, and the card would show "Range expanding" beside a nonzero
  // count. The slug-existence check above cannot catch that: it builds its
  // set from the raw JSON regardless of status. This gate checks status too.
  it('every active category hero product is published, not drafted', () => {
    const published = new Set(
      products.filter((p) => (p.status ?? 'published') === 'published').map((p) => p.slug),
    );
    for (const c of categories) {
      if (c.status !== 'expanding') expect(published.has(c.heroProductSlug!)).toBe(true);
    }
  });

  it('category product counts match the authoritative distribution', () => {
    // 72 brochure products + 13 from the datasheets — 7 industrial fans, 3
    // portable air coolers and 3 consumer fans — which is why `fans` is 17
    // rather than the brochure's 4. Update deliberately: this assertion exists
    // to make an accidental duplicate or a lost record fail loudly, so a number
    // that changes without a matching data change is a bug.
    // 2026-08-17: +9 from the Kavalani campaign banners — PVC Gloves, the
    // seven-SKU spill control range and solar street lights. `spill` is no
    // longer an empty category. Those nine are sourced from marketing artwork
    // rather than a brochure or datasheet, which is recorded on each record.
    // A tenth, an orbit fan the banner labelled FW-40W, was added and then
    // deleted the same day: it was the AF-40W under a mangled code, which is
    // why `fans` is back at 17. See handoff.md §17.
    const expected: Record<string, number> = {
      lighting: 11, fans: 17, pumps: 3, insect: 1, cables: 1, accessories: 0,
      head: 7, eye: 6, hearing: 6, hand: 12, foot: 8, harness: 2, body: 4,
      workwear: 9, spill: 7,
    };
    const actual: Record<string, number> = {};
    for (const p of products) actual[p.categoryId] = (actual[p.categoryId] ?? 0) + 1;
    for (const [id, n] of Object.entries(expected)) expect(actual[id] ?? 0).toBe(n);
    expect(products).toHaveLength(94);
  });

  it('records exactly which products are awaiting real photography', () => {
    // These ship with a placeholder because no separable product image exists
    // for them — see tools/README.md. The list is asserted so it cannot grow
    // silently, and so the launch checklist has something to check against.
    //
    // Two distinct reasons sit in this list. The three air coolers have only a
    // flattened datasheet page raster. The nine added on 2026-08-17 come from
    // campaign banners, where the product is composited into a styled scene —
    // absorbent pads on a warehouse floor, gloves over a workshop — so there is
    // no clean cut-out either. Both need real photography from the client.
    //
    // This was 16 until the client supplied masked cut-outs for the three fans
    // in `Spartan Fans Product Catalog.pdf` (SPTSF-16, AF-40W, FW-40H). Those
    // are the first product images on the site above the 100-440px ceiling that
    // handoff.md §6 records as the constraint on the whole design.
    const pending = products
      .filter((p) => p.images.includes('ds-photo-pending.png'))
      .map((p) => p.slug)
      .sort();
    expect(pending).toEqual([
      'chemical-absorbent-pillow',
      'chemical-absorbent-socks',
      'chemical-pads',
      'oil-absorbent-booms',
      'oil-absorbent-pillow',
      'oil-absorbent-socks',
      'oil-pads',
      'portable-air-cooler-ay-yd2512',
      'portable-air-cooler-ay-yd2518',
      'portable-air-cooler-ay-yd2536',
      'pvc-gloves',
      'solar-street-lights',
    ]);
  });

  it('the README headline count matches the data', async () => {
    const fs = await import('node:fs');
    const readme = fs.readFileSync('README.md', 'utf8');
    expect(readme).toContain(`**${products.length} products across ${categories.length} categories**`);
  });

  it('every product image file exists on disk', async () => {
    const fs = await import('node:fs');
    for (const p of products) {
      for (const img of p.images) {
        expect(fs.existsSync(`src/assets/products/${img}`)).toBe(true);
      }
    }
  });
});
