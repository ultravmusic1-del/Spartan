# Remaining Datasheet Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish integrating the client's datasheet PDFs — add the SHT portable blower, four portable air coolers and three consumer fans, enrich the insect killer, and resolve the CAT6 electrical-characteristics question.

**Architecture:** Product records are authored by hand in `src/data/products.json`; only photography is extracted. Six products already shipped this way using `tools/extract-datasheets.mjs`, which lifts cutouts through the PDF's own clip stack. The remaining work splits cleanly in two: sheets with **discrete embedded images** (the blower) reuse that path unchanged, while sheets that are a **single flattened page raster** (coolers, consumer fans) have no clip stack to exploit and need a new chroma/luma keying step. That new step is the only genuinely novel engineering here.

**Tech Stack:** Node 22+, mupdf (PDF), sharp (raster), Vitest (unit), Playwright (e2e), Astro 7 Content Layer with Zod.

---

## Context an implementer needs before starting

Read these first. They are short and they encode decisions that will otherwise be re-litigated:

- `tools/README.md` — the two silent failure modes of the extraction pipeline, and why `extract-datasheets.mjs` is separate.
- `handoff.md` §6a — the datasheet source family, and the conflicts deliberately left unreconciled.
- `docs/CONTENT-EDITING.md` — the product record shape, field by field.

**The rule that governs every task here:** never invent product data. If a sheet does not print a value, the field is absent. Where two sheets disagree, record what is printed and add it to the conflict log in Task 8 — do not reconcile it yourself. This is safety and electrical equipment; a fabricated rating is a hazard, not a cosmetic flaw.

### Condensation must be lossless

Per-model tables get collapsed into the site's `A | B | C` convention. **That collapse may only ever be a union of the printed values — never a subset, and never a simplification that widens a claim.**

This is the rule that is easiest to break without noticing, because the result still looks like real data. The first draft of the blower record condensed five printed voltage strings to three, which read as "every model takes 220V at 50 or 60Hz". The table restricts four of the eight models to 50Hz only. Nothing was invented in the sense of a made-up number, and the row was still wrong — it asserted frequency support the sheet does not grant, which is the kind of error that sends a customer a blower that will not run on their supply.

Two tests before you write any condensed row:

1. **Union, not sample.** Every distinct printed value appears somewhere in the row.
2. **No widened claim.** If a value applies to some models and not others, say which — `220V/50Hz (SHT-50, SHT-60)`, the convention the Revolution rows already use. A bare union is only safe when the value genuinely applies across the whole range.

If a row cannot be condensed without breaking either test, keep it long. A wide spec table is a cosmetic problem; a wrong one is not.

**Current baseline** (verify before you start, `npm run test && npm run build`):

- 78 products, 428 spec rows, 16 distinct `source.doc` values
- 63 unit tests, 83 e2e passing + 1 skipped, `astro check` 0 errors / 0 warnings / 7 hints

**Every product record must carry** `source: { doc: "<pdf filename verbatim>", page: <n> }`. The filenames contain spaces and inconsistent casing — copy them exactly as they appear on disk.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `tools/lib/keying.mjs` | Background removal for flattened page rasters. Pure functions over RGBA buffers, no PDF or filesystem knowledge, so it is unit-testable in isolation. | Create |
| `tools/lib/keying.test.ts` | Unit tests for the keying algorithm | Create |
| `tools/extract-datasheets.mjs` | Manifest + extraction driver. Gains a second entry kind (`crop`) that routes through `keying.mjs`. | Modify |
| `tools/README.md` | Document the flattened-page path | Modify |
| `src/data/products.json` | 8 new product records, 1 enriched | Modify |
| `src/data/categories.json` | `fans` description covering coolers | Modify |
| `src/assets/products/ds-*.png` | 8 new cutouts | Create |
| `src/content.config.test.ts` | Count assertions | Modify |
| `src/lib/catalog.test.ts` | Count assertions | Modify |
| `tests/e2e/catalogue.spec.ts` | `TOTAL_PRODUCTS`, electricals count | Modify |
| `tests/e2e/enquiry.spec.ts` | Hardcoded product count at line ~402 | Modify |
| `handoff.md` | §6a distribution, conflict log | Modify |
| `README.md` | Headline product count | Modify |

**Category decision:** all eight new products go in the existing `fans` category (`Fans & Ventilation`). Air coolers are evaporative air movers and sit naturally beside the mist fans, which already share the water-tank concept. This keeps the instruction "don't rearrange the site massively" intact. If the client later wants a separate `cooling` category, that is a one-record change in `categories.json` plus a `categoryId` update — cheap to defer, expensive to guess at now.

---

## Task 1: SHT Portable Blower — extraction

The blower sheet has discrete embedded images, so this reuses the existing path with no new code. Doing it first proves the toolchain is healthy before Task 2 changes it.

**Files:**
- Modify: `tools/extract-datasheets.mjs` (MANIFEST array)

- [ ] **Step 1: Confirm the page's image inventory**

