# Spartan Catalogue Website — Handoff

**Last updated:** 2026-08-05
**Branch:** `feat/catalogue-site` (all work lives here; `main` tracks it)
**State:** **All 17 tasks complete and verified. The build is finished.** The site builds end to end — 96 pages plus a 404 and one server-rendered endpoint — and the full enquiry path works from product card to submitted RFQ.

```
vitest        63 passed
playwright    83 passed, 1 skipped  (desktop + mobile projects)
astro check   0 errors, 0 warnings, 7 hints
astro build   clean — 96 pages + 404 + 1 SSR endpoint
lighthouse    >= 95 on all four categories, all three page types
```

**Nothing in the build is outstanding. What remains is deployment and the client-supplied items in §8** — see §7 "What a next session picks up".

**Start here, in this order:** `README.md` (setup, scripts, architecture, launch checklist) → this document (the history and the traps) → `docs/CONTENT-EDITING.md` if you are touching catalogue data.

---

## 1. What this project is

A catalogue-style marketing website for **Spartan**, an industrial brand with two divisions:

- **Spartan Electricals** — lighting, fans and ventilation, water pumps, cables, insect killers
- **Spartan Safety** — helmets, eye and hearing protection, gloves, footwear, fall arrest, body protection, workwear

**72 products across 15 categories.** It is a catalogue and lead-generation site — **not** e-commerce. No prices, no cart, no checkout, no accounts. The conversion mechanism is a multi-product **enquiry basket**: a buyer collects products while browsing and submits one RFQ.

The client will add a **CMS-backed admin dashboard later**. The architecture is built around making that a one-module change (see §5).

### The hard rule

**Never invent product data.** No made-up specifications, certifications, ratings, dimensions or descriptions. Every value traces to the client's brochure PDF. Where data is missing, it stays missing and gets an honest empty state.

This is safety equipment. A fabricated protection rating is a genuine hazard, not a cosmetic flaw. Two categories legitimately have zero products and say so.

---

## 2. Where everything is

| Path | What it is |
|---|---|
| `README.md` | **Start here.** Setup, every script, environment variables, the admin seam, brand rules, Lighthouse results and the six-item launch checklist. |
| `docs/CONTENT-EDITING.md` | How to maintain the catalogue **without being a developer** — adding products and categories, expanding status, replacing photography, and the five rules that bite (slug permanence, `heroProductSlug`, upscaling, invented data, EN 388 `X` vs `0`). |
| `docs/superpowers/specs/2026-08-03-spartan-catalogue-design.md` | **The spec.** Brand rules, content model, IA, accessibility contract. |
| `docs/superpowers/plans/2026-08-03-spartan-catalogue-site.md` | **The implementation plan.** All 17 tasks with full code, tests and commands — now history. Its Task 4 category data and Task 17 `dist/` globs are superseded by this document. |
| `design/direction-b-forge.html` | **The approved visual design**, fully rendered. Source of truth for every spacing, size and colour value. Open it in a browser. |
| `design/direction-a-precision.html` | Rejected alternative. Kept for reference only. |
| `design/previews/*.png` | Full-page renders of both directions. |
| `design/assets/` | Reference copies of all extracted assets. Used for byte-comparison verification — **do not edit**. |
| `src/assets/products/` | 72 transparent product PNGs (the live set). |
| `src/assets/hero/` | 5 photographs, text overlays removed. `cover.jpg` was deleted — blank white once the overlay was stripped. |
| `src/assets/brand/` | Both logo lockups, SVG + PNG. |
| `src/data/` | `divisions.json` (2), `categories.json` (15), `products.json` (72), `site.json`, `products.raw.json` (extractor output). |
| `tools/` | PDF extraction scripts. Run only when the brochure is revised. |

**Source brochure:** `C:\Users\Vivaan\Downloads\08012026-001 - Spartan Brochure.pdf` — 25 pages, ~163MB. Not committed (too large). Everything in `src/assets/` and `src/data/products.raw.json` derives from it. You do not need it unless regenerating assets.

