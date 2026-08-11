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
  it('reads the catalogue from src/data, not from a constant', () => {
    const counts = computeCounts({ unitTests: 0 });
    expect(counts.products).toBe(data('products.json').length);
    expect(counts.categories).toBe(data('categories.json').length);
    expect(counts.divisions).toBe(data('divisions.json').length);
    // A tool returning zeroes would satisfy the three above only if the data
    // files were empty too, which they are not.
    expect(counts.products).toBeGreaterThan(0);
  });

  it('counts every server-rendered route', () => {
    // /api/enquiry, /api/admin/login, /api/admin/logout, /admin/login.
    // handoff.md still called this "the one SSR route" after the admin landed.
    expect(computeCounts({ unitTests: 0 }).ssrRoutes).toBe(4);
  });

  it('takes the unit-test count from the caller', () => {
    // verify.mjs already ran vitest and parsed the number. Running it a second
    // time here would double the slowest gate in the suite.
    expect(computeCounts({ unitTests: 999 }).unitTests).toBe(999);
  });
});
