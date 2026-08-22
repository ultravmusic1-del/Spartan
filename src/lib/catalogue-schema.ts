/**
 * The Zod schemas for the catalogue. THE ONLY DEFINITION OF THEM.
 *
 * These are what the Content Layer validates against at build time, and what
 * the admin validates a save against. One definition, deliberately: an
 * admin-side copy is the obvious implementation and it is a trap, because the
 * two drift and the failure is both delayed and misattributed. A save passes
 * against the copy, the row looks fine, the admin renders it — and a build
 * fails hours later against the real schema, possibly one somebody else
 * triggered for an unrelated reason, on a record they have never heard of.
 * Sharing the definition turns that into a form error at the moment of saving,
 * which is the only moment anyone can act on it.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS, RATHER THAN THESE LIVING IN src/content.config.ts.
 *
 * They did live there, and that is still where the collections are defined —
 * it re-exports everything below, so `import { productSchema } from
 * './content.config'` keeps working and this move changed no caller.
 *
 * They moved because content.config.ts cannot be imported cheaply. It pulls in
 * `astro:content`, `astro/loaders` and the Supabase catalogue loader, and an
 * admin route that imports it at RUNTIME — which validating a save is — drags
 * that whole graph into the server bundle with it. Measured on 2026-08-22 by
 * building a route that did exactly that: the chunk arrived carrying `node:fs`,
 * `js-yaml`, `smol-toml`, `picomatch`, `xxhash-wasm` and the loader's own
 * build-time error strings, none of which a request has any use for. Worse than
 * the weight, content.config.ts throws at module scope when `CATALOGUE_SOURCE`
 * is not `json` or `postgres` — correct for a build, and not something an admin
 * page should be able to fail its cold start on.
 *
 * So the schemas sit here, importing nothing but zod, and both the build and
 * the admin import them from here. The single-definition decision is untouched;
 * only the loader graph was left behind.
 *
 * `z` comes from 'astro/zod' rather than 'zod' because that is the exact zod
 * instance (v4) Astro validates with, so these stay byte-compatible with the
 * Content Layer. `z` from 'astro:content' is deprecated in Astro 7 and slated
 * for removal, which is why it is not used.
 */
import { z } from 'astro/zod';

export const divisionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  blurb: z.string(),
  heroImage: z.string(),
  order: z.number().int(),
});

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  divisionId: z.string(),
  description: z.string(),
  heroProductSlug: z.string().nullable(),
  status: z.enum(['active', 'expanding']),
  order: z.number().int(),
});

export const productSchema = z.object({
  slug: z.string(),
  name: z.string(),
  variantLabel: z.string().nullable(),
  categoryId: z.string(),
  images: z.array(z.string()).min(1),
  /*
   * `source` is per-row provenance and is OPTIONAL: a row without one is
   * covered by the product's own `source` below, which is how all 529 original
   * rows work and why this is not a required field.
   *
   * It exists because a record can now carry rows from two different documents.
   * The FR workwear specs came off the brochure; their certification rows came
   * off a marketing banner, and those are not the same class of evidence — the
   * Grip Guard GP1 banner prints an EN 388 rating that contradicts the glove's
   * own label, so artwork is demonstrably fallible about exactly the values
   * that matter most. A product-level `source` cannot say which row came from
   * which, and "audit a spec back to the page it was read off" is the whole
   * point of that field. Nothing renders this; it is for the next maintainer.
   */
  specs: z.array(
    z.object({
      label: z.string().nullable(),
      value: z.string(),
      source: z.string().optional(),
    }),
  ),
  // EN 388 mechanical protection levels, present only where the brochure
  // actually prints a "RESISTANCE SPECIFICATIONS" row for the product. Values
  // are the printed levels ("4", "X", "B", ...), kept as strings because the
  // standard uses both digits and letters. Optional on purpose: a missing
  // rating must read as missing, never as a default.
  en388: z
    .object({
      abrasion: z.string(),
      bladeCut: z.string(),
      tear: z.string(),
      puncture: z.string(),
      tdmCut: z.string(),
    })
    .optional(),
  status: z.enum(['published', 'draft']).default('published'),
  /**
   * A downloadable datasheet for this product. Optional, and **absent on all 94
   * records today** — there is not a single PDF in this repository or on this
   * machine, so the control this field drives renders for nothing. That is the
   * honest state, not an oversight: the field exists so that supplying a
   * datasheet is a data edit rather than a code change.
   *
   * Either a site-root path (`/datasheets/led-floodlights.pdf`) or an absolute
   * https URL. **It must end in `.pdf`**, and that is deliberate rather than
   * fussy: the control says "Download datasheet", and pointing it at a web page
   * would make the button lie about what it does. If a datasheet ever arrives in
   * another format, this is a one-line change and someone should make it on
   * purpose.
   */
  datasheetUrl: z
    .string()
    .regex(
      /^(?:https:\/\/[^\s]+|\/[^\s]*)\.pdf$/i,
      'datasheetUrl must be a site-root path or an https URL ending in .pdf',
    )
    .optional(),
  /**
   * This product's page on the Kavalani site, where it can actually be bought.
   *
   * Optional, and present on 10 of 94 records — Kavalani does not carry most of
   * the Spartan range. A missing link is the common case and renders no control
   * at all, which is correct: the alternative is a button that promises a
   * listing that does not exist.
   *
   * **THE HOST IS PINNED, AND THAT IS THE POINT OF THIS FIELD BEING VALIDATED
   * AT ALL.** A control reading "View on Kavalani" that navigates anywhere else
   * is a lie, and no amount of care at the point of entry prevents a pasted
   * wrong URL — only this does. The domain was confirmed by the client on
   * 2026-08-17; until then this accepted any https URL and a unit test asserted
   * that looseness so it stayed visible rather than being forgotten.
   *
   * `www.` is allowed because a redirect between the two is ordinary and a
   * correct link should not fail the build over it. Any other host does fail,
   * loudly, at build time.
   */
  kavalaniUrl: z
    .string()
    .regex(
      /^https:\/\/(?:www\.)?kavalani\.com\/[^\s]*$/,
      'kavalaniUrl must be an https URL on kavalani.com',
    )
    .optional(),
  /**
   * Provenance — where every value on this record can be checked against.
   *
   * This was `sourcePage: number` while there was exactly one source document.
   * There are now 21: the original brochure plus a per-product-family datasheet
   * for most of the Electricals range. A bare page number can no longer say
   * which document it indexes into, and "page 1" meaning a standalone datasheet
   * sitting beside "page 5" meaning brochure page 5 is worse than useless — it
   * reads as provenance while pointing nowhere.
   *
   * `doc` is `'brochure'` for the original 72 records, otherwise the source
   * PDF's filename verbatim. Not shown to users; this exists so a later
   * maintainer can audit a spec back to the page it was read off.
   */
  source: z.object({
    doc: z.string(),
    page: z.number().int(),
  }),
  order: z.number().int(),
});