---

## 3. Brand foundations

### Logo — two lockups, not interchangeable

Both extracted as **vector** from the brochure. Neither was redrawn, and neither may be recoloured, redrawn, distorted, rotated or re-proportioned.

| Asset | Composition | Use on |
|---|---|---|
| `src/assets/brand/spartan-logo.svg` | Red helmet, **black** wordmark | Light backgrounds |
| `src/assets/brand/spartan-logo-light.svg` | Red helmet, **white** wordmark | Dark backgrounds |

The site is dark-first, so most surfaces need the **light** lockup. Using the dark one on a dark surface makes the wordmark invisible — that is a real bug that occurred during design.

Minimum rendered height 28px. Clear space on all sides = half the helmet height.

The brochure cover also carries an Arabic wordmark (**سبارتان**). Not used in this build; deferred.

### Colour — measured, not chosen

All values sampled from the brochure PDF. Tokens live in `src/styles/tokens.css`.

```
--color-red        #eb2927   brand red — text, icons, rules, borders, decorative fills
--color-red-fill   #dd1e1c   red SURFACES that carry white text
--color-red-dark   #b81c1b   hover on red fills
--color-red-deep   #970000   small red text on light surfaces
--color-red-light  #ef3a38   small red text on dark surfaces
--color-black      #08080a   page background
--color-panel      #0e0e11   alternating dark section
--color-card       #151519   dark card surface
--color-line       #232329   dark borders
--color-paper      #f6f6f7   light section background
--color-ink        #0e0e11   body text on light
--color-ink-muted  #6a6a72   muted text on light
--color-grey       #8a8a92   muted text on DARK ONLY
--color-grey-lt    #b4b4bc   body text on dark
```

**The accessibility contract — enforced, not advisory.** Measured against the real surfaces:

| Pair | Ratio | Verdict |
|---|---|---|
| red on black | 4.65:1 | passes AA at any size |
| **red on panel** | **4.48:1** | **fails AA for normal text**; passes the 3:1 large-text bar |
| **red on card** | **4.23:1** | **fails AA for normal text**; passes the 3:1 large-text bar |
| red-light on black | 5.08:1 | passes AA at any size |
| red-light on panel | 4.89:1 | passes AA at any size |
| red-light on card | 4.62:1 | passes AA at any size |
| red on paper | **3.99:1** | **fails AA for normal text**; passes the 3:1 large-text bar |
| red-deep on paper | 8.40:1 | passes AAA |
| grey on paper | **3.17:1** | **never use grey on light** |
| ink-muted on paper | 4.96:1 | passes AA |
| white on red | **4.30:1** | **fails AA for normal text**; passes the 3:1 large-text bar |
| white on red-fill | 4.91:1 | passes AA at any size |
| white on red-dark | 6.52:1 | passes AA at any size — the hover step |

**"On dark, red is fine at any size" is not true, and an earlier version of this document said it was.** That claim was measured against `--color-black` alone. There are three dark surfaces and brand red clears AA on only one. Hence the rule:

> **Small red text on a dark surface uses `--color-red-light`. Brand `--color-red` stays the colour for large text, icons, rules, borders and decorative fills.**

Large means ≥24px, or ≥18.66px (14pt) bold — **bold alone does not make text large**. The EN 388 levels at 16px/800 are 12pt bold, so they are normal-size text and needed the fix too; axe never flagged them, and they were caught only by measuring the rendered colour against the resolved background.

As with `red-fill`, the rule applies even on `--color-black` where brand red would pass: `.eyebrow` alone appears on all three dark surfaces, and two reds a few percent apart reads as a defect. Applied to `.eyebrow`, `.tile__count`, `.card__variant`, `.ind__count`, `.ef-field__req`, `.en td`, `.pd__variant`, `.f-head` and the hover states that turn small text red.

**`design/direction-b-forge.html` has the same failure**, so it arrived with the approved design rather than the implementation — it stays the source of truth for spacing, size and layout, but **not** for this colour pairing.

