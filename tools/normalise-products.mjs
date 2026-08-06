/**
 * Normalise the raw brochure extraction into the site's product records.
 *
 *   npm run normalise
 *
 * Reads src/data/products.raw.json and writes src/data/products.json.
 *
 * NOTHING IS INVENTED HERE. Every value written out is either copied verbatim
 * from the extraction or is a lookup keyed on an extracted value (page number,
 * image filename). The two lookup tables below — variants and EN 388 ratings —
 * are the only hand-authored content, and both were read off the rendered
 * brochure pages. If a lookup ever stops matching the data, the script throws
 * rather than guessing: a wrong protection rating on safety equipment is a
 * hazard, not a cosmetic defect.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(root, 'src/data/products.raw.json');
const OUT = path.join(root, 'src/data/products.json');
const IMAGE_DIR = path.join(root, 'src/assets/products');

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

// --- category assignment ---------------------------------------------------
// The brochure groups products by page, so the page number determines the
// category. Page 19's "Body Protection" spread is the one exception: it mixes
// fall-arrest equipment with body protection, so it is split by product name.
const CATEGORY_BY_PAGE = {
  4: 'lighting',
  5: 'lighting',
  6: 'insect',
  8: 'cables',
  10: 'fans',
  11: 'pumps',
  13: 'eye',
  14: 'hearing',
  15: 'head',
  16: 'hand',
  17: 'hand',
  18: 'hand',
  20: 'foot',
  21: 'foot',
  23: 'workwear',
  24: 'workwear',
};

const P19_FALL_ARREST = new Set(['Full Body Harness', 'Lightweight Web Straps']);

function categoryFor(page, name) {
  if (page === 19) return P19_FALL_ARREST.has(name) ? 'harness' : 'body';
  const id = CATEGORY_BY_PAGE[page];
  if (!id) throw new Error(`No category mapped for page ${page} ("${name}")`);
  return id;
}

// --- the one permitted text correction -------------------------------------
const NAME_FIXES = { 'Ear Plugs dispsenser': 'Ear Plugs Dispenser' };

// --- variant disambiguation ------------------------------------------------
// Seven brochure names repeat. The name stays as printed; `variantLabel` gives
// the difference so the UI can append it, and the slug is made unique.
//
// Keyed on IMAGE FILENAME, not on position — the `-2` suffix does not
// consistently mean "the second variant listed". `expect` is the verbatim text
// of one of that record's own spec values, and every label is derived from it.
// The script requires an exact match on the record it binds to and no match on
// any sibling sharing the name, so a mis-binding fails here instead of shipping
// a product page describing the wrong item.
const VARIANTS = {
  'p10-ventilation-fans.png': { label: '6" · 8" · 10"', slug: 'ventilation-fans-6-8-10-inch', expect: '6 inch | 8 inch | 10 inch' },
  'p10-ventilation-fans-2.png': { label: '6" · 8"', slug: 'ventilation-fans-6-8-inch', expect: '6 inch | 8 inch' },
  'p10-ventilation-fans-3.png': { label: '14"', slug: 'ventilation-fans-14-inch', expect: '14 inch' },
  'p10-ventilation-fans-4.png': { label: '4" · 6" · 8"', slug: 'ventilation-fans-4-6-8-inch', expect: '4 inch | 6 inch | 8 inch' },
  'p13-safety-glasses.png': { label: 'Lightweight', slug: 'safety-glasses-lightweight', expect: 'Lightweight design' },
  'p13-safety-glasses-2.png': { label: 'Adjustable temple', slug: 'safety-glasses-adjustable-temple', expect: 'Adjustable temple' },
  'p13-safety-goggles.png': { label: 'Indirect vent', slug: 'safety-goggles-indirect-vent', expect: 'Indirect ventilating design' },
  'p13-safety-goggles-2.png': { label: 'Direct vent', slug: 'safety-goggles-direct-vent', expect: 'Direct ventilating design' },
  'p14-ear-muff.png': { label: 'NRR 25dB', slug: 'ear-muff-nrr-25db', expect: '25dB + Easy slide cup adjustment' },
  'p14-ear-muff-2.png': { label: 'NRR 20dB', slug: 'ear-muff-nrr-20db', expect: '20dB + Easy slide cup adjustment' },
  'p19-safety-vests.png': { label: 'Velcro closure', slug: 'safety-vests-velcro', expect: 'Velcro closure vests + Lightweight' },
  'p19-safety-vests-2.png': { label: 'Zipper closure', slug: 'safety-vests-zipper', expect: 'Zipper closure vests + Lightweight' },
  'p20-construction-gum-boots.png': { label: 'Without steel toe', slug: 'construction-gum-boots-without-steel-toe', expect: 'PVC + Without steel toe' },
  'p20-construction-gum-boots-2.png': { label: 'With steel toe', slug: 'construction-gum-boots-steel-toe', expect: 'PVC + With steel toe' },
  'p20-low-cut-safety-shoes.png': { label: 'KPU upper', slug: 'low-cut-safety-shoes-kpu', expect: 'KPU (Knitted Polyurethane)' },
  'p20-low-cut-safety-shoes-2.png': { label: 'Suede leather upper', slug: 'low-cut-safety-shoes-suede-leather', expect: 'Brown suede leather' },
};

/** True when `expect` is the verbatim text of one of the record's spec values. */
const statesExactly = (raw, expect) => raw.specs.some((s) => s.value === expect);

