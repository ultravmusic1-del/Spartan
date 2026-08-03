/**
 * Every content read in the site funnels through this module. Pages and
 * components must never import JSON or call getCollection directly — that
 * indirection is what lets the data source become a database later.
 *
 * Derived values (product counts, related products, filtering) are computed
 * here rather than in templates, and callers get plain typed data — never
 * Astro's `{ id, data, collection }` entry wrappers.
 *
 * Search covers a product's name, variantLabel and spec values, matched as a
 * case-insensitive substring.
 */
import { getCollection } from 'astro:content';
// `astro:content` exports `z` as a const, not a namespace, so `import type { z }`
// from it cannot resolve `z.infer` (ts2503) — and that re-export is deprecated in
// Astro 7 besides. `astro/zod` is the documented replacement and is the exact zod
// instance (v4) the schemas in content.config.ts are built with.
import type { z } from 'astro/zod';
import type { productSchema, categorySchema, divisionSchema } from '../content.config';

export type Division = z.infer<typeof divisionSchema>;
export type Product = z.infer<typeof productSchema>;
export type Category = z.infer<typeof categorySchema> & { productCount: number };

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export async function getDivisions(): Promise<Division[]> {
  const rows = await getCollection('divisions');
  return rows.map((r) => r.data).sort(byOrder);
}

export async function getDivision(slug: string): Promise<Division | undefined> {
  return (await getDivisions()).find((d) => d.slug === slug);
}

async function publishedProducts(): Promise<Product[]> {
  const rows = await getCollection('products');
  return rows.map((r) => r.data).filter((p) => p.status === 'published').sort(byOrder);
}

export async function getCategories(
  opts: { divisionId?: string; status?: Category['status'] } = {},
): Promise<Category[]> {
  const rows = await getCollection('categories');
  const products = await publishedProducts();
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);

  return rows
    .map((r) => ({ ...r.data, productCount: counts.get(r.data.id) ?? 0 }))
    .filter((c) => (opts.divisionId ? c.divisionId === opts.divisionId : true))
    .filter((c) => (opts.status ? c.status === opts.status : true))
    .sort(byOrder);
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await getCategories()).find((c) => c.slug === slug);
}

export async function getProducts(
  opts: { categoryId?: string; divisionId?: string; limit?: number } = {},
): Promise<Product[]> {
  let products = await publishedProducts();

  if (opts.divisionId) {
    const cats = await getCategories({ divisionId: opts.divisionId });
    const ids = new Set(cats.map((c) => c.id));
    products = products.filter((p) => ids.has(p.categoryId));
  }
  if (opts.categoryId) products = products.filter((p) => p.categoryId === opts.categoryId);
  return opts.limit ? products.slice(0, opts.limit) : products;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await publishedProducts()).find((p) => p.slug === slug);
}

export async function getRelatedProducts(slug: string, limit = 4): Promise<Product[]> {
  const product = await getProduct(slug);
  if (!product) return [];
  const siblings = await getProducts({ categoryId: product.categoryId });
  return siblings.filter((p) => p.slug !== slug).slice(0, limit);
}

/**
 * Case-insensitive substring match over a product's name, variant label and
 * spec values. Deliberately not fuzzy, tokenised or ranked.
 *
 * `variantLabel` is searched because it is the only field distinguishing
 * otherwise near-identical variants: the two ear muffs differ solely by
 * "NRR 25dB" vs "NRR 20dB", which appears nowhere in their name or specs, so
 * without it those products are unreachable by the terms buyers actually use.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const products = await publishedProducts();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      // variantLabel is null on 56 of 72 products.
      (p.variantLabel?.toLowerCase().includes(q) ?? false) ||
      p.specs.some((s) => s.value.toLowerCase().includes(q)),
  );
}
