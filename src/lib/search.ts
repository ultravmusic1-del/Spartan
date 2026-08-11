import type { Product } from './catalog';

/**
 * What "matches" means, in one place.
 *
 * Two things need this rule and they run in different places: `searchProducts`
 * in catalog.ts, and the catalogue page's filter island, which searches the DOM
 * already on the page rather than calling anything. Two implementations of
 * "matches" would drift, and the way that shows up is a product findable by one
 * route and not the other — which reads as missing stock.
 *
 * So the searchable text is built once, here, and the page bakes it into each
 * product's `data-search` attribute at build time. The island then does the
 * same substring test against the same string the server would have used.
 */

/**
 * Fields joined with a newline, lowercased.
 *
 * The separator is load-bearing. Joining with a space would let a query span
 * two fields — "helmets abs" would match a product named "Helmets" whose first
 * spec value began "ABS", which is a match no single field makes and not what
 * `searchProducts` promised. A newline cannot appear in a typed query, so
 * `joined.includes(q)` is exactly "some field includes q".
 *
 * `variantLabel` is included because it is the only field distinguishing
 * otherwise near-identical variants: the two ear muffs differ solely by
 * "NRR 25dB" vs "NRR 20dB", which appears nowhere in their name or specs, so
 * without it those products are unreachable by the terms buyers actually use.
 */
export function productSearchText(
  product: Pick<Product, 'name' | 'variantLabel' | 'specs'>,
): string {
  return [product.name, product.variantLabel ?? '', ...product.specs.map((s) => s.value)]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
}

/** Case-insensitive substring match. Deliberately not fuzzy, tokenised or ranked. */
export function matchesQuery(
  product: Pick<Product, 'name' | 'variantLabel' | 'specs'>,
  query: string,
): boolean {
  return searchTextMatches(productSearchText(product), query);
}

/**
 * The half of the test the island can run, against text it was handed rather
 * than a product object it does not have.
 *
 * An empty query matches nothing rather than everything: `searchProducts('')`
 * returning all 72 products would make "no search" and "search for nothing"
 * indistinguishable at the call site. The catalogue page wants the opposite —
 * an empty box hides nothing — so it checks for empty itself before asking.
 */
export function searchTextMatches(searchText: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return searchText.includes(q);
}
