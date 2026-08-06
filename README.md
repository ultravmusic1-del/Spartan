# Spartan — product catalogue website

A catalogue and lead-generation site for **Spartan**, an industrial brand with two divisions:

- **Spartan Electricals** — lighting, fans and ventilation, water pumps, cables, insect killers
- **Spartan Safety** — head, eye, hearing, hand, foot and body protection, fall arrest, workwear

**79 products across 15 categories** — 72 from the client's product brochure, plus 7 industrial fans from the per-family datasheet PDFs. Built with Astro 7, TypeScript strict, Tailwind CSS 4 and Preact islands; deployed to Vercel.

## This is a catalogue, not a shop

There are no prices, no cart, no checkout and no accounts. The conversion mechanism is a multi-product **enquiry basket**: a buyer collects products while browsing and submits one RFQ through `/enquiry`.

That is not a missing feature — it is a constraint the code enforces. Product structured data never emits `offers`, `price`, `priceCurrency`, `availability`, `aggregateRating` or `review`. Google will happily accept those fields and then render a price that does not exist. `src/lib/seo.ts` refuses to emit them, a unit test asserts it, and the built output is swept for all six strings.

### The hard rule: never invent product data

No made-up specifications, certifications, ratings, dimensions or descriptions. Every value traces to the client's brochure PDF. Where data is missing it stays missing and gets an honest empty state — two categories legitimately have zero products and say so.

This is safety equipment. A fabricated protection rating is a hazard, not a cosmetic flaw.

---

## Setup

Requires **Node ≥ 22.12**.

```bash
npm install
cp .env.example .env     # optional; see Environment variables below
npm run dev
```

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Astro dev server. Astro 7 supports `astro dev --background`, then `astro dev stop` / `status` / `logs`. |
| `npm run build` | Production build. Output is **`dist/client/`**, not `dist/` — see below. |
| `npm run preview` | **A custom server** (`tests/preview-server.mjs`), *not* `astro preview`. See below. |
| `npm run test` | Vitest unit tests — **63 tests**. |
| `npm run test:e2e` | Playwright + axe — **83 tests + 1 skipped**, across desktop and mobile projects. |
| `npx astro check` | Type/template check — 0 errors, 0 warnings, 7 hints (unused params in `tools/*.mjs`). |
| `npm run extract:catalog -- "path/to/brochure.pdf"` | Regenerate products and product PNGs from the brochure. |
| `npm run extract:logo -- "path/to/brochure.pdf"` | Re-extract the logo lockups. |
| `npm run extract:heroes -- "path/to/brochure.pdf"` | Re-extract the hero photographs. |
| `npm run normalise` | `products.raw.json` → `products.json`. |

The four extraction scripts are run **only when the brochure is revised**. Their output is committed, so a normal build never touches them. Read `tools/README.md` before running any of them.

### Why `preview` is a custom server

`astro preview` does not work in this repo. `@astrojs/vercel` ships no preview entrypoint and exits with *"The @astrojs/vercel adapter does not support the preview command."*

A plain static file server would not work either. Adding the site's one server-rendered route split the build in two: static pages land in `dist/client/`, and the SSR bundle is moved by the adapter to `.vercel/output/functions/_render.func` (`dist/server/` is deleted). A static server would therefore serve 96 of the 97 routes and 404 the one that matters — `/api/enquiry`, the end of the only conversion path.

`tests/preview-server.mjs` serves both halves the way Vercel does: filesystem first out of `dist/client/`, then anything matching a `dest: "_render"` route in `.vercel/output/config.json` goes to the real built SSR handler, then `404.html` with a 404 status. The route table is read from the emitted config rather than hard-coded, so it cannot drift from what actually deploys. Nothing in it is a stub.

**Anything that globs the build output needs the `client/` segment.** `dist/products/…` is wrong; `dist/client/products/…` is right.

---

## Environment variables

