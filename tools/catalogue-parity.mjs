/**
 * Phase 2's acceptance test: does the site built from Postgres match the site
 * built from the committed JSON, byte for byte?
 *
 *   node tools/catalogue-parity.mjs
 *
 * Builds twice — once with CATALOGUE_SOURCE=json, once with postgres — and
 * compares every emitted file. Any difference is a migration defect: a column
 * that did not map, a null that became an empty string, an order that shifted.
 *
 * THIS IS THE STRONGEST TEST AVAILABLE HERE, and it is why the loader swap ships
 * on its own. It does not check that the database "looks right"; it checks that
 * 110 pages of rendered HTML are indistinguishable, which is the only claim that
 * actually matters to a visitor.
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Without them the Postgres
 * build cannot run at all, which is why this is a script you run rather than a
 * gate in `npm run verify` — CI holds no credentials and never will.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const keep = path.join(root, '.catalogue-parity');

function build(source) {
  process.stdout.write(`\n  building with CATALOGUE_SOURCE=${source} ...\n`);
  execFileSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, CATALOGUE_SOURCE: source },
  });
}

/** Every emitted file, as a path -> sha256 map. */
function fingerprint(dir) {
  const out = new Map();

  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const rel = path.relative(dir, full).replace(/\\/g, '/');
        out.set(rel, crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex'));
      }
    }
  };

  walk(dir);
  return out;
}

if (fs.existsSync(keep)) fs.rmSync(keep, { recursive: true, force: true });

build('json');
fs.cpSync(dist, keep, { recursive: true });
const before = fingerprint(keep);

build('postgres');
const after = fingerprint(dist);

/* -------------------------------------------------------------- compare -- */

const problems = [];

for (const [file, hash] of before) {
  if (!after.has(file)) problems.push(`missing from the Postgres build: ${file}`);
  else if (after.get(file) !== hash) problems.push(`differs: ${file}`);
}
for (const file of after.keys()) {
  if (!before.has(file)) problems.push(`only in the Postgres build: ${file}`);
}

fs.rmSync(keep, { recursive: true, force: true });

console.log('');
if (problems.length === 0) {
  console.log(`  PARITY OK — ${before.size} files identical from both sources.`);
  console.log('  Safe to switch CATALOGUE_SOURCE to postgres.');
  process.exit(0);
}

console.log(`  PARITY FAILED — ${problems.length} difference(s):\n`);
// Capped, because a mapping mistake tends to break every page at once and 110
// identical-looking lines say no more than twenty do.
for (const problem of problems.slice(0, 20)) console.log(`    ${problem}`);
if (problems.length > 20) console.log(`    ... and ${problems.length - 20} more`);
console.log('\n  Do NOT switch CATALOGUE_SOURCE. Each difference is a mapping defect.');
process.exit(1);
