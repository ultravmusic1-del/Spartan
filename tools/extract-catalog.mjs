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
  sameColumnFilter,
} from './lib/pdf.mjs';

// --- spec line parsing -----------------------------------------------------
// `Label: value` opens a new spec. Labels are short and never contain a `+`,
// so the first colon always separates label from value.
const LABEL_RE = /^([A-Za-z][A-Za-z0-9 .\/&-]{0,29}):\s*(.*)$/;
// The brochure marks additional feature bullets with a leading `+ `.
const BULLET_RE = /^\+\s+/;
// A line left hanging on a connector is continued by the line beneath it.
const DANGLING_RE = /[+,&|\/-]$/;
// So is one broken mid-noun-phrase after a preposition or article ("with
// Thermal" / "Overload Protector (TOP)" on page 11). Narrow on purpose: this
// pattern matches exactly one mid-entry line in the whole brochure.
const DANGLING_PHRASE_RE = /\b(?:with|and|or|of|for|in|on|to|from|at|by|the|a|an)\s+[A-Z][A-Za-z-]*$/;

/**
 * Turn a product's raw spec lines into `{ label, value }` pairs.
 *
 * The brochure wraps long values across several lines, so a line is treated as
 * a continuation of the one above when it starts lower-case or when the line
 * above ends on a dangling connector or preposition. Anything else starts a new
 * entry: a `Label:` line, a `+ ` bullet, or a self-contained feature phrase.
 * Feature phrases carry no label and none is invented for them.
 *
 * Continuation is a heuristic — the brochure gives no structural marker for it,
 * and a wrap between two capitalised words with no dangling connector would
 * read as two entries. The unparsed lines are kept alongside as `specsRaw` so
 * that consumers can fall back on them.
 */
function parseSpecs(rawLines) {
  const specs = [];
  let prev = null;
  for (const raw of rawLines) {
    const text = raw.trim();
    if (!text) continue;
    const labelled = LABEL_RE.exec(text);
    if (labelled) {
      specs.push({ label: labelled[1].trim(), value: labelled[2].trim() });
    } else if (BULLET_RE.test(text)) {
      specs.push({ label: null, value: text.replace(BULLET_RE, '').trim() });
    } else if (specs.length && (/^[a-z]/.test(text) ||
      (prev && (DANGLING_RE.test(prev) || DANGLING_PHRASE_RE.test(prev))))) {
      const last = specs[specs.length - 1];
      last.value = `${last.value} ${text}`.trim();
    } else {
      specs.push({ label: null, value: text });
    }
    prev = text;
  }
  return specs;
}

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

  const products = prodLines.map(p => ({ name: p.text, nameBox: p.bbox, specs: [], specsRaw: [], images: [] }));

  // Spec lines belong to the nearest product name *above* them in their own
  // column. The horizontal window alone is wide enough to reach into the
  // neighbouring column, which hands every product its neighbour's specs too.
  const sameColumn = sameColumnFilter(products);
  prodLines.forEach((p, i) => {
    const prod = products[i];
    const nextY = prodLines.filter(q => q !== p && q.bbox[1] > p.bbox[3] && Math.abs(q.bbox[0] - p.bbox[0]) < 120)
      .reduce((m, q) => Math.min(m, q.bbox[1]), Infinity);
    prod.specsRaw = lines.filter(l => l.role === 'spec' && l.bbox[1] >= p.bbox[3] - 2 && l.bbox[1] < nextY &&
      rectOverlap([l.bbox[0], 0, l.bbox[2], 1], [p.bbox[0] - 90, 0, p.bbox[2] + 220, 1]) > 0 &&
      sameColumn(l.bbox, prod))
      .sort((a, b) => a.bbox[1] - b.bbox[1]).map(s => s.text);
    prod.specs = parseSpecs(prod.specsRaw);
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
  for (const pr of p.products) {
    const labelled = pr.specs.filter(s => s.label).length;
    console.log(`p${String(p.page).padStart(2, '0')} ${pr.name.padEnd(32)} parts=${String(pr.parts).padStart(2)} out=${pr.imageSize.padEnd(10)} native=${pr.nativeMax.padEnd(9)} specs=${String(pr.specs.length).padStart(2)} (${labelled} labelled, ${pr.specs.length - labelled} unlabelled, from ${String(pr.specsRaw.length).padStart(2)} lines)`);
  }
}

const all = out.flatMap(p => p.products);
const dist = new Map();
for (const pr of all) dist.set(pr.specs.length, (dist.get(pr.specs.length) ?? 0) + 1);
console.log('\nspec-count distribution (specs per product):');
for (const k of [...dist.keys()].sort((a, b) => a - b)) console.log(`  ${k} spec(s): ${dist.get(k)} product(s)`);
console.log(`  max ${Math.max(...all.map(p => p.specs.length))}, total ${all.reduce((s, p) => s + p.specs.length, 0)} specs over ${all.length} products`);
