import * as mupdf from 'mupdf';

export const PAGE_W = 612.288;
export const PAGE_H = 858.898;

/** Colour roles used by the brochure's type system. */
export const ROLE_BY_HEX = {
  '#eb2927': 'section',
  '#970000': 'product',
  '#7f7f7f': 'spec',
  '#979797': 'pagelabel',
};

export const toHex = (c) =>
  c ? '#' + c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('') : '#000000';

/** Rect of a unit image placed by `ctm`. */
export function placedRect(ctm) {
  const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
  const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => +v.toFixed(1));
}

export const centre = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

export const rectOverlap = (a, b) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Render only `keepImages` onto a transparent pixmap.
 *
 * CRITICAL: brochure product photos are rectangles with opaque BLACK
 * backgrounds that the layout knocks out with clipImageMask. Every clip,
 * mask and group push must be forwarded together with its matching pop, or
 * the cutout is lost and each product renders inside a black box. Only the
 * *fill* operations are filtered.
 */
export function renderImagesOnly(page, box, scale, keepImages) {
  const w = box[2] - box[0];
  const h = box[3] - box[1];
  const pix = new mupdf.Pixmap(
    mupdf.ColorSpace.DeviceRGB,
    [0, 0, Math.round(w * scale), Math.round(h * scale)],
    true,
  );
  pix.clear();
  const draw = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
  const shift = mupdf.Matrix.translate(-box[0], -box[1]);

  const isKept = (ctm) => {
    const r = placedRect(ctm);
    const pageSpace = [
      r[0] / scale + box[0], r[1] / scale + box[1],
      r[2] / scale + box[0], r[3] / scale + box[1],
    ];
    return keepImages.some((k) => k.bbox.every((v, i) => Math.abs(v - pageSpace[i]) < 1.2));
  };

  const filter = new mupdf.Device({
    fillImage(im, ctm, alpha) { if (isKept(ctm)) draw.fillImage(im, ctm, alpha ?? 1); },
    fillImageMask(im, ctm, cs, color, alpha) { if (isKept(ctm)) draw.fillImageMask(im, ctm, cs, color, alpha ?? 1); },
    clipPath(p, eo, ctm) { draw.clipPath(p, eo, ctm); },
    clipStrokePath(p, st, ctm) { draw.clipStrokePath(p, st, ctm); },
    clipText(t, ctm) { draw.clipText(t, ctm); },
    clipStrokeText(t, st, ctm) { draw.clipStrokeText(t, st, ctm); },
    clipImageMask(im, ctm) { draw.clipImageMask(im, ctm); },
    popClip() { draw.popClip(); },
    beginMask(a, l, cs, c) { draw.beginMask(a, l, cs, c); },
    endMask() { draw.endMask(); },
    beginGroup(a, cs, i, k, b, al) { draw.beginGroup(a, cs, i, k, b, al); },
    endGroup() { draw.endGroup(); },
  });

  page.run(filter, mupdf.Matrix.concat(shift, mupdf.Matrix.scale(scale, scale)));
  filter.close();
  draw.close();
  return pix;
}

/**
 * Build the same-column test for one page's products.
 *
 * A page is two-column when product names appear on both sides of the page
 * centre. On such pages anything belonging to a product — its images and its
 * spec lines alike — must come from that product's own column: the columns sit
 * close enough that nearest-overall matching reaches across the gutter.
 *
 * Returns `(bbox, product) => boolean`, always true on single-column pages.
 */
export function sameColumnFilter(products) {
  const MID = PAGE_W / 2;
  const col = (x) => (x < MID ? 0 : 1);
  const twoCol =
    products.some((p) => centre(p.nameBox)[0] >= MID) &&
    products.some((p) => centre(p.nameBox)[0] < MID);

  return (bbox, product) => !twoCol || col(centre(bbox)[0]) === col(centre(product.nameBox)[0]);
}

/**
 * Assign each in-page image to the nearest product name *in the same column*.
 * Cross-column assignment mixes products up on two-column pages — e.g. the
 * orange vests migrate to the green-vest entry on page 19.
 */
export function assignImagesToProducts(images, products) {
  const sameColumn = sameColumnFilter(products);

  for (const im of images) {
    const ic = centre(im.bbox);
    let best = null;
    let bestD = Infinity;
    for (const p of products) {
      if (!sameColumn(im.bbox, p)) continue;
      const c = centre(p.nameBox);
      const d = Math.hypot(ic[0] - c[0], ic[1] - c[1]);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best && bestD < 320) best.images.push(im);
  }
  return products;
}
