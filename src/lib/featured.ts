/**
 * The Featured Lines strip, curated by slug.
 *
 * WHY NOT getProducts({ limit: 8 }). `product.order` is per-category and its
 * values repeat across categories — only `category.order` is globally unique.
 * An unfiltered limited call therefore returns a semi-arbitrary cross-category
 * slice that changes shape whenever a category gains a product. A marketing
 * strip has to be chosen, so it is chosen here and nowhere else.
 *
 * The list is the design mockup's eight, unchanged. Four Electricals, four
 * Safety, so neither division tab is ever empty.
 */
import { getCategories, getProducts, type Product } from './catalog';

export const FEATURED_SLUGS = [
  'led-floodlights',
  'slim-led-panels',
  'pumps',
  'ventilation-fans-14-inch',
  'grip-guard-gp5',
  'safety-helmets',
  'high-cut-safety-shoes',
  'fire-retardant-cotton-coveralls',
] as const;

/** A product plus the two labels the card shows above and below its name. */
export type FeaturedProduct = Product & {
  divisionId: string;
  categoryName: string;
};

export async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const out: FeaturedProduct[] = [];
  for (const slug of FEATURED_SLUGS) {
    const product = bySlug.get(slug);
    // A missing slug is dropped rather than thrown: the unit test above is the
    // place that fails, and a marketing strip should never break a build.
    if (!product) continue;
    const category = byId.get(product.categoryId);
    // Unreachable on valid data: content.config.test.ts asserts every product's
    // categoryId resolves. The guard exists so a future integrity slip fails the
    // same soft way as a missing slug rather than throwing during a build.
    if (!category) continue;
    out.push({ ...product, divisionId: category.divisionId, categoryName: category.name });
  }
  return out;
}