// --- EN 388 mechanical protection levels -----------------------------------
// Read off the "RESISTANCE SPECIFICATIONS" tables rendered from brochure pages
// 16 and 17. The extraction dropped these tables because they are page
// furniture rather than per-product spec lines, so they are restored here.
//
// Each table row is baseline-aligned with its glove's name, which is what binds
// a row to a product. Page 17 prints only two rows for its four gloves: Latex
// Coated Gloves and Impact Ultra D sit below the last rule with no row of their
// own, so they carry NO en388 field. Absent is the honest answer; a guessed
// rating is not acceptable.
const EN388 = {
  'grip-guard-gp1': { abrasion: '4', bladeCut: '1', tear: '3', puncture: '1', tdmCut: 'X' },
  'grip-guard-gp3': { abrasion: '3', bladeCut: 'X', tear: '4', puncture: '2', tdmCut: 'B' },
  'grip-guard-gp5': { abrasion: '4', bladeCut: 'X', tear: '4', puncture: '3', tdmCut: 'D' },
  'flex-fit': { abrasion: '4', bladeCut: '1', tear: '3', puncture: '1', tdmCut: 'A' },
  'chem-guard': { abrasion: '4', bladeCut: '1', tear: '0', puncture: '1', tdmCut: 'X' },
  'cut-flex': { abrasion: '2', bladeCut: 'X', tear: '4', puncture: '4', tdmCut: 'C' },
};

// --- normalise -------------------------------------------------------------
const pages = JSON.parse(fs.readFileSync(RAW, 'utf8'));

const out = [];
const orderByCategory = new Map();
const usedVariants = new Set();

for (const page of pages) {
  for (const raw of page.products) {
    const name = NAME_FIXES[raw.name] ?? raw.name;
    const categoryId = categoryFor(page.page, name);
    const variant = VARIANTS[raw.image];

    if (variant) {
      // Confirm the image really does belong to the record we think it does.
      if (!statesExactly(raw, variant.expect)) {
        throw new Error(
          `Variant mismatch for ${raw.image}: no spec value reads exactly "${variant.expect}". ` +
            `Specs are: ${raw.specs.map((s) => JSON.stringify(s.value)).join(', ')}`,
        );
      }
      usedVariants.add(raw.image);
    }

    const order = (orderByCategory.get(categoryId) ?? 0) + 1;
    orderByCategory.set(categoryId, order);

    const product = {
      slug: variant ? variant.slug : slugify(name),
      name,
      variantLabel: variant ? variant.label : null,
      categoryId,
      images: [raw.image],
      specs: raw.specs,
      status: 'published',
      // This extractor only ever reads the original brochure, so `doc` is
      // constant here. Products sourced from the per-family datasheets are
      // authored by hand and carry that PDF's filename instead — see the
      // `source` note in src/content.config.ts.
      source: { doc: 'brochure', page: page.page },
      order,
    };

    const en388 = EN388[product.slug];
    if (en388) product.en388 = en388;

    out.push(product);
  }
}

// --- verification ----------------------------------------------------------
const slugs = new Set();
for (const p of out) {
  if (slugs.has(p.slug)) throw new Error(`Duplicate slug: ${p.slug}`);
  slugs.add(p.slug);
}

// Every repeated brochure name must have been disambiguated, or two products
// would silently collapse to one page.
const nameCounts = new Map();
for (const p of out) nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);
for (const p of out) {
  if (nameCounts.get(p.name) > 1 && p.variantLabel === null) {
    throw new Error(`Repeated name with no variantLabel: ${p.name} (${p.images[0]})`);
  }
}

for (const image of Object.keys(VARIANTS)) {
  if (!usedVariants.has(image)) throw new Error(`Variant table references a missing image: ${image}`);
}

// A discriminator that also describes a same-named sibling would not tell the
// two apart, so require each `expect` to match exactly one record within its
// own name group. (Unrelated products may legitimately share a phrase — Welding
// Goggles is also "Indirect ventilating design" — which is why this is scoped
// by name rather than brochure-wide.) This is what makes the image-keyed
// binding trustworthy.
const allRaw = pages.flatMap((p) => p.products);
for (const [image, variant] of Object.entries(VARIANTS)) {
  const self = allRaw.find((r) => r.image === image);
  const siblings = allRaw.filter((r) => (NAME_FIXES[r.name] ?? r.name) === (NAME_FIXES[self.name] ?? self.name));
  const matches = siblings.filter((r) => statesExactly(r, variant.expect));
  if (matches.length !== 1 || matches[0].image !== image) {
    throw new Error(
      `Ambiguous variant discriminator "${variant.expect}": matched ` +
        `[${matches.map((m) => m.image).join(', ')}], expected only ${image}`,
    );
  }
}

for (const slug of Object.keys(EN388)) {
  if (!slugs.has(slug)) throw new Error(`EN 388 table references a missing product: ${slug}`);
}

for (const p of out) {
  for (const img of p.images) {
    if (!fs.existsSync(path.join(IMAGE_DIR, img))) {
      throw new Error(`Missing image on disk for ${p.slug}: ${img}`);
    }
  }
}

// The authoritative distribution, counted from the extraction.
const EXPECTED = {
  lighting: 10, fans: 4, pumps: 3, insect: 1, cables: 1, accessories: 0,
  head: 7, eye: 6, hearing: 6, hand: 11, foot: 8, harness: 2, body: 4,
  workwear: 9, spill: 0,
};
for (const [id, n] of Object.entries(EXPECTED)) {
  const actual = out.filter((p) => p.categoryId === id).length;
  if (actual !== n) throw new Error(`Category ${id}: expected ${n} products, got ${actual}`);
}
if (out.length !== 72) throw new Error(`Expected 72 products, got ${out.length}`);

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(
  `Wrote ${out.length} products to src/data/products.json ` +
    `(${Object.keys(VARIANTS).length} variants, ${Object.keys(EN388).length} with EN 388 ratings).`,
);
