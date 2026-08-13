# Spartan — product catalogue website

A catalogue and lead-generation site for **Spartan**, an industrial brand with two divisions:

- **Spartan Electricals** — lighting, fans and ventilation, water pumps, cables, insect killers
- **Spartan Safety** — head, eye, hearing, hand, foot and body protection, fall arrest, workwear

**85 products across 15 categories** — 72 from the client's product brochure, plus 13 from the per-family datasheet PDFs. Built with Astro 7, TypeScript strict, Tailwind CSS 4 and Preact islands; deployed to Vercel.

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
| `npm run test` | Vitest unit tests. |
| `npm run test:e2e` | Playwright + axe, across desktop and mobile projects. Stop the dev server first. |
| `npm run verify` | **The gate.** Typecheck, unit tests, invariants, build, output sweeps. `-- --full` adds Playwright. |
| `npm run csp` | Regenerate `vercel.json`'s CSP hashes from `dist/client` after a build. |
| `npm run counts` | Regenerate `CLAUDE.md`'s counts block from the repo. `npm run verify` fails when it is stale. |
| `npx astro check` | Type/template check — 0 errors, 0 warnings, 7 hints (unused params in `tools/*.mjs`). |
| `npm run extract:catalog -- "path/to/brochure.pdf"` | Regenerate products and product PNGs from the brochure. |
| `npm run extract:logo -- "path/to/brochure.pdf"` | Re-extract the logo lockups. |
| `npm run extract:heroes -- "path/to/brochure.pdf"` | Re-extract the hero photographs. |
| `npm run normalise` | `products.raw.json` → `products.json`. |

The four extraction scripts are run **only when the brochure is revised**. Their output is committed, so a normal build never touches them. Read `tools/README.md` before running any of them.

### Why `preview` is a custom server

`astro preview` does not work in this repo. `@astrojs/vercel` ships no preview entrypoint and exits with *"The @astrojs/vercel adapter does not support the preview command."*

A plain static file server would not work either. Adding the first server-rendered route split the build in two: static pages land in `dist/client/`, and the SSR bundle is moved by the adapter to `.vercel/output/functions/_render.func` (`dist/server/` is deleted). A static server would therefore serve the prerendered pages and 404 every route that opts out — including `/api/enquiry`, the end of the only conversion path, and the whole of the admin area.

`tests/preview-server.mjs` serves both halves the way Vercel does: filesystem first out of `dist/client/`, then anything matching a `dest: "_render"` route in `.vercel/output/config.json` goes to the real built SSR handler, then `404.html` with a 404 status. The route table is read from the emitted config rather than hard-coded, so it cannot drift from what actually deploys. Nothing in it is a stub.

**Anything that globs the build output needs the `client/` segment.** `dist/products/…` is wrong; `dist/client/products/…` is right.

---

## Environment variables

