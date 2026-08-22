/**
 * Every admin read and write of CATALOGUE data — products and categories.
 *
 * The admin's second seam. `src/lib/catalog.ts` is how the public site reads the
 * catalogue and this is how the admin does; between them, nothing else may touch
 * `public.products` or `public.categories` on the admin's behalf. The build
 * still reads those tables through `src/loaders/supabase-catalogue.ts`, which is
 * a different consumer with a different job, and the one-off seed script writes
 * them once. Neither is a route. This module is the only door a REQUEST goes
 * through, and once the write side lands it is the only thing in the running
 * site that writes a product at all.
 *
 * IT MIRRORS src/lib/admin/enquiries.ts ON PURPOSE — same `AdminResult` states,
 * same lazy client behind a `configured()` guard, same rule that a read which
 * could not look never returns an empty array to say so. Two modules doing the
 * same job in two different shapes is how the second one drifts, and the reasons
 * enquiries.ts gives for each of those choices apply here unchanged. Read its
 * header rather than have them restated badly here.
 *
 * Uses the service-role key, which bypasses RLS, and is therefore safe only
 * because every caller sits behind the middleware guard.
 *
 * ---------------------------------------------------------------------------
 * VALIDATION USES THE SCHEMAS THE BUILD USES. THERE IS NO ADMIN-SIDE COPY.
 *
 * `productSchema` and `categorySchema` come from src/lib/catalogue-schema.ts,
 * which is the single definition of both and is what the Content Layer
 * validates against when the site is built. An admin-side copy is the obvious
 * implementation and it is a trap: the two drift, and the failure is both
 * delayed and misattributed. A save passes, the row looks fine, the admin screen
 * renders it — and a build fails hours later, possibly one somebody else
 * triggered for an unrelated reason, on a record they have never heard of.
 * Sharing the definition turns that into a form error at the moment of saving,
 * which is the only moment anyone can act on it.
 *
 * The direct import from src/content.config.ts was tried first and MEASURED
 * before it was rejected, on 2026-08-22. It resolves fine under Vitest and
 * `astro check` — but a server route that used the schema at runtime, which is
 * what validating a save is, came back with `node:fs`, `js-yaml`, `smol-toml`,
 * `picomatch`, `xxhash-wasm` and the catalogue loader's build-time error strings
 * in its chunk, and with content.config.ts's module-scope `CATALOGUE_SOURCE`
 * throw newly able to fail an admin cold start. So the schemas moved to a file
 * that imports nothing but zod, and content.config.ts re-exports them. There is
 * still exactly one `productSchema`. What must not happen is a second one
 * appearing here.
 */
import type { z } from 'astro/zod';
import { productSchema, categorySchema } from '../catalogue-schema';
import { env, configured } from '../env';
import type { AdminResult } from './enquiries';

const URL_KEY = 'SUPABASE_URL';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/*
 * Re-exported, not redeclared. `AdminResult` is a four-line structural type and
 * copying it here would cost nothing today — which is exactly how the schema
 * trap above starts. One definition, imported as a type so nothing crosses at
 * runtime; callers of this module never need to know it was first written for
 * the enquiry inbox.
 */
export type { AdminResult };

const ok = <T>(data: T): AdminResult<T> => ({ state: 'ok', data });
const UNCONFIGURED = { state: 'unconfigured' } as const;
const FAILED = { state: 'failed' } as const;

/* --------------------------------------------------------------- types -- */

/** Exactly what the Content Layer validates. Not a description of it. */
export type Product = z.infer<typeof productSchema>;
export type Category = z.infer<typeof categorySchema>;

/**
 * A product as the DATABASE can actually hold one: `Product` with `source`
 * optional.
 *
 * That gap is real and it is documented on the migration, not an oversight
 * here. `products.source` is nullable, because a record created in the admin has
 * no brochure page to cite — its provenance is the `catalogue_audit` row that
 * created it. `productSchema` still requires `source`. So the database can hold
 * a product this module must be able to read and put in front of an editor, but
 * which the schema would reject.
 *
 * Modelling that rather than papering over it is the point. The alternatives
 * were to invent a `source` on the way out, which is rule 1 with extra steps, or
 * to type the read as `Product` and let a null column arrive as a lie about the
 * record's provenance. The tension is left visible so the write side has to
 * decide about it deliberately.
 */
export type ProductRecord = Omit<Product, 'source'> & { source?: Product['source'] };

/** The columns of public.products, verbatim. `order` is quoted in SQL. */
export interface ProductRow {
  slug: string;
  name: string;
  variant_label: string | null;
  category_id: string;
  images: string[];
  specs: Product['specs'];
  en388: NonNullable<Product['en388']> | null;
  status: Product['status'];
  source: Product['source'] | null;
  order: number;
  datasheet_url: string | null;
  kavalani_url: string | null;
}

/** The columns of public.categories, verbatim. */
export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  division_id: string;
  description: string;
  hero_product_slug: string | null;
  status: Category['status'];
  order: number;
}

/* ------------------------------------------------------------- mapping -- */

