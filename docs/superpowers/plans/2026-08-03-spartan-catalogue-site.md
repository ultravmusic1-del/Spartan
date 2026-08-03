# Spartan Catalogue Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, catalogue-style marketing site for Spartan presenting 72 products across 15 categories in two divisions, with a multi-product enquiry basket, architected so a database-backed admin can replace the JSON data source by changing one module.

**Architecture:** Astro 5 static output. Product data lives in JSON, is validated by Zod through Astro's Content Layer, and is read **exclusively** through a repository module (`src/lib/catalog.ts`) — that indirection is the seam a future admin plugs into. Interactive pieces (mobile nav, enquiry basket, catalogue filters) are Preact islands; everything else ships zero JS. The enquiry endpoint is the only server-rendered route.

**Tech Stack:** Astro 7, TypeScript (strict), Tailwind CSS 4, Preact, nanostores, Zod, Resend, Vitest 4, Playwright.

> **Revised 2026-08-03 during Task 1.** This plan originally specified Astro 5. `npm audit` on the installed tree reported 8 high-severity XSS advisories against `astro <= 7.0.9` (`define:vars`, unescaped slot names, spread attribute names, `transition:*` directives on hydrated islands), plus an unauthenticated path override in `@astrojs/vercel` via `x-astro-path`. 5.18.2 is the newest 5.x and there is no in-major fix — the advisories resolve only at `astro@7.1.6` / `@astrojs/vercel@11`. Everything this plan depends on (static output with per-route `prerender = false`, the Content Layer API with `file()` loaders, Tailwind 4 via the Vite plugin) is supported in Astro 7. Upgrading at one page is far cheaper than at 74.

**Spec:** `docs/superpowers/specs/2026-08-03-spartan-catalogue-design.md`

**Visual source of truth:** `design/direction-b-forge.html` — the approved, fully-rendered "Forge" mockup. It contains the exact CSS values, section order and markup structure for every section. Tasks below reference it by section. Treat it as the design comp, not as code to copy verbatim.

**Reference assets already produced (do not regenerate by hand):**
- `design/assets/brand/spartan-logo.svg` — dark wordmark, for light backgrounds
- `design/assets/brand/spartan-logo-light.svg` — white wordmark, for dark backgrounds
- `design/assets/products/*.png` — 72 transparent product cutouts
- `design/assets/hero/*.jpg` — 5 section photographs, text overlays removed
- `design/assets/fonts/*.woff2` — Archivo + Inter variable fonts

---

## File Structure

```
tools/                          asset + data extraction (run on demand, not at build)
  extract-catalog.mjs           brochure -> products.json + product PNGs
  extract-logo.mjs              brochure -> both logo lockups
  extract-heroes.mjs            brochure -> section photographs
  lib/pdf.mjs                   shared mupdf helpers (clip forwarding, column assignment)

src/
  data/
    divisions.json              2 records
    categories.json             15 records
    products.json               72 records
  content.config.ts             Content Layer collections + Zod schemas
  lib/
    catalog.ts                  THE SEAM — every content read goes through here
    catalog.test.ts
    enquiry-schema.ts           shared client/server validation
    enquiry-schema.test.ts
    seo.ts                      JSON-LD builders
  stores/
    enquiry.ts                  persistent basket store
    enquiry.test.ts
  styles/
    tokens.css                  design tokens as CSS custom properties
    fonts.css                   @font-face declarations
    global.css                  resets + base element styles
  components/
    primitives/                 Eyebrow, SolidButton, PillButton, SectionHeading, Chevron
    layout/                     Header, UtilityBar, Nav, MobileNav.tsx, Footer
    catalog/                    ProductCard, CategoryTile, ProductGrid, SpecTable, En388Table
    catalog/CatalogueFilters.tsx
    enquiry/                    EnquiryButton.tsx, EnquiryDrawer.tsx, EnquiryForm.tsx, EnquiryBadge.tsx
    sections/                   Hero, About, ServiceCards, TrustBand, CategoryGrid, Spotlight, Faq, EnquiryCta
    Seo.astro
  layouts/
    BaseLayout.astro
  pages/
    index.astro
    about.astro
    why-spartan.astro
    industries.astro
    contact.astro
    enquiry.astro
    electricals.astro
    safety.astro
    catalogue/index.astro
    catalogue/[category].astro
    products/[slug].astro
    api/enquiry.ts              prerender = false
    404.astro
tests/e2e/                      Playwright specs
```

---

## Phase 0 — Foundation

### Task 1: Repository and Astro scaffold

**Files:**
- Create: `.gitignore`, `package.json`, `astro.config.mjs`, `tsconfig.json`

- [ ] **Step 1: Initialise the repository**

The project directory is not yet a git repo. From `C:\Users\Vivaan\Desktop\spartan`:

```bash
git init -b main
```

- [ ] **Step 2: Create .gitignore**

Create `.gitignore`:

```
node_modules/
dist/
.astro/
.vercel/
.env
.env.production
*.log
.DS_Store
test-results/
playwright-report/
```

- [ ] **Step 3: Scaffold Astro**

```bash
npm create astro@latest . -- --template minimal --typescript strict --no-install --no-git --skip-houston
```

If the CLI refuses because the directory is non-empty, answer yes to continue — `design/` and `docs/` must be preserved.

- [ ] **Step 4: Install dependencies**

```bash
npm install astro@^7 @astrojs/preact@^6 @astrojs/sitemap@^3 @astrojs/vercel@^11 preact@^10 nanostores@^0.11 @nanostores/persistent@^0.10 @nanostores/preact@^0.5 zod@^3 resend@^4 tailwindcss@^4 @tailwindcss/vite@^4
npm install -D vitest@^4 @playwright/test@^1 prettier prettier-plugin-astro
```

After installing, `npm audit` must report **0 critical**. Three high findings are expected and accepted — see below. Any *other* high finding means stop and report rather than proceeding.

#### Accepted risk: `path-to-regexp@6.1.0` (ReDoS, CVSS 7.5)

Reached only via `@astrojs/vercel@11.0.4 → @vercel/routing-utils@5.3.3 → path-to-regexp@6.1.0`. The three high findings are this one chain re-reported.

Accepted, because:

- **No upstream fix exists at any version.** `@vercel/routing-utils` deliberately declares both copies — `"path-to-regexp-updated": "npm:path-to-regexp@6.3.0"` alongside `"path-to-regexp": "6.1.0"` — as of its newest release. Upgrading the adapter cannot resolve it.
- **npm's only offered fix is a major downgrade** to `@astrojs/vercel@8`, which reintroduces the eight XSS advisories this upgrade cleared. Never run `npm audit fix --force` in this repo.
- **Exposure is build-time and inputs are static.** The package converts *our own* authored route patterns into `.vercel/output/config.json`. ReDoS requires attacker-controlled patterns; no user input reaches it.
- **An `overrides` pin to 6.3.0 was considered and rejected.** Vercel's deliberate dual-dependency implies something relies on 6.1.0 semantics, and 6.3.0 changed regex generation — risking silent route-matching breakage in production, a worse outcome than a theoretical build-time ReDoS.

Re-evaluate if the adapter ever processes user-supplied route patterns, or if Vercel drops the 6.1.0 dependency.

#### Note for any future dependency upgrade in this repo

Installing over an existing tree can leave stale hoisted transitive packages that surface as phantom advisories. If an upgrade leaves findings that look upstream, delete `node_modules/` and `package-lock.json` and reinstall before investigating further.

- [ ] **Step 5: Configure Astro**

Replace `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://spartan.example',
  output: 'static',
  adapter: vercel(),
  integrations: [preact({ compat: false }), sitemap()],
  vite: { plugins: [tailwind()] },
});
```

`site` is a placeholder until the domain is confirmed (spec §12.4). Sitemap and canonical URLs depend on it.

- [ ] **Step 6: Verify the dev server boots**

```bash
npm run dev
```

Expected: server starts on `http://localhost:4321` with no errors. Stop it with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: scaffold Astro project with Tailwind, Preact and Vercel adapter

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Design tokens, fonts and base styles

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/fonts.css`, `src/styles/global.css`
- Move: `design/assets/fonts/*.woff2` → `public/fonts/`

- [ ] **Step 1: Move the font files**

```bash
mkdir -p public/fonts
cp design/assets/fonts/archivo-400.woff2 public/fonts/archivo-variable.woff2
cp design/assets/fonts/inter-400.woff2 public/fonts/inter-variable.woff2
```

The `-400` filenames are misleading — each file is the full variable font covering weights 100–900. Renaming avoids that trap.

- [ ] **Step 2: Create src/styles/fonts.css**

```css
/* One variable file per family covers the entire weight range.
   Declaring discrete font-weight values against the same file collapses
   every weight to a single rendered weight — the range form is required. */
