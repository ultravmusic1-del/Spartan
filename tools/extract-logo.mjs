/**
 * Extract both official Spartan lockups from the brochure PDF as vector SVG.
 *
 *   npm run extract:logo -- "path/to/brochure.pdf"
 *
 * Two lockups exist in the brochure and both are extracted as-is — neither is
 * recoloured or redrawn:
 *   - spartan-logo.svg        dark wordmark, taken from a light page (page 4)
 *   - spartan-logo-light.svg  white wordmark, taken from a dark page (page 12)
 *
 * A transparent 8x PNG of each is written alongside as a raster reference.
 */
import * as mupdf from 'mupdf';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toHex } from './lib/pdf.mjs';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const PDF = process.argv[2] ?? './brochure.pdf';
const OUT = path.join(ROOT, 'src', 'assets', 'brand');
fs.mkdirSync(OUT, { recursive: true });

const doc = mupdf.Document.openDocument(fs.readFileSync(PDF), 'application/pdf');

const svgOf = (buf) =>
  new TextDecoder().decode(buf.asUint8Array()).replace(/<image\b[\s\S]*?(?:\/>|<\/image>)/g, '');

// ---------------------------------------------------------------------------
// Dark wordmark (for light backgrounds) — page 4 header band.
// ---------------------------------------------------------------------------
function extractDark() {
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
  console.log('logo box (pt): x=%s y=%s w=%s h=%s  (aspect %s)', x0.toFixed(2), y0.toFixed(2), w.toFixed(2), h.toFixed(2), (w / h).toFixed(3));

  const box = [x0, y0, x0 + w, y0 + h];
  const inBox = (b) => b && b[2] > box[0] - 0.5 && b[0] < box[2] + 0.5 && b[3] > box[1] - 0.5 && b[1] < box[3] + 0.5;

  // --- slim SVG: forward only drawing ops inside the logo box ---
  const buf = new mupdf.Buffer();
  const writer = new mupdf.DocumentWriter(buf, 'svg', 'text=path');
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
  const svg = svgOf(buf);
  fs.writeFileSync(path.join(OUT, 'spartan-logo.svg'), svg);
  console.log('kept=%d dropped=%d  svg bytes=%d', kept, dropped, svg.length);

  // --- transparent PNG render of the same box (ground truth) ---
  const scale = 8;
  const m = mupdf.Matrix.concat(shift, mupdf.Matrix.scale(scale, scale));
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, Math.round(w * scale), Math.round(h * scale)], true);
  pix.clear();
  const dev = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
  page.run(dev, m);
  dev.close();
  fs.writeFileSync(path.join(OUT, 'spartan-logo.png'), pix.asPNG());
  console.log(`spartan-logo.png ${pix.getWidth()}x${pix.getHeight()}`);
}

// ---------------------------------------------------------------------------
// White wordmark (for dark backgrounds) — page 12, the SAFETY divider.
// ---------------------------------------------------------------------------
function extractLight() {
  const page = doc.loadPage(11); // page 12 — SAFETY divider, logo on dark

  // 1. inspect what the on-dark lockup is made of
  const seen = [];
  const isLogoOp = (b) => b && b[1] < 130 && b[0] < 300 && (b[2] - b[0]) < 400 && (b[3] - b[1]) < 300;
  const probe = new mupdf.Device({
    fillPath(p, eo, ctm, cs, color) {
      let b = null; try { b = p.getBounds(null, ctm); } catch { }
      if (isLogoOp(b)) seen.push({ op: 'path', bbox: b.map(v => +v.toFixed(1)), color: toHex(color) });
    },
    fillText(t, ctm, cs, color) {
      let b = null; try { b = t.getBounds(null, ctm); } catch { }
      if (isLogoOp(b)) seen.push({ op: 'text', bbox: b.map(v => +v.toFixed(1)), color: toHex(color) });
    },
  });
  page.run(probe, mupdf.Matrix.identity);
  probe.close();
  console.log(JSON.stringify(seen, null, 1));

  // 2. crop box from those ops
  const box = seen.reduce((a, s) => [Math.min(a[0], s.bbox[0]), Math.min(a[1], s.bbox[1]), Math.max(a[2], s.bbox[2]), Math.max(a[3], s.bbox[3])], [1e9, 1e9, -1e9, -1e9]);
  const M = 1;
  const b = [box[0] - M, box[1] - M, box[2] + M, box[3] + M];
  const w = b[2] - b[0], h = b[3] - b[1];
  console.log('box', b.map(v => v.toFixed(1)).join(','), `${w.toFixed(1)}x${h.toFixed(1)}`);

  const keep = (color) => {
    const [r, g, bl] = (color ?? [0, 0, 0]).slice(0, 3).map(c => Math.round(c * 255));
    const near = (tr, tg, tb, tol = 22) => Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(bl - tb) <= tol;
    return near(235, 41, 39) || near(151, 0, 0) || (r > 200 && g > 200 && bl > 200); // brand red or white
  };

  const buf = new mupdf.Buffer();
  const writer = new mupdf.DocumentWriter(buf, 'svg', 'text=path');
  const out = writer.beginPage([0, 0, w, h]);
  const shift = mupdf.Matrix.translate(-b[0], -b[1]);
  const inBox = (x) => x && x[2] > b[0] - .5 && x[0] < b[2] + .5 && x[3] > b[1] - .5 && x[1] < b[3] + .5
    && (x[2] - x[0]) < 400 && (x[3] - x[1]) < 300;
  let kept = 0;
  const filter = new mupdf.Device({
    fillPath(p, eo, ctm, cs, color, alpha) {
      let bb = null; try { bb = p.getBounds(null, ctm); } catch { }
      if (!inBox(bb) || !keep(color)) return;
      kept++; out.fillPath(p, eo, mupdf.Matrix.concat(ctm, shift), cs, color, alpha);
    },
    fillText(t, ctm, cs, color, alpha) {
      let bb = null; try { bb = t.getBounds(null, ctm); } catch { }
      if (!inBox(bb) || !keep(color)) return;
      kept++; out.fillText(t, mupdf.Matrix.concat(ctm, shift), cs, color, alpha);
    },
  });
  page.run(filter, mupdf.Matrix.identity);
  filter.close();
  writer.endPage(); writer.close();
  const svg = svgOf(buf);
  fs.writeFileSync(path.join(OUT, 'spartan-logo-light.svg'), svg);
  console.log('kept', kept, 'svg bytes', svg.length);

  // transparent PNG for reference
  const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, Math.round(w * 8), Math.round(h * 8)], true);
  pix.clear();
  const dd = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
  const smallEnough = (ctm, obj) => {
    let bb = null; try { bb = obj.getBounds(null, ctm); } catch { }
    return bb && (bb[2] - bb[0]) < 400 * 8 && (bb[3] - bb[1]) < 300 * 8;
  };
  const only = new mupdf.Device({
    fillPath(p, eo, ctm, cs, color, alpha) {
      if (!keep(color) || !smallEnough(ctm, p)) return;
      dd.fillPath(p, eo, ctm, cs, color, alpha);
    },
    fillText(t, ctm, cs, color, alpha) {
      if (!keep(color) || !smallEnough(ctm, t)) return;
      dd.fillText(t, ctm, cs, color, alpha);
    },
  });
  page.run(only, mupdf.Matrix.concat(shift, mupdf.Matrix.scale(8, 8)));
  only.close(); dd.close();
  fs.writeFileSync(path.join(OUT, 'spartan-logo-light.png'), pix.asPNG());
  console.log('png', `${pix.getWidth()}x${pix.getHeight()}`);
}

extractDark();
extractLight();