On light, red is permitted **only** for text ≥24px, or ≥18.66px bold, or non-text elements. Smaller red text on light must use `red-deep`. Muted body copy on light uses `ink-muted`.

And in the other direction: **any red *surface* carrying white text uses `red-fill`; brand red stays the colour for text, icons, rules, borders and decorative fills.** That covers the solid CTA, the trust band, the red catalogue tile, the footer Submit button and social hover disc, the open FAQ toggle and the skip link. It applies even where the white text is large enough for brand red to pass on its own — two reds a few percent apart inside one component reads as a defect.

`Eyebrow`, `PillButton` and `SectionHeading` take an `onLight` prop that switches these automatically — that is how the rule is enforced in code rather than remembered.

### Typography

- **Display:** Archivo — headings, eyebrows, buttons, numerals, table headers
- **Body:** Inter — paragraphs, specs, form fields

Both self-hosted variable fonts at `public/fonts/`. **`@font-face` must declare `font-weight: 100 900`.** One file covers the whole range; declaring discrete weights against the same file collapses every weight to one. This was verified by measuring rendered text widths across the axis (772/781/810/887px at weights 100/400/700/900) — a visual check alone would not have caught it.

---

## 4. Stack

| Concern | Choice |
|---|---|
| Framework | Astro 7.1.6, TypeScript strict |
| Styling | Tailwind CSS 4 via the Vite plugin, tokens as CSS custom properties |
| Content | Astro Content Layer + Zod |
| Islands | Preact (`compat: false`) |
| State | nanostores + `@nanostores/persistent` (Task 12) |
| Email | Resend (Task 14) |
| Rendering | `output: 'static'`; only `/api/enquiry` will set `prerender = false` |
| Hosting | Vercel adapter |
| Tests | Vitest (unit), Playwright + axe (e2e) |

### Commands

Full table in `README.md`. The short version:

```bash
npm install
npm run dev            # astro dev  (Astro 7: --background / astro dev stop)
npm run build          # -> dist/client/ + .vercel/output/
npm run preview        # tests/preview-server.mjs, NOT astro preview — see README
npm run test           # vitest run — 63 passing
npm run test:e2e       # playwright — 83 passing, 1 skipped
npx astro check        # 0 errors, 0 warnings, 7 hints (unused params in tools/*.mjs)

npm run extract:catalog -- "path/to/brochure.pdf"   # regenerate products + PNGs
npm run extract:logo    -- "path/to/brochure.pdf"
npm run extract:heroes  -- "path/to/brochure.pdf"
npm run normalise                                   # raw extraction -> products.json
```

### Version traps discovered the hard way

**The plan originally specified Astro 5.** `npm audit` reported 8 high-severity XSS advisories against `astro <= 7.0.9` with no in-major fix — 5.18.2 is the newest 5.x. Upgraded to 7.1.6 at one page rather than at 72.

**`npm audit` reports 3 high findings and that is expected.** All three are one chain: `@astrojs/vercel → @vercel/routing-utils → path-to-regexp@6.1.0` (ReDoS). Accepted because:
- No upstream fix exists. `@vercel/routing-utils` deliberately declares *both* `"path-to-regexp-updated": "npm:path-to-regexp@6.3.0"` and `"path-to-regexp": "6.1.0"`.
- npm's only offered fix is a major downgrade to `@astrojs/vercel@8`, which reintroduces the 8 XSS advisories. **Never run `npm audit fix --force` in this repo.**
- Exposure is build-time with static, author-written route patterns. ReDoS needs attacker-controlled input; none reaches it.

**Two zod instances coexist.** Top-level `zod@3.25.76`; `astro/zod` is **4.4.3** and backs the content schemas. For types, `import type { z } from 'astro/zod'` — `astro:content`'s `z` is a const value with no type namespace and is deprecated in Astro 7. Task 14's enquiry schema should `import { z } from 'zod/v4'` (verified to resolve) to stay on one major.