Copy `.env.example` to `.env`. `.env` is gitignored — never commit real values. Both variables are read **at request time** by `src/pages/api/enquiry.ts`.

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend API key. https://resend.com/api-keys |
| `ENQUIRY_TO_EMAIL` | The client's sales inbox — where enquiries are delivered. |
| `ENQUIRY_FROM_EMAIL` | Optional. Must be on a domain verified in the Resend account. |

### What happens when they are unset

While **either** `RESEND_API_KEY` or `ENQUIRY_TO_EMAIL` is empty, the endpoint validates the payload as normal, logs the full enquiry to the server console, and returns:

```json
{ "ok": true, "delivered": false }
```

`delivered: false` is deliberate and load-bearing. The whole flow stays exercisable end to end before credentials exist, and **the site never reports an enquiry as sent when it was not** — a site that claims to have sent an RFQ it dropped loses the lead silently.

With `ENQUIRY_FROM_EMAIL` left empty the endpoint sends from Resend's own always-verified `onboarding@resend.dev`, which works with any key. Replies reach the enquirer either way, via `Reply-To`.

The endpoint also carries a honeypot field and an in-memory rate limit of 5 submissions per client per 10 minutes. That limit is per serverless instance and is honest about what it does and does not stop — read the comment in `src/pages/api/enquiry.ts` before relying on it.

---

## Architecture — the admin seam

This is the single most important structural decision in the repo. The client will add a CMS-backed admin dashboard later, and the architecture exists to make that a one-module change.

```
src/data/*.json          source of truth today
      ↓
src/content.config.ts    Content Layer collections + Zod schemas
      ↓
src/lib/catalog.ts       ← THE SEAM. Typed repository functions.
      ↓
pages & components       only ever call catalog.ts
```

**No page or component may import catalogue JSON from `src/data/` or call `getCollection` directly.** Two greps must return nothing:

```bash
grep -rn "getCollection" src/pages src/components
grep -rn "data/\(products\|categories\|divisions\)\.json" src/pages src/components
```

`src/data/site.json` is exempt — it is site chrome (phone, email, address, industries), not catalogue content, and pages import it directly.

`src/lib/catalog.ts` exposes `getDivisions`, `getDivision`, `getCategories`, `getCategory`, `getProducts`, `getProduct`, `getRelatedProducts` and `searchProducts`. Every derived value — product counts, related products, filtering, search — is computed **inside** the module. Callers get plain typed data, never Astro's `{ id, data, collection }` entry wrappers.

### Migration path to a CMS

Astro's Content Layer takes a custom `loader`. Replacing `file()` in `src/content.config.ts` with, say, a `supabaseLoader()` moves the whole site onto a database **without touching `catalog.ts` or any page**. The Zod schemas in that file become the shared contract between the loader, the admin dashboard's write-validation and the pages.

### Ordering caveat

`product.order` is **per-category** and its values repeat across categories; `category.order` is globally unique 1–15. So an unfiltered `getProducts({ limit: n })` returns a semi-arbitrary cross-category slice. That is fine for filtered listings and `getRelatedProducts`, but **any curated "featured products" strip must name its products by slug.**

---

## Brand rules the code enforces

### Two logo lockups — not interchangeable

Both were extracted as **vector** from the brochure. Neither may be recoloured, redrawn, distorted, rotated or re-proportioned.

| Asset | Composition | Use on |
|---|---|---|
| `src/assets/brand/spartan-logo.svg` | Red helmet, **black** wordmark | **Light** backgrounds |
| `src/assets/brand/spartan-logo-light.svg` | Red helmet, **white** wordmark | **Dark** backgrounds |

The site is dark-first, so the header and footer both use the **light** lockup. Putting the dark one on a dark surface makes the wordmark invisible — that is a real bug that occurred during design, not a hypothetical.

Minimum rendered height 28px. Clear space on all sides = half the helmet height.

### Colour contrast — measured, not chosen

Tokens live in `src/styles/tokens.css`. All values were sampled from the brochure PDF and every pairing below was measured against the **real** resolved background.

