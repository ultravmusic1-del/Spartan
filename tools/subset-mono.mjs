/**
 * Subset JetBrains Mono to the glyphs this catalogue actually sets in it.
 *
 *   node tools/subset-mono.mjs <path-to-full-jetbrains-mono.woff2>
 *
 * WHY THIS EXISTS
 *
 * The mono is used for spec values and EN 388 rating cells, and `Spotlight`
 * renders a real spec table on the HOME page — the page with the least
 * performance headroom on the site. Measured with the full 40 KB latin subset:
 * home mobile Performance fell 95 -> 91 and LCP rose 2.78s -> 3.23s. That is
 * pure bandwidth under Lighthouse's simulated slow 4G; `font-display: optional`
 * was tried first and changed nothing, because font-display governs RENDERING
 * and the cost here is the FETCH.
 *
 * The catalogue sets 83 distinct characters in mono across 403 labelled spec
 * values. Carrying ~250 latin glyphs to print 83 is what made it expensive.
 *
 * THE RISK THIS CREATES, AND THE GATE THAT COVERS IT
 *
 * A subset font renders tofu for any character it lacks, and product data
 * changes. So COVERAGE is the source of truth here, not the binary: it lists
 * every character the font must carry, `tools/subset-mono.test.ts` asserts the
 * catalogue never uses one outside it, and that test fails loudly with the
 * offending character if a new product introduces one. When it fails, add the
 * character here and re-run this script — do not widen the test.
 *
 * The emitted file is committed, exactly like the extraction tooling's output,
 * so a normal build never runs this.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/*
 * `subset-font` is imported DYNAMICALLY, inside the CLI block below, and that is
 * deliberate. `tools/subset-mono.test.ts` imports this module for COVERAGE
 * alone, and a top-level import would make the whole unit suite — and therefore
 * `npm run verify`, and therefore CI — depend on a harfbuzz binding that only
 * this script ever calls. The gate should not need the tool it guards.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Every character the mono must carry.
 *
 * Printable ASCII in full, because it is cheap and covers every plausible
 * alphanumeric value. Then the non-ASCII the brochure and datasheets actually
 * print, plus a deliberate margin of neighbours that specification tables
 * routinely acquire — micro, superscript two and three, the middle dot, the
 * multiplication and diameter signs, en dash and the smart quotes an editor
 * introduces by accident.
 */
export const COVERAGE = [
  // printable ASCII, U+0020 - U+007E
  ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)),
  // in the data today
  '°', '±', '×', 'ˮ', 'Φ', 'Ω', '—',
  // margin: units, symbols and punctuation a spec table tends to grow
  'µ', '·', '²', '³', 'Ø', '–', '≤', '≥', '~', '€', '“', '”', '‘', '’', 'Δ', 'π',
].join('');

if (process.argv[1] && process.argv[1].endsWith('subset-mono.mjs')) {
  const source = process.argv[2];
  if (!source) {
    console.error('usage: node tools/subset-mono.mjs <path-to-full-jetbrains-mono.woff2>');
    process.exit(1);
  }

  const { default: subsetFont } = await import('subset-font');
  const target = path.join(root, 'public/fonts/jetbrains-mono-variable.woff2');
  const before = fs.readFileSync(source);

  /*
   * The weight axis is clipped to 400-600, which is the single biggest saving
   * here — bigger than the character subset. Measured on the full latin file:
   *
   *   full latin, whole axis      39.5 KB
   *   characters only             31.4 KB   (-20%)
   *   characters + axis 400-600   23.1 KB   (-42%)
   *   characters + pinned at 600  16.7 KB   (-58%)
   *
   * 400-600 rather than a pin because the mono is set at exactly two weights
   * and they are both deliberate: `.spec td` at 400, because a dense table of
   * values should not shout, and `.en td` at 600, because five rating cells are
   * the most consulted figures on a glove page. Pinning would save another
   * 6 KB and force those to be one weight.
   *
   * If the scale ever moves either of them outside 400-600, this range moves
   * with it — a weight outside a clipped axis is silently clamped, which shows
   * up as a table that will not go bold rather than as an error.
   */
  const out = await subsetFont(before, COVERAGE, {
    targetFormat: 'woff2',
    variationAxes: { wght: { min: 400, max: 600 } },
  });

  fs.writeFileSync(target, out);
  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log(
    `subset ${COVERAGE.length} characters: ${kb(before.length)} -> ${kb(out.length)} ` +
      `(${Math.round((1 - out.length / before.length) * 100)}% smaller)`,
  );
}