**Astro 7 keeps two content stores.** `astro sync` writes the production copy; anything Vite *serves* — Vitest included — reads a different one that in practice only `astro dev` writes. Without a workaround every `getCollection` call in tests returns empty. `vitest.config.ts` calls Astro's `sync()` and mirrors the store. If content tests suddenly return nothing, this is why.

---

## 5. Architecture — the admin seam

This is the single most important structural decision.

```
src/data/*.json          source of truth today
      ↓
src/content.config.ts    Content Layer collections + Zod schemas
      ↓
src/lib/catalog.ts       ← THE SEAM. Typed repository functions.
      ↓
pages & components       only ever call catalog.ts
```

**No page or component may import JSON from `src/data/` or call `getCollection` directly.** Task 17 enforces this with a grep that must print PASS twice:

```bash
grep -rn "from '.*data/.*json'" src/pages src/components || echo "PASS"
grep -rn "getCollection" src/pages src/components || echo "PASS"
```

`site.json` is exempt — it is site chrome, not catalogue content.

`src/lib/catalog.ts` exposes: `getDivisions`, `getDivision`, `getCategories`, `getCategory`, `getProducts`, `getProduct`, `getRelatedProducts`, `searchProducts`. All derived values (product counts, related products, filtering) are computed **inside** the module. Callers get plain typed data, never Astro's `{ id, data, collection }` wrappers.

**Migration path:** Astro's Content Layer takes a custom `loader`. Replacing `file()` in `content.config.ts` with a `supabaseLoader()` moves the site onto a database with no changes to `catalog.ts`'s callers. The Zod schemas become the shared contract between loader, admin write-validation and pages.

### Ordering caveat

`product.order` is **per-category** and its values repeat across categories; `category.order` is globally unique 1–15. So unfiltered `getProducts({ limit: n })` returns a semi-arbitrary cross-category slice. Fine for filtered listings and `getRelatedProducts`. **Any curated "featured products" strip must name its products by slug.**

---

## 6. The data

### Distribution — 72 products, verified

| Category | id | Count | Brochure source |
|---|---|---|---|
| Lighting | `lighting` | 10 | p4 (7) + p5 (3) |
| Fans & Ventilation | `fans` | 4 | p10 |
| Water Pumps & Controls | `pumps` | 3 | p11 |
| Insect Killers | `insect` | 1 | p6 |
| Cables | `cables` | 1 | p8 |
| **Electrical Accessories** | `accessories` | **0 — expanding** | — |
| Head & Face Protection | `head` | 7 | p15 |
| Eye Protection | `eye` | 6 | p13 |
| Hearing Protection | `hearing` | 6 | p14 |
| Hand Protection | `hand` | 11 | p16+p17+p18 |
| Safety Footwear | `foot` | 8 | p20 (6) + p21 (2) |
| Harnesses & Fall Arrest | `harness` | 2 | p19 |
| Body Protection | `body` | 4 | p19 |
| Workwear | `workwear` | 9 | p23 (6) + p24 (3) |
| **Spill Control** | `spill` | **0 — expanding** | — |

Electricals: 19. Safety: 53.

> An earlier draft said **74**. That double-counted two "RESISTANCE SPECIFICATIONS" table headings as products. 72 is correct — if you see 74 anywhere, it is stale.

### The two empty categories

Both are `status: "expanding"` with `heroProductSlug: null`. They get real pages with an honest message and an enquiry CTA — no invented products.

- **Spill Control** — the client's brief lists it; the brochure has nothing.
- **Electrical Accessories** — the brochure's only controls (PC-10 pump controller, FS-15 float switch) sit inside its "Water Pumping & Flow Control" section and stay there. Splitting a brochure section across two site categories would invent structure. **Flagged to the client as reversible if they prefer those two moved across.**

### Disambiguation

Seven names repeat. `name` stays the brochure name; a `variantLabel` carries the difference and the UI appends it. All 16 mappings were verified against each record's own specs.

