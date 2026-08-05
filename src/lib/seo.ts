/**
 * Structured data for the catalogue.
 *
 * THE RULE THIS MODULE EXISTS TO ENFORCE: this site has no prices, no stock,
 * no cart and no reviews. It is a catalogue and a lead-generation form. So a
 * Product node here may never carry `offers`, `price`, `priceCurrency`,
 * `availability`, `aggregateRating` or `review`. Google accepts all of them
 * without complaint and then shows a price that does not exist — which is the
 * structured-data form of inventing a specification, and this project's hard
 * rule is that nothing is invented. The return types below have no slot for
 * any of them, so it is a compile error rather than a matter of remembering.
 *
 * Everything a Product node says is read off the product's own record: its
 * name, its variant label and the spec rows printed in the client's brochure.
 * There is no marketing sentence anywhere in this file.
 *
 * Builders take the site origin as an argument rather than reading
 * `Astro.site`, so they stay pure and testable outside a page render.
 */
import type { Product } from './catalog';
import site from '../data/site.json';

const SCHEMA_CONTEXT = 'https://schema.org';

/** The brand, as it is written. Both divisions ship under the one name. */
export const BRAND_NAME = 'Spartan';

/**
 * Meta descriptions are truncated by search engines somewhere around 155-160
 * characters, but a structured-data description is also read by assistants and
 * previews, so it is allowed to run longer. 300 is the ceiling; the builder
 * cuts at a whole spec row below it rather than mid-value.
 *
 * `productDescription` takes the ceiling as an argument so the same text can be
 * cut twice from the same source: 300 for the JSON-LD node, ~160 for the page's
 * meta description. Two builders would drift; one builder with two budgets
 * cannot.
 */
const MAX_DESCRIPTION = 300;

export interface BrandNode {
  '@type': 'Brand';
  name: string;
}

/** Note what is absent: no offers, price, availability, rating or review. */
export interface ProductJsonLd {
  '@context': string;
  '@type': 'Product';
  name: string;
  description: string;
  brand: BrandNode;
  url: string;
  image?: string;
  category?: string;
}

export interface ListItemNode {
  '@type': 'ListItem';
  position: number;
  name: string;
  /** Absent on the current page, which is a destination the user is already at. */
  item?: string;
}

export interface BreadcrumbJsonLd {
  '@context': string;
  '@type': 'BreadcrumbList';
  itemListElement: ListItemNode[];
}

export interface ItemListEntry {
  '@type': 'ListItem';
  position: number;
  name: string;
  url: string;
}

export interface ItemListJsonLd {
  '@context': string;
  '@type': 'ItemList';
  numberOfItems: number;
  itemListElement: ItemListEntry[];
}

export interface OrganizationJsonLd {
  '@context': string;
  '@type': 'Organization';
  name: string;
  url: string;
  logo: string;
  foundingDate: string;
}

export interface Crumb {
  name: string;
  /** Omitted on the current page. */
  url?: string;
}

/** Resolves a site-root path against the origin; already-absolute URLs pass through. */
export function absoluteUrl(path: string, siteUrl: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : new URL(path, siteUrl).href;
}

/**
 * The name a buyer sees. Sixteen products share a name with a sibling and are
 * told apart only by `variantLabel` — the two ear muffs differ solely by
 * "NRR 25dB" vs "NRR 20dB" — so a bare `name` would put duplicate entities in
 * the index.
 */
export function productFullName(product: Pick<Product, 'name' | 'variantLabel'>): string {
  return product.variantLabel ? `${product.name} ${product.variantLabel}` : product.name;
}

/**
 * The product's own name followed by its printed specifications, joined into a
 * sentence run. Spec rows without a label — 95 of the 225 in the catalogue —
 * contribute their bare value; nothing is dropped and no label is guessed.
 */
export function productDescription(
  product: Pick<Product, 'name' | 'variantLabel' | 'specs'>,
  max: number = MAX_DESCRIPTION,
): string {
  let text = productFullName(product);

  for (const spec of product.specs) {
    const value = spec.value.trim();
    if (!value) continue;
    const row = spec.label ? `${spec.label.trim()}: ${value}` : value;
    const next = `${text}. ${row}`;
    // +1 for the full stop the finished string ends on.
    if (next.length + 1 > max) break;
    text = next;
  }

  return `${text}.`;
}

/**
 * The configured site origin, in the form the builders above expect.
 *
 * `Astro.site` is `URL | undefined` — undefined the moment `site` is missing
 * from astro.config.mjs — and every URL emitted from this module is absolute by
 * definition, so there is no sensible fallback: a relative canonical or a
 * literal "undefined/products/x" in an Open Graph tag is worse than no page at
 * all. Failing the build with a named cause is the honest outcome, and putting
 * it here means the one message is shared by Seo.astro and by every page that
 * builds a JSON-LD node.
 */
