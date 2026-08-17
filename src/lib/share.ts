/**
 * Share targets for a product page — WhatsApp, email and the raw URL.
 *
 * WHY THIS IS A MODULE AND NOT THREE TEMPLATE EXPRESSIONS
 *
 * Every string here ends up inside a query string, and the catalogue's spec
 * values are full of characters that mean something there: `+` (which arrives at
 * a mail client as a space), `&` (which starts the next parameter) and `#`
 * (which opens a fragment and drops everything after it). All three are real
 * values in `src/data/products.json`, none of them fails loudly, and the result
 * is a message that sends and arrives mangled. `src/lib/share.test.ts` pins each
 * one against the actual product it comes from.
 *
 * NOTHING HERE IS WRITTEN ABOUT THE PRODUCT
 *
 * The description is `productDescription()` — the product's own name followed by
 * its printed spec rows — which is the same builder the page's meta description
 * and its JSON-LD node already use. There is no marketing sentence, no adjective
 * and no inferred benefit in a share message, for exactly the reason there is
 * none on the page: it would be a claim about safety equipment that the
 * brochure does not make. A third description builder would also be a third
 * thing to drift; this is the one that is already tested.
 *
 * The name carries its `variantLabel`. Sixteen products share a name with a
 * sibling and the two ear muffs differ only by "NRR 25dB" — a share message
 * reading "Ear Muff" describes both of them, which is the wrong product half
 * the time.
 */
import type { Product } from './catalog';
import { BRAND_NAME, productDescription, productFullName } from './seo';

/**
 * Same budget as the page's meta description. A share message is read in a
 * notification preview, so a full spec table is worse than a short summary —
 * and `productDescription` cuts at a whole spec row rather than mid-value.
 */
const DESCRIPTION_MAX = 160;

export interface ShareTargets {
  /** The message body: name-led description, a blank line, then the link. */
  message: string;
  /** Email subject. WhatsApp has no equivalent field. */
  subject: string;
  /** `https://wa.me/?text=…` — no recipient, so the sender picks the contact. */
  whatsapp: string;
  /** `mailto:?subject=…&body=…` — no recipient, for the same reason. */
  email: string;
  /** The page URL, unencoded, for the copy-link control. */
  url: string;
}

export type ShareableProduct = Pick<Product, 'name' | 'variantLabel' | 'specs'>;

export function shareTargets(product: ShareableProduct, url: string): ShareTargets {
  const subject = `${productFullName(product)} — ${BRAND_NAME}`;

  /*
   * The link goes last and on its own line. Both clients linkify a bare URL at
   * the end of a message reliably; one sitting mid-sentence gets punctuation
   * swept into it often enough to matter.
   */
  const message = `${productDescription(product, DESCRIPTION_MAX)}\n\n${url}`;

  return {
    message,
    subject,
    whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
    email: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`,
    url,
  };
}