@font-face {
  font-family: 'Archivo';
  font-style: normal;
  font-weight: 100 900;
  font-stretch: 100%;
  font-display: swap;
  src: url('/fonts/archivo-variable.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/inter-variable.woff2') format('woff2');
}
```

- [ ] **Step 3: Create src/styles/tokens.css**

Values are sampled from the brochure — do not substitute approximations.

```css
:root {
  --color-red: #eb2927;
  --color-red-dark: #b81c1b;
  --color-red-deep: #970000;

  --color-black: #08080a;
  --color-panel: #0e0e11;
  --color-card: #151519;
  --color-line: #232329;

  --color-paper: #f6f6f7;
  --color-paper-line: #e4e4e7;
  --color-ink: #0e0e11;

  --color-grey: #8a8a92;
  --color-grey-lt: #b4b4bc;

  --font-display: 'Archivo', system-ui, sans-serif;
  --font-body: 'Inter', system-ui, sans-serif;

  --wrap-max: 1240px;
  --wrap-pad: 32px;

  --dur-fast: 150ms;
  --dur-base: 220ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
}

@media (max-width: 640px) {
  :root { --wrap-pad: 20px; }
}
```

- [ ] **Step 4: Create src/styles/global.css**

```css
@import 'tailwindcss';
@import './fonts.css';
@import './tokens.css';

@theme inline {
  --color-brand: var(--color-red);
  --color-brand-dark: var(--color-red-dark);
  --color-brand-deep: var(--color-red-deep);
  --font-display: var(--font-display);
  --font-body: var(--font-body);
}

*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; padding: 0; }

body {
  font-family: var(--font-body);
  background: var(--color-black);
  color: #fff;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.06;
  letter-spacing: -0.02em;
}

a { color: inherit; text-decoration: none; }
img, svg { display: block; max-width: 100%; }

:focus-visible {
  outline: 2px solid var(--color-red);
  outline-offset: 3px;
}

.wrap {
  max-width: var(--wrap-max);
  margin-inline: auto;
  padding-inline: var(--wrap-pad);
}

/* Small red text fails AA on light backgrounds (4.30:1).
   Light sections must use the deep red (9.09:1). See spec section 2. */
.on-light .text-brand { color: var(--color-red-deep); }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 5: Create the base layout**

Create `src/layouts/BaseLayout.astro`:

```astro
---
import '../styles/global.css';
interface Props { title: string; description: string; }
const { title, description } = Astro.props;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="preload" href="/fonts/archivo-variable.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/fonts/inter-variable.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="canonical" href={new URL(Astro.url.pathname, Astro.site)} />
  </head>
  <body>
    <a href="#main" class="sr-only focus:not-sr-only">Skip to content</a>
    <slot />
  </body>
</html>
```

- [ ] **Step 6: Verify tokens render**

Replace `src/pages/index.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Spartan" description="Home and industrial solutions">
  <main id="main" class="wrap" style="padding-block:80px">
    <h1 style="font-size:64px;text-transform:uppercase">
      <span style="color:var(--color-red);display:block">Industrial</span>
      <span style="display:block">Solutions.</span>
    </h1>
  </main>
</BaseLayout>
```

Run `npm run dev` and open `http://localhost:4321`.
Expected: "INDUSTRIAL" in Spartan red above "SOLUTIONS." in white on near-black, both in Archivo at weight 700. If both lines render in the same weight as body text, the `@font-face` weight range is wrong.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add design tokens, self-hosted variable fonts and base layout

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — Data layer

### Task 3: Promote the extraction tooling

The extraction scripts currently live in a scratch directory. They encode two non-obvious behaviours that must survive (spec §8): forwarding the PDF clip stack, and same-column image assignment.

**Files:**
- Create: `tools/lib/pdf.mjs`, `tools/extract-catalog.mjs`, `tools/extract-logo.mjs`, `tools/extract-heroes.mjs`, `tools/README.md`

- [ ] **Step 1: Install the PDF toolchain as a dev dependency**

```bash
npm install -D mupdf@^1.26
```

- [ ] **Step 2: Create tools/lib/pdf.mjs**

```js
import * as mupdf from 'mupdf';

export const PAGE_W = 612.288;
export const PAGE_H = 858.898;

/** Colour roles used by the brochure's type system. */
export const ROLE_BY_HEX = {
  '#eb2927': 'section',
  '#970000': 'product',
  '#7f7f7f': 'spec',
  '#979797': 'pagelabel',
};

export const toHex = (c) =>
  c ? '#' + c.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('') : '#000000';

/** Rect of a unit image placed by `ctm`. */
export function placedRect(ctm) {
  const xs = [ctm[4], ctm[0] + ctm[4], ctm[2] + ctm[4], ctm[0] + ctm[2] + ctm[4]];
  const ys = [ctm[5], ctm[1] + ctm[5], ctm[3] + ctm[5], ctm[1] + ctm[3] + ctm[5]];
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => +v.toFixed(1));
}

export const centre = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];

export const rectOverlap = (a, b) =>
  Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
  Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));

export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Render only `keepImages` onto a transparent pixmap.
 *
 * CRITICAL: brochure product photos are rectangles with opaque BLACK
 * backgrounds that the layout knocks out with clipImageMask. Every clip,
 * mask and group push must be forwarded together with its matching pop, or
 * the cutout is lost and each product renders inside a black box. Only the
 * *fill* operations are filtered.
 */
export function renderImagesOnly(page, box, scale, keepImages) {
  const w = box[2] - box[0];
  const h = box[3] - box[1];
  const pix = new mupdf.Pixmap(
    mupdf.ColorSpace.DeviceRGB,
    [0, 0, Math.round(w * scale), Math.round(h * scale)],
    true,
  );
  pix.clear();
  const draw = new mupdf.DrawDevice(mupdf.Matrix.identity, pix);
  const shift = mupdf.Matrix.translate(-box[0], -box[1]);

  const isKept = (ctm) => {
    const r = placedRect(ctm);
    const pageSpace = [
      r[0] / scale + box[0], r[1] / scale + box[1],
      r[2] / scale + box[0], r[3] / scale + box[1],
    ];
    return keepImages.some((k) => k.bbox.every((v, i) => Math.abs(v - pageSpace[i]) < 1.2));
  };

  const filter = new mupdf.Device({
    fillImage(im, ctm, alpha) { if (isKept(ctm)) draw.fillImage(im, ctm, alpha ?? 1); },
    fillImageMask(im, ctm, cs, color, alpha) { if (isKept(ctm)) draw.fillImageMask(im, ctm, cs, color, alpha ?? 1); },
    clipPath(p, eo, ctm) { draw.clipPath(p, eo, ctm); },
    clipStrokePath(p, st, ctm) { draw.clipStrokePath(p, st, ctm); },
    clipText(t, ctm) { draw.clipText(t, ctm); },
    clipStrokeText(t, st, ctm) { draw.clipStrokeText(t, st, ctm); },
    clipImageMask(im, ctm) { draw.clipImageMask(im, ctm); },
    popClip() { draw.popClip(); },
    beginMask(a, l, cs, c) { draw.beginMask(a, l, cs, c); },
    endMask() { draw.endMask(); },
    beginGroup(a, cs, i, k, b, al) { draw.beginGroup(a, cs, i, k, b, al); },
    endGroup() { draw.endGroup(); },
  });

  page.run(filter, mupdf.Matrix.concat(shift, mupdf.Matrix.scale(scale, scale)));
  filter.close();
  draw.close();
  return pix;
}

/**
 * Assign each in-page image to the nearest product name *in the same column*.
 * Cross-column assignment mixes products up on two-column pages — e.g. the
 * orange vests migrate to the green-vest entry on page 19.
 */
export function assignImagesToProducts(images, products) {
  const MID = PAGE_W / 2;
  const col = (x) => (x < MID ? 0 : 1);
  const twoCol =
    products.some((p) => centre(p.nameBox)[0] >= MID) &&
    products.some((p) => centre(p.nameBox)[0] < MID);

  for (const im of images) {
    const ic = centre(im.bbox);
    let best = null;
    let bestD = Infinity;
    for (const p of products) {
      const c = centre(p.nameBox);
      if (twoCol && col(ic[0]) !== col(c[0])) continue;
      const d = Math.hypot(ic[0] - c[0], ic[1] - c[1]);
      if (d < bestD) { bestD = d; best = p; }
    }
    if (best && bestD < 320) best.images.push(im);
  }
  return products;
}
```

- [ ] **Step 3: Port the three extraction scripts**

Working, verified versions of these scripts are already committed at `tools/_source/`. They produced the assets in `design/assets/`, so they are known-good — refactor them, do not rewrite from scratch:

| Source (committed) | Becomes | Writes |
|---|---|---|
| `tools/_source/extract-catalog.source.mjs` | `tools/extract-catalog.mjs` | `src/data/products.raw.json`, `src/assets/products/*.png` |
| `tools/_source/extract-logo-dark.source.mjs` + `extract-logo-light.source.mjs` | `tools/extract-logo.mjs` | `src/assets/brand/spartan-logo.svg`, `spartan-logo-light.svg` |
| `tools/_source/extract-heroes.source.mjs` | `tools/extract-heroes.mjs` | `src/assets/hero/*.jpg` |

Refactoring to do in each:
1. Replace the hard-coded PDF path and output directory with `process.argv[2]` (defaulting to `./brochure.pdf`) and a path relative to the repo root.
2. Import `renderImagesOnly`, `assignImagesToProducts`, `placedRect`, `centre`, `slugify` and `ROLE_BY_HEX` from `tools/lib/pdf.mjs` instead of redefining them inline.
3. Keep every other behaviour byte-for-byte — particularly the clip forwarding and the same-column assignment.

