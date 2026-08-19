# Admin Content Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a trained non-developer add, edit and delete every part of the public site's content — products, categories, front-end text and hero banner selection — from `/admin`, and publish those changes to the live site.

**Architecture:** The public site is `output: 'static'`, so nothing saved at runtime reaches a visitor without a rebuild. Content therefore moves out of committed JSON into Postgres, the Astro Content Layer reads it at build time through the existing loader seam, the admin writes to it through a repository module mirroring `src/lib/admin/enquiries.ts`, and an explicit Publish action fires a Vercel deploy hook. No client-side JavaScript anywhere in the admin: every screen is a server-rendered form post, because `/admin` routes never enter `dist/client` and so can never receive a CSP hash.

**Tech Stack:** Astro 7.1.6 (hybrid static + 13 SSR routes), TypeScript 6 strict, Supabase Postgres via `@supabase/supabase-js` 2.112, Supabase Storage, Zod (`astro/zod` v4), Vitest, Playwright, Vercel deploy hooks.

---

## Scope: this is six stages, and only the first two are planned here

The request spans several subsystems. Planning all of them today would mean inventing detail about code that does not exist yet — the failure the admin design doc already names ("Writing Phase 3's task list today would be inventing detail about a codebase that does not exist yet").

| Stage | Ships | Useful alone? | Planned where |
|---|---|---|---|
| **1. Complete the Postgres switch** | Live site renders from the database | No visible change; it is the foundation | **This document, in full** |
| **2. Site text + banner config into Postgres** | The same seam for `site.json` and the hero banner list | No visible change | **This document, in full** |
| 3. Browse (read-only admin screens) | See the catalogue, text and banners in the admin | Yes | Own plan, written at its start |
| 4. Edit existing records | Corrections without a developer | Yes | Own plan |
| 5. Create, delete, referential integrity | The full CRUD request | Yes | Own plan |
| 6. Image upload + Publish | Uploading new banners; changes go live | Completes the loop | Own plan |

**Stages 1 and 2 are planned to executable detail below.** They block everything else and they are the ones that can break the live site, which is why they ship alone and first.

This plan **extends** `docs/superpowers/plans/2026-08-13-catalogue-editing.md`. Its two decisions stand and are not re-opened:

- **Provenance:** admin-created records may leave `source` empty; `catalogue_audit` records who created each row. The shape gate changes from *every product cites a page* to *every product either cites a page or has an audit entry*.
- **Publishing:** an explicit Publish button, not publish-on-save.

What that plan does **not** cover, and this one adds: front-end text (`src/data/site.json`) and hero banner selection.

---

## Prerequisites — none of this can start without these

**Every task below is blocked on the first item.** There are no Supabase credentials on this machine, which is why all catalogue work so far has been verifiable only by typecheck, build and unit test.

- [x] **P1. A `.env` with working Supabase credentials.** **Done 2026-08-17.** `.env` was created at the repository root on 2026-08-17 with every key present and commented; the values are still blank. Fill `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY` from Supabase → Project Settings → Data API / API Keys.

      **Still required even though the Supabase connector works.** The connector can read and write the database, but `npm run catalogue:parity` runs a local BUILD that reads from Postgres, and that build needs the credentials in the process environment. Without them Stage 1's acceptance test cannot run, and Task 6 must not be attempted on an unproven migration.

- [x] **P2. Confirm the tables exist and match the column lists.** **Done 2026-08-17 via the Supabase connector**, and it found two things:

      - All three catalogue tables exist, plus `catalogue_audit` (0 rows) — which Stage 5 needs and which therefore no longer has to be created.
      - **`products` held 85 rows against the repository's 94**, confirming the staleness Task 1 exists to fix, and the table was **missing `datasheet_url` and `kavalani_url`** entirely. The loader already reads both. **Both columns were added** by migration `add_datasheet_and_kavalani_url_to_products`. `divisions` and `categories` were brought current at the same time; `products` is still stale pending P1.

      Project `spartan`, ref `wslylysakixrirxkozih`, region **ap-south-1 (Mumbai)**, ACTIVE_HEALTHY. That region is also the answer to the hosting question about where compute should sit: the enquiry path and every admin page round-trip to this database, while the pages buyers browse do not.

- [x] **P3. A Vercel deploy hook URL.** **Done 2026-08-17**, stored in `.env`. Nothing reads it until Stage 6., from Project Settings → Git → Deploy Hooks. Needed by Stage 6, but worth creating now so it is not a blocker later. Store as `VERCEL_DEPLOY_HOOK_URL`; the key is already present and blank in `.env`.

- [x] **P4. Who may publish. DECIDED 2026-08-17: every admin may publish.** No role column is needed and `public.admins` stays as it is — membership of the allow-list is the whole permission model, which keeps it the single thing to reason about. Recorded because the alternative is cheap to add later and expensive to retrofit opinions about: if publishing is ever restricted, it is an `admins.role` column plus a check in the publish endpoint, and nothing else changes.

