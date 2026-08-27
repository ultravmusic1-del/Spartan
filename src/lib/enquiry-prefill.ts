/**
 * Carrying a product from its page into the message box on /contact and
 * /enquiry.
 *
 * A buyer reading a product and clicking "Ask about this product" or "Request a
 * quote" arrives at a form that, until now, had no idea what they had been
 * looking at. The contact page says so in its own words — "so nobody has to
 * work out which of four ventilation fan sizes you meant" — and then asked the
 * buyer to type it themselves. This module is the thing that answers that.
 *
 * WHY THE QUERY STRING AND NOT THE SERVER. Both destinations are prerendered,
 * so there is no request to read a parameter from: the page is built once, long
 * before anyone clicks. Everything here therefore runs in the browser, after
 * hydration, and the links stay ordinary <a> elements — which is deliberate.
 * `products/[slug].astro` keeps that link precisely because it works with
 * JavaScript off, and turning it into a click handler to smuggle state across
 * would have traded a working control for a convenience.
 *
 * WHY THE NAME TRAVELS IN THE URL. The destination needs a display name for the
 * message and, on /enquiry, for the basket line. Neither page holds the
 * catalogue, and shipping a slug-to-name map to both to avoid one parameter
 * costs about 2 KB gzipped on each for no gain a buyer can feel. It is not an
 * injection route — every value here is assigned with `.value`, never as HTML —
 * and `enquiryPayloadSchema` re-checks every field on submit, which is the only
 * place a bound counts. The worst a crafted link can do is prefill the sender's
 * own form with something silly.
 *
 * WHAT IS NOT TAKEN FROM THE URL: the product link. It is rebuilt from the slug
 * against the page's own origin, so it can only ever point at a product page on
 * this site. A URL parameter naming a destination is how an open redirect
 * starts, and there is no reason to accept one here.
 *
 * The two exported functions are pure so they can be tested without a DOM.
 * `applyProductPrefill` in this file's consumers does the impure half.
 */

export type EnquiryIntent = 'quote' | 'info';

export interface ProductContext {
  slug: string;
  name: string;
  intent: EnquiryIntent;
}

/**
 * Bounds match `enquiryItemSchema` rather than being chosen here: the basket
 * stores this name, and a value this module accepted but the schema rejected
 * would fail at submit time, on a field the buyer never filled in.
 */
const SLUG_MAX = 120;
const NAME_MAX = 200;

/** Catalogue slugs are lower-case, digits and single hyphens. Nothing else. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isIntent = (value: string): value is EnquiryIntent => value === 'quote' || value === 'info';

/**
 * Read the product a buyer arrived with, or null if they arrived without one.
 *
 * Null is the ordinary case, not an error: most visitors reach /contact and
 * /enquiry directly, and every rejection below simply means "no prefill".
 *
 * `fallbackIntent` is the wording that page would use anyway, so a link that
 * loses its `intent` parameter degrades to the right sentence rather than to
 * nothing. It is never a guess: /contact asks for information and /enquiry asks
 * for a quotation, whoever arrives.
 */
export function readProductContext(
  search: string,
  fallbackIntent: EnquiryIntent,
): ProductContext | null {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return null;
  }

  const slug = (params.get('product') ?? '').trim();
  if (!slug || slug.length > SLUG_MAX || !SLUG_PATTERN.test(slug)) return null;

  // Collapsed rather than merely trimmed. A name arrives through a query string
  // and then goes into a textarea, where a stray newline would break the two
  // lines this message is made of into three and read as the buyer's own text.
  const name = (params.get('name') ?? '').replace(/\s+/g, ' ').trim();
  if (!name || name.length > NAME_MAX) return null;

  const requested = (params.get('intent') ?? '').trim();
  const intent = isIntent(requested) ? requested : fallbackIntent;

  return { slug, name, intent };
}

/** The product's page on this site, built from the slug and never read from the URL. */
export function productUrl(slug: string, origin: string): string {
  return `${origin.replace(/\/+$/, '')}/products/${slug}`;
}

/**
 * The text that lands in the message box.
 *
 * Deliberately short: name and link, and nothing else. The alternative was
 * pasting the specification table in, and a buyer faced with sixteen rows they
 * did not write deletes the lot rather than reading it — taking the product
 * name with it. Two lines survive being read.
 *
 * It ends with a blank line so there is somewhere obvious to start typing. The
 * schema trims the message, so the trailing space costs nothing on the wire.
 */
export function prefillMessage(context: ProductContext, origin: string): string {
  const opener =
    context.intent === 'quote'
      ? 'Please send a quotation for:'
      : "I'd like more information about:";

  return `${opener}\n\n${context.name}\n${productUrl(context.slug, origin)}\n\n`;
}