```bash
cd /c/Users/Vivaan/Spartan
node --input-type=module -e "
import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const mupdf=await import(pathToFileURL('./node_modules/mupdf/dist/mupdf.js').href);
const placed=(c)=>{const xs=[c[4],c[0]+c[4],c[2]+c[4],c[0]+c[2]+c[4]];const ys=[c[5],c[1]+c[5],c[3]+c[5],c[1]+c[3]+c[5]];return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)].map(v=>+v.toFixed(1));};
const d=mupdf.Document.openDocument(readFileSync('C:/Users/Vivaan/Downloads/SPARTAN -PVT -FAN.pdf'),'application/pdf');
const dev=new mupdf.Device({fillImage(im,ctm){console.log(im.getWidth()+'x'+im.getHeight(),JSON.stringify(placed(ctm)));}});
d.loadPage(2).run(dev,mupdf.Matrix.identity);dev.close();
"
```

Expected exactly this — confirm it before continuing, because the manifest entry below depends on it:

```
1800x1202 [0,-62.4,612,854.1]        <- page background
2069x175  [56.9,89.3,553.4,131.3]    <- section rule
678x326   [8.5,8.5,123.3,64]         <- Spartan logo
811x372   [65.8,357.2,551,580]       <- the spec table
615x922   [-31.6,585.7,294.6,1075.5] <- blower view 1, 8"-14"
615x922   [153.7,431.2,479.9,920.9]  <- blower view 2, 16"-24"
615x922   [347,305.4,641.7,747.2]    <- blower view 3, with A type support feet
```

There are **three** blower photographs at the same pixel size, not one group shot, so the entry needs `nth` to disambiguate. Two of the three overrun the page box — view 1 past the bottom (`y1` 1075.5 on a 792pt page) and view 3 past the right edge (`x1` 641.7 on a 612pt page). The extractor already clips the crop to the page and then trims the transparent border, so this resolves itself; it is called out here only so the reported output size does not look like a bug.

- [ ] **Step 2: Add the manifest entry**

In `tools/extract-datasheets.mjs`, append to `MANIFEST`:

```js
  // --- Portable blower (SHT series) --------------------------------------
  // Three views at 615x922 on this page; nth:3 is the "with A type support
  // feet" shot, the only one that reads as a complete product at card size.
  { pdf: 'SPARTAN -PVT -FAN.pdf', page: 3, pick: '615x922', nth: 3, out: 'ds-portable-blower.png' },
```

- [ ] **Step 3: Extract and verify**

```bash
node tools/extract-datasheets.mjs --only ds-portable-blower
```

Expected: one line reporting the cutout size and an opaque percentage between 10% and 65%. The script exits non-zero if the result is >99.5% opaque, which is what a lost clip looks like, or <0.5% opaque, which is what an empty render looks like. Both checks always run.

- [ ] **Step 4: Eyeball it against the real card colour**

```bash
node -e "
const sharp=require('sharp');
sharp({create:{width:340,height:340,channels:4,background:'#151519'}})
 .composite([{input:'src/assets/products/ds-portable-blower.png',gravity:'center'}])
 .png().toFile('/tmp/blower-check.png').then(()=>console.log('written'));
"
```

Open `/tmp/blower-check.png`. Expected: three orange blowers on dark grey with **no rectangular edge**. A visible box means the clip was dropped — stop and re-read `tools/README.md`.

- [ ] **Step 5: Commit**

```bash
git add tools/extract-datasheets.mjs src/assets/products/ds-portable-blower.png
git commit -m "feat(tools): extract the SHT portable blower cutout"
```

---

## Task 2: SHT Portable Blower — product record

**Files:**
- Modify: `src/data/products.json`

All values below are printed on page 3 of `SPARTAN -PVT -FAN.pdf`. Do not add any others.

- [ ] **Step 1: Append the record**

Add to the end of the array in `src/data/products.json`:

```json
{
  "slug": "portable-blower",
  "name": "Portable Blower",
  "variantLabel": null,
  "categoryId": "fans",
  "images": ["ds-portable-blower.png"],
  "specs": [
    { "label": "Size", "value": "8\" | 10\" | 12\" | 14\" | 16\" | 18\" | 20\" | 24\"" },
    { "label": "Power", "value": "230W | 320W | 520W | 750W | 1100W | 1500W" },
    { "label": "Voltage", "value": "220V/50/60Hz (SHT-20 to SHT-45) | 110V/50/60Hz (SHT-20 to SHT-40) | 110V/60Hz (SHT-45, SHT-50) | 220V/50Hz (SHT-50, SHT-60) | 380V/50Hz (SHT-60)" },
    { "label": "Revolution", "value": "2800 rpm (220V) | 3300 rpm (110V) | 1400 rpm (SHT-60)" },
    { "label": "Air Volume", "value": "25 to 300 m3/min" },
    { "label": "Pressure", "value": "245 to 1050 Pa" },
    { "label": "Noise", "value": "63 to 88 dB(A)" },
    { "label": "IP Rating", "value": "IP54" },
    { "label": "Series", "value": "SHT Series portable blower" },
    { "label": "Models", "value": "SHT-20 | SHT-25 | SHT-30 | SHT-35 | SHT-40 | SHT-45 | SHT-50 | SHT-60" },
    { "label": null, "value": "High efficiency, light weight, low temperature rise" },
    { "label": null, "value": "Handle and support feet fitted for easy moving" },
    { "label": null, "value": "Delivers high pressure air over long distance with flexible duct" },
    { "label": null, "value": "Optimised blade design with a matched air inlet for large air volume at high pressure" },
    { "label": null, "value": "Overheat protection device fitted" },
    { "label": null, "value": "Suitable for welding plants, floor drying, underground and tunnel ventilation" }
  ],
  "status": "published",
  "source": { "doc": "SPARTAN -PVT -FAN.pdf", "page": 3 },
  "order": 11
}
```

