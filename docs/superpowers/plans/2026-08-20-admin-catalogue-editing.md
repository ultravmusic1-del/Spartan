# Admin Catalogue Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in admin browse every product and category, correct any field except the slug and the EN 388 rating, and press Publish to trigger a production build.

**Architecture:** One repository module, `src/lib/admin/catalogue.ts`, is the only code that writes to `products` and `categories`, mirroring `src/lib/admin/enquiries.ts` exactly. It validates against the **same** `productSchema` and `categorySchema` the Content Layer uses at build time, so a save that would break a build is rejected at the form instead. Six new server-rendered routes, no client-side JavaScript. Authenticated end-to-end tests run against a throwaway Supabase stack in Docker.

**Tech Stack:** Astro 7.1.6, TypeScript 6 strict, `@supabase/supabase-js` 2.112, Zod (via `astro/zod`), Vitest, Playwright, Supabase CLI 2.115 (through `npx`), Docker.

**Spec:** `docs/superpowers/specs/2026-08-20-admin-catalogue-editing-design.md`

---

## Read first

- `docs/TRAPS.md` before touching any unfamiliar area.
- `CLAUDE.md` §"The admin area". Three rules bite here: **no inline scripts on any `/admin` page** (they cannot be hashed and are blocked at runtime while every gate stays green), **every admin route needs `export const prerender = false`**, and `SUPABASE_SERVICE_ROLE_KEY` must never appear under `src/components`, `src/scripts`, `src/stores` or `src/layouts`.
- **Never weaken a gate to make it pass.**

## Environment facts, already verified

Do not re-litigate these; they were measured on 2026-08-20.

- Docker Desktop 4.87.0, engine 29.7.2. The binary is at `C:\Users\Vivaan\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe` and is **not on the Git Bash PATH**. Every shell command that touches Docker must prepend it.
- The trimmed stack runs 4 containers using **262 MB** total. WSL grows to about 2 GB to host them.
- The machine has 7.7 GB. Chrome must be closed during test runs.
- `npx supabase` resolves 2.115.0. No global install.
- All seven `.env` values are populated, including `VERCEL_DEPLOY_HOOK_URL`.

## A scope decision this plan makes

**The Status field is read-only in this slice**, and the edit form must not offer a Published/Hidden control.

`productSchema` declares `status: z.enum(['published', 'draft'])`, but **nothing filters on it**: neither `src/lib/catalog.ts` nor `src/loaders/supabase-catalogue.ts` excludes drafts, so a product set to draft still renders publicly. Shipping the control anyway would be a switch that does nothing, which is the defect this repository has already removed twice.

Making it work is not the three-line filter it looks like. Hiding a product changes the built page count, which `tools/counts.test.ts` pins, and the product totals held in `tools/catalogue-snapshot.json`. That is its own piece of work with its own gate changes. Task 11 files it in `BACKLOG.md`.

## File structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/config.toml` | Local stack config, with everything but Postgres, Auth, PostgREST and the gateway disabled |
| `supabase/migrations/<ts>_initial_schema.sql` | The production schema, captured. Nothing recreates the tables today. |
| `src/lib/admin/catalogue.ts` | The only writer to `products` and `categories`. Read, map, validate, write, audit. |
| `src/lib/admin/catalogue.test.ts` | Mapping both directions, validation, read-only field rejection |
| `src/pages/admin/catalogue/index.astro` | List every product and category |
| `src/pages/admin/catalogue/products/[slug].astro` | Product edit form |
| `src/pages/admin/catalogue/categories/[id].astro` | Category edit form |
| `src/pages/api/admin/catalogue/products/[slug].ts` | Save a product |
| `src/pages/api/admin/catalogue/categories/[id].ts` | Save a category |
| `src/pages/api/admin/catalogue/publish.ts` | Fire the deploy hook |
| `tests/e2e/admin-catalogue.spec.ts` | Authenticated browse, edit, save, publish refusal. Signs in per test via `beforeEach`; no storage-state fixture, because five tests do not justify one. |
| `tools/test-db.mjs` | Start the stack, apply migrations, seed, create the test admin |

**Modified:** `src/lib/admin/notices.ts` · `package.json` · `playwright.config.ts` · `.github/workflows/verify.yml` · `BACKLOG.md` · `handoff.md` · `CLAUDE.md` + `AGENTS.md` (via `npm run counts`)

---

## Task 1: Capture the schema

Nothing can be tested against a throwaway database until something can create one. The production schema currently exists only in the live cloud project.

**Files:**
- Create: `supabase/config.toml`, `supabase/migrations/20260820000000_initial_schema.sql`

- [ ] **Step 1: Initialise the local project**

```bash
export PATH="$PATH:/c/Users/Vivaan/AppData/Local/Programs/DockerDesktop/resources/bin"
npx --yes supabase@latest init --force
```

- [ ] **Step 2: Trim the stack to four services**

Edit `supabase/config.toml` and set `enabled = false` under each of `[realtime]`, `[studio]`, `[local_smtp]`, `[storage]`, `[storage.s3_protocol]`, `[storage.vector]`, `[edge_runtime]` and `[analytics]`. Leave `[api]`, `[db]` and `[auth]` enabled.

Add this comment at the top of the file:

```toml
# TRIMMED ON PURPOSE — 2026-08-20.
#
# The default stack starts Studio, Realtime, Storage, an image proxy, a mail
# catcher and an analytics service. The tests need exactly four things: Postgres,
# Auth, PostgREST and the gateway in front of them.
#
# This is not tidiness. The development machine has 7.7 GB of RAM and the full
# stack does not fit alongside a build and a headless browser. Measured on
# 2026-08-20: these four use 262 MB between them.
#
# Re-enabling a service is fine if something needs it. Re-enabling all of them
# because the defaults looked wrong is not.
```

- [ ] **Step 3: Capture the live schema**

