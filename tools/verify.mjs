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
import { spawnSync } from 'node:child_process';
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

/**
 * Run a command, capturing output. Never throws — the caller decides.
 *
 * BOTH STREAMS, ON SUCCESS AS WELL AS ON FAILURE. It used to return only
 * stdout when the command succeeded, and concatenate stdout and stderr when it
 * failed — so which stream a tool chose changed what the callers could see, but
 * only on the happy path. That cost a real gate: the counts check parses
 * vitest's total out of this string, found nothing on CI where vitest's summary
 * did not land on stdout, and **skipped silently on every CI run** while
 * passing on every developer's machine. A gate whose result depends on the
 * platform is not a gate. `spawnSync` rather than `execFileSync` because only
 * it hands back both streams.
 */
function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
    maxBuffer: 64 * 1024 * 1024,
  });

  return {
    ok: result.status === 0,
    out: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
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
/** Whether the suite itself passed, which is a different question from whether its total could be read. */
let unitSuitePassed = false;

{
  const r = run('npx', ['vitest', 'run']);
  const m = r.out.match(/Tests\s+(\d+) passed/);
  if (m) unitTests = Number(m[1]);
  unitSuitePassed = r.ok;
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
 * SITE.JSON IS NO LONGER EXEMPT, as of 2026-08-19. It was, on the reasoning
 * that it is site chrome rather than catalogue content — which was true, and
 * beside the point: the exemption existed because there was nowhere else for a
 * page to get a phone number. `src/lib/site-content.ts` is that somewhere now,
 * so a direct import is the same defect as importing products.json, and for
 * the same reason: Stage 2 of the admin plan moves this data into Postgres,
 * and that has to stay a one-module change.
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
    if (/from\s+['"][^'"]*data\/[^'"]*\.json['"]/.test(code))
      offenders.push(`${rel} imports data JSON directly — go through src/lib/`);
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
  const { checkInvariants, totals, readCatalogue } = await import('./catalogue-snapshot.mjs');

  /*
   * REWRITTEN 2026-08-19, ahead of the catalogue becoming editable from /admin.
   *
   * This block used to hard-code 94 products, 15 categories and 6 EN 388
   * ratings, read out of src/data/products.json. Both halves of that stop being
   * true once the admin can edit the catalogue: the totals move for good
   * reasons, and products.json is no longer what the site is built from.
   *
   * Deleting the gate was the wrong answer — it is one of the few mechanical
   * defences rule 1 has, on a catalogue of safety equipment. It splits instead:
   * invariants that can never legitimately break are checked outright, and the
   * totals are held against a committed snapshot a person regenerates on
   * purpose. See tools/catalogue-snapshot.mjs.
   *
   * It follows CATALOGUE_SOURCE, so once the deployment renders from Postgres
   * this checks the database rather than a file the build ignores.
   */
  const catalogue = await readCatalogue();
  const problems = checkInvariants(catalogue);

  const snapshot = JSON.parse(
    fs.readFileSync(path.join(root, 'tools/catalogue-snapshot.json'), 'utf8'),
  );
  const now = totals(catalogue);
  for (const key of Object.keys(snapshot)) {
    if (now[key] !== snapshot[key])
      problems.push(
        `${key}: ${now[key]}, snapshot says ${snapshot[key]} — ` +
          'run `node tools/catalogue-snapshot.mjs --write` if this is intended',
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

/* ------------------------------------- 6b. no remote image URL in the output -- */

/*
 * NOTHING BUILT MAY POINT AT SUPABASE STORAGE, AND THIS IS NOT A STYLE RULE.
 *
 * Hero banners live in a private bucket and `src/lib/site-content.ts` signs a
 * one-hour URL per enabled banner so the BUILD can fetch it. Astro is supposed
 * to download each one, re-encode it and emit a local asset — after which the
 * signed URL has served its purpose and must not appear anywhere in dist.
 *
 * When it does appear, the page is broken in two ways at once and looks fine in
 * every other check: the URL expires an hour after the build, and `img-src
 * 'self'` blocks it before that. It happened on 2026-08-23. `astro.config.mjs`
 * read SUPABASE_URL from `process.env` only, which Vercel populates and a local
 * `.env` does not, so `image.domains` came back empty on a developer machine —
 * and Astro's response to a remote image it is not allowed to optimise is to
 * pass the URL straight through rather than to fail.
 *
 * The build succeeded. `astro check` was clean. The screenshot showed a broken
 * image icon and nothing said why. This gate is what says why.
 */
{
  const pages = htmlFiles(path.join(root, 'dist/client'));
  const banned = ['supabase.co/storage', '/storage/v1/object/sign', '?token=eyJ'];
  const hits = [];
  for (const file of pages) {
    const text = fs.readFileSync(file, 'utf8');
    for (const token of banned) {
      if (text.includes(token))
        hits.push(
          `${path.relative(root, file)} contains ${token} — a signed storage URL reached the ` +
            'output, so Astro did not optimise that image. Check image.domains in astro.config.mjs.',
        );
    }
  }
  record(
    'no signed storage URL in the built output',
    hits.length === 0,
    hits.length ? hits.slice(0, 3).join('; ') : `${pages.length} pages swept, 0 hits`,
  );
}

/* -------------------------------- 6c. no runtime image optimisation needed -- */

/*
 * NO SERVER-RENDERED PAGE MAY USE `astro:assets`, AND THIS GATE IS THE OTHER
 * HALF OF A PERFORMANCE DECISION.
 *
 * `astro.config.mjs` points `image.endpoint` at an inert 404 so that sharp —
 * 19.1 MB of a 25.6 MB serverless function, measured 2026-08-23 — stays out of
 * the cold-start path of `/api/enquiry` and every admin route. That is safe
 * only while nothing needs image optimisation AT REQUEST TIME.
 *
 * A prerendered page using <Image> is fine: it is optimised during the build
 * and emitted under /_astro/. A page with `prerender = false` using <Image>
 * would call /_image at runtime and get the 404 — a broken image on a live
 * page, with the build, `astro check` and every unit test still green.
 *
 * So the rule is checked where it can be decided: any file under src/pages
 * that opts out of prerendering must not import `astro:assets`, and neither
 * may anything it could plausibly render. Components are swept too, because a
 * shared component using <Image> is one import away from an admin page.
 */
{
  const offenders = [];

  const ssrPages = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(astro|ts)$/.test(entry.name) && !entry.name.includes('.test.')) {
        const text = fs.readFileSync(full, 'utf8');
        if (/export\s+const\s+prerender\s*=\s*false/.test(text)) ssrPages.push([full, text]);
      }
    }
  };
  walk(path.join(root, 'src/pages'));

  for (const [file, text] of ssrPages) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (/from\s+['"]astro:assets['"]/.test(text)) {
      offenders.push(
        `${rel} is server-rendered and imports astro:assets — /_image is disabled, so that ` +
          'image would 404 at runtime. See astro.config.mjs image.endpoint.',
      );
    }
  }

  /*
   * The inert endpoint itself must stay wired up. Losing the config line would
   * put sharp back in the function silently: nothing renders differently, the
   * function just grows by 19 MB and every cold start pays for it.
   */
  const config = fs.readFileSync(path.join(root, 'astro.config.mjs'), 'utf8');
  if (!config.includes('image-endpoint-disabled')) {
    offenders.push(
      'astro.config.mjs no longer points image.endpoint at src/lib/image-endpoint-disabled.ts — ' +
        'sharp is back in the serverless function.',
    );
  }

  record(
    'runtime image optimisation stays out of the function',
    offenders.length === 0,
    offenders.length
      ? offenders.slice(0, 3).join('; ')
      : `${ssrPages.length} server-rendered files clean, endpoint still inert`,
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

/* ------------------------------------------- 7b. meta descriptions in budget -- */

/*
 * 160 characters is this codebase's one meta-description budget: search engines
 * cut a description around 155-160, and `productDescription` takes the number as
 * an argument precisely so the same text can be cut to it.
 *
 * Nothing enforced it outside that one builder, and on 2026-08-17 a page had
 * drifted past it — `/catalogue/fans-ventilation/` at 176 characters, because
 * the category page appends a product count to a description that was already
 * 138 long, so the appended half was the part getting cut off. One page in 119,
 * invisible in every other gate, and it would have been the second one the next
 * time a category description grew.
 *
 * NOTE THE ENTITY DECODE, WHICH IS NOT OPTIONAL. Descriptions reach the built
 * HTML with `&` as `&#38;` and inch marks as `&quot;`, so measuring the raw
 * attribute counts five characters where the searcher sees one. Measured raw,
 * this gate reports three failures that are not real — which is exactly the
 * false alarm that gets a gate deleted.
 *
 * There is deliberately NO lower bound. Six product descriptions are under 70
 * characters because their brochure entries say very little, and padding one to
 * hit a number would mean writing product copy.
 */
{
  const pages = htmlFiles(path.join(root, 'dist/client'));
  const MAX = 160;
  const decode = (s) =>
    s
      .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      // Ampersand last: decoding it first would let "&amp;lt;" become "<".
      .replace(/&amp;/g, '&');

  const over = [];
  let missing = 0;
  for (const file of pages) {
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/<meta name="description" content="([^"]*)"/);
    if (!match) {
      missing += 1;
      continue;
    }
    const length = decode(match[1]).trim().length;
    if (length > MAX) over.push(`${path.relative(root, file)}: ${length} chars`);
  }

  record(
    `meta descriptions within ${MAX} characters`,
    over.length === 0 && missing === 0,
    over.length || missing
      ? [...over.slice(0, 5), missing ? `${missing} pages have none` : ''].filter(Boolean).join('; ')
      : `${pages.length} pages, longest within budget`,
  );
}

/* ----------------------------------------------- 8. placeholder domain gate -- */

/*
 * Advisory, not a failure. The domain drives every canonical, Open Graph URL
 * and sitemap entry, so a wrong one is wrong everywhere at once. It must not
 * block development — no real domain has been bought — but it must never go
 * quiet either.
 *
 * READS THE VALUE, NOT THE FILE. This used to search the whole of
 * astro.config.mjs for `spartan.example`, which meant that explaining the
 * placeholder in a comment re-triggered the warning after the value had
 * actually been changed — the gate reported a launch blocker that no longer
 * existed. A gate that cries wolf gets ignored, which costs more than the one
 * it was watching for. Matching the parsed value is not a loosening: it is the
 * only thing that was ever meant to be tested.
 */
{
  const config = fs.readFileSync(path.join(root, 'astro.config.mjs'), 'utf8');
  const site = config.match(/^\s*site:\s*'([^']+)'/m)?.[1] ?? '';

  if (!site) {
    console.log('  note   could not read `site` from astro.config.mjs — check the domain by hand');
  } else if (site.includes('spartan.example')) {
    console.log(
      '  note   domain is still the spartan.example placeholder (launch blocker, not a regression)',
    );
  } else if (site.includes('.vercel.app')) {
    // Temporary hosts are the failure mode nobody notices: the site works, so
    // nothing complains, and the throwaway address quietly accrues canonicals
    // and index entries that the real domain then has to compete with.
    console.log(`  note   domain is the temporary Vercel host ${site}`);
    console.log('         (launch blocker: buy the real domain, then redirect this one)');
  }
}

/* --------------------------------------- 8b. placeholder contact details gate -- */

/*
 * Advisory for the same reason the domain gate above is: the real details have
 * not been supplied, so this cannot fail a build without failing every build.
 * But it must not go quiet either, and until now nothing said it at all.
 *
 * These are worse than the domain, page for page. `+971 00 000 0000` renders as
 * a live `tel:` link in the header of all 119 pages and `sales@spartan.example`
 * is a `mailto:` in every footer — so a buyer who tries either gets a dead
 * number or an undeliverable address, on a site whose entire purpose is getting
 * them to make contact. The domain being temporary costs search ranking; these
 * cost the lead itself.
 *
 * `whatsapp` is listed as missing rather than placeholder-valued: it is an empty
 * string in site.json, which renders nothing at all, which is the honest state
 * for a channel with no number. Adding a fake one to "look complete" is exactly
 * what this gate exists to catch.
 *
 * READS THE PARSED VALUES, not the file — same lesson as the domain gate, which
 * used to re-trigger on its own explanatory comment.
 */
{
  const site = JSON.parse(fs.readFileSync(path.join(root, 'src/data/site.json'), 'utf8'));

  // Each entry: the field, its placeholder shape, and what a visitor hits.
  const checks = [
    ['phone', (v) => !v || /0{3,}/.test(v), 'a dead tel: link in the header of every page'],
    ['email', (v) => !v || v.endsWith('.example'), 'an undeliverable mailto: in every footer'],
    ['address', (v) => !v || /^address line/i.test(v), 'a fabricated location'],
    ['whatsapp', (v) => !v, 'no WhatsApp affordance anywhere (renders nothing, which is honest)'],
  ];

  const outstanding = checks
    .filter(([field, isPlaceholder]) => isPlaceholder(site[field] ?? ''))
    .map(([field, , cost]) => `${field} — ${cost}`);

  if (outstanding.length) {
    console.log(
      `  note   ${outstanding.length} contact detail(s) still unset in src/data/site.json (launch blocker)`,
    );
    for (const line of outstanding) console.log(`         ${line}`);
  }
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
 * Skipped when the unit suite FAILED — that has already failed the run, and a
 * stale-counts error on top of it would point the next reader at the wrong
 * problem.
 *
 * NOT skipped when the suite passed and the total could not be read. That used
 * to be the same branch, and it hid this gate from CI completely: `run()`
 * dropped stderr on success, vitest's summary was not on stdout there, and the
 * check reported `skip` on every CI run for weeks while every local run said
 * `ok`. `run()` is fixed, and this is the alarm for the next time something
 * changes that output — a gate that cannot see its input has to say so, not
 * step aside quietly.
 */
{
  const { computeCounts, renderBlock, replaceBlock, TARGETS } = await import('./counts.mjs');

  if (unitTests === null && !unitSuitePassed) {
    console.log('  skip   counts (the unit suite failed — fix that first)');
  } else if (unitTests === null) {
    record(
      'counts match the repo',
      false,
      'the unit suite passed but its total could not be read from the output, so the counts block was not checked',
    );
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

/* ------------------------------------------- 16. the admin area stays private -- */

/*
 * The failure this catches is one missing line.
 *
 * An admin page without `export const prerender = false` is silently
 * PRERENDERED: Astro runs it at build time, with no request, no session and no
 * middleware guard, and writes the result into dist/client as a static file.
 * That file is then served to anyone who asks, with whatever enquiry data the
 * build-time query returned. The build succeeds. Every test that checks the
 * boundary at runtime still passes, because the runtime is no longer involved.
 *
 * Also asserts no admin URL reached the sitemap.
 */
{
  const problems = [];

  const leaked = htmlFiles(path.join(root, 'dist/client')).filter((f) =>
    path.relative(root, f).replace(/\\/g, '/').includes('/admin/'),
  );
  if (leaked.length)
    problems.push(`${leaked.length} admin page(s) were prerendered into dist/client`);

  for (const name of ['sitemap-0.xml', 'sitemap-index.xml']) {
    const file = path.join(root, 'dist/client', name);
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('/admin'))
      problems.push(`an admin URL reached ${name}`);
  }

  record(
    'admin area stays private',
    problems.length === 0,
    problems.length ? problems.join('; ') : 'nothing prerendered, nothing in the sitemap',
  );
}

/* ----------------------------------------------------------- 17. e2e (opt) -- */

if (full) {
  /*
   * THE THROWAWAY DATABASE IS A PRECONDITION, NOT AN OPTION.
   *
   * tests/e2e/admin-catalogue.spec.ts signs in and saves products. Without the
   * local stack it has nowhere safe to do that, and the only alternative to
   * stopping here is running it against whatever SUPABASE_URL happens to hold —
   * which, on the machine of anyone who can deploy this site, is the client's
   * live catalogue.
   *
   * It stops rather than skipping the spec. A suite that quietly dropped its
   * only authenticated tests and still printed green would be a worse outcome
   * than a red run with an instruction in it.
   */
  if (!fs.existsSync(path.join(root, '.test-db.json'))) {
    record(
      'playwright',
      false,
      'the authenticated admin tests need the local test database — run `npm run test:db:start` ' +
        'first. They must not run against the live project.',
    );
    console.log(
      `\n${'VERIFY FAILED'} — ${results.filter((r) => r.ok).length}/${results.length} gates\n`,
    );
    process.exit(1);
  }

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