---

## File structure

**Stage 1 modifies:**

| File | Responsibility after this stage |
|---|---|
| `tools/verify.mjs` | Catalogue-shape gate reads a committed snapshot + invariants, not `products.json` literals |
| `tools/catalogue-snapshot.mjs` | **New.** Invariant checks and totals; regenerates the snapshot |
| `tools/catalogue-snapshot.json` | **New.** Committed expected totals — the counts-block pattern applied to the catalogue |
| `tools/counts.mjs` | Catalogue totals come from the snapshot rather than the JSON |
| `tools/seed-catalogue.mjs` | Round-trips every schema column, including the two added after it was written |

**Stage 2 creates:**

| File | Responsibility |
|---|---|
| `src/lib/site-content.ts` | **New.** The seam for non-catalogue content — what `catalog.ts` is for products |
| `src/lib/site-content.test.ts` | **New.** Unit tests for the seam |
| `src/loaders/supabase-site.ts` | **New.** Content Layer loader for `site_settings` and `hero_banners` |
| `src/data/hero-banners.json` | **New.** The banner list, extracted from `Hero.astro`'s hardcoded array |
| `tools/seed-site.mjs` | **New.** Seeds `site_settings` and `hero_banners` |
| `src/components/sections/Hero.astro` | Reads banners through the seam instead of a literal array |

---

# Stage 1 — Complete the Postgres switch

The tables, the loader and the parity harness already exist. What remains is applying the current data, re-pointing two gates that read the JSON as truth, and flipping the switch on the deployment.

**This stage ships alone. Nothing else lands in these commits.**

### Task 1: Apply the current catalogue to Postgres — DONE 2026-08-17

The database still holds the 2026-08-13 catalogue: 85 products, with the fire-retardant shrinkage rows, no spill control range and no per-spec `source`. The repository holds 94. **Flipping the switch before this task would roll the live site back several weeks.**

**Files:**
- Generate: `seed.sql` (gitignored)
- Verify: `tools/catalogue-parity.mjs` (existing, unchanged)

- [ ] **Step 1: Regenerate the seed from the current catalogue**

```bash
npm run catalogue:seed -- --out seed.sql
```

Expected: `wrote 10 statements to <repo>/seed.sql (utf8)`

- [ ] **Step 2: Confirm the seed carries current data, not stale**

```bash
grep -c "SAFCLE" seed.sql; grep -ci "shrinkage" seed.sql; grep -c "kavalani" seed.sql
```

Expected: `7` (the spill control codes), `0` (shrinkage removed 2026-08-16), and non-zero for the third. **If the third is 0, stop and do Task 2 first** — the seeder predates the `kavalaniUrl` and `datasheetUrl` columns.

- [ ] **Step 3: Copy the seed without corrupting it**

The catalogue's specs carry `±`, `Ω`, `°`, `×` and `—`. On 2026-08-13 every one reached Postgres as mojibake because a BOM-less UTF-8 file was opened in an editor that guessed ANSI, and what got pasted was what was on screen. Nothing failed; the damage surfaced only when the parity harness compared 47 product pages.

```bash
powershell -Command "Get-Content seed.sql -Raw -Encoding utf8 | Set-Clipboard"
```

**Do not open `seed.sql` in an editor.** Paste directly into the Supabase SQL editor and run.

- [ ] **Step 4: Verify the row counts landed**

```sql
select
  (select count(*) from divisions)  as divisions,
  (select count(*) from categories) as categories,
  (select count(*) from products)   as products;
```

Expected: `2`, `15`, `94`.

- [ ] **Step 5: Verify the non-ASCII characters survived**

```sql
select value from (
  select jsonb_array_elements(specs)->>'value' as value from products
) s where value like '%±%' or value like '%Ω%' or value like '%—%' limit 5;
```

Expected: real characters. **If you see `┬▒`, `╬⌐` or `ΓÇö`, the paste was corrupted** — redo Step 3 without opening the file.

- [ ] **Step 6: Commit nothing.** `seed.sql` is gitignored and this task changes no tracked file. There is deliberately nothing to commit.

---

### Task 2: Make the seeder round-trip every column — DONE 2026-08-17 (`1120820`)

`productSchema` gained `datasheetUrl`, `kavalaniUrl` and per-spec `source` after the seeder was written. A seeder that silently drops a column produces a database that parity then correctly reports as different — and the difference looks like a loader bug.

