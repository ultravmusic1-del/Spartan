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

// Hoisted: the counts gate below reuses this rather than running the suite a
// second time, which would double the slowest gate in the file.
let unitTests = null;

{
  const r = run('npx', ['vitest', 'run']);
  const m = r.out.match(/Tests\s+(\d+) passed/);
  if (m) unitTests = Number(m[1]);
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

  // 72 from the brochure + 13 from the per-family datasheet PDFs. This was 72
  // while the brochure was the only source document; see handoff.md §6a.
  if (products.length !== 85) problems.push(`${products.length} products, expected 85`);
  if (categories.length !== 15) problems.push(`${categories.length} categories, expected 15`);
  if (en388 !== 6) problems.push(`${en388} EN 388 ratings, expected 6`);

  /*
   * Every product must still trace to a page of a named document. A record that
   * loses its provenance has lost the only evidence that it was not typed in by
   * hand.
   *
   * This was a bare `sourcePage: number` while the brochure was the only source.
   * It is `source: { doc, page }` now because it no longer is — 28 records cite
   * a datasheet PDF instead, and a page number alone no longer identifies
   * anything. Both halves are checked: a `doc` with no `page` points at a
   * document without saying where in it, which is not provenance either.
   */
  const unsourced = products
    .filter((p) => !p.source?.doc || typeof p.source?.page !== 'number')
    .map((p) => p.slug);
  if (unsourced.length) problems.push(`no source {doc,page}: ${unsourced.join(', ')}`);

  record(
    'catalogue shape',
    problems.length === 0,
    problems.length ? problems.join('; ') : '85 products / 15 categories / 6 EN 388, all sourced',
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

/* --------------------------------------------- 9. the CSP matches the build -- */

/*
 * `script-src` is hash-based, so every executable inline script in the output
 * has to be named in vercel.json. Astro emits most of them itself — the island
 * runtime and one shim per client directive — and an Astro upgrade can change
 * any of them by a byte. A stale hash does not fail the build: it ships, and
 * the site renders and never hydrates.
 *
 * So the hashes are re-derived here from what was just built and compared with
 * what is committed. This is the check that turns a silent production failure
 * into a red gate.
 */
{
  const { inlineScriptHashes, buildCsp } = await import('./csp.mjs');
  const problems = [];

  try {
    const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const committed = config.headers
      ?.find((h) => h.source === '/(.*)')
      ?.headers?.find((h) => h.key === 'Content-Security-Policy')?.value;

    if (!committed) problems.push('vercel.json has no Content-Security-Policy');
    else {
      const expected = buildCsp(inlineScriptHashes());
      if (committed !== expected) problems.push('stale — run `npm run csp` and commit the result');
      if (/script-src[^;]*unsafe-inline/.test(committed))
        problems.push("script-src permits 'unsafe-inline'");
    }
  } catch (error) {
    problems.push(`could not read vercel.json: ${error.message}`);
  }

  record(
    'CSP covers every inline script',
    problems.length === 0,
    problems.length ? problems.join('; ') : 'hashes match the build',
  );
}

/* ------------------------------------------- 10. one origin, one place (§7) -- */

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

/* --------------------------------------- 11. the service-role key is server -- */

/*
 * `SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security completely. The
 * enquiries table is protected by RLS with zero policies, so that key is the
 * only thing standing between the public internet and every name, email address
 * and phone number the site has ever collected.
 *
 * Two ways it could leak, both silent:
 *
 *  1. A client-side module referencing it. Vite inlines `import.meta.env.*` at
 *     build time, so the literal secret would be substituted into a bundle and
 *     served. Nothing warns; the site works perfectly.
 *  2. A component importing `enquiry-store.ts`, which would drag the client and
 *     its credential into the browser graph.
 *
 * The source check is decidable on every run. The output sweep only bites when
 * the build had real credentials — which is exactly the build that could leak
 * one — so both are here rather than either alone.
 */
{
  const problems = [];
  const clientDirs = ['src/components', 'src/scripts', 'src/stores', 'src/layouts'];

  const walk = (dir, hit) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, hit);
      else if (/\.(astro|ts|tsx|js)$/.test(entry.name) && !entry.name.includes('.test.')) hit(full);
    }
  };

  for (const base of clientDirs) {
    walk(path.join(root, base), (file) => {
      const text = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
      const rel = path.relative(root, file).replace(/\\/g, '/');
      if (text.includes('SUPABASE_SERVICE_ROLE_KEY')) problems.push(`${rel} names the service-role key`);
      if (/from\s+['"][^'"]*enquiry-store['"]/.test(text)) problems.push(`${rel} imports enquiry-store`);
    });
  }

  // Built output. `service_role` is in the payload of every such JWT, so it
  // catches a leaked key whatever variable carried it there.
  const secret = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
  const assets = [];
  const collect = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (/\.(html|js|css|json)$/.test(entry.name)) assets.push(full);
    }
  };
  collect(path.join(root, 'dist/client'));

  for (const file of assets) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (text.includes('service_role')) problems.push(`${rel} contains a service_role token`);
    else if (secret && text.includes(secret)) problems.push(`${rel} contains the service-role key`);
  }

  record(
    'service-role key never reaches the client',
    problems.length === 0,
    problems.length
      ? problems.slice(0, 5).join('; ')
      : `${assets.length} built assets clean, ${clientDirs.length} client dirs clean`,
  );
}

/* ------------------------------------------- 12. CLAUDE.md and AGENTS.md -- */

