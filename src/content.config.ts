import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
// `z` from 'astro:content' is deprecated in Astro 7 and slated for removal.
// 'astro/zod' is the same zod instance Astro validates with (v4), so the
// schemas below stay byte-compatible with the Content Layer. src/lib/catalog.ts
// already imports its types from here for the same reason.
import { z } from 'astro/zod';
import { env } from './lib/env';
import {
  supabaseCatalogue,
  mapDivision,
  mapCategory,
  mapProduct,
} from './loaders/supabase-catalogue';

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

/*
 * THE SWAP POINT. This is what §5 of handoff.md exists for: replacing the
 * loader migrates the whole site onto a database without touching
 * src/lib/catalog.ts or any of the 110 pages above it.
 *
 * `CATALOGUE_SOURCE` selects which, and it DEFAULTS TO `json` PERMANENTLY.
 *
 * The design doc called for defaulting to postgres with json as the escape
 * hatch, and the parity build proved on 2026-08-13 that the two produce byte-
 * identical output — 522 files, no differences. The default still does not
 * move, and the reason is CI.
 *
 * `.github/workflows/verify.yml` runs the full gate on every push and holds no
 * Supabase secrets, deliberately: it is why the enquiry suite can run without
 * writing to the live database. With `postgres` as the default that workflow
 * would take the Postgres branch, find no credentials, and the loader would
 * throw exactly as it is supposed to — turning every CI run red, permanently,
 * for a reason unrelated to the change being tested.
 *
 * So the switch is made where the credentials actually live: an environment
 * variable on the deployment. `CATALOGUE_SOURCE=postgres` in Vercel, nothing in
 * CI, `json` here. Each environment then gets the source it can actually read,
 * and none of them decides implicitly.
 *
 * The rejected alternative was "postgres when credentials are present, json
 * otherwise". It would make CI green and production correct with no
 * configuration at all — and it would mean a deployment that lost its
 * credentials silently served a stale catalogue from committed files instead of
 * failing. That is precisely the silent success this loader was written to
 * refuse.
 *
 * Read through `env()` rather than `import.meta.env` directly, for the
 * precedence reason in src/lib/env.ts.
 */
const source = env('CATALOGUE_SOURCE') || 'json';

if (source !== 'json' && source !== 'postgres') {
  throw new Error(`CATALOGUE_SOURCE must be 'json' or 'postgres', not '${source}'.`);
}

const fromPostgres = source === 'postgres';

export const collections = {
  divisions: defineCollection({
    loader: fromPostgres
      ? supabaseCatalogue({
          table: 'divisions',
          idColumn: 'id',
          orderColumn: 'order',
          map: mapDivision,
        })
      : file('src/data/divisions.json', { parser: (t) => JSON.parse(t) }),
    schema: divisionSchema,
  }),
  categories: defineCollection({
    loader: fromPostgres
      ? supabaseCatalogue({
          table: 'categories',
          idColumn: 'id',
          orderColumn: 'order',
          map: mapCategory,
        })
      : file('src/data/categories.json', { parser: (t) => JSON.parse(t) }),
    schema: categorySchema,
  }),
  products: defineCollection({
    /*
     * Keyed on `slug`. The `file()` loader keys an array of objects on their
     * `id` field, and products have none — so the two loaders produce different
     * entry ids for this collection. That is safe, and checked: `catalog.ts` is
     * the only module allowed to call `getCollection` (rule 3, gated), and it
     * reads `entry.data` and never `entry.id`. No id reaches the built output,
     * which is what the byte-identical build test proves rather than assumes.
     */
    loader: fromPostgres
      ? supabaseCatalogue({
          table: 'products',
          idColumn: 'slug',
          orderColumn: 'order',
          map: mapProduct,
        })
      : file('src/data/products.json', { parser: (t) => JSON.parse(t) }),
    schema: productSchema,
  }),
};