Copy `.env.example` to `.env`. `.env` is gitignored — never commit real values. All variables are read **at request time**, in the server-rendered routes and in the middleware that guards them — never at build time, and never in the browser.

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL. Project `spartan`: `https://wslylysakixrirxkozih.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Service role**, not the publishable key. Server-side only — see below. |
| `SUPABASE_ANON_KEY` | Admin sign-in only (`signInWithPassword`). Never used for data. |
| `RESEND_API_KEY` | Resend API key. https://resend.com/api-keys |
| `ENQUIRY_TO_EMAIL` | The client's sales inbox — where the notification is delivered. |
| `ENQUIRY_FROM_EMAIL` | Optional. Must be on a domain verified in the Resend account. |

### Two channels, and why the distinction matters

An enquiry is **written to Postgres first**, then an email notification is sent. Either channel carrying it is enough for the submission to succeed, so a mail outage costs a notification rather than a lead. The response reports both:

```json
{ "ok": true, "recorded": true, "delivered": false }
```

Before this existed an enquiry was only ever an email, and the branch that ran when Resend threw returned 502 and discarded the payload — a validated buyer lost with no trace on either side.

### What happens when they are unset

A channel with no credentials is **`unconfigured`, which is not the same as `failed`**. It was never asked to carry the enquiry, so it has lost nothing. With *neither* channel configured the endpoint validates as normal, logs the full enquiry, and returns:

```json
{ "ok": true, "recorded": false, "delivered": false }
```

Both forms then say plainly that nothing reached the Spartan team. That is what keeps the whole flow exercisable locally and in CI without secrets — collapsing the two states would return 502 for every enquiry in the e2e suite. A 502 is reserved for the one real failure: **every configured channel failed**, where nothing was written and a retry therefore cannot duplicate.

**The site never reports an enquiry as received when nothing durable holds it.**

### The service-role key

`public.enquiries` has row-level security enabled with **zero policies**, so the publishable key can neither read nor write it. Only `service_role`, which bypasses RLS, can insert — and it must never leave the server. The browser never talks to Supabase at all, which is also why `connect-src` in `vercel.json` needs no Supabase origin.

`npm run verify` fails if the key reaches `dist/client`, or if anything under `src/components`, `src/scripts`, `src/stores` or `src/layouts` names it or imports `enquiry-store.ts`.

With `ENQUIRY_FROM_EMAIL` left empty the endpoint sends from Resend's own always-verified `onboarding@resend.dev`, which works with any key. Replies reach the enquirer either way, via `Reply-To`.

The endpoint also carries a honeypot field and an in-memory rate limit of 5 submissions per client per 10 minutes. That limit is per serverless instance and is honest about what it does and does not stop — read the comment in `src/pages/api/enquiry.ts` before relying on it.

---

## The admin area

`/admin` is an invite-only staff area for working the enquiries the site collects. A buyer never signs in; there are no public accounts.

| Route | What it is |
|---|---|
| `/admin/login` | Sign-in form. The only admin route reachable without a session. |
| `/admin` | The inbox — every enquiry, newest first, filterable by status. |
| `/admin/enquiries/[id]` | One enquiry in full, with the `new → contacted → quoted → closed` status control. |
| `/admin/demand` | Which products are actually being asked about, ordered by how many separate enquiries name them. |
| `/api/admin/export.csv` | Every enquiry as CSV, with a formula-injection guard. |

**Accounts are created by hand.** Public signup is disabled in the Supabase dashboard, and that is deliberately not the only control: a user must *also* have a row in `public.admins`. Identity (the session cookie) and authority (the allow-list) are separate facts established separately, so a valid Supabase account is not by itself an admin. To add someone, create the user in Supabase Auth and insert their `user_id` and `email` into `public.admins`.

Three environment variables are required, all server-side — see Environment variables above:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` — used *only* for `signInWithPassword` on the login endpoint, never for data
- `SUPABASE_SERVICE_ROLE_KEY` — every data read and write, and the `admins` lookup

**The browser never talks to Supabase.** Sign-in is a plain form POST, the session comes back as an HttpOnly cookie, and every read runs server-side. That is why `connect-src 'self'` needs no Supabase origin, why no key reaches any page, and why `public.enquiries` keeps RLS with zero policies.

Two rules that fail silently if broken, both gated by `npm run verify`:

- **No inline scripts on an admin page.** `npm run csp` hashes inline scripts found in `dist/client`, and these routes are server-rendered so they are never there. An inline script here would ship unhashed and be blocked at runtime with nothing failing the build. Server-rendered forms only.
- **Every admin route needs `export const prerender = false`.** Without it the page is built as a public static file with build-time data baked in.

The admin is excluded from the built sitemap by a `filter` in `astro.config.mjs` and carries `noindex` in `src/layouts/AdminLayout.astro`. It deliberately has **no** `robots.txt` `Disallow` — that would advertise the endpoints and stop a crawler ever seeing the `noindex` that actually keeps it out of an index.

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

**Archivo** (display), **Inter** (body) and **JetBrains Mono** (data), self-hosted variable fonts in `public/fonts/`. Archivo and Inter are preloaded; the mono deliberately is not.

