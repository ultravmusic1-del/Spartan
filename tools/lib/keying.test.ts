import { describe, it, expect } from 'vitest';
import { keyBackground } from './keying.mjs';

/** Build an w×h RGBA buffer from a pixel-producing function. */
function make(w: number, h: number, fn: (x: number, y: number) => [number, number, number]) {
  const d = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  return d;
}

const alphaAt = (d: Buffer, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe('keyBackground', () => {
  it('clears a saturated border and keeps a desaturated subject', () => {
    // 20x20 blue field with an 8x8 white square at (6,6) — the air cooler case.
    const w = 20, h = 20;
    const src = make(w, h, (x, y) =>
      x >= 6 && x < 14 && y >= 6 && y < 14 ? [250, 250, 250] : [40, 90, 200],
    );
    const out = keyBackground(src, w, h, { mode: 'saturation', threshold: 0.25 });
    expect(alphaAt(out, w, 0, 0)).toBe(0);
    expect(alphaAt(out, w, 10, 10)).toBe(255);
  });

  it('clears a bright border and keeps a dark subject', () => {
    // 20x20 white field with a dark square — the consumer fan case.
    const w = 20, h = 20;
    const src = make(w, h, (x, y) =>
      x >= 6 && x < 14 && y >= 6 && y < 14 ? [30, 30, 30] : [252, 252, 252],
    );
    const out = keyBackground(src, w, h, { mode: 'luminance', threshold: 0.9 });
    expect(alphaAt(out, w, 0, 0)).toBe(0);
    expect(alphaAt(out, w, 10, 10)).toBe(255);
  });

  it('keeps a background-coloured region enclosed by the subject', () => {
    // A white ring around a blue centre, on blue. The centre matches the
    // background but is not reachable from the border, so it must survive —
    // this is the hole-punching failure a global threshold produces.
    const w = 21, h = 21;
    const inRing = (x: number, y: number) => x >= 5 && x < 16 && y >= 5 && y < 16;
    const inCore = (x: number, y: number) => x >= 9 && x < 12 && y >= 9 && y < 12;
    const src = make(w, h, (x, y) =>
      inRing(x, y) ? (inCore(x, y) ? [40, 90, 200] : [250, 250, 250]) : [40, 90, 200],
    );
    const out = keyBackground(src, w, h, { mode: 'saturation', threshold: 0.25 });
    expect(alphaAt(out, w, 0, 0)).toBe(0);
    expect(alphaAt(out, w, 10, 10)).toBe(255);
  });
});