- [ ] **Step 2: Update the count assertions — they will fail first, which is the point**

`src/content.config.test.ts`: change `fans: 10` to `fans: 11` and `toHaveLength(78)` to `toHaveLength(79)`.

`src/lib/catalog.test.ts`: change `toHaveLength(78)` to `toHaveLength(79)` (and the test title), and the electricals assertion from `25` to `26`.

`tests/e2e/catalogue.spec.ts`: `TOTAL_PRODUCTS = 78` → `79`; the electricals filter assertion `toHaveCount(25)` → `toHaveCount(26)`.

`tests/e2e/enquiry.spec.ts` (~line 402): `toHaveCount(78)` → `toHaveCount(79)`.

- [ ] **Step 3: Verify**

```bash
npm run test && npm run build
```

Expected: 63 passed, build completes, 103 pages.

- [ ] **Step 4: Commit**

```bash
git add src/data/products.json src/content.config.test.ts src/lib/catalog.test.ts tests/e2e
git commit -m "feat(catalogue): add the SHT portable blower"
```

---

## Task 3: Background keying for flattened page rasters

`SPARTAN - PORTABLE AIR COOLERS.pdf` and `Spartan Fans Product Catalog.pdf` are one 2481×3509 image per page — the whole layout is rasterised, so there is no clip stack to knock the background out with. These need the background *computed*.

**Why a plain luminance threshold is not enough:** the air coolers are white and grey products photographed on a **blue gradient**. Keying on brightness would erase the product. The coolers are near-greyscale while the background is saturated, so saturation separates them. The consumer fans are the mirror case — dark fans on near-white — where luminance separates them and saturation does not.

**Why the mask must be flood-filled from the border rather than applied globally:** a global threshold punches holes through every white panel *inside* a product. Only background-like pixels reachable from the edge are background.

**Files:**
- Create: `tools/lib/keying.mjs`
- Create: `tools/lib/keying.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tools/lib/keying.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { keyBackground } from './keying.mjs';

/** Build an w×h RGBA buffer from a pixel-producing function. */
function make(w: number, h: number, fn: (x: number, y: number) => [number, number, number]) {
  const d = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
  }
  return d;
}

const alphaAt = (d: Buffer, w: number, x: number, y: number) => d[(y * w + x) * 4 + 3];

describe('keyBackground', () => {
  it('clears a saturated border and keeps a desaturated subject', () => {
    // 20x20 blue field with a 8x8 white square at (6,6) — the air cooler case.
    const w = 20, h = 20;
    const src = make(w, h, (x, y) =>
      x >= 6 && x < 14 && y >= 6 && y < 14 ? [250, 250, 250] : [40, 90, 200],
    );
    const out = keyBackground(src, w, h, { mode: 'saturation', threshold: 0.25 });
    expect(alphaAt(out, w, 0, 0)).toBe(0);
    expect(alphaAt(out, w, 10, 10)).toBe(255);
  });

  it('clears a bright border and keeps a dark subject', () => {
    // 20x20 white field with a dark square — the consumer fan case.
    const w = 20, h = 20;
    const src = make(w, h, (x, y) =>
      x >= 6 && x < 14 && y >= 6 && y < 14 ? [30, 30, 30] : [252, 252, 252],
    );
    const out = keyBackground(src, w, h, { mode: 'luminance', threshold: 0.9 });
    expect(alphaAt(out, w, 0, 0)).toBe(0);
    expect(alphaAt(out, w, 10, 10)).toBe(255);
  });

  it('keeps a background-coloured region enclosed by the subject', () => {
    // A white ring around a white centre, on blue. The centre matches the
    // background but is not reachable from the border, so it must survive —
    // this is the hole-punching failure a global threshold produces.
    const w = 21, h = 21;
    const inRing = (x: number, y: number) => x >= 5 && x < 16 && y >= 5 && y < 16;
    const inCore = (x: number, y: number) => x >= 9 && x < 12 && y >= 9 && y < 12;
    const src = make(w, h, (x, y) =>
      inRing(x, y) ? (inCore(x, y) ? [40, 90, 200] : [250, 250, 250]) : [40, 90, 200],
    );
    const out = keyBackground(src, w, h, { mode: 'saturation', threshold: 0.25 });
    expect(alphaAt(out, w, 0, 0)).toBe(0);
    expect(alphaAt(out, w, 10, 10)).toBe(255);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run tools/lib/keying.test.ts
```