**Files:**
- Modify: `tools/seed-catalogue.mjs`
- Test: `tools/seed-catalogue.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tools/seed-catalogue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PRODUCT_COLUMNS } from './seed-catalogue.mjs';
import { productSchema } from '../src/content.config';

describe('the seeder round-trips every schema field', () => {
  /*
   * A column the seeder does not know about is dropped silently: the insert
   * succeeds, the row is short a field, and `catalogue:parity` then reports a
   * difference that reads like a loader defect. This asserts the two lists
   * agree, so a schema addition cannot land without the seeder following it.
   */
  it('PRODUCT_COLUMNS covers every key in productSchema', () => {
    const schemaKeys = Object.keys(productSchema.shape).sort();
    const columnKeys = PRODUCT_COLUMNS.map((c) => (typeof c === 'string' ? c : c.key)).sort();
    expect(columnKeys).toEqual(schemaKeys);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tools/seed-catalogue.test.ts
```

Expected: FAIL, naming `datasheetUrl` and `kavalaniUrl` as present in the schema and absent from the columns.

- [ ] **Step 3: Export the column list and add the missing columns**

In `tools/seed-catalogue.mjs`, export `PRODUCT_COLUMNS` and add the two missing entries alongside the existing ones, following the file's established cell-serialisation for optional fields: **absent stays `NULL`, never `''`**. An optional field written as an empty string round-trips as a present-but-empty value, which is exactly the "empty means absent" rule the editor will later depend on.

- [ ] **Step 4: Run the test and regenerate**

```bash
npx vitest run tools/seed-catalogue.test.ts && npm run catalogue:seed -- --out seed.sql
```

Expected: PASS, then `wrote 10 statements`.

- [ ] **Step 5: Re-apply the seed** using Task 1 Steps 3 to 5.

- [ ] **Step 6: Commit**

```bash
git add tools/seed-catalogue.mjs tools/seed-catalogue.test.ts
git commit -m "fix(catalogue): the seeder was dropping two columns it never knew about"
```

---

### Task 3: Prove the two sources are identical — DONE 2026-08-17, 642 files byte-identical

**Files:** none modified. This is a gate.

- [ ] **Step 1: Run the parity build**

```bash
npm run catalogue:parity
```

Expected: a build from JSON, a build from Postgres, and every emitted file matching. On 2026-08-13 this reported 522 files byte-identical; the number will now be higher.

- [ ] **Step 2: If it reports differences, stop and read them**

A difference is a migration defect, not a tolerance. The three causes seen so far: a column the seeder drops (Task 2), mojibake from a bad paste (Task 1 Step 3), and `null` versus `''` for an absent optional field. **Do not proceed to Task 6 until this is clean.**

- [ ] **Step 3: Commit nothing.**

---

### Task 4: Re-point the catalogue-shape gate at invariants — DONE 2026-08-17 (`cd83114`)

The gate hard-codes `94 products / 15 categories / 6 EN 388`, read from `src/data/products.json`. Once the catalogue is editable those numbers move for good reasons, and once it is in Postgres that file is no longer the truth. It must not simply be deleted: it is one of the few mechanical defences rule 1 has.

**Files:**
- Create: `tools/catalogue-snapshot.mjs`, `tools/catalogue-snapshot.json`, `tools/catalogue-snapshot.test.ts`
- Modify: `tools/verify.mjs` (the "no invented product facts" block)

- [ ] **Step 1: Write the failing test**

Create `tools/catalogue-snapshot.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkInvariants } from './catalogue-snapshot.mjs';

const ok = {
  divisions: [{ id: 'electricals' }, { id: 'safety' }],
  categories: [
    { id: 'hand', divisionId: 'safety', heroProductSlug: 'gp1' },
    { id: 'spill', divisionId: 'safety', heroProductSlug: null },
  ],
  products: [{ slug: 'gp1', categoryId: 'hand', source: { doc: 'brochure', page: 16 } }],
  audit: [],
};

describe('catalogue invariants', () => {
  it('passes a well-formed catalogue', () => {
    expect(checkInvariants(ok)).toEqual([]);
  });

  it('catches a product pointing at a category that does not exist', () => {
    const bad = { ...ok, products: [{ ...ok.products[0], categoryId: 'nope' }] };
    expect(checkInvariants(bad)).toContain('gp1 has categoryId "nope", which is not a category');
  });

  it('catches a hero product that does not exist', () => {
    const bad = {
      ...ok,
      categories: [{ id: 'hand', divisionId: 'safety', heroProductSlug: 'ghost' }],
    };
    expect(checkInvariants(bad)).toContain(
      'category hand names heroProductSlug "ghost", which is not a product',
    );
  });

  it('allows a null heroProductSlug, which an empty category legitimately uses', () => {
    const fine = {
      ...ok,
      categories: [{ id: 'spill', divisionId: 'safety', heroProductSlug: null }],
    };
    expect(checkInvariants(fine)).toEqual([]);
  });

  it('catches duplicate slugs', () => {
    const bad = { ...ok, products: [ok.products[0], ok.products[0]] };
    expect(checkInvariants(bad)).toContain('duplicate slug: gp1');
  });

  it('catches a product with neither a source nor an audit entry', () => {
    const bad = { ...ok, products: [{ slug: 'gp1', categoryId: 'hand' }] };
    expect(checkInvariants(bad)).toContain(
      'gp1 has no source and no audit entry naming who entered it',
    );
  });

  it('accepts an admin-created product that the audit log accounts for', () => {
    const fine = {
      ...ok,
      products: [{ slug: 'gp1', categoryId: 'hand' }],
      audit: [{ slug: 'gp1', actor: 'someone@example.com' }],
    };
    expect(checkInvariants(fine)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tools/catalogue-snapshot.test.ts
```

