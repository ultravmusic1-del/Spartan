import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * The static half of rule 4.
 *
 * `tests/e2e/contrast.spec.ts` measures what actually rendered, which is the
 * stronger check but needs a browser, a build and a selector list. This one
 * needs none of those: it reads the declared token values and asserts that
 * every pair the design commits to clears its bar. It cannot know a token was
 * *used* in the wrong place — that is the e2e spec's job — but it does mean a
 * token can never be *defined* at a failing value, which is where a
 * hand-tweaked hex would otherwise slip in unnoticed.
 *
 * Added with the white theme, 2026-08-20. See
 * `docs/superpowers/specs/2026-08-20-white-theme-design.md`.
 */
const CSS = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/**
 * Deliberately a line scan rather than a regex. The first cut of this used a
 * backslash escape inside a template literal, which is one mistake away from a
 * pattern that silently matches nothing — and a token gate that matches nothing
 * reports every pair as absent, or worse, as fine. There is nothing to parse
 * here that is worth a regex.
 */
function token(name: string): string {
  const prefix = `--${name}:`;
  for (const raw of CSS.split('\n')) {
    const line = raw.trim();
    if (!line.startsWith(prefix)) continue;
    const value = line.slice(prefix.length).replace(';', '').trim();
    if (value.startsWith('#')) return value;
  }
  throw new Error(`token --${name} is not declared in tokens.css with a hex value`);
}

function rgb(hex: string): number[] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** sRGB relative luminance, WCAG 2.x §relative-luminance. */
function luminance(hex: string): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/**
 * bar 4.5 = normal-size text. bar 3 = large text (>=24px, or >=18.66px bold)
 * and non-text UI boundaries that carry meaning.
 */
const PAIRS = [
  { fg: 'text', bg: 'surface-page', bar: 4.5 },
  { fg: 'text', bg: 'surface-alt', bar: 4.5 },
  { fg: 'text-muted', bg: 'surface-page', bar: 4.5 },
  { fg: 'text-muted', bg: 'surface-alt', bar: 4.5 },
  { fg: 'accent-text', bg: 'surface-page', bar: 4.5 },
  { fg: 'accent-text', bg: 'surface-alt', bar: 4.5 },
  { fg: 'accent', bg: 'surface-page', bar: 3 },
  { fg: 'accent', bg: 'surface-alt', bar: 3 },
  { fg: 'line-control', bg: 'surface-page', bar: 3 },
  { fg: 'line-control', bg: 'surface-alt', bar: 3 },
];

describe('semantic token contrast', () => {
  for (const { fg, bg, bar } of PAIRS) {
    it(`--${fg} on --${bg} clears ${bar}:1`, () => {
      const actual = ratio(token(fg), token(bg));
      expect(
        actual,
        `--${fg} ${token(fg)} on --${bg} ${token(bg)} = ${actual.toFixed(2)}:1, needs ${bar}:1`,
      ).toBeGreaterThanOrEqual(bar);
    });
  }

  it('--accent is NOT valid for normal-size text, which is why --accent-text exists', () => {
    // Guards the distinction rather than the value. If someone "fixes" --accent
    // to clear 4.5:1 they have changed the brand red, and this should stop them
    // and make them say so out loud.
    expect(ratio(token('accent'), token('surface-page'))).toBeLessThan(4.5);
  });

  it('white text on --accent-fill clears 4.5:1', () => {
    expect(ratio('#ffffff', token('accent-fill'))).toBeGreaterThanOrEqual(4.5);
  });
});