```bash
npx --yes supabase@latest db dump --db-url "$(grep -E '^SUPABASE_DB_URL=' .env | cut -d= -f2-)" --schema public -f supabase/migrations/20260820000000_initial_schema.sql
```

If `SUPABASE_DB_URL` is not in `.env`, build it from the Supabase dashboard's connection string (Project Settings → Database → Connection string → URI) and add it to `.env` with the other keys. It is needed only for this dump and by `tools/test-db.mjs`.

- [ ] **Step 4: Verify the dump recreates the tables**

```bash
export PATH="$PATH:/c/Users/Vivaan/AppData/Local/Programs/DockerDesktop/resources/bin"
npx --yes supabase@latest start
npx --yes supabase@latest status
```

Expected: the stack starts and applies the migration without error. Then confirm the tables exist:

```bash
docker exec supabase_db_spartan psql -U postgres -c "\dt public.*"
```

Expected: `divisions`, `categories`, `products`, `enquiries`, `admins`, `catalogue_audit`.

- [ ] **Step 5: Stop the stack and commit**

```bash
npx --yes supabase@latest stop --no-backup
git add supabase/
git commit -m "chore(db): capture the production schema as a migration"
```

---

## Task 2: A one-command test database

**Files:**
- Create: `tools/test-db.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the script**

Create `tools/test-db.mjs`:

```js
/**
 * Brings up a throwaway Supabase stack for the authenticated admin tests.
 *
 * WHY THIS EXISTS. Proving the edit screens work means actually saving a
 * product, and there is only one real database: the live one. A test that
 * proved editing worked would be editing the client's catalogue, and a test
 * that reached Publish would deploy the production site. So the tests get their
 * own database, created and destroyed around them.
 *
 * The test admin is created here rather than seeded from SQL because Supabase
 * Auth owns its own user table and hashing. Creating it through the admin API
 * is the only way to get a user that can actually sign in.
 */
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

/** Docker Desktop installs per-user on this machine and is not on the PATH. */
const DOCKER_BIN = 'C:\\Users\\Vivaan\\AppData\\Local\\Programs\\DockerDesktop\\resources\\bin';

export const TEST_ADMIN = { email: 'test-admin@spartan.local', password: 'test-admin-password-1' };

const run = (args) =>
  execFileSync('npx', ['--yes', 'supabase@latest', ...args], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PATH: `${process.env.PATH};${DOCKER_BIN}` },
  });

const capture = (args) =>
  execFileSync('npx', ['--yes', 'supabase@latest', ...args], {
    encoding: 'utf8',
    shell: true,
    env: { ...process.env, PATH: `${process.env.PATH};${DOCKER_BIN}` },
  });

export async function start() {
  run(['start']);

  const status = JSON.parse(capture(['status', '-o', 'json']));
  const url = status.API_URL;
  const serviceKey = status.SERVICE_ROLE_KEY;

  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Idempotent: `supabase start` on an existing container keeps its data.
  const { data: existing } = await db.auth.admin.listUsers();
  const already = existing?.users.find((u) => u.email === TEST_ADMIN.email);
  if (!already) {
    const { error } = await db.auth.admin.createUser({
      email: TEST_ADMIN.email,
      password: TEST_ADMIN.password,
      email_confirm: true,
    });
    if (error) throw new Error(`could not create the test admin: ${error.message}`);
  }

  // Membership of `admins` is the whole permission model. A Supabase Auth user
  // that is not in this table cannot reach a single admin page.
  const { error: allowError } = await db
    .from('admins')
    .upsert({ email: TEST_ADMIN.email }, { onConflict: 'email' });
  if (allowError) throw new Error(`could not allow-list the test admin: ${allowError.message}`);

  return { url, serviceKey };
}

export function stop() {
  run(['stop', '--no-backup']);
}

if (process.argv[2] === 'start') await start();
if (process.argv[2] === 'stop') stop();
```

- [ ] **Step 2: Add the npm scripts**

In `package.json`, add to `"scripts"`:

```json
"test:db:start": "node tools/test-db.mjs start",
"test:db:stop": "node tools/test-db.mjs stop"
```

- [ ] **Step 3: Run it**

```bash
npm run test:db:start
```

Expected: the stack starts and the script exits 0. Confirm the admin landed:

```bash
docker exec supabase_db_spartan psql -U postgres -c "select email from public.admins;"
```

Expected: a row for `test-admin@spartan.local`.

- [ ] **Step 4: Seed the catalogue into it**

```bash
docker exec -i supabase_db_spartan psql -U postgres < seed.sql
docker exec supabase_db_spartan psql -U postgres -c "select count(*) from public.products;"
```

Expected: a non-zero count. If `seed.sql` alone does not populate products, run `node tools/seed-catalogue.mjs` against the local `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `npx supabase status`, and add whichever command worked to `tools/test-db.mjs`'s `start()` so the database is always seeded by the one command.

- [ ] **Step 5: Commit**

```bash
npm run test:db:stop
git add tools/test-db.mjs package.json
git commit -m "test(db): one command for a throwaway database with a test admin"
```

---

## Task 3: The repository module, read side