Ventilation Fans ×4 (by size set) · Safety Glasses ×2 · Safety Goggles ×2 · Ear Muff ×2 (NRR 25dB / 20dB) · Safety Vests ×2 (velcro / zipper) · Construction Gum Boots ×2 (with / without steel toe) · Low Cut Safety Shoes ×2 (KPU / suede).

One typo corrected: `"Ear Plugs dispsenser"` → `"Ear Plugs Dispenser"`.

### EN 388 glove ratings

6 products carry verified ratings; 66 do not. Page 16's four gloves and page 17's Chem Guard and Cut Flex were read off rendered pages and cross-checked against per-line PDF coordinates. Latex Coated Gloves and Impact Ultra D have **no printed row** — `en388` is absent rather than guessed.

**Chem Guard's tear resistance is printed as `0`, not `X`.** Those mean different things — 0 is a tested result, X is untested. Render the literal printed value; do not normalise or hide it.

### The extraction tooling — two behaviours that fail silently

Documented in `tools/README.md`. If you regenerate assets, do not "simplify" either:

1. **Clip forwarding.** Brochure product photos are rectangles with **opaque black backgrounds**, knocked out at render time by `clipImageMask`. Forward every clip/mask/group push *and its matching pop, unconditionally*; filter only fill operations. Dropping clips puts every product in a black box — which looks fine on a white page and is ruinous on this dark layout.

2. **Same-column assignment.** Images *and spec lines* are matched within the product's own page column. Nearest-overall matching swaps content between columns on two-column pages. This bug shipped once: spec text bled across columns on **56 of 72 products** before it was caught.

**Product image resolution is a real constraint.** Native sizes are 100–440px wide. Sharp at the sizes the design uses (~180px tiles, ~400px spotlight) but must never be upscaled beyond ~2×. Components should take `srcset` so higher-resolution supplier photography drops in later without markup changes.

**Do not "fix" the black panel in the two Safety Vests images.** `p19-safety-vests.png` and `p19-safety-vests-2.png` each contain a third element on an opaque black background. This looks exactly like the clip-forwarding failure above and has already been flagged once as a suspected regression. It is not. Brochure page 19 shows it as a deliberate **DAY | NIGHT reflectivity comparison panel** — the same vest in daylight beside the same vest under night-time flash, demonstrating the reflective strips. The extraction is correct; only the overlaid "DAY"/"NIGHT" text was dropped, along with every other text overlay.

Verified: all 72 assets were scanned for opaque black plates and only these two flagged, both legitimate. If a product page ever needs it, the right treatment is a caption explaining the panel — not editing the image.

Because of that panel, Body Protection's `heroProductSlug` is **`nonwoven-disposable-coverall`**, not a vest: at 92px in the category grid the DAY/NIGHT plate reads as a black rectangle on the dark tile. The images stay as they are; only the tile's choice of hero changed.

---

## 7. Progress

### Done and verified

| # | Task | Notes |
|---|---|---|
| 1 | Astro scaffold and toolchain | Astro 7 upgrade; audit rationale recorded |
| 2 | Design tokens, fonts, base layout | Variable-font axis verified by measurement |
| 3 | Extraction tooling | All assets byte-identical to reference; spec-bleed fixed |
| 4 | Content schemas and data | 7 tests; EN 388 independently verified |
| 5 | Catalog repository | 20 tests; the admin seam |
| 6 | Design system primitives | `ink-muted` token added; contrast switch confirmed |
| 7 | Header, footer, mobile nav | Verified against 11 criteria with Playwright; 4 defects fixed |
| 8 | Catalogue components | ProductCard, CategoryTile, ProductGrid, SpecTable, En388Table |
| 9 | Home page sections | 8 sections, all data-driven; red-fill contrast fix applied site-wide |
| 10 | Catalogue, category, product pages | 15 + 72 pages, filter island, breadcrumbs |
| 11 | Editorial pages | Division landings, about, why-spartan, industries, contact, 404 |
| 12 | Enquiry basket store | Persistent, quantity-clamped, corrupt-storage resilient |
| 13 | Enquiry UI islands | Button, badge, drawer with focus trap |
| 14 | Enquiry submission | Schema, `/enquiry` page, `/api/enquiry` endpoint |
| 15 | SEO and structured data | `Seo.astro` sole emitter; no `offers`/`price`/`rating` ever; og:image; favicon |
| 16 | End-to-end tests | Playwright + axe, desktop and mobile — 83 passing, 1 skipped |
| 17 | Launch readiness | Lighthouse, seam verification, README, content-editing guide, launch checklist |

