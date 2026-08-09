/**
 * Build the Spartan brand & asset sheet — a single PDF for handing to a design
 * tool (Claude Design) as visual reference.
 *
 *   node tools/brand-sheet.mjs [outfile.pdf]
 *
 * WHY A PDF AND NOT AN HTML BUNDLE. A design agent reads a PDF with vision,
 * which is cheap and is exactly how a human would use a contact sheet. The same
 * assets inlined as base64 data-URIs would be ~15 MB of text that no model can
 * usefully read.
 *
 * WHY IMAGES ARE PRE-RESIZED. Chromium embeds decoded images at their source
 * resolution, so referencing src/assets directly produces a needlessly large
 * file. Products are composited onto the card surface and encoded as JPEG —
 * visually identical to how they appear on the dark site, and a fraction of the
 * size. The originals remain transparent PNGs; the sheet says so.
 */
import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
// Positional outfile only — flags must not be mistaken for one, or `--png`
// silently becomes the output filename.
const positional = process.argv.slice(2).find((a) => !a.startsWith('-'));
const OUT = resolve(positional ?? join(ROOT, 'spartan-brand-assets.pdf'));
const WORK = join(ROOT, '.brand-sheet-tmp');

const products = JSON.parse(readFileSync(join(ROOT, 'src/data/products.json'), 'utf8'));
const categories = JSON.parse(readFileSync(join(ROOT, 'src/data/categories.json'), 'utf8'));
const divisions = JSON.parse(readFileSync(join(ROOT, 'src/data/divisions.json'), 'utf8'));

rmSync(WORK, { recursive: true, force: true });
mkdirSync(join(WORK, 'p'), { recursive: true });
mkdirSync(join(WORK, 'h'), { recursive: true });

const CARD = { r: 0x15, g: 0x15, b: 0x19 }; // --color-card

/* ---------------------------------------------------------------- assets -- */

// Sized generously: the sheet exists to make a design tool's output accurate, and
// the whole thing lands around 5 MB against a 20 MB ceiling. `withoutEnlargement`
// keeps the project's no-upscaling rule — sources are 100–440px native, so most
// of these stay at their real size rather than being stretched.
console.log('resizing 72 product images…');
for (const p of products) {
  const src = join(ROOT, 'src/assets/products', p.images[0]);
  await sharp(src)
    .resize({ width: 520, height: 520, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: CARD })
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(join(WORK, 'p', `${p.slug}.jpg`));
}

console.log('resizing hero photography…');
const heroes = [
  ['hero-desktop-poster.jpg', 'Product range — the home page hero'],
  ['lighting.jpg', 'Lighting'],
  ['electrical.jpg', 'Electricals'],
  ['ventilation-water.jpg', 'Ventilation & water'],
  ['safety.jpg', 'Safety'],
  ['workwear.jpg', 'Workwear'],
];
for (const [file] of heroes) {
  await sharp(join(ROOT, 'src/assets/hero', file))
    .resize({ width: 1400, withoutEnlargement: true })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(WORK, 'h', file));
}

/* Screenshots of the real site, if a preview server is up.
 *
 * For landing-page mockups this is the most useful page in the sheet: it shows
 * how the tokens, type and photography actually compose. Skipped silently when
 * nothing is serving — the sheet is still complete without it. */
mkdirSync(join(WORK, 's'), { recursive: true });
const SITE = process.env.SITE_URL ?? 'http://localhost:4321';
const shots = [
  ['home-desktop.jpg', '/', 1440, 2400, 'Home page — desktop'],
  ['home-mobile.jpg', '/', 430, 1600, 'Home page — mobile'],
  ['category.jpg', '/catalogue/hand-protection', 1440, 1700, 'Category page — Hand Protection'],
  ['product.jpg', '/products/grip-guard-gp5', 1440, 1500, 'Product page — Grip Guard GP5'],
];
let siteOk = false;
try {
  const res = await fetch(SITE, { signal: AbortSignal.timeout(2500) });
  siteOk = res.ok;
} catch {
  /* nothing serving */
}

