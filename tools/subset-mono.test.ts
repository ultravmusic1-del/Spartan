import { describe, expect, it } from 'vitest';
import { COVERAGE } from './subset-mono.mjs';
import products from '../src/data/products.json' with { type: 'json' };

/**
 * The mono is subset to 118 characters (`tools/subset-mono.mjs`). A subset font
 * renders **tofu** — an empty box — for anything it does not carry, and product
 * data changes: the datasheet integration alone added 13 products and took
 * Electricals from ~24 spec rows to 169.
 *
 * So this asserts the containment the subset depends on: every character the
 * catalogue sets in mono is one the font carries. It fails with the offending
 * character and the product that introduced it.
 *
 * When it fails, add the character to COVERAGE and re-run the subsetter against
 * the full JetBrains Mono file. **Do not widen this test** — its whole value is
 * that it is narrower than the font.
 *
 * Only LABELLED spec rows are checked. Unlabelled feature rows are prose and
 * render in Inter (see `SpecTable.astro`), so they are deliberately out of
 * scope; asserting them here would force the mono to carry the whole language.
 */

const covered = new Set(COVERAGE);

/** Every character the mono is actually asked to render, with its source. */
function monoCharacters(): Map<string, string> {
  const seen = new Map<string, string>();
  for (const product of products as Array<Record<string, any>>) {
    for (const spec of product.specs ?? []) {
      if (spec.label === null) continue; // feature row — Inter, not mono
      for (const ch of String(spec.value)) {
        if (!seen.has(ch)) seen.set(ch, `${product.slug} → "${spec.label}"`);
      }
    }
    if (product.en388) {
      for (const ch of Object.values(product.en388).join('')) {
        if (!seen.has(ch)) seen.set(ch, `${product.slug} → EN 388`);
      }
    }
  }
  return seen;
}

describe('the mono subset covers the catalogue', () => {
  it('carries every character used in a labelled spec value or an EN 388 cell', () => {
    const uncovered = [...monoCharacters()]
      .filter(([ch]) => !covered.has(ch))
      .map(([ch, where]) => `${JSON.stringify(ch)} (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}) from ${where}`);

    expect(
      uncovered,
      uncovered.length
        ? `These characters would render as tofu. Add them to COVERAGE in ` +
          `tools/subset-mono.mjs and re-run the subsetter:\n  ${uncovered.join('\n  ')}`
        : '',
    ).toEqual([]);
  });

  it('carries the EN 388 alphabet exactly, including X', () => {
    // `X` means "not submitted for this test" and `0` means "tested, scored
    // zero". Both are printed literally and must both be renderable — Chem
    // Guard's tear resistance is a printed 0, not an X, and the difference is
    // the difference between untested and failed.
    for (const ch of '0123456789X') expect(covered.has(ch), `EN 388 needs ${ch}`).toBe(true);
  });

  it('is a real subset, not the whole latin range', () => {
    // If someone "fixes" a tofu report by pasting in a wide range, the file
    // goes back to 39.5 KB and the home page loses the point this bought.
    expect(covered.size).toBeLessThan(200);
  });
});