/*
 * Postgres is snake_case and nullable; the schemas are camelCase and use absence
 * rather than null. Both directions are written out and both are tested, because
 * a one-way mapping is how a field silently disappears on save.
 *
 * The same translation exists in src/loaders/supabase-catalogue.ts, and the
 * duplication is deliberate rather than missed: that one runs at build time,
 * returns `Record<string, unknown>` for `parseData` to validate, and is one
 * direction only. This one is typed, reversible, and has to survive a round trip
 * through a form. Sharing them would mean one function serving two contracts;
 * they are checked against each other by the build, which validates whatever
 * this module writes.
 */

/** An absent optional must be ABSENT, not present-and-undefined — see below. */
export function rowToProduct(row: ProductRow): ProductRecord {
  return {
    slug: row.slug,
    name: row.name,
    variantLabel: row.variant_label,
    categoryId: row.category_id,
    images: row.images,
    specs: row.specs,
    status: row.status,
    order: row.order,
    /*
     * Conditional spreads, and the distinction they preserve is not cosmetic.
     * Zod's `.optional()` accepts a missing key and also accepts an explicit
     * `undefined`, so both parse — but `'en388' in product` tells them apart,
     * and so does anything that iterates keys or serialises to JSON. Writing
     * `en388: undefined` here would put an `en388` key on 79 of 94 products
     * that have no EN 388 rating at all, and the next `?? {}` someone adds
     * downstream turns "never tested" into an empty test result. On safety
     * equipment that is rule 1, not tidiness.
     */
    ...(row.en388 !== null ? { en388: row.en388 } : {}),
    ...(row.source !== null ? { source: row.source } : {}),
    ...(row.datasheet_url !== null ? { datasheetUrl: row.datasheet_url } : {}),
    ...(row.kavalani_url !== null ? { kavalaniUrl: row.kavalani_url } : {}),
  };
}

/** The inverse. Absence becomes NULL, never `undefined` and never `''`. */
export function productToRow(product: ProductRecord): ProductRow {
  return {
    slug: product.slug,
    name: product.name,
    variant_label: product.variantLabel,
    category_id: product.categoryId,
    images: product.images,
    specs: product.specs,
    en388: product.en388 ?? null,
    status: product.status,
    source: product.source ?? null,
    order: product.order,
    datasheet_url: product.datasheetUrl ?? null,
    kavalani_url: product.kavalaniUrl ?? null,
  };
}

/**
 * Categories need no reverse mapping yet — nothing writes one. It belongs with
 * the code that first needs it, next to a test that proves it round-trips.
 */
export function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    divisionId: row.division_id,
    description: row.description,
    heroProductSlug: row.hero_product_slug,
    status: row.status,
    order: row.order,
  };
}

/* --------------------------------------------------------------- reads -- */

const ready = (): boolean => configured(URL_KEY, SERVICE_KEY);

async function client() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env(URL_KEY), env(SERVICE_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Read a whole small table, and REFUSE A TRUNCATED ANSWER.
 *
 * PostgREST applies the project's row ceiling to an unbounded select and returns
 * the short set with no error and no flag, which is why enquiries.ts pages and
 * batches everything. The catalogue does not need paging — 94 products and 15
 * categories, bounded by a person typing them in — but it does need the same
 * refusal, because a silently short product list is a screen that says a product
 * does not exist. Asking for the exact count alongside the rows costs one cheap
 * aggregate and makes truncation loud: `failed`, not a shorter list.
 */
async function readTable<T>(
  query: PromiseLike<{ data: unknown; error: { message: string } | null; count: number | null }>,
): Promise<T[]> {
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as T[];
  if (count !== null && rows.length < count) {
    throw new Error(`read returned ${rows.length} of ${count} rows — truncated`);
  }
  return rows;
}

/**
 * Every product, drafts included: this is the editor's list, not the site's, and
 * a draft the admin cannot see is a draft nobody can publish.
 *
 * Ordered by category then `order`, which is the order the catalogue is edited
 * in rather than the order it is stored in. `order` is a reserved word and is
 * quoted in SQL; PostgREST takes the bare name.
 */
export async function listProducts(): Promise<AdminResult<ProductRecord[]>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const rows = await readTable<ProductRow>(
      supabase
        .from('products')
        .select('*', { count: 'exact' })
        .order('category_id', { ascending: true })
        .order('order', { ascending: true }),
    );
    return ok(rows.map(rowToProduct));
  } catch (cause) {
    console.error('[admin] listProducts failed', cause);
    return FAILED;
  }
}

/** `ok(null)` means the slug is genuinely not there. It is NOT `failed`. */
export async function getProduct(slug: string): Promise<AdminResult<ProductRecord | null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ok(data ? rowToProduct(data as ProductRow) : null);
  } catch (cause) {
    console.error('[admin] getProduct failed', cause);
    return FAILED;
  }
}

export async function listCategories(): Promise<AdminResult<Category[]>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const rows = await readTable<CategoryRow>(
      supabase.from('categories').select('*', { count: 'exact' }).order('order', { ascending: true }),
    );
    return ok(rows.map(rowToCategory));
  } catch (cause) {
    console.error('[admin] listCategories failed', cause);
    return FAILED;
  }
}

/** Keyed on `id`, the primary key — not on `slug`, which the public site uses. */
export async function getCategory(id: string): Promise<AdminResult<Category | null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ok(data ? rowToCategory(data as CategoryRow) : null);
  } catch (cause) {
    console.error('[admin] getCategory failed', cause);
    return FAILED;
  }
}