There are **three dark surfaces**, not one — `--color-black` (#08080a), `--color-panel` (#0e0e11) and `--color-card` (#151519) — and brand red clears AA on only one of them:

| Pair | Ratio | Verdict |
|---|---|---|
| red on black | 4.65:1 | passes AA at any size |
| red on **panel** | 4.48:1 | **fails AA for normal text** |
| red on **card** | 4.23:1 | **fails AA for normal text** |
| red-light on black / panel / card | 5.08 / 4.89 / 4.62:1 | passes AA at any size |

> **Rule 1 — dark surfaces.** Small red text on *any* dark surface uses `--color-red-light`. Brand `--color-red` stays the colour for large text, icons, rules, borders and decorative fills.

The rule is applied uniformly, including on `--color-black` where brand red would pass on its own: `.eyebrow` appears on all three dark surfaces, and two reds a few percent apart reads as a defect.

> **Rule 2 — light surfaces.** On `--color-paper`, red is permitted **only** for text ≥24px, ≥18.66px bold, or non-text elements. Smaller red text uses `--color-red-deep` (8.40:1). Muted body copy uses `--color-ink-muted` (4.96:1) — **never `--color-grey`, which is 3.17:1 on paper.**

> **Rule 3 — red surfaces.** Any red *surface* carrying white text uses `--color-red-fill` (4.91:1), not brand red (4.30:1, fails). `--color-red-dark` is the hover step (6.52:1).

"Large" means ≥24px, or ≥18.66px (14pt) bold — **bold alone does not make text large**. The EN 388 level cells at 16px/800 are 12pt bold and therefore normal-size text; axe never flagged them, and they were caught only by measuring the rendered colour against the resolved background.

`Eyebrow`, `PillButton` and `SectionHeading` take an `onLight` prop that switches these automatically. That is how the rules are enforced in code rather than remembered.

Note that `design/direction-b-forge.html` — the approved design and the source of truth for every spacing, size and colour value — **has the same red-on-dark failure**. It arrived with the design rather than the implementation. It is still authoritative for layout; it is not authoritative for this colour pairing.

### Typography

**Archivo** (display) and **Inter** (body), self-hosted variable fonts in `public/fonts/`, preloaded, `font-display: swap`.

`@font-face` **must** declare `font-weight: 100 900`. One file covers the whole range; declaring discrete weights against the same file collapses every weight to one. Verified by measuring rendered text widths across the axis (772/781/810/887px at weights 100/400/700/900) — a visual check alone would not have caught it.

### The hero artworks — client assets, not extractions

Two supplied files in `src/assets/hero/`, each carrying the logo, the Arabic wordmark and the headline as pixels:

| Asset | Size | Composition |
|---|---|---|
| `hero-range-desktop.png` | 1672×941 | copy in the left third, cluster beside it |
| `hero-range-mobile.png` | 941×1672 | copy stacked above the cluster |

They are **two compositions, not two crops** — neither can be derived from the other. Do not run them through `tools/`; nothing in them is brochure-extracted, and no product record sources data from them.

Because the artwork carries the headline, `Hero.astro` renders none. The `<h1>` is still there, `sr-only` — **do not delete it.** It is the page's only h1 and the text alternative for a headline that exists only as an image.

The file and the layout are chosen by the *same* media condition, `(max-width: 767px), (max-aspect-ratio: 3/4)` — orientation, not width, because an iPad held upright is a portrait canvas whatever its width. That string appears twice (the `PORTRAIT` constant and the `@media` rule) because Astro's scoped styles cannot interpolate frontmatter. **Change one, change the other**, or the page renders portrait artwork under landscape button positioning.

Full detail, including where the buttons sit and why, is in `handoff.md` §7.

---

## The extraction tooling — two behaviours that fail silently

Full detail in `tools/README.md`. If you regenerate assets, do not "simplify" either of these:

1. **Clip forwarding.** Brochure product photos are rectangles with **opaque black backgrounds**, knocked out at render time by `clipImageMask`. Forward every clip/mask/group push *and its matching pop, unconditionally*; filter only fill operations. Dropping clips puts every product inside a black box — which looks fine on a white page and is ruinous on this dark layout.

2. **Same-column assignment.** Images *and* spec lines are matched within the product's own page column (`sameColumnFilter` in `tools/lib/pdf.mjs`). Nearest-overall matching swaps content between the columns of two-column pages. This bug shipped once: spec text bled across columns on **56 of 72 products** before it was caught.

Related trap: **do not "fix" the black panel in `p19-safety-vests.png` and `p19-safety-vests-2.png`.** It looks exactly like the clip-forwarding failure and has already been reported once as a suspected regression. It is not. Brochure page 19 shows it as a deliberate DAY | NIGHT reflectivity comparison panel. The extraction is correct.

---

## Testing

```bash
npm run test        # vitest — 63 unit tests
npm run test:e2e    # playwright + axe — 83 tests + 1 skipped
npx astro check     # 0 errors, 0 warnings, 7 hints
npm run build       # 96 pages + 404 + 1 SSR endpoint
```

**The e2e tests run against the built output, not the dev server.** Almost everything they assert — 96 prerendered pages, the no-JavaScript catalogue listing, hydration boundaries, the `dist/client/` split — is a property of the build rather than of the source. `playwright.config.ts` therefore runs `npm run build && npm run preview` itself, with `reuseExistingServer: true` so an already-running preview is used as-is during iterative work.

Two things that will waste your time otherwise:

- **`client:visible` islands do not hydrate in a background Chrome tab.** The rendering pipeline is frozen, so IntersectionObserver never fires and every enquiry button stays in its pending state. Force a paint (a screenshot works) or keep the tab foregrounded.
- **Any future island reading a persistent nanostore needs a `mounted`/`ready` gate.** `useStore` returns `store.get()` on the first client render, and `get()` on an unmounted persistent atom restores from `localStorage` — so the render that *hydrates* already has the basket while the server, having no `localStorage`, rendered the empty state. Two hydration mismatches were fixed this way in `EnquiryBadge` and `EnquiryForm`.

### `npm audit` reports 3 high findings and that is expected

All three are one chain: `@astrojs/vercel → @vercel/routing-utils → path-to-regexp@6.1.0` (ReDoS). No upstream fix exists — `@vercel/routing-utils` deliberately declares both `path-to-regexp@6.3.0` and `6.1.0`. npm's only offered fix is a major downgrade to `@astrojs/vercel@8`, which reintroduces 8 high-severity XSS advisories against `astro <= 7.0.9`.

**Never run `npm audit fix --force` in this repo.** Exposure is build-time with static, author-written route patterns; ReDoS needs attacker-controlled input and none reaches it.

---

## Lighthouse

Measured against the built output via `npm run preview`, Lighthouse 12.8.2, headless Chrome. Lighthouse's own mobile preset (4× CPU throttle, simulated slow 4G) and desktop preset:

| Page | Preset | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| `/` | mobile | 95–97 | 100 | 100 | 100 |
| `/catalogue/hand-protection` | mobile | 99 | 100 | 100 | 100 |
| `/products/grip-guard-gp5` | mobile | 98 | 100 | 96 | 100 |
| `/` | desktop | 100 | 100 | 100 | 100 |
| `/catalogue/hand-protection` | desktop | 100 | 100 | 100 | 100 |
| `/products/grip-guard-gp5` | desktop | 100 | 100 | 100 | 100 |

CLS is 0.000 and TBT 0 ms on every page. Two scores are worth understanding rather than chasing:

- **Best Practices 96 on the product page (mobile only)** is `image-size-responsive`. The spotlight image is displayed at 257×308 and its source is *natively* 257×308; Lighthouse wants 386×462 for a DPR-2 screen. **This cannot be fixed here.** Product photography extracted from the brochure is 100–440px wide and must never be upscaled. It resolves when the client supplies higher-resolution photography — the components already take `srcset`, so it drops in without markup changes. Desktop scores 100 because DPR is 1.
- **The `/` row is stale and has not been re-run.** It was measured against a hero that has since been replaced twice, and the sentence explaining it named `.hero__lede` — an element deleted back in `87e7471`. Treat the home figure as history until someone re-runs it; the two catalogue rows are unaffected. Locally re-measured on the current build (element identification and CLS only — no network throttling, so not a score): LCP is the hero image, 44 KB AVIF at 1440 and 46 KB at 390, CLS 0.000 on both.

  Two production factors are *not* reflected in any of these numbers: the preview server sends no `Content-Encoding` and no `Cache-Control`, so Lighthouse's `uses-text-compression` (~82 KB) and `cache-insight` (~234 KB) findings both disappear on Vercel, which compresses and sets immutable caching automatically. If the home page ever needs more headroom, `build.inlineStylesheets: 'always'` is the lever — at the cost of inlining ~41 KB into all 96 pages and losing cross-page CSS caching. It was not taken.

---

## Launch checklist

Six items need the client before this site can go live. Nothing here blocks development — placeholders are in place and marked in the code.

- [ ] **1. Real contact details** → `src/data/site.json`
      Address, phone and email are placeholders (`+971 00 000 0000`, `sales@spartan.example`, `Address line, City, Country`). They appear in the header utility bar, footer, contact page, trust band and the enquiry form's fallback address. The placeholder address is deliberately kept out of `organizationJsonLd` — publishing a fake address as structured data is worse than publishing none.

- [ ] **2. Resend API key and destination address** → `.env`
      Set `RESEND_API_KEY` and `ENQUIRY_TO_EMAIL`. Until both are set, `/api/enquiry` returns `delivered: false` and logs instead of sending. Set `ENQUIRY_FROM_EMAIL` too once a domain is verified in Resend.

- [ ] **3. The domain — TWO files, and they must match**
      - `astro.config.mjs` → `site:` (currently `https://spartan.example`). This drives every canonical tag, Open Graph URL, JSON-LD URL and the sitemap's contents.
      - `public/robots.txt` → the `Sitemap:` line. **This file is served verbatim from `public/` and interpolates nothing**, so it hard-codes the domain. Changing only `astro.config.mjs` leaves robots.txt pointing crawlers at a host that cannot exist — `.example` is reserved by RFC 2606.

      Doing this properly at the same time: replacing `public/robots.txt` with a `src/pages/robots.txt.ts` static endpoint would emit the real value at build time and make this failure mode impossible.

- [ ] **4. Confirm the eight "Industries We Serve"** → `src/data/site.json`
      Construction, Oil & Gas, Manufacturing, Warehousing, Facilities, Marine & Ports, Utilities, Hospitality. These are **inferred from the product mix**, not stated in the brochure. Flagged by `industriesPendingClientConfirmation: true` in the same file and by an HTML comment where they are used. Remove the flag once confirmed.

- [ ] **5. Certifications — none are claimed anywhere**
      The site makes no certification claim of any kind, because none was supplied. If the client provides them (ISO, CE, SASO, EN conformity declarations), they can be added. Until then the absence is correct, not an omission to be filled in.

- [ ] **6. Higher-resolution product photography, and a compressed brochure PDF**
      Native product images are 100–440px wide. Sharp at the sizes the design uses (~180px tiles, ~400px spotlight) but hard-capped there — this is what holds mobile Best Practices at 96 on product pages. The source brochure is **~163MB** and must be compressed before the "Download brochure" buttons can link to it; at that size it is not a download anyone will complete.

Also unresolved: the **deployment target** is assumed to be Vercel (the adapter is installed and configured) but has not been confirmed.

---

## Further reading

- **`handoff.md`** — the full project history: every decision, every trap found the hard way, the complete category/product distribution, the EN 388 verification, and what a next session picks up. Read it before changing anything structural.
- **`docs/CONTENT-EDITING.md`** — how to add products and categories, replace photography, and the rules that will bite. Written for a non-developer maintaining the catalogue before the admin dashboard exists.
- **`docs/superpowers/specs/2026-08-03-spartan-catalogue-design.md`** — the spec: brand rules, content model, IA, accessibility contract.
- **`design/direction-b-forge.html`** — the approved visual design, fully rendered. Open it in a browser.
- **`tools/README.md`** — the extraction pipeline.