**63 unit tests and 83 e2e tests passing (1 skipped). `astro check` 0 errors, 0 warnings, 7 hints. `astro build` clean — 96 pages + 404 + one SSR endpoint.**

Task 7's defects, for the record: focus escaped the modal panel when a click landed on a non-focusable part of it; footer socials measured 38×38 not 44×44 (an `::after` overlay enlarged the hit area but not the reported box); a text-glyph chevron survived; and a hover-specificity collision turned social icons red on a red fill, making them vanish.

Two Preact **hydration mismatches** were found and fixed the same way, in `EnquiryBadge` and `EnquiryForm`. `useStore` returns `store.get()` on the first client render, and `get()` on an unmounted persistent atom restores from `localStorage` — so the render that *hydrates* already had the basket while the server, having no `localStorage`, rendered the empty state. The fix is a `mounted`/`ready` gate so hydration matches exactly and the basket's arrival is an ordinary update. **Any future island reading a persistent store needs the same gate.**

### Reusable pattern — dynamic product images

`astro:assets` cannot take a runtime string path. Established in Task 8 and reused by Tasks 9–11:

```ts
const productImages = import.meta.glob<{ default: ImageMetadata }>('/src/assets/products/*.png');
const loader = productImages[`/src/assets/products/${product.images[0]}`];
const image = loader ? (await loader()).default : undefined;
```

Root-absolute pattern gives root-absolute keys, so it works unchanged from any directory. Lazy (no `eager`) so only rendered images are emitted — verified: 26 referenced images produced 52 variants, not all 72. Astro clamps `widths` down to the source's native size, so upscaling cannot happen by accident; `widths` requires `sizes`.

### Build output moved to `dist/client/`

Adding the first server-rendered route (`/api/enquiry`, the only one) switched the Vercel adapter into hybrid mode. Static pages now emit to **`dist/client/`**, not `dist/`. Any script or check that globs `dist/products` or `dist/catalogue` needs the `client/` segment.

The SSR bundle is **not** left in `dist/server/` — the adapter moves it to `.vercel/output/functions/_render.func` and removes the staging directory, so `dist/` ends up containing only `client/`. To confirm the endpoint built, check that function exists and that `.vercel/output/config.json` routes `^/api/enquiry/?$` to `_render`.

Current output: 96 `index.html` + `404.html` — 72 product pages, 15 category pages, the catalogue index, and 8 top-level pages, plus `sitemap-index.xml`.

### Two CSS traps that fail silently

**Tailwind utilities lose to Astro scoped styles.** Utilities compile into `@layer utilities`; Astro's scoped component styles are unlayered, and **unlayered CSS beats every layer regardless of specificity**. Passing `max-sm:hidden` to a component whose own scoped rule sets `display` does nothing at all. Wrap the component in an element the page owns instead. `Chevron` sizing works through utilities *only* because `Chevron` declares no width of its own.

**The `hidden` attribute can never hold its space.** Tailwind 4's preflight ships `[hidden]:where(:not([hidden=until-found])){display:none!important}`, and no ordinary author rule outranks `!important`. Using `hidden` for a "not yet hydrated" placeholder cost 134px of layout shift and CLS 0.042; a plain class gave 0px and CLS 0.000. `hidden` is still correct where `display: none` is genuinely the intent.

### SEO — the rule that must stay true

**The site has no prices and no reviews.** Product structured data never emits `offers`, `price`, `priceCurrency`, `availability`, `aggregateRating` or `review`. Google accepts them and then displays a price that does not exist — the structured-data equivalent of inventing a specification. `seo.ts` enforces it and a test asserts it; the built output is swept for all six strings and returns zero.