**Files:**
- Create: `src/lib/admin/catalogue.ts`, `src/lib/admin/catalogue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/admin/catalogue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rowToProduct, productToRow } from './catalogue';

/**
 * The mapping is tested in BOTH directions because the database row and the
 * Content Layer entry are not the same shape, and a one-way test would let a
 * field silently disappear on save.
 */
describe('rowToProduct', () => {
  it('maps a database row to the shape productSchema expects', () => {
    const product = rowToProduct({
      slug: 'cut-flex',
      name: 'Cut Flex',
      variant_label: null,
      category_id: 'hand',
      images: ['p17-cut-flex.png'],
      specs: [{ label: 'Liner', value: 'Para Aramid' }],
      en388: { abrasion: '2', bladeCut: 'X', tear: '4', puncture: '4', tdmCut: 'C' },
      status: 'published',
      source: { doc: 'brochure', page: 17 },
      order: 6,
      datasheet_url: null,
      kavalani_url: null,
    });

    expect(product.slug).toBe('cut-flex');
    expect(product.variantLabel).toBeNull();
    expect(product.categoryId).toBe('hand');
    expect(product.order).toBe(6);
    expect(product.en388?.tdmCut).toBe('C');
  });
});

describe('productToRow', () => {
  it('round-trips without losing a field', () => {
    const row = {
      slug: 'cut-flex',
      name: 'Cut Flex',
      variant_label: null,
      category_id: 'hand',
      images: ['p17-cut-flex.png'],
      specs: [{ label: 'Liner', value: 'Para Aramid' }],
      en388: { abrasion: '2', bladeCut: 'X', tear: '4', puncture: '4', tdmCut: 'C' },
      status: 'published' as const,
      source: { doc: 'brochure', page: 17 },
      order: 6,
      datasheet_url: null,
      kavalani_url: null,
    };

    expect(productToRow(rowToProduct(row))).toEqual(row);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/lib/admin/catalogue.test.ts
```

Expected: FAIL, "Failed to resolve import ./catalogue".

- [ ] **Step 3: Write the module's read side**

Create `src/lib/admin/catalogue.ts`:

```ts
/**
 * The admin's door to the catalogue, and the ONLY code that writes to
 * `products` and `categories`.
 *
 * This mirrors src/lib/admin/enquiries.ts deliberately: same AdminResult
 * states, same lazy client, same service-role key handling. Two modules doing
 * the same job in two different shapes is how the second one drifts.
 *
 * VALIDATION USES THE BUILD'S OWN SCHEMA, and that is the important decision
 * here. `productSchema` and `categorySchema` come from src/content.config.ts,
 * which is what the Content Layer validates against at build time. An
 * admin-side copy is the obvious implementation and it is a trap: the two
 * drift, and the failure is delayed and misattributed. A save passes, nothing
 * looks wrong, and a build fails hours later — possibly one somebody else
 * triggered for an unrelated reason. Sharing the schema turns that into a form
 * error at the moment of saving.
 */
import { z } from 'astro/zod';
import { env, configured } from '../env';
import { productSchema, categorySchema } from '../../content.config';

const URL_KEY = 'SUPABASE_URL';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

export type AdminResult<T> =
  | { readonly state: 'ok'; readonly data: T }
  | { readonly state: 'unconfigured' }
  | { readonly state: 'failed' };

const ok = <T>(data: T): AdminResult<T> => ({ state: 'ok', data });
const UNCONFIGURED = { state: 'unconfigured' } as const;
const FAILED = { state: 'failed' } as const;

export type Product = z.infer<typeof productSchema>;
export type Category = z.infer<typeof categorySchema>;

/** A row exactly as Postgres stores it. Snake case, jsonb columns as objects. */
export interface ProductRow {
  slug: string;
  name: string;
  variant_label: string | null;
  category_id: string;
  images: string[];
  specs: { label: string | null; value: string; source?: string }[];
  en388: Product['en388'] | null;
  status: 'published' | 'draft';
  source: { doc: string; page: number } | null;
  order: number;
  datasheet_url: string | null;
  kavalani_url: string | null;
}

export function rowToProduct(row: ProductRow): Product {
  return {
    slug: row.slug,
    name: row.name,
    variantLabel: row.variant_label,
    categoryId: row.category_id,
    images: row.images,
    specs: row.specs,
    ...(row.en388 ? { en388: row.en388 } : {}),
    status: row.status,
    ...(row.source ? { source: row.source } : {}),
    order: row.order,
    ...(row.datasheet_url ? { datasheetUrl: row.datasheet_url } : {}),
    ...(row.kavalani_url ? { kavalaniUrl: row.kavalani_url } : {}),
  } as Product;
}

export function productToRow(product: Product): ProductRow {
  const p = product as Product & {
    datasheetUrl?: string;
    kavalaniUrl?: string;
    source?: { doc: string; page: number };
  };
  return {
    slug: p.slug,
    name: p.name,
    variant_label: p.variantLabel,
    category_id: p.categoryId,
    images: p.images,
    specs: p.specs,
    en388: p.en388 ?? null,
    status: p.status,
    source: p.source ?? null,
    order: p.order,
    datasheet_url: p.datasheetUrl ?? null,
    kavalani_url: p.kavalaniUrl ?? null,
  };
}

async function db() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env(URL_KEY), env(SERVICE_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listProducts(): Promise<AdminResult<Product[]>> {
  if (!configured(URL_KEY, SERVICE_KEY)) return UNCONFIGURED;
  try {
    const { data, error } = await (await db())
      .from('products')
      .select('*')
      .order('category_id')
      .order('order');
    if (error) return FAILED;
    return ok((data as ProductRow[]).map(rowToProduct));
  } catch {
    return FAILED;
  }
}

export async function getProduct(slug: string): Promise<AdminResult<Product | null>> {
  if (!configured(URL_KEY, SERVICE_KEY)) return UNCONFIGURED;
  try {
    const { data, error } = await (await db())
      .from('products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) return FAILED;
    return ok(data ? rowToProduct(data as ProductRow) : null);
  } catch {
    return FAILED;
  }
}

export async function listCategories(): Promise<AdminResult<Category[]>> {
  if (!configured(URL_KEY, SERVICE_KEY)) return UNCONFIGURED;
  try {
    const { data, error } = await (await db()).from('categories').select('*').order('order');
    if (error) return FAILED;
    return ok(
      (data as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        slug: r.slug as string,
        name: r.name as string,
        divisionId: r.division_id as string,
        description: r.description as string,
        heroProductSlug: (r.hero_product_slug as string | null) ?? null,
        status: r.status as Category['status'],
        order: r.order as number,
      })),
    );
  } catch {
    return FAILED;
  }
}

export async function getCategory(id: string): Promise<AdminResult<Category | null>> {
  const all = await listCategories();
  if (all.state !== 'ok') return all;
  return ok(all.data.find((c) => c.id === id) ?? null);
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run src/lib/admin/catalogue.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/catalogue.ts src/lib/admin/catalogue.test.ts
git commit -m "feat(admin): the catalogue repository module, read side"
```

