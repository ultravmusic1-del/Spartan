/// <reference types="vitest/config" />
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getViteConfig } from 'astro/config';
import { sync } from 'astro';

const root = new URL('./', import.meta.url);
const dotAstroDir = new URL('.astro/', root);
// `cacheDir` is left at its Astro default, which is `<root>/node_modules/.astro`.
const prodStore = new URL('node_modules/.astro/data-store.json', root);
const devStore = new URL('data-store.json', dotAstroDir);

// Astro 7 keeps the content-layer store in two places. `getDataStoreFile()`
// picks `cacheDir` when building and `.astro/` when serving, and `astro sync`
// runs as command "sync" — never "dev" — so the CLI only ever writes the
// production copy. Anything Vite *serves*, Vitest included, reads the `.astro/`
// copy, which in practice only `astro dev` writes. Without this mirror,
// `getCollection()` resolves but every collection comes back empty, so any test
// that reads through src/lib/catalog.ts fails on a clean checkout.
// Sync once, then copy the store across to the path the test run actually reads.
const nodeEnv = process.env.NODE_ENV;
await sync({ root: fileURLToPath(root), logLevel: 'error' });
process.env.NODE_ENV = nodeEnv; // `sync()` forces NODE_ENV=production; undo it.

if (existsSync(prodStore)) {
  mkdirSync(fileURLToPath(dotAstroDir), { recursive: true });
  copyFileSync(fileURLToPath(prodStore), fileURLToPath(devStore));
}

// `getViteConfig` boots the Astro integration pipeline so virtual modules such
// as `astro:content` resolve inside tests.
export default getViteConfig({
  test: {
    globals: true,
    environment: 'node',
    // Unit tests live beside the code they cover, always under `src/`. Pinning
    // the pattern keeps Vitest away from `tests/e2e/`, which is Playwright's:
    // those files call `test.describe`, which Vitest resolves to its own `test`
    // and then fails to collect. Vitest's default `include` swept them up as
    // soon as Task 16 added them.
    // `tools/` is added for the same reason it is safe: it holds build and
    // verification scripts and no Playwright specs, so widening to it cannot
    // resurrect the collection failure above.
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
  },
});
