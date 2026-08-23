import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MARKERS, renderBlock, replaceBlock, computeCounts } from './counts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const data = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(root, 'src/data', name), 'utf8')) as unknown[];

const sample = {
  products: 72,
  categories: 15,
  divisions: 2,
  ssrRoutes: 4,
  builtPages: 97,
  cspHashes: 6,
  unitTests: 104,
};

describe('renderBlock', () => {
  it('is delimited by the markers', () => {
    const block = renderBlock(sample);
    expect(block.startsWith(MARKERS.start)).toBe(true);
    expect(block.endsWith(MARKERS.end)).toBe(true);
  });

  it('states every count', () => {
    const block = renderBlock(sample);
    for (const value of Object.values(sample)) {
      expect(block).toContain(String(value));
    }
  });

  it('is stable across calls, so a diff means a real change', () => {
    expect(renderBlock(sample)).toBe(renderBlock({ ...sample }));
  });
});

describe('replaceBlock', () => {
  it('swaps an existing block and leaves the rest alone', () => {
    const before = `# Title\n\n${renderBlock({ ...sample, unitTests: 63 })}\n\ntail text\n`;
    const after = replaceBlock(before, renderBlock(sample));
    expect(after).toContain('# Title');
    expect(after).toContain('tail text');
    expect(after).toContain('104');
    expect(after).not.toContain('63');
  });

  it('returns null when there are no markers, rather than appending', () => {
    // Appending would silently produce a second block, and the gate would then
    // compare against whichever one the regex found first.
    expect(replaceBlock('# Title\n\nno markers here\n', renderBlock(sample))).toBeNull();
  });

  it('is idempotent', () => {
    const block = renderBlock(sample);
    const once = replaceBlock(`# T\n\n${block}\n`, block);
    expect(replaceBlock(once!, block)).toBe(once);
  });
});

describe('computeCounts', () => {
  /*
   * Compared against the data files rather than against literals. This test
   * previously asserted `products` was 72, which made it a second copy of the
   * very number this tool exists to stop duplicating — and it duly failed the
   * moment the datasheet products landed, having caught nothing except itself.
   *
   * Reading the files keeps the teeth that matter: computeCounts drifting from
   * the catalogue still fails here. What it no longer does is fail when the
   * catalogue legitimately grows.
   */
  /*
   * RENAMED 2026-08-19. `computeCounts` now reads the snapshot rather than
   * src/data directly, so the old name ("reads the catalogue from src/data")
   * describes something it no longer does. The assertions are kept exactly as
   * they were, and they are worth MORE than before: they now also prove the
   * snapshot agrees with the committed data files, which is the thing that
   * would silently drift once the two can be edited independently.
   */
  it('agrees with the committed data files, not with a constant', () => {
    const counts = computeCounts({ unitTests: 0 });
    expect(counts.products).toBe(data('products.json').length);
    expect(counts.categories).toBe(data('categories.json').length);
    expect(counts.divisions).toBe(data('divisions.json').length);
    // A tool returning zeroes would satisfy the three above only if the data
    // files were empty too, which they are not.
    expect(counts.products).toBeGreaterThan(0);
  });

  it('counts every server-rendered route', () => {
    // /api/enquiry, /api/admin/login, /api/admin/logout, /admin/login, the
    // five the enquiry inbox added (/admin, /admin/demand,
    // /admin/enquiries/[id], /api/admin/enquiries/[id], /api/admin/export.csv)
    // the four the password reset added: /admin/forgot, /admin/reset,
    // /api/admin/forgot, /api/admin/reset, the four hero banner routes added
    // 2026-08-23 (/admin/banners plus upload, [id] and [id]/thumb under
    // /api/admin/banners), and the six catalogue editing
    // added: /admin/catalogue, /admin/catalogue/products/[slug],
    // /admin/catalogue/categories/[id] and their three POST endpoints under
    // /api/admin/catalogue, publish.ts included.
    // handoff.md still called this "the one SSR route" after the admin landed.
    //
    // Pinned rather than derived on purpose. Every route here opts out of
    // prerendering, and an admin page that LOSES that line becomes a public
    // static file with build-time data baked into it — so this number moving
    // downwards is exactly the failure `npm run verify`'s "admin area stays
    // private" gate exists for, and two independent alarms are worth it.
    expect(computeCounts({ unitTests: 0 }).ssrRoutes).toBe(23);
  });

  it('takes the unit-test count from the caller', () => {
    // verify.mjs already ran vitest and parsed the number. Running it a second
    // time here would double the slowest gate in the suite.
    expect(computeCounts({ unitTests: 999 }).unitTests).toBe(999);
  });
});

/*
 * ADDED 2026-08-19, ahead of the catalogue becoming editable.
 *
 * `computeCounts` reads src/data/*.json directly. That is correct while the
 * committed files are what the site is built from, and wrong the moment
 * CATALOGUE_SOURCE=postgres — the counts block would then describe a file the
 * build ignores, which is the stale-number problem this whole tool exists to
 * prevent, reintroduced one layer down.
 *
 * The snapshot is already the agreed single statement of the catalogue's
 * totals, regenerated deliberately and gated by verify. Reading it here means
 * one number, in one place, whichever source the build uses.
 */
describe('catalogueTotals', () => {
  it('reads the snapshot rather than the JSON files', async () => {
    const fs = await import('node:fs');
    const { catalogueTotals } = await import('./counts.mjs');
    const snapshot = JSON.parse(fs.readFileSync('tools/catalogue-snapshot.json', 'utf8'));

    expect(catalogueTotals()).toEqual({
      products: snapshot.products,
      categories: snapshot.categories,
      divisions: snapshot.divisions,
    });
  });

  it('is what computeCounts uses, so the block and the gate cannot disagree', async () => {
    const { computeCounts, catalogueTotals } = await import('./counts.mjs');
    const counts = computeCounts({ unitTests: 0 });
    const totals = catalogueTotals();

    expect(counts.products).toBe(totals.products);
    expect(counts.categories).toBe(totals.categories);
    expect(counts.divisions).toBe(totals.divisions);
  });
});