Delete `tools/_source/` once the refactored scripts reproduce 72 product PNGs.

- [ ] **Step 4: Add npm scripts**

Add to `package.json` `"scripts"`:

```json
"extract:catalog": "node tools/extract-catalog.mjs",
"extract:logo": "node tools/extract-logo.mjs",
"extract:heroes": "node tools/extract-heroes.mjs"
```

- [ ] **Step 5: Write tools/README.md**

```markdown
# Extraction tooling

Regenerates site assets from the Spartan brochure PDF. Run only when the
brochure is revised — output is committed, so a normal build never runs these.

    npm run extract:catalog -- "path/to/brochure.pdf"
    npm run extract:logo    -- "path/to/brochure.pdf"
    npm run extract:heroes  -- "path/to/brochure.pdf"

## Two things that will silently break if changed

1. **Clip forwarding.** Product photos are rectangles with opaque black
   backgrounds, knocked out by `clipImageMask`. Forward every clip/mask/group
   push AND its matching pop; filter only fill operations. Dropping clips
   yields products inside black boxes — which looks fine on white pages and
   catastrophic on the dark layout.

2. **Same-column image assignment.** Products are matched to the nearest image
   within their own page column. Nearest-overall assignment swaps images
   between the left and right columns of two-column pages.
```

- [ ] **Step 6: Verify the pipeline reproduces the known-good output**

```bash
npm run extract:catalog -- "C:/Users/Vivaan/Downloads/08012026-001 - Spartan Brochure.pdf"
```

Expected: `products with composited images: 72`, and `src/assets/products/` contains 72 PNGs.

Verify a composite and a transparency case:

```bash
node -e "const s=require('sharp');s('src/assets/products/p19-full-body-harness.png').metadata().then(m=>console.log(m.width,m.height,m.hasAlpha))"
```

Expected: alpha `true`. Confirm the corner pixel is fully transparent (`[0,0,0,0]`), not opaque black — opaque black means clip forwarding regressed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add brochure extraction tooling for products, logos and photography

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Content schemas

**Files:**
- Create: `src/content.config.ts`, `src/data/divisions.json`, `src/data/categories.json`, `src/data/products.json`

**True product distribution, counted from the extracted data (72 total).** Use these; earlier drafts of this plan said 74, which double-counted two "RESISTANCE SPECIFICATIONS" table headings as products.

| Category | Count | Brochure source |
|---|---|---|
| Lighting | 10 | p4 (7) + p5 (3) |
| Fans & Ventilation | 4 | p10 |
| Water Pumps & Controls | 3 | p11 — Pumps, FS-15 Float Switch, PC-10 Controller |
| Insect Killers | 1 | p6 |
| Cables | 1 | p8 |
| Electrical Accessories | 0 | — expanding |
| Head & Face Protection | 7 | p15 |
| Eye Protection | 6 | p13 |
| Hearing Protection | 6 | p14 |
| Hand Protection | 11 | p16 (4) + p17 (4) + p18 (3) |
| Safety Footwear | 8 | p20 (6) + p21 (2) |
| Harnesses & Fall Arrest | 2 | p19 — Full Body Harness, Lightweight Web Straps |
| Body Protection | 4 | p19 — Safety Vests ×2, Welding Apron, Disposable Coverall |
| Workwear | 9 | p23 (6) + p24 (3) |
| Spill Control | 0 | — expanding |

Electricals division total: **19**. Safety division total: **53**.

- [ ] **Step 1: Author divisions.json**

```json
[
  {
    "id": "electricals",
    "slug": "electricals",
    "name": "Spartan Electricals",
    "blurb": "Lighting, ventilation, water management and electrical controls for residential, commercial and industrial spaces.",
    "heroImage": "electrical.jpg",
    "order": 1
  },
  {
    "id": "safety",
    "slug": "safety",
    "name": "Spartan Safety",
    "blurb": "Certified personal protective equipment and workwear engineered for real working conditions on site.",
    "heroImage": "safety.jpg",
    "order": 2
  }
]
```

- [ ] **Step 2: Author categories.json**

15 records. Every `description` is drawn from brochure wording — invent nothing.

```json
[
  { "id": "lighting", "slug": "lighting", "name": "Lighting", "divisionId": "electricals", "description": "Interior, industrial and outdoor LED — bulbs, panels, tubes, floodlights, highbays and solar.", "heroProductSlug": "led-bulbs", "status": "active", "order": 1 },
  { "id": "fans", "slug": "fans-ventilation", "name": "Fans & Ventilation", "divisionId": "electricals", "description": "100% copper motor ventilation fans from 4\" to 14\", built for quiet continuous duty.", "heroProductSlug": "ventilation-fans-6-8-10-inch", "status": "active", "order": 2 },
  { "id": "pumps", "slug": "water-pumps", "name": "Water Pumps & Controls", "divisionId": "electricals", "description": "Die-cast aluminium pumps with thermal overload protection, controllers and float switches.", "heroProductSlug": "pumps", "status": "active", "order": 3 },
  { "id": "insect", "slug": "insect-killers", "name": "Insect Killers", "divisionId": "electricals", "description": "Chemical-free ABS fire-retardant insect control, 20–40W.", "heroProductSlug": "insect-killer", "status": "active", "order": 4 },
  { "id": "cables", "slug": "cables", "name": "Cables", "divisionId": "electricals", "description": "Network and installation cable.", "heroProductSlug": "premium-network-cable", "status": "active", "order": 5 },
  { "id": "accessories", "slug": "electrical-accessories", "name": "Electrical Accessories", "divisionId": "electricals", "description": "Our electrical accessories range is expanding. Contact us for current availability and lead times.", "heroProductSlug": null, "status": "expanding", "order": 6 },
  { "id": "head", "slug": "head-face-protection", "name": "Head & Face Protection", "divisionId": "safety", "description": "HDPE helmets with 6-point ratchet suspension, visors, brow guards and welding masks.", "heroProductSlug": "safety-helmets", "status": "active", "order": 7 },
  { "id": "eye", "slug": "eye-protection", "name": "Eye Protection", "divisionId": "safety", "description": "Polycarbonate goggles, glasses, over-glasses and welding goggles.", "heroProductSlug": "safety-goggles-indirect-vent", "status": "active", "order": 8 },
  { "id": "hearing", "slug": "hearing-protection", "name": "Hearing Protection", "divisionId": "safety", "description": "Ear plugs and muffs up to SNR 37dB / NRR 32dB.", "heroProductSlug": "ear-muff-nrr-25db", "status": "active", "order": 9 },
  { "id": "hand", "slug": "hand-protection", "name": "Hand Protection", "divisionId": "safety", "description": "Cut, chemical and impact rated gloves — PU, nitrile, latex and leather, sizes 7–12.", "heroProductSlug": "grip-guard-gp3", "status": "active", "order": 10 },
  { "id": "foot", "slug": "safety-footwear", "name": "Safety Footwear", "divisionId": "safety", "description": "Steel and composite toe caps, EUR 36–48, from low-cut trainers to rigger and gum boots.", "heroProductSlug": "low-cut-safety-shoes-kpu", "status": "active", "order": 11 },
  { "id": "harness", "slug": "fall-arrest", "name": "Harnesses & Fall Arrest", "divisionId": "safety", "description": "Full body harness and lightweight web straps.", "heroProductSlug": "full-body-harness", "status": "active", "order": 12 },
  { "id": "body", "slug": "body-protection", "name": "Body Protection", "divisionId": "safety", "description": "Hi-viz vests, disposable coveralls and leather welding aprons.", "heroProductSlug": "safety-vests-velcro", "status": "active", "order": 13 },
  { "id": "workwear", "slug": "workwear", "name": "Workwear", "divisionId": "safety", "description": "Fire retardant shirts, pants, coveralls, jackets and rain suits.", "heroProductSlug": "winter-jacket", "status": "active", "order": 14 },
  { "id": "spill", "slug": "spill-control", "name": "Spill Control", "divisionId": "safety", "description": "Our spill control range is expanding. Contact us for current availability and lead times.", "heroProductSlug": null, "status": "expanding", "order": 15 }
]
```

- [ ] **Step 3: Generate products.json from the raw extraction**

Write `tools/normalise-products.mjs` that reads `src/data/products.raw.json` and emits `src/data/products.json`, applying the disambiguation table from spec §4 and the `dispsenser` → `Dispenser` typo fix. It must fail loudly on a duplicate slug:

```js
const slugs = new Set();
for (const p of out) {
  if (slugs.has(p.slug)) throw new Error(`Duplicate slug: ${p.slug}`);
  slugs.add(p.slug);
}
```

Run it, then verify:

```bash
node -e "const p=require('./src/data/products.json');console.log(p.length, new Set(p.map(x=>x.slug)).size)"
```

Expected: `72 72`.

- [ ] **Step 4: Write the failing schema test**

