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

/* -------------------------------------------------------------- writes -- */

/**
 * READ-ONLY FIELDS ARE ENFORCED BY ABSENCE.
 *
 * `slug`, `en388` and `source` are never read from the form. They are carried
 * over from the record already in the database, so a hand-crafted POST that
 * sets them changes nothing. A `readonly` attribute in the markup is a hint to
 * a browser and is not a control; the form renders them disabled so an editor
 * can see what they are, and this list is what actually decides.
 *
 *   slug   -- a permanent URL. Changing one breaks every existing link into
 *             that product and discards the page's search ranking.
 *   en388  -- the one field where a wrong value misrepresents protective
 *             equipment. "X" means NOT SUBMITTED for that test, not failed, so
 *             promoting an X advertises resistance never tested for.
 *   source -- provenance. It records where a fact was read, and is not a fact
 *             an editor supplies.
 *   status -- read-only in this slice for a different reason: nothing filters
 *             on it, so a Published/Hidden control would be a switch that does
 *             nothing. Filed in BACKLOG.md rather than shipped.
 *
 * THE CANDIDATE IS BUILT FIELD BY FIELD, NOT SPREAD OVER `current`. Spreading
 * is shorter and it makes clearing a field impossible: an emptied Kavalani box
 * posts an empty string, the conditional spread declines to set the key, and
 * the old link survives underneath. Listing every field means the form is the
 * whole record and a blank box means blank -- which is recoverable from the
 * audit row, where a link nobody could remove is not.
 */
export type ProductEditResult =
  | { readonly ok: true; readonly product: Product }
  | { readonly ok: false; readonly issues: string[] };

export type CategoryEditResult =
  | { readonly ok: true; readonly category: Category }
  | { readonly ok: false; readonly issues: string[] };

const text = (form: FormData, key: string): string => form.get(key)?.toString().trim() ?? '';

/**
 * Blank is NOT zero. `Number('')` is 0, which `z.number().int()` accepts, so an
 * emptied order box would silently move a product to the front of its category
 * instead of being refused. NaN is the only value that reaches the schema as an
 * error the editor can see.
 */
const number = (form: FormData, key: string): number => {
  const raw = text(form, key);
  return raw === '' ? Number.NaN : Number(raw);
};

/**
 * `spec-label-N` / `spec-value-N` pairs, in index order, blank rows dropped.
 *
 * PER-ROW `source` IS CARRIED, NOT POSTED, AND ONLY FOR AN UNTOUCHED VALUE.
 * 67 spec rows carry one and the form has nowhere to show it, so posting it
 * back is not an option and dropping it deletes the provenance of the rows the
 * schema calls out as the ones most worth auditing. Carrying it unconditionally
 * is worse than dropping it: it would claim the edited value came off that
 * page. So the citation survives exactly while the value it cites is
 * byte-identical, and a re-labelled row keeps it because a label is not what
 * was read off the page.
 *
 * The match is by index, which holds because the edit form renders one input
 * pair per existing spec at its own index. A form that reorders or reindexes
 * rows breaks that quietly -- so it must not, and the value check is what keeps
 * a break from turning into a false citation.
 */
function specsFromForm(form: FormData, current: Product['specs']): Product['specs'] {
  const indices = [...form.keys()]
    .map((key) => /^spec-value-(\d+)$/.exec(key)?.[1])
    .filter((index): index is string => index !== undefined)
    .map(Number)
    .sort((a, b) => a - b);

  return indices
    .map((index) => {
      const value = text(form, `spec-value-${index}`);
      const cited = current[index];
      const citation =
        cited !== undefined && cited.source !== undefined && cited.value === value
          ? { source: cited.source }
          : {};
      return {
        // A row with no label is a bullet, which the brochure prints and which
        // the schema allows. A row with no VALUE is an empty row the editor did
        // not fill in, and is dropped below.
        label: text(form, `spec-label-${index}`) || null,
        value,
        ...citation,
      };
    })
    .filter((spec) => spec.value !== '');
}

/**
 * Takes `ProductRecord`, not `Product`, because that is what `getProduct`
 * returns and the gap between them is real: the column is nullable and the
 * schema requires a source. A record with none therefore fails validation here
 * with `source: ...` in its issues rather than being saved with an invented
 * one. No such record exists today -- all 94 have a source -- and when
 * admin-created products land, that is the decision to make deliberately.
 */
