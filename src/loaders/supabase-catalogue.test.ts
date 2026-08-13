import { describe, it, expect } from 'vitest';
import { mapDivision, mapCategory, mapProduct } from './supabase-catalogue';

/*
 * The mapping is the whole of what can be tested here: this machine has no
 * Supabase credentials, so the loader's fetch cannot run. These are the pure
 * translations between Postgres's snake_case and the Zod schemas' camelCase,
 * and every case below is one where a plausible-looking shortcut would change
 * the meaning of a record rather than only its shape.
 */

describe('mapDivision', () => {
  it('renames hero_image and keeps the rest', () => {
    expect(
      mapDivision({
        id: 'safety',
        slug: 'safety',
        name: 'Spartan Safety',
        blurb: 'PPE.',
        hero_image: 'safety.jpg',
        order: 2,
      }),
    ).toEqual({
      id: 'safety',
      slug: 'safety',
      name: 'Spartan Safety',
      blurb: 'PPE.',
      heroImage: 'safety.jpg',
      order: 2,
    });
  });
});

describe('mapCategory', () => {
  it('renames the foreign key and the hero slug', () => {
    const mapped = mapCategory({
      id: 'hand',
      slug: 'hand-protection',
      name: 'Hand Protection',
      division_id: 'safety',
      description: 'Gloves.',
      hero_product_slug: 'grip-guard-gp5',
      status: 'active',
      order: 10,
    });
    expect(mapped.divisionId).toBe('safety');
    expect(mapped.heroProductSlug).toBe('grip-guard-gp5');
  });

  /*
   * Two categories legitimately have no hero product, because they stock
   * nothing. `null` is the schema's value for that and it must survive the trip
   * — undefined would fail validation and an empty string would name a product
   * that does not exist.
   */
  it('keeps a null hero product null', () => {
    const mapped = mapCategory({ hero_product_slug: null, status: 'expanding' });
    expect(mapped.heroProductSlug).toBeNull();
  });
});

describe('mapProduct', () => {
  const row = {
    slug: 'grip-guard-gp5',
    name: 'Grip Guard GP5',
    variant_label: null,
    category_id: 'hand',
    images: ['gp5.png'],
    specs: [{ label: 'Material', value: 'PU' }],
    en388: null,
    status: 'published',
    source: { doc: 'brochure', page: 16 },
    order: 3,
  };

  it('renames the columns the schema spells differently', () => {
    const mapped = mapProduct(row);
    expect(mapped.categoryId).toBe('hand');
    expect(mapped.variantLabel).toBeNull();
  });

  /*
   * 79 of 85 products have no EN 388 rating. The key must be ABSENT, not
   * present-and-empty: `{}` would fail the schema's required inner fields, and
   * anything that coerced it to a default would assert the glove had been
   * tested when it never was. That distinction is documented as a trap.
   */
  it('omits en388 entirely when there is none', () => {
    expect('en388' in mapProduct(row)).toBe(false);
    expect('en388' in mapProduct({ ...row, en388: undefined })).toBe(false);
  });

  it('carries en388 through when there is one', () => {
    const mapped = mapProduct({ ...row, en388: { abrasion: '4', tear: 'X' } });
    expect(mapped.en388).toEqual({ abrasion: '4', tear: 'X' });
  });

  /* Nullable since 2026-08-13: an admin-created product may cite no document. */
  it('omits source entirely when there is none', () => {
    expect('source' in mapProduct({ ...row, source: null })).toBe(false);
    expect(mapProduct(row).source).toEqual({ doc: 'brochure', page: 16 });
  });

  it('defaults status to published, matching the schema', () => {
    expect(mapProduct({ ...row, status: undefined }).status).toBe('published');
    expect(mapProduct({ ...row, status: 'draft' }).status).toBe('draft');
  });

  /*
   * An absent array becomes an empty one rather than undefined: `images` is
   * `.min(1)` in the schema, so this turns a missing column into a validation
   * error naming the product, instead of a TypeError somewhere in a template.
   */
  it('turns missing arrays into empty ones so the schema reports them', () => {
    const mapped = mapProduct({ ...row, images: null, specs: null });
    expect(mapped.images).toEqual([]);
    expect(mapped.specs).toEqual([]);
  });
});
