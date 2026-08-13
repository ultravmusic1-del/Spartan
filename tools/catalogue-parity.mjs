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
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

/*
 * The first build is kept OUTSIDE the project, and that is not tidiness.
 *
 * It was `.catalogue-parity` in the repository root, and the second build then
 * hashed its CSS chunks differently — `Eyebrow.sK7drO_z.css` against
 * `Eyebrow.2wLP16Hd.css` — for every page, which is what turned 0 real
 * differences into 112 reported ones. Vite walks the project directory when it
 * builds, and a 522-file copy of a previous build sitting inside it is not
 * inert. The comparison has to observe the build without perturbing it.
 */
const keep = path.join(os.tmpdir(), 'spartan-catalogue-parity');

function build(source) {
  process.stdout.write(`\n  building with CATALOGUE_SOURCE=${source} ...\n`);

  /*
   * THE CONTENT STORE CACHE HAS TO GO BETWEEN BUILDS.
   *
   * Astro caches the parsed content collections under `.astro/`, and it keys
   * that cache on the content, not on which loader produced it. Leaving it in
   * place meant the second build reused entries the first had written, and the
   * comparison reported differences that were cache artefacts rather than
   * mapping defects — 112 of them on the first real run, against 47 genuine
   * ones. A harness that invents failures is worse than no harness: it trains
   * you to discount its output.
   */
  fs.rmSync(path.join(root, '.astro'), { recursive: true, force: true });

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

console.log(`\n  json build: ${before.size} files, postgres build: ${after.size} files`);

/* -------------------------------------------------------------- compare -- */

const problems = [];

for (const [file, hash] of before) {
  if (!after.has(file)) problems.push(`missing from the Postgres build: ${file}`);
  else if (after.get(file) !== hash) problems.push(`differs: ${file}`);
}
for (const file of after.keys()) {
  if (!before.has(file)) problems.push(`only in the Postgres build: ${file}`);
}

console.log('');
if (problems.length === 0) {
  fs.rmSync(keep, { recursive: true, force: true });
  console.log(`  PARITY OK — ${before.size} files identical from both sources.`);
  console.log('  Safe to switch CATALOGUE_SOURCE to postgres.');
  process.exit(0);
}

console.log(`  PARITY FAILED — ${problems.length} difference(s):\n`);

/*
 * Show the first actual divergence, not just which files disagree.
 *
 * A list of filenames says a difference exists; it does not say whether it is a
 * dropped field, a reordered list or — as on 2026-08-13 — a mangled character.
 * The first run of this tool listed 47 files and it took another twenty minutes
 * to learn that `±` had become `┬▒`. One excerpt would have said it instantly.
 */
{
  const first = problems.find((p) => p.startsWith('differs: '))?.slice('differs: '.length);
  if (first) {
    const a = fs.readFileSync(path.join(keep, first), 'utf8');
    const b = fs.readFileSync(path.join(dist, first), 'utf8');
    let at = 0;
    while (at < Math.min(a.length, b.length) && a[at] === b[at]) at += 1;
    const window = (s) => JSON.stringify(s.slice(Math.max(0, at - 60), at + 60));
    console.log(`    first divergence, in ${first}, at character ${at}:`);
    console.log(`      json     ${window(a)}`);
    console.log(`      postgres ${window(b)}\n`);
  }
}

// Capped, because a mapping mistake tends to break every page at once and 110
// identical-looking lines say no more than twenty do.
for (const problem of problems.slice(0, 20)) console.log(`    ${problem}`);
if (problems.length > 20) console.log(`    ... and ${problems.length - 20} more`);
console.log('\n  Do NOT switch CATALOGUE_SOURCE. Each difference is a mapping defect.');
console.log(`  The JSON build is kept at ${path.relative(root, keep)} for comparison.`);
process.exit(1);
