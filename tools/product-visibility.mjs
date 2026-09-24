/**
 * Hide products from the public site, or bring them back.
 *
 *   npm run products:hide -- <slug> [<slug> ...]
 *   npm run products:show -- <slug> [<slug> ...]
 *
 * A hidden product is `status: 'draft'`. `src/lib/catalog.ts` reads only
 * published products, so a draft is on no page, in no list, count, search or
 * sitemap, and its own URL is not built. Nothing about it is deleted — specs,
 * source and images stay exactly as they were — so showing it again is one
 * command and a rebuild.
 *
 * WHY THIS EXISTS, 2026-09-24. The client asked for the five products whose
 * only picture is `ds-photo-pending.png` (three portable air coolers, solar
 * street lights, PVC gloves) to come off the site until photography exists,
 * restorable easily. The admin form shows Status read-only, and the Supabase
 * connection available to an assistant is read-only, so there was no route to
 * flip it that did not mean hand-editing two stores.
 *
 * IT WRITES BOTH STORES, because the site has two. Production builds from
 * Postgres (`CATALOGUE_SOURCE=postgres`); local builds and the unit tests read
 * `src/data/products.json`. Changing one leaves them disagreeing about what
 * the site shows. The JSON edit touches only the one `"status"` line per
 * product, so the diff is the change and nothing else.
 *
 * The database write records a `catalogue_audit` row per product, as an admin
 * edit does, so the change has an author and a before/after.
 *
 * AFTERWARDS the live site still shows the old state until it is rebuilt:
 * commit and push `src/data/products.json` (which deploys), or press Publish
 * at /admin/catalogue. The build is what publishes; this only records intent.
 *
 * Without SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY it edits the JSON only
 * and says so — useful against a checkout with no database, and never silent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTS_JSON = path.join(root, 'src/data/products.json');

/**
 * Set one product's status inside the products.json TEXT, changing nothing
 * else. Throws if the slug is absent or its record has no status line.
 *
 * @param {string} text the file's contents
 * @param {string} slug
 * @param {'published' | 'draft'} status
 * @returns {{ text: string, before: string }}
 */
export function setStatusInJson(text, slug, status) {
  const start = text.indexOf(`"slug": "${slug}"`);
  if (start < 0) throw new Error(`no product "${slug}" in src/data/products.json`);
  // The record ends where the next one's slug begins.
  const next = text.indexOf('"slug": "', start + 1);
  const end = next < 0 ? text.length : next;
  const match = /"status": "(published|draft)"/.exec(text.slice(start, end));
  if (!match) throw new Error(`product "${slug}" has no status line in src/data/products.json`);
  const at = start + match.index;
  return {
    text: `${text.slice(0, at)}"status": "${status}"${text.slice(at + match[0].length)}`,
    before: match[1],
  };
}

async function run(action, slugs) {
  if (!['hide', 'show'].includes(action) || slugs.length === 0) {
    console.error('usage: npm run products:hide -- <slug> [...]  |  npm run products:show -- <slug> [...]');
    process.exit(2);
  }
  const status = action === 'hide' ? 'draft' : 'published';

  // The JSON first, all-or-nothing: an unknown slug stops the run before
  // either store is touched.
  let text = fs.readFileSync(PRODUCTS_JSON, 'utf8');
  const changes = [];
  for (const slug of slugs) {
    const result = setStatusInJson(text, slug, status);
    text = result.text;
    changes.push({ slug, before: result.before });
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    const { createClient } = await import('@supabase/supabase-js');
    const db = createClient(url, key, { auth: { persistSession: false } });
    for (const { slug } of changes) {
      const { data: row, error: readError } = await db
        .from('products')
        .select('status')
        .eq('slug', slug)
        .maybeSingle();
      if (readError) throw new Error(`could not read "${slug}": ${readError.message}`);
      if (!row) throw new Error(`no product "${slug}" in the database — nothing changed there`);
      if (row.status === status) {
        console.log(`  database  ${slug}: already ${status}`);
        continue;
      }
      const { error } = await db.from('products').update({ status }).eq('slug', slug);
      if (error) throw new Error(`could not update "${slug}": ${error.message}`);
      const { error: auditError } = await db.from('catalogue_audit').insert({
        actor: 'tools/product-visibility.mjs',
        entity: 'product',
        entity_id: slug,
        action: 'update',
        before: { status: row.status },
        after: { status },
      });
      if (auditError) console.warn(`  warning   ${slug}: updated, but no audit row (${auditError.message})`);
      console.log(`  database  ${slug}: ${row.status} -> ${status}`);
    }
  } else {
    console.log('  database  skipped: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  }

  fs.writeFileSync(PRODUCTS_JSON, text);
  for (const { slug, before } of changes) console.log(`  json      ${slug}: ${before} -> ${status}`);
  console.log(
    '\nThe live site changes at the next build: commit and push src/data/products.json, or press Publish at /admin/catalogue.',
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [action, ...slugs] = process.argv.slice(2);
  await run(action, slugs);
}