Expected: FAIL — `Cannot find module './keying.mjs'`.

- [ ] **Step 3: Implement**

Create `tools/lib/keying.mjs`:

```js
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
```

- [ ] **Step 4: Run the tests and confirm they pass**

```bash
npx vitest run tools/lib/keying.test.ts
```

Expected: 3 passed.

- [ ] **Step 5: Confirm the whole unit suite still passes**

```bash
npm run test
```

Expected: 66 passed (63 existing + 3 new).

- [ ] **Step 6: Commit**

```bash
git add tools/lib/keying.mjs tools/lib/keying.test.ts
git commit -m "feat(tools): add border-connected background keying for flat page rasters"
```

---

## Task 4: Wire keying into the extractor

**Files:**
- Modify: `tools/extract-datasheets.mjs`

- [ ] **Step 1: Add the imports**

At the top of `tools/extract-datasheets.mjs`, alongside the existing imports:

```js
import { keyBackground, opaqueFraction as opaqueOf } from './lib/keying.mjs';
```

- [ ] **Step 2: Add a `crop` entry kind to the extraction loop**

Inside the `for (const entry of MANIFEST)` loop, immediately after the `if (ONLY && ...) continue;` guard, insert:

```js
  // Flattened-page entries carry an explicit crop rect in PDF points plus a
  // keying mode; there is no embedded image to pick out of the page.
  if (entry.crop) {
    const doc = mupdf.Document.openDocument(readFileSync(join(SRC_DIR, entry.pdf)), 'application/pdf');
    const page = doc.loadPage(entry.page - 1);
    const [x0, y0, x1, y1] = entry.crop;
    const scale = entry.scale ?? 3;
    const pix = page.toPixmap(
      mupdf.Matrix.scale(scale, scale),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    // toPixmap renders the whole page; slice the crop out of it in device px.
    const full = sharp(Buffer.from(pix.asPNG()));
    const cropped = await full
      .extract({
        left: Math.round(x0 * scale),
        top: Math.round(y0 * scale),
        width: Math.round((x1 - x0) * scale),
        height: Math.round((y1 - y0) * scale),
      })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const keyed = keyBackground(cropped.data, cropped.info.width, cropped.info.height, {
      mode: entry.key,
      threshold: entry.threshold,
    });
    const frac = opaqueOf(keyed, cropped.info.width, cropped.info.height);

    // Too opaque means the key did nothing; too sparse means it ate the subject.
    if (frac > 0.95 || frac < 0.02) {
      problems.push(`${entry.out}: ${(frac * 100).toFixed(1)}% opaque after keying — adjust key/threshold`);
      continue;
    }

    const trimmed = await sharp(keyed, {
      raw: { width: cropped.info.width, height: cropped.info.height, channels: 4 },
    })
      .trim({ threshold: 1 })
      .png()
      .toBuffer({ resolveWithObject: true });

    writeFileSync(join(OUT_DIR, entry.out), trimmed.data);
    written++;
    console.log(
      `${entry.out.padEnd(32)} keyed ${entry.key}@${entry.threshold} -> ` +
        `${trimmed.info.width}x${trimmed.info.height}  ${(frac * 100).toFixed(1)}% opaque  ` +
        `<- ${entry.pdf} p${entry.page}`,
    );
    continue;
  }
```

- [ ] **Step 3: Confirm the existing entries still extract unchanged**

```bash
node tools/extract-datasheets.mjs
```

Expected: the seven existing cutouts re-extract with the same dimensions and opaque percentages as before (`ds-exhaust-fan-standard.png 615x615 -> 348x432 22.4% opaque`, etc). Any change here is a regression in Task 4's edit.

- [ ] **Step 4: Commit**

```bash
git add tools/extract-datasheets.mjs
git commit -m "feat(tools): support crop+key entries for flattened datasheet pages"
```

---

## Task 5: Portable air coolers — extraction

**Files:**
- Modify: `tools/extract-datasheets.mjs` (MANIFEST)

There are four cooler pages, one model each. `AY-YD2536` is on page 2; read pages 1, 3 and 4 to identify the other three model codes before writing the manifest.

- [ ] **Step 1: Render all four pages and read the model codes and crop rects**

```bash
node --input-type=module -e "
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const mupdf=await import(pathToFileURL('./node_modules/mupdf/dist/mupdf.js').href);
mkdirSync('/tmp/cooler',{recursive:true});
const d=mupdf.Document.openDocument(readFileSync('C:/Users/Vivaan/Downloads/SPARTAN - PORTABLE AIR COOLERS.pdf'),'application/pdf');
for(let i=0;i<d.countPages();i++){
  const p=d.loadPage(i);
  console.log('p'+(i+1),'bounds',p.getBounds().map(Math.round).join(','));
  writeFileSync('/tmp/cooler/p'+(i+1)+'.png', p.toPixmap(mupdf.Matrix.scale(2,2),mupdf.ColorSpace.DeviceRGB,false,true).asPNG());
}
"
```

Open each `/tmp/cooler/pN.png`. For each, record: the model code from the heading, every printed spec, and the bounding box of the product photograph **in PDF points** (divide the pixel coordinates you measure by the scale factor 2).

