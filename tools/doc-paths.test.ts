import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPaths, resolves } from './doc-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