---

## Task 4: The write side, with shared-schema validation and audit

**Files:**
- Modify: `src/lib/admin/catalogue.ts`, `src/lib/admin/catalogue.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/admin/catalogue.test.ts`:

```ts
import { acceptProductEdit } from './catalogue';

/**
 * The read-only fields are enforced by ABSENCE from the accepted-field list,
 * not by a `readonly` attribute. A disabled input is a hint to a browser; a
 * hand-crafted POST ignores it entirely.
 */
describe('acceptProductEdit', () => {
  const current = {
    slug: 'cut-flex',
    name: 'Cut Flex',
    variantLabel: null,
    categoryId: 'hand',
    images: ['p17-cut-flex.png'],
    specs: [{ label: 'Liner', value: 'Para Aramid' }],
    en388: { abrasion: '2', bladeCut: 'X', tear: '4', puncture: '4', tdmCut: 'C' },
    status: 'published' as const,
    source: { doc: 'brochure', page: 17 },
    order: 6,
  };

  it('applies the editable fields', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex II');
    form.set('order', '9');
    form.set('spec-label-0', 'Liner');
    form.set('spec-value-0', 'Para Aramid, updated');

    const result = acceptProductEdit(current as never, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.name).toBe('Cut Flex II');
    expect(result.product.order).toBe(9);
    expect(result.product.specs).toEqual([{ label: 'Liner', value: 'Para Aramid, updated' }]);
  });

  it('ignores a posted slug', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('order', '6');
    form.set('slug', 'hijacked');

    const result = acceptProductEdit(current as never, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.slug).toBe('cut-flex');
  });

  it('ignores a posted en388, which is the dangerous one', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('order', '6');
    form.set('en388-bladeCut', 'D');

    const result = acceptProductEdit(current as never, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // X means NOT SUBMITTED for that test, not failed. Promoting it to D would
    // advertise cut resistance the glove has never been tested for.
    expect(result.product.en388?.bladeCut).toBe('X');
  });

  it('drops a spec row whose value is blank, and keeps a blank label', () => {
    const form = new FormData();
    form.set('name', 'Cut Flex');
    form.set('order', '6');
    form.set('spec-label-0', '');
    form.set('spec-value-0', 'Thumb hole prevents slip');
    form.set('spec-label-1', 'Leftover');
    form.set('spec-value-1', '');

    const result = acceptProductEdit(current as never, form);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.product.specs).toEqual([
      { label: null, value: 'Thumb hole prevents slip' },
    ]);
  });

  it('rejects an edit the build would reject', () => {
    const form = new FormData();
    form.set('name', '');
    form.set('order', 'not a number');

    const result = acceptProductEdit(current as never, form);
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/lib/admin/catalogue.test.ts
```

Expected: FAIL, `acceptProductEdit` is not exported.

- [ ] **Step 3: Implement the write side**

Append to `src/lib/admin/catalogue.ts`:

```ts
/**
 * READ-ONLY FIELDS ARE ENFORCED BY ABSENCE.
 *
 * `slug`, `en388` and `source` are never read from the form. They are carried
 * over from the record already in the database, so a hand-crafted POST that
 * sets them changes nothing. A `readonly` attribute in the markup is a hint to
 * a browser and is not a control.
 *
 *   slug  — a permanent URL. Changing one breaks every existing link and
 *           discards that page's search ranking.
 *   en388 — the one field where a wrong value misrepresents protective
 *           equipment. "X" means NOT SUBMITTED for that test, not failed.
 *   source — provenance. It records where a fact came from and is not a fact
 *           an editor supplies.
 */
export type ProductEditResult =
  | { readonly ok: true; readonly product: Product }
  | { readonly ok: false; readonly issues: string[] };

/** `spec-label-N` / `spec-value-N` pairs, in index order, blanks dropped. */
function specsFromForm(form: FormData): Product['specs'] {
  const indices = [...form.keys()]
    .map((k) => /^spec-value-(\d+)$/.exec(k)?.[1])
    .filter((n): n is string => n !== undefined)
    .map(Number)
    .sort((a, b) => a - b);

  return indices
    .map((i) => ({
      label: (form.get(`spec-label-${i}`)?.toString().trim() || null) as string | null,
      value: form.get(`spec-value-${i}`)?.toString().trim() ?? '',
    }))
    // A row with no value is an empty row the editor did not fill in. A row
    // with no label is a bullet, which the brochure prints and which is valid.
    .filter((s) => s.value !== '');
}

export function acceptProductEdit(current: Product, form: FormData): ProductEditResult {
  const text = (key: string) => form.get(key)?.toString().trim() ?? '';
  const optional = (key: string) => text(key) || undefined;

  const candidate = {
    ...current,
    name: text('name'),
    variantLabel: text('variant-label') || null,
    categoryId: text('category-id'),
    specs: specsFromForm(form),
    order: Number(text('order')),
    ...(optional('datasheet-url') ? { datasheetUrl: optional('datasheet-url') } : {}),
    ...(optional('kavalani-url') ? { kavalaniUrl: optional('kavalani-url') } : {}),
    // Carried over, never accepted from the form. See the note above.
    slug: current.slug,
    en388: current.en388,
    status: current.status,
  };

  const parsed = productSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { ok: true, product: parsed.data as Product };
}

/**
 * Writes the row and records the change.
 *
 * THERE IS NO LOCKING. Two admins editing the same product means the second
 * save wins and the first is lost. For a team of two to five that is the right
 * trade, but *silently* is the operative word — which is why the audit row
 * carries `before`. The overwritten values are recoverable from it.
 */
export async function saveProduct(
  actor: string,
  before: Product,
  after: Product,
): Promise<AdminResult<null>> {
  if (!configured(URL_KEY, SERVICE_KEY)) return UNCONFIGURED;
  try {
    const client = await db();
    const { error } = await client
      .from('products')
      .update(productToRow(after))
      .eq('slug', after.slug);
    if (error) return FAILED;

    await client.from('catalogue_audit').insert({
      actor,
      entity: 'product',
      entity_id: after.slug,
      action: 'update',
      before,
      after,
    });

    return ok(null);
  } catch {
    return FAILED;
  }
}

export function acceptCategoryEdit(current: Category, form: FormData): CategoryEditResult {
  const text = (key: string) => form.get(key)?.toString().trim() ?? '';
  const candidate = {
    ...current,
    name: text('name'),
    description: text('description'),
    heroProductSlug: text('hero-product-slug') || null,
    order: Number(text('order')),
    // Carried over: an id and a slug are permanent, and status drives the
    // public "range still expanding" state rather than being presentation.
    id: current.id,
    slug: current.slug,
    divisionId: current.divisionId,
    status: current.status,
  };

  const parsed = categorySchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { ok: true, category: parsed.data as Category };
}

export type CategoryEditResult =
  | { readonly ok: true; readonly category: Category }
  | { readonly ok: false; readonly issues: string[] };

export async function saveCategory(
  actor: string,
  before: Category,
  after: Category,
): Promise<AdminResult<null>> {
  if (!configured(URL_KEY, SERVICE_KEY)) return UNCONFIGURED;
  try {
    const client = await db();
    const { error } = await client
      .from('categories')
      .update({
        name: after.name,
        description: after.description,
        hero_product_slug: after.heroProductSlug,
        order: after.order,
      })
      .eq('id', after.id);
    if (error) return FAILED;

    await client.from('catalogue_audit').insert({
      actor,
      entity: 'category',
      entity_id: after.id,
      action: 'update',
      before,
      after,
    });

    return ok(null);
  } catch {
    return FAILED;
  }
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/lib/admin/catalogue.test.ts
npx astro check
```

