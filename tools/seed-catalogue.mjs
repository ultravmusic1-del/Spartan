/**
 * Emit the SQL that loads src/data/*.json into the catalogue tables.
 *
 * Prints to stdout; it does not connect to anything. That is deliberate — this
 * machine has no Supabase credentials, and a seeder that needs them could not be
 * written or reviewed here at all. Piping the output somewhere is the caller's
 * decision, which also means the statements can be read before they are run.
 *
 *   node tools/seed-catalogue.mjs > seed.sql
 *
 * IDEMPOTENT BY DESIGN. Every statement is an upsert keyed on the primary key,
 * so running it twice is the same as running it once. That matters because this
 * is how the database is brought back into line with the committed JSON if the
 * two ever diverge during Phase 2 — the escape hatch is only useful if going
 * back is as easy as going forward.
 *
 * Insert order is divisions -> categories -> products, because the foreign keys
 * point that way.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, 'src/data', name), 'utf8'));

/**
 * A SQL string literal.
 *
 * Doubling the quote is the whole of the escaping, and it is enough because
 * every value here is interpolated into a quoted literal — there is no
 * identifier interpolation anywhere in this file. `null` is emitted unquoted so
 * an absent EN 388 rating stays absent rather than becoming the four-character
 * string "null", which would satisfy the schema and mean the opposite.
 */
