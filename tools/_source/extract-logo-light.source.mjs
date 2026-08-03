import * as mupdf from "mupdf";
import fs from "node:fs";
import path from "node:path";

const PDF = "C:\\Users\\Vivaan\\Downloads\\08012026-001 - Spartan Brochure.pdf";
const OUT = "C:\\Users\\Vivaan\\Desktop\\spartan\\design\\assets\\brand";
fs.mkdirSync(OUT, { recursive: true });

const doc = mupdf.Document.openDocument(fs.readFileSync(PDF), "application/pdf");
const page = doc.loadPage(11); // page 12 — SAFETY divider, logo on dark

const hex = (c) => c ? "#" + c.slice(0, 3).map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("") : "?";

// 1. inspect what the on-dark lockup is made of
const seen = [];
const isLogoOp = (b) => b && b[1] < 130 && b[0] < 300 && (b[2] - b[0]) < 400 && (b[3] - b[1]) < 300;
const probe = new mupdf.Device({
  fillPath(p, eo, ctm, cs, color) {
    let b = null; try { b = p.getBounds(null, ctm); } catch { }
    if (isLogoOp(b)) seen.push({ op: "path", bbox: b.map(v => +v.toFixed(1)), color: hex(color) });
  },
  fillText(t, ctm, cs, color) {
    let b = null; try { b = t.getBounds(null, ctm); } catch { }
    if (isLogoOp(b)) seen.push({ op: "text", bbox: b.map(v => +v.toFixed(1)), color: hex(color) });
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
console.log("box", b.map(v => v.toFixed(1)).join(","), `${w.toFixed(1)}x${h.toFixed(1)}`);

const keep = (color) => {
  const [r, g, bl] = (color ?? [0, 0, 0]).slice(0, 3).map(c => Math.round(c * 255));
  const near = (tr, tg, tb, tol = 22) => Math.abs(r - tr) <= tol && Math.abs(g - tg) <= tol && Math.abs(bl - tb) <= tol;
  return near(235, 41, 39) || near(151, 0, 0) || (r > 200 && g > 200 && bl > 200); // brand red or white
};

const buf = new mupdf.Buffer();
const writer = new mupdf.DocumentWriter(buf, "svg", "text=path");
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
let svg = new TextDecoder().decode(buf.asUint8Array()).replace(/<image\b[\s\S]*?(?:\/>|<\/image>)/g, "");
fs.writeFileSync(path.join(OUT, "spartan-logo-light.svg"), svg);
console.log("kept", kept, "svg bytes", svg.length);

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
fs.writeFileSync(path.join(OUT, "spartan-logo-light.png"), pix.asPNG());
console.log("png", `${pix.getWidth()}x${pix.getHeight()}`);