Expected: FAIL with "Cannot find module './catalogue-snapshot.mjs'".

- [ ] **Step 3: Write the implementation**

Create `tools/catalogue-snapshot.mjs`:

```js
/**
 * The catalogue's invariants, and the snapshot of its totals.
 *
 * This replaces three hard-coded numbers in tools/verify.mjs. Those numbers
 * were correct while the catalogue was a committed file; once it is editable
 * they move for good reasons, and a literal in a source file cannot express
 * "this changed on purpose".
 *
 * So the check splits in two. The INVARIANTS below can never legitimately
 * break, whatever anyone types into the admin, and are checked outright. The
 * TOTALS move, and are checked against a committed snapshot a person
 * regenerates deliberately -- the same pattern the counts block in CLAUDE.md
 * already uses.
 */

/** @returns {string[]} one message per violation; empty when the catalogue is sound */
export function checkInvariants({ divisions, categories, products, audit = [] }) {
  const problems = [];
  const divisionIds = new Set(divisions.map((d) => d.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  const slugs = new Set(products.map((p) => p.slug));
  const audited = new Set(audit.map((a) => a.slug));

  for (const c of categories) {
    if (!divisionIds.has(c.divisionId))
      problems.push(`category ${c.id} has divisionId "${c.divisionId}", which is not a division`);
    // null is legitimate: an empty category has no hero product.
    if (c.heroProductSlug != null && !slugs.has(c.heroProductSlug))
      problems.push(
        `category ${c.id} names heroProductSlug "${c.heroProductSlug}", which is not a product`,
      );
  }

  const seen = new Set();
  for (const p of products) {
    if (seen.has(p.slug)) problems.push(`duplicate slug: ${p.slug}`);
    seen.add(p.slug);

    if (!categoryIds.has(p.categoryId))
      problems.push(`${p.slug} has categoryId "${p.categoryId}", which is not a category`);

    // Rule 1's mechanical half. A record either cites a printed page or the
    // audit log names who typed it -- decision 1.1 of the 2026-08-13 plan.
    const hasSource = Boolean(p.source?.doc) && typeof p.source?.page === 'number';
    if (!hasSource && !audited.has(p.slug))
      problems.push(`${p.slug} has no source and no audit entry naming who entered it`);
  }

  return problems;
}

/** @returns {{divisions:number, categories:number, products:number, en388:number}} */
export function totals({ divisions, categories, products }) {
  return {
    divisions: divisions.length,
    categories: categories.length,
    products: products.length,
    en388: products.filter((p) => p.en388).length,
  };
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run tools/catalogue-snapshot.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Add the `--write` branch and generate the snapshot**

Append to `tools/catalogue-snapshot.mjs`:

```js
/* ---------------------------------------------------------------- CLI ---- */

/**
 * Reads whichever source the environment selects, so the snapshot is generated
 * from the same data the build will use. Reading the JSON while the build reads
 * Postgres would produce a snapshot that agrees with nothing.
 */
async function readCatalogue() {
  const source = process.env.CATALOGUE_SOURCE || 'json';
  if (source === 'json') {
    const read = (f) =>
      JSON.parse(fs.readFileSync(path.join(root, 'src/data', f), 'utf8'));
    return {
      divisions: read('divisions.json'),
      categories: read('categories.json'),
      products: read('products.json'),
      audit: [],
    };
  }
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const table = async (name) => {
    const { data, error } = await db.from(name).select('*');
    if (error) throw new Error(`reading ${name}: ${error.message}`);
    return data;
  };
  return {
    divisions: await table('divisions'),
    categories: await table('categories'),
    products: await table('products'),
    // Absent until Stage 5 creates it; an empty list simply means every product
    // must still cite a source, which is today's behaviour.
    audit: [],
  };
}

