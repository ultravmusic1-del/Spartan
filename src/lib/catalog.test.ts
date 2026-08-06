import { describe, it, expect } from 'vitest';
import {
  getDivisions, getDivision, getCategories, getCategory,
  getProducts, getProduct, getRelatedProducts, searchProducts,
} from './catalog';

describe('catalog repository', () => {
  it('returns both divisions in order', async () => {
    const d = await getDivisions();
    expect(d.map((x) => x.id)).toEqual(['electricals', 'safety']);
  });

  it('finds a division by slug', async () => {
    expect((await getDivision('safety'))?.name).toBe('Spartan Safety');
  });

  it('returns undefined for an unknown division', async () => {
    expect(await getDivision('nope')).toBeUndefined();
  });

  it('returns all 15 categories ordered', async () => {
    const c = await getCategories();
    expect(c).toHaveLength(15);
    expect(c.map((x) => x.order)).toEqual([...c.map((x) => x.order)].sort((a, b) => a - b));
  });

  it('filters categories by division', async () => {
    const c = await getCategories({ divisionId: 'electricals' });
    expect(c).toHaveLength(6);
    expect(c.every((x) => x.divisionId === 'electricals')).toBe(true);
  });

  it('returns all 78 products', async () => {
    expect(await getProducts()).toHaveLength(78);
  });

  it('filters products by category', async () => {
    expect(await getProducts({ categoryId: 'hand' })).toHaveLength(11);
  });

  it('filters products by division across its categories', async () => {
    // Electricals is 19 brochure products + 6 industrial fans from the
    // datasheets. Safety is untouched by that work.
    expect(await getProducts({ divisionId: 'electricals' })).toHaveLength(25);
    expect(await getProducts({ divisionId: 'safety' })).toHaveLength(53);
  });

  it('computes productCount on categories', async () => {
    expect((await getCategory('hand-protection'))?.productCount).toBe(11);
  });

  it('reports zero products for expanding categories', async () => {
    for (const slug of ['spill-control', 'electrical-accessories']) {
      const c = await getCategory(slug);
      expect(c?.productCount).toBe(0);
      expect(c?.status).toBe('expanding');
    }
  });

  it('finds a product by slug', async () => {
    expect((await getProduct('safety-helmets'))?.name).toBe('Safety Helmets');
  });

  it('returns undefined for an unknown product', async () => {
    expect(await getProduct('does-not-exist')).toBeUndefined();
  });

  it('returns related products from the same category, excluding itself', async () => {
    const r = await getRelatedProducts('grip-guard-gp3', 3);
    expect(r).toHaveLength(3);
    expect(r.every((p) => p.categoryId === 'hand')).toBe(true);
    expect(r.some((p) => p.slug === 'grip-guard-gp3')).toBe(false);
  });

  it('returns an empty array of related products for an unknown slug', async () => {
    expect(await getRelatedProducts('does-not-exist')).toEqual([]);
  });

  it('searches by name case-insensitively', async () => {
    const r = await searchProducts('HELMET');
    expect(r.some((p) => p.slug === 'safety-helmets')).toBe(true);
  });

  it('searches spec values too', async () => {
    const r = await searchProducts('polycarbonate');
    expect(r.length).toBeGreaterThan(0);
  });

  it('searches variant labels', async () => {
    const r = await searchProducts('suede');
    expect(r.some((p) => p.slug === 'low-cut-safety-shoes-suede-leather')).toBe(true);
  });

  it('finds ear muffs by their NRR rating', async () => {
    const r = await searchProducts('NRR 25');
    expect(r.some((p) => p.slug === 'ear-muff-nrr-25db')).toBe(true);
  });

  it('returns nothing for an empty search', async () => {
    expect(await searchProducts('   ')).toEqual([]);
  });

  it('excludes draft products from every read', async () => {
    expect((await getProducts()).every((p) => p.status === 'published')).toBe(true);
  });

  it('respects the limit option', async () => {
    expect(await getProducts({ limit: 5 })).toHaveLength(5);
  });

  it('returns plain data, not Astro collection entries', async () => {
    const [p] = await getProducts({ limit: 1 });
    expect(p).not.toHaveProperty('data');
    expect(p).not.toHaveProperty('collection');
    expect(p).toHaveProperty('slug');
  });
});