Create `src/content.config.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { productSchema, categorySchema, divisionSchema } from './content.config';
import products from './data/products.json';
import categories from './data/categories.json';
import divisions from './data/divisions.json';

describe('content data', () => {
  it('every division validates', () => {
    for (const d of divisions) expect(() => divisionSchema.parse(d)).not.toThrow();
  });

  it('every category validates and points at a real division', () => {
    const ids = new Set(divisions.map((d) => d.id));
    for (const c of categories) {
      expect(() => categorySchema.parse(c)).not.toThrow();
      expect(ids.has(c.divisionId)).toBe(true);
    }
  });

  it('every product validates and points at a real category', () => {
    const ids = new Set(categories.map((c) => c.id));
    for (const p of products) {
      expect(() => productSchema.parse(p)).not.toThrow();
      expect(ids.has(p.categoryId)).toBe(true);
    }
  });

  it('product slugs are unique', () => {
    const slugs = products.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every category hero product exists, except expanding categories', () => {
    const slugs = new Set(products.map((p) => p.slug));
    for (const c of categories) {
      if (c.status === 'expanding') expect(c.heroProductSlug).toBeNull();
      else expect(slugs.has(c.heroProductSlug!)).toBe(true);
    }
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

```bash
npx vitest run src/content.config.test.ts
```

Expected: FAIL — `content.config` has no exported `productSchema`.

- [ ] **Step 6: Write src/content.config.ts**

```ts
import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

export const divisionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  blurb: z.string(),
  heroImage: z.string(),
  order: z.number().int(),
});

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  divisionId: z.string(),
  description: z.string(),
  heroProductSlug: z.string().nullable(),
  status: z.enum(['active', 'expanding']),
  order: z.number().int(),
});

export const productSchema = z.object({
  slug: z.string(),
  name: z.string(),
  categoryId: z.string(),
  images: z.array(z.string()).min(1),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  en388: z
    .object({
      abrasion: z.string(),
      bladeCut: z.string(),
      tear: z.string(),
      puncture: z.string(),
      tdmCut: z.string(),
    })
    .optional(),
  variants: z.array(z.string()).optional(),
  status: z.enum(['published', 'draft']).default('published'),
  sourcePage: z.number().int(),
  order: z.number().int(),
});

// The loader is the swap point. Replacing `file()` with a database loader
// migrates the whole site to a CMS without touching catalog.ts or any page.
export const collections = {
  divisions: defineCollection({ loader: file('src/data/divisions.json', { parser: (t) => JSON.parse(t) }), schema: divisionSchema }),
  categories: defineCollection({ loader: file('src/data/categories.json', { parser: (t) => JSON.parse(t) }), schema: categorySchema }),
  products: defineCollection({ loader: file('src/data/products.json', { parser: (t) => JSON.parse(t) }), schema: productSchema }),
};
```

- [ ] **Step 7: Run the test to verify it passes**

```bash
npx vitest run src/content.config.test.ts
```

Expected: 5 tests PASS. If the hero-product test fails, a `heroProductSlug` in `categories.json` does not match a slug produced by `normalise-products.mjs` — fix the JSON, not the test.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add content collections with Zod schemas and validated catalogue data

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The catalog repository — the admin seam

**Files:**
- Create: `src/lib/catalog.ts`, `src/lib/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getDivisions, getDivision, getCategories, getCategory,
  getProducts, getProduct, getRelatedProducts, searchProducts,
} from './catalog';