if (process.argv.includes('--write')) {
  const catalogue = await readCatalogue();
  const problems = checkInvariants(catalogue);
  if (problems.length) {
    console.error('refusing to snapshot a catalogue that violates its invariants:');
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }
  const out = path.join(root, 'tools/catalogue-snapshot.json');
  fs.writeFileSync(out, JSON.stringify(totals(catalogue), null, 2) + '\n');
  console.log('wrote', out, JSON.stringify(totals(catalogue)));
}
```

`root`, `fs` and `path` are the same imports `tools/counts.mjs` uses; copy that file's three lines. Then:

```bash
node tools/catalogue-snapshot.mjs --write && cat tools/catalogue-snapshot.json
```

Expected: `{"divisions":2,"categories":15,"products":94,"en388":6}`

- [ ] **Step 6: Re-point the gate in `tools/verify.mjs`**

Replace the body of the "no invented product facts" block with:

```js
{
  const { checkInvariants, totals } = await import('./catalogue-snapshot.mjs');
  const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'src/data', f), 'utf8'));
  const catalogue = {
    divisions: read('divisions.json'),
    categories: read('categories.json'),
    products: read('products.json'),
    audit: [],
  };

  const problems = checkInvariants(catalogue);

  /*
   * The totals are no longer literals here. They move whenever somebody adds a
   * product, which is the whole point of the admin, so pinning them in this
   * file would mean editing a gate every time the catalogue changes -- and a
   * gate you routinely edit is a gate you stop reading. The snapshot is
   * regenerated deliberately by a person, exactly like the counts block.
   */
  const snapshot = JSON.parse(
    fs.readFileSync(path.join(root, 'tools/catalogue-snapshot.json'), 'utf8'),
  );
  const now = totals(catalogue);
  for (const key of Object.keys(snapshot)) {
    if (now[key] !== snapshot[key])
      problems.push(
        `${key}: ${now[key]}, snapshot says ${snapshot[key]} -- run \`node tools/catalogue-snapshot.mjs --write\` if this is intended`,
      );
  }

  record(
    'catalogue shape',
    problems.length === 0,
    problems.length
      ? problems.join('; ')
      : `${now.products} products / ${now.categories} categories / ${now.en388} EN 388, invariants hold`,
  );
}
```

- [ ] **Step 7: Prove the gate still bites**

```bash
node -e "const f='tools/catalogue-snapshot.json',fs=require('fs'),s=JSON.parse(fs.readFileSync(f));s.products=93;fs.writeFileSync(f,JSON.stringify(s,null,2)+'\n')"
npm run verify 2>&1 | grep -A 2 "catalogue shape"
```

Expected: FAIL, naming the snapshot as stale. Then restore:

```bash
node tools/catalogue-snapshot.mjs --write
```

- [ ] **Step 8: Commit**

```bash
git add tools/catalogue-snapshot.mjs tools/catalogue-snapshot.json tools/catalogue-snapshot.test.ts tools/verify.mjs
git commit -m "feat(verify): the catalogue gate checks invariants and a snapshot, not three literals"
```

---

### Task 5: Teach `npm run counts` to read the snapshot — DONE 2026-08-17 (`7727571`)

**Files:**
- Modify: `tools/counts.mjs`, `tools/counts.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tools/counts.test.ts`:

```ts
it('reads catalogue totals from the snapshot rather than the JSON file', async () => {
  const fs = await import('node:fs');
  const { catalogueTotals } = await import('./counts.mjs');
  const snapshot = JSON.parse(fs.readFileSync('tools/catalogue-snapshot.json', 'utf8'));
  expect(catalogueTotals()).toEqual({
    products: snapshot.products,
    categories: snapshot.categories,
    divisions: snapshot.divisions,
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tools/counts.test.ts
```

Expected: FAIL — `catalogueTotals` is not exported.

- [ ] **Step 3: Implement `catalogueTotals()`**

In `tools/counts.mjs`:

```js
/**
 * The catalogue's totals for the counts block.
 *
 * Reads the snapshot rather than src/data/products.json, because once
 * CATALOGUE_SOURCE=postgres that file is no longer what the site is built
 * from -- and a counts block derived from a file the build ignores is the
 * stale-number problem this block exists to prevent.
 */
export function catalogueTotals() {
  const snapshot = JSON.parse(
    fs.readFileSync(path.join(root, 'tools/catalogue-snapshot.json'), 'utf8'),
  );
  return {
    products: snapshot.products,
    categories: snapshot.categories,
    divisions: snapshot.divisions,
  };
}
```

Then use it where the block's product, category and division numbers are produced, replacing the direct read of `products.json`.

- [ ] **Step 4: Run the test and regenerate**

```bash
npx vitest run tools/counts.test.ts && npm run build && npm run counts && cp CLAUDE.md AGENTS.md
```

Expected: PASS, then `CLAUDE.md and AGENTS.md updated`, with the counts block still reading 94 products.

- [ ] **Step 5: Commit**

```bash
git add tools/counts.mjs tools/counts.test.ts CLAUDE.md AGENTS.md
git commit -m "chore(counts): catalogue totals come from the snapshot, not the JSON"
```

---

### Task 6: Flip the deployment to Postgres — READY, needs one Vercel setting

**Files:** none. A Vercel setting and a redeploy.

- [ ] **Step 1: Confirm Task 3 is clean.** Do not proceed on a parity run with differences.

- [ ] **Step 2: Add the environment variable** in Vercel Project Settings → Environment Variables: `CATALOGUE_SOURCE=postgres`, Production **and** Preview.

- [ ] **Step 3: Redeploy** and watch the build log for the loader's row counts.

- [ ] **Step 4: Verify against the live site**

```bash
curl -s https://spartan-ebon.vercel.app/catalogue | grep -c 'data-product'
curl -s https://spartan-ebon.vercel.app/catalogue/spill-control | grep -c 'SAFCLE'
```

Expected: `94` and `7`.

**If the build failed, the loader threw rather than publishing a site with no products — that is the designed behaviour**, and the previous deployment stays live. Fix the cause and redeploy.

- [ ] **Step 5: Record it**

```bash
git commit --allow-empty -m "chore(catalogue): production now renders from Postgres

CATALOGUE_SOURCE=postgres set in Vercel. The code default stays json so CI,
which holds no Supabase credentials by design, keeps building."
```

---

# Stage 2 — Site text and banner options into Postgres

The same seam and the same pattern, applied to the two things Stage 1 does not cover. **No UI. The public site must not change.**

### Task 7: Extract the hero banner list into data

`Hero.astro` holds a hardcoded array of six imports. A banner cannot be selected, reordered or disabled without editing the component.

**Files:**
- Create: `src/data/hero-banners.json`, `src/lib/site-content.ts`, `src/lib/site-content.test.ts`
- Modify: `src/components/sections/Hero.astro`

- [ ] **Step 1: Write the failing test**

Create `src/lib/site-content.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getHeroBanners } from './site-content';

describe('getHeroBanners', () => {
  it('returns only enabled banners, in order', async () => {
    const banners = await getHeroBanners();
    expect(banners.length).toBeGreaterThan(0);
    const orders = banners.map((b) => b.order);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
    expect(banners.every((b) => b.enabled)).toBe(true);
  });

  it('excludes the two banners held back for accuracy', async () => {
    // The Grip Guard GP1 artwork prints an EN 388 rating contradicting the
    // glove's own label; the Orbit Fan artwork prints a model code belonging
    // to no product. Both are recorded in BACKLOG.md and must not reach the
    // home page until reissued.
    const files = (await getHeroBanners()).map((b) => b.file);
    expect(files).not.toContain('grip-guard-gp1.jpg');
    expect(files).not.toContain('orbit-fan.jpg');
  });

  it('every banner names a file that exists on disk', async () => {
    const fs = await import('node:fs');
    for (const b of await getHeroBanners()) {
      expect(fs.existsSync(`src/assets/banners/${b.file}`)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/site-content.test.ts
```

Expected: FAIL with "Cannot find module './site-content'".

- [ ] **Step 3: Create the data file**

Create `src/data/hero-banners.json`:

```json
[
  { "file": "spill-control.jpg", "name": "Spill Control", "order": 1, "enabled": true },
  { "file": "highbay-lights.jpg", "name": "Highbay Lights", "order": 2, "enabled": true },
  { "file": "solar-lights.jpg", "name": "Solar Lighting", "order": 3, "enabled": true },
  { "file": "fire-retardant-coveralls.jpg", "name": "Fire Retardant Coveralls", "order": 4, "enabled": true },
  { "file": "safety-vests.jpg", "name": "Safety Vests", "order": 5, "enabled": true },
  { "file": "insect-killer.jpg", "name": "Insect Killers", "order": 6, "enabled": true }
]
```

- [ ] **Step 4: Write the seam**

Create `src/lib/site-content.ts`:

```ts
/**
 * The seam for everything the public site renders that is NOT the catalogue.
 *
 * `catalog.ts` is rule 3's door for products; this is the same door for site
 * text and hero banners. No page or component may import `src/data/site.json`
 * or `src/data/hero-banners.json` directly once this exists, for the same
 * reason: swapping the source to Postgres must be a one-module change.
 */
import bannersJson from '../data/hero-banners.json';

export interface HeroBanner {
  /** Filename within `src/assets/banners/`. */
  file: string;
  /** Shown in the admin only; the slides are decorative and carry `alt=""`. */
  name: string;
  order: number;
  enabled: boolean;
}

export async function getHeroBanners(): Promise<HeroBanner[]> {
  return (bannersJson as HeroBanner[])
    .filter((b) => b.enabled)
    .sort((a, b) => a.order - b.order);
}
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run src/lib/site-content.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Rewire `Hero.astro` to use the seam**

Replace the hardcoded `BANNERS` array. `astro:assets` cannot take a runtime string path, so resolve each filename through the established `import.meta.glob` pattern:

```ts
const bannerImages = import.meta.glob<{ default: ImageMetadata }>('/src/assets/banners/*.jpg');
const banners = await Promise.all(
  (await getHeroBanners()).map(async (b) => ({
    ...b,
    src: (await bannerImages[`/src/assets/banners/${b.file}`]()).default,
  })),
);
const SLIDES = [...banners, banners[0]];
```

**The pip count, the keyframe percentages and the 42s clock are one system derived from six slides.** Enabling a seventh banner without changing them makes the lit pip report the wrong slide. Derive the per-slide percentage from `banners.length` rather than leaving the literals, and say so in the component.

- [ ] **Step 7: Verify the page is unchanged**

```bash
npm run build && npx playwright test tests/e2e/home.spec.ts tests/e2e/motion.spec.ts
```

Expected: all pass. The hero renders identically; only where the list comes from has changed.

- [ ] **Step 8: Commit**

```bash
git add src/data/hero-banners.json src/lib/site-content.ts src/lib/site-content.test.ts src/components/sections/Hero.astro
git commit -m "refactor(hero): the banner list is data behind the site-content seam"
```

---

### Task 8: Route site text through the same seam

Fifteen files import `src/data/site.json` directly. That is legal today because `site.json` is explicitly exempt from rule 3, but it means changing its source means changing fifteen files.

**Files:**
- Modify: `src/lib/site-content.ts`, `src/lib/site-content.test.ts`, `tools/verify.mjs`, and the 15 consumers

- [ ] **Step 1: List the consumers**

```bash
grep -rln "data/site" src/ | sort
```

Expected: 15 files.

- [ ] **Step 2: Write the failing test**

Add to `src/lib/site-content.test.ts`:

```ts
import { getSiteSettings } from './site-content';

describe('getSiteSettings', () => {
  it('returns the contact block and the industries list', async () => {
    const s = await getSiteSettings();
    expect(typeof s.phone).toBe('string');
    expect(typeof s.email).toBe('string');
    expect(Array.isArray(s.industries)).toBe(true);
    expect(s.industries).toHaveLength(8);
  });

  it('reports whether the industries are still client-unconfirmed', async () => {
    // handoff.md §8 item 5: the eight industries are inferred from the product
    // mix, not stated in the brochure, and the data says so. The admin has to
    // surface that rather than presenting them as confirmed fact.
    const s = await getSiteSettings();
    expect(typeof s.industriesPendingClientConfirmation).toBe('boolean');
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run src/lib/site-content.test.ts
```

Expected: FAIL — `getSiteSettings` is not exported.

- [ ] **Step 4: Add `getSiteSettings()`**

In `src/lib/site-content.ts`:

```ts
import siteJson from '../data/site.json';

export interface SiteSettings {
  phone: string;
  email: string;
  address: string;
  /** Empty string means "no WhatsApp affordance", which renders nothing. */
  whatsapp: string;
  established: number;
  industries: string[];
  /**
   * handoff.md §8 item 5: the eight industries are inferred from the product
   * mix rather than stated in the brochure. The flag travels with the data so
   * the admin can show it as unconfirmed instead of presenting it as fact.
   */
  industriesPendingClientConfirmation: boolean;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  return siteJson as SiteSettings;
}
```

- [ ] **Step 5: Repoint the 15 consumers** to import from the seam instead of `../data/site.json`. Mechanical, one import line each.

- [ ] **Step 6: Tighten rule 3's gate to cover it**

In `tools/verify.mjs`'s admin-seam gate, remove `site.json` from the exemption. With a seam in place, a direct import is now the same defect as importing `products.json`.

- [ ] **Step 7: Verify**

```bash
npm run verify
```

Expected: all gates pass, with the admin-seam gate now covering site content too.

- [ ] **Step 8: Commit**

```bash
git add src/lib/site-content.ts src/lib/site-content.test.ts tools/verify.mjs src/components src/pages src/scripts
git commit -m "refactor(site): site text goes through the seam, and the gate now covers it"
```

---

### Task 9: Tables, loader and seeder for site content

**Files:**
- Create: `src/loaders/supabase-site.ts`, `src/loaders/supabase-site.test.ts`, `tools/seed-site.mjs`
- Modify: `src/lib/site-content.ts`, `tools/catalogue-parity.mjs`

- [ ] **Step 1: Create the tables** in the Supabase SQL editor:

```sql
create table public.site_settings (
  id                                     int  primary key default 1,
  phone                                  text not null,
  email                                  text not null,
  address                                text not null,
  whatsapp                               text not null default '',
  established                            int  not null,
  industries                             jsonb not null,
  industries_pending_client_confirmation boolean not null default true,
  constraint single_row check (id = 1)
);

create table public.hero_banners (
  file    text primary key,
  name    text not null,
  "order" int  not null,
  enabled boolean not null default true
);

alter table public.site_settings enable row level security;
alter table public.hero_banners  enable row level security;
```

**RLS with zero policies, exactly like `enquiries` and `admins`.** Only the service-role key reads them, from a build or a guarded route. Supabase's linter reports `rls_enabled_no_policy` at INFO forever; that is the design, not a defect.

- [ ] **Step 2: Write the failing test**

Create `src/loaders/supabase-site.test.ts` asserting that a snake_case row maps to the camelCase shape the seam returns, and that `industries_pending_client_confirmation` survives the rename:

```ts
import { describe, it, expect } from 'vitest';
import { mapSiteSettings, mapHeroBanner } from './supabase-site';

describe('supabase-site mapping', () => {
  it('renames the snake_case confirmation flag', () => {
    const mapped = mapSiteSettings({
      id: 1,
      phone: '+973 0000 0000',
      email: 'sales@example.com',
      address: 'Line, City',
      whatsapp: '',
      established: 2015,
      industries: ['Oil and gas'],
      industries_pending_client_confirmation: true,
    });
    expect(mapped.industriesPendingClientConfirmation).toBe(true);
    expect(mapped).not.toHaveProperty('industries_pending_client_confirmation');
  });

  it('passes a banner row through unchanged', () => {
    expect(mapHeroBanner({ file: 'a.jpg', name: 'A', order: 1, enabled: true })).toEqual({
      file: 'a.jpg',
      name: 'A',
      order: 1,
      enabled: true,
    });
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

```bash
npx vitest run src/loaders/supabase-site.test.ts
```

Expected: FAIL with "Cannot find module './supabase-site'".

- [ ] **Step 4: Write `src/loaders/supabase-site.ts`**, modelled directly on `src/loaders/supabase-catalogue.ts` — same client construction, and the same `MINIMUM_ROWS` guard so an empty table throws rather than publishing a site with no contact details.

- [ ] **Step 5: Run the test**

```bash
npx vitest run src/loaders/supabase-site.test.ts
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Write `tools/seed-site.mjs`** on the pattern of `tools/seed-catalogue.mjs`, including the UTF-8 `--out` handling, then seed both tables using Task 1 Step 3's clipboard method.

- [ ] **Step 7: Wire `CATALOGUE_SOURCE` into the seam** so `site-content.ts` selects JSON or Postgres exactly as the catalogue does, keeping the same documented escape hatch.

- [ ] **Step 8: Extend parity to the whole site**

`tools/catalogue-parity.mjs` currently proves the catalogue. Extend it to cover site text and banners too, then:

```bash
npm run catalogue:parity
```

Expected: byte-identical output from both sources.

- [ ] **Step 9: Commit**

```bash
git add src/loaders/supabase-site.ts src/loaders/supabase-site.test.ts tools/seed-site.mjs src/lib/site-content.ts tools/catalogue-parity.mjs
git commit -m "feat(site): site text and hero banners can be read from Postgres"
```

---

## What Stages 3 to 6 will need, recorded now so it is not discovered late

- **An `admins.role` column**, if publishing is restricted (prerequisite P4).
- **A `catalogue_audit` table**: actor, entity, action, before/after JSON, timestamp. Load-bearing for the gate written in Task 4, which accepts an audit entry in place of a `source`.
- **A Supabase Storage bucket** for uploads, plus a same-origin proxy endpoint to display them: `img-src` is `'self' data:` and the design doc is explicit that it is proxied rather than widened.
- **A prebuild sync** pulling Storage images into `src/assets/` so Astro's optimiser still runs and the resolution rules still hold. Shared by product images and banner uploads; build it once.
- **Repeatable form rows without JavaScript.** Specs are variable-length and the admin has no client script. The established answer is to render existing rows plus three empty ones, with an "Add more rows" button that submits and re-renders.
- **Image validation on upload** — format, dimensions and transparency. The design needs knocked-out PNGs on dark surfaces; a JPEG with a white box behind the product is the single most likely upload mistake, and it is the same failure mode as the clip-forwarding bug in `tools/README.md`.

## Risks

- **Stage 1 changes what all 119 pages are built from.** It ships alone, behind the parity test, with nothing else in the commits.
- **Nothing here can be verified without prerequisite P1.** Without credentials, every task is checkable only by typecheck, unit test and build — the same limitation that produced a round of corrections after the admin redesign went live.
- **An editable catalogue weakens rule 1 by construction.** It survives only through the audit trail (decision 1.1) and the invariant gate in Task 4. A UI full of empty boxes invites filling them in, which is exactly what the rule exists to prevent.
- **Offline builds end** once the switch is flipped. That is inherent to the choice, not a defect, and it is why the `json` escape hatch stays.
- **Electrical Accessories must stay honestly empty.** It has no products because the brochure has none. The editor must not make it convenient to fill with placeholders.