`Seo.astro` is the **sole** emitter of `<title>`, meta description and canonical — `BaseLayout` forwards to it and emits none itself. Emitting from both would duplicate all three on every page. Verified: 97/97 pages have exactly one of each, all titles and descriptions distinct.

`organizationJsonLd` is on the **home page only**. It describes the company, not the document; 97 copies would be 97 competing declarations of one entity.

JSON-LD goes through `set:html` (a plain expression HTML-escapes the quotes and breaks the JSON), so `serialiseJsonLd()` rewrites every `<` as `<`. `JSON.parse` returns an identical string, but a `</script>` can never reach the HTML parser intact. No catalogue value contains `<` today — this matters when the admin dashboard lets arbitrary text in.

`og:image` is a build-time 1200×630 JPEG crop of the division hero, `position: bottom` (a centre crop of `safety.jpg` decapitates the workers). `safety.jpg` site-wide, `electrical.jpg` on Electricals pages. Forced to JPEG because several link-preview scrapers still will not render WebP.

**`public/robots.txt` hard-codes the sitemap URL** and `site` is still a placeholder, so it will be wrong until the domain is set. A `src/pages/robots.txt.ts` static endpoint would emit the real value at build time and make that failure impossible — worth doing when the domain lands.

### Lighthouse — measured, Task 17

Lighthouse 12.8.2 against `npm run preview`, headless Chrome, Lighthouse's own mobile and desktop presets. Target was ≥95 on all four categories.

| Page | Preset | Perf | A11y | BP | SEO |
|---|---|---|---|---|---|
| `/` | mobile | 95–97 | 100 | 100 | 100 |
| `/catalogue/hand-protection` | mobile | 99 | 100 | 100 | 100 |
| `/products/grip-guard-gp5` | mobile | 98 | 100 | **96** | 100 |
| all three | desktop | 100 | 100 | 100 | 100 |

CLS 0.000 and TBT 0 ms everywhere. Two numbers are worth understanding:

**Best Practices 96 on the product page is `image-size-responsive`, and it is not fixable here.** The spotlight image is displayed at 257×308 and its source is natively 257×308; Lighthouse wants 386×462 for a DPR-2 screen. This is exactly the resolution constraint in §6 — the brochure-extracted photography is 100–440px and must never be upscaled. Desktop scores 100 because DPR is 1. It resolves when the client supplies real photography, with no markup change (`srcset` is already in place). **Do not "fix" this by adding `widths` that upscale.**

**Home mobile Performance is 95–97 across five runs**, the lowest headroom on the site. LCP is a *text* element (`.hero__lede`), ~83% render delay under the 4× CPU throttle, behind 41 KB of render-blocking CSS. Two production factors are absent from the measurement: the preview server sends no `Content-Encoding` and no `Cache-Control`, so `uses-text-compression` (~82 KB) and `cache-insight` (~234 KB) both vanish on Vercel. The remaining lever is `build.inlineStylesheets: 'always'`, which was **not** taken — it inlines ~41 KB into all 96 pages and loses cross-page CSS caching, which is a worse trade at a score that already clears the bar.

### One defect Lighthouse found that axe did not

`label-content-name-mismatch` — WCAG 2.5.3 Label in Name, serious impact — on every `EnquiryButton`. The button reads **ENQUIRE** and its accessible name was `Add <product> to enquiry list`, which does not contain "Enquire". A voice-control user saying "click Enquire" could not activate the one control that builds an enquiry. The static name also went stale the moment the label changed to "Added".

Fixed by deriving the name from the visible label: `` `${visible}: ${name}` ``.

**Two harnesses missed it.** axe's rule for this is experimental and off by default, so the e2e axe pass never ran it; Lighthouse weights it 0, so it never showed up in the accessibility score either — the category read 100 with a serious WCAG A failure present on 72 product cards. **A green axe run is not a claim that a page passes WCAG.**

