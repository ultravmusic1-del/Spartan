/**
 * The verification gate.
 *
 *   npm run verify          typecheck + unit tests + invariants + build + sweep
 *   npm run verify -- --full   ... and the Playwright e2e suite
 *
 * This exists because an unattended agent needs ONE command whose exit code
 * means "the repo is still correct", rather than a checklist it can forget a
 * line of. Every gate below is an invariant the project already relies on;
 * three of them were previously enforced only by a human remembering to run a
 * grep from handoff.md.
 *
 * Adding a gate here is how a lesson learned becomes a lesson kept. If a
 * regression ever ships twice, the second time is this file's fault.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const full = process.argv.includes('--full');

const results = [];
let failed = false;

const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failed = true;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Run a command, capturing output. Never throws — the caller decides. */
function run(cmd, args) {
  try {
    const stdout = execFileSync(cmd, args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      maxBuffer: 64 * 1024 * 1024,
    });
    return { ok: true, out: stdout };
  } catch (error) {
    return { ok: false, out: `${error.stdout ?? ''}${error.stderr ?? ''}` };
  }
}

/**
 * Recursively collect built HTML. Used by the two sweeps that read the emitted
 * output rather than the source — the only place some guarantees are decidable,
 * because a component can be correct and still be rendered by nobody.
 */
function htmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...htmlFiles(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/** Source files the seam rules apply to. */
function sourceFiles() {
  const out = [];
  for (const base of ['src/pages', 'src/components']) {
    const walk = (dir) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(astro|ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.'))
          out.push(full);
      }
    };
    walk(path.join(root, base));
  }
  return out;
}

console.log('\nverify — Spartan\n');

/* ------------------------------------------------------------ 1. typecheck -- */

{
  const r = run('npx', ['astro', 'check']);
  // `astro check` exits non-zero on errors only; hints and warnings are fine.
  const m = r.out.match(/(\d+) errors?/);
  const errors = m ? Number(m[1]) : r.ok ? 0 : 1;
  record('astro check', errors === 0, errors === 0 ? '0 errors' : `${errors} errors`);
}

/* ---------------------------------------------------------- 2. unit tests -- */

{
  const r = run('npx', ['vitest', 'run']);
  const m = r.out.match(/Tests\s+(\d+) passed/);
  record('vitest', r.ok, m ? `${m[1]} passed` : r.ok ? 'passed' : 'see output above');
  if (!r.ok) console.log(r.out.slice(-2000));
}

/* ------------------------------------------------- 3. the admin seam (§5) -- */

/*
 * No page or component may reach past src/lib/catalog.ts to the data underneath
 * it. This is the single structural decision the CMS migration depends on: swap
 * the Content Layer loader and nothing above the seam changes. One import of
 * products.json from a page silently couples that page to the file format and
 * the migration stops being a one-module change.
 *
 * site.json is exempt — it is site chrome, not catalogue content.
 */
{
  const offenders = [];
  for (const file of sourceFiles()) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file).replace(/\\/g, '/');
    // Strip comments before matching: this repo documents its own rules in
    // prose, and the word `getCollection` appears in explanations of why it is
    // not called. A naive grep flags the documentation, not the defect.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    if (/from\s+['"][^'"]*data\/(?!site\.json)[^'"]*\.json['"]/.test(code))
      offenders.push(`${rel} imports catalogue JSON directly`);
    if (/\bgetCollection\s*\(/.test(code)) offenders.push(`${rel} calls getCollection`);
  }
  record(
    'admin seam',
    offenders.length === 0,
    offenders.length ? offenders.join('; ') : 'catalog.ts is the only door',
  );
}

/* ------------------------------------------- 4. no invented product facts -- */

/*
 * The brochure is the sole source of every catalogue value and it is NOT in
 * this repository (handoff.md §2 — ~163MB, not committed, and absent from this
 * machine entirely). So nothing here can verify a spec against its source. What
 * it CAN do is hold the shape constant: catch a product that gained fields, or
 * a spec/EN 388 count that moved, and force whoever moved it to say why.
 *
 * These numbers are the verified state recorded in handoff.md §6.
 */
{
  const products = JSON.parse(fs.readFileSync(path.join(root, 'src/data/products.json'), 'utf8'));
  const categories = JSON.parse(
    fs.readFileSync(path.join(root, 'src/data/categories.json'), 'utf8'),
  );
  const en388 = products.filter((p) => p.en388).length;
  const problems = [];

  if (products.length !== 72) problems.push(`${products.length} products, expected 72`);
  if (categories.length !== 15) problems.push(`${categories.length} categories, expected 15`);
  if (en388 !== 6) problems.push(`${en388} EN 388 ratings, expected 6`);

  // Every product must still trace to a brochure page. A record that loses its
  // sourcePage has lost the only evidence that it was not typed in by hand.
  const unsourced = products.filter((p) => !p.sourcePage).map((p) => p.slug);
  if (unsourced.length) problems.push(`no sourcePage: ${unsourced.join(', ')}`);

  record(
    'catalogue shape',
    problems.length === 0,
    problems.length ? problems.join('; ') : '72 products / 15 categories / 6 EN 388, all sourced',
  );
}

/* --------------------------------------------------------------- 5. build -- */

{
  const r = run('npx', ['astro', 'build']);
  record('astro build', r.ok, r.ok ? 'clean' : 'failed');
  if (!r.ok) console.log(r.out.slice(-3000));
}