Expected: 7 tests pass, 0 typecheck errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/catalogue.ts src/lib/admin/catalogue.test.ts
git commit -m "feat(admin): validated catalogue writes, with an audit row per save"
```

---

## Task 5: Notice codes

**Files:**
- Modify: `src/lib/admin/notices.ts`

- [ ] **Step 1: Add the codes**

In `ADMIN_NOTICES`, add:

```ts
  'catalogue-saved': {
    text: 'Saved. The change is in the database and will appear on the site at the next build.',
    tone: 'success',
  },
  'catalogue-invalid': {
    text: 'That change was rejected because the build would reject it too. Check the highlighted fields.',
    tone: 'error',
  },
  'publish-requested': {
    text: 'Build requested. It usually takes about a minute for changes to appear on the live site.',
    tone: 'success',
  },
  'publish-unconfigured': {
    text: 'Publishing is not configured on this deployment, so no build was requested.',
    tone: 'error',
  },
  'publish-failed': {
    text: 'The build could not be requested. Nothing was published.',
    tone: 'error',
  },
```

Note the wording of `catalogue-saved` and `publish-requested`. Neither claims the change is live, because neither knows. That is rule 2's principle: an enquiry is never reported as sent when it was not, and an edit is never reported as live when a build might be failing.

- [ ] **Step 2: Verify and commit**

```bash
npx vitest run src/lib/admin/notices.test.ts
git add src/lib/admin/notices.ts
git commit -m "feat(admin): notice codes for catalogue saves and publishing"
```

---

## Task 6: The list page

**Files:**
- Create: `src/pages/admin/catalogue/index.astro`

- [ ] **Step 1: Write the page**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import DataState from '../../../components/admin/DataState.astro';
import Notice from '../../../components/admin/Notice.astro';
import { noticeFor } from '../../../lib/admin/notices';
import { listProducts, listCategories } from '../../../lib/admin/catalogue';

export const prerender = false;

const admin = Astro.locals.admin!;
const [products, categories] = await Promise.all([listProducts(), listCategories()]);
const notice = noticeFor(Astro.url.searchParams.get('notice'));

const q = (Astro.url.searchParams.get('q') ?? '').toLowerCase();
const shown =
  products.state === 'ok'
    ? products.data.filter((p) => !q || p.name.toLowerCase().includes(q))
    : [];
const categoryName = new Map(
  categories.state === 'ok' ? categories.data.map((c) => [c.id, c.name]) : [],
);
---

<AdminLayout title="Catalogue">
  {notice && <Notice notice={notice} />}

  <form method="get" action="/admin/catalogue">
    <label for="q">Search products</label>
    <input id="q" name="q" type="search" value={q} placeholder="Product name" />
    <button type="submit">Search</button>
  </form>

  <form method="post" action="/api/admin/catalogue/publish">
    <button type="submit">Publish to live site</button>
  </form>

  <DataState result={products}>
    <h2>Products ({shown.length})</h2>
    <ul>
      {
        shown.map((p) => (
          <li>
            <a href={`/admin/catalogue/products/${p.slug}`}>{p.name}</a>
            <span>{categoryName.get(p.categoryId) ?? p.categoryId}</span>
          </li>
        ))
      }
    </ul>

    <h2>Categories</h2>
    <ul>
      {
        categories.state === 'ok' &&
          categories.data.map((c) => (
            <li>
              <a href={`/admin/catalogue/categories/${c.id}`}>{c.name}</a>
            </li>
          ))
      }
    </ul>
  </DataState>
</AdminLayout>
```