export function acceptProductEdit(current: ProductRecord, form: FormData): ProductEditResult {
  const datasheetUrl = text(form, 'datasheet-url');
  const kavalaniUrl = text(form, 'kavalani-url');

  const candidate = {
    // Carried over, never accepted from the form. See the note above.
    slug: current.slug,
    images: current.images,
    status: current.status,
    ...(current.en388 !== undefined ? { en388: current.en388 } : {}),
    ...(current.source !== undefined ? { source: current.source } : {}),

    // Editable.
    name: text(form, 'name'),
    variantLabel: text(form, 'variant-label') || null,
    categoryId: text(form, 'category-id'),
    specs: specsFromForm(form, current.specs),
    order: number(form, 'order'),
    ...(datasheetUrl !== '' ? { datasheetUrl } : {}),
    ...(kavalaniUrl !== '' ? { kavalaniUrl } : {}),
  };

  const parsed = productSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  return { ok: true, product: parsed.data };
}

export function acceptCategoryEdit(current: Category, form: FormData): CategoryEditResult {
  const candidate = {
    // Carried over. An id and a slug are permanent for the same reason a
    // product slug is, a division is not a thing a category edit moves, and
    // `status` drives the public "range still expanding" state.
    id: current.id,
    slug: current.slug,
    divisionId: current.divisionId,
    status: current.status,

    // Editable.
    name: text(form, 'name'),
    description: text(form, 'description'),
    heroProductSlug: text(form, 'hero-product-slug') || null,
    order: number(form, 'order'),
  };

  const parsed = categorySchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  return { ok: true, category: parsed.data };
}

/** `name: Required` rather than a Zod error object, because a form shows it. */
function issuesOf(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

/**
 * Writes the row and records the change.
 *
 * THERE IS NO LOCKING. Two admins editing the same product means the second
 * save wins and the first is lost. For a team of two to five that is the right
 * trade -- but *silently* is the operative word, which is why the audit row
 * carries `before`. The overwritten values are recoverable from it.
 *
 * A FAILED AUDIT INSERT DOES NOT FAIL THE SAVE, and is logged instead. The row
 * is already written by then, so returning `failed` would tell an editor their
 * change was lost when it was kept -- the enquiry rule, in a second place. What
 * is lost is the ability to recover what it overwrote, which is worth shouting
 * about in the log and is not worth a second, un-auditable write to undo.
 */
export async function saveProduct(
  actor: string,
  before: ProductRecord,
  after: Product,
): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { error } = await supabase
      .from('products')
      .update(productToRow(after))
      .eq('slug', after.slug);
    if (error) throw new Error(error.message);

    await audit(supabase, actor, 'product', after.slug, before, after);
    return ok(null);
  } catch (cause) {
    console.error('[admin] saveProduct failed', cause);
    return FAILED;
  }
}

/**
 * Writes only the four editable columns, rather than a whole mapped row.
 *
 * `categoryToRow` does not exist for the reason the read side gives: nothing
 * needs it yet, and a reverse mapping written ahead of a caller is a mapping
 * nothing tests. The four columns here are exactly the four `acceptCategoryEdit`
 * accepts, so an UPDATE that touched more would be writing back values it was
 * given rather than values anyone changed.
 */
export async function saveCategory(
  actor: string,
  before: Category,
  after: Category,
): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { error } = await supabase
      .from('categories')
      .update({
        name: after.name,
        description: after.description,
        hero_product_slug: after.heroProductSlug,
        order: after.order,
      })
      .eq('id', after.id);
    if (error) throw new Error(error.message);

    await audit(supabase, actor, 'category', after.id, before, after);
    return ok(null);
  } catch (cause) {
    console.error('[admin] saveCategory failed', cause);
    return FAILED;
  }
}

/** Who changed what, and what it was before. Never throws — see saveProduct. */
async function audit(
  supabase: Awaited<ReturnType<typeof client>>,
  actor: string,
  entity: 'product' | 'category',
  entityId: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  const { error } = await supabase.from('catalogue_audit').insert({
    actor,
    entity,
    entity_id: entityId,
    action: 'update',
    before,
    after,
  });
  if (error) {
    console.error(
      `[admin] ${entity} ${entityId} was SAVED but NOT AUDITED — the overwritten values are gone`,
      error.message,
    );
  }
}
