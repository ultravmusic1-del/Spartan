import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { COVERAGE, PINNED_WEIGHT } from './subset-hero-font.mjs';

/**
 * The gate on the hero font's subset.
 *
 * `public/fonts/fira-sans-italic-variable.woff2` carries 98 characters at one
 * weight, and renders TOFU for anything else. Nothing in the build notices: the
 * page compiles, `astro check` is clean, axe is happy, and the headline shows
 * empty boxes. So the headline is checked against COVERAGE here rather than
 * trusted.
 *
 * It reads the headline out of `Hero.astro` rather than restating it, because a
 * copy is a thing that drifts — the whole point is to fail when somebody edits
 * that text.
 */
const hero = fs.readFileSync('src/components/sections/Hero.astro', 'utf8');

/** The `<h1>`'s text, tags stripped. */
function headlineText(): string {
  const match = hero.match(/<h1[^>]*class="hero__title"[^>]*>([\s\S]*?)<\/h1>/);
  if (!match) throw new Error('could not find the hero <h1> — has its class changed?');
  return match[1]
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

describe('the hero font subset', () => {
  it('finds the headline it is meant to be guarding', () => {
    // Guards the regex above: if it silently matched nothing useful, every
    // other assertion here would pass vacuously.
    expect(headlineText().length).toBeGreaterThan(10);
  });

  /*
   * BOTH CASES, because `.hero__title` is `text-transform: uppercase`. The
   * source is mixed case and the RENDERED glyphs are uppercase, so the font
   * must carry the uppercase forms whatever the source says — and it must still
   * carry the lowercase ones the day that declaration is removed.
   */
  it('carries every character the headline sets, in both cases', () => {
    const text = headlineText();
    const needed = new Set([...text, ...text.toUpperCase(), ...text.toLowerCase()]);
    const missing = [...needed].filter((ch) => !COVERAGE.includes(ch));

    expect(
      missing,
      `the hero headline uses ${JSON.stringify(missing.join(''))}, which the subset font does ` +
        'not carry — it will render as tofu. Add it to COVERAGE in ' +
        'tools/subset-hero-font.mjs and re-run that script; do not widen this test.',
    ).toEqual([]);
  });

  /*
   * The axis is PINNED, so a weight other than 800 is silently clamped rather
   * than refused: the headline renders at 800 and looks like a CSS specificity
   * bug. This is the one place that mismatch is visible.
   */
  it('is set at the one weight the font file was pinned to', () => {
    const weight = hero.match(/\.hero__title\s*\{[\s\S]*?font-weight:\s*(\d+)/)?.[1];
    expect(weight, 'could not read font-weight from .hero__title').toBeDefined();
    expect(
      Number(weight),
      `.hero__title is set at ${weight} but the font file is pinned to ${PINNED_WEIGHT}. A pinned ` +
        'axis clamps silently. Re-run tools/subset-hero-font.mjs with the new weight and update ' +
        'PINNED_WEIGHT and the @font-face in src/styles/fonts.css together.',
    ).toBe(PINNED_WEIGHT);
  });

  it('ships the OFL licence beside the binary, which redistribution requires', () => {
    expect(fs.existsSync('public/fonts/fira-sans-LICENSE.txt')).toBe(true);
    expect(fs.existsSync('public/fonts/fira-sans-italic-variable.woff2')).toBe(true);
  });
});
