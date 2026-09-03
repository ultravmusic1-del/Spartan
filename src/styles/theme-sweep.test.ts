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

/**
 * CSS/JS block comments, HTML comments, and whole-line `//` comments. Leaves
 * `https://` alone.
 *
 * HTML comments are not optional here: Astro templates use `<!-- -->` for
 * anything outside the frontmatter, and `enquiry.astro` documents its whole
 * colour scheme in one. The first cut of this stripper handled only `/* * /`
 * and reported that file as an offender for explaining itself.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
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
      !f.toLowerCase().includes('admin') &&
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

  /**
   * Files where `color: #fff` is correct because the surface behind it is a red
   * fill or the dark footer, neither of which the semantic layer covers: white
   * on --accent-fill is 4.91:1 and is the intended pairing.
   *
   * ADDED AFTER THIS GATE MISSED ONE. The token bans below were all green while
   * ProductCard.astro rendered `.card__name` as white on a white card — 1.00:1,
   * every product name on every category page invisible. No banned token was
   * involved, because the offending colour was never a token. It took
   * tests/e2e/contrast.spec.ts, which needs a browser and a build, to find a
   * defect a substring search could have caught in milliseconds.
   */
  const WHITE_TEXT_IS_CORRECT = [
    'src/components/layout/Footer.astro', // inside .on-dark
    'src/components/primitives/SolidButton.astro', // on --accent-fill
    'src/layouts/BaseLayout.astro', // skip link, on --accent-fill
    // Red-filled controls: the enquiry submit and add buttons, the drawer's
    // review button, the catalogue's selected filter chip and division tabs.
    // axe caught all five at 3.92:1 after a blanket substitution turned their
    // white labels into --text — ink on brand red, which is the mirror image of
    // the white-on-white defect this list was created for. Both directions are
    // the same mistake: deciding a colour without knowing its surface.
    'src/styles/enquiry.css',
    'src/pages/catalogue/index.astro',
    'src/pages/enquiry.astro',
    /*
     * THE FIRST ENTRY HERE THAT IS NOT A RED FILL, so the rule this list
     * encodes is worth restating: the surface has to be a known, dark-enough
     * fill this file's tokens do not describe — not merely "not white".
     *
     * The floating WhatsApp button is a #128C7E circle, and white on it is
     * 4.14:1. It earns its place the same way SolidButton does, by measurement
     * rather than by category. It is also the only fixed element on the site,
     * so it is the one case where the surface behind the ELEMENT is a colour
     * this component owns entirely — which is exactly why a hardcoded pair is
     * correct here and would not be inside a section.
     */
    'src/components/layout/WhatsAppFloat.astro', // white glyph on #128C7E, 4.14:1
  ];

  it('no public file hardcodes white text except on a red fill or the dark footer', () => {
    const offenders = PUBLIC_FILES.filter(
      (f) => !WHITE_TEXT_IS_CORRECT.includes(f) && /color:\s*#(fff|ffffff)\b/i.test(code(f)),
    );
    expect(
      offenders,
      'White text on the light site is invisible. Use --text, or add the file to ' +
        'WHITE_TEXT_IS_CORRECT only if its surface really is a red fill or the dark footer.',
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
