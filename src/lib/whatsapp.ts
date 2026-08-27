/**
 * WhatsApp links that open a conversation WITH Spartan.
 *
 * NOT THE SAME THING AS `src/lib/share.ts`, and the difference is the whole
 * reason this is a second module rather than an argument to that one.
 * `shareTargets` builds `https://wa.me/?text=…` with **no recipient**, so the
 * buyer picks who to forward a product to. Everything here addresses Spartan's
 * own number. One is the buyer talking to a colleague; the other is a lead.
 * Merging them would put a company number one wrong default away from every
 * share button on the site.
 *
 * WHY THE NUMBER IS READ AND NOT WRITTEN DOWN. It lives in `site.json` beside
 * the phone and the email, so it moves in one edit and the seam
 * (`src/lib/site-content.ts`) keeps its route to Postgres open. An empty string
 * means "no WhatsApp affordance" and every consumer here returns null, so the
 * controls simply do not render — the same honest empty state the datasheet and
 * Kavalani buttons use. `npm run verify` reports the field as unset when it is.
 *
 * WA.ME WANTS DIGITS, NOT A PHONE NUMBER AS A PERSON WRITES ONE. `+973 3800
 * 0458` in the path gives a broken link: the `+` and the spaces are not valid
 * there. This normalises, and it does it in one place because the alternative
 * is every caller remembering to — which is how one of them eventually does not.
 */

/** E.164 allows at most 15 digits, and a country code plus a subscriber number is never fewer than 8. */
const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

/**
 * The number as wa.me wants it: digits only, no `+`, no spaces.
 *
 * Null when there is no number or the value cannot be one. Null is the ordinary
 * unconfigured case, not an error — it is what makes the controls absent rather
 * than broken.
 */
export function whatsappDigits(raw: string): string | null {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;
  return digits;
}

/**
 * A wa.me link to Spartan carrying a prepared message, or null when
 * unconfigured.
 *
 * `encodeURIComponent` rather than a template string, and that is not
 * defensive tidiness. Product names in this catalogue carry `&`, `+` and `#`,
 * which in a query string mean next-parameter, space and fragment — so
 * `Cotton Pants & Shirts` sent raw arrives as `Cotton Pants ` with the rest
 * gone, and nothing anywhere reports it. Same trap `share.ts` documents at
 * length; `whatsapp.test.ts` pins it against the real product.
 */
export function whatsappLink(rawNumber: string, message: string): string | null {
  const digits = whatsappDigits(rawNumber);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * The message the floating button opens with, on any page.
 *
 * Short and open on purpose: it says who is being written to and where they
 * came from, and then gets out of the way. A longer opener is a script the
 * buyer has to delete before they can say what they actually want, and a
 * message they have to edit first is one they close instead.
 *
 * It carries the SITE, not the page. Naming the exact URL somebody was reading
 * when they tapped a floating button reads as surveillance rather than
 * service, and the product-specific message below is the honest way to carry a
 * page — because there the buyer chose to.
 */
export function generalEnquiryMessage(siteUrl: string): string {
  return `Hi Spartan, I'd like to enquire about your products.\n\n${siteUrl}`;
}

/**
 * The message the product page's button opens with.
 *
 * Name and link, and nothing else — deliberately the same two lines the
 * contact and enquiry prefills use, so a buyer who arrives by any of the three
 * routes sends the same thing and the sales team reads one shape. The
 * alternative was the spec table, and a buyer faced with sixteen rows they did
 * not write deletes the lot, taking the product name with it.
 *
 * The name must carry its `variantLabel`: sixteen products share a name with a
 * sibling, and "Ear Muff" describes both of them.
 */
export function productEnquiryMessage(productName: string, productUrl: string): string {
  return `Hi Spartan, I'd like to enquire about:\n\n${productName}\n${productUrl}`;
}