`@font-face` **must** declare the file's real axis range. For Archivo and Inter that is `font-weight: 100 900`: one file covers the whole range, and declaring discrete weights against the same file collapses every weight to one. Verified by measuring rendered text widths across the axis (772/781/810/887px at weights 100/400/700/900) — a visual check alone would not have caught it. The mono declares `400 600` because its committed file is subset to exactly that; see below.

#### The weight scale

Weights are tokens in `src/styles/tokens.css`, not literals. The scale runs weight **down** as size runs **up**, because optical weight grows with size:

| Token | Weight | Applies to |
|---|---|---|
| `--fw-monument` | 450 | ≥100px — the 404 numeral |
| `--fw-display` | 500 | 40–99px — hero and section headings |
| `--fw-section` | 550 | 26–39px — stat numerals |
| `--fw-subhead` | 600 | 15–25px — card titles, and the `h1–h4` default |
| `--fw-label` | 650 | <15px — uppercase micro labels |
| `--fw-body` | 400 | body copy |

A rule takes its band from its **maximum** size, which for a `clamp()` is the desktop ceiling. Before this existed, 61 rules were 700 and 15 were 800.

**The `h1–h4` default is load-bearing for accessibility.** WCAG counts ≥18.66px **bold** as large text, so a heading in that band clears the 3:1 bar on its weight alone. Lowering `--fw-subhead` below 700 re-tests every such heading against 4.5:1 — three red-on-white headings needed `--color-red-deep` for exactly this reason. `tests/e2e/contrast.spec.ts` is the gate, and it is a named list: **add to it when you add red text on a light surface.**

#### The mono is subset, and the subset is gated

`--font-mono` is for data a buyer transcribes into an RFQ — spec values and EN 388 rating cells. Not prose, not counts, and not the unlabelled feature rows, which are sentences.

The committed file is 23.1 KB: 118 characters with the weight axis clipped to 400–600, generated by `node tools/subset-mono.mjs <full-jetbrains-mono.woff2>` and committed like the extraction tooling's output, so a normal build never runs it. A subset font renders **tofu** for anything it lacks, so `tools/subset-mono.test.ts` asserts the catalogue never uses a character outside `COVERAGE` and fails naming the character and the product. When it fails, add the character and re-run the subsetter — do not widen the test.

### The hero — an AI-generated helmet, pending client sign-off

The home page was rebuilt from a Claude Design mockup on 2026-08-11. `Hero.astro` now renders `src/assets/hero/helmet-hero.png` (1254×1254) on a black field inside a pulsing glow and a rotating red sweep, with the copy beside it on desktop and stacked above it below 1080px.

**That helmet is AI-generated.** Its C2PA manifest asserts `trainedAlgorithmicMedia` with GPT/openai markers. Shipping it was a deliberate decision taken with the client, not an oversight — but it depicts safety equipment on a site whose first rule is that nothing about safety equipment is invented, so it is flagged rather than quietly shipped and **still needs a person at the client to sign it off** (`BACKLOG.md`, P0). A real product photograph drops in with no markup change. It carries `alt=""` because the headline carries the meaning and the image asserts nothing about a real product.

The `<h1>` is **visible text again.** It was `sr-only` under the previous hero only because the client artwork carried the headline as pixels — that is no longer why, and it is no longer `sr-only`.

Astro clamps `widths` down to the source, so nothing in the component can upscale by accident. Do not add entries above 1254.

Four things move — the helmet bobs, a glow pulses, a red arc sweeps, and the stage parallaxes toward the cursor. All four stop under `prefers-reduced-motion`, and the parallax listener is never attached in that case rather than attached and ignored. Read the `prefers-reduced-motion` entry in `docs/TRAPS.md` before changing any of it: a component here can cancel an animation but cannot offer an opt-in.

### The client hero artworks — retained, and unused

| Asset | Size | Composition |
|---|---|---|
| `src/assets/hero/hero-range-desktop.png` | 1672×941 | copy in the left third, cluster beside it |
| `src/assets/hero/hero-range-mobile.png` | 941×1672 | copy stacked above the cluster |

