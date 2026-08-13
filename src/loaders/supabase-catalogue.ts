/**
 * The Content Layer loader that reads the catalogue from Postgres.
 *
 * THIS IS THE SWAP POINT §5 OF handoff.md WAS BUILT FOR. `catalog.ts` and every
 * page above it are untouched: they still call `getCollection`, still receive
 * the same shapes, and cannot tell which loader filled the store.
 *
 * IT RUNS AT BUILD TIME, IN NODE — never in a browser and never in a request.
 * That is what makes it safe to use the service-role key here, and it is also
 * why the site stops building offline once this is switched on. That cost is
 * inherent to the choice, not a defect; `CATALOGUE_SOURCE=json` is the way back.
 *
 * FAILURE IS LOUD, DELIBERATELY. A read that errors, or returns nothing, or
 * returns implausibly little, throws and fails the build. The alternative is a
 * build that succeeds and publishes an empty or half-populated catalogue —
 * every product page gone, every category empty, and no error anywhere. On a
 * site whose whole content is the catalogue, a broken build is enormously
 * cheaper than a silent one.
 */
import type { Loader } from 'astro/loaders';
import { env, configured } from '../lib/env';

const URL_KEY = 'SUPABASE_URL';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** Rows below this and the read is treated as broken rather than as an answer. */
export const MINIMUM_ROWS = 1;

export interface CatalogueRow {
  [column: string]: unknown;
}

/* ------------------------------------------------------------- mapping -- */

/*
 * Postgres is snake_case and the Zod schemas are camelCase, so every row is
 * translated on the way in. These are pure and exported so the translation is
 * testable without a database — which is the only way it CAN be tested here,
 * since this machine has no credentials.
 *
 * Each one is written to fail loudly rather than quietly substitute: a missing
 * `en388` must stay missing (79 of 85 products have none, and an empty object
 * would assert the glove was tested), and a null `source` must stay null now
 * that admin-created records are allowed to have none.
 */

export function mapDivision(row: CatalogueRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    blurb: row.blurb,
    heroImage: row.hero_image,
    order: row.order,
  };
}

export function mapCategory(row: CatalogueRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    divisionId: row.division_id,
    description: row.description,
    heroProductSlug: row.hero_product_slug ?? null,
    status: row.status,
    order: row.order,
  };
}

export function mapProduct(row: CatalogueRow) {
  const mapped: Record<string, unknown> = {
    slug: row.slug,
    name: row.name,
    variantLabel: row.variant_label ?? null,
    categoryId: row.category_id,
    images: row.images ?? [],
    specs: row.specs ?? [],
    status: row.status ?? 'published',
    order: row.order,
  };

  /*
   * Set only when present. `en388: undefined` and no `en388` key are the same
   * to Zod's `.optional()`, but writing the key at all invites a later `?? {}`
   * that would not be — so it is simply absent. Same for `source`, which is
   * `.optional()`-shaped in the database now even though the Zod schema still
   * requires it; see the note in content.config.ts.
   */
  if (row.en388 != null) mapped.en388 = row.en388;
  if (row.source != null) mapped.source = row.source;

  return mapped;
}

/* -------------------------------------------------------------- loader -- */

export interface CatalogueLoaderOptions {
  /** Postgres table to read. */
  table: string;
  /** Which column identifies a row in the content store. */
  idColumn: string;
  /** Column to sort by, so the store is filled in a stable order. */
  orderColumn?: string;
  /** snake_case row to camelCase entry. */
  map: (row: CatalogueRow) => Record<string, unknown>;
}

export function supabaseCatalogue(options: CatalogueLoaderOptions): Loader {
  return {
    name: `supabase-${options.table}`,

    async load({ store, parseData, logger }) {
      if (!configured(URL_KEY, SERVICE_KEY)) {
        throw new Error(
          `CATALOGUE_SOURCE is 'postgres' but ${URL_KEY} and ${SERVICE_KEY} are not both set. ` +
            `Set them, or set CATALOGUE_SOURCE=json to build from the committed JSON.`,
        );
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(env(URL_KEY), env(SERVICE_KEY), {
        auth: { persistSession: false, autoRefreshToken: false },
      });

      const query = supabase.from(options.table).select('*');
      const { data, error } = options.orderColumn
        ? await query.order(options.orderColumn, { ascending: true })
        : await query;

      if (error) {
        throw new Error(`Reading public.${options.table} failed: ${error.message}`);
      }

      const rows = (data ?? []) as CatalogueRow[];

      /*
       * An empty table is not an empty catalogue, it is a broken read — a
       * migration half-run, a wrong project, a key without access. Building
       * from it would publish a site with no products and no error.
       */
      if (rows.length < MINIMUM_ROWS) {
        throw new Error(
          `public.${options.table} returned ${rows.length} rows. Refusing to build a catalogue ` +
            `from an empty table — seed it with tools/seed-catalogue.mjs, or set ` +
            `CATALOGUE_SOURCE=json.`,
        );
      }

      store.clear();

      for (const row of rows) {
        const id = String(row[options.idColumn]);
        // parseData validates against the collection's Zod schema, so a column
        // that drifts from the schema fails here rather than at render.
        const parsed = await parseData({ id, data: options.map(row) });
        store.set({ id, data: parsed });
      }

      logger.info(`Loaded ${rows.length} rows from public.${options.table}`);
    },
  };
}
