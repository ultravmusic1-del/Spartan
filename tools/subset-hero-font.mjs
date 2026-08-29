/**
 * Subset Fira Sans Italic to the glyphs the home page's headline actually sets.
 *
 *   node tools/subset-hero-font.mjs <path-to-FiraSans-VariableItalic.woff2>
 *
 * WHY THIS EXISTS
 *
 * The client supplied Fira Sans on 2026-08-29 for the hero headline. The
 * complete family is 14 MB; its variable italic alone is 245 KB, against 34 KB
 * for Archivo — the face that serves every other heading on the site. Shipping
 * it whole to set one line of text on the ONE page with the least performance
 * headroom is exactly the trade handoff.md §12 warns about, where a 23 KB font
 * cost this page a Lighthouse point.
 *
 * Measured on 2026-08-29, full printable ASCII:
 *
 *   variable italic, whole axis      245.0 KB
 *   characters only                   21.6 KB   (-91%)
 *   characters + wght pinned to 800   13.7 KB   (-94%)
 *
 * THE ITALIC, NOT THE UPRIGHT, AND THAT IS THE POINT OF THE FILE.
 *
 * The upright subsets to 12.9 KB — 0.8 KB less — and would still need the
 * `skewX(-9deg)` the headline used to carry. A skew is a mechanical shear of
 * upright letterforms; a real italic is drawn. For 0.8 KB the headline gets
 * the drawn one and the transform goes away, along with the two traps it
 * created (see docs/TRAPS.md: a transform loses to any animation that also
 * sets transform, and `font-style: oblique` reports a slant Chrome declines to
 * synthesise).
 *
 * THE WEIGHT AXIS IS PINNED, NOT CLIPPED, and that is the single biggest
 * saving. `.hero__title` is set at exactly one weight, 800. A pinned axis is
 * silently clamped rather than refused, so changing that weight WITHOUT
 * re-running this script renders 800 and looks like a CSS specificity bug —
 * the same failure `tools/subset-mono.mjs` documents for its clipped range.
 * `src/styles/fonts.css` declares `font-weight: 800` alone for the same
 * reason: the declaration describes the FILE, not the family.
 *
 * THE RISK THIS CREATES, AND THE GATE THAT COVERS IT
 *
 * A subset font renders tofu for any character it lacks. COVERAGE below is the
 * source of truth, not the binary: `tools/subset-hero-font.test.ts` asserts the
 * headline never uses a character outside it and fails loudly with the
 * offending one. When it fails, add the character here and re-run — do not
 * widen the test.
 *
 * The emitted file is committed, exactly like the mono, so a normal build never
 * runs this. OFL-1.1: the licence ships beside it at
 * /fonts/fira-sans-LICENSE.txt because redistribution requires it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every character the hero font must carry.
 *
 * Printable ASCII in full, which is 20 KB before the axis pin and 13.7 KB
 * after — the same reasoning `subset-mono.mjs` gives: it is cheap and it covers
 * every plausible headline. Caps alone would be 6.5 KB, and the headline is
 * `text-transform: uppercase` today, so caps alone would work TODAY and produce
 * tofu the first time somebody removes that one declaration. 7 KB is a fair
 * price for not booby-trapping a stylesheet.
 *
 * Then the punctuation a marketing headline acquires: the smart apostrophe an
 * editor's keyboard produces, and the two dashes that are not a hyphen.
 */
export const COVERAGE = [
  // printable ASCII, U+0020 - U+007E
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)),
  // margin: what a headline tends to grow
  '’',
  '—',
  '–',
].join('');

/** The one weight `.hero__title` is set at. See the note above before moving it. */
export const PINNED_WEIGHT = 800;

if (process.argv[1] && process.argv[1].endsWith('subset-hero-font.mjs')) {
  const source = process.argv[2];
  if (!source) {
    console.error('usage: node tools/subset-hero-font.mjs <path-to-FiraSans-VariableItalic.woff2>');
    process.exit(1);
  }

  /*
   * Imported DYNAMICALLY, for the reason subset-mono.mjs gives: the test file
   * imports this module for COVERAGE alone, and a top-level import would make
   * the whole unit suite — and therefore `npm run verify`, and therefore CI —
   * depend on a harfbuzz binding that only this script ever calls.
   */
  const { default: subsetFont } = await import('subset-font');
  const target = path.join(root, 'public/fonts/fira-sans-italic-variable.woff2');
  const before = fs.readFileSync(source);

  const out = await subsetFont(before, COVERAGE, {
    targetFormat: 'woff2',
    variationAxes: { wght: PINNED_WEIGHT },
  });

  fs.writeFileSync(target, out);
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log(
    `subset ${COVERAGE.length} characters at wght ${PINNED_WEIGHT}: ` +
      `${kb(before.length)} -> ${kb(out.length)} ` +
      `(${Math.round((1 - out.length / before.length) * 100)}% smaller)`,
  );
}
