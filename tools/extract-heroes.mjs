/**
 * Extract the full-bleed section photography from the Spartan brochure PDF.
 *
 *   npm run extract:heroes -- "path/to/brochure.pdf"
 *
 * Writes one JPEG per divider page into src/assets/hero/.
 */
import * as mupdf from 'mupdf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_W, PAGE_H } from './lib/pdf.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const PDF = process.argv[2] ?? './brochure.pdf';
const OUT = path.join(ROOT, 'src', 'assets', 'hero');
fs.mkdirSync(OUT, { recursive: true });

const doc = mupdf.Document.openDocument(fs.readFileSync(PDF), 'application/pdf');

const NAMES = { 1: 'cover', 3: 'lighting', 7: 'electrical', 9: 'ventilation-water', 12: 'safety', 22: 'workwear' };

for (const [pnoStr, name] of Object.entries(NAMES)) {
  const pno = +pnoStr;
  const page = doc.loadPage(pno - 1);
  const S = 2;
  const TOP = 150; // crop away the layout artefact band at the top of the divider pages
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, Math.round(PAGE_W * S), Math.round((PAGE_H - TOP) * S)], false);
  pix.clear(255);
  const draw = new mupdf.DrawDevice(mupdf.Matrix.translate(0, -TOP * S), pix);
  // photography only: real images, no image masks (those carry the text/scrim overlays)
  const imagesOnly = new mupdf.Device({
    fillImage(im, ctm, alpha) {
      const w = im.getWidth(), h = im.getHeight();
      if (w < 400 || h < 300) return;   // skip logo bitmaps and small decorations
      draw.fillImage(im, ctm, alpha ?? 1);
    },
  });
  page.run(imagesOnly, mupdf.Matrix.scale(S, S));
  imagesOnly.close(); draw.close();
  const f = `${name}.jpg`;
  fs.writeFileSync(path.join(OUT, f), pix.asJPEG(82, false));
  console.log(f, `${pix.getWidth()}x${pix.getHeight()}`, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + 'KB');
}
