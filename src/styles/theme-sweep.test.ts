import { globSync, readFileSync } from 'node:fs';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

/**
 * The white theme's silent-failure gate. Added 2026-08-20 with
 * `docs/superpowers/specs/2026-08-20-white-theme-design.md`.
 *
 * `--color-grey` and `--color-grey-lt` were tuned for dark surfaces. On the
 * light site they measure 3.43:1 and 2.06:1, and almost every one of their 80
 * public-site usages was normal-size text needing 4.5:1. Carried across
 * unchanged they render grey-on-white that looks approximately fine to anyone
 * not measuring — and `astro check`, the build and `npm run verify` all pass.
 * That is the entire reason this file exists: nothing else in the repository
 * would have said a word.
 *
 * SCOPE — public site only. `src/styles/admin.css`, `src/pages/admin/**` and
 * `src/components/admin/**` are still dark by design and still name palette
 * colours directly. That is rule 3's seam holding, not a leak, and sweeping
 * them would produce 35 false failures.
 *
 * COMMENTS ARE STRIPPED BEFORE SCANNING, and that is deliberate rather than
 * lax. The comments that explain *why* a token was banned have to be able to
 * name it — `SectionHeading.astro` records that --color-grey-lt is 1.91:1 on
 * --surface-alt, which is the most useful sentence in the file and would fail
 * a naive substring ban. A gate that forbids documenting itself gets deleted
 * by the next person; this one only reads code.
 */
const ROOT = new URL('../../', import.meta.url);

const read = (f: string) => readFileSync(new URL(f, ROOT), 'utf8');

/** Block comments and whole-line `//` comments. Leaves `https://` alone. */
function stripComments(source: string): string {
  const withoutBlocks = source.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlocks
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const PUBLIC_FILES = globSync('src/**/*.{astro,tsx,css}', {
  cwd: fileURLToPath(ROOT),
})
  .map((f) => f.split(sep).join('/'))
  .filter(
    (f) =>
      !f.includes('admin') &&
      // The palette is where these are legitimately declared, and `.on-dark`
      // in global.css is where they are legitimately re-pointed.
      f !== 'src/styles/tokens.css' &&
      f !== 'src/styles/global.css',
  );

/**
 * Files whose surface is dark, where the palette greys are legal again.
 * Adding to this list is a claim that the file renders on a dark background.
 * It is not a way to make a failure go away.
 */
const DARK_SURFACE_FILES = ['src/components/layout/Footer.astro'];

const code = (f: string) => stripComments(read(f));

describe('white theme sweep', () => {
  it('finds public source files to sweep', () => {
    // A glob that silently matched nothing would make every test below pass,
    // which is the failure mode this whole file exists to prevent.
    expect(PUBLIC_FILES.length).toBeGreaterThan(25);
  });

  it('no public file outside the dark footer uses --color-grey-lt', () => {
    const offenders = PUBLIC_FILES.filter(
      (f) => !DARK_SURFACE_FILES.includes(f) && code(f).includes('--color-grey-lt'),
    );
    expect(
      offenders,
      '--color-grey-lt is 2.06:1 on white and fails at every size. Use --text-muted.',
    ).toEqual([]);
  });

  it('no public file outside the dark footer uses --color-grey', () => {
    const offenders = PUBLIC_FILES.filter(
      (f) => !DARK_SURFACE_FILES.includes(f) && /var\(--color-grey\)/.test(code(f)),
    );
    expect(
      offenders,
      '--color-grey is 3.43:1 on white — large text only. Use --text-muted for ' +
        'text, or --line-control for a boundary that carries meaning.',
    ).toEqual([]);
  });

  it('no code still references the renamed .on-light helper', () => {
    const offenders = PUBLIC_FILES.filter((f) => /on-light|onLight/.test(code(f)));
    expect(
      offenders,
      '.on-light inverted meaning on 2026-08-20 and is now .on-dark. A leftover ' +
        'applies light-surface rules inside the dark footer, silently.',
    ).toEqual([]);
  });
});
