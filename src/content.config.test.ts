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

    it('has no datasheet on any product yet, so that control renders nowhere', () => {
      expect(products.filter((p) => 'datasheetUrl' in p)).toHaveLength(0);
    });

    /*
     * 10 of 94, because Kavalani does not carry most of the Spartan range —
     * confirmed by going through all 94 against their catalogue on 2026-08-17.
     * A missing link is the ordinary case here and renders no control at all.
     *
     * The count is recorded rather than pinned to a target: it should rise as
     * Kavalani lists more, and a test that treated growth as a failure would be
     * the wrong shape. What is asserted is that every link present is a real
     * Kavalani URL and that no two products point at the same page.
     */
    it('links only the products Kavalani actually carries', () => {
      const linked = products.filter((p) => 'kavalaniUrl' in p);
      expect(linked.length).toBeGreaterThan(0);
      expect(linked.length).toBeLessThan(products.length);

      for (const p of linked) {
        expect(p.kavalaniUrl).toMatch(/^https:\/\/(?:www\.)?kavalani\.com\//);
      }
    });

    /*
     * Two products sharing one Kavalani page would mean one of them is wrong —
     * the whole point of the link is that it lands on THIS product. Several
     * Spartan records cover a family that Kavalani splits into per-wattage or
     * per-size SKUs, so each such record points at one member of its own family;
     * two DIFFERENT records pointing at the same page is the error case.
     */
    it('never points two products at the same Kavalani page', () => {
      const urls = products.filter((p) => 'kavalaniUrl' in p).map((p) => p.kavalaniUrl);
      expect(new Set(urls).size).toBe(urls.length);
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

    it('accept an https URL on kavalani.com, with or without www', () => {
      for (const url of [
        'https://kavalani.com/spartan-highbay-light-6500k.html',
        'https://www.kavalani.com/spartan-highbay-light-6500k.html',
        // Real links in this catalogue carry percent-encoded spaces.
        'https://kavalani.com/welding%20sleeves%20grey%20leather.html',
      ]) {
        expect(() => productSchema.parse({ ...base, kavalaniUrl: url })).not.toThrow();
      }
    });

    /*
     * THE HOST CHECK IS THE WHOLE VALUE OF THIS FIELD BEING VALIDATED.
     *
     * A control reading "View on Kavalani" that navigates anywhere else is a
     * lie, and nothing at the point of entry prevents a pasted wrong URL — only
     * this does. Until the client confirmed the domain on 2026-08-17 this
     * accepted any https URL, and the test that sat here asserted that looseness
     * explicitly so it stayed visible instead of being forgotten. It is now the
     * opposite assertion.
     *
     * `kavalani.com.evil.test` is the one that matters: it contains the real
     * domain as a substring, which is exactly what a careless check would let
     * through.
     */
    it('reject any URL that is not on kavalani.com', () => {
      for (const url of [
        'https://example.com/p/1',
        'https://not-kavalani.com/p/1',
        'https://kavalani.com.evil.test/p/1',
        'https://evil.test/?x=https://kavalani.com/',
        'http://kavalani.com/p/1',
        '/p/1',
        'kavalani.com',
        '',
      ]) {
        expect(() => productSchema.parse({ ...base, kavalaniUrl: url })).toThrow();
      }
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
    //
    // 12 until 2026-08-17, when the client supplied cut-outs for the whole spill
    // control range — the seven that were hardest to source, because the banner
    // composites them into a warehouse scene with no separable product. They
    // arrived as genuine RGBA cut-outs (40-55% fully transparent with a soft
    // 6-10% edge), which matters: this panel is a dark radial gradient and a
    // flattened white background would render as a visible box. Verified on the
    // alpha channel, not on the filename.
    //
    // The five left are two different asks. The three air coolers need a
    // separable image from a flattened datasheet raster; PVC gloves and solar
    // street lights need the same banner treatment the spill range just got.
    const pending = products
      .filter((p) => p.images.includes('ds-photo-pending.png'))
      .map((p) => p.slug)
      .sort();
    expect(pending).toEqual([
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