These were the hero until the redesign replaced them. They are kept rather than deleted because they are **supplied brand assets** and removing supplied material to tidy up is the wrong trade — nothing imports them today. They are also **two compositions, not two crops**: neither can be derived from the other, so bringing one back means bringing both. Do not run them through `tools/`; nothing in them is brochure-extracted, and no product record sources data from them.

Full detail on both heroes — including where the old artwork's buttons sat and why those offsets were percentages of the picture rather than of the viewport — is in `handoff.md` §7 and §11.

---

## The extraction tooling — two behaviours that fail silently

Full detail in `tools/README.md`. If you regenerate assets, do not "simplify" either of these:

1. **Clip forwarding.** Brochure product photos are rectangles with **opaque black backgrounds**, knocked out at render time by `clipImageMask`. Forward every clip/mask/group push *and its matching pop, unconditionally*; filter only fill operations. Dropping clips puts every product inside a black box — which looks fine on a white page and is ruinous on this dark layout.

2. **Same-column assignment.** Images *and* spec lines are matched within the product's own page column (`sameColumnFilter` in `tools/lib/pdf.mjs`). Nearest-overall matching swaps content between the columns of two-column pages. This bug shipped once: spec text bled across columns on **56 of 72 products** before it was caught.

Related trap: **do not "fix" the black panel in `p19-safety-vests.png` and `p19-safety-vests-2.png`.** It looks exactly like the clip-forwarding failure and has already been reported once as a suspected regression. It is not. Brochure page 19 shows it as a deliberate DAY | NIGHT reflectivity comparison panel. The extraction is correct.

---

## Testing

```bash
npm run verify            # THE GATE — typecheck, unit tests, invariants, build, sweeps
npm run verify -- --full  # ... and the Playwright suite

npm run test        # vitest unit tests
npm run test:e2e    # playwright + axe
npx astro check     # 0 errors, 0 warnings, 7 hints
npm run build       # static pages to dist/client/ + the SSR routes
```

`npm run verify` is what CI runs (`.github/workflows/verify.yml`, on every push).
**Never weaken a gate to make it pass.** The live counts — products, categories,
built pages, server-rendered routes, CSP hashes, unit tests — are generated into
`CLAUDE.md` by `npm run counts` and gated by `verify`. That block is the only
place a live **status count** belongs — do not copy one here, or anywhere else,
because a second copy has nothing keeping it current. A measurement quoted inside
an explanation is a different thing and stays: `docs/TRAPS.md` saying 26
referenced images produced 52 variants, or that `build.inlineStylesheets:
'always'` would inline ~41 KB per page, is the reasoning, not a status line.

**The e2e tests run against the built output, not the dev server.** Almost everything they assert — the prerendered pages, the no-JavaScript catalogue listing, hydration boundaries, the `dist/client/` split — is a property of the build rather than of the source. `playwright.config.ts` therefore runs `npm run build && npm run preview` itself, with `reuseExistingServer: true` so an already-running preview is used as-is during iterative work.

Two things that will waste your time otherwise:

- **`client:visible` islands do not hydrate in a background Chrome tab.** The rendering pipeline is frozen, so IntersectionObserver never fires and every enquiry button stays in its pending state. Force a paint (a screenshot works) or keep the tab foregrounded.
- **Any future island reading a persistent nanostore needs a `mounted`/`ready` gate.** `useStore` returns `store.get()` on the first client render, and `get()` on an unmounted persistent atom restores from `localStorage` — so the render that *hydrates* already has the basket while the server, having no `localStorage`, rendered the empty state. Two hydration mismatches were fixed this way in `EnquiryBadge` and `EnquiryForm`.

### `npm audit` reports 3 high findings and that is expected

All three are one chain: `@astrojs/vercel → @vercel/routing-utils → path-to-regexp@6.1.0` (ReDoS). No upstream fix exists — `@vercel/routing-utils` deliberately declares both `path-to-regexp@6.3.0` and `6.1.0`. npm's only offered fix is a major downgrade to `@astrojs/vercel@8`, which reintroduces 8 high-severity XSS advisories against `astro <= 7.0.9`.

**Never run `npm audit fix --force` in this repo.** Exposure is build-time with static, author-written route patterns; ReDoS needs attacker-controlled input and none reaches it.

