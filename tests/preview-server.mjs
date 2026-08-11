/**
 * A preview server for the built output.
 *
 * `astro preview` does not work in this repo: `@astrojs/vercel` ships no preview
 * entrypoint, so the command exits with "The @astrojs/vercel adapter does not
 * support the preview command." Adding the first server-rendered route also
 * split the build in two — static pages land in `dist/client/`, and the SSR
 * bundle is moved out to `.vercel/output/functions/_render.func` (handoff.md
 * §7). A plain static file server would therefore serve 96 of the 97 routes and
 * 404 the one that matters: `/api/enquiry`, the end of the only conversion path.
 *
 * So this serves both halves the way Vercel does:
 *
 *   1. filesystem first, out of `dist/client/`;
 *   2. anything matching a `dest: "_render"` route in `.vercel/output/config.json`
 *      goes to the built SSR handler;
 *   3. everything else is `404.html` with a 404 status.
 *
 * The route table is read from the emitted config rather than hard-coded, so
 * this cannot drift from what the adapter actually deploys. Nothing here is a
 * stub or a mock — the handler imported below is the same `entry.mjs` Vercel
 * runs, and with no `RESEND_API_KEY` set it takes the same
 * `200 { ok: true, delivered: false }` path it takes on a real deployment
 * without credentials.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const CLIENT = join(ROOT, 'dist', 'client');
const VERCEL_CONFIG = join(ROOT, '.vercel', 'output', 'config.json');
const VERCEL_JSON = join(ROOT, 'vercel.json');
const SSR_ENTRY = join(ROOT, '.vercel', 'output', 'functions', '_render.func', 'dist', 'server', 'entry.mjs');

const PORT = Number(process.env.PORT ?? 4321);
const HOST = process.env.HOST ?? '127.0.0.1';

if (!existsSync(CLIENT)) {
  console.error(`[preview] ${CLIENT} does not exist. Run \`npm run build\` first.`);
  process.exit(1);
}

/** Only the types this build actually emits. */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * The `headers` rules from vercel.json, as regexes.
 *
 * Applied here for one reason: without them nothing can test the CSP. A policy
 * that blocks Astro's island bootstraps produces a site that renders and never
 * hydrates — every enquiry button stuck in its pending state — and that failure
 * appears only in production, because the preview served no policy at all.
 *
 * Vercel's `source` is a path pattern, not a regex, but this project's are all
 * either `/(.*)` or a literal prefix with one `(.*)`, so anchoring and escaping
 * everything except that group is a faithful reading of the ones actually used.
 * `tests/e2e/csp.spec.ts` asserts the policy arrives; if a future rule needs
 * something richer than this, that test is what notices.
 */

/**
 * `/fonts/(.*)` -> /^\/fonts\/(.*)$/ — literal text escaped, parenthesised
 * groups kept as regex with their own contents escaped apart from `.*` and `|`.
 */
function sourceToRegExp(source) {
  const escape = (s) => s.replace(/[.+?^${}[\]\\]/g, '\\$&');
  const body = source.replace(/\(([^)]*)\)|([^(]+)/g, (_, group, literal) =>
    group === undefined
      ? escape(literal)
      : `(${group.split('|').map((part) => (part === '.*' ? '.*' : escape(part))).join('|')})`,
  );
  return new RegExp(`^${body}$`);
}

const headerRules = existsSync(VERCEL_JSON)
  ? (JSON.parse(readFileSync(VERCEL_JSON, 'utf8')).headers ?? []).map((rule) => ({
      pattern: sourceToRegExp(rule.source),
      headers: rule.headers ?? [],
    }))
  : [];

function headersFor(pathname) {
  const out = {};
  for (const rule of headerRules) {
    if (rule.pattern.test(pathname)) for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

/** The `dest: "_render"` entries from the emitted Vercel config, as regexes. */
const ssrRoutes = existsSync(VERCEL_CONFIG)
  ? (JSON.parse(readFileSync(VERCEL_CONFIG, 'utf8')).routes ?? [])
      .filter((route) => route.dest === '_render' && typeof route.src === 'string')
      .map((route) => new RegExp(route.src))
  : [];

/** Imported once, lazily: a run that never posts an enquiry never boots the SSR bundle. */
let ssrHandler;
async function getSsrHandler() {
  if (!ssrHandler) {
    if (!existsSync(SSR_ENTRY)) {
      throw new Error(`[preview] SSR bundle missing at ${SSR_ENTRY}. Run \`npm run build\` first.`);
    }
    ssrHandler = (await import(pathToFileURL(SSR_ENTRY).href)).default;
  }
  return ssrHandler;
}

/** `dist/client/catalogue/lighting/index.html` for `/catalogue/lighting`. */
function resolveStatic(pathname) {
  const decoded = decodeURIComponent(pathname);
  // Reject anything that escapes the client directory before touching the disk.
  const target = resolve(CLIENT, `.${decoded}`);
  if (target !== CLIENT && !target.startsWith(CLIENT + '\\') && !target.startsWith(CLIENT + '/')) {
    return null;
  }
  const candidates = extname(target) ? [target] : [join(target, 'index.html'), `${target}.html`];
  return candidates.find((file) => existsSync(file) && statSync(file).isFile()) ?? null;
}

function sendFile(res, file, pathname, status = 200) {
  res.writeHead(status, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': statSync(file).size,
    ...headersFor(pathname),
  });
  createReadStream(file).pipe(res);
}

/** node:http request -> WHATWG Request, which is what the built handler takes. */
async function toWebRequest(req) {
  const url = new URL(req.url, `http://${req.headers.host ?? `${HOST}:${PORT}`}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value !== undefined) headers.set(key, value);
  }

  let body;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  return new Request(url, { method: req.method, headers, body });
}

const server = createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`).pathname;

    // 1. filesystem
    const file = resolveStatic(pathname);
    if (file) {
      sendFile(res, file, pathname);
      return;
    }

    // 2. server-rendered routes
    if (ssrRoutes.some((pattern) => pattern.test(pathname))) {
      const handler = await getSsrHandler();
      const response = await handler.fetch(await toWebRequest(req));
      // Platform headers first, then the handler's own — the endpoint's
      // content-type must win over anything a broad rule sets.
      const headers = headersFor(pathname);
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      res.writeHead(response.status, headers);
      res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
      return;
    }

    // 3. not found
    const notFound = join(CLIENT, '404.html');
    if (existsSync(notFound)) {
      sendFile(res, notFound, pathname, 404);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  } catch (cause) {
    console.error('[preview] request failed', cause);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Internal server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[preview] serving dist/client on http://${HOST}:${PORT}`);
});