describe('catalog repository', () => {
  it('returns both divisions in order', async () => {
    const d = await getDivisions();
    expect(d.map((x) => x.id)).toEqual(['electricals', 'safety']);
  });

  it('finds a division by slug', async () => {
    expect((await getDivision('safety'))?.name).toBe('Spartan Safety');
  });

  it('returns undefined for an unknown division', async () => {
    expect(await getDivision('nope')).toBeUndefined();
  });

  it('returns all 15 categories ordered', async () => {
    const c = await getCategories();
    expect(c).toHaveLength(15);
    expect(c.map((x) => x.order)).toEqual([...c.map((x) => x.order)].sort((a, b) => a - b));
  });

  it('filters categories by division', async () => {
    const c = await getCategories({ divisionId: 'electricals' });
    expect(c).toHaveLength(6);
    expect(c.every((x) => x.divisionId === 'electricals')).toBe(true);
  });

  it('returns all 72 products', async () => {
    expect(await getProducts()).toHaveLength(72);
  });

  it('filters products by category', async () => {
    const p = await getProducts({ categoryId: 'hand' });
    expect(p).toHaveLength(11);
  });

  it('filters products by division across its categories', async () => {
    const p = await getProducts({ divisionId: 'electricals' });
    expect(p.length).toBe(19);
  });

  it('computes productCount on categories', async () => {
    const c = await getCategory('hand-protection');
    expect(c?.productCount).toBe(11);
  });

  it('reports zero products for the expanding category', async () => {
    const c = await getCategory('spill-control');
    expect(c?.productCount).toBe(0);
    expect(c?.status).toBe('expanding');
  });

  it('finds a product by slug', async () => {
    expect((await getProduct('safety-helmets'))?.name).toBe('Safety Helmets');
  });

  it('returns related products from the same category, excluding itself', async () => {
    const r = await getRelatedProducts('grip-guard-gp3', 3);
    expect(r).toHaveLength(3);
    expect(r.every((p) => p.categoryId === 'hand')).toBe(true);
    expect(r.some((p) => p.slug === 'grip-guard-gp3')).toBe(false);
  });

  it('searches by name case-insensitively', async () => {
    const r = await searchProducts('HELMET');
    expect(r.some((p) => p.slug === 'safety-helmets')).toBe(true);
  });

  it('excludes draft products from every read', async () => {
    const all = await getProducts();
    expect(all.every((p) => p.status === 'published')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/lib/catalog.test.ts
```

Expected: FAIL — cannot resolve `./catalog`.

- [ ] **Step 3: Write src/lib/catalog.ts**

```ts
import { getCollection, getEntry } from 'astro:content';
import type { z } from 'astro:content';
import type { productSchema, categorySchema, divisionSchema } from '../content.config';

export type Division = z.infer<typeof divisionSchema>;
export type Product = z.infer<typeof productSchema>;
export type Category = z.infer<typeof categorySchema> & { productCount: number };

const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

/**
 * Every content read in the site funnels through this module. Pages and
 * components must never import JSON or call getCollection directly — that
 * indirection is what lets the data source become a database later.
 */

export async function getDivisions(): Promise<Division[]> {
  const rows = await getCollection('divisions');
  return rows.map((r) => r.data).sort(byOrder);
}

export async function getDivision(slug: string): Promise<Division | undefined> {
  return (await getDivisions()).find((d) => d.slug === slug);
}

async function publishedProducts(): Promise<Product[]> {
  const rows = await getCollection('products');
  return rows.map((r) => r.data).filter((p) => p.status === 'published').sort(byOrder);
}

export async function getCategories(
  opts: { divisionId?: string; status?: Category['status'] } = {},
): Promise<Category[]> {
  const rows = await getCollection('categories');
  const products = await publishedProducts();
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);

  return rows
    .map((r) => ({ ...r.data, productCount: counts.get(r.data.id) ?? 0 }))
    .filter((c) => (opts.divisionId ? c.divisionId === opts.divisionId : true))
    .filter((c) => (opts.status ? c.status === opts.status : true))
    .sort(byOrder);
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return (await getCategories()).find((c) => c.slug === slug);
}

export async function getProducts(
  opts: { categoryId?: string; divisionId?: string; limit?: number } = {},
): Promise<Product[]> {
  let products = await publishedProducts();

  if (opts.divisionId) {
    const cats = await getCategories({ divisionId: opts.divisionId });
    const ids = new Set(cats.map((c) => c.id));
    products = products.filter((p) => ids.has(p.categoryId));
  }
  if (opts.categoryId) products = products.filter((p) => p.categoryId === opts.categoryId);
  return opts.limit ? products.slice(0, opts.limit) : products;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return (await publishedProducts()).find((p) => p.slug === slug);
}

export async function getRelatedProducts(slug: string, limit = 4): Promise<Product[]> {
  const product = await getProduct(slug);
  if (!product) return [];
  const siblings = await getProducts({ categoryId: product.categoryId });
  return siblings.filter((p) => p.slug !== slug).slice(0, limit);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const products = await publishedProducts();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.specs.some((s) => s.value.toLowerCase().includes(q)),
  );
}
```

- [ ] **Step 4: Configure Vitest for Astro**

Create `vitest.config.ts`:

```ts
import { getViteConfig } from 'astro/config';

export default getViteConfig({ test: { globals: true, environment: 'node' } });
```

`getViteConfig` is required — without it the `astro:content` virtual module cannot resolve and every test fails at import.

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx vitest run src/lib/catalog.test.ts
```

Expected: 14 tests PASS. If the electricals product count assertion fails, count the products actually assigned to the six electricals categories and correct the **test** to the real number — do not pad the data.

- [ ] **Step 6: Add the test script**

Add to `package.json` `"scripts"`: `"test": "vitest run"`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add catalog repository as the single content access seam

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Components

### Task 6: Primitives

**Files:**
- Create: `src/components/primitives/Eyebrow.astro`, `SolidButton.astro`, `PillButton.astro`, `SectionHeading.astro`, `Chevron.astro`

- [ ] **Step 1: Create Chevron.astro**

The tone-on-tone motif. Decorative, so hidden from assistive tech.

> **Trap, hit during Task 6 — applies to every consumer in Tasks 7–11.** Sizing `<Chevron>` with a class defined in the *consumer's* `<style>` block does nothing: Astro scopes that class to the consumer's own elements, so it never matches the SVG. The chevron then has no dimensions, fills its container, and renders as a large visible grey slab instead of a faint motif. It fails silently and only looks wrong. **Size and position it with global utility classes** (`w-[420px] h-[500px] left-[-40px] top-[230px]`), never with scoped ones.

```astro
---
interface Props { class?: string; opacity?: number; flip?: boolean; }
const { class: cls = '', opacity = 0.028, flip = false } = Astro.props;
---
<svg
  class={`pointer-events-none absolute ${cls}`}
  viewBox="0 0 200 240"
  aria-hidden="true"
  style={`fill: rgba(255,255,255,${opacity}); ${flip ? 'transform: scaleX(-1);' : ''}`}
>
  <path d="M0 0 100 120 0 240Z" />
  <path d="M70 0 170 120 70 240Z" />
</svg>
```

- [ ] **Step 2: Create Eyebrow.astro**

```astro
---
interface Props { center?: boolean; onLight?: boolean; }
const { center = false, onLight = false } = Astro.props;
---
<div
  class:list={['eyebrow', { 'eyebrow--center': center }]}
  style={onLight ? 'color: var(--color-red-deep)' : undefined}
>
  <slot />
</div>

<style>
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-red);
  }
  .eyebrow::before {
    content: '';
    width: 16px;
    height: 2px;
    background: currentColor;
  }
  .eyebrow--center { justify-content: center; }
</style>
```

`onLight` switches to the deep red — the accessibility rule from spec §2, expressed as a prop so it cannot be forgotten.

- [ ] **Step 3: Create SolidButton.astro and PillButton.astro**

`SolidButton.astro`:

```astro
---
interface Props { href?: string; type?: 'button' | 'submit'; class?: string; }
const { href, type = 'button', class: cls = '' } = Astro.props;
const Tag = href ? 'a' : 'button';
---
<Tag {href} type={href ? undefined : type} class={`solid ${cls}`}>
  <slot /><span class="chev" aria-hidden="true">›</span>
</Tag>

<style>
  .solid {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    background: var(--color-red); color: #fff; border: none; cursor: pointer;
    font-family: var(--font-display); font-weight: 700; font-size: 13.5px;
    letter-spacing: 0.03em; text-transform: uppercase; padding: 14px 26px;
    min-height: 44px; transition: background var(--dur-base) var(--ease-out);
  }
  .solid:hover { background: var(--color-red-dark); }
  .chev { font-weight: 700; }
</style>
```

`PillButton.astro`: same structure, but `border: 1px solid rgba(255,255,255,.32)`, `border-radius: 999px`, transparent background, `font-size: 13px`, `font-weight: 500`, no uppercase, chevron in `var(--color-red)`. Accept an `onLight` prop that swaps the border to `rgba(0,0,0,.18)` and the text to `var(--color-ink)`.

- [ ] **Step 4: Create SectionHeading.astro**

```astro
---
import Eyebrow from './Eyebrow.astro';
interface Props { eyebrow: string; title: string; lede?: string; center?: boolean; onLight?: boolean; }
const { eyebrow, title, lede, center = false, onLight = false } = Astro.props;
---
<div class:list={['sec', { 'sec--center': center }]}>
  <Eyebrow center={center} onLight={onLight}>{eyebrow}</Eyebrow>
  <h2 set:html={title} />
  {lede && <p>{lede}</p>}
</div>

<style>
  .sec h2 {
    font-size: clamp(30px, 4vw, 46px);
    margin-top: 16px;
    letter-spacing: -0.028em;
  }
  .sec p {
    color: var(--color-grey-lt);
    margin-top: 16px;
    max-width: 56ch;
    font-size: 15px;
  }
  .sec--center { text-align: center; }
  .sec--center p { margin-inline: auto; }
</style>
```

`title` uses `set:html` so headings can carry a `<br>`, matching the mockup's two-line headings. Only trusted authored strings reach it.

- [ ] **Step 5: Verify visually**

Render all five primitives on a scratch page at `/dev-primitives`, run `npm run dev`, and confirm against `design/direction-b-forge.html`: eyebrow dash and tracking, button heights ≥ 44px, chevron opacity barely perceptible.

- [ ] **Step 6: Delete the scratch page and commit**

```bash
rm src/pages/dev-primitives.astro
git add -A
git commit -m "$(cat <<'EOF'
feat: add design system primitives

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Header, footer and mobile navigation

**Files:**
- Create: `src/components/layout/UtilityBar.astro`, `Header.astro`, `Footer.astro`, `MobileNav.tsx`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Build UtilityBar.astro and Header.astro**

Port markup and CSS from `design/direction-b-forge.html`, sections `.util` and `header`. Critical details:

- `.util` is `position: absolute; top: 0` and `header` is `position: absolute; top: 44px`. Both sit **inside** the hero's stacking context. If `.util` is left in normal flow inside a flex hero it drops to the bottom of the viewport.
- The header uses `spartan-logo-light.svg`. On pages without a dark hero, the header instead gets a solid `var(--color-black)` background so the light lockup still has the contrast it needs.
- Nav links: Archivo 12.5px, weight 600, `letter-spacing: .13em`, uppercase, 2px transparent bottom border that becomes `var(--color-red)` on hover and for the current page.
- Mark the current page with `aria-current="page"`, not colour alone.

- [ ] **Step 2: Build MobileNav.tsx as a Preact island**

Requirements — these are the accessibility contract:

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';

export default function MobileNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus(); }
      if (e.key !== 'Tab') return;
      const f = panelRef.current?.querySelectorAll<HTMLElement>('a,button');
      if (!f?.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      <button ref={triggerRef} aria-expanded={open} aria-controls="mobile-nav"
              aria-label="Open menu" onClick={() => setOpen(true)}>☰</button>
      {open && (
        <div id="mobile-nav" ref={panelRef} role="dialog" aria-modal="true" aria-label="Menu">
          <button onClick={() => { setOpen(false); triggerRef.current?.focus(); }} aria-label="Close menu">✕</button>
          <nav>{items.map((i) => <a href={i.href}>{i.label}</a>)}</nav>
        </div>
      )}
    </>
  );
}
```

Load with `client:media="(max-width: 1080px)"` so desktop ships none of it.

- [ ] **Step 3: Build Footer.astro**

Port from the mockup's `<footer>`. Four parts: contact strip with circular red icons plus newsletter (red Submit), then logo + blurb and three link columns with red headings, circular socials, and a centred bottom bar. Uses `spartan-logo-light.svg`. Contact values come from `src/data/site.json` — a new file holding placeholders flagged in spec §12.1:

```json
{
  "phone": "+971 00 000 0000",
  "email": "sales@spartan.example",
  "address": "Address line, City, Country",
  "established": 2015
}
```

- [ ] **Step 4: Wire into BaseLayout**

Add a `darkHeader` prop (default `true`) that controls whether the header is transparent-over-hero or solid.

- [ ] **Step 5: Verify**

`npm run dev`. At 1440px: utility bar pinned top, nav below it, nothing overlapping the hero quote. At 375px: hamburger opens a focus-trapped panel, Escape closes it and returns focus to the trigger. Tab order matches visual order.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add header, footer and accessible mobile navigation

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Catalogue components

**Files:**
- Create: `src/components/catalog/ProductCard.astro`, `CategoryTile.astro`, `ProductGrid.astro`, `SpecTable.astro`, `En388Table.astro`

- [ ] **Step 1: Write the En388Table test**

Create `src/components/catalog/en388.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { en388Columns } from './en388';

describe('en388Columns', () => {
  it('returns the five EN 388 columns in standard order', () => {
    const cols = en388Columns({ abrasion: '4', bladeCut: 'X', tear: '4', puncture: '3', tdmCut: 'D' });
    expect(cols.map((c) => c.label)).toEqual(['Abrasion', 'Blade cut', 'Tear', 'Puncture', 'TDM cut']);
    expect(cols.map((c) => c.value)).toEqual(['4', 'X', '4', '3', 'D']);
  });

  it('renders X as a non-tested marker with an accessible description', () => {
    const cols = en388Columns({ abrasion: '4', bladeCut: 'X', tear: '4', puncture: '3', tdmCut: 'D' });
    expect(cols[1].title).toMatch(/not tested/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/components/catalog/en388.test.ts
```

Expected: FAIL — cannot resolve `./en388`.

- [ ] **Step 3: Implement src/components/catalog/en388.ts**

```ts
import type { Product } from '../../lib/catalog';

type En388 = NonNullable<Product['en388']>;

const ORDER: { key: keyof En388; label: string }[] = [
  { key: 'abrasion', label: 'Abrasion' },
  { key: 'bladeCut', label: 'Blade cut' },
  { key: 'tear', label: 'Tear' },
  { key: 'puncture', label: 'Puncture' },
  { key: 'tdmCut', label: 'TDM cut' },
];

export function en388Columns(en388: En388) {
  return ORDER.map(({ key, label }) => {
    const value = en388[key];
    return {
      label,
      value,
      title: value === 'X' ? `${label}: not tested for this glove` : `${label}: level ${value}`,
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/components/catalog/en388.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Build the Astro components**

- `SpecTable.astro` — real `<table>` with `<th scope="row">` for labels. Header row `background: #000`, Archivo 10.5px uppercase.
- `En388Table.astro` — consumes `en388Columns()`, `<th scope="col">` per column, values Archivo 800 in `var(--color-red)`, `title` attribute from the helper. Preceded by a visually-hidden caption: "EN 388 mechanical resistance levels".
- `ProductCard.astro` — image on `var(--color-card)`, category kicker, name, up to three specs, and an `EnquiryButton` island. Image via `astro:assets` `<Image>` with `widths={[180, 360, 540]}`, `loading="lazy"`, explicit dimensions.
- `CategoryTile.astro` — image, name, and either "`N` PRODUCTS" in red or "RANGE EXPANDING" in grey when `status === 'expanding'`.
- `ProductGrid.astro` — responsive grid: 4 columns ≥1080px, 3 ≥820px, 2 below, 1px `var(--color-line)` gaps as in the mockup.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add product card, category tile and specification tables

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Pages

### Task 9: Home page sections

**Files:**
- Create: `src/components/sections/Hero.astro`, `About.astro`, `ServiceCards.astro`, `TrustBand.astro`, `CategoryGrid.astro`, `Spotlight.astro`, `Faq.astro`, `EnquiryCta.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Build the sections**

Port each from the matching block of `design/direction-b-forge.html`, replacing hard-coded content with `catalog.ts` calls. Section-specific requirements:

- **Hero** — `min-height: 880px`, `padding: 196px 0 74px`. Background image is `safety.jpg` via `<Image>` with `loading="eager"` and `fetchpriority="high"` (it is the LCP element). Three stacked gradients per the mockup. Headline: red line then white line, `clamp(56px, 9vw, 124px)`, weight 800, `letter-spacing: -0.035em`.
- **ServiceCards** — light section, so it carries `class="on-light"` and passes `onLight` to `Eyebrow`. Six cards from the first six active categories.
- **TrustBand** — industries from `src/data/site.json`. Spec §12.5 flags these as inferred; add an HTML comment saying so.
- **CategoryGrid** — all 15 categories plus the red "View every product" tile, giving a clean 4×4.
- **Spotlight** — Grip Guard GP5 via `getProduct('grip-guard-gp5')`, with `SpecTable` and `En388Table`.

> **Pick featured products explicitly by slug.** `product.order` is per-category and its values repeat across categories, so unfiltered `getProducts({ limit: n })` returns a semi-arbitrary cross-category slice — fine for a filtered listing, wrong for a curated strip. Any "selected products" section must name its products.
- **Faq** — native `<details>`/`<summary>`, no JS. Circular +/– affordance inverts to red when open.

- [ ] **Step 2: Assemble index.astro**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/sections/Hero.astro';
import About from '../components/sections/About.astro';
import ServiceCards from '../components/sections/ServiceCards.astro';
import TrustBand from '../components/sections/TrustBand.astro';
import CategoryGrid from '../components/sections/CategoryGrid.astro';
import Spotlight from '../components/sections/Spotlight.astro';
import Faq from '../components/sections/Faq.astro';
import EnquiryCta from '../components/sections/EnquiryCta.astro';
---
<BaseLayout
  title="Spartan — Industrial Electrical & Safety Solutions"
  description="Lighting, ventilation and water management alongside certified personal protective equipment. 72 products across two divisions, supplied to contractors, facilities teams and distributors."
>
  <main id="main">
    <Hero />
    <About />
    <ServiceCards />
    <TrustBand />
    <CategoryGrid />
    <Spotlight />
    <Faq />
    <EnquiryCta />
  </main>
</BaseLayout>
```

- [ ] **Step 3: Verify against the comp**

```bash
npm run dev
```

Open side by side with `design/direction-b-forge.html` at 1440px. Section order, rhythm and colour must match. Then check 375px: no horizontal scroll, headline still legible, category grid at 2 columns.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: build home page from catalogue data

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Catalogue, category and product pages

**Files:**
- Create: `src/pages/catalogue/index.astro`, `src/pages/catalogue/[category].astro`, `src/pages/products/[slug].astro`, `src/components/catalog/CatalogueFilters.tsx`

- [ ] **Step 1: Build catalogue/[category].astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import ProductGrid from '../../components/catalog/ProductGrid.astro';
import SectionHeading from '../../components/primitives/SectionHeading.astro';
import { getCategories, getCategory, getProducts, getDivision } from '../../lib/catalog';

export async function getStaticPaths() {
  const categories = await getCategories();
  return categories.map((c) => ({ params: { category: c.slug } }));
}

const { category: slug } = Astro.params;
const category = await getCategory(slug!);
if (!category) return Astro.redirect('/404');
const products = await getProducts({ categoryId: category.id });
// division id and slug are identical in the data, so the id is a valid lookup key
const division = await getDivision(category.divisionId);
---
<BaseLayout title={`${category.name} — Spartan`} description={category.description} darkHeader={false}>
  <main id="main" class="wrap" style="padding-block:140px 96px">
    <nav aria-label="Breadcrumb" style="margin-bottom:24px">
      <a href="/catalogue">Catalogue</a> / <span aria-current="page">{category.name}</span>
    </nav>
    <SectionHeading eyebrow={division!.name} title={category.name} lede={category.description} />
    {products.length > 0
      ? <ProductGrid products={products} />
      : <p style="margin-top:40px;color:var(--color-grey-lt)">
          This range is expanding. <a href="/enquiry" style="color:var(--color-red)">Contact us</a> for current availability and lead times.
        </p>}
  </main>
</BaseLayout>
```

The empty branch is what makes Spill Control honest rather than broken.

- [ ] **Step 2: Build products/[slug].astro**

Two-column layout mirroring the Spotlight section: image left on a radial-lit panel, right column with eyebrow (category name, linked), `<h1>`, intro, `SpecTable`, `En388Table` when present, variants list when present, "Add to enquiry" and "Request full specification". Below: `getRelatedProducts(slug, 4)` in a `ProductGrid`. Breadcrumb: Catalogue / Category / Product.

- [ ] **Step 3: Build catalogue/index.astro with filters**

Server-renders all 72 products and all 15 categories. `CatalogueFilters.tsx` is a `client:idle` island that filters the already-rendered DOM by division and category via `data-` attributes — so the page is complete and indexable without JS, and filtering costs no round trip.

- [ ] **Step 4: Verify every route builds**

```bash
npm run build
```

Expected: 15 category pages and 72 product pages emitted. Confirm:

```bash
ls dist/products | wc -l
```

Expected: `72`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add catalogue, category and product detail pages

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Editorial pages

**Files:**
- Create: `src/pages/about.astro`, `why-spartan.astro`, `industries.astro`, `contact.astro`, `electricals.astro`, `safety.astro`, `404.astro`

- [ ] **Step 1: Build the division landings**

`electricals.astro` and `safety.astro` share a structure: division hero using that division's photograph, blurb, its categories as tiles, and a selection of its products. Build one `DivisionPage.astro` component taking a `divisionSlug` prop; both pages are thin wrappers. DRY.

- [ ] **Step 2: Build about.astro**

Copy is the brochure's own About text (spec §2 source). Include the founding year, the India/China manufacturing statement, and the two-division structure. Do not add claims — no certifications, no client names, no staff numbers.

- [ ] **Step 3: Build why-spartan.astro and industries.astro**

`why-spartan` — differentiators supportable from the brochure only: breadth across two divisions, stated material and rating specifications, manufacturing base, single-enquiry purchasing. `industries` — the eight industries with an HTML comment marking them inferred pending confirmation (spec §12.5).

- [ ] **Step 4: Build contact.astro and 404.astro**

Contact: details from `site.json`, a general enquiry form posting to the same endpoint, and a note that product enquiries are better made from the catalogue. 404: brand-consistent, with links to both divisions and the catalogue.

- [ ] **Step 5: Verify and commit**

```bash
npm run build
git add -A
git commit -m "$(cat <<'EOF'
feat: add division landings and editorial pages

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Enquiry basket

### Task 12: Enquiry store

**Files:**
- Create: `src/stores/enquiry.ts`, `src/stores/enquiry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { enquiry, addItem, removeItem, setQty, setNote, clear, itemCount } from './enquiry';

describe('enquiry store', () => {
  beforeEach(() => clear());

  it('starts empty', () => {
    expect(enquiry.get()).toEqual([]);
    expect(itemCount()).toBe(0);
  });

  it('adds an item with quantity 1', () => {
    addItem({ slug: 'safety-helmets', name: 'Safety Helmets' });
    expect(enquiry.get()).toEqual([{ slug: 'safety-helmets', name: 'Safety Helmets', qty: 1, note: '' }]);
  });

  it('increments quantity instead of duplicating', () => {
    addItem({ slug: 'safety-helmets', name: 'Safety Helmets' });
    addItem({ slug: 'safety-helmets', name: 'Safety Helmets' });
    expect(enquiry.get()).toHaveLength(1);
    expect(enquiry.get()[0].qty).toBe(2);
  });

  it('counts total quantity, not line count', () => {
    addItem({ slug: 'a', name: 'A' });
    addItem({ slug: 'a', name: 'A' });
    addItem({ slug: 'b', name: 'B' });
    expect(itemCount()).toBe(3);
  });

  it('removes an item', () => {
    addItem({ slug: 'a', name: 'A' });
    removeItem('a');
    expect(enquiry.get()).toEqual([]);
  });

  it('clamps quantity to a minimum of 1', () => {
    addItem({ slug: 'a', name: 'A' });
    setQty('a', 0);
    expect(enquiry.get()[0].qty).toBe(1);
  });

  it('caps quantity at 999', () => {
    addItem({ slug: 'a', name: 'A' });
    setQty('a', 100000);
    expect(enquiry.get()[0].qty).toBe(999);
  });

  it('stores a per-item note', () => {
    addItem({ slug: 'a', name: 'A' });
    setNote('a', 'Need 6 colourways');
    expect(enquiry.get()[0].note).toBe('Need 6 colourways');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/stores/enquiry.test.ts
```

Expected: FAIL — cannot resolve `./enquiry`.

- [ ] **Step 3: Implement src/stores/enquiry.ts**

```ts
import { persistentAtom } from '@nanostores/persistent';

export interface EnquiryItem { slug: string; name: string; qty: number; note: string; }

export const enquiry = persistentAtom<EnquiryItem[]>('spartan.enquiry.v1', [], {
  encode: JSON.stringify,
  decode: (raw) => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];   // corrupt storage must never break the page
    }
  },
});

const clampQty = (n: number) => Math.min(999, Math.max(1, Math.floor(n) || 1));

export function addItem(item: { slug: string; name: string }) {
  const items = enquiry.get();
  const existing = items.find((i) => i.slug === item.slug);
  enquiry.set(
    existing
      ? items.map((i) => (i.slug === item.slug ? { ...i, qty: clampQty(i.qty + 1) } : i))
      : [...items, { ...item, qty: 1, note: '' }],
  );
}

export const removeItem = (slug: string) => enquiry.set(enquiry.get().filter((i) => i.slug !== slug));
export const setQty = (slug: string, qty: number) =>
  enquiry.set(enquiry.get().map((i) => (i.slug === slug ? { ...i, qty: clampQty(qty) } : i)));
export const setNote = (slug: string, note: string) =>
  enquiry.set(enquiry.get().map((i) => (i.slug === slug ? { ...i, note: note.slice(0, 500) } : i)));
export const clear = () => enquiry.set([]);
export const itemCount = () => enquiry.get().reduce((n, i) => n + i.qty, 0);
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/stores/enquiry.test.ts
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add persistent enquiry basket store

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Enquiry UI islands

**Files:**
- Create: `src/components/enquiry/EnquiryButton.tsx`, `EnquiryBadge.tsx`, `EnquiryDrawer.tsx`

- [ ] **Step 1: Build EnquiryButton.tsx**

```tsx
import { useState } from 'preact/hooks';
import { addItem } from '../../stores/enquiry';

export default function EnquiryButton({ slug, name }: { slug: string; name: string }) {
  const [added, setAdded] = useState(false);
  return (
    <button
      class="enquiry-add"
      onClick={() => { addItem({ slug, name }); setAdded(true); setTimeout(() => setAdded(false), 2000); }}
      aria-label={`Add ${name} to enquiry list`}
    >
      {added ? '✓ Added' : '+ Enquire'}
    </button>
  );
}
```

- [ ] **Step 2: Build EnquiryBadge.tsx**

Subscribes via `useStore(enquiry)`, renders the total count in the header, and wraps it in `<span aria-live="polite">` so screen readers hear the change. Renders nothing when the count is 0.

- [ ] **Step 3: Build EnquiryDrawer.tsx**

Slide-over with `role="dialog"`, `aria-modal="true"`, focus trap and Escape-to-close identical to `MobileNav`, restoring focus to the trigger. Lists items with quantity steppers (44×44px targets), note fields, remove buttons, and a "Review enquiry" link to `/enquiry`. Empty state: "Your enquiry list is empty" plus a link to the catalogue.

- [ ] **Step 4: Verify hydration boundaries**

`EnquiryButton` uses `client:visible`; `EnquiryBadge` and `EnquiryDrawer` use `client:idle`. Build and confirm a product page ships only these islands.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add enquiry button, badge and drawer islands

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Enquiry submission

**Files:**
- Create: `src/lib/enquiry-schema.ts`, `src/lib/enquiry-schema.test.ts`, `src/pages/enquiry.astro`, `src/pages/api/enquiry.ts`, `.env.example`

- [ ] **Step 1: Write the failing schema test**

```ts
import { describe, it, expect } from 'vitest';
import { enquiryPayloadSchema } from './enquiry-schema';

const valid = {
  name: 'Sam Rahman',
  company: 'Gulf Contracting',
  email: 'sam@example.com',
  phone: '+971500000000',
  country: 'UAE',
  message: 'Please quote for a 40-site rollout.',
  items: [{ slug: 'safety-helmets', name: 'Safety Helmets', qty: 12, note: '' }],
  website: '',
};

describe('enquiryPayloadSchema', () => {
  it('accepts a valid payload', () => {
    expect(() => enquiryPayloadSchema.parse(valid)).not.toThrow();
  });

  it('rejects a malformed email', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, email: 'nope' })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects a filled honeypot', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, website: 'http://spam' })).toThrow();
  });

  it('allows an empty item list for a general contact enquiry', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, items: [] })).not.toThrow();
  });

  it('rejects more than 200 items', () => {
    const items = Array.from({ length: 201 }, (_, i) => ({ slug: `s${i}`, name: 'X', qty: 1, note: '' }));
    expect(() => enquiryPayloadSchema.parse({ ...valid, items })).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx vitest run src/lib/enquiry-schema.test.ts
```

Expected: FAIL — cannot resolve `./enquiry-schema`.

- [ ] **Step 3: Implement src/lib/enquiry-schema.ts**

> **Import `zod/v4`, not `zod`.** This project carries two zod instances: the top-level dependency is 3.25.76, while `astro/zod` — which backs the content schemas — is 4.4.3. zod 3.25 ships a `zod/v4` subpath, so importing from it keeps the enquiry schema on the same major as the rest of the project and avoids shipping two zod runtimes to the browser. Verify the subpath resolves before relying on it; fall back to bare `zod` and report if it does not.

```ts
import { z } from 'zod/v4';

export const enquiryItemSchema = z.object({
  slug: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  qty: z.number().int().min(1).max(999),
  note: z.string().max(500).default(''),
});

export const enquiryPayloadSchema = z.object({
  name: z.string().trim().min(1, 'Please enter your name').max(120),
  company: z.string().trim().max(160).default(''),
  email: z.string().trim().email('Please enter a valid email address'),
  phone: z.string().trim().max(40).default(''),
  country: z.string().trim().max(80).default(''),
  message: z.string().trim().max(4000).default(''),
  items: z.array(enquiryItemSchema).max(200),
  // Honeypot: real users never see this field, so a value means a bot.
  website: z.string().max(0, 'Rejected'),
});

export type EnquiryPayload = z.infer<typeof enquiryPayloadSchema>;
```

- [ ] **Step 4: Run to verify it passes**

```bash
npx vitest run src/lib/enquiry-schema.test.ts
```

Expected: 6 tests PASS.

- [ ] **Step 5: Build the API route**

Create `src/pages/api/enquiry.ts`:

```ts
import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { enquiryPayloadSchema } from '../../lib/enquiry-schema';

export const prerender = false;

const hits = new Map<string, number[]>();
const RATE_LIMIT = 5;
const WINDOW_MS = 10 * 60 * 1000;

function rateLimited(ip: string, now: number) {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const now = Date.now();
  if (rateLimited(clientAddress, now)) {
    return new Response(JSON.stringify({ error: 'Too many enquiries. Please try again shortly.' }), { status: 429 });
  }

  const parsed = enquiryPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Please check the form.', issues: parsed.error.flatten().fieldErrors }),
      { status: 400 },
    );
  }

  const p = parsed.data;
  const manifest = p.items.length
    ? p.items.map((i) => `- ${i.name} x${i.qty}${i.note ? ` (${i.note})` : ''}`).join('\n')
    : '(general enquiry — no products selected)';

  const key = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.ENQUIRY_TO_EMAIL;
  if (!key || !to) {
    console.warn('[enquiry] RESEND_API_KEY / ENQUIRY_TO_EMAIL not set; logging instead');
    console.info({ ...p, manifest });
    return new Response(JSON.stringify({ ok: true, delivered: false }), { status: 200 });
  }

  try {
    await new Resend(key).emails.send({
      from: 'Spartan Website <enquiries@spartan.example>',
      to,
      replyTo: p.email,
      subject: `Enquiry from ${p.company || p.name} (${p.items.length} products)`,
      text: `Name: ${p.name}\nCompany: ${p.company}\nEmail: ${p.email}\nPhone: ${p.phone}\nCountry: ${p.country}\n\nProducts:\n${manifest}\n\nMessage:\n${p.message}`,
    });
    return new Response(JSON.stringify({ ok: true, delivered: true }), { status: 200 });
  } catch (err) {
    console.error('[enquiry] send failed', err);
    return new Response(JSON.stringify({ error: 'We could not send your enquiry. Please try again or email us directly.' }), { status: 502 });
  }
};
```

The missing-key path returns success without delivering, so the site is testable before credentials exist (spec §7).

- [ ] **Step 6: Create .env.example**

```
RESEND_API_KEY=
ENQUIRY_TO_EMAIL=
```

- [ ] **Step 7: Build enquiry.astro and EnquiryForm.tsx**

Form fields with persistent visible labels. On submit: disable the button and show a spinner; on `200` clear the store and show confirmation; on `4xx` render field errors adjacent to their inputs with `role="alert"` and focus the first invalid field; on `5xx` show the retry message and **keep the basket**. Include the hidden honeypot `website` input with `tabindex="-1"` and `autocomplete="off"`.

- [ ] **Step 8: Verify end to end**

```bash
npm run dev
```

Add three products, open `/enquiry`, submit. Expected: 200, basket cleared, confirmation shown, payload logged to the terminal. Submit with an invalid email: error appears next to the field and focus lands there.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add enquiry submission with validation, rate limiting and email delivery

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — SEO, quality and launch readiness

### Task 15: SEO and structured data

**Files:**
- Create: `src/lib/seo.ts`, `src/lib/seo.test.ts`, `src/components/Seo.astro`
- Modify: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { productJsonLd, breadcrumbJsonLd } from './seo';

const product = {
  slug: 'safety-helmets', name: 'Safety Helmets', categoryId: 'head',
  images: ['p15-safety-helmets.png'],
  specs: [{ label: 'Shell', value: 'HDPE compound + nylon ratchet' }],
  status: 'published' as const, sourcePage: 15, order: 1,
};

describe('productJsonLd', () => {
  it('emits a Product node with brand and description', () => {
    const ld = productJsonLd(product, 'https://spartan.example');
    expect(ld['@type']).toBe('Product');
    expect(ld.name).toBe('Safety Helmets');
    expect(ld.brand).toEqual({ '@type': 'Brand', name: 'Spartan' });
    expect(ld.description).toContain('HDPE');
  });

  it('does not emit offers — the site publishes no prices', () => {
    expect(productJsonLd(product, 'https://spartan.example')).not.toHaveProperty('offers');
  });
});

describe('breadcrumbJsonLd', () => {
  it('numbers positions from 1', () => {
    const ld = breadcrumbJsonLd([{ name: 'Catalogue', url: '/catalogue' }, { name: 'Head', url: '/catalogue/head' }], 'https://spartan.example');
    expect(ld.itemListElement.map((i: any) => i.position)).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then implement `src/lib/seo.ts`**

```bash
npx vitest run src/lib/seo.test.ts
```

Expected: FAIL. Implement `productJsonLd`, `breadcrumbJsonLd`, `organizationJsonLd` and `itemListJsonLd`. Never emit `offers`, `price` or `availability` — the site has no prices, and claiming them would be false structured data.

- [ ] **Step 3: Build Seo.astro and wire it into BaseLayout**

Renders title, description, canonical, Open Graph, Twitter card and an optional `jsonLd` prop as `<script type="application/ld+json">`. Add `organizationJsonLd` site-wide, `productJsonLd` + breadcrumbs on product pages, `itemListJsonLd` + breadcrumbs on category pages.

Also add the favicon links here. Task 2 built `BaseLayout.astro` to the spec's markup, which omitted them, leaving the scaffold's `public/favicon.svg` and `public/favicon.ico` unreferenced. Replace the placeholder Astro favicon with a Spartan mark derived from the existing `spartan-logo.svg` helmet — crop the helmet path only, never redraw it.

- [ ] **Step 4: Verify**

```bash
npm run build
```

Confirm `dist/sitemap-index.xml` exists and a product page contains exactly one `Product` JSON-LD block.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: add SEO metadata, structured data and sitemap

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: End-to-end tests

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/catalogue.spec.ts`, `tests/e2e/enquiry.spec.ts`, `tests/e2e/a11y.spec.ts`

