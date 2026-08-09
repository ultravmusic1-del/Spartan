/**
 * The enquiry payload contract — the one schema shared by the browser form and
 * the server endpoint.
 *
 * `zod/v4`, not bare `zod`. The top-level dependency is zod@3.25.76 whose main
 * entry is the v3 API, while `astro/zod` is 4.4.3 and backs the content
 * schemas. The v4 subpath is shipped inside the same installed package, so
 * importing it here keeps the whole repo on one zod major and one runtime
 * rather than bundling a second copy alongside Astro's. Verified to resolve
 * (`import('zod/v4')` succeeds and exposes the v4 surface).
 *
 * Every bound below is enforced again on the server. The browser applies the
 * same rules for the buyer's benefit, but a POST to /api/enquiry need not come
 * from the form at all — client-side validation is a courtesy, never a control.
 */
import { z } from 'zod/v4';

export const enquiryItemSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  /**
   * Mirrors `clampQty` in src/stores/enquiry.ts. Deliberately duplicated: the
   * store's clamp runs in the buyer's browser and so is worth exactly nothing
   * as a guarantee. 999 is an RFQ line, not a stock level.
   */
  qty: z.number().int().min(1).max(999),
  note: z.string().max(500).default(''),
});

export const enquiryPayloadSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  company: z.string().trim().max(160).default(''),
  /**
   * Piped rather than `z.string().trim().email(...)`: the string-method form is
   * deprecated in zod 4 and reports as a hint under `astro check`. Piping keeps
   * the order that matters — trim first, then validate, so a pasted address
   * with a trailing space is accepted rather than rejected — and the issue
   * still comes back on the `email` path with this message. 254 is the RFC 5321
   * maximum, and bounds the string before the format check ever sees it.
   */
  email: z.string().trim().max(254).pipe(z.email('Please enter a valid email address')),
  phone: z.string().trim().max(40).default(''),
  country: z.string().trim().max(80).default(''),
  /**
   * Which division the buyer is asking about, from the compact forms on the
   * home page and /contact. Free text rather than an enum keyed on the two
   * division slugs: the value is routing information for a human reading the
   * email, not a lookup, and a schema that rejects an unrecognised division
   * would lose the whole enquiry over a field nobody needs to be right. The
   * full /enquiry form omits it — the product list already says which
   * divisions are involved — so it defaults to empty and stays optional.
   */
  division: z.string().trim().max(80).default(''),
  message: z.string().trim().max(4000).default(''),
  /**
   * Empty is legitimate: a buyer can arrive at /enquiry with nothing collected
   * and send a general enquiry. 200 lines is far beyond any real RFQ against a
   * 72-product catalogue and exists only to bound the request.
   */
  items: z.array(enquiryItemSchema).max(200),
  /**
   * Which of the three forms converted. Stored so "does the home CTA actually
   * work" is a query rather than a guess.
   *
   * `.catch()` rather than a bare enum: this field is telemetry, and a payload
   * carrying an unrecognised value — a stale cached script after a rename, say —
   * must not cost the enquiry. An unknown source degrades to `'unknown'`; it
   * never returns a 400. The four values match the CHECK constraint on
   * `public.enquiries.source`.
   */
  source: z.enum(['enquiry', 'home-cta', 'contact', 'unknown']).catch('unknown'),
  /**
   * Honeypot. The field is present in the form but hidden from sight and from
   * assistive technology and removed from the tab order, so no real user can
   * put anything in it. A value means a bot filled every input it found.
   */
  website: z.string().max(0, 'Rejected'),
});

export type EnquiryPayload = z.infer<typeof enquiryPayloadSchema>;
export type EnquiryItemPayload = z.infer<typeof enquiryItemSchema>;

/** The field names the form renders an error beside. */
export type EnquiryFieldErrors = Partial<Record<keyof EnquiryPayload, string>>;

/**
 * Collapse zod's issue list to one message per top-level field, which is what
 * the form can actually render. Issues inside `items` are folded onto `items`
 * itself: those bounds are the store's own invariants, so a buyer can only
 * breach them by tampering, and there is no per-line error slot in the UI.
 */
export function toFieldErrors(issues: readonly z.core.$ZodIssue[]): EnquiryFieldErrors {
  const errors: EnquiryFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field !== 'string') continue;
    const key = field as keyof EnquiryPayload;
    // First issue per field wins — zod reports in schema order, so it is the
    // one nearest the top of the form.
    if (!(key in errors)) errors[key] = issue.message;
  }
  return errors;
}
