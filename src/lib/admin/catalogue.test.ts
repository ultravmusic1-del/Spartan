import { describe, it, expect } from 'vitest';
import {
  rowToProduct,
  productToRow,
  acceptProductEdit,
  acceptCategoryEdit,
  type ProductRecord,
  type Category,
} from './catalogue';

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

/**
 * THE READ-ONLY FIELDS ARE ENFORCED BY ABSENCE from the accepted-field list,
 * not by a `readonly` attribute. A disabled input is a hint to a browser; a
 * hand-crafted POST ignores it entirely, so every one of these tests posts the
 * forged value a `readonly` attribute would not have stopped.
 */
describe('acceptProductEdit', () => {
  const current: ProductRecord = {
    slug: 'cut-flex',
    name: 'Cut Flex',
    variantLabel: null,
    categoryId: 'hand',
    images: ['p17-cut-flex.png'],
    specs: [{ label: 'Liner', value: 'Para Aramid' }],
    en388: { abrasion: '2', bladeCut: 'X', tear: '4', puncture: '4', tdmCut: 'C' },
    status: 'published',
    source: { doc: 'brochure', page: 17 },
    order: 6,
  };

  it('applies the editable fields', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex II');
    form.set('category-id', 'hand');
    form.set('order', '9');
    form.set('spec-label-0', 'Liner');
    form.set('spec-value-0', 'Para Aramid, updated');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.name).toBe('Cut Flex II');
    expect(result.product.order).toBe(9);
    expect(result.product.specs).toEqual([{ label: 'Liner', value: 'Para Aramid, updated' }]);
  });

  it('ignores a posted slug', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', 'hand');
    form.set('order', '6');
    form.set('slug', 'hijacked');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.slug).toBe('cut-flex');
  });

  it('ignores a posted en388, which is the dangerous one', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', 'hand');
    form.set('order', '6');
    form.set('en388-bladeCut', 'D');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // X means NOT SUBMITTED for that test, not failed. Promoting it to D would
    // advertise cut resistance the glove has never been tested for.
    expect(result.product.en388?.bladeCut).toBe('X');
  });

  it('ignores a posted source, which is provenance rather than a field', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', 'hand');
    form.set('order', '6');
    form.set('source-doc', 'invented.pdf');
    form.set('source-page', '99');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.source).toEqual({ doc: 'brochure', page: 17 });
  });

  it('drops a spec row whose value is blank, and keeps a blank label', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', 'hand');
    form.set('order', '6');
    form.set('spec-label-0', '');
    form.set('spec-value-0', 'Thumb hole prevents slip');
    form.set('spec-label-1', 'Leftover');
    form.set('spec-value-1', '');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.specs).toEqual([{ label: null, value: 'Thumb hole prevents slip' }]);
  });

  /*
   * 67 spec rows across the 94 products carry a per-row `source`, and the form
   * neither shows it nor posts it. Both halves of this matter. Dropping it
   * deletes the provenance of exactly the rows the schema singles out as worth
   * auditing -- the FR certification rows read off a banner that contradicts a
   * glove's own label. Keeping it across an edit is worse: it would claim the
   * NEW value came off that page. So it survives an untouched value and dies
   * with a changed one.
   */
  const cited: ProductRecord = {
    ...current,
    specs: [
      { label: 'EN ISO 11612', value: 'A1 B1 C1', source: 'fr-workwear-banner.png' },
      { label: 'Liner', value: 'Para Aramid', source: 'brochure p17' },
    ],
  };

  it('carries a spec row source over when the value is untouched', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', 'hand');
    form.set('order', '6');
    form.set('spec-label-0', 'EN ISO 11612 (corrected label)');
    form.set('spec-value-0', 'A1 B1 C1');

    const result = acceptProductEdit(cited, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.specs[0]?.source).toBe('fr-workwear-banner.png');
  });

  it('drops a spec row source once the value has been changed', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', 'hand');
    form.set('order', '6');
    form.set('spec-label-0', 'EN ISO 11612');
    form.set('spec-value-0', 'A1 B1 C2');

    const result = acceptProductEdit(cited, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('source' in result.product.specs[0]!).toBe(false);
  });

  /*
   * A link is cleared by emptying its box, and that only works because the
   * candidate is built field by field rather than spread over the current
   * record. Spreading looks equivalent and makes a wrong link permanent: the
   * emptied field carries no value, so the old one survives underneath it.
   */
  it('clears a link when its field is emptied', () => {
    const linked: ProductRecord = { ...current, kavalaniUrl: 'https://kavalani.com/cut-flex' };
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', 'hand');
    form.set('order', '6');
    form.set('kavalani-url', '');

    const result = acceptProductEdit(linked, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect('kavalaniUrl' in result.product).toBe(false);
  });

  it('rejects an edit the build would reject', () => {
    const form = new FormData();
    form.set('name', '');
    form.set('category-id', 'hand');
    form.set('order', 'not a number');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(false);
  });

  /*
   * `Number('')` is 0, not NaN, so a blank order would satisfy
   * `z.number().int()` and quietly move the product to the front of its
   * category. Blank has to reach the schema as a non-number to be refused.
   */
  it('rejects a blank order rather than reading it as zero', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', 'hand');
    form.set('order', '');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(false);
  });
});