Check `src/components/admin/DataState.astro`'s actual prop name before relying on `result`; match whatever `src/pages/admin/index.astro` passes it.

- [ ] **Step 2: Verify and commit**

```bash
npx astro check
git add src/pages/admin/catalogue/index.astro
git commit -m "feat(admin): list the catalogue"
```

---

## Task 7: The product edit page and save endpoint

**Files:**
- Create: `src/pages/admin/catalogue/products/[slug].astro`, `src/pages/api/admin/catalogue/products/[slug].ts`

- [ ] **Step 1: Write the edit page**

```astro
---
import AdminLayout from '../../../../layouts/AdminLayout.astro';
import Notice from '../../../../components/admin/Notice.astro';
import { noticeFor } from '../../../../lib/admin/notices';
import { getProduct, listCategories } from '../../../../lib/admin/catalogue';

export const prerender = false;

const slug = Astro.params.slug ?? '';
const result = await getProduct(slug);
if (result.state === 'ok' && result.data === null) {
  return Astro.redirect('/admin/catalogue?notice=not-found', 302);
}
const product = result.state === 'ok' ? result.data : null;
const categories = await listCategories();
const notice = noticeFor(Astro.url.searchParams.get('notice'));

/* One blank row is always rendered, so adding a specification needs no control
   at all: type into it and save. "Add a specification" exists for bulk work. */
const specRows = [...(product?.specs ?? []), { label: null, value: '' }];
---

<AdminLayout title={product ? product.name : 'Product'}>
  {notice && <Notice notice={notice} />}

  {
    product && (
      <form method="post" action={`/api/admin/catalogue/products/${product.slug}`}>
        <fieldset>
          <legend>Identity</legend>
          <label for="name">Name</label>
          <input id="name" name="name" value={product.name} required />

          <label for="variant-label">Variant label</label>
          <input id="variant-label" name="variant-label" value={product.variantLabel ?? ''} />

          <label for="slug-display">Slug</label>
          <input id="slug-display" value={product.slug} readonly disabled />
          <p>
            Read only. A slug is a permanent URL: changing it breaks every existing link to this
            product and discards its search ranking.
          </p>
        </fieldset>

        <fieldset>
          <legend>Classification</legend>
          <label for="category-id">Category</label>
          <select id="category-id" name="category-id">
            {categories.state === 'ok' &&
              categories.data.map((c) => (
                <option value={c.id} selected={c.id === product.categoryId}>
                  {c.name}
                </option>
              ))}
          </select>

          <label for="order">Order</label>
          <input id="order" name="order" type="number" value={product.order} required />
        </fieldset>

        <fieldset>
          <legend>Specifications</legend>
          {specRows.map((s, i) => (
            <p>
              <input
                name={`spec-label-${i}`}
                value={s.label ?? ''}
                placeholder="Label (optional)"
                aria-label={`Specification ${i + 1} label`}
              />
              <input
                name={`spec-value-${i}`}
                value={s.value}
                placeholder="Value"
                aria-label={`Specification ${i + 1} value`}
              />
            </p>
          ))}
          <p>A specification with no value is discarded. A blank label is a bullet, which is valid.</p>
          <button type="submit" name="intent" value="add-spec">Add a specification</button>
        </fieldset>

        <fieldset>
          <legend>EN 388 rating</legend>
          {product.en388 ? (
            <ul>
              <li>Abrasion {product.en388.abrasion}</li>
              <li>Blade cut {product.en388.bladeCut}</li>
              <li>Tear {product.en388.tear}</li>
              <li>Puncture {product.en388.puncture}</li>
              <li>TDM cut {product.en388.tdmCut}</li>
            </ul>
          ) : (
            <p>No published rating, which is shown as no rating rather than as a default.</p>
          )}
          <p>
            Read only. X means the glove was not submitted for that test, not that it failed. A wrong
            grade here misrepresents protective equipment, so it is set from the brochure by a
            developer.
          </p>
        </fieldset>

        <fieldset>
          <legend>Links</legend>
          <label for="datasheet-url">Datasheet URL</label>
          <input id="datasheet-url" name="datasheet-url" value={(product as never as { datasheetUrl?: string }).datasheetUrl ?? ''} />

          <label for="kavalani-url">Kavalani URL</label>
          <input id="kavalani-url" name="kavalani-url" value={(product as never as { kavalaniUrl?: string }).kavalaniUrl ?? ''} />
        </fieldset>

        <button type="submit">Save changes</button>
      </form>
    )
  }
</AdminLayout>
```

- [ ] **Step 2: Write the save endpoint**

```ts
import type { APIRoute } from 'astro';
import {
  getProduct,
  acceptProductEdit,
  saveProduct,
} from '../../../../../lib/admin/catalogue';

export const prerender = false;

const to = (path: string, notice: string) => `${path}?notice=${notice}`;

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const slug = params.slug ?? '';
  const detail = `/admin/catalogue/products/${slug}`;

  const current = await getProduct(slug);
  if (current.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (current.state === 'failed') return redirect(to(detail, 'save-failed'), 302);
  if (current.data === null) return redirect(to('/admin/catalogue', 'not-found'), 302);

  const form = await request.formData();

  /* "Add a specification" is a save that re-renders with one more blank row.
     There is no client-side JavaScript in the admin — /admin never enters
     dist/client, so it can never be given a CSP hash and an inline script there
     is blocked at runtime while every gate stays green. */
  const accepted = acceptProductEdit(current.data, form);
  if (!accepted.ok) return redirect(to(detail, 'catalogue-invalid'), 302);

  const result = await saveProduct(
    locals.admin?.email ?? 'unknown',
    current.data,
    accepted.product,
  );
  if (result.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to(detail, 'save-failed'), 302);

  return redirect(to(detail, 'catalogue-saved'), 302);
};
```

- [ ] **Step 3: Verify and commit**

