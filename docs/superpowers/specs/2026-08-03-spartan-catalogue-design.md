# Spartan Catalogue Website — Design Spec

**Date:** 2026-08-03
**Status:** Approved (design direction "Forge" selected 2026-08-03)
**Source material:** `08012026-001 - Spartan Brochure.pdf` (25 pages), brand logo (vector, extracted from brochure), partner brief.

---

## 1. Goal

A catalogue-style marketing website for **Spartan**, a brand with two divisions — Spartan Electricals and Spartan Safety. The site presents 72 products across 15 categories, lets trade buyers assemble a multi-product enquiry and submit it as a single RFQ, and is architected so a **CMS-backed admin dashboard can be added later without rewriting page code**.

This is a catalogue and lead-generation site. It is **not** an e-commerce store: no prices, no cart, no checkout, no user accounts.

### Success criteria

1. All 72 brochure products are browsable, filterable and individually addressable by URL.
2. A visitor can add products from anywhere in the catalogue to an enquiry list and submit it in one action.
3. Lighthouse ≥ 95 for Performance, Accessibility, Best Practices and SEO on Home, a category page and a product page.
4. Swapping the product data source from local JSON to a database requires changing **one module** (`src/lib/catalog.ts`) and no page or component files.
5. No invented products, specifications, certifications or imagery anywhere on the site.

### Non-goals

- Pricing, stock levels, payments, accounts.
- Multi-language / Arabic localisation (the brand has an Arabic wordmark; deferred, see §11).
- The admin dashboard itself — this spec only guarantees the seam it will plug into.

---

## 2. Brand foundations

All values below were **sampled from the brochure PDF**, not chosen.

### Colour

| Token | Hex | Use |
|---|---|---|
| `red` | `#EB2927` | Primary brand red. Large/bold text, fills, rules, icons. |
| `red-dark` | `#B81C1B` | Hover state for red fills. |
| `red-deep` | `#970000` | **Small text on light backgrounds** (see accessibility rule below). |
| `black` | `#08080A` | Page background (dark sections). |
| `panel` | `#0E0E11` | Alternating dark section background. |
| `card` | `#151519` | Dark card / tile surface. |
| `line` | `#232329` | Dark-mode borders and grid rules. |
| `paper` | `#F6F6F7` | Light section background. |
| `grey` | `#8A8A92` | Muted text on dark. |
| `grey-lt` | `#B4B4BC` | Body text on dark. |
| `ink` | `#0E0E11` | Body text on light. |

**Accessibility rule (must be enforced):** `#EB2927` measures **4.67:1 on `#08080A`** (passes AA at any size) but only **4.30:1 on white** (fails AA for normal-size text). Therefore:

- On dark backgrounds, `red` may be used for text at any size.
- On light backgrounds, `red` is permitted **only** for text ≥ 24px, or ≥ 18.66px bold, or for non-text elements (icons, rules, fills). All smaller red text on light **must** use `red-deep` (`#970000`, 9.09:1).

### Typography

- **Display:** Archivo (variable, weights 400–800) — headings, eyebrows, buttons, numerals, table headers.
- **Body:** Inter (variable, weights 400–700) — paragraphs, specs, form fields.
- Both self-hosted as `.woff2` variable fonts. A single file covers the full weight range per family; `@font-face` must declare `font-weight: 100 900` (declaring discrete weights against the same variable file collapses everything to one weight).
- Display headings: `letter-spacing: -0.02em` to `-0.035em`, `line-height: 0.94–1.06`.
- Eyebrows: 11px, weight 700, `letter-spacing: 0.22em`, uppercase, red, preceded by a 16×2px red dash.

### Logo — mandatory rules

Two official lockups exist, both extracted as **vector** from the brochure. Neither was redrawn.

| Asset | Composition | Use on |
|---|---|---|
| `spartan-logo.svg` | Red helmet, **black** wordmark, red rule, black ® | Light backgrounds |
| `spartan-logo-light.svg` | Red helmet, **white** wordmark, red rule, white ® | Dark backgrounds |

- Never recolour, redraw, distort, rotate, add effects to, or change the proportions of either lockup.
- Minimum clear space on all sides = the height of the helmet mark ÷ 2.
- Minimum rendered height: 28px.
- The brochure cover also carries an Arabic wordmark (**سبارتان**). It is **not** used in this build; see §11.

---

## 3. Information architecture

