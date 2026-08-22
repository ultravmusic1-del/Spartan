import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { env } from './lib/env';
import {
  supabaseCatalogue,
  mapDivision,
  mapCategory,
  mapProduct,
} from './loaders/supabase-catalogue';
import { divisionSchema, categorySchema, productSchema } from './lib/catalogue-schema';

/*
 * THE SCHEMAS LIVE IN src/lib/catalogue-schema.ts, and are re-exported here so
 * that every existing `import { productSchema } from './content.config'` keeps
 * resolving — src/content.config.test.ts and tools/seed-catalogue.test.ts both
 * do, and src/lib/catalog.ts imports its types from here.
 *
 * They moved out on 2026-08-22 so the admin could validate a save against the
 * same objects the build validates against WITHOUT importing this file. This
 * one cannot be imported cheaply: it pulls `astro:content`, `astro/loaders` and
 * the Supabase loader, and a route that imported it at runtime was measured
 * dragging `node:fs`, `js-yaml`, `smol-toml`, `picomatch` and `xxhash-wasm`
 * into its server chunk — plus the module-scope `CATALOGUE_SOURCE` throw below,
 * which is correct for a build and has no business failing an admin cold start.
 *
 * There is still exactly one `productSchema` in the codebase. That was never
 * negotiable; only its address changed.
 */
export { divisionSchema, categorySchema, productSchema };

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