- [ ] **Step 2: Add four manifest entries**

Append to `MANIFEST`, substituting the crop rects measured in Step 1:

```js
  // --- Portable air coolers (flattened pages, blue background) ------------
  { pdf: 'SPARTAN - PORTABLE AIR COOLERS.pdf', page: 1, crop: [x0, y0, x1, y1], key: 'saturation', threshold: 0.25, out: 'ds-air-cooler-1.png' },
  { pdf: 'SPARTAN - PORTABLE AIR COOLERS.pdf', page: 2, crop: [x0, y0, x1, y1], key: 'saturation', threshold: 0.25, out: 'ds-air-cooler-ay-yd2536.png' },
  { pdf: 'SPARTAN - PORTABLE AIR COOLERS.pdf', page: 3, crop: [x0, y0, x1, y1], key: 'saturation', threshold: 0.25, out: 'ds-air-cooler-3.png' },
  { pdf: 'SPARTAN - PORTABLE AIR COOLERS.pdf', page: 4, crop: [x0, y0, x1, y1], key: 'saturation', threshold: 0.25, out: 'ds-air-cooler-4.png' },
```

Rename `ds-air-cooler-1/3/4.png` to match the model codes found in Step 1 — e.g. `ds-air-cooler-ay-yd3020.png`.

- [ ] **Step 3: Extract**

```bash
node tools/extract-datasheets.mjs --only ds-air-cooler
```

Expected: four lines, each 5–60% opaque. If a line reports >95% the threshold is too high for that page's background; if <2% it has eaten the product. Adjust `threshold` in 0.05 steps and re-run.

- [ ] **Step 4: Check every cutout on the card colour**

```bash
node -e "
const sharp=require('sharp');const fs=require('fs');
const files=fs.readdirSync('src/assets/products').filter(f=>f.startsWith('ds-air-cooler'));
Promise.all(files.map(async (f,i)=>{
  const b=await sharp('src/assets/products/'+f).resize({height:280,fit:'inside'}).toBuffer();
  return {input:b,left:20+i*240,top:20};
})).then(c=>sharp({create:{width:20+240*c.length,height:320,channels:4,background:'#151519'}})
  .composite(c).png().toFile('/tmp/coolers-check.png')).then(()=>console.log('written'));
"
```

Open `/tmp/coolers-check.png`. Expected: four coolers on dark grey, **no blue halo and no rectangular edge**. A blue fringe means the threshold is slightly high; drop it by 0.05.

- [ ] **Step 5: Commit**

```bash
git add tools/extract-datasheets.mjs src/assets/products/ds-air-cooler-*.png
git commit -m "feat(tools): extract portable air cooler cutouts"
```

---

## Task 6: Portable air coolers — product records

**Files:**
- Modify: `src/data/products.json`

- [ ] **Step 1: Add the AY-YD2536 record**

Every value here is printed on page 2 of `SPARTAN - PORTABLE AIR COOLERS.pdf`:

```json
{
  "slug": "portable-air-cooler-ay-yd2536",
  "name": "Portable Air Cooler",
  "variantLabel": "AY-YD2536",
  "categoryId": "fans",
  "images": ["ds-air-cooler-ay-yd2536.png"],
  "specs": [
    { "label": "Power", "value": "120 W" },
    { "label": "Voltage", "value": "220-240V / 50-60Hz" },
    { "label": "Airflow", "value": "3600 m3/h" },
    { "label": "Water Tank Capacity", "value": "40 L" },
    { "label": "Water Pump Power", "value": "18 W" },
    { "label": "Blade Size", "value": "400 mm" },
    { "label": "Air Outlet Size", "value": "45 x 43 cm" },
    { "label": "Air Distance", "value": "6 m" },
    { "label": "Application Area", "value": "18-23 m2" },
    { "label": "Noise Level", "value": "<=65 dB(A)" },
    { "label": "Machine Size", "value": "93 x 62 x 40 cm" },
    { "label": "Packing Size", "value": "82 x 64 x 42 cm" },
    { "label": "Net Weight", "value": "16.1 kg" },
    { "label": "Loading Capacity (40HQ)", "value": "269 pcs full unit | 500 pcs CKD" }
  ],
  "status": "published",
  "source": { "doc": "SPARTAN - PORTABLE AIR COOLERS.pdf", "page": 2 },
  "order": 12
}
```

- [ ] **Step 2: Add the other three records**

Follow the exact same shape, using the model code as `variantLabel`, the specs read in Task 5 Step 1, `order` 13, 14 and 15, and the matching `page`. Only include labels the sheet actually prints — if a page omits Air Distance, omit the row.

- [ ] **Step 3: Update the `fans` category description**

In `src/data/categories.json`, change the `fans` entry's `description` to:

```
Residential ventilation fans from 4 to 14 inch, FA Series industrial exhaust, stand and wall fans up to 30 inch, MFS Series mist fans, SHT Series portable blowers and portable evaporative air coolers.
```

- [ ] **Step 4: Update counts**

