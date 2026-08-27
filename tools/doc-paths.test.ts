import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INSTRUCTIONAL, extractPaths, resolves } from './doc-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/*
 * The list itself was the defect once, so it is pinned.
 *
 * extractPaths and resolves were both correct and tested while README.md sat
 * outside INSTRUCTIONAL for the whole life of the gate — and README.md went on
 * describing a hero that had been replaced twice, which is the one thing this
 * gate exists to catch. A gate is only as good as what it is pointed at, and
 * nothing here was checking that.
 *
 * handoff.md's absence is asserted for the opposite reason: it is the record,
 * and it has to stay free to say a path is gone. See the comment on
 * INSTRUCTIONAL.
 */
describe('INSTRUCTIONAL', () => {
  it('covers every instructional document, including README.md', () => {
    expect(INSTRUCTIONAL).toEqual([
      'CLAUDE.md',
      'AGENTS.md',
      'README.md',
      'docs/TRAPS.md',
      '.claude/commands/improve.md',
    ]);
  });

  it('excludes handoff.md, which must stay free to name what is gone', () => {
    expect(INSTRUCTIONAL).not.toContain('handoff.md');
  });
});

describe('extractPaths', () => {
  it('takes backticked repo paths', () => {
    expect(extractPaths('see `src/lib/catalog.ts` and `tools/csp.mjs`')).toEqual([
      'src/lib/catalog.ts',
      'tools/csp.mjs',
    ]);
  });

  it('takes bare root files', () => {
    expect(extractPaths('read `handoff.md` first')).toEqual(['handoff.md']);
  });

  // Everything below is a token this repo's prose genuinely contains. Each one
  // would be a false failure if the filter were naive, and a false failure in a
  // gate is how a gate gets deleted.
  it('ignores commands, tokens, routes, packages and prose', () => {
    const prose = [
      '`npm run verify -- --full`', // has whitespace
      '`--color-red-light`', // a CSS custom property
      '`/api/enquiry`', // a URL route, not a file
      '`@astrojs/vercel`', // a package specifier
      '`zod/v4`', // a package subpath
      '`text/javascript`', // a MIME type
      '`onclick=`', // an attribute
      '`recorded || delivered`', // an expression
    ].join(' ');
    expect(extractPaths(prose)).toEqual([]);
  });

  it('ignores build output, which exists only after a build', () => {
    expect(extractPaths('emitted to `dist/client/` by `.vercel/output/`')).toEqual([]);
  });

  /**
   * The generated path that is not build output. `tools/fetch-banners.mjs`
   * writes `src/assets/banners/` before a build and it is gitignored, so it is
   * absent from a fresh clone and from any run without Supabase credentials.
   * Checking it made the gate pass for anyone who had built once and fail in
   * CI, which is the shape of green this repo treats as worse than red.
   */
  it('ignores the downloaded hero banners, which a fresh clone does not have', () => {
    expect(extractPaths('downloaded into `src/assets/banners/` before the build')).toEqual([]);
    expect(extractPaths('`src/assets/banners/hero.jpg` is generated')).toEqual([]);
  });

  /** The exemption is that one directory, not the assets tree around it. */
  it('still checks the rest of src/assets', () => {
    expect(extractPaths('committed under `src/assets/products/`')).toEqual([
      'src/assets/products/',
    ]);
  });

  it('deduplicates', () => {
    expect(extractPaths('`handoff.md` and again `handoff.md`')).toEqual(['handoff.md']);
  });

  it('strips trailing sentence punctuation', () => {
    expect(extractPaths('go to `src/lib/catalog.ts`.')).toEqual(['src/lib/catalog.ts']);
  });
});

describe('resolves', () => {
  it('is true for a file that exists', () => {
    expect(resolves(root, 'tools/csp.mjs')).toBe(true);
  });

  it('is false for a file that does not', () => {
    expect(resolves(root, 'tools/no-such-file.mjs')).toBe(false);
  });

  it('is true for a glob with at least one match', () => {
    expect(resolves(root, 'tools/*.mjs')).toBe(true);
    expect(resolves(root, 'src/data/*')).toBe(true);
  });

  it('is false for a glob that matches nothing', () => {
    expect(resolves(root, 'tools/*.rs')).toBe(false);
  });

  it('is false for a glob whose directory is gone', () => {
    // This is the case that matters: `public/video/*.mp4` was true until
    // d6808db deleted the directory with the hero film in it.
    expect(resolves(root, 'public/video/*.mp4')).toBe(false);
  });
});
