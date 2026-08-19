/**
 * The catalogue's invariants, and the snapshot of its totals.
 *
 * This replaces three hard-coded numbers in `tools/verify.mjs` — 94 products,
 * 15 categories, 6 EN 388 ratings, read straight out of src/data/products.json.
 * Those numbers were right while the catalogue was a committed file that only a
 * developer could change. They stop being right twice over once the admin can
 * edit it: the totals move for good reasons, and products.json is no longer
 * what the site is built from.
 *
 * The obvious move is to delete the gate. That would be a mistake — it is one
 * of the few MECHANICAL defences rule 1 has, and rule 1 is the one about not
 * inventing data for safety equipment. So it changes shape instead:
 *
 *   INVARIANTS  can never legitimately break, whatever anyone types into the
 *               editor, and are checked outright. A product in a category that
 *               does not exist is a defect at 94 products and at 940.
 *
 *   TOTALS      move, and are held against a committed snapshot that a person
 *               regenerates deliberately. A number still cannot change without
 *               somebody acknowledging it; it is simply no longer a literal in
 *               a source file. This is exactly how the counts block in
 *               CLAUDE.md already works.
 *
 * Run `node tools/catalogue-snapshot.mjs --write` to regenerate the snapshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every violation, as a list of human-readable messages.
 *
 * Returns them ALL rather than throwing on the first: a gate that surfaces one
 * defect per run takes three runs to show three defects, and whoever is fixing
 * them deserves the whole picture at once.
 *
 * @param {{divisions: any[], categories: any[], products: any[], audit?: any[]}} catalogue
 * @returns {string[]} empty when the catalogue is sound
 */
export function checkInvariants({ divisions, categories, products, audit = [] }) {
  const problems = [];

  const divisionIds = new Set(divisions.map((d) => d.id));
  const categoryIds = new Set(categories.map((c) => c.id));
  const slugs = new Set(products.map((p) => p.slug));
  const audited = new Set(audit.map((a) => a.slug));

  for (const c of categories) {
    if (!divisionIds.has(c.divisionId))
      problems.push(`category ${c.id} has divisionId "${c.divisionId}", which is not a division`);

    /*
     * `null` is legitimate and must stay so. Electrical Accessories has no
     * products because the brochure has none, and its hero is null by design.
     * An invariant that treated that as a defect would push whoever hit it
     * towards inventing a placeholder product to satisfy the gate, which is
     * precisely the failure rule 1 exists to prevent.
     */
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

    /*
     * Rule 1's mechanical half, in the form decision 1.1 of the 2026-08-13 plan
     * settled on: a record either cites a printed page, or the audit log names
     * who typed it in.
     *
     * The argument for keeping anything at all, recorded because it is the one
     * that would otherwise be re-had: training governs whether someone invents
     * a figure today. It does not survive staff turnover, and it cannot answer
     * the question the field exists for — a maintainer in two years asking
     * where a specific rating came from. The audit trail answers that for free,
     * so nobody has to type anything extra.
     */
    const hasSource = Boolean(p.source?.doc) && typeof p.source?.page === 'number';
    if (!hasSource && !audited.has(p.slug))
      problems.push(`${p.slug} has no source and no audit entry naming who entered it`);
  }

  return problems;
}

/**
 * The numbers the committed snapshot pins.
 *
 * @param {{divisions: any[], categories: any[], products: any[]}} catalogue
 * @returns {{divisions: number, categories: number, products: number, en388: number}}
 */
export function totals({ divisions, categories, products }) {
  return {
    divisions: divisions.length,
    categories: categories.length,
    products: products.length,
    en388: products.filter((p) => p.en388).length,
  };
}

/**
 * Read whichever source the environment selects.
 *
 * Reading the JSON while the build reads Postgres would produce a snapshot that
 * agrees with nothing, so this follows CATALOGUE_SOURCE exactly as
 * src/content.config.ts does.
 */
export async function readCatalogue() {
  const source = process.env.CATALOGUE_SOURCE || 'json';

  if (source === 'json') {
    const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'src/data', f), 'utf8'));
    return {
      divisions: read('divisions.json'),
      categories: read('categories.json'),
      products: read('products.json'),
      audit: [],
    };
  }

  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('CATALOGUE_SOURCE=postgres needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const table = async (name) => {
    const { data, error } = await db.from(name).select('*');
    if (error) throw new Error(`reading ${name}: ${error.message}`);
    return data;
  };

  /*
   * The database column names are snake_case; the invariants read the camelCase
   * field names the schema uses. Mapping only what the checks actually touch,
   * rather than duplicating the loader's full mapping — this is a gate, not a
   * second source of truth about the shape.
   */
  const categories = (await table('categories')).map((c) => ({
    ...c,
    divisionId: c.division_id,
    heroProductSlug: c.hero_product_slug,
  }));
  const products = (await table('products')).map((p) => ({
    ...p,
    categoryId: p.category_id,
  }));

  let audit = [];
  const { data: auditRows } = await db.from('catalogue_audit').select('slug');
  if (auditRows) audit = auditRows;

  return { divisions: await table('divisions'), categories, products, audit };
}

/* ---------------------------------------------------------------- CLI ---- */

if (process.argv[1] && process.argv[1].endsWith('catalogue-snapshot.mjs')) {
  const catalogue = await readCatalogue();
  const problems = checkInvariants(catalogue);

  if (problems.length) {
    console.error('refusing to snapshot a catalogue that violates its own invariants:');
    for (const p of problems) console.error('  ' + p);
    process.exit(1);
  }

  const snapshot = totals(catalogue);

  if (process.argv.includes('--write')) {
    const target = path.join(root, 'tools/catalogue-snapshot.json');
    fs.writeFileSync(target, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    console.log(`wrote ${target}`);
  }

  console.log(JSON.stringify(snapshot));
}