### What a next session picks up

The build is done. Three things follow it, in rough order:

1. **Deployment.** Vercel is assumed and configured but never confirmed with the client (§8 item 3), and nothing has been deployed. The domain has to land first — it changes `astro.config.mjs` *and* `public/robots.txt`, and both must match (§7 SEO). Doing it properly means replacing `public/robots.txt` with a `src/pages/robots.txt.ts` endpoint so the two can never diverge again. `.env` needs the Resend credentials in Vercel's project settings, not just locally.

2. **The admin dashboard.** This is what §5 exists for. Replace `file()` in `content.config.ts` with a database loader; `catalog.ts` and all 96 pages are untouched. The Zod schemas become the write-validation contract. Two things to carry across: `serialiseJsonLd()` escaping matters the moment arbitrary text can enter the catalogue (§7), and the "never invent product data" rule needs to survive contact with a UI that has empty fields inviting to be filled — `docs/CONTENT-EDITING.md` is the statement of that rule for whoever maintains data in the meantime.

3. **Arabic localisation, deferred.** The brochure cover carries an Arabic wordmark (سبارتان) that is unused in this build. A second locale means RTL, a translated content model, and `hreflang` — it is a project, not a task.

Two harness facts that will otherwise waste an hour. `client:visible` islands do not hydrate in a background Chrome tab — the rendering pipeline is frozen, IntersectionObserver never fires, and every enquiry button stays pending; force a paint or keep the tab foregrounded. And neither browser harness used here synthesises a `click` from synthetic Enter/Space on a `<button>`, so keyboard *activation* of buttons was never observed working under automation, though the focus trap, tab order and Escape handling all were.

---

## 8. Open items needing the client

None block development — placeholders are in place and marked.

1. **Real contact details** — address, phone, email, WhatsApp, hours. Currently placeholders in `src/data/site.json`.
2. **Resend API key + destination sales address.** Until supplied, `/api/enquiry` logs to console and returns success without delivering, so the flow stays testable.
3. **Deployment target** — Vercel assumed.
4. **Domain** — `astro.config.mjs` has `site: 'https://spartan.example'`. Sitemap and canonical URLs depend on it.
5. **Confirm the eight "Industries We Serve"** — currently inferred from the product mix, not stated in the brochure. Marked with an HTML comment where used.
6. **Certifications** — none are claimed anywhere on the site until the client supplies them.

Also worth raising: **higher-resolution product photography** would lift the design considerably (see the resolution constraint in §6), and the **brochure PDF needs compressing** before the "Download brochure" buttons can link to it — the source is ~163MB.

---

## 9. Working agreements that produced good results

Worth keeping if you continue with agents:

- **Verify against the real-world source, not the previous implementation.** Task 3's refactor was proven byte-identical to its source scripts and still shipped a defect, because the source scripts were themselves wrong. The bug only surfaced when the extracted *values* were inspected.
- **Give ground truth, ask for independent verification.** EN 388 ratings were supplied as a table *and* the agent was told to re-read the rendered pages. It confirmed page 16 and corrected the brief's description of page 17.
- **Absent beats guessed.** Repeatedly the right answer was to leave a field out.
- **Name the specific failure mode.** "Confirm Archivo loaded rather than a fallback" produced width measurements across the weight axis; "check it looks right" would not have.

---

## 10. Known cleanup

- `design/assets/products/` duplicates `src/assets/products/` (~10MB). Deliberate — the reference set enables byte-comparison verification after a re-extraction. Drop it if that stops being useful.
- 7 `astro check` hints, all unused-parameter warnings in `tools/*.mjs`. Harmless.
- **The footer's social icons have no destinations.** They render and hover but link nowhere, and `sameAs` is correspondingly absent from `organizationJsonLd`. Either the client supplies the URLs or the icons come out — a link that goes nowhere is worse than no icon. Not in §8 because it is a build decision as much as a client one.
- `playwright-report/` and `test-results/` are local run artefacts.