/*
 * These two files are one document with two names, because Claude Code reads
 * the first and other harnesses read the second. They were byte-identical when
 * this gate was written and nothing whatsoever enforced it — the copy existed
 * only because someone had remembered to make it.
 *
 * That is the same mechanism that let `.claude/commands/improve.md` go on
 * defending the hero video's GOP for eleven commits after the video was
 * deleted. Duplicated guidance with no gate drifts, and the drift is invisible
 * because prose does not fail.
 *
 * Line endings are normalised before comparing: this repo is developed on
 * Windows and git rewrites LF to CRLF in the working copy, which an editor can
 * apply to one file and not the other. That difference is not the drift this
 * gate is looking for.
 */
{
  const read = (rel) =>
    fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
  const claude = read('CLAUDE.md');
  const agents = read('AGENTS.md');
  const same = claude === agents;

  record(
    'CLAUDE.md and AGENTS.md agree',
    same,
    same
      ? `${claude.length} chars, identical`
      : 'diverged — copy one over the other, do not merge by hand',
  );
}

/* ------------------------------------ 13. instructional docs name real paths -- */

/*
 * See tools/doc-paths.mjs for why this exists and why handoff.md is exempt.
 *
 * `docs/TRAPS.md` may not exist yet when this gate first lands; a missing file
 * in the list is skipped rather than failed, because the gate's job is to check
 * the references inside a document, not to assert which documents exist. The
 * counts gate below would notice a document that vanished.
 */
{
  const { INSTRUCTIONAL, extractPaths, resolves } = await import('./doc-paths.mjs');
  const problems = [];
  let checked = 0;

  for (const rel of INSTRUCTIONAL) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    for (const token of extractPaths(fs.readFileSync(file, 'utf8'))) {
      checked += 1;
      if (!resolves(root, token)) problems.push(`${rel} names \`${token}\`, which does not exist`);
    }
  }

  record(
    'instructional docs name real paths',
    problems.length === 0,
    problems.length ? problems.slice(0, 5).join('; ') : `${checked} references, all resolve`,
  );
}

/* --------------------------------------- 14. the enquiry clients tell the truth -- */

/*
 * Rule 2: never report an enquiry as sent when it was not — and, just as
 * importantly, never report one as lost when it was kept.
 *
 * An enquiry travels two independent channels. It is written to Postgres, which
 * is the system of record, and an email notification is sent. Either is enough
 * for the submission to be a success: with the row written, a mail outage costs
 * a notification, not a lead. So the honest signal is `recorded || delivered`,
 * and a client keying off `delivered` alone tells a willing buyer their enquiry
 * failed while the row sits in the database.
 *
 * That is not hypothetical. CLAUDE.md described exactly that wrong contract
 * until 2026-08-10, so an agent following the guidance would have introduced
 * it.
 *
 * The e2e suite already pins the response SHAPE with exhaustive toEqual
 * assertions. This pins that the UI reads it. Comments are stripped first
 * because both files explain the two-channel model in prose, and a naive grep
 * would pass on the explanation while the code did the wrong thing.
 *
 * Matching both identifiers in one expression, rather than `recorded` alone,
 * came out of review: the bare-identifier version passed on a client that kept
 * the field in its response type and keyed the branch off `delivered`.
 */
{
  const clients = ['src/components/enquiry/EnquiryForm.tsx', 'src/scripts/quick-enquiry.ts'];

  /*
   * Both identifiers, in one expression. `[^;]` is the whole trick: the real
   * code combines the two channels in a single expression
   * (`Boolean(body.recorded) || Boolean(body.delivered)`), while the type
   * declarations that merely name them are separate statements with a `;`
   * between. Matching the bare identifier would accept a client that kept
   * `recorded?: boolean;` in its response type and changed only the branch —
   * the exact regression this gate is for.
   */
  const COMBINED = /\brecorded\b[^;]{0,120}\bdelivered\b|\bdelivered\b[^;]{0,120}\brecorded\b/;
  const problems = [];

  for (const rel of clients) {
    const code = fs
      .readFileSync(path.join(root, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    if (!COMBINED.test(code))
      problems.push(
        `${rel} never combines \`recorded\` with \`delivered\` — it can only report a stored enquiry as lost`,
      );
  }

  record(
    'enquiry clients honour `recorded`',
    problems.length === 0,
    problems.length ? problems.join('; ') : `${clients.length} clients read both channels`,
  );
}

/* --------------------------------------------- 15. the counts are current -- */

/*
 * See tools/counts.mjs for the history. The short version: five copies of one
 * number, in three files, none of which read the test suite.
 *
 * Skipped when vitest did not report a count — a failed test run has already
 * failed the suite, and reporting a stale-counts error on top of it would point
 * the next reader at the wrong problem.
 */
{
  const { computeCounts, renderBlock, replaceBlock, TARGETS } = await import('./counts.mjs');

  if (unitTests === null) {
    console.log('  skip   counts (vitest reported no count)');
  } else {
    const expected = renderBlock(computeCounts({ unitTests }));
    const problems = [];

    for (const rel of TARGETS) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
      if (replaceBlock(text, expected) === null) problems.push(`${rel} has no counts block`);
      else if (!text.includes(expected)) problems.push(`${rel} is stale — run \`npm run counts\``);
    }

    record(
      'counts match the repo',
      problems.length === 0,
      problems.length ? problems.join('; ') : `${unitTests} tests, generated block current`,
    );
  }
}

/* ----------------------------------------------------------- 16. e2e (opt) -- */

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
