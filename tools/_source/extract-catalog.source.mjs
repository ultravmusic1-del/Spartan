import * as mupdf from "mupdf";
import fs from "node:fs";
import path from "node:path";

const PDF = "C:\\Users\\Vivaan\\Downloads\\08012026-001 - Spartan Brochure.pdf";
const OUT = process.argv[2] ?? "C:\\Users\\Vivaan\\AppData\\Local\\Temp\\claude\\C--Users-Vivaan-Desktop-spartan\\4f3a1da7-7294-4d7d-9fa7-a5a579299b6a\\scratchpad\\catalog2";
fs.mkdirSync(path.join(OUT, "products"), { recursive: true });
fs.mkdirSync(path.join(OUT, "hero"), { recursive: true });

const doc = mupdf.Document.openDocument(fs.readFileSync(PDF), "application/pdf");
const total = doc.countPages();
const hex = (c) => c ? "#" + c.slice(0, 3).map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("") : "#000000";
const ROLE = { "#eb2927": "section", "#970000": "product", "#7f7f7f": "spec", "#979797": "pagelabel" };
const PW = 612.288, PH = 858.898;
const ov = (a, b) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
const ctr = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const out = [];
for (let pno = 1; pno <= total; pno++) {
  const page = doc.loadPage(pno - 1);
  const runs = [], inPage = [], bleed = [];
  const seen = new Set();
  const dev = new mupdf.Device({
    fillText(t, ctm, cs, color) {
      let b = null; try { b = t.getBounds(null, ctm); } catch { }
      const role = ROLE[hex(color)];
      if (b && role) runs.push({ role, bbox: b.map(v => +v.toFixed(1)) });
    },
    fillImage(im, ctm) { add(im, ctm); },
    fillImageMask(im, ctm) { add(im, ctm); },
  });
  function add(im, ctm) {
    try {
      const w = im.getWidth(), h = im.getHeight();
      const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
      const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
      const bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => +v.toFixed(1));
      const key = `${w}x${h}@${bbox.join(",")}`;
      if (seen.has(key)) return;
      seen.add(key);
      const rec = { w, h, bbox, ppp: w / Math.max(1, bbox[2] - bbox[0]) };
      const inside = bbox[0] >= 2 && bbox[1] >= 2 && bbox[2] <= PW - 2 && bbox[3] <= PH - 2;
      if (inside && (bbox[2] - bbox[0]) >= 20 && (bbox[3] - bbox[1]) >= 20) inPage.push(rec);
      else if (!inside && w >= 700 && h >= 500) bleed.push(rec);
    } catch { }
  }
  page.run(dev, mupdf.Matrix.identity);
  dev.close();

  const st = JSON.parse(page.toStructuredText("preserve-whitespace").asJSON());
  const lines = [];
  for (const blk of st.blocks ?? []) {
    if (blk.type !== "text") continue;
    for (const ln of blk.lines ?? []) {
      const t = (ln.text ?? "").trim(); if (!t) continue;
      const b = ln.bbox;
      lines.push({ text: t, bbox: [b.x, b.y, b.x + b.w, b.y + b.h].map(v => +v.toFixed(1)) });
    }
  }
  for (const ln of lines) {
    let best = null, bestA = 0;
    for (const r of runs) { const a = ov(ln.bbox, r.bbox); if (a > bestA) { bestA = a; best = r; } }
    ln.role = bestA > 0 ? best.role : null;
  }

  const prodLines = lines.filter(l => l.role === "product" && !/^RESISTANCE SPECIFICATIONS$/i.test(l.text))
    .sort((a, b) => a.bbox[1] - b.bbox[1]);
  const section = lines.find(l => l.role === "section")?.text ?? null;
  const pageLabel = lines.find(l => l.role === "pagelabel")?.text ?? null;

  const products = prodLines.map(p => {
    const nextY = prodLines.filter(q => q !== p && q.bbox[1] > p.bbox[3] && Math.abs(q.bbox[0] - p.bbox[0]) < 120)
      .reduce((m, q) => Math.min(m, q.bbox[1]), Infinity);
    const specs = lines.filter(l => l.role === "spec" && l.bbox[1] >= p.bbox[3] - 2 && l.bbox[1] < nextY &&
      ov([l.bbox[0], 0, l.bbox[2], 1], [p.bbox[0] - 90, 0, p.bbox[2] + 220, 1]) > 0)
      .sort((a, b) => a.bbox[1] - b.bbox[1]).map(s => s.text);
    return { name: p.text, nameBox: p.bbox, specs, imgs: [] };
  });

  // assign EVERY in-page image to its nearest product within the SAME column
  const MID = PW / 2;
  const col = (x) => (x < MID ? 0 : 1);
  const twoCol = products.some(p => ctr(p.nameBox)[0] >= MID) && products.some(p => ctr(p.nameBox)[0] < MID);
  for (const im of inPage) {
    const ic = ctr(im.bbox);
    let best = null, bestD = Infinity;
    for (const p of products) {
      const c = ctr(p.nameBox);
      if (twoCol && col(ic[0]) !== col(c[0])) continue;
      const d = Math.hypot(ic[0] - c[0], ic[1] - c[1]);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best && bestD < 320) best.imgs.push(im);
  }

  // render each product's image cluster on transparent background
  const usedSlugs = new Map();
  for (const p of products) {
    if (!p.imgs.length) continue;
    const u = p.imgs.reduce((a, i) => [Math.min(a[0], i.bbox[0]), Math.min(a[1], i.bbox[1]), Math.max(a[2], i.bbox[2]), Math.max(a[3], i.bbox[3])], [1e9, 1e9, -1e9, -1e9]);
    const M = 3; // small margin in pt
    const box = [u[0] - M, u[1] - M, u[2] + M, u[3] + M];
    const w = box[2] - box[0], h = box[3] - box[1];
    // render at ~2x the densest source bitmap so nothing is upscaled beyond 2x
    const dens = Math.max(...p.imgs.map(i => i.ppp));
    const scale = Math.min(4, Math.max(2, dens * 1.5));
    const pw = Math.round(w * scale), ph = Math.round(h * scale);
    const pix = new mupdf.Pixmap(mupdf.ColorSpace.DeviceRGB, [0, 0, pw, ph], true);
    pix.clear();
    const draw = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
    // forward ONLY this product's own images -> transparent bg, no texture, no neighbours
    // device ctm is composed with the render matrix -> map the drawn rect back to page space
    const isMine = (ctm) => {
      const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
      const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
      const pb = [
        Math.min(...xs) / scale + box[0], Math.min(...ys) / scale + box[1],
        Math.max(...xs) / scale + box[0], Math.max(...ys) / scale + box[1],
      ];
      return p.imgs.some(i => i.bbox.every((v, k) => Math.abs(v - pb[k]) < 1.2));
    };
    // Clip/group ops MUST be forwarded unconditionally: the brochure knocks the black
    // photo backgrounds out with clipImageMask, and the push/pop stack must stay balanced.
    const onlyImages = new mupdf.Device({
      fillImage(im, ctm, alpha) { if (isMine(ctm)) draw.fillImage(im, ctm, alpha ?? 1); },
      fillImageMask(im, ctm, cs, color, alpha) { if (isMine(ctm)) draw.fillImageMask(im, ctm, cs, color, alpha ?? 1); },
      clipPath(p, evenOdd, ctm) { draw.clipPath(p, evenOdd, ctm); },
      clipStrokePath(p, stroke, ctm) { draw.clipStrokePath(p, stroke, ctm); },
      clipText(t, ctm) { draw.clipText(t, ctm); },
      clipStrokeText(t, stroke, ctm) { draw.clipStrokeText(t, stroke, ctm); },
      clipImageMask(im, ctm) { draw.clipImageMask(im, ctm); },
      popClip() { draw.popClip(); },
      beginMask(area, luminosity, cs, color) { draw.beginMask(area, luminosity, cs, color); },
      endMask() { draw.endMask(); },
      beginGroup(area, cs, isolated, knockout, blendmode, alpha) { draw.beginGroup(area, cs, isolated, knockout, blendmode, alpha); },
      endGroup() { draw.endGroup(); },
    });
    const m = mupdf.Matrix.concat(mupdf.Matrix.translate(-box[0], -box[1]), mupdf.Matrix.scale(scale, scale));
    page.run(onlyImages, m);
    onlyImages.close(); draw.close();

    let slug = slugify(p.name);
    const n = (usedSlugs.get(slug) ?? 0) + 1; usedSlugs.set(slug, n);
    if (n > 1) slug += `-${n}`;
    const file = `p${String(pno).padStart(2, "0")}-${slug}.png`;
    fs.writeFileSync(path.join(OUT, "products", file), pix.asPNG());
    p.image = file; p.imageSize = `${pw}x${ph}`; p.parts = p.imgs.length;
    p.nativeMax = `${Math.max(...p.imgs.map(i => i.w))}x${Math.max(...p.imgs.map(i => i.h))}`;
  }

  // full-bleed hero photography (section dividers)
  bleed.sort((a, b) => b.w * b.h - a.w * a.h);
  const heroes = [];
  if (!products.length && bleed.length) {
    const top = bleed[0];
    const pix = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB, false, true);
    const f = `hero-p${String(pno).padStart(2, "0")}.png`;
    fs.writeFileSync(path.join(OUT, "hero", f), pix.asPNG());
    heroes.push({ file: f, render: `${pix.getWidth()}x${pix.getHeight()}`, largestSource: `${top.w}x${top.h}` });
  }

  out.push({
    page: pno, pageLabel, section,
    heroes,
    products: products.filter(p => p.image).map(({ nameBox, imgs, ...r }) => r),
  });
}

fs.writeFileSync(path.join(OUT, "catalog.json"), JSON.stringify(out, null, 1));
let n = 0;
for (const p of out) n += p.products.length;
console.log(`products with composited images: ${n}`);
for (const p of out) {
  if (p.heroes.length) console.log(`p${String(p.page).padStart(2, "0")} HERO ${p.heroes[0].render} (src ${p.heroes[0].largestSource})`);
  for (const pr of p.products) console.log(`p${String(p.page).padStart(2, "0")} ${pr.name.padEnd(32)} parts=${String(pr.parts).padStart(2)} out=${pr.imageSize.padEnd(10)} native=${pr.nativeMax}`);
}