---

## Lighthouse

**Re-measured 2026-08-11, after the landing redesign**, against the built output via `npm run preview`, Lighthouse 12.8.2, headless Chrome. Lighthouse's own mobile preset (Moto G, 412×823 at DPR 1.75, 4× CPU throttle, simulated slow 4G) and desktop preset. Mobile figures are five runs on `/` and three on the other two; every run scored identically, so these are flat numbers rather than ranges.

| Page | Preset | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|---|
| `/` | mobile | 94 | 100 | 100 | 100 |
| `/catalogue/hand-protection` | mobile | 96 | 100 | 100 | 100 |
| `/products/grip-guard-gp5` | mobile | 96 | 100 | 96 | 100 |
| `/` | desktop | 100 | 100 | 100 | 100 |
| `/catalogue/hand-protection` | desktop | 100 | 100 | 100 | 100 |
| `/products/grip-guard-gp5` | desktop | 100 | 100 | 100 | 100 |

CLS is 0.000 and TBT 0 ms on every page at both presets — unchanged through three heroes.

**All three mobile rows moved when the landing redesign shipped**, not just the home one. The table before it read 95–97 / 99 / 98 with a note saying the catalogue rows were unaffected by the hero rewrite. That was true of the hero and wrong about the redesign: it restyled `Header` and `Footer`, which render on every page, so the catalogue row fell 99 → 96 and the product row 98 → 97. If you change site chrome, re-run all three.

**Home 94 and product 96 are the typography change**, measured 2026-08-11: each lost exactly one point to the 23.1 KB mono, and the catalogue row did not move because nothing on it uses the mono. Accessibility held at 100 everywhere. The full measurement — including that `font-display: optional` recovers nothing, and that clipping the font's weight axis saves more than subsetting its characters — is in `docs/superpowers/specs/2026-08-11-typography-weight-and-mono-design.md` §4.

Three things here are worth understanding rather than chasing:

- **Best Practices 96 on the product page (mobile only)** is `image-size-responsive`, and it is the same finding as before. The spotlight image is displayed at 257×308 and its source is *natively* 257×308; Lighthouse wants 386×462 for a high-DPR screen. **This cannot be fixed here.** Product photography extracted from the brochure is 100–440px wide and must never be upscaled. It resolves when the client supplies higher-resolution photography — the components already take `srcset`, so it drops in without markup changes. Desktop scores 100 because DPR is 1.

- **The home page's LCP is the helmet, and the helmet is not what costs it.** LCP is `section.hero > div.hero__stage > picture.hero__helmet > img` at both presets — 2.79 s mobile, 0.58 s desktop — and the file it fetches is an **18 KB AVIF** either way. Broken into phases on mobile, that 2.79 s is 0.46 s TTFB, 0.33 s load delay, **0.12 s actually loading the image**, and 1.89 s of *render delay*. The image is already cheap; what holds the paint is the two render-blocking stylesheets, `Eyebrow.*.css` (29.5 KB) and `index.*.css` (21.9 KB), which Lighthouse costs at 450 ms combined. Shrinking the helmet further would buy almost nothing.

- **`image-delivery-insight` flags the helmet as oversized, and it is wrong.** It reports the 560px variant as too large for a "266×266 displayed" box — but it compares against CSS pixels and ignores the preset's 1.75 DPR. 266 × 1.75 = 466 device pixels, and the next variant down is 420, which is under that. 560 is the correct pick. The insight is unscored and cost nothing; **do not "fix" it by narrowing `sizes`**, which would ship a visibly soft hero on every phone.

Two production factors are *not* reflected in any of these numbers: the preview server sends no `Content-Encoding` and no `Cache-Control`, so Lighthouse's `uses-text-compression` (101 / 72 / 64 KiB across the three pages) and `cache-insight` (218 / 203 / 150 KiB) findings all disappear on Vercel, which compresses and sets immutable caching automatically. If the home page ever needs more headroom, `build.inlineStylesheets: 'always'` is the lever that would take the render-blocking pair out of the critical path — at the cost of inlining ~51 KB into every page and losing cross-page CSS caching. It was considered and not taken.

