import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
// `z` from 'astro:content' is deprecated in Astro 7 and slated for removal.
// 'astro/zod' is the same zod instance Astro validates with (v4), so the
// schemas below stay byte-compatible with the Content Layer. src/lib/catalog.ts
// already imports its types from here for the same reason.
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
  specs: z.array(z.object({ label: z.string().nullable(), value: z.string() })),
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

// The loader is the swap point. Replacing `file()` with a database loader
// migrates the whole site to a CMS without touching catalog.ts or any page.
export const collections = {
  divisions: defineCollection({
    loader: file('src/data/divisions.json', { parser: (t) => JSON.parse(t) }),
    schema: divisionSchema,
  }),
  categories: defineCollection({
    loader: file('src/data/categories.json', { parser: (t) => JSON.parse(t) }),
    schema: categorySchema,
  }),
  products: defineCollection({
    loader: file('src/data/products.json', { parser: (t) => JSON.parse(t) }),
    schema: productSchema,
  }),
};