/**
 * A structured-data node as the text that goes inside a
 * `<script type="application/ld+json">` block.
 *
 * JSON-LD has to be written with Astro's `set:html`, because a plain `{expr}`
 * is HTML-escaped and `&quot;` in place of `"` is not JSON any more. `set:html`
 * escapes nothing at all, and that moves one hazard onto us: an HTML parser
 * ends a script block at the first closing script tag it meets, wherever that
 * sits — inside a JSON string included. A product name carrying one would close
 * the block early, and every byte after it would be parsed as markup instead of
 * as data. Injected markup follows for free.
 *
 * Rewriting every "<" as its < escape closes that off. It is an ordinary
 * JSON string escape, so `JSON.parse` returns the identical string and
 * validators see no difference; the dangerous sequence simply never reaches the
 * HTML parser intact. The same substitution neutralises "<!--", which would
 * otherwise open a comment inside the block.
 *
 * No catalogue value contains "<" today — every one traces to the client's
 * brochure, and the built output confirms it. This exists for the CMS-backed
 * admin dashboard (handoff.md section 5), where the text becomes arbitrary and
 * this decision will not be revisited.
 */
export function serialiseJsonLd(node: object): string {
  return JSON.stringify(node).replace(/</g, '\\u003c');
}

export function requireSite(site: URL | undefined): string {
  if (!site) {
    throw new Error(
      'astro.config.mjs must set `site`: canonical, Open Graph and JSON-LD URLs are absolute by definition.',
    );
  }
  return site.href;
}

export interface ProductJsonLdOptions {
  /** Absolute or root-relative URL of the product photograph, when one exists. */
  image?: string;
  /** The category name, passed in because a product record holds only its id. */
  category?: string;
}

export function productJsonLd(
  product: Product,
  siteUrl: string,
  opts: ProductJsonLdOptions = {},
): ProductJsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Product',
    name: productFullName(product),
    description: productDescription(product),
    brand: { '@type': 'Brand', name: BRAND_NAME },
    url: absoluteUrl(`/products/${product.slug}`, siteUrl),
    ...(opts.image ? { image: absoluteUrl(opts.image, siteUrl) } : {}),
    ...(opts.category ? { category: opts.category } : {}),
  };
}

/**
 * Mirrors the trail the page actually renders, which is what Google asks for —
 * a BreadcrumbList that disagrees with the visible breadcrumbs is a mismatch,
 * not extra information. The last crumb is the current page and carries no
 * `item`.
 */
export function breadcrumbJsonLd(trail: Crumb[], siteUrl: string): BreadcrumbJsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((crumb, i) => ({
      '@type': 'ListItem' as const,
      position: i + 1,
      name: crumb.name,
      ...(crumb.url ? { item: absoluteUrl(crumb.url, siteUrl) } : {}),
    })),
  };
}

/**
 * The products on a listing page, in the order they are rendered. Positions are
 * 1-based per schema.org.
 */
export function itemListJsonLd(products: Product[], siteUrl: string): ItemListJsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'ItemList',
    numberOfItems: products.length,
    itemListElement: products.map((product, i) => ({
      '@type': 'ListItem' as const,
      position: i + 1,
      name: productFullName(product),
      url: absoluteUrl(`/products/${product.slug}`, siteUrl),
    })),
  };
}

export interface OrganizationJsonLdOptions {
  /** Root-relative or absolute URL of the logo image. */
  logo?: string;
}

/**
 * Deliberately four properties and no more.
 *
 * `address`, `telephone` and `email` are the obvious additions and all three
 * are still placeholders in src/data/site.json ("Address line, City, Country",
 * "+971 00 000 0000"). Publishing a placeholder address as structured data
 * would put a fabricated location into knowledge panels and map results, which
 * is strictly worse than publishing nothing. Add them here — and a
 * `PostalAddress` node with them — once the client supplies the real details.
 *
 * `sameAs` is absent for the same reason: the footer's social icons have no
 * destinations yet.
 */
export function organizationJsonLd(
  siteUrl: string,
  opts: OrganizationJsonLdOptions = {},
): OrganizationJsonLd {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Organization',
    name: BRAND_NAME,
    url: absoluteUrl('/', siteUrl),
    logo: absoluteUrl(opts.logo ?? '/favicon.png', siteUrl),
    // site.json holds it as a number; schema.org wants an ISO 8601 date, and a
    // bare year is a valid one.
    foundingDate: String(site.established),
  };
}