```bash
npx astro check
git add src/pages/admin/catalogue/products src/pages/api/admin/catalogue/products
git commit -m "feat(admin): edit a product"
```

---

## Task 8: The category edit page and save endpoint

**Files:**
- Create: `src/pages/admin/catalogue/categories/[id].astro`, `src/pages/api/admin/catalogue/categories/[id].ts`

- [ ] **Step 1: Write the page**

Same structure as Task 7's page, with these fields: `name` (text, required), `description` (textarea, required), `hero-product-slug` (select listing every product slug, plus a blank option), `order` (number, required). Render `id`, `slug`, `divisionId` and `status` as disabled inputs with the note "Read only. Changing a category id or slug breaks every link into that range."

`heroProductSlug` must be a select rather than a text field: `npm run verify`'s invariant gate fails the build if it names a product that does not exist, and a select cannot produce one.

- [ ] **Step 2: Write the endpoint**

```ts
import type { APIRoute } from 'astro';
import {
  getCategory,
  acceptCategoryEdit,
  saveCategory,
} from '../../../../../lib/admin/catalogue';

export const prerender = false;

const to = (path: string, notice: string) => `${path}?notice=${notice}`;

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const id = params.id ?? '';
  const detail = `/admin/catalogue/categories/${id}`;

  const current = await getCategory(id);
  if (current.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (current.state === 'failed') return redirect(to(detail, 'save-failed'), 302);
  if (current.data === null) return redirect(to('/admin/catalogue', 'not-found'), 302);

  const accepted = acceptCategoryEdit(current.data, await request.formData());
  if (!accepted.ok) return redirect(to(detail, 'catalogue-invalid'), 302);

  const result = await saveCategory(
    locals.admin?.email ?? 'unknown',
    current.data,
    accepted.category,
  );
  if (result.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to(detail, 'save-failed'), 302);

  return redirect(to(detail, 'catalogue-saved'), 302);
};
```

- [ ] **Step 3: Verify and commit**

```bash
npx astro check
git add src/pages/admin/catalogue/categories src/pages/api/admin/catalogue/categories
git commit -m "feat(admin): edit a category"
```

---

## Task 9: Publish

**Files:**
- Create: `src/pages/api/admin/catalogue/publish.ts`

- [ ] **Step 1: Write the endpoint**

```ts
import type { APIRoute } from 'astro';
import { env, configured } from '../../../../lib/env';

export const prerender = false;

const HOOK = 'VERCEL_DEPLOY_HOOK_URL';
const to = (notice: string) => `/admin/catalogue?notice=${notice}`;

/**
 * Fires the deploy hook. It returns a job id immediately and says nothing about
 * whether the build succeeds, so the notice this redirects to says "Build
 * requested", never "Published". That is rule 2's principle in a second place:
 * state what is known, not what is hoped.
 *
 * UNCONFIGURED IS AN ERROR HERE, which is deliberately the opposite of the
 * enquiry path. An enquiry with no email configured was still written to
 * Postgres, so it was not lost. A publish records nothing at all: it either
 * requested a build or it did not.
 */
export const POST: APIRoute = async ({ redirect }) => {
  if (!configured(HOOK)) return redirect(to('publish-unconfigured'), 302);

  try {
    const response = await fetch(env(HOOK), { method: 'POST' });
    if (!response.ok) return redirect(to('publish-failed'), 302);
    return redirect(to('publish-requested'), 302);
  } catch {
    return redirect(to('publish-failed'), 302);
  }
};
```

- [ ] **Step 2: Verify and commit**

```bash
npx astro check
git add src/pages/api/admin/catalogue/publish.ts
git commit -m "feat(admin): request a build from the admin"
```

---

## Task 10: Authenticated end-to-end tests

**Files:**
- Create: `tests/e2e/admin-catalogue.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

/**
 * THE FIRST AUTHENTICATED TESTS IN THIS SUITE.
 *
 * Everything in admin.spec.ts proves the guard turns people away. Nothing has
 * ever proved what happens after someone gets in, which was acceptable while
 * the admin only read data and is not acceptable now that it writes to the
 * catalogue.
 *
 * These run against a throwaway database created by tools/test-db.mjs, so they
 * are free to save whatever they like. They must never be pointed at the live
 * project: a test that proved editing worked would be editing the client's
 * catalogue, and the publish test would deploy the production site.
 */
const ADMIN = { email: 'test-admin@spartan.local', password: 'test-admin-password-1' };

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
});

test('the catalogue lists products and links to an edit form', async ({ page }) => {
  await page.goto('/admin/catalogue');
  await expect(page.getByRole('link', { name: 'Cut Flex' })).toBeVisible();
});

test('editing a product name saves and survives a reload', async ({ page }) => {
  await page.goto('/admin/catalogue/products/cut-flex');

  await page.getByLabel('Name').fill('Cut Flex Renamed');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page.locator('text=Saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Name')).toHaveValue('Cut Flex Renamed');
});

test('the slug cannot be changed by posting one', async ({ page, request }) => {
  await page.goto('/admin/catalogue/products/cut-flex');
  const cookies = await page.context().cookies();
  const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  await request.post('/api/admin/catalogue/products/cut-flex', {
    headers: { cookie: header },
    form: { name: 'Cut Flex', order: '6', slug: 'hijacked' },
  });

  // The old URL still resolves, which it would not if the slug had moved.
  await page.goto('/admin/catalogue/products/cut-flex');
  await expect(page.getByLabel('Name')).toBeVisible();
});

test('the EN 388 rating cannot be changed by posting one', async ({ page, request }) => {
  await page.goto('/admin/catalogue/products/cut-flex');
  const cookies = await page.context().cookies();
  const header = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  await request.post('/api/admin/catalogue/products/cut-flex', {
    headers: { cookie: header },
    form: { name: 'Cut Flex', order: '6', 'en388-bladeCut': 'D' },
  });

  await page.goto('/admin/catalogue/products/cut-flex');
  // X, not D. Promoting it would advertise cut resistance never tested for.
  await expect(page.locator('text=Blade cut X')).toBeVisible();
});

test('publish refuses when no deploy hook is configured', async ({ page }) => {
  await page.goto('/admin/catalogue');
  await page.getByRole('button', { name: /publish to live site/i }).click();
  await expect(page.locator('text=Publishing is not configured')).toBeVisible();
});
```