```
/                       Home
/about                  About Spartan
/electricals            Division landing — Spartan Electricals
/safety                 Division landing — Spartan Safety
/catalogue              All products, filterable
/catalogue/[category]   Category listing        (15 pages)
/products/[slug]        Product detail          (72 pages)
/why-spartan            Why Spartan
/industries             Industries We Serve
/contact                Contact Us
/enquiry                Enquiry list + submission form
/api/enquiry            POST endpoint (server-rendered)
/404
```

This satisfies the partner's proposed structure. "Product Categories" is served by `/catalogue`, which lists all 15 categories and doubles as the filterable all-products view.

Primary nav: Home · About · Electricals · Safety · Industries · Contact, plus a persistent enquiry-list indicator showing item count.

---

## 4. Content model

Three entities. Field names are normative.

```ts
Division  { id, slug, name, blurb, heroImage, order }

Category  {
  id, slug, name, divisionId, description,
  heroProductSlug,          // product whose image represents the category
  status: 'active' | 'expanding',
  productCount,             // derived, not stored
  order
}

Product {
  slug,                     // unique, URL-safe
  name,
  categoryId,
  images: string[],         // ordered; [0] is primary
  specs: { label, value }[],
  en388?: {                 // gloves only
    abrasion, bladeCut, tear, puncture, tdmCut
  },
  variants?: string[],      // e.g. size/power options stated in the brochure
  status: 'published' | 'draft',
  sourcePage: number,       // brochure page — provenance, not shown to users
  order
}
```

### Naming and disambiguation

The brochure repeats several product names. These **must** be disambiguated into unique slugs and display names using their own stated specifications — never invented differentiators:

| Brochure name | Occurrences | Disambiguate by |
|---|---|---|
| Ventilation Fans | 4 | Size/power set (e.g. `ventilation-fans-6-8-10-inch`) |
| Safety Glasses | 2 | Temple type (adjustable vs lightweight) |
| Safety Goggles | 2 | Venting (direct vs indirect) |
| Ear Muff | 2 | NRR rating (25dB vs 20dB) |
| Safety Vests | 2 | Closure (zipper vs velcro) |
| Construction Gum Boots | 2 | Steel toe vs without steel toe |
| Low Cut Safety Shoes | 2 | Upper material (KPU vs suede leather) |

One brochure typo is corrected in display copy: **"Ear Plugs dispsenser" → "Ear Plugs Dispenser"**.

### Content gaps — handling

Per the approved decision, gap categories are built but honestly labelled. **No placeholder products, specs or images are to be invented.**

| Category | Reality | Treatment |
|---|---|---|
| **Spill Control** | Zero brochure content | Category page exists with `status: 'expanding'`, an explanatory empty state ("Our spill control range is expanding — contact us for current availability") and a direct enquiry CTA. Appears in nav and grids with an "Range expanding" badge instead of a product count. |
| **Cables** | 1 product (CAT.6 UTP) | Normal category page; genuinely one product. |
| **Electrical Accessories** | Zero. The brochure's only controls (PC-10 controller, FS-15 float switch) belong to the "Water Pumping & Flow Control" section and stay there — splitting a brochure section across two site categories would invent structure. | Same treatment as Spill Control: `status: 'expanding'`, explanatory empty state, enquiry CTA. |

Brochure page 23 carries an internal note that shirt specs are pending. The two affected products (Fire Retardant Shirts, Cotton Pants & Shirts) publish with the specs that **are** stated; no fabricated fields.

---

## 5. Data layer architecture — the admin seam

This is the single most important architectural decision, driven by the requirement to add an admin dashboard later.

**Rule: no page or component ever imports content directly.** Everything goes through one repository module.

```
src/data/**.json          ← source of truth today (generated by tools/, editable by hand)
        ↓
src/content.config.ts     ← Astro Content Layer collections + Zod schemas
        ↓
src/lib/catalog.ts        ← THE SEAM. Typed repository functions.
        ↓
pages & components        ← only ever call catalog.ts
```

`src/lib/catalog.ts` exposes:

```ts
getDivisions()
getDivision(slug)
getCategories(opts?: { divisionId?, status? })
getCategory(slug)
getProducts(opts?: { categoryId?, divisionId?, limit?, status? })
getProduct(slug)
getRelatedProducts(slug, limit)
searchProducts(query)
```