- [ ] **Step 1: Install and configure Playwright**

```bash
npx playwright install chromium
npm install -D @axe-core/playwright
```

Create `playwright.config.ts` with `webServer: { command: 'npm run preview', port: 4321, reuseExistingServer: true }` and projects for Desktop Chrome (1440×900) and Mobile Chrome (Pixel 5).

- [ ] **Step 2: Write tests/e2e/enquiry.spec.ts**

```ts
import { test, expect } from '@playwright/test';

test('a visitor can build and submit a multi-product enquiry', async ({ page }) => {
  await page.goto('/catalogue');

  const cards = page.locator('[data-product-card]');
  await cards.nth(0).getByRole('button', { name: /add .* to enquiry/i }).click();
  await cards.nth(1).getByRole('button', { name: /add .* to enquiry/i }).click();

  await expect(page.getByTestId('enquiry-count')).toHaveText('2');

  await page.goto('/enquiry');
  await expect(page.locator('[data-enquiry-row]')).toHaveCount(2);

  await page.getByLabel('Name').fill('Sam Rahman');
  await page.getByLabel('Email').fill('sam@example.com');
  await page.getByRole('button', { name: /send enquiry/i }).click();

  await expect(page.getByRole('status')).toContainText(/thank you|received/i);
  await expect(page.getByTestId('enquiry-count')).toHaveCount(0);
});

test('the basket survives a page reload', async ({ page }) => {
  await page.goto('/products/safety-helmets');
  await page.getByRole('button', { name: /add .* to enquiry/i }).click();
  await page.reload();
  await expect(page.getByTestId('enquiry-count')).toHaveText('1');
});

test('an invalid email blocks submission and reports the error', async ({ page }) => {
  await page.goto('/enquiry');
  await page.getByLabel('Name').fill('Sam');
  await page.getByLabel('Email').fill('not-an-email');
  await page.getByRole('button', { name: /send enquiry/i }).click();
  await expect(page.getByRole('alert')).toContainText(/valid email/i);
});
```