- [ ] **Step 2: Point Playwright at the test database**

In `playwright.config.ts`, add a project that sets the local Supabase credentials in `webServer.env`, taken from `npx supabase status -o json`: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CATALOGUE_SOURCE=postgres`, and **`VERCEL_DEPLOY_HOOK_URL=''`** so the publish test exercises the refusal path and no deployment can be triggered.

- [ ] **Step 3: Run them**

```bash
npm run test:db:start
npx playwright test tests/e2e/admin-catalogue.spec.ts --reporter=line
```

Expected: 6 tests pass. If sign-in fails, check the label text in `src/pages/admin/login.astro` matches `getByLabel` and adjust the selectors rather than the assertions.

- [ ] **Step 4: Commit**

```bash
npm run test:db:stop
git add tests/e2e/admin-catalogue.spec.ts playwright.config.ts
git commit -m "test(admin): prove a signed-in admin can edit, and cannot forge a slug or a rating"
```

---

## Task 11: CI, documentation and the final gate

**Files:**
- Modify: `.github/workflows/verify.yml`, `BACKLOG.md`, `handoff.md`, `docs/TRAPS.md`

- [ ] **Step 1: Wire the test database into CI**

In `.github/workflows/verify.yml`, before the verify step, add a step that runs `npm run test:db:start`, and raise `timeout-minutes` from 20 to 30. GitHub's ubuntu runners have Docker preinstalled, so no setup action is needed.

- [ ] **Step 2: Make a missing stack fail loudly**

In `tools/verify.mjs`'s Playwright gate, if `SUPABASE_URL` points at a remote host while the admin catalogue spec is in the run, stop with:

> The authenticated admin tests need the local test database. Run `npm run test:db:start` first. They must not run against the live project.

A skipped test that reports green is the failure mode this repository exists to prevent. Do not make this a skip.

- [ ] **Step 3: File the Status field**

Add to `BACKLOG.md` under P1:

```markdown
- [ ] **Make `status: 'draft'` actually hide a product.** `productSchema`
      declares it and **nothing filters on it**: neither `src/lib/catalog.ts`
      nor `src/loaders/supabase-catalogue.ts` excludes drafts, so a product set
      to draft still renders publicly. The admin edit form deliberately does not
      offer the control, because a switch that does nothing is the defect this
      repo has already removed twice.

      It is not the three-line filter it looks like. Hiding a product changes
      the built page count that `tools/counts.test.ts` pins, and the totals in
      `tools/catalogue-snapshot.json`. Both gates need reworking to express
      "94 products, 91 of them visible" rather than one number.
```

- [ ] **Step 4: Document it**

Add a `handoff.md` section recording the shared-schema decision, the read-only-by-absence rule, and that Publish reports "Build requested" rather than "Published". Add a `docs/TRAPS.md` entry under "Fails silently":

```markdown
- **An admin-side copy of the catalogue schema.** `src/lib/admin/catalogue.ts`
  validates against `productSchema` imported from `src/content.config.ts`, which
  is the same object the Content Layer uses at build time. Copy it "to decouple
  the admin" and the two drift, and the failure is delayed and misattributed: a
  save passes, and a build somebody else triggered fails hours later.
  *Caught by:* nothing. Keep the import.
```

- [ ] **Step 5: Regenerate and run the full gate**

```bash
npm run test:db:start
npm run build
npm run counts
cp CLAUDE.md AGENTS.md
npm run verify -- --full
npm run test:db:stop
```

Expected: 17/17 gates. The route count moves from 13 to 19 and the unit test count rises, so the counts block will change. **Never edit that block by hand.**

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: wire the test database into CI, and record what this work assumes"
```

---

## Self-review

**Spec coverage.** Repository module → 3, 4. Shared-schema validation → 4 (plus a TRAPS entry in 11). Six routes → 6, 7, 8, 9. Read-only enforcement → 4, tested in 4 and 10. Paired spec fields → 4, 7. Publish semantics → 5, 9, tested in 10. Audit → 4. No locking, recoverable via `before` → 4. Error handling → 7, 8, 9. Schema capture → 1. Ephemeral database → 2. Fail-loudly-not-skip → 11. Route count and counts block → 11.

**One spec item deliberately not implemented:** the Status control. The spec's form sketch showed Published/Hidden; the plan drops it and files the reason in `BACKLOG.md`, because `draft` currently hides nothing and shipping the control would be a dead switch.

**Naming consistency.** `AdminResult`, `Product`, `Category`, `ProductRow`, `rowToProduct`, `productToRow`, `acceptProductEdit`, `acceptCategoryEdit`, `saveProduct`, `saveCategory` are used identically in Tasks 3, 4, 7, 8. Notice codes introduced in Task 5 are the ones referenced in 7, 8 and 9.

**Known soft spots, flagged rather than hidden.** Task 1 Step 3 depends on a `SUPABASE_DB_URL` that may not be in `.env`, and says where to get it. Task 2 Step 4 cannot know in advance whether `seed.sql` alone populates products, and says what to do either way. Task 6 assumes `DataState`'s prop is named `result` and says to check. Task 10's sign-in selectors depend on the login form's labels and say to adjust the selectors rather than the assertions. The two edit-result types are named `ProductEditResult` and `CategoryEditResult` rather than sharing one generic, because their success payloads differ and a shared type would need a discriminant nothing else uses.