**Migration path to admin:** Astro 5's Content Layer API takes a custom `loader`. Replacing the `glob()` loader in `content.config.ts` with a `supabaseLoader()` — and switching the affected routes to `prerender = false` (or rebuilding on webhook) — moves the site onto a database with **no changes to `catalog.ts`'s callers**. Zod schemas become the shared contract between the loader, the admin's write validation, and the pages.

Consequences to respect while building:
- Never `import` a JSON file inside a `.astro` page.
- Every derived value (product counts, related products, category hero images) is computed inside `catalog.ts`, not in templates.
- All IDs and slugs are stable and explicit in the data, never derived from array position.

---

## 6. Visual design — "Forge"

Approved direction. Derived from the industrial reference the user supplied, rebuilt with Spartan's own assets, palette and content.

### Section rhythm

The page alternates dark and light to create pace:

1. **Hero** — dark. Full-bleed brochure photograph, heavy left-to-right scrim, tone-on-tone chevron watermark. Utility bar (absolute, top) → nav (absolute, below it) → content anchored bottom with ~196px top padding so nothing collides. Pull-quote top-right. Massive uppercase display headline split **red line over white line**, ending in a full stop. Primary solid-red CTA + outlined pill secondary; "Scroll down" pill far right.
2. **About** — `panel`. Two columns: copy + stat strip left, product cutout right. Chevron bleeding off the right edge.
3. **What we supply** — light. Centred eyebrow + heading, then a 3×2 grid of white cards: red line icon, red heading, grey body, outlined pill "Read More ›". Hairline `#E4E4E7` grid, no gaps.
4. **Trust band** — full-bleed red. Uppercase lead + outlined industry chips. Chevrons at both ends at 9% white.
5. **Categories** — dark. 4×4 grid: 15 category tiles + a solid-red "72 / View every product" tile.
6. **Product spotlight** — `panel`. Radial-lit product cutout left, spec table + EN 388 table right.
7. **FAQ** — light. `<details>` accordion, circular +/– affordance that inverts to red when open.
8. **Enquiry CTA** — dark. Copy left, compact form card right.
9. **Footer** — pure black. Contact strip (circular red icons) + newsletter with red Submit → link columns with red headings → circular socials → bottom bar.

### Components

`Header` · `UtilityBar` · `Hero` · `Eyebrow` · `SectionHeading` · `PillButton` · `SolidButton` · `IconCard` · `TrustBand` · `CategoryTile` · `ProductCard` · `ProductGrid` · `SpecTable` · `En388Table` · `Accordion` · `EnquiryButton` · `EnquiryDrawer` · `EnquiryForm` · `Footer` · `Chevron` (decorative SVG) · `SEO`

### Motion

150–300ms, `ease-out` entering / `ease-in` exiting. `transform` and `opacity` only. One or two animated elements per viewport. All motion wrapped in `@media (prefers-reduced-motion: no-preference)`.

### Iconography

Single family of custom 24×24 line SVGs, `stroke-width: 1.6`, round caps and joins. **No emoji.** Icon-only controls carry `aria-label`.

---

## 7. Enquiry basket

The primary conversion mechanism.

- **State:** a small store (nanostores) persisted to `localStorage` under `spartan.enquiry.v1`. Shape: `{ slug, name, qty, note }[]`.
- **Entry points:** "Add to enquiry" on every product card and product detail page. Adding an item shows a toast (`aria-live="polite"`, auto-dismiss 4s) and increments the header badge.
- **Drawer:** slide-over listing items with quantity steppers, per-item note field, remove, and "Review enquiry".
- **`/enquiry`:** full list + contact form (name, company, email, phone, country, message). Email is the only strictly required contact field alongside name.
- **Submission:** `POST /api/enquiry`, server-rendered (`export const prerender = false`).
  - Validated server-side with the same Zod schema used client-side.
  - Anti-abuse: honeypot field, minimum time-on-form check, per-IP rate limit.
  - Email delivered via Resend to the Spartan sales address, with a plain-text product manifest.
  - Responses: `200` clears the basket and shows confirmation; `4xx/5xx` preserves the basket and surfaces a retry with the error reason.
- **Degradation:** the form works without JavaScript via a standard POST; only the basket requires JS. Products can also be enquired about individually from a product page without ever opening the drawer.

**Required from the user before launch:** a Resend (or equivalent) API key and the destination sales email address. Until supplied, the endpoint logs to console in development and the form is disabled in production builds with a clear notice.

---

## 8. Asset pipeline

The extraction tooling is committed to `tools/` so assets can be regenerated when the brochure is revised.

