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

  it('every category hero product exists, except expanding categories', () => {
    const slugs = new Set(products.map((p) => p.slug));
    for (const c of categories) {
      if (c.status === 'expanding') expect(c.heroProductSlug).toBeNull();
      else expect(slugs.has(c.heroProductSlug!)).toBe(true);
    }
  });

  it('category product counts match the authoritative distribution', () => {
    // 72 brochure products + 7 from the industrial-fan datasheets, which is
    // why `fans` is 11 rather than the brochure's 4. Update deliberately: this
    // assertion exists to make an accidental duplicate or a lost record fail
    // loudly, so a number that changes without a matching data change is a bug.
    const expected: Record<string, number> = {
      lighting: 10, fans: 11, pumps: 3, insect: 1, cables: 1, accessories: 0,
      head: 7, eye: 6, hearing: 6, hand: 11, foot: 8, harness: 2, body: 4,
      workwear: 9, spill: 0,
    };
    const actual: Record<string, number> = {};
    for (const p of products) actual[p.categoryId] = (actual[p.categoryId] ?? 0) + 1;
    for (const [id, n] of Object.entries(expected)) expect(actual[id] ?? 0).toBe(n);
    expect(products).toHaveLength(79);
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
