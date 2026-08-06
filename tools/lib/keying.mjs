/**
 * Background removal for flattened page rasters.
 *
 * Two of the datasheet PDFs are a single rasterised image per page, so there is
 * no clip stack for `renderImagesOnly` to exploit and the background has to be
 * computed. Pure functions over RGBA buffers — no PDF or filesystem knowledge —
 * so the algorithm is unit-testable without a fixture PDF.
 *
 * MODE MATTERS. The air coolers are white and grey products on a blue gradient:
 * keying on brightness erases the product, keying on saturation does not. The
 * consumer fans are the mirror case, dark products on near-white. Pick per image.
 *
 * THE MASK IS FLOOD-FILLED FROM THE BORDER, not applied globally. A global
 * threshold punches a hole through every background-coloured region *inside* the
 * subject — a white panel on a white-keyed product, a blue label on a blue-keyed
 * one. Only background-like pixels reachable from the edge are background.
 */

/** Rec. 709 relative luminance, 0..1. */
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/** HSV saturation, 0..1. Zero for any neutral, whatever its brightness. */
function saturation(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * @param {Buffer|Uint8Array} src RGBA, length w*h*4
 * @param {number} w
 * @param {number} h
 * @param {{mode: 'saturation'|'luminance', threshold: number}} opts
 *   saturation: a pixel is background when saturation >= threshold
 *   luminance:  a pixel is background when luminance  >= threshold
 * @returns {Buffer} a new RGBA buffer with background alpha set to 0
 */
export function keyBackground(src, w, h, opts) {
  const { mode, threshold } = opts;
  const out = Buffer.from(src);

  // 1. Which pixels *look* like background, ignoring connectivity.
  const bgLike = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const v = mode === 'saturation'
      ? saturation(src[i], src[i + 1], src[i + 2])
      : luma(src[i], src[i + 1], src[i + 2]);
    bgLike[p] = v >= threshold ? 1 : 0;
  }

  // 2. Keep only the ones connected to the border. Iterative stack, not
  //    recursion — these images are ~2500px square and would blow the stack.
  const isBg = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (isBg[p] || !bgLike[p]) return;
    isBg[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  // 3. Apply.
  for (let p = 0; p < w * h; p++) if (isBg[p]) out[p * 4 + 3] = 0;
  return out;
}

/** Fraction of pixels left opaque — the same health signal the extractor uses. */
export function opaqueFraction(rgba, w, h) {
  let n = 0;
  for (let p = 0; p < w * h; p++) if (rgba[p * 4 + 3] === 255) n++;
  return n / (w * h);
}