| Script | Output |
|---|---|
| `tools/extract-catalog.mjs` | `src/data/products.json` + 72 transparent product PNGs |
| `tools/extract-logo.mjs` | Both vector logo lockups |
| `tools/extract-heroes.mjs` | 6 photographs — the 5 section dividers plus the cover — text overlays removed |

Two hard-won details this tooling must preserve:

1. **Clip forwarding.** Brochure product photos are rectangles with opaque **black** backgrounds, knocked out at render time by `clipImageMask`. A device filter that forwards only fill operations produces black boxes. The renderer **must** forward every clip/group/mask push *and* its matching pop unconditionally, filtering only the fills.
2. **Multi-image products.** Several products are composites (Full Body Harness = harness + lanyard; Safety Vests = 2 vests + a day/night panel). Images are assigned to the nearest product **within the same page column**, then the whole cluster is rendered as one region — cross-column assignment produces wrong images.

Images are processed at build time by `astro:assets` into AVIF with WebP fallback, `loading="lazy"` and explicit `width`/`height` below the fold, eager for the LCP image.

**Known constraint:** native product images are 100–440px wide. They are sharp at the sizes this design uses (≈180px tiles, ≈400px spotlight) but must never be upscaled beyond ~2×. Components take `srcset` so higher-resolution supplier photography can be dropped in later without markup changes.

---

## 9. Accessibility

Target: **WCAG 2.1 AA**.

- Contrast rule from §2 enforced; palette pairings verified in both themes.
- Semantic landmarks, one `<h1>` per page, sequential heading levels.
- Visible focus rings (2px, `red` on dark / `red-deep` on light) — never removed.
- Full keyboard operation. Drawer traps focus, closes on `Escape`, restores focus to its trigger.
- Touch targets ≥ 44×44px.
- Form fields have persistent visible labels (not placeholder-only); errors render adjacent to their field, are announced via `role="alert"`, and focus moves to the first invalid field on submit.
- All meaningful images have descriptive `alt`; decorative chevrons are `aria-hidden`.
- Spec tables use real `<table>` markup with scoped headers.
- Respects `prefers-reduced-motion`.

## 10. Performance & SEO

- Static output; zero JS on pages with no island. Interactive islands: mobile nav, enquiry basket, catalogue filters, FAQ accordion (native `<details>`, no JS).
- Self-hosted fonts, `font-display: swap`, preload the two variable files. No external network requests at runtime.
- CLS < 0.1 via explicit media dimensions and reserved space.
- Per-page title/description/canonical, Open Graph and Twitter cards.
- JSON-LD: `Organization` (site-wide), `Product` per product page, `BreadcrumbList` on category and product pages, `ItemList` on category pages.
- `sitemap.xml` and `robots.txt` generated at build.

## 11. Deferred

- **Arabic / bilingual.** The brand owns an Arabic wordmark and likely serves a Gulf market. Deferred, but the build must not obstruct it: no hard-coded text direction, copy kept out of components where practical.
- **Admin dashboard.** Out of scope; §5 defines the seam it will use.
- **Higher-resolution product photography.** Site accepts it without markup changes.
- **Downloadable brochure PDF.** Buttons are present; the 162MB source needs compression before it is linked.

## 12. Open items requiring user input

These do not block the build; placeholders are used and clearly marked.

1. Real contact details — address, phone, email, WhatsApp, trading hours.
2. Resend (or equivalent) API key + destination sales address.
3. Deployment target (Vercel assumed; Netlify equivalent).
4. Domain name.
5. Confirmation of the eight "Industries We Serve" — currently inferred from product mix, not stated in the brochure.
6. Any certifications the brand holds (ISO, CE, EN) — none are claimed anywhere on the site until supplied.

---

## 13. Technical stack

| Concern | Choice |
|---|---|
| Framework | Astro 5, TypeScript strict |
| Styling | Tailwind CSS 4, design tokens as CSS custom properties |
| Content | Astro Content Layer + Zod |
| Islands | Preact (smallest runtime for the few interactive pieces) |
| State | nanostores + `@nanostores/persistent` |
| Email | Resend |
| Rendering | `output: 'static'`, `prerender = false` on `/api/enquiry` only |
| Hosting | Vercel adapter |
| Quality | ESLint, Prettier, `astro check`, Vitest (catalog + validation), Playwright (basket + enquiry flow), Lighthouse CI |