if (siteOk) {
  console.log(`capturing site screenshots from ${SITE}…`);
  const b = await chromium.launch();
  for (const [file, path, width, height] of shots) {
    const pg = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await pg.goto(SITE + path, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(500);
    const buf = await pg.screenshot();
    await sharp(buf)
      .resize({ width: Math.min(width, 1200), withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(join(WORK, 's', file));
    await pg.close();
  }
  await b.close();
} else {
  console.log(`no server at ${SITE} — skipping the site section (run \`npm run preview\` to include it)`);
}

const url = (p) => pathToFileURL(join(WORK, p)).href;
const asset = (p) => pathToFileURL(join(ROOT, p)).href;

/* ------------------------------------------------------------------ html -- */

const swatch = (name, hex, note) => `
  <div class="sw">
    <div class="sw__chip" style="background:${hex}"></div>
    <div><code>${name}</code><b>${hex}</b><span>${note}</span></div>
  </div>`;

const byCategory = categories
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((c) => ({
    ...c,
    division: divisions.find((d) => d.id === c.divisionId)?.name ?? '',
    items: products.filter((p) => p.categoryId === c.id).sort((a, b) => a.order - b.order),
  }));

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face { font-family:'Archivo'; font-weight:100 900; font-display:block;
               src:url('${asset('public/fonts/archivo-variable.woff2')}') format('woff2'); }
  @font-face { font-family:'Inter'; font-weight:100 900; font-display:block;
               src:url('${asset('public/fonts/inter-variable.woff2')}') format('woff2'); }

  :root{
    --red:#eb2927; --red-fill:#dd1e1c; --red-light:#ef3a38; --red-deep:#970000;
    --black:#08080a; --panel:#0e0e11; --card:#151519; --line:#232329;
    --grey:#8a8a92; --grey-lt:#b4b4bc;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--black);color:#fff;font-family:'Inter',sans-serif;font-size:11px;line-height:1.5}
  h1,h2,h3{font-family:'Archivo',sans-serif;letter-spacing:-0.02em;line-height:1.05}
  code{font-family:ui-monospace,monospace}

  .page{page-break-after:always;padding:34px 40px;min-height:100vh}
  .page:last-child{page-break-after:auto}

  .eyebrow{font-family:'Archivo';font-size:10px;font-weight:700;letter-spacing:.18em;
           text-transform:uppercase;color:var(--red-light)}
  h1{font-size:40px;font-weight:800;text-transform:uppercase;margin:10px 0 14px}
  h2{font-size:20px;font-weight:800;text-transform:uppercase;margin:0 0 4px}
  .lede{color:var(--grey-lt);max-width:74ch;margin-bottom:22px}
  .rule{height:2px;background:var(--red);width:56px;margin:14px 0 20px}

  .logos{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0 8px}
  .logo{border:1px solid var(--line);padding:26px;display:flex;align-items:center;justify-content:center;min-height:130px}
  .logo img{height:52px}
  .logo--light{background:#f6f6f7}
  .cap{color:var(--grey);margin-top:7px;font-size:10px}

  .sw{display:flex;gap:10px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--line)}
  .sw__chip{width:34px;height:34px;flex:0 0 34px;border:1px solid var(--line)}
  .sw code{display:block;font-size:10px;color:#fff}
  .sw b{display:block;font-size:10px;color:var(--grey-lt);font-weight:400}
  .sw span{display:block;font-size:9.5px;color:var(--grey)}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:0 26px}

  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);font-size:10px}
  th{font-family:'Archivo';font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--red-light)}

  .heroes{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .heroes figure img{width:100%;border:1px solid var(--line)}
  .heroes figcaption{color:var(--grey);margin-top:5px;font-size:10px}
  .hero-wide{grid-column:1/-1}

  .cat{margin-bottom:20px;page-break-inside:avoid}
  .cat__head{display:flex;align-items:baseline;gap:9px;border-bottom:1px solid var(--line);
             padding-bottom:5px;margin-bottom:11px}
  .cat__head h3{font-size:14px;font-weight:800;text-transform:uppercase}
  .cat__head .n{color:var(--red-light);font-family:'Archivo';font-size:10px;font-weight:700}
  .cat__head .d{color:var(--grey);font-size:10px;margin-left:auto}

  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:11px}
  .it{background:var(--card);border:1px solid var(--line);padding:9px;page-break-inside:avoid}
  .it img{width:100%;height:132px;object-fit:contain;background:var(--card)}
  .it .nm{font-size:9.5px;font-weight:600;margin-top:5px;line-height:1.25}
  .it .sl{font-family:ui-monospace,monospace;font-size:8px;color:var(--grey);margin-top:2px;word-break:break-all}
  .empty{color:var(--grey);font-style:italic;font-size:10px}
</style>

<!-- ============================ COVER ============================ -->
<section class="page">
  <div class="eyebrow">Brand &amp; asset reference</div>
  <h1>Spartan</h1>
  <div class="rule"></div>
  <p class="lede">
    Visual reference for designing Spartan pages: the two logo lockups, the colour
    system with its measured contrast rules, the type pairing, the hero
    photography and all 72 catalogue products.
    <b>Every image here is a real Spartan asset</b> — nothing is a placeholder or
    a stand-in.
  </p>

  <h2>Logo — two lockups, not interchangeable</h2>
  <div class="logos">
    <div>
      <div class="logo"><img src="${asset('src/assets/brand/spartan-logo-light.svg')}"></div>
      <p class="cap"><code>spartan-logo-light.svg</code> — red helmet, <b>white</b> wordmark.
         Use on dark surfaces. The site is dark-first, so this is the usual one.</p>
    </div>
    <div>
      <div class="logo logo--light"><img src="${asset('src/assets/brand/spartan-logo.svg')}"></div>
      <p class="cap"><code>spartan-logo.svg</code> — red helmet, <b>black</b> wordmark.
         Use on light surfaces only.</p>
    </div>
  </div>

  <p class="lede" style="margin-top:16px">
    Both are vector, extracted from the client's brochure — neither was redrawn.
    <b>Never recolour, redraw, distort, rotate or re-proportion either lockup.</b>
    Minimum rendered height 28px. Clear space on all sides equals half the helmet
    height. Putting the dark lockup on a dark surface makes the wordmark invisible —
    that is a real bug that has happened here before.
  </p>
</section>

<!-- ============================ COLOUR ============================ -->
<section class="page">
  <div class="eyebrow">Foundations</div>
  <h2 style="font-size:26px;margin:8px 0 4px">Colour</h2>
  <div class="rule"></div>
  <p class="lede">
    Every value sampled from the brochure. Spartan has <b>four reds</b> and they are
    not interchangeable — one red cannot clear WCAG AA on every surface, so the
    correct one depends on where it sits and how big it is.
  </p>

  <div class="cols">
    <div>
      ${swatch('--color-red', '#eb2927', 'Brand red. Large text, icons, rules, borders, fills.')}
      ${swatch('--color-red-fill', '#dd1e1c', 'Red SURFACES that carry white text.')}
      ${swatch('--color-red-dark', '#b81c1b', 'Hover state on a red fill.')}
      ${swatch('--color-red-light', '#ef3a38', 'Small red TEXT on a dark surface.')}
      ${swatch('--color-red-deep', '#970000', 'Small red TEXT on a light surface.')}
      ${swatch('--color-black', '#08080a', 'Page background.')}
      ${swatch('--color-panel', '#0e0e11', 'Alternating dark section.')}
    </div>
    <div>
      ${swatch('--color-card', '#151519', 'Dark card surface.')}
      ${swatch('--color-line', '#232329', 'Dark borders.')}
      ${swatch('--color-paper', '#f6f6f7', 'Light section background.')}
      ${swatch('--color-ink', '#0e0e11', 'Body text on light.')}
      ${swatch('--color-ink-muted', '#6a6a72', 'Muted text on light. 4.96:1 on paper.')}
      ${swatch('--color-grey', '#8a8a92', 'Muted text on DARK ONLY — 3.17:1 on paper, fails AA.')}
      ${swatch('--color-grey-lt', '#b4b4bc', 'Body text on dark.')}
    </div>
  </div>

  <h2 style="margin-top:20px">The rule that decides which red</h2>
  <table>
    <tr><th>Where it goes</th><th>Token</th></tr>
    <tr><td>Small red text on a dark surface</td><td><code>--color-red-light</code></td></tr>
    <tr><td>Small red text on a light surface</td><td><code>--color-red-deep</code></td></tr>
    <tr><td>A red surface carrying white text</td><td><code>--color-red-fill</code> (hover <code>--color-red-dark</code>)</td></tr>
    <tr><td>Large text, icons, rules, borders, decorative fills</td><td><code>--color-red</code></td></tr>
  </table>
  <p class="cap" style="margin-top:9px">
    "Large" means ≥24px, or ≥18.66px bold. <b>Bold alone does not make text large.</b>
    Brand red measures 4.23:1 on <code>--color-card</code> and 3.99:1 on
    <code>--color-paper</code> — both below the 4.5:1 AA floor for normal text.
  </p>
</section>

<!-- ============================ TYPE ============================ -->
<section class="page">
  <div class="eyebrow">Foundations</div>
  <h2 style="font-size:26px;margin:8px 0 4px">Typography</h2>
  <div class="rule"></div>
  <p class="lede">
    Two self-hosted variable families, each covering weight 100–900.
    <b>Archivo</b> for headings, eyebrows, buttons, numerals and table headers;
    <b>Inter</b> for paragraphs, specifications and form fields.
  </p>

  <div style="border:1px solid var(--line);padding:20px;margin-bottom:14px">
    <p class="cap">Archivo — display</p>
    <div style="font-family:'Archivo';font-weight:800;font-size:42px;text-transform:uppercase;letter-spacing:-0.035em;line-height:0.96;margin-top:8px">
      Home and Industrial<br><span style="color:var(--red)">Solutions.</span>
    </div>
    <div style="font-family:'Archivo';font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--red-light);margin-top:14px">
      Eyebrow label · uppercase · tracked
    </div>
  </div>

  <div style="border:1px solid var(--line);padding:20px">
    <p class="cap">Inter — body</p>
    <p style="margin-top:8px;max-width:70ch;color:var(--grey-lt);font-size:12px">
      Spartan supplies lighting, ventilation, water pumps and cables alongside a
      full safety range — head, eye and hearing protection, gloves, footwear,
      fall arrest and workwear. Durable, efficient and cost-effective products
      for residential, commercial and industrial markets.
    </p>
  </div>

  <p class="cap" style="margin-top:14px">
    Headings run weight 700–800 with <code>line-height:1.06</code> and
    <code>letter-spacing:-0.02em</code>. Uppercase is the house style for display
    type. Body copy on dark uses <code>--color-grey-lt</code>, never pure white at
    small sizes.
  </p>
</section>

<!-- ============================ IMAGERY ============================ -->
<section class="page">
  <div class="eyebrow">Assets</div>
  <h2 style="font-size:26px;margin:8px 0 4px">Photography</h2>
  <div class="rule"></div>
  <p class="lede">
    The hero is the product-range composition. The five division photographs are
    used as full-bleed section headers behind a dark scrim.
  </p>
  <div class="heroes">
    <figure class="hero-wide">
      <img src="${url('h/hero-desktop-poster.jpg')}">
      <figcaption>${heroes[0][1]} — 1168×784, the largest version that exists</figcaption>
    </figure>
    ${heroes
      .slice(1)
      .map(([f, cap]) => `<figure><img src="${url(`h/${f}`)}"><figcaption>${cap}</figcaption></figure>`)
      .join('')}
  </div>
</section>

${
  siteOk
    ? `
<!-- ============================ THE SITE ============================ -->
<section class="page">
  <div class="eyebrow">Reference</div>
  <h2 style="font-size:26px;margin:8px 0 4px">The current site</h2>
  <div class="rule"></div>
  <p class="lede">
    How the tokens, type and photography actually compose. Note the recurring
    moves: a full-bleed dark hero with the copy pulled hard left and clear of the
    product cluster, an uppercase Archivo eyebrow in
    <code>--color-red-light</code> above every section heading, one accent word in
    <code>--color-red</code>, cards on <code>--color-card</code> with
    <code>--color-line</code> borders, and a single solid
    <code>--color-red-fill</code> call to action per section.
  </p>
  <div class="heroes">
    <figure class="hero-wide">
      <img src="${url('s/home-desktop.jpg')}">
      <figcaption>${shots[0][4]}</figcaption>
    </figure>
    <figure>
      <img src="${url('s/category.jpg')}">
      <figcaption>${shots[2][4]}</figcaption>
    </figure>
    <figure>
      <img src="${url('s/product.jpg')}">
      <figcaption>${shots[3][4]}</figcaption>
    </figure>
    <figure>
      <img src="${url('s/home-mobile.jpg')}" style="max-height:520px;object-fit:contain;object-position:top">
      <figcaption>${shots[1][4]}</figcaption>
    </figure>
  </div>
</section>`
    : ''
}

<!-- ============================ PRODUCTS ============================ -->
<section class="page">
  <div class="eyebrow">Assets</div>
  <h2 style="font-size:26px;margin:8px 0 4px">Catalogue — 72 products</h2>
  <div class="rule"></div>
  <p class="lede">
    Every product, grouped by category. Source files are <b>transparent PNGs</b>
    (shown here on the card surface) at 100–440px native — small, and never to be
    upscaled beyond ~2×. Filenames are <code>src/assets/products/&lt;slug&gt;.png</code>
    by the slug shown under each item.
  </p>

  ${byCategory
    .map(
      (c) => `
    <div class="cat">
      <div class="cat__head">
        <h3>${c.name}</h3>
        <span class="n">${c.items.length}</span>
        <span class="d">${c.division}</span>
      </div>
      ${
        c.items.length === 0
          ? `<p class="empty">No products yet — this category is marked “expanding” and shows an honest empty state on the site. Do not invent products for it.</p>`
          : `<div class="grid">${c.items
              .map(
                (p) => `<div class="it">
                  <img src="${url(`p/${p.slug}.jpg`)}">
                  <div class="nm">${p.name}${p.variantLabel ? ` <span style="color:var(--red-light)">(${p.variantLabel})</span>` : ''}</div>
                  <div class="sl">${p.slug}</div>
                </div>`,
              )
              .join('')}</div>`
      }
    </div>`,
    )
    .join('')}
</section>
`;

const htmlPath = join(WORK, 'sheet.html');
writeFileSync(htmlPath, html);

/* ------------------------------------------------------------------- pdf -- */

console.log('rendering PDF…');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.pdf({
  path: OUT,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', bottom: '0', left: '0', right: '0' },
});

// `--png` also writes one screenshot per section beside the PDF. The PDF cannot
// be rasterised everywhere (poppler is not always installed), and a sheet whose
// layout was never looked at is not a sheet anyone should hand to a design tool.
if (process.argv.includes('--png')) {
  const dir = join(ROOT, 'brand-sheet-preview');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  await page.setViewportSize({ width: 794, height: 1123 }); // A4 at 96dpi
  const sections = await page.locator('section.page').all();
  for (const [i, s] of sections.entries()) {
    await s.screenshot({ path: join(dir, `section-${i + 1}.png`) });
  }
  console.log(`wrote ${sections.length} section previews to ${dir}`);
}

await browser.close();

rmSync(WORK, { recursive: true, force: true });

const mb = statSync(OUT).size / 1024 / 1024;
console.log(`\n${OUT}`);
console.log(`${mb.toFixed(2)} MB — ${mb < 20 ? 'under the 20 MB limit' : '*** OVER 20 MB ***'}`);
