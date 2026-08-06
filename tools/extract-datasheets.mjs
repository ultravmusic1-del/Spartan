/**
 * Extract product cutouts from the per-family datasheet PDFs.
 *
 * WHY THIS EXISTS SEPARATELY FROM extract-catalog.mjs. That script reads the
 * one brochure and derives products, specs and images together from its layout.
 * These are 20 unrelated supplier datasheets with no shared structure, so there
 * is nothing to infer — the products and specs are authored by hand in
 * products.json and this script only lifts the photography.
 *
 * THE BLACK-BOX PROBLEM IS THE SAME ONE. Extracting an embedded image directly
 * gives an opaque rectangle: sampled from these PDFs the bed is #000 with no
 * alpha channel at all, and on --color-card (#151519) that reads as a black
 * box around every product. The knock-out lives in the page's clip/mask stack,
 * not in the image, which is why this goes through `renderImagesOnly` — the
 * same helper the brochure pipeline uses, which forwards every clip, mask and
 * group push with its matching pop and filters only the fill operations.
 * See tools/README.md before changing any of that.
 *
 * SCALE IS PINNED TO THE SOURCE. Each entry renders at the scale that maps the
 * placed rectangle back to the image's own pixel dimensions, so nothing is ever
 * upscaled. Every run refuses anything that came out fully opaque, which is
 * what a lost clip looks like, or empty, which is what a dropped render looks
 * like. Those checks are unconditional — there is no flag to skip them.
 *
 *   node tools/extract-datasheets.mjs [--only <substring>]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as mupdf from 'mupdf';
import sharp from 'sharp';
import { placedRect, renderImagesOnly } from './lib/pdf.mjs';

const SRC_DIR = process.env.DATASHEET_DIR ?? 'C:/Users/Vivaan/Downloads';
const OUT_DIR = 'src/assets/products';

/**
 * One entry per product photo.
 *
 * `pick` selects the image on the page by its native pixel dimensions — stable
 * across re-runs and readable, unlike a bare draw-order index. `out` is the
 * filename written into src/assets/products/ and referenced from products.json.
 */
const MANIFEST = [
  // --- Industrial exhaust fans (FA series) -------------------------------
  { pdf: 'SPARTAN - EXHAUST FAN.pdf', page: 3, pick: '615x615', out: 'ds-exhaust-fan-standard.png' },
  { pdf: 'SPARTAN - EXHAUST FAN.pdf', page: 4, pick: '538x1268', nth: 1, out: 'ds-exhaust-fan-grill.png' },
  { pdf: 'SPARTAN - EXHAUST FAN.pdf', page: 4, pick: '538x1268', nth: 2, out: 'ds-exhaust-fan-shutter.png' },

  // --- Industrial stand and wall fans (FA series) ------------------------
  { pdf: 'SPARTAN - STAND FAN AND WALL FAN.pdf', page: 3, pick: '189x400', out: 'ds-industrial-stand-fan.png' },
  { pdf: 'SPARTAN - STAND FAN AND WALL FAN.pdf', page: 4, pick: '269x345', out: 'ds-industrial-wall-fan.png' },

  // --- Mist fans (MFS series) --------------------------------------------
  { pdf: 'SPARTAN - MIST FAN.pdf', page: 3, pick: '730x922', out: 'ds-mist-fan.png' },

  // --- Portable blower (SHT series) --------------------------------------
  // Three views at 615x922, cascading left-to-right (placed x = -32, 154, 347).
  // The sheet captions them 8"-14", 16"-24" and "With A type support feet" at
  // x = 110, 299, 462 — all real text in the PDF's text layer. nth is spatial,
  // so nth:3 is the rightmost, the A-type-support-feet shot.
  { pdf: 'SPARTAN -PVT -FAN.pdf', page: 3, pick: '615x922', nth: 3, out: 'ds-portable-blower.png' },
];

const args = process.argv.slice(2);
const onlyIx = args.indexOf('--only');
const ONLY = onlyIx >= 0 ? args[onlyIx + 1] : null;

/** A cutout at or above this is a rectangle: the clip was lost. */
const LOST_CLIP_OPAQUE = 0.995;
/** A cutout at or below this is blank: the render produced nothing. */
const EMPTY_RENDER_OPAQUE = 0.005;

mkdirSync(OUT_DIR, { recursive: true });

/** Every image drawn on a page, with its placed rect and native pixel size. */
function imagesOnPage(page) {
  const found = [];
  const dev = new mupdf.Device({
    fillImage(im, ctm) {
      found.push({ px: `${im.getWidth()}x${im.getHeight()}`, w: im.getWidth(), h: im.getHeight(), bbox: placedRect(ctm) });
    },
  });
  page.run(dev, mupdf.Matrix.identity);
  dev.close();
  return found;
}