describe('acceptCategoryEdit', () => {
  const current: Category = {
    id: 'hand',
    slug: 'hand-protection',
    name: 'Hand Protection',
    divisionId: 'safety',
    description: 'Gloves for cut, heat and chemical hazards.',
    heroProductSlug: 'cut-flex',
    status: 'active',
    order: 3,
  };

  it('applies the editable fields, and a blank hero is null not empty', () => {
    const form = new FormData();
    form.set('name', 'Hand Protection and Gloves');
    form.set('description', 'Gloves for cut, heat and chemical hazards. Updated.');
    form.set('hero-product-slug', '');
    form.set('order', '4');

    const result = acceptCategoryEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.category.name).toBe('Hand Protection and Gloves');
    expect(result.category.heroProductSlug).toBeNull();
    expect(result.category.order).toBe(4);
  });

  it('ignores a posted id, slug, division and status', () => {
    const form = new FormData();
    form.set('name', 'Hand Protection');
    form.set('description', 'Unchanged.');
    form.set('hero-product-slug', 'cut-flex');
    form.set('order', '3');
    form.set('id', 'hijacked');
    form.set('slug', 'hijacked');
    form.set('division-id', 'electricals');
    form.set('status', 'expanding');

    const result = acceptCategoryEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.category.id).toBe('hand');
    expect(result.category.slug).toBe('hand-protection');
    expect(result.category.divisionId).toBe('safety');
    expect(result.category.status).toBe('active');
  });

  it('rejects an edit the build would reject', () => {
    const form = new FormData();
    form.set('name', 'Hand Protection');
    form.set('description', 'Unchanged.');
    form.set('order', 'not a number');

    const result = acceptCategoryEdit(current, form);
    expect(result.ok).toBe(false);
  });
});

/**
 * ABSENT IS NOT BLANK.
 *
 * A key missing from the form means that field was never offered, so it is
 * unchanged; a key present and empty means the editor cleared the box. Reading
 * both as '' makes every partial POST destructive, and the partial POST is not
 * hypothetical: the product form falls back to a disabled category display when
 * the category list cannot be read, and so posts no `category-id` at all.
 */
describe('acceptProductEdit and a form that did not offer every field', () => {
  const current: ProductRecord = {
    slug: 'cut-flex',
    name: 'Cut Flex',
    variantLabel: 'Large',
    categoryId: 'hand',
    images: ['p17-cut-flex.png'],
    specs: [
      { label: 'Liner', value: 'Para Aramid' },
      { label: 'Coating', value: 'Nitrile' },
    ],
    en388: { abrasion: '2', bladeCut: 'X', tear: '4', puncture: '4', tdmCut: 'C' },
    status: 'published',
    source: { doc: 'brochure', page: 17 },
    order: 6,
    kavalaniUrl: 'https://kavalani.com/cut-flex',
  };

  it('changes only what was posted, and loses nothing that was not', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex II');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.name).toBe('Cut Flex II');
    // Every one of these would have been blanked by reading absent as ''.
    expect(result.product.specs).toHaveLength(2);
    expect(result.product.categoryId).toBe('hand');
    expect(result.product.variantLabel).toBe('Large');
    expect(result.product.order).toBe(6);
    expect(result.product.kavalaniUrl).toBe('https://kavalani.com/cut-flex');
  });

  /*
   * The one that fails a build rather than looking wrong on a page. An empty
   * categoryId used to parse, and then verify's referential invariant failed
   * hours later on somebody else's push.
   */
  it('rejects a category that was posted and posted empty', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('category-id', '');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(false);
  });

  it('rejects a name that was posted and posted empty', () => {
    const form = new FormData();
    form.set('name', '');

    const result = acceptProductEdit(current, form);
    expect(result.ok).toBe(false);
  });
});

describe('acceptCategoryEdit and a form that did not offer every field', () => {
  const current: Category = {
    id: 'hand',
    slug: 'hand-protection',
    name: 'Hand Protection',
    divisionId: 'safety',
    description: 'Gloves for cut, heat and chemical hazards.',
    heroProductSlug: 'cut-flex',
    status: 'active',
    order: 3,
  };

  /*
   * The hero select is not rendered at all when the product list cannot be
   * read, because a text box there could name a product that does not exist and
   * fail the build. Absent therefore has to mean "unchanged" and not "cleared",
   * or the fallback would quietly unset every hero it was shown for.
   */
  it('keeps a hero the form did not offer', () => {
    const form = new FormData();
    form.set('name', 'Hand Protection');
    form.set('description', 'Gloves for cut, heat and chemical hazards.');
    form.set('order', '3');

    const result = acceptCategoryEdit(current, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.category.heroProductSlug).toBe('cut-flex');
  });

  it('rejects a description that was posted and posted empty', () => {
    const form = new FormData();
    form.set('description', '');

    const result = acceptCategoryEdit(current, form);
    expect(result.ok).toBe(false);
  });
});