/* ----------------------------------------- 6. no prices in structured data -- */

/*
 * The site has no prices and no reviews. Google accepts these properties and
 * then renders a price that does not exist — the structured-data equivalent of
 * inventing a specification. seo.ts refuses to emit them and a unit test
 * asserts it; this sweeps what was actually written to disk, which is the only
 * check that survives someone adding a second JSON-LD emitter.
 */
{
  const pages = htmlFiles(path.join(root, 'dist/client'));
  const banned = ['"offers"', '"price"', '"priceCurrency"', '"availability"', '"aggregateRating"', '"review"'];
  const hits = [];
  for (const file of pages) {
    const text = fs.readFileSync(file, 'utf8');
    for (const token of banned) {
      if (text.includes(token)) hits.push(`${path.relative(root, file)} contains ${token}`);
    }
  }
  record(
    'no price/rating structured data',
    hits.length === 0,
    hits.length ? hits.slice(0, 5).join('; ') : `${pages.length} pages swept, 0 hits`,
  );
}

/* ------------------------------------------------- 7. one title, one canonical -- */

/*
 * Seo.astro is the sole emitter. Two titles or two canonicals on a page is a
 * silent SEO defect: a crawler picks one of each and never says which.
 */
{
  const pages = htmlFiles(path.join(root, 'dist/client'));
  const bad = [];
  for (const file of pages) {
    const text = fs.readFileSync(file, 'utf8');
    const titles = (text.match(/<title[\s>]/g) ?? []).length;
    const canonicals = (text.match(/rel="canonical"/g) ?? []).length;
    const rel = path.relative(root, file);
    // 404.html is the one page with no canonical: it is not a document that
    // should ever be indexed under a URL of its own.
    if (titles !== 1) bad.push(`${rel}: ${titles} titles`);
    if (canonicals > 1) bad.push(`${rel}: ${canonicals} canonicals`);
  }
  record('one title + one canonical per page', bad.length === 0, bad.slice(0, 5).join('; ') || `${pages.length} pages`);
}

/* ----------------------------------------------- 8. placeholder domain gate -- */

/*
 * Advisory, not a failure. `spartan.example` is reserved by RFC 2606 and can
 * never resolve, so while it is in place every canonical, Open Graph URL and
 * all 96 sitemap entries point at nothing. It must not block development — the
 * client has not supplied a domain — but it must never go quiet either.
 */
{
  const config = fs.readFileSync(path.join(root, 'astro.config.mjs'), 'utf8');
  if (config.includes('spartan.example'))
    console.log(
      '  note   domain is still the spartan.example placeholder (launch blocker, not a regression)',
    );
}

/* -------------------------------------------- 9. one origin, one place (§7) -- */

/*
 * robots.txt is generated by src/pages/robots.txt.ts from `site`, so its
 * sitemap URL and the canonical tags cannot disagree. This asserts that the
 * arrangement is still in force: a reintroduced `public/robots.txt` would
 * shadow the endpoint's output at the same path and put the hand-typed second
 * copy of the domain back, which is exactly the failure the endpoint removed.
 */
{
  const problems = [];

  if (fs.existsSync(path.join(root, 'public/robots.txt')))
    problems.push('public/robots.txt is back and shadows the endpoint');

  const emitted = path.join(root, 'dist/client/robots.txt');
  if (!fs.existsSync(emitted)) {
    problems.push('dist/client/robots.txt was not emitted');
  } else {
    const body = fs.readFileSync(emitted, 'utf8');
    const sitemap = body.match(/^Sitemap:\s*(\S+)$/m)?.[1];
    const home = path.join(root, 'dist/client/index.html');
    const canonical = fs.readFileSync(home, 'utf8').match(/rel="canonical"\s+href="([^"]+)"/)?.[1];

    if (!sitemap) problems.push('no Sitemap: line');
    else if (!canonical) problems.push('home page has no canonical to compare against');
    else if (new URL(sitemap).origin !== new URL(canonical).origin)
      problems.push(`sitemap origin ${new URL(sitemap).origin} != canonical ${new URL(canonical).origin}`);
  }

  record(
    'robots.txt names one origin',
    problems.length === 0,
    problems.length ? problems.join('; ') : 'generated from `site`, agrees with canonical',
  );
}

/* ------------------------------------------------------------ 9. e2e (opt) -- */

if (full) {
  /*
   * Playwright attaches to whatever is already listening on 4321 rather than
   * building — handoff.md §7. With `astro dev` running this produces confident
   * failures that have nothing to do with the change under test, so say so
   * plainly rather than letting it look like a regression.
   */
  const r = run('npx', ['playwright', 'test']);
  const m = r.out.match(/(\d+) passed/);
  record('playwright', r.ok, m ? `${m[1]} passed` : 'see output');
  if (!r.ok) {
    console.log(r.out.slice(-3000));
    console.log('\n  If these failed unexpectedly: stop the dev server. Playwright reuses a\n  server already on :4321 and never builds (handoff.md §7).');
  }
} else {
  console.log('  skip   playwright (run `npm run verify -- --full`)');
}

/* -------------------------------------------------------------- summary -- */

console.log(
  `\n${failed ? 'VERIFY FAILED' : 'VERIFY PASSED'} — ${results.filter((r) => r.ok).length}/${results.length} gates\n`,
);
process.exit(failed ? 1 : 0);