export function lit(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** A jsonb literal. Same escaping, cast so Postgres parses rather than stores. */
export function json(value) {
  if (value === null || value === undefined) return 'null';
  return `${lit(JSON.stringify(value))}::jsonb`;
}

/**
 * One multi-row INSERT per table rather than one statement per record.
 *
 * The `on conflict do update set …` clause runs to roughly 400 characters and
 * is identical every time; written per row it was 34KB of the 91KB emitted, for
 * 85 products. Written once per statement it is 400 bytes. The whole seed drops
 * by more than a third, which matters because the limit on getting this into a
 * database is the size of one payload.
 */
function upsert(table, columns, conflict, rows) {
  const set = columns
    .filter((c) => c !== conflict)
    .map((c) => `${c} = excluded.${c}`)
    .join(', ');

  return (
    `insert into public.${table} (${columns.join(', ')}) values\n` +
    rows.map((cells) => `  (${cells.join(', ')})`).join(',\n') +
    `\non conflict (${conflict}) do update set ${set};`
  );
}

const DIVISION_COLUMNS = ['id', 'slug', 'name', 'blurb', 'hero_image', '"order"'];
const CATEGORY_COLUMNS = [
  'id',
  'slug',
  'name',
  'division_id',
  'description',
  'hero_product_slug',
  'status',
  '"order"',
];
/**
 * The product table's columns, in the order `productCells` emits them.
 *
 * EXPORTED so a test can hold it against `productSchema`. On 2026-08-17 the
 * schema gained `datasheetUrl` and `kavalaniUrl` and this list did not follow,
 * so the seeder silently dropped both: the INSERT succeeded, every row was
 * short two fields, and the parity build then reported a difference that read
 * like a defect in the LOADER rather than in the data it had been given. The
 * test that pins this to the schema is what stops that happening again.
 */
export const PRODUCT_COLUMNS = [
  'slug',
  'name',
  'variant_label',
  'category_id',
  'images',
  'specs',
  'en388',
  'status',
  'source',
  '"order"',
  'datasheet_url',
  'kavalani_url',
];

export const divisionCells = (d) => [
  lit(d.id),
  lit(d.slug),
  lit(d.name),
  lit(d.blurb),
  lit(d.heroImage),
  d.order,
];

export const categoryCells = (c) => [
  lit(c.id),
  lit(c.slug),
  lit(c.name),
  lit(c.divisionId),
  lit(c.description),
  lit(c.heroProductSlug),
  lit(c.status),
  c.order,
];

export const productCells = (p) => [
  lit(p.slug),
  lit(p.name),
  lit(p.variantLabel ?? null),
  lit(p.categoryId),
  json(p.images),
  json(p.specs),
  // Absent stays absent. `p.en388` is undefined on 79 of 85 records and must
  // not become an empty object.
  json(p.en388 ?? null),
  lit(p.status ?? 'published'),
  json(p.source ?? null),
  p.order,
  /*
   * Absent stays absent, and here it matters twice over. Both fields are
   * validated by a regex that an empty string FAILS, and the loader writes the
   * key only when the column is non-NULL — so `''` would round-trip into the
   * schema and break the build. `lit(null)` emits an unquoted `null`, which is
   * how "this product has no datasheet" is said in SQL.
   */
  lit(p.datasheetUrl ?? null),
  lit(p.kavalaniUrl ?? null),
];

/**
 * The seed, as a list of statements.
 *
 * Products are split across several statements so a chunk is always a whole
 * number of statements — see the CLI block. Divisions and categories are small
 * enough to be one each.
 */
export function seedSql({ productsPerStatement = 12, only = null } = {}) {
  const all = read('products.json');

  /*
   * `only` narrows to named slugs, and skips the divisions and categories
   * entirely. It exists for repair rather than for seeding: when a subset of
   * rows is known to be wrong — as after the encoding incident on 2026-08-13 —
   * re-sending 85 products to fix 27 is a lot of payload for no benefit.
   */
  const products = only ? all.filter((p) => only.includes(p.slug)) : all;

  const statements = only
    ? []
    : [
        upsert('divisions', DIVISION_COLUMNS, 'id', read('divisions.json').map(divisionCells)),
        upsert('categories', CATEGORY_COLUMNS, 'id', read('categories.json').map(categoryCells)),
      ];

  for (let i = 0; i < products.length; i += productsPerStatement) {
    statements.push(
      upsert(
        'products',
        PRODUCT_COLUMNS,
        'slug',
        products.slice(i, i + productsPerStatement).map(productCells),
      ),
    );
  }

  return statements;
}

if (process.argv[1] && process.argv[1].endsWith('seed-catalogue.mjs')) {
  const onlyIndex = process.argv.indexOf('--only');
  const only =
    onlyIndex === -1 || !process.argv[onlyIndex + 1]
      ? null
      : process.argv[onlyIndex + 1].split(',').map((s) => s.trim());

  const statements = seedSql({ only, productsPerStatement: only ? 6 : 12 });

  /*
   * `--chunk N --of M` prints one slice.
   *
   * The whole seed is ~90KB, which is more than some SQL consoles and API
   * calls will take in one go. Slicing is done HERE, on the array of
   * statements, rather than by cutting the emitted text somewhere else: a
   * blurb or a spec value may contain a semicolon and a newline, so any
   * text-splitting heuristic downstream is one unlucky value away from
   * emitting half a statement. This cannot be, because it only ever cuts
   * between array elements.
   *
   * Order still matters across chunks — divisions before categories before
   * products — so run them in sequence.
   */
  const arg = (name) => {
    const i = process.argv.indexOf(name);
    return i === -1 ? null : Number(process.argv[i + 1]);
  };

  const of = arg('--of');
  const chunk = arg('--chunk');

  let slice = statements;
  if (of && chunk) {
    const size = Math.ceil(statements.length / of);
    slice = statements.slice((chunk - 1) * size, chunk * size);
  }

  const sql = slice.join('\n') + '\n';

  /*
   * `--out <path>` WRITES THE FILE ITSELF, AND IT IS THE SUPPORTED WAY.
   *
   * Piping with `>` looks equivalent and is not: Windows PowerShell 5.1's
   * redirection re-encodes the stream in the console codepage, so every
   * non-ASCII character in the catalogue is silently mangled on the way to
   * disk. That happened for real on 2026-08-13 — `±`, `Ω` and `—` reached
   * Postgres as `┬▒`, `╬⌐` and `ΓÇö`, the seed appeared to succeed, and the
   * corruption only surfaced when the parity build compared 47 product pages
   * against the JSON.
   *
   * fs.writeFileSync with an explicit encoding takes the shell out of the
   * question entirely.
   */
  const outIndex = process.argv.indexOf('--out');
  if (outIndex !== -1 && process.argv[outIndex + 1]) {
    const target = path.resolve(process.argv[outIndex + 1]);
    fs.writeFileSync(target, sql, 'utf8');
    process.stderr.write(`wrote ${slice.length} statements to ${target} (utf8)\n`);
  } else {
    process.stdout.write(sql);
    process.stderr.write(
      of && chunk
        ? `chunk ${chunk}/${of}: ${slice.length} of ${statements.length} statements\n`
        : `${statements.length} statements\n`,
    );
  }
}