/** Fraction of pixels that are fully opaque — a lost clip pushes this to ~1. */
function opaqueFraction(pix) {
  if (!pix.getAlpha()) return 1;
  const d = pix.getPixels();
  // getNumberOfComponents() is pix->n, which ALREADY counts alpha: an RGBA
  // pixmap reports 4, not 3. Adding 1 stepped the buffer by 5 and read R/G/B
  // bytes 4 samples in 5. Against these sheets' #000 bed that made a fully
  // lost clip measure ~26% and pass the 99.5% guard — the black-box check was
  // decorative. Measured on a clip-dropped render: 26.5% before, 100.0% after.
  const n = pix.getNumberOfComponents();
  let opaque = 0;
  let total = 0;
  for (let i = n - 1; i < d.length; i += n) {
    total++;
    // >= 250, not === 255: this PDF's soft mask quantises the subject to
    // 250-254, which made a good blower cutout report 0.4%. Broadening only
    // raises the fraction, so the lost-clip guard gets strictly more
    // sensitive, never less — a lost clip is alpha exactly 255 either way.
    if (d[i] >= 250) opaque++;
  }
  return total ? opaque / total : 1;
}

let written = 0;
const problems = [];

for (const entry of MANIFEST) {
  if (ONLY && !entry.out.includes(ONLY)) continue;

  const doc = mupdf.Document.openDocument(readFileSync(join(SRC_DIR, entry.pdf)), 'application/pdf');
  const page = doc.loadPage(entry.page - 1);
  const images = imagesOnPage(page);

  const matches = images
    .filter((im) => im.px === entry.pick)
    // Spatial, not display-list, order: `pick` exists because draw order is
    // opaque, and `nth` would otherwise reinstate exactly that. Left-to-right
    // then top-to-bottom matches how the sheets caption their variants.
    .sort((a, b) => a.bbox[0] - b.bbox[0] || a.bbox[1] - b.bbox[1]);
  const target = matches[(entry.nth ?? 1) - 1];
  if (!target) {
    problems.push(`${entry.out}: no image ${entry.pick}#${entry.nth ?? 1} on ${entry.pdf} p${entry.page} (found ${images.map((i) => i.px).join(', ')})`);
    continue;
  }

  // Render at the scale that reproduces the source image's own resolution, so
  // the cutout is never upscaled past what the supplier actually supplied.
  const placedW = target.bbox[2] - target.bbox[0];
  const placedH = target.bbox[3] - target.bbox[1];
  const scale = Math.min(target.w / placedW, target.h / placedH);

  // Clip the crop to the page. Several of these sheets place a tall photo so it
  // runs off the bottom edge — SPARTAN - EXHAUST FAN p4 puts a 420pt image at
  // y=602 on a 792pt page — and rendering the whole placed rect would pad the
  // cutout with a third of a frame of empty space, which then scales down to a
  // thumbnail inside the card's 150px media box. Only the visible part is real.
  const pageBox = page.getBounds();
  const box = [
    Math.max(target.bbox[0], pageBox[0]),
    Math.max(target.bbox[1], pageBox[1]),
    Math.min(target.bbox[2], pageBox[2]),
    Math.min(target.bbox[3], pageBox[3]),
  ];

  // `keepImages` still matches on the ORIGINAL placed rect — that is what the
  // device reports — while `box` only governs the crop window.
  const pix = renderImagesOnly(page, box, scale, [{ bbox: target.bbox }]);
  const frac = opaqueFraction(pix);

  if (frac > LOST_CLIP_OPAQUE) {
    problems.push(`${entry.out}: ${(frac * 100).toFixed(1)}% opaque — the clip was lost, this would render as a black box`);
    continue;
  }
  if (frac < EMPTY_RENDER_OPAQUE) {
    problems.push(`${entry.out}: ${(frac * 100).toFixed(1)}% opaque — the render came out empty, nothing was drawn`);
    continue;
  }

  // Trim the fully transparent border. These sheets place several photos on a
  // canvas far larger than the subject — the shuttered fan covers under 4% of
  // its own frame — and untrimmed that padding is what gets scaled to fit the
  // card's 150px media box, leaving the product a quarter of the size it should
  // be. Trimming on the alpha channel only; nothing inside the subject moves.
  const trimmed = await sharp(Buffer.from(pix.asPNG()))
    .trim({ threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true });

  writeFileSync(join(OUT_DIR, entry.out), trimmed.data);
  written++;
  console.log(
    `${entry.out.padEnd(32)} ${String(pix.getWidth()).padStart(4)}x${String(pix.getHeight()).padStart(4)}` +
      ` -> ${String(trimmed.info.width).padStart(4)}x${String(trimmed.info.height).padStart(4)}  ` +
      `${(frac * 100).toFixed(1)}% opaque  <- ${entry.pdf} p${entry.page} [${entry.pick}]`,
  );
}

if (problems.length) {
  console.error('\nPROBLEMS:');
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log(`\n${written} cutouts written to ${OUT_DIR}`);