Same five files as Task 2 Step 2. Products go 79 → 83, `fans` 11 → 15, electricals 26 → 30.

- [ ] **Step 5: Verify**

```bash
npm run test && npm run build
```

Expected: 66 passed, build completes, 107 pages.

- [ ] **Step 6: Commit**

```bash
git add src/data/products.json src/data/categories.json src/content.config.test.ts src/lib/catalog.test.ts tests/e2e
git commit -m "feat(catalogue): add four portable air coolers"
```

---

## Task 7: Consumer fans

Three domestic 16" fans from `Spartan Fans Product Catalog.pdf`. That file is also a flattened raster, but on a near-white background — so these use `key: 'luminance'`, not `'saturation'`.

**Files:**
- Modify: `tools/extract-datasheets.mjs`, `src/data/products.json`

- [ ] **Step 1: Render pages 2–4 and measure the crop rects**

```bash
node --input-type=module -e "
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const mupdf=await import(pathToFileURL('./node_modules/mupdf/dist/mupdf.js').href);
mkdirSync('/tmp/cfan',{recursive:true});
const d=mupdf.Document.openDocument(readFileSync('C:/Users/Vivaan/Downloads/Spartan Fans Product Catalog.pdf'),'application/pdf');
for(const i of [1,2,3]){
  writeFileSync('/tmp/cfan/p'+(i+1)+'.png', d.loadPage(i).toPixmap(mupdf.Matrix.scale(2,2),mupdf.ColorSpace.DeviceRGB,false,true).asPNG());
}
console.log('rendered');
"
```

Open each. These pages carry **assembly diagrams as well as product photographs** — crop the photograph, not the exploded parts diagram. Record each rect in PDF points.

- [ ] **Step 2: Add three manifest entries**

```js
  // --- Consumer fans (flattened pages, near-white background) -------------
  { pdf: 'Spartan Fans Product Catalog.pdf', page: 2, crop: [x0, y0, x1, y1], key: 'luminance', threshold: 0.92, out: 'ds-stand-fan-sptsf16.png' },
  { pdf: 'Spartan Fans Product Catalog.pdf', page: 3, crop: [x0, y0, x1, y1], key: 'luminance', threshold: 0.92, out: 'ds-wall-fan-af40w.png' },
  { pdf: 'Spartan Fans Product Catalog.pdf', page: 4, crop: [x0, y0, x1, y1], key: 'luminance', threshold: 0.92, out: 'ds-wall-fan-fw40h.png' },
```

- [ ] **Step 3: Extract and check on the card colour**

```bash
node tools/extract-datasheets.mjs --only ds-stand-fan
node tools/extract-datasheets.mjs --only ds-wall-fan
```

Then composite as in Task 5 Step 4, substituting the filename prefix. Expected: three fans, no white halo, no rectangle.

- [ ] **Step 4: Add the three product records**

All values are printed in the "TECHNICAL SPECIFICATIONS" and "KEY FEATURES" blocks of their pages.

```json
{
  "slug": "stand-fan-sptsf-16",
  "name": "Stand Fan",
  "variantLabel": "SPTSF-16",
  "categoryId": "fans",
  "images": ["ds-stand-fan-sptsf16.png"],
  "specs": [
    { "label": "Fan Size", "value": "16 inches" },
    { "label": "Power", "value": "45W" },
    { "label": "Voltage", "value": "220-240V" },
    { "label": "Frequency", "value": "50/60Hz" },
    { "label": "Power Supply", "value": "AC" },
    { "label": "Speed Control", "value": "Multi-speed — Low, Medium, High" },
    { "label": "Oscillation", "value": "Yes, wide angle" },
    { "label": "Height Adjustment", "value": "Yes, telescopic pole" },
    { "label": "Safety Standard", "value": "CB certified" },
    { "label": "Application", "value": "Home | Office | Indoor" },
    { "label": null, "value": "Tilting head to direct air vertically" }
  ],
  "status": "published",
  "source": { "doc": "Spartan Fans Product Catalog.pdf", "page": 2 },
  "order": 16
},
{
  "slug": "wall-fan-af-40w",
  "name": "Wall Fan",
  "variantLabel": "AF-40W",
  "categoryId": "fans",
  "images": ["ds-wall-fan-af40w.png"],
  "specs": [
    { "label": "Fan Size", "value": "16 inches" },
    { "label": "Power", "value": "45W" },
    { "label": "Voltage", "value": "220-240V" },
    { "label": "Frequency", "value": "50/60Hz" },
    { "label": "Power Supply", "value": "AC" },
    { "label": "Mount Type", "value": "Wall mounted" },
    { "label": "Speed Setting", "value": "Multiple" },
    { "label": "Oscillation", "value": "Yes" },
    { "label": "Tilt Adjustment", "value": "Yes" },
    { "label": null, "value": "Dual pull-cord control for speed and oscillation" },
    { "label": null, "value": "Reinforced front and rear safety guards" }
  ],
  "status": "published",
  "source": { "doc": "Spartan Fans Product Catalog.pdf", "page": 3 },
  "order": 17
},
{
  "slug": "wall-fan-fw-40h",
  "name": "Wall Fan",
  "variantLabel": "FW-40H",
  "categoryId": "fans",
  "images": ["ds-wall-fan-fw40h.png"],
  "specs": [
    { "label": "Fan Size", "value": "16 inches" },
    { "label": "Power", "value": "45W" },
    { "label": "Voltage", "value": "220-240V" },
    { "label": "Frequency", "value": "50/60Hz" },
    { "label": "Power Supply", "value": "AC" },
    { "label": "Mounting", "value": "Wall" },
    { "label": "Speed Setting", "value": "Multiple" },
    { "label": "Oscillation", "value": "Yes" },
    { "label": "Tilt Adjustment", "value": "Yes" },
    { "label": null, "value": "High-efficiency precision blades for maximum air delivery with minimal noise" },
    { "label": null, "value": "Built-in thermal protection against motor overheating" }
  ],
  "status": "published",
  "source": { "doc": "Spartan Fans Product Catalog.pdf", "page": 4 },
  "order": 18
}
```

