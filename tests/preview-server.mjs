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

function sendFile(res, file, status = 200) {
  res.writeHead(status, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': statSync(file).size,
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
      sendFile(res, file);
      return;
    }

    // 2. server-rendered routes
    if (ssrRoutes.some((pattern) => pattern.test(pathname))) {
      const handler = await getSsrHandler();
      const response = await handler.fetch(await toWebRequest(req));
      const headers = {};
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
      sendFile(res, notFound, 404);
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