---

## Launch checklist

Seven items need the client before this site can go live. Nothing here blocks development — placeholders are in place and marked in the code.

- [ ] **1. Real contact details** → `src/data/site.json`
      Address, phone and email are placeholders (`+971 00 000 0000`, `sales@spartan.example`, `Address line, City, Country`). They appear in the header utility bar, footer, contact page, trust band and the enquiry form's fallback address. The placeholder address is deliberately kept out of `organizationJsonLd` — publishing a fake address as structured data is worse than publishing none.

- [ ] **2a. Supabase credentials** → Vercel project settings
      Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The table, the policies and the code are in place; without these production returns `recorded: false` and enquiries survive only as function logs. This is the one that must not be missed — it is the difference between capturing leads and losing them.

- [ ] **2b. Resend API key and destination address** → `.env` / Vercel
      Set `RESEND_API_KEY` and `ENQUIRY_TO_EMAIL`. With Supabase configured this is no longer a data-loss risk — the enquiry is already safe and the email is the nudge — but until it is set nobody is told an RFQ arrived, so somebody has to watch the Supabase table. Set `ENQUIRY_FROM_EMAIL` too once a domain is verified in Resend.

- [ ] **3. The domain — ONE file**
      `astro.config.mjs` → `site:` (currently `https://spartan.example`, which is reserved by RFC 2606 and can never resolve). This drives every canonical tag, Open Graph URL, JSON-LD URL, the sitemap's contents **and** the `Sitemap:` line in robots.txt.

      It used to be two files that had to match: a static `robots.txt` under `public/` was served verbatim and hard-coded the domain, so changing one without the other silently pointed crawlers at the wrong host. That file is gone — `src/pages/robots.txt.ts` now emits the value from `site` at build time, so the two cannot diverge. Setting the domain is a single edit.

- [ ] **4. Confirm the eight "Industries We Serve"** → `src/data/site.json`
      Construction, Oil & Gas, Manufacturing, Warehousing, Facilities, Marine & Ports, Utilities, Hospitality. These are **inferred from the product mix**, not stated in the brochure. Flagged by `industriesPendingClientConfirmation: true` in the same file and by an HTML comment where they are used. Remove the flag once confirmed.

- [ ] **5. Certifications — none are claimed anywhere**
      The site makes no certification claim of any kind, because none was supplied. If the client provides them (ISO, CE, SASO, EN conformity declarations), they can be added. Until then the absence is correct, not an omission to be filled in.

- [ ] **6. Higher-resolution product photography, and a compressed brochure PDF**
      Native product images are 100–440px wide. Sharp at the sizes the design uses (~180px tiles, ~400px spotlight) but hard-capped there — this is what holds mobile Best Practices at 96 on product pages. The source brochure is **~163MB** and must be compressed before the "Download brochure" buttons can link to it; at that size it is not a download anyone will complete.

- [ ] **7. Product photography for the coolers and consumer fans** → `src/assets/products/`
      Six products ship with `ds-photo-pending.png` because their only source is a flattened page raster with no separable product image (see `tools/README.md`). They need product-only shots on a plain background. `src/content.config.test.ts` asserts exactly which products are affected, so the list cannot drift.

Also unresolved: the **deployment target** is assumed to be Vercel (the adapter is installed and configured) but has not been confirmed.

---

## Further reading

- **`handoff.md`** — the full project history: every decision, every trap found the hard way, the complete category/product distribution, the EN 388 verification, and what a next session picks up. Read it before changing anything structural.
- **`docs/CONTENT-EDITING.md`** — how to add products and categories, replace photography, and the rules that will bite. Written for a non-developer maintaining the catalogue before the admin dashboard exists.
- **`docs/superpowers/specs/2026-08-03-spartan-catalogue-design.md`** — the spec: brand rules, content model, IA, accessibility contract.
- **`design/direction-b-forge.html`** — the approved visual design, fully rendered. Open it in a browser.
- **`tools/README.md`** — the extraction pipeline.