Note the two wall fans deliberately share the name `Wall Fan` and are separated by `variantLabel`, exactly as the three exhaust-fan bodies already are.

- [ ] **Step 5: Update counts and verify**

Products 83 → 86, `fans` 15 → 18, electricals 30 → 33, in the same five files.

```bash
npm run test && npm run build
```

Expected: 66 passed, build completes, 110 pages.

- [ ] **Step 6: Commit**

```bash
git add tools/extract-datasheets.mjs src/assets/products/ds-stand-fan-*.png src/assets/products/ds-wall-fan-*.png src/data src/content.config.test.ts src/lib/catalog.test.ts tests/e2e
git commit -m "feat(catalogue): add three consumer fans"
```

---

## Task 8: Insect killer enrichment and the CAT6 decision

**Files:**
- Modify: `src/data/products.json`

The insect killer already exists with 3 specs sourced from the brochure. `SPARTAN - INSECT KILLER.pdf` page 1 prints a feature set and application list; page 2 has not been read yet.

- [ ] **Step 1: Read page 2**

```bash
node --input-type=module -e "
import {readFileSync,writeFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const mupdf=await import(pathToFileURL('./node_modules/mupdf/dist/mupdf.js').href);
const d=mupdf.Document.openDocument(readFileSync('C:/Users/Vivaan/Downloads/SPARTAN - INSECT KILLER.pdf'),'application/pdf');
writeFileSync('/tmp/insect-p2.png', d.loadPage(1).toPixmap(mupdf.Matrix.scale(2.2,2.2),mupdf.ColorSpace.DeviceRGB,false,true).asPNG());
console.log('written /tmp/insect-p2.png');
"
```

Open it and record any printed model codes, wattages, coverage areas or dimensions.

- [ ] **Step 2: Update the `insect-killer` record**

Keep the three brochure specs, append what page 1 and page 2 print, and repoint `source`. Page 1 gives these verbatim:

```json
{ "label": "Warranty", "value": "2 years" },
{ "label": "Housing", "value": "ABS fire retardant" },
{ "label": "Application", "value": "Hotel | Market | Hospital | Canteen | Food shop | Cafe | Kitchen" },
{ "label": null, "value": "Free of chemicals" },
{ "label": null, "value": "High voltage grid" }
```

Set `"source": { "doc": "SPARTAN - INSECT KILLER.pdf", "page": 1 }`.

- [ ] **Step 3: Record the CAT6 decision — do not add the electrical tables**

`Spartan CAT6 CATLOG.pdf` page 1 prints attenuation, RL, NEXT, ELFEXT, PS NEXT and PS ELFEXT at 19 frequency points for two variants — roughly 230 numbers. **Do not put these in `products.json`.** The site's spec table renders label/value rows; a 19-column frequency sweep is a datasheet artefact, not a buyer-facing spec, and it would dwarf every other product page.

The construction and standards rows that matter are already on the record from the previous pass (23AWG, 4 pairs, 250/550MHz bandwidth, 100 ± 15 Ω impedance, TIA/EIA-568B, ISO/IEC 11801). Add one row pointing at the full data instead:

```json
{ "label": "Full Electrical Characteristics", "value": "Attenuation, RL, NEXT, ELFEXT, PS NEXT and PS ELFEXT published 1-550 MHz — available on request" }
```

- [ ] **Step 4: Verify and commit**

```bash
npm run test && npm run build
```

Expected: 66 passed. Counts do not change — this task enriches, it does not add.

```bash
git add src/data/products.json
git commit -m "feat(catalogue): enrich the insect killer and note CAT6 electrical data"
```

---

## Task 9: Documentation and the client conflict log

**Files:**
- Modify: `README.md`, `handoff.md`, `tools/README.md`

- [ ] **Step 1: Update the headline count in `README.md`**

Change `**78 products across 15 categories**` to `**86 products across 15 categories**`, keeping the sentence that follows about the brochure/datasheet split and updating its figures to 72 and 14.

- [ ] **Step 2: Update `handoff.md` §6**

