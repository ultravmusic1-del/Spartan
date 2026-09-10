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
import { matchesQuery } from './search';

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

/**
 * True when a category is one the site offers a buyer a route to.
 *
 * Both conditions, not either — `status: 'expanding'` is an editorial flag and
 * `productCount` is the fact. A range marked expanding that has since been
 * stocked is listed again with no code change, and a range emptied by an admin
 * edit drops out the same way. `buildCategoryGroups` in src/lib/nav.ts already
 * pairs the two for the same reason.
 */
export function isListedCategory(category: Category): boolean {
  return !(category.status === 'expanding' && category.productCount === 0);
}

/**
 * The categories a buyer is offered a route to, which is what every
 * buyer-facing surface reads: the header and mobile nav, the footer, both
 * category shelves, the division pages, the catalogue filter, and every
 * category count rendered beside them.
 *
 * Counts come from this list rather than from `getCategories()` on purpose. A
 * division door reading "6 categories" above a shelf of five tiles is the
 * inconsistency this replaces, and it was visible on one screen.
 *
 * It is deliberately NOT what `getStaticPaths` reads. The page for an unlisted
 * range is still built and still answers on its own URL — withdrawing it from
 * navigation is a merchandising decision, and 404ing an address somebody may
 * already hold is a different and larger one. `getCategories()` stays the whole
 * catalogue and is what the page builder, the admin and every name lookup use.
 */
export async function getListedCategories(
  opts: { divisionId?: string; status?: Category['status'] } = {},
): Promise<Category[]> {
  return (await getCategories(opts)).filter(isListedCategory);
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
 * The rule itself lives in `src/lib/search.ts`, because the catalogue page's
 * filter island needs the same one and runs in the browser against text baked
 * into the DOM rather than against these records. Two implementations would
 * drift, and a product findable by one route and not the other reads to a buyer
 * as missing stock.
 */
export async function searchProducts(query: string): Promise<Product[]> {
  if (!query.trim()) return [];
  const products = await publishedProducts();
  return products.filter((p) => matchesQuery(p, query));
}