- [ ] **Step 3: Write tests/e2e/catalogue.spec.ts**

Cover: every category tile links to a page that returns 200; a product page renders its name as `<h1>` and shows a spec table; the Spill Control page shows the expanding message and no product grid; catalogue filters narrow the visible product count; the site works with JavaScript disabled (products still listed, forms still submit).

- [ ] **Step 4: Write tests/e2e/a11y.spec.ts**

```ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const path of ['/', '/catalogue', '/catalogue/hand-protection', '/products/safety-helmets', '/enquiry', '/contact']) {
  test(`${path} has no detectable accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}
```

- [ ] **Step 5: Run the suite**

```bash
npm run build && npx playwright test
```

Expected: all pass. Any axe colour-contrast violation almost certainly means brand red was used for small text on a light background — fix by switching that element to `--color-red-deep` (spec §2), never by loosening the test.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
test: add end-to-end coverage for catalogue, enquiry flow and accessibility

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Launch readiness

**Files:**
- Create: `README.md`, `docs/CONTENT-EDITING.md`
- Modify: `package.json`

- [ ] **Step 1: Run a production build and audit it**

```bash
npm run build && npm run preview
```

Run Lighthouse against `/`, `/catalogue/hand-protection` and `/products/safety-helmets`.
Expected: ≥ 95 on all four categories. If LCP is weak, confirm the hero image is `loading="eager"` with `fetchpriority="high"` and that both fonts are preloaded.

- [ ] **Step 2: Verify the admin seam holds**

This is the architectural guarantee from spec §5 — verify it rather than assume it.

```bash
grep -rn "from '.*data/.*json'" src/pages src/components || echo "PASS: no page or component imports data directly"
grep -rn "getCollection" src/pages src/components || echo "PASS: no page or component calls getCollection directly"
```

Expected: both print PASS. Any hit is a leak that will break the future CMS migration — route it through `catalog.ts`.

- [ ] **Step 3: Write docs/CONTENT-EDITING.md**

Explain how to add a product, add a category, mark a category as expanding, and replace product photography — plus the rule that `heroProductSlug` must reference a real product slug and that slugs are permanent URLs.

- [ ] **Step 4: Write README.md**

Cover setup, the npm scripts, the environment variables, the data-layer architecture and its migration path, the two logo lockups and when to use each, the red-on-light contrast rule, and the extraction tooling's two fragile behaviours.

- [ ] **Step 5: Record outstanding items**

Add a "Before launch" section to the README listing the six open items from spec §12, each with the file to edit.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: add README, content editing guide and launch checklist

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Verification checklist

Run before declaring the build complete. Every line needs observed output, not assumption.

- [ ] `npm run test` — all Vitest suites pass
- [ ] `npm run build` — clean build; 72 product pages and 15 category pages emitted
- [ ] `npx astro check` — no type errors
- [ ] `npx playwright test` — all e2e and axe specs pass
- [ ] Lighthouse ≥ 95 on Performance, Accessibility, Best Practices, SEO for three sampled pages
- [ ] Seam check from Task 17 Step 2 prints PASS twice
- [ ] Manual: 375px and 1440px, no horizontal scroll on any page
- [ ] Manual: full keyboard pass of the enquiry flow, including drawer focus trap and Escape
- [ ] Manual: `prefers-reduced-motion: reduce` disables animation
- [ ] Manual: JavaScript disabled — catalogue browsable, contact form submits
- [ ] Manual: dark and light sections both use the correct logo lockup
- [ ] Manual: no invented product, specification, certification or image anywhere on the site