The distribution table's `Fans & Ventilation` row becomes `18`, the total becomes 86, and `Electricals: 25` becomes `Electricals: 33`.

- [ ] **Step 3: Extend the §6a conflict log**

Append any new conflicts found while reading the cooler and insect pages. Carry forward the four already recorded, and add this one, which is new and material:

> **Air cooler airflow is quoted in m3/h while every fan sheet quotes m3/min.** The AY-YD2536 reads 3600 m3/h; the FA and MFS tables read m3/min. Both are recorded as printed. This compounds the existing exhaust-versus-stand-fan unit conflict — a single clarification from the client should settle both.

- [ ] **Step 4: Document the flattened-page path in `tools/README.md`**

Add under the `extract-datasheets` section:

```markdown
### Flattened pages

Two sheets — the portable air coolers and the consumer fan catalogue — are a
single rasterised image per page. There is no clip stack to knock the background
out with, so those manifest entries carry a `crop` rect in PDF points plus a
keying mode instead of a `pick`:

    { pdf: '...', page: 2, crop: [x0,y0,x1,y1], key: 'saturation', threshold: 0.25, out: '...' }

`key: 'saturation'` for the coolers — white products on a blue gradient, where a
brightness key would erase the product. `key: 'luminance'` for the consumer fans,
the mirror case. The mask is flood-filled from the border, so a background-
coloured region *enclosed by* the product is kept rather than punched through.

The extractor rejects anything that comes out >95% or <2% opaque after keying:
the first means the key did nothing, the second means it ate the subject.
```

- [ ] **Step 5: Full verification**

```bash
npm run test
npx astro check
npm run build
npx playwright test
```

Expected: 66 unit passed; 0 errors / 0 warnings / 7 hints; build clean at 110 pages; 83 e2e passed + 1 skipped.

- [ ] **Step 6: Commit**

```bash
git add README.md handoff.md tools/README.md
git commit -m "docs: record the remaining datasheet integration and its conflicts"
```

---

## Task 10: Audit the six already-shipped fan records against the condensation rule

The industrial exhaust, stand, wall and mist fan records were written before the condensation rule above was articulated, using the same collapsing convention that produced the blower's voltage defect. They must be re-checked against their tables.

**Files:**
- Modify: `src/data/products.json` (only if the audit finds defects)

- [ ] **Step 1: Render the three source tables**

```bash
node --input-type=module -e "
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {pathToFileURL} from 'node:url';
const mupdf=await import(pathToFileURL('./node_modules/mupdf/dist/mupdf.js').href);
mkdirSync('/tmp/audit',{recursive:true});
const jobs=[['SPARTAN - EXHAUST FAN.pdf',[3,4]],['SPARTAN - STAND FAN AND WALL FAN.pdf',[3,4]],['SPARTAN - MIST FAN.pdf',[3]]];
for(const [f,pages] of jobs){
  const d=mupdf.Document.openDocument(readFileSync('C:/Users/Vivaan/Downloads/'+f),'application/pdf');
  for(const n of pages) writeFileSync('/tmp/audit/'+f.replace(/[^a-z0-9]/gi,'-')+'-p'+n+'.png',
    d.loadPage(n-1).toPixmap(mupdf.Matrix.scale(2.2,2.2),mupdf.ColorSpace.DeviceRGB,false,true).asPNG());
}
console.log('rendered');
"
```

- [ ] **Step 2: Check every condensed row on all six records**

For each of `industrial-exhaust-fan-standard`, `industrial-exhaust-fan-grill`, `industrial-exhaust-fan-shutter`, `industrial-stand-fan`, `industrial-wall-fan` and `mist-fan`, apply both tests from the condensation rule to every `|`-separated row.

The known-suspect row is **Voltage on the three exhaust bodies**, currently `220V/50Hz | 380V/50Hz`. In that table the FAD models are 220V and the FAS models are 380V — no single model offers both. A bare union therefore reads as "available in either", which is true of the *range* but not of any *unit*. Decide whether that needs model qualification, as the blower's did.

- [ ] **Step 3: Fix only what fails, then verify**

```bash
npm run test && npm run build
```

Counts do not change; this task edits existing rows only.

- [ ] **Step 4: Commit**

```bash
git add src/data/products.json
git commit -m "fix(catalogue): qualify condensed fan specs that widened a printed claim"
```

If the audit finds nothing, commit nothing and say so.

---

## Out of scope

Named so nobody re-opens them mid-flight:

- **Higher-resolution replacement photography for the original 72 brochure products.** The datasheets do contain better images for some of them, and swapping those in would close launch-checklist item 6 and the mobile `image-size-responsive` finding. It is a separate, larger pass — every replacement needs the same per-image verification as Task 5 Step 4.
- **Splitting `Fans & Ventilation`.** At 18 products it is by far the largest category. If the client wants it split, that is a categories.json change plus `categoryId` edits, and it should be their call.
- **The pump performance curves.** `SPARTAN PUMP TDS NEW.pdf` pages 5–8 are head/discharge charts. They are genuinely useful to a specifying engineer and genuinely wrong for a label/value spec table. Revisit if the client asks for downloadable datasheets.
