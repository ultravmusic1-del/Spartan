/**
 * Generate the Content-Security-Policy script hashes from the built output.
 *
 *   node tools/csp.mjs           print what the policy should be
 *   node tools/csp.mjs --write   write it into vercel.json
 *
 * WHY HASHES AND NOT `'unsafe-inline'`
 *
 * The site loads no third-party script of any kind, so `script-src 'self'` is
 * achievable — and `'unsafe-inline'` would give away most of what a CSP is for,
 * since it permits exactly the injected inline script an attacker wants.
 *
 * WHY THIS IS GENERATED AND NOT HAND-WRITTEN
 *
 * Astro emits the inline bootstraps itself: the island custom element, one
 * short shim per client directive in use, plus this repo's own (the `data-js`
 * flag in BaseLayout — the hero's scroll scrubber was a second one until the
 * film was replaced with a static still and its script deleted). An Astro
 * upgrade can change any of them by a byte, and a stale hash does not fail the
 * build — it fails in production, as a page whose islands never hydrate. So the
 * hashes are derived from the actual output and `npm run verify` re-derives
 * them and fails if vercel.json has drifted.
 *
 * WHAT IS DELIBERATELY NOT HASHED
 *
 * JSON-LD blocks. There are ~165 of them, one or two per page, and their
 * contents change whenever catalogue data does — hashing them would mean a
 * policy that churns on every content edit. They are `type="application/ld+json"`
 * data blocks, which browsers do not execute, so `script-src` does not apply to
 * them. That claim is not taken on trust: tests/e2e/csp.spec.ts loads pages
 * with the real policy applied and asserts zero CSP violations, and it would
 * fail if any browser under test disagreed.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = path.join(root, 'dist/client');
const VERCEL = path.join(root, 'vercel.json');

/** Every built HTML page. */
function pages(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...pages(full));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

/**
 * Executable inline scripts only.
 *
 * A `<script>` with a `src` is covered by `'self'`. A `<script type>` that is
 * not a JavaScript MIME type is a data block and is never executed — that is
 * what excludes the JSON-LD. Anything else runs and needs a hash.
 */
const JS_TYPES = new Set(['', 'text/javascript', 'application/javascript', 'module']);

export function inlineScriptHashes(dir = CLIENT) {
  const hashes = new Set();

  for (const file of pages(dir)) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
      const [, attrs, body] = match;
      if (/\ssrc=/.test(attrs)) continue;
      const type = (attrs.match(/\stype=["']([^"']*)["']/)?.[1] ?? '').toLowerCase().trim();
      if (!JS_TYPES.has(type)) continue;
      // The hash covers the element's exact text content, byte for byte.
      hashes.add(`'sha256-${crypto.createHash('sha256').update(body, 'utf8').digest('base64')}'`);
    }
  }

  // Sorted so the generated policy is stable across runs and a diff shows a
  // real change rather than a reordering.
  return [...hashes].sort();
}

export function buildCsp(hashes) {
  return [
    // Nothing loads from anywhere but this origin unless named below.
    "default-src 'self'",
    // Islands and the two first-party bootstraps, by hash. No 'unsafe-inline'.
    `script-src 'self' ${hashes.join(' ')}`,
    /*
     * Styles keep 'unsafe-inline'. Astro inlines a component's scoped CSS into
     * the pages that use it, so the set of style blocks changes with any style
     * edit anywhere — hashing them would mean regenerating this policy on every
     * visual change, and a stale style hash is an unstyled page. The exposure
     * is much smaller than for script: CSS injection needs an existing HTML
     * injection to matter, and `default-src 'self'` already blocks remote
     * stylesheets.
     */
    "style-src 'self' 'unsafe-inline'",
    // data: covers the inlined SVG favicon and any small inlined asset.
    "img-src 'self' data:",
    "font-src 'self'",
    "media-src 'self'",
    // The enquiry endpoint is same-origin; nothing else is called.
    "connect-src 'self'",
    // No plugins, no embedded documents, and the site is never framed. The
    // last of these is what X-Frame-Options says, in the form that supersedes it.
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    // A <base> tag injection would silently re-point every relative URL.
    "base-uri 'self'",
    // Forms post to /api/enquiry and nowhere else. This is what stops an
    // injected form exfiltrating a filled-in enquiry to another host.
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/* ------------------------------------------------------------------ main -- */

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('csp.mjs')) {
  if (!fs.existsSync(CLIENT)) {
    console.error('dist/client does not exist. Run `npm run build` first.');
    process.exit(1);
  }

  const hashes = inlineScriptHashes();
  const csp = buildCsp(hashes);

  if (!process.argv.includes('--write')) {
    console.log(`${hashes.length} executable inline scripts\n`);
    for (const h of hashes) console.log(`  ${h}`);
    console.log(`\n${csp}`);
    process.exit(0);
  }

  const config = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
  const rule = config.headers?.find((h) => h.source === '/(.*)');
  if (!rule) {
    console.error('vercel.json has no `/(.*)` headers rule to write the policy into.');
    process.exit(1);
  }

  const header = rule.headers.find((h) => h.key === 'Content-Security-Policy');
  if (!header) {
    console.error('vercel.json has no Content-Security-Policy header to update.');
    process.exit(1);
  }

  header.value = csp;
  fs.writeFileSync(VERCEL, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`vercel.json updated — ${hashes.length} script hashes.`);
}
