import { describe, it, expect } from 'vitest';
import { rowToProduct, productToRow } from './catalogue';

/**
 * The mapping is tested in BOTH directions because the database row and the
 * Content Layer entry are not the same shape, and a one-way test would let a
 * field silently disappear on save.
 */
describe('rowToProduct', () => {
  it('maps a database row to the shape productSchema expects', () => {
    const product = rowToProduct({
      slug: 'cut-flex',
      name: 'Cut Flex',
      variant_label: null,
      category_id: 'hand',
      images: ['p17-cut-flex.png'],
      specs: [{ label: 'Liner', value: 'Para Aramid' }],
      en388: { abrasion: '2', bladeCut: 'X', tear: '4', puncture: '4', tdmCut: 'C' },
      status: 'published',
      source: { doc: 'brochure', page: 17 },
      order: 6,
      datasheet_url: null,
      kavalani_url: null,
    });

    expect(product.slug).toBe('cut-flex');
    expect(product.variantLabel).toBeNull();
    expect(product.categoryId).toBe('hand');
    expect(product.order).toBe(6);
    expect(product.en388?.tdmCut).toBe('C');
  });
});

describe('productToRow', () => {
  it('round-trips without losing a field', () => {
    const row = {
      slug: 'cut-flex',
      name: 'Cut Flex',
      variant_label: null,
      category_id: 'hand',
      images: ['p17-cut-flex.png'],
      specs: [{ label: 'Liner', value: 'Para Aramid' }],
      en388: { abrasion: '2', bladeCut: 'X', tear: '4', puncture: '4', tdmCut: 'C' },
      status: 'published' as const,
      source: { doc: 'brochure', page: 17 },
      order: 6,
      datasheet_url: null,
      kavalani_url: null,
    };

    expect(productToRow(rowToProduct(row))).toEqual(row);
  });

  /*
   * The case above has an en388 and a source, so it never exercises the half of
   * the mapping that has to make a value ABSENT rather than undefined. That half
   * is where the round trip actually breaks: `.optional()` accepts a missing key
   * and rejects nothing for a present-and-undefined one, and `toEqual` reads
   * `{ en388: undefined }` as equal to `{}` — so a mapping that emitted
   * `undefined` on the way out would pass the test above and write a column of
   * undefineds. 79 of 94 products have no en388, and a source may legitimately
   * be null on an admin-created record, so this is the COMMON row, not the edge.
   */
  it('round-trips a row with no en388, no source and no links', () => {
    const row = {
      slug: 'led-floodlight',
      name: 'LED Floodlight',
      variant_label: '50W',
      category_id: 'floodlights',
      images: ['p3-led-floodlight.png'],
      specs: [],
      en388: null,
      status: 'draft' as const,
      source: null,
      order: 1,
      datasheet_url: null,
      kavalani_url: null,
    };

    const product = rowToProduct(row);
    expect('en388' in product).toBe(false);
    expect('source' in product).toBe(false);
    expect('datasheetUrl' in product).toBe(false);
    expect('kavalaniUrl' in product).toBe(false);
    expect(productToRow(product)).toEqual(row);
  });
});
