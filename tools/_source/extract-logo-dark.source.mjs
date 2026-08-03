import * as mupdf from "mupdf";
import fs from "node:fs";
import path from "node:path";

const PDF = "C:\\Users\\Vivaan\\Downloads\\08012026-001 - Spartan Brochure.pdf";
const OUT = "C:\\Users\\Vivaan\\AppData\\Local\\Temp\\claude\\C--Users-Vivaan-Desktop-spartan\\4f3a1da7-7294-4d7d-9fa7-a5a579299b6a\\scratchpad\\logo";
fs.mkdirSync(OUT, { recursive: true });

const doc = mupdf.Document.openDocument(fs.readFileSync(PDF), "application/pdf");
const page = doc.loadPage(3);

// --- tight ink bbox: only saturated red or near-black pixels in the header band ---
const S = 4;
const scan = page.toPixmap(mupdf.Matrix.scale(S, S), mupdf.ColorSpace.DeviceRGB, false, true);
const W = scan.getWidth(), H = scan.getHeight(), N = scan.getNumberOfComponents();
const px = scan.getPixels();
const yLo = Math.round(10 * S), yHi = Math.round(105 * S), xHi = Math.round(280 * S);
let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
for (let y = yLo; y < Math.min(yHi, H); y++) {
  for (let x = 0; x < Math.min(xHi, W); x++) {
    const i = (y * W + x) * N;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    const isRed = r > 140 && g < 120 && b < 120;
    const isInk = r < 110 && g < 110 && b < 110;
    if (!isRed && !isInk) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
const pad = 1.0;
const x0 = minX / S - pad, y0 = minY / S - pad;
const w = (maxX - minX + 1) / S + pad * 2, h = (maxY - minY + 1) / S + pad * 2;
console.log("logo box (pt): x=%s y=%s w=%s h=%s  (aspect %s)", x0.toFixed(2), y0.toFixed(2), w.toFixed(2), h.toFixed(2), (w / h).toFixed(3));

const box = [x0, y0, x0 + w, y0 + h];
const inBox = (b) => b && b[2] > box[0] - 0.5 && b[0] < box[2] + 0.5 && b[3] > box[1] - 0.5 && b[1] < box[3] + 0.5;

// --- slim SVG: forward only drawing ops inside the logo box ---
const buf = new mupdf.Buffer();
const writer = new mupdf.DocumentWriter(buf, "svg", "text=path");
const out = writer.beginPage([0, 0, w, h]);
const shift = mupdf.Matrix.translate(-x0, -y0);
let kept = 0, dropped = 0;
// only the logo's own ink: brand red, deep red accent, or near-black
const isBrandInk = (color) => {
  const [r, g, b] = (color ?? [0, 0, 0]).slice(0, 3).map(c => Math.round(c * 255));
  const near = (tr, tg, tb, tol = 18) => Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(b - tb) <= tol;
  return near(235, 41, 39) || near(151, 0, 0) || (r < 70 && g < 70 && b < 70);
};
const filter = new mupdf.Device({
  fillPath(p, evenOdd, ctm, cs, color, alpha) {
    let b; try { b = p.getBounds(null, ctm); } catch { b = null; }
    if (!b || !inBox(b) || !isBrandInk(color)) { dropped++; return; }
    kept++;
    out.fillPath(p, evenOdd, mupdf.Matrix.concat(ctm, shift), cs, color, alpha);
  },
  fillText(text, ctm, cs, color, alpha) {
    let b; try { b = text.getBounds(null, ctm); } catch { b = null; }
    if (!b || !inBox(b) || !isBrandInk(color)) { dropped++; return; }
    kept++;
    out.fillText(text, mupdf.Matrix.concat(ctm, shift), cs, color, alpha);
  },
});
page.run(filter, mupdf.Matrix.identity);
filter.close();
writer.endPage();
writer.close();
let svg = new TextDecoder().decode(buf.asUint8Array());
svg = svg.replace(/<image\b[\s\S]*?(?:\/>|<\/image>)/g, "");
fs.writeFileSync(path.join(OUT, "spartan-logo.svg"), svg);
console.log("kept=%d dropped=%d  svg bytes=%d", kept, dropped, svg.length);

// --- transparent PNG renders of the same box (ground truth) ---
for (const scale of [4, 8, 12]) {
  const m = mupdf.Matrix.concat(shift, mupdf.Matrix.scale(scale, scale));
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, Math.round(w * scale), Math.round(h * scale)], true);
  pix.clear();
  const dev = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
  page.run(dev, m);
  dev.close();
  fs.writeFileSync(path.join(OUT, `logo-${scale}x.png`), pix.asPNG());
  console.log(`logo-${scale}x.png ${pix.getWidth()}x${pix.getHeight()}`);
}
