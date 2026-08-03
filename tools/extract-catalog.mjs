/**
 * Extract the product catalogue from the Spartan brochure PDF.
 *
 *   npm run extract:catalog -- "path/to/brochure.pdf"
 *
 * Writes src/data/products.raw.json and one composited, transparent PNG per
 * product into src/assets/products/.
 */
import * as mupdf from 'mupdf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PAGE_W,
  PAGE_H,
  ROLE_BY_HEX,
  toHex,
  placedRect,
  rectOverlap,
  slugify,
  renderImagesOnly,
  assignImagesToProducts,
} from './lib/pdf.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const PDF = process.argv[2] ?? './brochure.pdf';
const IMG_DIR = path.join(ROOT, 'src', 'assets', 'products');
const DATA_DIR = path.join(ROOT, 'src', 'data');
fs.mkdirSync(IMG_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

const doc = mupdf.Document.openDocument(fs.readFileSync(PDF), 'application/pdf');
const total = doc.countPages();

const out = [];
for (let pno = 1; pno <= total; pno++) {
  const page = doc.loadPage(pno - 1);
  const runs = [], inPage = [], bleed = [];
  const seen = new Set();
  const dev = new mupdf.Device({
    fillText(t, ctm, cs, color) {
      let b = null; try { b = t.getBounds(null, ctm); } catch { }
      const role = ROLE_BY_HEX[toHex(color)];
      if (b && role) runs.push({ role, bbox: b.map(v => +v.toFixed(1)) });
    },
    fillImage(im, ctm) { add(im, ctm); },
    fillImageMask(im, ctm) { add(im, ctm); },
  });
  function add(im, ctm) {
    try {
      const w = im.getWidth(), h = im.getHeight();
      const bbox = placedRect(ctm);
      const key = `${w}x${h}@${bbox.join(',')}`;
      if (seen.has(key)) return;
      seen.add(key);
      const rec = { w, h, bbox, ppp: w / Math.max(1, bbox[2] - bbox[0]) };
      const inside = bbox[0] >= 2 && bbox[1] >= 2 && bbox[2] <= PAGE_W - 2 && bbox[3] <= PAGE_H - 2;
      if (inside && (bbox[2] - bbox[0]) >= 20 && (bbox[3] - bbox[1]) >= 20) inPage.push(rec);
      else if (!inside && w >= 700 && h >= 500) bleed.push(rec);
    } catch { }
  }
  page.run(dev, mupdf.Matrix.identity);
  dev.close();

  const st = JSON.parse(page.toStructuredText('preserve-whitespace').asJSON());
  const lines = [];
  for (const blk of st.blocks ?? []) {
    if (blk.type !== 'text') continue;
    for (const ln of blk.lines ?? []) {
      const t = (ln.text ?? '').trim(); if (!t) continue;
      const b = ln.bbox;
      lines.push({ text: t, bbox: [b.x, b.y, b.x + b.w, b.y + b.h].map(v => +v.toFixed(1)) });
    }
  }
  for (const ln of lines) {
    let best = null, bestA = 0;
    for (const r of runs) { const a = rectOverlap(ln.bbox, r.bbox); if (a > bestA) { bestA = a; best = r; } }
    ln.role = bestA > 0 ? best.role : null;
  }

  const prodLines = lines.filter(l => l.role === 'product' && !/^RESISTANCE SPECIFICATIONS$/i.test(l.text))
    .sort((a, b) => a.bbox[1] - b.bbox[1]);
  const section = lines.find(l => l.role === 'section')?.text ?? null;
  const pageLabel = lines.find(l => l.role === 'pagelabel')?.text ?? null;

  const products = prodLines.map(p => {
    const nextY = prodLines.filter(q => q !== p && q.bbox[1] > p.bbox[3] && Math.abs(q.bbox[0] - p.bbox[0]) < 120)
      .reduce((m, q) => Math.min(m, q.bbox[1]), Infinity);
    const specs = lines.filter(l => l.role === 'spec' && l.bbox[1] >= p.bbox[3] - 2 && l.bbox[1] < nextY &&
      rectOverlap([l.bbox[0], 0, l.bbox[2], 1], [p.bbox[0] - 90, 0, p.bbox[2] + 220, 1]) > 0)
      .sort((a, b) => a.bbox[1] - b.bbox[1]).map(s => s.text);
    return { name: p.text, nameBox: p.bbox, specs, images: [] };
  });

  // assign EVERY in-page image to its nearest product within the SAME column
  assignImagesToProducts(inPage, products);

  // render each product's image cluster on transparent background
  const usedSlugs = new Map();
  for (const p of products) {
    if (!p.images.length) continue;
    const u = p.images.reduce((a, i) => [Math.min(a[0], i.bbox[0]), Math.min(a[1], i.bbox[1]), Math.max(a[2], i.bbox[2]), Math.max(a[3], i.bbox[3])], [1e9, 1e9, -1e9, -1e9]);
    const M = 3; // small margin in pt
    const box = [u[0] - M, u[1] - M, u[2] + M, u[3] + M];
    // render at ~2x the densest source bitmap so nothing is upscaled beyond 2x
    const dens = Math.max(...p.images.map(i => i.ppp));
    const scale = Math.min(4, Math.max(2, dens * 1.5));
    // forwards ONLY this product's own images -> transparent bg, no texture, no
    // neighbours. Clip/group ops are forwarded unconditionally; see tools/lib/pdf.mjs.
    const pix = renderImagesOnly(page, box, scale, p.images);

    let slug = slugify(p.name);
    const n = (usedSlugs.get(slug) ?? 0) + 1; usedSlugs.set(slug, n);
    if (n > 1) slug += `-${n}`;
    const file = `p${String(pno).padStart(2, '0')}-${slug}.png`;
    fs.writeFileSync(path.join(IMG_DIR, file), pix.asPNG());
    p.image = file; p.imageSize = `${pix.getWidth()}x${pix.getHeight()}`; p.parts = p.images.length;
    p.nativeMax = `${Math.max(...p.images.map(i => i.w))}x${Math.max(...p.images.map(i => i.h))}`;
  }

  // full-bleed hero photography (section dividers). The usable crops are written
  // by tools/extract-heroes.mjs; only the page metadata is recorded here.
  bleed.sort((a, b) => b.w * b.h - a.w * a.h);
  const heroes = [];
  if (!products.length && bleed.length) {
    const top = bleed[0];
    heroes.push({ render: `${Math.round(PAGE_W * 2)}x${Math.round(PAGE_H * 2)}`, largestSource: `${top.w}x${top.h}` });
  }

  out.push({
    page: pno, pageLabel, section,
    heroes,
    products: products.filter(p => p.image).map(({ nameBox, images, ...r }) => r),
  });
}

fs.writeFileSync(path.join(DATA_DIR, 'products.raw.json'), JSON.stringify(out, null, 1));
let n = 0;
for (const p of out) n += p.products.length;
console.log(`products with composited images: ${n}`);
for (const p of out) {
  if (p.heroes.length) console.log(`p${String(p.page).padStart(2, '0')} HERO ${p.heroes[0].render} (src ${p.heroes[0].largestSource})`);
  for (const pr of p.products) console.log(`p${String(p.page).padStart(2, '0')} ${pr.name.padEnd(32)} parts=${String(pr.parts).padStart(2)} out=${pr.imageSize.padEnd(10)} native=${pr.nativeMax}`);
}
