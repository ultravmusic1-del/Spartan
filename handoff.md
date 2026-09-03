# Spartan Catalogue Website — Handoff

**Last updated:** 2026-08-19
**Branch:** `main`. Every feature branch — `feat/catalogue-site`, `feat/landing-redesign`, `agent/improvements` — is merged into it and `git log main..<branch>` is empty for all three, so the warning this line used to carry no longer applies.
**State:** **The catalogue build is complete and verified, and admin Phase 1 is complete.** The public site builds end to end, the full enquiry path works from product card to submitted RFQ, and an operator can now sign in, work the inbox, change a status, read the demand report and download the CSV. See §13. What is left is deployment and the client-supplied items in §8.

Live counts — built pages, server-rendered routes, CSP hashes, unit tests — are generated into `CLAUDE.md` by `npm run counts` and gated by `npm run verify`. That block is the only place a current number belongs. Every number in this document is a dated record of what was true when it was written.

**As of 2026-08-05:**

```
vitest        63 passed
playwright    83 passed, 1 skipped  (desktop + mobile projects)
astro check   0 errors, 0 warnings, 7 hints
astro build   clean — 96 pages + 404 + 1 SSR endpoint
lighthouse    >= 95 on all four categories, all three page types
```

**Nothing in the catalogue build is outstanding. What remains is deployment, the rest of admin Phase 1, and the client-supplied items in §8** — see §7 "What a next session picks up".

**Start here, in this order:** `CLAUDE.md` (the rules, and which file answers which question) → `docs/TRAPS.md` (the things that pass `astro check` and are wrong anyway) → `README.md` (setup, scripts, architecture, launch checklist) → this document for the reasoning behind a decision → `docs/CONTENT-EDITING.md` if you are touching catalogue data.

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
| `src/assets/hero/` | 5 brochure photographs (division landings, About), text overlays removed — `cover.jpg` was deleted, blank white once the overlay was stripped — plus the two client hero artworks, `hero-range-desktop.png` and `hero-range-mobile.png`. The artworks are supplied brand assets, not extractions: **do not run them through `tools/`.** |
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

**This reversed on 2026-08-20.** The site was dark-first and most surfaces needed the **light** lockup; the site is light now, so the header and every page take the **dark** lockup, and the light one is used in exactly one place — the footer, the only dark surface left on the public site. (`/admin` is dark and unaffected.)

Using the wrong lockup makes the wordmark invisible, and that is a real bug that has already occurred once on this project. **No gate can catch it**: an invisible wordmark is still a rendered `<img>` with correct `alt`, correct dimensions and a 200 response. Check it by eye whenever a surface changes.

Minimum rendered height 28px. Clear space on all sides = half the helmet height.

The brochure cover also carries an Arabic wordmark (**سبارتان**). Not used in this build; deferred.

### Colour — measured, not chosen

> **THE SITE IS LIGHT AS OF 2026-08-20.** Everything below still holds, but read
> it in two halves. The **palette** is unchanged — every hex, every name, every
> meaning — and it is still what `/admin` and the dark footer use directly. On
> top of it sits a **semantic layer** whose names are jobs rather than colours,
> and that is what every public component now reads. See
> `docs/superpowers/specs/2026-08-20-white-theme-design.md`.
>
> The pairs a dark-first site cared about are now the *exception* set, and the
> light pairs are the everyday ones. Both tables are below, in that order.

#### The semantic layer — what public components name

```
--surface-page    #ffffff   the page
--surface-alt     #f6f6f7   alternating bands, sunken wells
--surface-raised  #ffffff   cards, panels (same value, NOT the same token)
--line            #e4e4e7   decorative hairlines, grid gaps
--line-control    #8a8a92   boundaries that carry meaning — input, checkbox
--text            #0e0e11   body and headings
--text-muted      #6a6a72   kickers, captions, meta
--accent-text     #970000   small red text
--accent          #eb2927   large display red, rules, icons, focus rings
--accent-fill     #dd1e1c   red surfaces under white text
```

`.on-dark` in `src/styles/global.css` re-points all ten at the dark palette. It
has exactly two users on the public site: `Footer.astro`, and the division-page
hero in `DivisionPage.astro`, whose background is a scrimmed photograph.

**Light pairs, measured:**

| Pair | on `#ffffff` | on `#f6f6f7` | Verdict |
|---|---|---|---|
| `--text` | 19.27:1 | 17.85:1 | passes AA at any size |
| `--text-muted` | 5.36:1 | 4.96:1 | passes AA at any size |
| `--accent-text` | 9.07:1 | 8.40:1 | passes AAA |
| **`--accent`** | **4.30:1** | **3.99:1** | **large text only** — ≥24px, or ≥18.66px bold |
| `--line-control` | 3.43:1 | 3.17:1 | passes the 3:1 non-text bar |
| white on `--accent-fill` | 4.91:1 | — | passes AA at any size |

`--line` is 1.27:1 and that is correct: WCAG's 3:1 non-text bar covers boundaries
that convey information or state, not hairlines between bands. A boundary that
does carry meaning uses `--line-control`.

**`--color-grey` was demoted, not deleted.** It was muted text on dark; on light
it is 3.43:1, which is illegal for the 11–15px labels it used to colour but
correct for a control edge. It is `--line-control` now.
**`--color-grey-lt` has no light-surface role at all** — 2.06:1, fails at every
size. Both are banned outside the dark footer by
`src/styles/theme-sweep.test.ts`, because 80 public-site usages of them would
otherwise have survived the inversion looking approximately fine.

#### The palette — unchanged, and still what `/admin` and `.on-dark` use

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

`Eyebrow`, `PillButton` and `SectionHeading` took an `onLight` prop that switched these automatically. **That prop is gone as of 2026-08-20.** It was an opt-in flag every call site had to remember, and forgetting it shipped `--color-grey-lt` at 1.91:1 with nothing failing. The three primitives now name `--accent-text` and `--text-muted`, which the surface resolves — so the rule is enforced by where the element *is*, not by what its caller passed.

**Two gates now cover this section, and neither existed before 2026-08-20:**

- `src/styles/tokens.test.ts` — static. Reads the declared token values and asserts every pair in the light table above clears its bar. Also asserts `--accent` does **not** clear 4.5:1, so "fixing" it means changing the brand red and saying so out loud.
- `tests/e2e/contrast.spec.ts` — rendered. Eleven selectors, resolved against their real backgrounds in a browser. It found `.card__name` at 1.00:1 (white on white) and five red-filled controls at 3.92:1 during the inversion, none of which any static check would have caught.

Its background walk had a latent bug worth knowing about: it detected transparency by pattern-matching a trailing `, 0)`, and `rgb(0, 0, 0)` ends in exactly that — so **pure black read as transparent** and the walk continued past it to whatever was behind. It never mattered while the dark surfaces were `#08080a`, `#0e0e11` and `#151519`, none of them pure black. The footer is `#000`. Alpha is parsed now.

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
| Enquiry storage | Supabase Postgres, project `spartan` — the system of record |
| Email | Resend (Task 14) — the notification, no longer the record |
| Rendering | `output: 'static'`; `/api/enquiry` and the admin routes set `prerender = false`, and `src/middleware.ts` runs on everything. The live count is in `CLAUDE.md`'s generated block |
| Hosting | Vercel adapter |
| Tests | Vitest (unit), Playwright + axe (e2e) |

### Commands

Full table in `README.md`. The short version:

```bash
npm install
npm run dev            # astro dev  (Astro 7: --background / astro dev stop)
npm run build          # -> dist/client/ + .vercel/output/
npm run preview        # tests/preview-server.mjs, NOT astro preview — see README
npm run test           # vitest run
npm run test:e2e       # playwright — stop the dev server first
npx astro check        # 0 errors, 0 warnings, 7 hints (unused params in tools/*.mjs)

npm run extract:catalog -- "path/to/brochure.pdf"   # regenerate products + PNGs
npm run extract:logo    -- "path/to/brochure.pdf"
npm run extract:heroes  -- "path/to/brochure.pdf"
npm run normalise                                   # raw extraction -> products.json
```

### The tooling that arrived after this document was first written

None of it existed when §4's command list was drafted, and all of it is now the
way work is checked in rather than an extra:

```bash
npm run verify            # THE GATE. typecheck, unit tests, invariants,
                          # build, output sweeps. Never weaken one to pass.
npm run verify -- --full  # ... and the Playwright suite
npm run csp               # regenerate vercel.json's CSP hashes from dist/client
npm run counts            # regenerate CLAUDE.md's counts block from the repo
node tools/brand-sheet.mjs   # the brand & asset contact sheet
```

`npm run verify` (`tools/verify.mjs`) is what enforces the admin seam, the
catalogue's shape, that no price or rating reaches structured data, that the
service-role key never reaches `dist/client`, that `CLAUDE.md` and `AGENTS.md`
cannot diverge, that the instructional docs name paths that resolve, that both
enquiry clients read `recorded` and not `delivered` alone, and that the
generated counts block is not stale. `.github/workflows/verify.yml` runs it on
every push, so a gate that goes red is not something a local session can skip.

`npm run counts` (`tools/counts.mjs`) is why this document no longer carries
live numbers. The catalogue counts, the built-page count, the server-rendered
route count, the CSP hash count and the unit-test count are derived from the
repository and written into one generated block in `CLAUDE.md`; the gate fails
if the block and the repository disagree. **Everything in this document is a
dated snapshot** — if you want a current number, run `npm run counts` and read
that block, and do not copy it anywhere.

`docs/TRAPS.md` was extracted from this document for the same reason. It carries
the silent failures — the things that pass `astro check` and are wrong anyway —
so they can be read in two minutes before touching an unfamiliar area, instead
of being found in §7 after the fact. The reasoning stays here; the warning lives
there.

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

### Distribution — 85 products, verified

72 come from the brochure. The other 13 are fans and air coolers taken from the
per-family datasheet PDFs (see §6a), which is why `fans` is 17 rather than the
brochure's 4 and Electricals is 32 rather than 19. Safety is untouched.

| Category | id | Count | Brochure source |
|---|---|---|---|
| Lighting | `lighting` | 10 | p4 (7) + p5 (3) |
| Fans & Ventilation | `fans` | 17 | p10 (4) + datasheets (13) |
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

Electricals: 32. Safety: 53.

> An earlier draft said **74**. That double-counted two "RESISTANCE SPECIFICATIONS" table headings as products. 72 was the correct brochure figure — if you see 74 anywhere, it is stale. The live total is now **85**; 72 still refers to the brochure subset. `src/content.config.test.ts` asserts both the per-category counts and the total, so this table cannot drift silently.

> **The catalogue is no longer a complete transcription of its sources.** Three
> `Shrinkage` rows printed on brochure page 23 were removed on 2026-08-16 at the
> client's instruction — see §15. If you are auditing specs against the brochure
> and page 23 disagrees, that is the reason, and it is the only such gap.

### 6a. The datasheet PDFs — a second source family

The client later supplied 20 per-product-family catalogues and datasheets. They
are the source for two things:

**Specs on 15 existing Electricals products.** The brochure gave most lighting
products a single "Material" line; the datasheets give full electrical tables.
Electricals went from ~24 spec rows to 169. Each of those products' `source`
now names its datasheet rather than the brochure, because that is where the
values can actually be checked.

**Thirteen new products**, all in the existing `fans` category — three FA Series
exhaust-fan bodies (standard, grill, shutter), an FA Series stand fan and wall
fan, the MFS Series mist fan, the SHT Series portable blower, three portable air
coolers (AY-YD2536, AY-YD2512, AY-YD2518) and three consumer fans (SPTSF-16
stand fan, AF-40W and FW-40H wall fans). No new categories were created.

28 products in total now carry a datasheet `source` — the 15 re-pointed
Electricals plus the 13 new ones.

Model tables were collapsed into the site's existing `A | B | C` convention
rather than split into one product per SKU. The catalogue models product
families; exploding 12 exhaust-fan model codes into 12 products would
restructure the site rather than describe it.

#### The condensation rule — load-bearing, do not relax it

> **Condensation must be lossless.** The collapse may only ever be a *union* of
> the printed values — never a subset, and never a simplification that widens a
> claim. If a value applies to some models and not others, say which, e.g.
> `220V/50Hz (SHT-50, SHT-60)`. If a row cannot be condensed without breaking
> either test, keep it long.

Two tests, applied to every row containing a `|`:

1. **Union, not sample.** Every distinct printed value appears in the row.
2. **No widened claim.** If a value applies to only some models, the row names
   them. This fails in two ways: the row reads as "available in either" when no
   single unit offers both (the exhaust fans' 220V/380V), or the row's entry
   count does not line up with the `Models` row, so a buyer's left-to-right
   reading produces a *wrong* model-to-value pairing (the pumps' `Max. Current`).

**This rule was established mid-branch, after four defects had already shipped
into the data**, and a fifth and sixth were then found on the CAT6 cable. It is
not a style preference. These failures are easy to miss because the result still
looks like real data — nothing is fabricated in the sense of a made-up number,
but the row asserts something the sheet does not grant. On electrical and safety
equipment that is a hazard, not a cosmetic flaw: a bare `100 ± 15 Ω` on a cable
whose sheet prints `100 ± 20` above 300 MHz is a tolerance the supplier never
warranted.

A full audit of all 28 datasheet-sourced products against re-rendered source
pages was then run; it is recorded below. **Any future spec enrichment must be
audited the same way before it lands.**

#### The audit — every `|` row on all 28 datasheet products

22 rows on 9 products were corrected. Three classes of failure were found:

- **Subset, not union** — CAT6 `Application` carried 3 of the 5 printed entries
  (`100VG-AnyLAN` and `Noisy Environments` were missing).
- **Unqualified band or model** — CAT6 `Impedance` claimed `100 ± 15 Ω` across
  the whole sweep; the sheet prints `100 ± 20` from 300–550 MHz. The exhaust
  fans' `Voltage` read as "either", but FAD models are 220V and FAS models 380V
  and no single unit offers both. Slim panels' `Shape`/`Installation` implied a
  30W square recessed panel the sheet does not list.
- **Broken positional correspondence** — the pumps' `Max. Current` listed three
  values against four models where the *first* model has no printed current, so
  every naive pairing was shifted by one and therefore wrong. Exhaust `Size`
  (8 values vs 12 models), mist fan `Water Tank Capacity` (2 vs 4) and blower
  `Power` (6 vs 8) were qualified for the same reason.

One row was not a condensation defect at all but a plain transcription error,
found by the same pass: **the third T8 tube is printed `35W`, and the record
said `30W`.** Corrected.

Rows deliberately left alone, because the naive pairing is merely *truncated*
rather than wrong: `led-bulbs` `Series` (`A55 | A60` against five wattages —
and see the A55/A60 conflict below), and the solar flood light's
`Installation` (`Wall mount | Pole mount` is printed as a whole-range bullet,
not a per-model column).

**Conflicts left unreconciled, deliberately:**

- The flood light sheet prints power as `50W/150W/300W/400W/1000W/1000W` — six slots, 1000W twice. The five distinct values are recorded. One slot is wrong and only the client can say which. **`LED Qty` has the same shape** (`72/252/468/648/1000/1000pcs`), and **`Body Size` prints six *distinct* values** — the two 1000W slots have different bodies (`810*320*220` and `670*450*100`), which is good evidence the two slots are genuinely two different products rather than a duplicated line.
- Its photo is captioned `50W IP66` — **not IP68, as an earlier draft of this document said** — while its spec table says IP65. All five fixture photos on the page carry `IP66`. The table/photo conflict is real; the digit was wrong here and is now corrected.
- The waterproof fitting was "ABS + PS" in the brochure and "PC diffuser, ABS grey housing, PC clips" on the datasheet. The datasheet is more specific and won; `source` records that.
- The highbay sheet gives three LED quantities (168/224/322pcs) for four wattages. **`Gross Weight`, `Body Size` and `Packing Size` are all three-for-four in the same way**, so it is one consistent omission across the sheet, not four separate typos.
- **Air volume units disagree between sheets.** The exhaust tables read 780–7200 m3/min while the stand and wall tables read 130–302 m3/min for physically larger fans. One set is almost certainly m3/h. Both are recorded exactly as printed — this needs the client, not a guess. The SHT blower table reads 25–300 m3/min for 8"–24" units, which corroborates that the *exhaust* figures are the implausible ones.
- **Air cooler airflow is quoted in m3/h while every fan sheet quotes m3/min.** The AY-YD2536 reads 3600 m3/h; the FA and MFS tables read m3/min. Both are recorded as printed. This compounds the existing exhaust-versus-stand-fan unit conflict — one clarification from the client should settle both.
- **The 2.0 HP pump has three different model codes across one document.** The spec page prints **`MP-203`**, the same page's invisible PDF text layer says `MP-208`, and the performance charts call it `MP-203` on one page and `MP-205` on the next. The record now carries `MP-203`, the value actually printed on the spec page and corroborated by one of the two charts — consistent with the EN 388 precedent of rendering the literal printed value. The catalogue previously said `MP-208`, which is the one candidate no *visible* part of the document supports. The client must confirm the real code.
- **The exhaust fan sheet contradicts itself on FAS40-4's air volume**: p3 prints `2800 m3/min`, p4 prints `2880` for the same model. The recorded range (780–7200) spans both, so no site value depends on the answer.
- **The T8 sheet's `LED BATTEN FITTINGS` table is a separate product family** (ELETUB03020/03025) that no catalogue product maps to. Do not mistake its rows for tube data if the page is re-read.
- The bulb sheet is titled `A55&A60 BULB`, but its 15W model (ELELBL00215/00216) has a `65*118mm` envelope — neither A55 nor A60. The `Series` row is left as the printed `A55 | A60` rather than being mapped per-wattage, because the sheet prints no per-model series column.
- The waterproof fitting's 2×9W model (ELETUB04009) has a **text block and a dimensional drawing that disagree**: the text reads `665x120.5x88.5mm`, its own drawing reads `1265mm` long and `77.5mm` wide. The site follows the text. The true 2×9W envelope is unresolved.
- The insect killer's spec table is on **page 2** of its PDF, not page 1; `source.page` records 1 because page 1 is where the application list and product imagery are. Both pages were read and every value verified.

Deliberately **not** integrated, and not blocking: the pump performance curves
(pages 5–9 of the pump TDS) and the CAT6 frequency sweep. Both are dense
per-frequency and per-head tables that belong in a downloadable datasheet rather
than a spec list; the CAT6 record points at them with a
`Full Electrical Characteristics … available on request` row.

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

**At Task 17's completion, 2026-08-05: 63 unit tests and 83 e2e tests passing (1 skipped). `astro check` 0 errors, 0 warnings, 7 hints. `astro build` clean — 96 pages + 404 + one SSR endpoint.** Every one of those numbers has since moved; the current ones are in `CLAUDE.md`'s generated block.

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

Adding the first server-rendered route (`/api/enquiry`) switched the Vercel adapter into hybrid mode. Static pages now emit to **`dist/client/`**, not `dist/`. Any script or check that globs `dist/products` or `dist/catalogue` needs the `client/` segment.

The SSR bundle is **not** left in `dist/server/` — the adapter moves it to `.vercel/output/functions/_render.func` and removes the staging directory, so `dist/` ends up containing only `client/`. To confirm the endpoint built, check that function exists and that `.vercel/output/config.json` routes `^/api/enquiry/?$` to `_render`.

Current output: 96 `index.html` + `404.html` — 72 product pages, 15 category pages, the catalogue index, and 8 top-level pages, plus `sitemap-index.xml`.

### The hero is a floating helmet — and the helmet is AI-generated

**Superseded 2026-08-11 by the landing redesign. The section below describes the client-artwork hero, which is no longer on the landing page.** Read §11 first; this stays as the record of what the artwork hero was and why, because both files are retained and could be brought back.

`src/components/sections/Hero.astro` now renders `src/assets/hero/helmet-hero.png` — 1254×1254 RGBA, floating on a black field inside a pulsing glow and a rotating red sweep, with the copy beside it on desktop and above it below 1080px.

**The helmet's C2PA manifest asserts `trainedAlgorithmicMedia` with GPT/openai markers. It is AI-generated.** That was a deliberate decision taken with the client on 2026-08-11, not an oversight, and **it still needs a person at the client to sign it off** — `BACKLOG.md` carries the item. It depicts safety equipment on a site whose first rule is that nothing about safety equipment is invented, so it is flagged rather than quietly shipped. A real product photograph drops in with no markup change.

The `<h1>` is **visible text again**. It was `sr-only` only because the client artwork carried the headline as pixels; this hero renders a real headline and the image is decorative with `alt=""`.

`hero-range-desktop.png` and `hero-range-mobile.png` are **retained but unused**. They are client-supplied brand assets and deleting supplied material to tidy up would be the wrong trade.

---

#### What the client-artwork hero was, for the record

`src/components/sections/Hero.astro`. Static images. The scroll-scrubbed video that used to live here is gone — along with `public/video/` and the two poster JPEGs — replaced by supplied brand artwork that already carries the logo, the Arabic wordmark and the headline.

Two files, because they are two compositions rather than two crops of one:

| Asset | Size | Composition |
|---|---|---|
| `src/assets/hero/hero-range-desktop.png` | 1672×941 (1.777) | copy in the left third, product cluster beside it |
| `src/assets/hero/hero-range-mobile.png` | 941×1672 (0.563) | copy stacked above the cluster |

**The component renders no visible headline.** The artwork has it. The `<h1>` is still there and still says "Home and Industrial Solutions" — it is `sr-only`. Do not delete it: it is the page's only h1 and the text alternative for a headline that now exists solely as pixels. The `<img>` carries a descriptive alt for the product range, which the h1 does not duplicate.

Things that will look like bugs but are deliberate:

- **The switch is orientation, not width.** `const PORTRAIT = '(max-width: 767px), (max-aspect-ratio: 3/4)'` — narrow *or* taller than 4:3. An iPad held upright is a portrait canvas whatever its width; on a pure width breakpoint it got the landscape cut as a stubby 432px band in a 1024px-tall window.
- **That condition is written twice and must stay identical.** It governs `<source media>` (which file is fetched) *and* the `@media` block (where the buttons go). Astro's scoped `<style>` cannot interpolate a frontmatter value, so the constant drives the markup and the stylesheet repeats it verbatim. If they ever disagree you get portrait artwork under landscape button positioning.
- **`.hero__frame` shrink-wraps the picture; the buttons are positioned against *it*, not the viewport.** In landscape they sit at `left: 5.2%; top: 82%` — percentages of the artwork, valid only because the artwork is never cropped. The frame caps itself at `min(100%, 100svh × aspect)`, so on a short or ultra-wide window it narrows instead of overflowing. Capping the image inside a full-width box would letterbox it and slide the artwork out from under the buttons.
- **The section is `--color-black` and the artwork's edges are *faded* into it, not matched to it.** The earlier artwork was bedded on flat `#000`, so painting the section `#000` made every join invisible for free. This one is not: its left edge measures `#020203` and its top `#070708` — near enough — but its right edge is a lit wall running to `#931211` at y 63–75%, and its floor reaches `#41221e` around x 60–70%. No single background colour can meet all four, so `.hero__frame::after` runs a gradient over the three exposed edges instead. **This matters far more often than "ultra-wide" suggests:** the width cap engages whenever the viewport is wider than 1.777:1, which an ordinary maximised 1920×955 browser already is — about 220px of page shows either side on a very common setup.
- **The portrait artwork is capped in height on purpose.** At full width it stands 693px on a 390px phone, which with the 128px header put both buttons past the fold — "Browse catalogue" was not on screen at first paint.
- **In portrait the buttons are not overlaid at all.** They go `position: static` beneath the artwork and stretch full width, and the edge fade is switched off (`content: none`) so it cannot wash out the strip of floor the composition ends on.
- **No pause control, no reduced-motion branch.** Nothing moves.

Where the buttons sit was measured, not guessed — and the number moved when the desktop artwork was re-cut in `42d4b8a`, which is why it is `82%` and not the `72%` an earlier draft of this document recorded. Peak luminance in the button column (x 5.2–33%), scanned in 1% rows: y 70–76% is the SOLUTIONS headline and the category strip at 255, y 77% drops to 14, and y 78–99% runs 20–57 — dark floor all the way down. The strip's last words extend past x 33%, so the row has to clear it entirely rather than tuck beside it; its final bright row is y 79%, and 82% leaves a 24px gap at 1440. At 1280 — the tightest case — the CTAs end at y 89% against a bottom fade starting at 92%. `z-index: 2` lifts them over that fade, which is a sibling `::after` and would otherwise paint on top. **Re-measure if the artwork is ever re-cut.**

> **Resolved:** the first portrait cut printed the floodlight as **IP65** against the landscape cut's **IP66**. The client reissued it and both now read IP66. Neither file is catalogue data — no product record sources anything from them — but on a site whose whole claim is that specifications are not invented, the same product must not advertise two ratings.
>
> One thing carried over from that fix: in the reissued portrait the label has a **retouching artifact** — a ~4px vertical tick between the digits where the `5` was painted into a `6`, and a slightly malformed final glyph. At the size the artwork is actually displayed this is roughly one device pixel and resolves visually as a clean "IP66" (checked against the real phone render, not just the master). It is invisible in situ and not worth blocking on. It would show if this artwork is ever reused at a larger scale — print, social, or as a desktop cut — so ask for a clean re-render before doing that.

**The hero is a CSP surface.** Removing the film's `<script is:inline>` scrubber took the policy from **7 inline-script hashes to 6**, and the artwork rewrite carries no inline script of its own. Any change that adds, removes or edits an inline `<script>` or `<style>` anywhere means `npm run csp` must be re-run and `vercel.json` committed with it. A stale hash does not fail the build — it ships a site that never hydrates.

#### The still this replaced, for the record

Between the film and the artwork the hero was a static still cut from the video's own frames (`d6808db`), landscape 1168×784 and portrait 784×1168, with the headline rendered as HTML over a scrim. Its own note called that resolution "a source constraint" that only "a higher-resolution render from the client" could lift — the artwork above **is** that render, at 1672×941. `hero-desktop-poster.jpg` and `hero-mobile-poster.jpg` are deleted along with it; nothing imports them now.

Two things from that version that no longer apply, so you do not go looking for them: the copy was anchored from the top rather than centred (the cluster's bright mass began around y=43%), and a `{' '}` between the two headline spans was load-bearing so `textContent` did not read `Home and IndustrialSolutions.`. Both belonged to an HTML headline that the artwork now carries as pixels.

### Two test/tooling traps

**Playwright silently tests the dev server if one is running.** `playwright.config.ts` sets `reuseExistingServer: true` and `webServer.command` builds first — but if anything is already listening on 4321, Playwright attaches to *that* and never builds. With `astro dev` running this produced 15 confident failures that vanished the moment the dev server was stopped. **Stop the dev server before `npx playwright test`.**

**Astro's dev server can serve stale scoped CSS after a component is rewritten wholesale.** Twice during the hero work the new markup shipped with the previous stylesheet — `min-height` and `display` reading their old values while the DOM was clearly new. `astro check` passes, so nothing warns you. Restart the dev server (and clear `node_modules/.vite`) if computed styles disagree with the file you just wrote.

### Two CSS traps that fail silently

**Tailwind utilities lose to Astro scoped styles.** Utilities compile into `@layer utilities`; Astro's scoped component styles are unlayered, and **unlayered CSS beats every layer regardless of specificity**. Passing `max-sm:hidden` to a component whose own scoped rule sets `display` does nothing at all. Wrap the component in an element the page owns instead. `Chevron` sizing works through utilities *only* because `Chevron` declares no width of its own.

**The `hidden` attribute can never hold its space.** Tailwind 4's preflight ships `[hidden]:where(:not([hidden=until-found])){display:none!important}`, and no ordinary author rule outranks `!important`. Using `hidden` for a "not yet hydrated" placeholder cost 134px of layout shift and CLS 0.042; a plain class gave 0px and CLS 0.000. `hidden` is still correct where `display: none` is genuinely the intent.

### SEO — the rule that must stay true

**The site has no prices and no reviews.** Product structured data never emits `offers`, `price`, `priceCurrency`, `availability`, `aggregateRating` or `review`. Google accepts them and then displays a price that does not exist — the structured-data equivalent of inventing a specification. `seo.ts` enforces it and a test asserts it; the built output is swept for all six strings and returns zero.

`Seo.astro` is the **sole** emitter of `<title>`, meta description and canonical — `BaseLayout` forwards to it and emits none itself. Emitting from both would duplicate all three on every page. Verified: 97/97 pages have exactly one of each, all titles and descriptions distinct.

`organizationJsonLd` is on the **home page only**. It describes the company, not the document; 97 copies would be 97 competing declarations of one entity.

JSON-LD goes through `set:html` (a plain expression HTML-escapes the quotes and breaks the JSON), so `serialiseJsonLd()` rewrites every `<` as `<`. `JSON.parse` returns an identical string, but a `</script>` can never reach the HTML parser intact. No catalogue value contains `<` today — this matters when the admin dashboard lets arbitrary text in.

`og:image` is a build-time 1200×630 JPEG crop of the division hero, `position: bottom` (a centre crop of `safety.jpg` decapitates the workers). `safety.jpg` site-wide, `electrical.jpg` on Electricals pages. Forced to JPEG because several link-preview scrapers still will not render WebP.

**robots.txt is now `src/pages/robots.txt.ts`, not a static file.** It was `public/robots.txt`, which is served verbatim and interpolates nothing, so the sitemap URL was a second hand-typed copy of `site` — and changing either without the other was silent. The endpoint derives it from `Astro.site` at build time, so the domain is written in one place only. `site` is still the `spartan.example` placeholder, so the value is still wrong; the difference is that setting it is now a single edit and can no longer half-happen.

### Lighthouse — measured, Task 17

> **Superseded 2026-08-11.** Every row in this table has been re-measured
> against the current build; the live table is in `README.md` and the reasoning
> for what moved is in §11 item 3. This section stays as the Task 17 record and
> for the lesson at the end of it, which is the reason it is worth keeping.

Lighthouse 12.8.2 against `npm run preview`, headless Chrome, Lighthouse's own mobile and desktop presets. Target was ≥95 on all four categories.

| Page | Preset | Perf | A11y | BP | SEO |
|---|---|---|---|---|---|
| `/` | mobile | 95–97 | 100 | 100 | 100 |
| `/catalogue/hand-protection` | mobile | 99 | 100 | 100 | 100 |
| `/products/grip-guard-gp5` | mobile | 98 | 100 | **96** | 100 |
| all three | desktop | 100 | 100 | 100 | 100 |

> **The `/` row predates the hero rewrite and has not been re-run.** It was measured against a hero that no longer exists — first a photograph, then a ~1.46 MB scroll-scrubbed video, now a 44 KB still. The two catalogue rows are unaffected; the home figure should be re-measured before it is quoted anywhere. What *has* been re-measured locally (no network throttling, so element identification and CLS only, not scores): LCP is now the hero image itself — 44 KB AVIF at 1440, 46 KB portrait AVIF at 390 under a 4× CPU throttle — and CLS is 0.000 on both.

CLS 0.000 and TBT 0 ms everywhere. Two numbers are worth understanding:

**Best Practices 96 on the product page is `image-size-responsive`, and it is not fixable here.** The spotlight image is displayed at 257×308 and its source is natively 257×308; Lighthouse wants 386×462 for a DPR-2 screen. This is exactly the resolution constraint in §6 — the brochure-extracted photography is 100–440px and must never be upscaled. Desktop scores 100 because DPR is 1. It resolves when the client supplies real photography, with no markup change (`srcset` is already in place). **Do not "fix" this by adding `widths` that upscale.**

**Home mobile Performance was 95–97 across five runs**, the lowest headroom on the site — but read the caveat above before quoting it. That measurement named `.hero__lede` as the LCP element, and **`.hero__lede` has not existed since `87e7471`**, which replaced the photographic hero with the video. The prose was never updated to follow it, so the figure was already describing a hero two rewrites out of date. It is recorded here as history, not as a current number.

What still holds regardless of which hero is in place: two production factors are absent from any measurement taken this way, because the preview server sends no `Content-Encoding` and no `Cache-Control`, so `uses-text-compression` (~82 KB) and `cache-insight` (~234 KB) both vanish on Vercel. The remaining lever is `build.inlineStylesheets: 'always'`, which was **not** taken — it inlines ~41 KB into all 96 pages and loses cross-page CSS caching.

The lesson is worth more than the number: **a measured figure and the prose explaining it rot at different rates.** The score stayed plausible while the element it named was deleted. If you re-run Lighthouse, re-read the sentence underneath it.

### One defect Lighthouse found that axe did not

`label-content-name-mismatch` — WCAG 2.5.3 Label in Name, serious impact — on every `EnquiryButton`. The button reads **ENQUIRE** and its accessible name was `Add <product> to enquiry list`, which does not contain "Enquire". A voice-control user saying "click Enquire" could not activate the one control that builds an enquiry. The static name also went stale the moment the label changed to "Added".

Fixed by deriving the name from the visible label: `` `${visible}: ${name}` ``.

**Two harnesses missed it.** axe's rule for this is experimental and off by default, so the e2e axe pass never ran it; Lighthouse weights it 0, so it never showed up in the accessibility score either — the category read 100 with a serious WCAG A failure present on 72 product cards. **A green axe run is not a claim that a page passes WCAG.**

### Enquiries are stored, not just emailed

Added 2026-08-09. Design doc: `docs/superpowers/specs/2026-08-09-enquiry-collection-design.md`.

`/api/enquiry` had no storage of any kind — an enquiry existed only as an email. The branch that ran when Resend threw returned 502, asked the buyer to try again, and **discarded the payload without logging it**: a validated, willing buyer lost silently on both sides.

The enquiry is now written to Postgres first and the email is a notification. Supabase project `spartan` (`wslylysakixrirxkozih`), one `enquiries` table with `items jsonb`, plus an `enquiry_lines` view unnesting it so product demand is a `group by`. A single insert is atomic without an RPC, which is why it is not two normalised tables.

Things that will look like bugs but are deliberate:

- **RLS is enabled with zero policies, and that is the design.** `anon` can neither read nor write; only the service-role key can insert, and it never leaves the serverless function. Supabase's linter reports `rls_enabled_no_policy` at INFO forever — do not "fix" it by adding a policy. Verified as `anon`: zero rows from both the table and the view while a row existed.
- **`enquiry_lines` carries `security_invoker = true`.** Postgres views default to definer semantics and would otherwise read straight past the RLS on the table beneath them.
- **`unconfigured` is not `failed`.** A channel with no credentials was never asked to carry the enquiry. Treating the two alike returns 502 for every submission in CI, which holds no secrets for either channel. The 502 rule is *every **configured** channel failed*. `decideOutcome` is a pure function so all nine combinations are asserted directly.
- **The response gained `recorded`.** Both clients key their honest-failure message off `recorded || delivered`, not `delivered` alone — with the row written, a mail outage is a success, not a caveat. The e2e assertions on the response body are exhaustive `toEqual`s and will fail if the shape changes again; that is intended.
- **The browser never talks to Supabase.** No anon key in the page, and `connect-src` needs no new origin.

A verify gate fails if the service-role key reaches `dist/client`, or if anything under `src/components`, `src/scripts`, `src/stores` or `src/layouts` names it or imports `enquiry-store.ts`. Vite inlines `import.meta.env.*` at build time, so a client-side reference would substitute the literal secret into a shipped bundle with nothing warning.

One trap worth keeping: **a data-modifying CTE's rows are not visible to the rest of the same statement.** The first round-trip check inserted a row and read the view in one statement, got 0 lines, and looked like a broken view. The view was fine.

### The admin subsystem — Phase 1's auth foundation

Added 2026-08-09 in six commits, `a28603c`..`1f74bdc`. Design doc:
`docs/superpowers/specs/2026-08-09-admin-dashboard-design.md`. Phase 1's
executable plan: `docs/superpowers/plans/2026-08-09-admin-phase-1-auth-and-enquiries.md`.

This is what §5's admin seam exists for, and it is the "reason as good" that
`/api/enquiry`'s comment demanded before anything else set `prerender = false`.
The design doc §1 records the four decisions: the public site stays
`output: 'static'` with a deploy hook firing on publish, the admin lives in this
repo so the Zod schemas stay one contract, Supabase Storage becomes the image
record with the build pulling images in, and the programme ships in four phases
each of which is independently shippable.

**Superseded 2026-08-12 — Phase 1 is now complete; see §13.** What this section
describes is the auth foundation it landed with: `public.admins`, cookie
parsing, the auth module, the middleware guard, the sign-in and sign-out
endpoints, the login page and `AdminLayout`. At the time there was no `/admin`
index, so a successful sign-in redirected to a route that did not exist, and
`toCsv` had tests but no caller. Both are closed. Everything below about *how*
auth works is current and is the reasoning §13 builds on.

**Identity and authority are separate facts, established separately.**
`src/lib/admin/auth.ts`:

1. The session cookie proves **who** the request is — Supabase Auth, anon key.
2. A row in `public.admins` proves they **may** be here — service-role key.

A valid Supabase account is therefore not enough. Public signup is disabled in
the Supabase dashboard, but a setting nobody re-reads is not a control; the
allow-list is what makes it hold by design. `public.admins` has RLS enabled with
zero policies, exactly like `public.enquiries`, so only the service-role key can
read it — from a function that has already verified a session.

`currentAdmin()` uses `getUser()`, **not** `getSession()`. `getSession` decodes
the cookie and trusts what it finds, and the cookie is sent by the browser.
`getUser` verifies the token with the auth server. For the check that decides
whether to hand over every enquiry the site has ever taken, the round trip is
worth it.

**The browser never talks to Supabase.** Sign-in is a plain form POST to
`/api/admin/login`, the session comes back as an HttpOnly cookie, and every read
runs server-side. That is why `connect-src 'self'` in `vercel.json` still needs
no Supabase origin, why no anon key reaches any page, and why `public.enquiries`
can keep RLS with zero policies rather than growing an "authenticated admins can
select" policy that would widen the surface for nothing.

The cookie options are forced in `authClient()` regardless of what
`@supabase/ssr` suggests: `httpOnly`, `secure`, `sameSite: 'lax'`, `path: '/'`.
The token is never read by page script so `httpOnly` costs nothing, and a session
cookie without `sameSite` is a CSRF foothold on an area whose forms change data.

Things that will look like bugs but are deliberate:

- **The middleware's early return is correctness, not an optimisation.**
  `src/middleware.ts` runs for **every** route, and for the prerendered public
  pages it runs at **build** time, where there is no meaningful request. Without
  the early return the build makes one pointless auth round trip per page — and,
  far worse, the public site's build starts depending on Supabase being
  reachable. A static catalogue that cannot be built offline because of an admin
  guard is the tail wagging the dog.
- **`/api/admin/*` is guarded as hard as `/admin/*`.** Protecting only the pages
  leaves every endpoint they call wide open, and the endpoints are the more
  valuable target — the pages only render what those hand over.
- **An unauthenticated API call gets 401 JSON; an unauthenticated page gets a
  302.** Redirecting a `fetch` would hand the caller an HTML login page under a
  200, which reads as success.
- **`guarded()` strips trailing slashes before matching.** Otherwise
  `/admin/login/` misses the `OPEN` set and `/admin/` misses `/admin`. Both
  failures are silent and in opposite directions.
- **`parseCookies` splits on the FIRST `=` only.** Supabase session cookies are
  base64 and routinely end in `=` padding; splitting on every `=` truncates the
  token. The symptom is an admin being signed out at random, which looks nothing
  like a parse bug.
- **Auth never fails open.** Any throw inside `currentAdmin` is logged and
  returns `null`. "Could not establish authority" has to read the same as "does
  not have it".
- **Sign-out is POST-only.** A GET would let a prefetch, an `<img>` or a link in
  an email end someone's session for them.
- **Wrong address and wrong password give the same message.** Distinguishing
  them tells anyone who asks which admin addresses exist.
- **`noindex` WITHOUT a `robots.txt` `Disallow`, and that pair is the point.**
  The design doc §3 called for both; the implementation deliberately took only
  the meta tag. `Disallow` stops a crawler fetching the page, so it never sees
  the `noindex` and the URL can still surface from an external link — and a
  `Disallow` line is a public index of your endpoints. `src/pages/robots.txt.ts`
  makes the same argument about `/api/enquiry`.
- **`AdminLayout` is not `BaseLayout`.** `BaseLayout` emits title, canonical,
  Open Graph and JSON-LD through `Seo.astro`, all of which describe a public
  document, and it would put the admin on the public site's CSS and JS budget for
  nothing. Because admin routes are SSR they never enter the sitemap either, so
  the "97 pages, one title and one canonical each" gate does not move.

**The CSP trap this subsystem must not fall into.** `npm run csp` derives
`script-src`'s hashes from `dist/client`, and SSR admin pages are never in
`dist/client`. An inline `<script>` on an admin page would ship unhashed, be
blocked at runtime, and **nothing would fail** — not the build, not `astro
check`, not the CSP gate. The page would render and silently not work. So: admin
pages emit no inline scripts and no client-side islands. Server-rendered forms,
and if behaviour is ever genuinely needed, an Astro `<script>` tag that bundles
to an external `/_astro/*.js` file which `'self'` already allows — never
`is:inline`. The login page's `error` query parameter is rendered as text
content, never as markup, because that value is in the URL and therefore
anyone's to set.

**CSV export carries a formula-injection guard.** `src/lib/admin/csv.ts` is
RFC 4180 with one departure: a field beginning `=`, `+`, `-` or `@` is executed
as a formula by Excel and Google Sheets, and enquiry messages are free text
written by strangers. Exporting them verbatim hands whoever opens the file a
script somebody else wrote. Prefixing with a single quote is the standard
neutralisation and spreadsheets strip it on display, so nothing is lost to a
human reader; a neutralised field is always quoted, because an unquoted leading
apostrophe is not reliably honoured. **The cost is that a genuinely negative
number becomes text** — free here, because the only numerics exported are
quantities and line counts and both are bounded at 1 by `enquiryPayloadSchema`.
It would not be free in a financial export, so do not lift this module into one
without re-taking that decision.

**What Phase 1 owed, and what it paid.** The design doc's acceptance conditions
included e2e coverage of the auth boundary and zero CSP violations on an admin
page. `tests/e2e/admin.spec.ts` now covers both — see §13. One half is still
outstanding and cannot be closed on this machine: **an authenticated non-admin
is refused** needs a real Supabase session, and CI holds no credentials. That
path is `currentAdmin`'s `if (!row) return null`, and it is verified by reading
rather than by running.

### The footer email field is gone

It was a newsletter subscribe with no mailing list behind it and — per the client, 2026-08-09 — never intended as one. Removed rather than wired: posting it to `/api/enquiry` would have sent sales an RFQ from someone who believed they were subscribing. The contact strip now carries address, phone and email.

`design/direction-b-forge.html` still shows the field. That is a deliberate departure from the approved design, like the Name field added to the home CTA, and is recorded in the component.

### What a next session picks up

The catalogue build is done. Three things follow it, in rough order:

1. **Deployment.** Vercel is assumed and configured but never confirmed with the client (§8 item 3), and nothing has been deployed. The domain has to land first — that is now a **single** edit to `site` in `astro.config.mjs`, since `src/pages/robots.txt.ts` derives the sitemap URL from it and `public/robots.txt` is gone. Vercel's project settings need `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (without them every RFQ in production is a log line), and the Resend pair for the notification.

2. **The rest of the admin dashboard.** Phase 1's auth foundation has landed — see "The admin subsystem" above — and what remains of Phase 1 is the part that has a user: an `/admin` index (sign-in currently redirects to a route that does not exist), the enquiry inbox and detail view, the `new → contacted → quoted → closed` status workflow, the product-demand report over the `enquiry_lines` view, and the CSV export route that `src/lib/admin/csv.ts` is waiting for. Phase 1 also owes its two acceptance tests: the auth boundary and zero CSP violations on every admin page.

   Then Phase 2, which is what §5 exists for: replace `file()` in `content.config.ts` with a database loader; `catalog.ts` and every catalogue page are untouched, and the acceptance test is a **byte-identical** build — build from JSON, migrate, build from Postgres, diff. It ships alone, behind its own verification, with nothing else in the commit. Three things to carry across: `serialiseJsonLd()` escaping matters the moment arbitrary text can enter the catalogue (§7); the "never invent product data" rule needs to survive contact with a UI full of empty fields inviting to be filled, and `docs/CONTENT-EDITING.md` is the statement of that rule for whoever maintains data in the meantime; and once the catalogue lives in Postgres and images live in Storage, **no build works offline** — that is inherent to the choice, which is why Phase 2 keeps a documented `CATALOGUE_SOURCE=json|postgres` escape hatch rather than pretending otherwise.

3. **Arabic localisation, deferred.** The brochure cover carries an Arabic wordmark (سبارتان) that is unused in this build. A second locale means RTL, a translated content model, and `hreflang` — it is a project, not a task.

One harness fact that will otherwise waste an hour: **`client:visible` islands do not hydrate in a background Chrome tab.** The rendering pipeline is frozen, IntersectionObserver never fires, and every enquiry button stays in its pending state. Force a paint or keep the tab foregrounded.

Keyboard *activation* was an open question through Tasks 13–14, because the browser-automation harnesses used then did not synthesise a `click` from synthetic Enter/Space on a `<button>`. **Playwright does**, and it is now covered — `tests/e2e/enquiry.spec.ts:158`, "a keyboard Enter on the enquiry button adds the product", passing on both projects. Focus trap, tab order and Escape were always verified.

---

## 8. Open items needing the client

None block development — placeholders are in place and marked.

1. **Real contact details** — address, phone, email, WhatsApp, hours. Currently placeholders in `src/data/site.json`.
2. **Resend API key + destination sales address.** Until supplied, `/api/enquiry` logs to console and returns success without delivering, so the flow stays testable.
3. **Deployment target** — Vercel assumed.
4. **Domain** — `astro.config.mjs` has `site: 'https://spartan.example'`. Sitemap and canonical URLs depend on it.
5. **Confirm the eight "Industries We Serve"** — currently inferred from the product mix, not stated in the brochure. Marked with an HTML comment where used.
6. **Certifications** — none are claimed anywhere on the site until the client supplies them.
7. **Product photography for the three air coolers and three consumer fans.** These six ship with `ds-photo-pending.png`: their only source is a flattened page raster with no separable product image. `src/content.config.test.ts` asserts exactly which six, so the list cannot drift. README launch checklist item 7.
8. **The datasheet conflicts in §6a** — the duplicated 1000W flood-light slot, the air-volume units (m3/min vs m3/h, now spanning the fan *and* cooler sheets), the 2.0 HP pump's `MP-203`/`MP-205`/`MP-208` model code, and the highbay's three-for-four columns. All are recorded exactly as printed; none is guessable from the documents.

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

---

## 11. The landing redesign — 2026-08-11

**Status: implementation complete and green. Documentation closed out 2026-08-11 — see "What is NOT done", now "What was left, and how it was closed".** Branch `feat/landing-redesign`, merged to `main`.

The home page was rebuilt from a Claude Design mockup, `Spartan Landing.dc.html`, in project `a3824cff-5eab-4def-9d1f-acd205eaad27`. The mockup's design tokens were byte-identical to `src/styles/tokens.css` — it was generated *from* this system — so nothing about colour, type or spacing had to be reconciled.

### What shipped

| Component | What it is |
|---|---|
| `Hero.astro` | Rebuilt around the floating helmet. Real visible `<h1>`, "Est. 2015" badge, cursor parallax, four animations. |
| `Ticker.astro` | **New.** Red marquee naming every category, with a CSS-only pause control. |
| `CategoryGrid.astro` | Restyled to a 5-column card shelf. Counts derived, empty categories honest. |
| `FeaturedLines.astro` | **New.** Eight curated products, division tabs, server-rendered with a no-JS fallback. |
| `EnquiryCta.astro` | Restyled; three client-confirmed claims added. Form untouched. |
| `Header` / `Footer` | Mockup type treatment. All seven routes kept; contact strip kept. |
| `About`, `ServiceCards`, `TrustBand`, `Spotlight`, `Faq` | Restyled to match; no content changed. |
| `src/lib/featured.ts` | **New.** The curated strip, named by slug. |
| `tests/e2e/home.spec.ts`, `motion.spec.ts` | **New.** 20 tests across both projects. |

`139 unit · 157 e2e (3 skipped) · verify 14/14 · 110 pages · 8 CSP hashes.`

### Decisions taken with the client, do not relitigate

- **The helmet is AI-generated** and ships anyway — see §7. Still needs client sign-off; `BACKLOG.md` P0.
- **All seven nav routes kept.** The mockup showed four including a `/divisions` route that does not exist. Only its visual treatment was adopted.
- **Two mockup claims were cut** as unverifiable: *"Send a list, a drawing or a photo of the old part"* (the form has no upload) and *"Quotes come back with unit price, stock position and lead time on every line"*. A build assertion in the e2e suite keeps them out. **"Est. 2015"** and the three enquiry list items were confirmed and kept.
- **The client hero artwork is retained but unused** — see §7.

### What was left, and how it was closed

All three items below were outstanding when this section was written and were
closed on 2026-08-11. They are kept rather than deleted because the four traps
under item 1 are the reasoning behind the entries that now live in
`docs/TRAPS.md`, and because item 3's answer corrected a claim item 3 itself
made.

1. **`docs/TRAPS.md` has not been updated.** **Done.** All four are now entries
   in that file, and a fifth was found in passing: the file still carried a
   "hero copy's top anchoring" trap describing the static still, a hero two
   rewrites dead. It was replaced with the two facts that are load-bearing
   about the current one — the 1080px breakpoint measured on glyph pixels, and
   the 136px of top padding that clears the absolutely positioned header. The
   four found during this work were:
   - **Whether an Astro `<script>` costs a CSP hash depends on how many pages use the component, not on how the tag is written.** Astro extracts a script to an external `/_astro/` chunk only when it is shared across pages; a single-page script is inlined and needs a hash. `EnquiryCta`'s is external because it renders on `/` and `/contact`; the hero's and Featured Lines' are inline because both render on `/` alone. **Rendering an existing component on one more page can move its script between those states and invalidate a hash with nobody editing any JavaScript.**
   - **No component on this site can offer a motion opt-in.** `src/styles/global.css:54` forces `animation-duration: 0.01ms !important` and `animation-iteration-count: 1 !important` on `*` under `prefers-reduced-motion`. No scoped rule outranks it, and `animation-play-state: running` cannot restart an animation that has already run to completion. A component's own `animation: none` still works, because the global rule only forces duration and iteration-count while the shorthand sets `animation-name`.
   - **`test.use({ reducedMotion: 'reduce' })` silently does nothing** on the pinned Playwright (1.62.1). It is not a top-level `TestOptions` field, so it compiles and is discarded. Use `test.use({ contextOptions: { reducedMotion: 'reduce' } })`. `tests/e2e/motion.spec.ts` has the comment.
   - **The two empty categories must never show a product image.** Electrical Accessories and Spill Control have `productCount: 0` and `heroProductSlug: null`. The mockup filled both with borrowed photos; a product image in a category that stocks nothing is an untrue claim about stock. `CategoryGrid` renders a marked empty tile and `home.spec.ts` asserts exactly two.

2. **`README.md` still describes the pre-redesign home page.** **Done.** Its
   "hero artworks — client assets, not extractions" section described
   `Hero.astro` rendering the supplied artwork under an `sr-only` h1 and a
   `PORTRAIT` media constant, none of which survives. It is now two sections:
   the helmet hero as built, with the AI-generation flag and the sign-off it
   still needs, and the two client artworks as retained-but-unused.

3. **Lighthouse has not been re-run.** **Done, and it corrected this item's own
   assumption.** Re-run 2026-08-11 on the current build, Lighthouse 12.8.2,
   five mobile runs on `/` and three on each of the other two pages, plus
   desktop. Every run of a given page scored identically, so the table in
   `README.md` is now flat numbers rather than ranges.

   **All three mobile rows moved, not only the home one.** This section — and
   the `README.md` note it inherited — said the two catalogue rows were
   unaffected. That was true of a *hero* change and wrong about this one: the
   redesign restyled `Header` and `Footer`, which render on every page. Home
   went 95–97 → **95**, catalogue 99 → **96**, product 98 → **97**. Desktop is
   100 across all three, and CLS 0.000 / TBT 0 ms held everywhere.

   What the re-run established about the home page, which is where the
   assumption had been that the helmet was the cost: LCP *is* the helmet at
   both presets, but the file is an 18 KB AVIF and only 0.12 s of the 2.79 s
   mobile LCP is spent loading it. 1.89 s is render delay behind two
   render-blocking stylesheets (29.5 KB + 21.9 KB, 450 ms). Shrinking the
   helmet would buy almost nothing; `build.inlineStylesheets: 'always'` is the
   lever, and it is still not taken.

   One finding that looks like a defect and is not:
   `image-delivery-insight` calls the 560px helmet variant oversized for a
   "266×266 displayed" box. It compares CSS pixels and ignores the preset's
   1.75 DPR — 266 × 1.75 = 466, and the next variant down is 420. 560 is the
   correct pick and narrowing `sizes` to satisfy the insight would ship a soft
   hero on every phone. It is unscored and cost nothing.

### Where to pick up

`BACKLOG.md` is accurate. Of the two P0 items this work created, one is closed:

- Get client sign-off on the AI-generated helmet. **Still open — the only thing
  this redesign blocks on.**
- Finish this documentation. **Closed 2026-08-11**, above.

Two things found during the work that are **not** the redesign's and remain open:

- **The `/electricals` and `/safety` headers pass contrast only because of their scrim.** Composited, the worst nav link measures 6.04:1; against the raw pre-scrim photograph it is **1.11:1**. Swapping a division hero photograph is therefore a contrast regression waiting to happen, with no gate that would catch it. `Header.astro` carries a comment; there is no test. **Now queued in `BACKLOG.md` P1** — it was recorded only here until 2026-08-11, which is how a known defect stays unqueued.
- **A `role="tablist"` conversion for the Featured Lines filter was considered and rejected.** (unchanged, see below) The grid is not a panel whose contents swap — it is one list with items hidden — and the full Tabs pattern needs roving `tabindex` plus arrow keys, which this design system has no precedent for. `role="group"` with a label was used instead. The reasoning is in the component; revisit only with the keyboard contract.

---

## 12. Typography — the weight scale and the mono, 2026-08-11

**Status: implemented and green.** Spec:
`docs/superpowers/specs/2026-08-11-typography-weight-and-mono-design.md`.

The brief was "titles feel heavy, and add one more font". Both were done. Three
things were learned by measurement that contradicted a confident assumption,
and those are the reason this section exists.

### The scale

Weights are now tokens in `src/styles/tokens.css` and the scale runs weight
**down** as size runs **up**, because optical weight grows with size: 450 above
100px, 500 for 40-99, 550 for 26-39, 600 for 15-25, 650 below 15. Before this,
61 rules were 700 and 15 were 800 — display headings, card titles and 11px
labels all at one volume, which is what made the largest type read as mass.
78 rules were converted by codemod.

**Seven rules were deliberately not converted**, and the guard that caught them
is worth keeping in mind: several rules already sat *lighter* than their band's
default (13px buttons at 500 in the 650 label band), so a naive token
substitution would have made them **heavier** — the opposite of the change.
The codemod only ever lowers. The scale is a ceiling per band, not a mandate.

### The accessibility coupling nobody had written down

`src/styles/global.css` sets `h1, h2, h3, h4 { font-weight: 700 }`, and WCAG
counts >=18.66px **bold** as large text. Three red headings on white —
`.card__title` (19px), `.rs__title` (19px), `.dv__name` (21px) — measure 4.30:1
and were clearing the 3:1 large-text bar **on a weight declared in a different
file**. Lowering that default re-tested all three against 4.5:1, which they
fail. All three now use `--color-red-deep`.

`.dv__name` is the one that would have been missed by reading the diff: it
declares no weight at all, so nothing in its own rule changed.

**This shipped with the first gate for rule 4.** `tests/e2e/contrast.spec.ts`
reads computed colour, size and weight, derives the applicable bar and asserts
the ratio. It is a named list of selectors, not a sweep — it cannot resolve a
background over an image, which is exactly why the division-header scrim case
(§11) is still open and still queued. Proved against a planted violation:

```
19px / weight 600 => NORMAL text, bar 4.5:1
rgb(235, 41, 39) on rgb(255, 255, 255) = 4.30:1
```

### The mono, and three assumptions measurement killed

JetBrains Mono Variable, OFL-1.1, for spec values and EN 388 rating cells — data
a buyer transcribes into an RFQ. IBM Plex Mono was the better industrial
pedigree and was rejected because it publishes no variable build, which
`fonts.css` warns against directly.

**Assumption 1: the home page would pay nothing.** False. The reasoning was
sound — a font is fetched only when a rendered element matches it — but the
premise was not: **`Spotlight` renders a full `SpecTable` and `En388Table` for
Grip Guard GP5 on `/`.** The home page is a product data view. Measured cost of
the full 39.5 KB latin file: home Performance 95 -> **91**, LCP 2.78s -> 3.23s.

**Assumption 2: `font-display: optional` would fix it.** False, and it changed
*nothing* — three runs, 91 each. `font-display` governs how a font **paints**;
the cost here is the **fetch**. To recover the point you must ship fewer bytes.

**Assumption 3: subsetting the characters was the lever.** Only partly. The
catalogue sets 83 distinct characters in mono, but clipping the weight axis
saved more than the characters did:

```
full latin, whole axis      39.5 KB   home 91
characters only             31.4 KB
characters + axis 400-600   23.1 KB   home 94   <- shipped
characters + pinned to one  16.7 KB   home 94
```

The last 6.4 KB buys nothing, so the two-weight design is kept: `.spec td` at
400 because a dense table should not shout, `.en td` at 600 because five rating
cells are the most consulted figures on a glove page.

**The honest outcome is that home is 94, not 95, and product is 96, not 97.**
That misses the spec's own acceptance criterion and is recorded rather than
rounded away. Accessibility held at 100 everywhere; the catalogue row did not
move because nothing on it uses the mono. One Lighthouse point and ~75ms of LCP
is the price of the catalogue having a typographic register for data.

> **Decided 2026-08-11: the mono stays and the point is accepted.** So **94 and
> 96 are chosen numbers, not drift.** A later session that finds them, spots the
> 23.1 KB font and removes it will score better and be undoing a decision that
> was taken with the measurement in hand. If the trade is ever genuinely
> re-opened, the lever is removing `--font-mono` from `SpecTable` and
> `En388Table` — the weight scale is independent and would stand on its own.
> Do not re-widen the subset either; that is where three of the original four
> points came back from.

---

## 14. The admin gets the design system — 2026-08-13

**Status: implemented and green.** `verify 16/16 · 173 unit · 206 e2e.`

The admin worked and looked like a default HTML document, and the reason was
concrete rather than aesthetic: **it was not using the design system at all.**
`AdminLayout` set `font-family: system-ui` and around thirty raw hex literals —
the site's own palette, retyped — were spread across six files with nothing to
say whether one had drifted. Fixing that is most of what this section is.

`src/styles/admin.css` is new and is the admin's equivalent of a component
library: shell, page header, tiles, chips, table, pills, pager, cards, form
controls. `AdminLayout` imports `tokens.css` and `fonts.css` alongside it and
nothing else — still deliberately not `BaseLayout`, which would drag in the
public site's SEO emission and component CSS for no gain.

### No JavaScript, and that shaped the design

Every off-the-shelf admin kit — shadcn, Radix, Headless UI, MUI — needs client
JavaScript, and the admin cannot have any: these routes are server-rendered, so
`npm run csp` never sees them, so an inline script ships unhashed and is blocked
at runtime **with nothing failing**. Astro also inlines a script used on exactly
one page, so even the "processed script" escape hatch turns into the forbidden
thing on a single-page admin route.

So there is no dropdown, no modal, no toast, and no client-side sort. The
filters are anchors, the pager is anchors, the status control is a form POST,
and the mobile table is a media query. Nothing here would break with scripting
disabled entirely, which is the correct outcome for this area rather than a
compromise.

### Status colour: weight, not hue

The palette is red, black and greys. It has no green or amber, and inventing one
for this screen would put a colour into the system that exists nowhere else on
the site and has never been measured against rule 4. **Decided with the client
2026-08-13: keep the brand palette.** The pill scale therefore runs solid to
dim — `new` is a filled red surface because somebody is waiting, `contacted` and
`quoted` are progressively quieter outlines, `closed` recedes. Every state also
renders its word, so none of it is colour-only information. Ratios are recorded
against each variant in `admin.css`.

### Two things worth knowing

**The tiles are counted by the database, not by reading rows.** `getCounts()`
uses `head: true` with an exact count, so it returns numbers and no rows —
which keeps it cheap and, more importantly, stops a summary tile from becoming
the unbounded read that §13 spent its time removing. `total` is summed from the
four status counts rather than fetched separately, because `status` is NOT NULL
with a CHECK naming exactly those four values.

**The counts and the list are allowed to disagree.** They are fetched in
parallel and a failed count does not blank the inbox: the tiles simply do not
render and the table still does. Only the list failing is an empty screen,
because only the list is what the page is for.

**Mobile turns the table into cards** below 760px, driven by `data-label` on
every cell. A column added without that attribute arrives on a phone
unlabelled — the note is on the media query.

### A fifth status: `test`

Added later the same day, at the client's request, because setting the site up
had left several of the team's own submissions in the inbox and they were
counting as demand.

**It is a status, not a flag.** A separate `is_test` boolean was the obvious
alternative and would let an enquiry be both "test" and "contacted"; that
combination has no meaning, because nobody works a test enquiry through a
pipeline. One column keeps the CHECK constraint, the filter chip and the status
control in step with nothing second to forget.

The database migration is `add_test_enquiry_status` and only widens the CHECK,
so no existing row could violate it and it reverts cleanly for as long as
nothing is marked `test`.

**`ENQUIRY_STATUSES` and `WORKFLOW_STATUSES` are now different things, and the
distinction is load-bearing.** The first is every value the column may hold and
drives the chips, the dropdown and the counts map. The second is the four
stages a real enquiry moves through, and is what anything reporting on the
business sums. `WORKFLOW_STATUSES` is derived from `ENQUIRY_STATUSES` by
filtering, so adding a stage means editing one array and the constraint. A unit
test asserts `test` is in one and not the other, because a leak in that
direction would put the team's own clicks into the headline figures with
nothing to show it had happened.

**Where it is excluded, and where it deliberately is not:**

- **Demand report** — excluded. This is the whole point: it is the screen
  someone buys stock from. Filtered in the query rather than by editing
  `enquiry_lines`, which already carries `status`; a plain unnest is easier to
  reason about than a view with policy baked into it.
- **Summary tiles and `lines`** — excluded, so they agree with demand.
- **The All chip** — NOT excluded, because clicking it lists everything. It
  counts `total + test` for that reason. Two different numbers on one screen,
  each correct for what it labels, and the inbox carries a line explaining the
  gap whenever a test enquiry exists.
- **The CSV export** — NOT excluded. It is the raw record and it already
  carries a `status` column, so anyone can filter it. Silently dropping rows
  from an export is the same defect as the truncated one §13 removed: a file
  that looks complete and is not.

### Password reset, and why it is scriptless at all

Built 2026-08-13, closing the gap found while setting up the first account.
`/admin/forgot` asks for a link, `/admin/reset` completes it.

**Supabase's default recovery flow cannot work here, and the reason is
structural.** It returns the token in the URL **fragment** — `#access_token=…` —
and a fragment is never sent to the server. Reading it requires script in the
browser, which admin pages cannot have: they are server-rendered, so
`npm run csp` never sees them and an inline script would ship unhashed and be
blocked with nothing failing.

`@supabase/ssr` uses the **PKCE** flow instead, where the link returns with
`?code=` in the query string. That reaches the server, so the exchange happens
there and the whole flow stays scriptless.

**The cost is real.** PKCE pairs the code with a verifier cookie written when
the reset was *requested*, so the link only works in the browser that asked for
it. `/admin/forgot` says so on its confirmation screen, because the failure is
otherwise baffling. It also means `/admin/reset` must be listed under
Authentication → URL Configuration → Redirect URLs in Supabase, or Supabase
refuses the redirect and the link dead-ends on its own domain. Both that and the
Site URL are queued in `BACKLOG.md`; neither can be done from code.

**The code is exchanged on page load, not in the POST.** It is single-use, and
spending it on the submit would mean a password rejected for being too short
burned the link and forced the whole request again.

**The confirmation names a condition, not an outcome** — "if that address has an
admin account". Saying "sent" of an address with no account is a lie; saying "no
such account" turns the page into an enumeration oracle. It is the same
reasoning as sign-in giving one message for a wrong address and a wrong password
alike, and an e2e test sweeps the page for the phrases that would give it away.

**Six routes are now outside the guard**, up from two. That is the widest the
unauthenticated surface has been, so each is justified on `OPEN` itself. The
rule it is held to is unchanged: nothing that reads or writes enquiry data
belongs in that set. Guarding the recovery pages would be circular — they exist
for the person who cannot sign in.

`src/lib/admin/password.ts` holds the rule: twelve characters, counted in **code
points** so six emoji cannot pass as twelve, and deliberately no composition
requirement, which produces `Password1!` rather than a passphrase. Stricter than
Supabase's own floor of six because this account is the only thing between a
stranger and every name, email and phone number the site has collected, and
there is no second factor.

### What could not be checked here

There are no Supabase credentials on this machine, so **every admin screen
except the login page was unreachable locally**. The login page was verified in
the browser (tokens resolving, Archivo and Inter applied, palette correct) and
the rest is verified by `astro check`, the build, and the e2e boundary suite.
The inbox, detail and demand screens have been seen by nobody in their new form.
Look at them on the deployment before trusting the layout.

---

## 13. Admin Phase 1 completed, and the hero WIP closed out — 2026-08-12

**Status: implemented and green.** `verify 16/16 · 150 unit · 199 e2e · 110
pages · 9 server-rendered routes.` Plan:
`docs/superpowers/plans/2026-08-09-admin-phase-1-auth-and-enquiries.md`, Tasks
7–12. Tasks 1–6 had landed on 2026-08-09; this closes the phase.

### What shipped

| File | What it is |
|---|---|
| `src/lib/admin/enquiries.ts` | **New.** Every admin read and write — `listEnquiries`, `getEnquiry`, `setStatus`, `getDemand`. The admin's seam, the counterpart to `catalog.ts`. |
| `src/pages/admin/index.astro` | The inbox. Filterable by status; sign-in no longer lands on a 404. |
| `src/pages/admin/enquiries/[id].astro` | One enquiry in full, with the status control. |
| `src/pages/admin/demand.astro` | Product demand over the `enquiry_lines` view. |
| `src/pages/api/admin/enquiries/[id].ts` | POST a status change. A form POST, not a fetch. |
| `src/pages/api/admin/export.csv.ts` | The caller `toCsv` had been waiting for since 2026-08-09. |
| `tests/e2e/admin.spec.ts` | **New.** The auth boundary, `noindex`, and zero CSP violations. |

No schema change was needed: `status` has been on `public.enquiries` since the
table was created — the enquiry-collection design doc §Schema put it there
precisely so the Supabase table editor could serve as the v1 inbox.

### The gate found a leak on its first run, and it was not in the new code

`npm run verify` gained a sixteenth gate: **an admin page that loses
`export const prerender = false` is silently built as a public static file**,
with whatever the build-time query returned baked into it. The build succeeds,
`astro check` passes, and every runtime boundary test still passes because the
runtime is no longer involved. Proved by removing the line from
`demand.astro`: the gate failed naming the page, and `tools/counts.test.ts`
fired too, because the pinned server-rendered route count drops when a route
stops being one. Two independent alarms on the same failure, which is the right
number for this one.

Its other half failed immediately and correctly: **`/admin/login/` was in
`sitemap-0.xml`, and had been since the guard landed on 2026-08-09.**
`@astrojs/sitemap` emits every known page route including the server-rendered
ones, and nothing had ever looked. A `noindex` meta tag asks a crawler not to
index a page it has found; a sitemap is a document you submit that *tells* it to
go and find it. The two were working against each other and the sitemap was
winning. Fixed with a `filter` in `astro.config.mjs`.

This is worth generalising: the admin's privacy had three controls named in the
design doc — the middleware, the `noindex`, and the deliberate *absence* of a
robots.txt `Disallow` — and the one place it was actually being announced was a
file nobody had thought of as part of the admin at all.

### The hero WIP, closed out

`b24589d` arrived as "WIP: landing page mobile improvements" and was green, but
it left two things behind.

**A trap entry in `docs/TRAPS.md` that its own change had made false.** The file
said "the hero source order — stage after copy — is load-bearing below 1080px"
and explained that the stage must come *after* the copy so the helmet does not
push the CTAs below the fold. The WIP moved the actions *below* the stage,
which is the exact arrangement that entry warns against — deliberately, and for
a reason the entry has no way to express. Guidance that is confidently wrong is
worse than no guidance, so it is rewritten rather than amended.

**Two comments in the file that contradicted each other**, which is how the
defect below was found. The markup comment said both CTAs "sit below the fold on
a 375x667 iPhone SE and a 360x640 Android"; the stylesheet's `(max-height:
700px)` block said shrinking the stage made "Browse catalogue" "fully visible
without scrolling on both". They cannot both be true. `tests/e2e/hero-mobile.spec.ts`
was written to assert the second, and it **failed on the 360x640** — the primary
CTA's bottom edge measured 648px against a 640px fold. 8px, on the narrower of
the two screens the comment claimed to have fixed, and on the one control the
whole site converts on.

The stage shrink was doing most of the work and stopping just short. Trimming
the two stacked 32px margins inside that same block to 24px and 20px brings the
edge to 628px with 12px of clearance. Tall phones are untouched — the block
never reaches them.

**The lesson is the one §11 already recorded in a different form:** a measured
number and the prose around it rot at different rates, and here two pieces of
prose in one file had already drifted apart from each other within a single
commit. The test is now the thing that holds the claim, and it names both
screens explicitly rather than relying on whichever viewport the project
happened to run at — the mobile project is a Pixel 5 at 393x851, tall enough to
miss this branch entirely.

### The footer social icons are gone

Three `href="#"` anchors on all 110 pages — Facebook, Instagram, LinkedIn — that
hovered, took focus and went nowhere. `BACKLOG.md` had carried the decision
since 2026-08-08 and named it a build decision rather than a client one: absent
the URLs, remove them. Same call as the footer's newsletter field on
2026-08-09, and the same departure from `design/direction-b-forge.html`, which
still draws them. `sameAs` stays absent from `organizationJsonLd` and
`twitter:site` from `Seo.astro`; all three are one fact and now agree.

**This changes site chrome, so it moves Lighthouse on every page type.** §11
established that the hard way — the landing redesign restyled `Header` and
`Footer` and all three mobile rows moved, not just the one that was touched.
The table in `README.md` has **not** been re-run and is now stale by one footer.

### Then Phase 1 was hardened, same day

Phase 2 — the catalogue into Postgres — is the next phase in the design doc and
was **not** started. Its entire acceptance test is a byte-identical build: build
from JSON, migrate, build from Postgres, diff. There are no credentials on this
machine, so that test cannot run, and the design doc is explicit that this is
the dangerous phase and ships alone behind its own verification. Starting it
unverifiable would be the worst possible way to begin it.

What was done instead is the part of Phase 1 that a real operator would have hit
on day one.

**The admin could not tell "you have no leads" from "I cannot see your leads",
and said the first.** Every read returned `[]` on failure, so an unconfigured or
unreachable deployment rendered *"No enquiries yet."* — a confident, false
statement about the business, on the one screen whose whole job is to be trusted
about exactly that. It is the same defect `/api/enquiry` was built to avoid on
the write side, where `unconfigured` has never been allowed to mean `failed`.

Every read now returns an `AdminResult<T>` — `ok` / `unconfigured` / `failed` —
and a caller cannot render a list without having said what it does when there
is no list. The three states are kept apart all the way to the screen:
`unconfigured` is the expected state of every local and CI run and says which
variables to set; `failed` says an outage happened and must not be dressed up as
a configuration note.

**The CSV export was the dangerous one.** Its failure path emitted a header row,
which is a valid, downloadable file that opens cleanly in Excel and says the
business has no enquiries. Unlike a broken page, that gets saved, attached and
quoted from, and nothing downstream of it ever asks again. It now answers 503 or
502 with a plain-text explanation and **no `content-disposition`**, so nothing
lands in a downloads folder.

**Two silent truncations.** Both reads selected every row with no bound.
PostgREST applies the project's row ceiling to an unbounded select and returns
the truncated set with no error, so the inbox would have begun hiding the oldest
enquiries at a row count nobody had written down, and the export would have
produced a short file that looked complete. The inbox is now paged at 50 with
`count: 'exact'`, so it can always state how much it is not showing; the export
batches until a short batch and **fails rather than returning a partial set** if
the batches never end.

**The redirect messages had never been rendered.** `[id].astro` redirected to
`/admin?error=not-found` and the endpoint to `/admin?error=bad-request`, and
`/admin` read neither — three dead paths shipped in the same commit that created
them. They now go through `src/lib/admin/notices.ts`, which resolves a code
against a closed whitelist. **The text is never taken from the URL**: a query
parameter is anyone's to write, and arbitrary text rendered inside the real
admin chrome is a credible phish however carefully it is escaped. An
unrecognised code is a parameter to ignore, not an error to report. The lookup
uses `hasOwnProperty` rather than `in`, because every object inherits
`toString` and `constructor` and the naive check would report those as codes.

Also: a status change now confirms itself rather than redirecting silently; a
failed read of one enquiry no longer bounces to the inbox claiming the enquiry
does not exist, which was a lie about a row that may exist and merely be
unreadable; and the nav lights the section you are in.

#### The gate refused the first attempt at the help text

`DataState.astro` told the operator to set `SUPABASE_URL` and the service-role
key by name, and the **service-role key never reaches the client** gate failed
the build: that identifier may not appear anywhere under `src/components`,
`src/scripts`, `src/stores` or `src/layouts`.

It is right to fail, and the fix is not an allow-list entry. The gate matches
the *name* because the name is the only reliable proxy for the *access* — Vite
inlines `import.meta.env.*` at build time, and one client-side reference would
substitute the real secret into a shipped bundle. A gate that tried to tell
prose from a property read is exactly the exception that eventually lets a real
reference through. The message describes the key and points at `README.md`
instead. In `docs/TRAPS.md` now, because the next person writing operator help
in a component will hit it too.

#### Four defects a review pass found in the hardening itself

Worth recording because three of the four are the *same* defect the hardening
was written to remove, surviving in the places the change did not look.

- **`getDemand` was still an unbounded select.** The whole point of the change
  was that an unbounded read is silently row-capped, and this one was missed —
  in the worst place, because `enquiry_lines` holds a row per product line per
  enquiry and so reaches the ceiling at a fraction of the enquiry count. A
  truncated demand report still renders its counts as fact, and it is the screen
  someone buys stock from. Now batched through the same helper as the export.
- **A page past the end rendered `Showing 49901–49900 of 120`** over an empty
  table, because `page` was clamped below but never against how many pages
  exist. And `?page=1e20` was worse than nonsense: the offset stringifies as
  `5e+21`, PostgREST rejects it as an integer, the read throws, and the operator
  is shown a **database outage** for a mistyped URL — a client error reported as
  an incident, which is the exact failure mode the `unconfigured`/`failed` split
  exists to prevent. `normalisePage` is now bounded at both ends and
  `listEnquiries` falls back to the last page.
- **Offset paging ordered by `created_at` alone**, which is not unique, so the
  order across batches was not total — a row could be returned in two batches
  or in none, putting a duplicated or missing lead into the CSV. `id` is now a
  tiebreaker on both paged reads. This does *not* make a batched read atomic; a
  row inserted mid-export still shifts the window, and that is accepted and
  documented on `readAll` rather than solved.
- **The status notice was rendered inside the success branch**, so a save
  attempted during an outage lost its "nothing was changed" message in exactly
  the case that makes it worth saying — the operator saw an outage panel and no
  word on whether their edit had landed.

### Proved in production, 2026-08-13

The section below was written before the site had credentials. It has since been
deployed to Vercel and **the whole path was exercised by hand against the real
deployment**: sign-in, the populated inbox, the detail view, a status change
that persisted, the demand report, the CSV export, and an enquiry arriving by
email. Everything it says is unproven is now proven, with **one exception**,
which stays open and is queued in `BACKLOG.md`: an authenticated non-admin being
refused. That needs a second Supabase user deliberately left off the allow-list,
and until it is run, `currentAdmin`'s `if (!row) return null` is still verified
by reading.

Three things that setup taught, all recorded in `BACKLOG.md`'s Done entry
because none of them is visible from the code: `ENQUIRY_FROM_EMAIL` exists to be
left empty and a real address in it will be rejected unless its domain is
verified with Resend; the fallback sender only delivers to the Resend account's
own address; and the admin's "Notified" line cannot distinguish a missing
setting from a rejected send, which is the one place the
`unconfigured`/`failed` distinction has not reached.

### What Phase 1 could not prove on this machine

There are no Supabase credentials here, and that shapes what the green run
means:

- The boundary tests assert what an **unauthenticated** visitor gets, which is
  nothing. That is the property that matters most and it holds whether or not
  the deployment is configured.
- **An authenticated non-admin being refused is not covered.** It needs a real
  session. The path is `currentAdmin`'s `if (!row) return null`.
- **`public.admins` is empty**, checked against the live project on
  2026-08-12. So even once the environment variables are set, nobody can sign
  in until a user is created in Supabase Auth and their `user_id` inserted
  there. `public.enquiries` is empty too, which is expected — the site has
  never run with credentials.
- **The three data states render correctly is asserted at the repository level
  only.** The pages that branch on them sit behind the guard, and CI has no
  session, so no e2e test can reach them. The branch in each page is one
  ternary over a discriminated union, deliberately.
- Nothing here has read a real enquiry, changed a real status or downloaded a
  real CSV. The repository degrades to empty results and `false` when
  unconfigured — asserted directly — so the pages render their empty states
  rather than throwing, but an empty state is not evidence that the populated
  one works.

The first end-to-end confirmation therefore has to happen against a configured
deployment, and until it does, §8's Supabase item is the gate on the whole
subsystem rather than a deployment detail.

Two follow-on facts:

- **The `@font-face` range must describe the file, not the family.** The
  committed file is clipped to `400 600`; advertising the native `100 800` makes
  the browser clamp silently, so a later `font-weight: 700` on a spec cell would
  render at 600 and read as a specificity bug.
- **A subset renders tofu, not an error.** `COVERAGE` in `tools/subset-mono.mjs`
  is the source of truth and `tools/subset-mono.test.ts` fails naming the
  character, its codepoint and the product. Proved by removing a character:
  `"Ω" (U+03A9) from premium-network-cable → "Impedance"`.

### What this changes about the approved design

`design/direction-b-forge.html` sets these headings at 700/800. This is a
visible departure from the signed-off direction, in the same category as the
Name field on the home CTA and the removed footer email field. **It needs
sign-off**, and it is in `BACKLOG.md` as a P0 alongside the AI-generated helmet.

---

## 15. Shrinkage removed from the three fire-retardant garments — 2026-08-16

**Status: done and green.** `verify 15/15 · 85 products · 110 pages.`

**This is the first time printed source data has been taken *off* a listing for a
commercial reason.** Everything before it either added verified data or corrected
a transcription error. That makes it a different kind of change from anything in
§6a, and it is recorded at length for that reason rather than because it was
large — it is three lines of JSON.

Three products carried a `Shrinkage` row, all of them fire-retardant workwear
from brochure page 23:

| Product | Printed value |
|---|---|
| Fire Retardant Pants | Below 2% |
| Fire Retardant Shirts | Below 2% |
| Fire Retardant Winter Jacket | 3% |

All three are gone from `src/data/products.json`. No other product in the
catalogue quotes a shrinkage figure, so the label now appears nowhere on the
site — swept against `dist/client`, zero hits across 110 pages.

**The decision is the client's, taken on 2026-08-16 on a recommendation from
their sales team.** It was put to them with the objection below stated first, and
they confirmed it. Do not silently reverse it; do not silently widen it either.

### The objection that was raised, and why it is still worth knowing

On a flame-resistant garment, dimensional change after laundering is not a
cosmetic fit detail. A shirt that shrinks pulls its cuffs and hem back, reducing
both coverage and the fabric-to-skin gap that the thermal protection depends on.
That puts shrinkage nearer to an EN 388 rating than to a colour option — and
these three records **cite no certification at all**, because §8 item 6 means
none is claimed until the client supplies one. The shrinkage figure was
therefore one of the few tested numbers standing behind a "Fire Retardant"
claim, and it is now absent.

Two further things were pointed out before the decision:

- **The removed values were favourable.** Below 2% is a good result. If the
  objection was really the jacket's 3% sitting beside two "Below 2%" siblings,
  removing that one row alone would have been the narrower change. The client
  chose all three anyway, with that alternative on the table.
- **`pre shrunk` survives in the Fabric row** on the pants and shirts —
  `100% Cotton mercerized pre shrunk` — because it is part of the printed fabric
  description rather than a separate shrinkage claim. The consequence is that
  the claim is still made on those two pages and the figure that quantified it
  is not. That is a vaguer page, not a quieter one.

### What was deliberately NOT done, and why it matters

**`src/data/products.raw.json` still carries all three rows.** That file is the
extractor's output — the record of what page 23 actually printed — and editing it
would destroy the trace back to the source document, which is what makes any
future spec audit possible. Nothing renders from it. **This is what makes the
change reversible**: the values are not lost, they are unpublished. Restoring
them is a copy from the raw file, not a re-extraction of a 163 MB PDF that is not
on this machine.

### The change is not live until the seed is applied

The catalogue has two copies now, and this commit only edits one.
`tools/seed-catalogue.mjs` reads `products.json` into Postgres, and the two were
proved byte-identical on 2026-08-13. `seed.sql` has been regenerated here and
contains zero shrinkage references, but **it has not been applied — there are no
Supabase credentials on this machine.**

Today nothing shows, because production still renders from JSON. But
`CATALOGUE_SOURCE=postgres` is one Vercel setting away (`BACKLOG.md`), so:

> **Flipping that switch before the seed is applied silently puts all three
> shrinkage rows back on the live site, with nobody having edited anything.**

`npm run catalogue:parity` is what catches it — it is currently expected to fail
against the live database until the seed lands, and that failure is this change,
not a regression. Move `seed.sql` with
`Get-Content seed.sql -Raw -Encoding utf8 | Set-Clipboard` rather than opening
it; `docs/TRAPS.md` explains what a text editor guessing ANSI did to `±`, `Ω`
and `—` on 2026-08-13.

### What no gate here can tell you

`npm run verify` passed 15/15 on this change and that is worth reading narrowly.
The catalogue-shape gate counts products, categories and EN 388 ratings and
checks every record still has a `source`; none of those moved, because removing
a spec row moves none of them. **There is no gate anywhere in this repository
that would notice printed source data going missing from a listing** — rule 1 is
gated in shape only, and it was written against invention rather than omission.
This section is the record, and it is the only thing playing that role.

---

## 16. Ten products and a certification set, from campaign banners — 2026-08-17

**Status: implemented and green.** `verify 16/16 · 207 unit · 214 e2e · 95
products · 120 pages.`

**Correction, 2026-08-27 — the folder audited below is no longer the site's
banner artwork, and §30 records what replaced it.** **This section stands
unchanged as provenance.** Ten products and an FR certification block still
trace to those JPEGs, so retiring the artwork does not upgrade the evidence
behind them — it removes the pictures, not the sourcing problem, and it makes
the BACKLOG item asking for real documents for those ten more important rather
than less.

A folder of 19 Kavalani campaign banners was audited against the catalogue. All
19 were opened and read; eight of them named something the site did not have.

**This is the first time catalogue data has come from marketing artwork**, and
that is the single most important fact about this section. Every value added
here is traceable — but to a JPEG produced by a design team, not to a brochure
page or a supplier datasheet. Those are not the same class of evidence, and §16
exists so nobody has to guess which is which later.

### The evidence problem, stated plainly

One banner in the set is **wrong about a protection rating**. The Grip Guard
GP1 artwork prints an EN 388 icon reading `4X43D`, while the glove's own label
— photographed in that same banner — reads `4131X`, which is what the catalogue
already said. The icon appears to carry GP5's rating. Against the real label it
overstates cut resistance as **D** where the glove says **X, not tested**, and
raises tear and puncture besides.

So the working assumption is: **banner artwork is a lead, not a source of
record.** It is good evidence that a product exists and roughly what it is. It
is not evidence that a printed number is correct. Four other banner values were
checked against the catalogue and agreed exactly — GP3, GP5 and Flex-Fit's EN
388 strings, and the insect killer's three model codes — which is why GP1 reads
as one artwork error rather than a systemic problem.

### Per-row provenance, and why the schema changed

`productSchema.specs` rows now take an **optional `source` string**. A record can
carry rows from two documents — the FR trousers' fabric line came off brochure
page 23, its certification block off a banner — and the product-level
`source: { doc, page }` cannot express that. The field renders nowhere; it exists
so a future audit can tell a datasheet value from an artwork value at a glance.
69 rows carry one today. A row without it is covered by the product's own
source, which is how all the pre-existing rows work.

This is a **shape** change, which rule 1 permits, and it costs nothing at the
seam: `specs` is a jsonb column, so the Postgres loader passes the extra key
through untouched, and every consumer (`SpecTable`, `ProductCard`, `seo.ts`,
`search.ts`) reads `label` and `value` only.

### What was added

**Certifications on the three FR garments**, which the site had never claimed —
IEC 61482, ISO 11612, ISO 11611, NFPA 2112, NFPA 70E, PROBAN treatment, plus
CAT 2 / ATPV 8 cal/cm² on the trousers and shirts and HRC 2 / ATPV 11 cal/cm² on
the coveralls. Also sizes, fastenings, waistband, reflective tape and pocket
configuration on the coveralls, and pocket configuration and weave on the other
two.

**Ten new products**, taking the catalogue from 85 to 95:

| Products | Category | Note |
|---|---|---|
| PVC Gloves | `hand` | |
| Oil and chemical pads, pillows, socks, booms — **7 SKUs** | `spill` | The category was empty |
| Solar Street Lights | `lighting` | |
| Orbit Fan `FW-40W` | `fans` | |

**Spill Control is no longer an expanding category.** It has seven products, an
`active` status, a real description and `heroProductSlug: "oil-pads"`. Electrical
Accessories is now the only empty one, for the unchanged reason that the brochure
has nothing to put in it.

### Four decisions inside the data

- **The PVC gloves' EN 388 is a spec row, not an `en388` object.** The banner
  prints four levels and no TDM cut character; the schema's object requires all
  five, and supplying `X` would be inferring a test result. It renders as the
  printed marking instead and stays out of `En388Table`, which is the component
  that presents protection levels as verified. The EN 388 total is still **6**.
- **The FR shirt's banner colours are a separate row.** The brochure says
  `Khaki | Light blue`; the banner says `Grey | Beige | Sky blue`. Beige and
  khaki may be one colour under two names, and sky blue and light blue likewise,
  but *may be* is not a merge — folding them together would alter a brochure
  fact on a guess. Both rows stand, labelled by origin. **Grey is genuinely new.**
- **The highbay's 15,000 lm figure was NOT taken.** The banner prints it with no
  wattage attached against a 100–300W range, and an unqualified lumen figure
  across four wattages is precisely the widened claim §6a's condensation rule
  forbids. Only the SKU (`BH-ELELHB`) was added.
- **`PROBAN®` ships as `PROBAN`.** The `®` is not in the mono subset, and
  `tools/subset-mono.test.ts` caught it — working exactly as designed. The
  documented fix is to widen `COVERAGE` and re-run the subsetter, and **that
  could not be done here**: the subsetter takes the full JetBrains Mono as an
  argument and only the 23.6 KB subset is committed. Adding the character to
  `COVERAGE` without rebuilding the font would be *worse than the failure* — the
  test would pass while the glyph shipped as tofu. So the character came out of
  the data instead. If the `®` is wanted, the full font has to be fetched first.

### Ten products with no photography

All ten ship `ds-photo-pending.png`, taking that list from 6 to 16, and
`src/content.config.test.ts` pins the new membership. The reason differs from the
original six: those have only a flattened datasheet raster, while these are
composited into styled scenes — a stand fan in a living room, absorbent pads on a
warehouse floor. Neither yields a clean cut-out. **The banners did not close the
photography gap for the two products that most looked like they would**: the
SPTSF-16 stand fan and the FW-40H wall fan appear in the set, but both are shot
against furnished rooms and a wire fan guard cannot be masked out of one to
catalogue quality. They stay on the pending list.

### What is NOT resolved, and must not be assumed

Four conflicts were found and **none was adjudicated** — each needs the client:

- **GP1's EN 388**, above. The catalogue is believed correct; the artwork is not.
- **The highbay's IP rating** — banner IP66, record IP65.
- **The solar flood light's IP rating** — the unit in the banner is labelled
  IP67, the record says IP66. This is the third IP conflict on this catalogue,
  after the flood light's own photo/table disagreement in §6a.
- **The orbit fan's model code** — `FW-40W`, against the catalogue's `FW-40H`
  (wall) and `AF-40W` (wall). The wall fan banner independently confirms
  `FW-40H`, so the catalogue is right about that one; whether `FW-40W` is a real
  third SKU or a blend of the two is open. The record carries it as printed.

Also open and not acted on: `Industrial Canopy Pendant Lamps` is the highbay, and
the word "highbay" appears nowhere a buyer can search.

---

## 17. The AF-40W is an orbit fan, and its own datasheet says otherwise — 2026-08-17

The client supplied `Spartan Fans Product Catalog.pdf` (4 pages) — the source
document three fan records already cite — with the correction that **AF-40W is an
Orbit Fan, not a Wall Fan**. The correction is right, and the document both
proves it and contradicts it, which is the reason this section exists.

### What the page actually contains

Page 3 is headed **"Spartan Wall Fan (AF-40W)"**. Its prose says *"ideal for homes
or offices requiring wall-mounted airflow"*, its spec line says
**`Mount Type: Wall Mounted`**, and a key feature says *"designed for secure wall
mounting with a stable bracket system"*. Four separate textual assertions of a
wall fan.

**Its photograph shows a ceiling-mounted orbit fan** — a caged oscillating head
suspended from a beam. **Its assembly diagram agrees**: all three figures show
the hatched mounting surface *above* the unit with the fan hanging below it.

Page 4, `FW-40H`, is the control that makes this unambiguous. That one is a
genuine wall fan and every part of the page says so together: the photograph
shows a fan flat against a wall with pull cords hanging, and its exploded diagram
labels **WALL**, **ANCHOR BOLTS**, **INSTALLATION PLATE** and **BACK HANG
TROUGH**. Page 3 has none of that hardware.

The likeliest explanation is that page 3's prose was copied from page 4 and never
corrected — the two pages share their structure closely.

### What was changed, and what was not

- **`name` is now `Orbit Fan`.** `variantLabel` stays `AF-40W`, the printed code.
- **The slug stays `wall-fan-af-40w`.** Slugs are permanent addresses
  (`docs/CONTENT-EDITING.md` §2); renaming a product does not entitle you to move
  its URL. The slug no longer describes the product and that is the correct
  trade.
- **`Mount Type` now reads `Ceiling mounted`**, carrying a per-row `source` that
  names the photograph and the assembly diagram as its evidence and records that
  the spec line prints `Wall Mounted`. This follows the MP-203 precedent in §6a:
  where one document disagrees with itself, record the value the rest of the
  document corroborates and say so.
- **The "Easy Installation: secure wall mounting with a stable bracket system"
  bullet was removed** rather than rewritten. It describes hardware this product
  does not have — page 4's, in fact. Rewriting it would have meant inventing an
  installation method; deleting it leaves the record silent on something the
  source cannot be trusted about.
- **Nothing else moved.** Voltage, frequency, power, fan size, speed, oscillation,
  tilt and power supply match the PDF exactly on all three fans, as do SPTSF-16's
  ten spec rows and FW-40H's nine. **The catalogue was already accurate about
  everything except the mount.**

### Resolved: `FW-40W` was the same fan, and the listing is gone

The campaign banner added on 2026-08-17 (§16) carries an orbit fan labelled
**`FW-40W`**, and this catalogue contains no such code — only `AF-40W` (page 3)
and `FW-40H` (page 4). With AF-40W now confirmed as the orbit fan, `FW-40W` reads
even more like a banner typo blending the two real codes.

**Confirmed wrong by the client on 2026-08-17 and deleted.** The record was
carried for a few hours rather than merged or removed on inference, and that was
the right order — the evidence for deleting it came from the client, not from
reasoning about blade colour.

**Nothing was merged out of it first, deliberately.** Its eight rows came from
the same banner that had just been shown to have the model code wrong, and
`AF-40W` already carries nine rows from its own datasheet. Folding artwork
values into a datasheet-sourced record to preserve them would trade the better
evidence for the worse. One detail is genuinely lost: a **2-year warranty**,
which the banner asserts and the datasheet never mentions. Worth confirming with
the client, because it would be a real addition rather than a restatement.

The catalogue is back to **94 products** and `fans` to **17**. Nine products now
trace to campaign banners, not ten.

### Product photography: attempted, and not possible

Each of the four pages is a **single flattened raster at 2481×3509** (300 DPI A4)
— there are no separately embedded product images to lift out, which is the same
condition that put the original six on the pending list.

Cropping works: the three product photos come out clean at roughly 950×900 to
900×2000. **Cutting them out does not.** The catalogue's convention is a
transparent PNG over a dark card, and every one of these fans is a *white* unit
photographed against a photographic background — a wooden ceiling, a furnished
room — seen *through a fine wire guard*. A luminance key was tried on the
best-contrast case, AF-40W on dark wood: it kept 39.4% of pixels and left the
ceiling fully visible, because the lit wood is brighter than the threshold and
the background shows through the mesh regardless. No threshold separates that,
and §6's warning applies — a product photo with an opaque background looks
exactly like the clip-forwarding bug and is ruinous on this dark layout.

So the three fans stay on `ds-photo-pending.png`. The crops exist and are good;
what is missing is masking, which is manual work in an image editor, not
something this pipeline can do.

### The three fan cut-outs, supplied 2026-08-17

The section above says extraction was attempted and failed. **The client then
supplied masked cut-outs of all three fans**, which closes that item and
supersedes the "stays on `ds-photo-pending.png`" conclusion:

| Product | File | Size |
|---|---|---|
| Stand Fan `SPTSF-16` | `src/assets/products/ds-stand-fan-sptsf-16.png` | 900×2000 |
| Orbit Fan `AF-40W` | `src/assets/products/ds-orbit-fan-af-40w.png` | 950×900 |
| Wall Fan `FW-40H` | `src/assets/products/ds-wall-fan-fw-40h.png` | 640×1100 |

Genuine alpha — 48–65% fully transparent with 12–21% partial, which is the wire
guard anti-aliasing rather than a hard key. Verified against the dark card
before committing.

**These are the first product images on the site that break the resolution
ceiling.** §6 records the constraint — every other product photo is natively
100–440px wide, must never be upscaled beyond ~2×, and is the cause of the
Lighthouse Best Practices 96 on product pages. The orbit fan now renders 950×900
into a 422×400 box, a downscale that covers DPR 2 properly; the related-product
thumbnails beside it are still 249×177 into 212×150. If the client can supply
the rest of the catalogue at this quality, that Lighthouse item resolves with no
markup change, because `srcset` has been in place since Task 8.

The pending-photography list drops from 16 to **13** and
`src/content.config.test.ts` pins the new membership.

One caveat worth recording: a faint beige tint survives *through* the guard mesh
on the orbit fan, where the wooden ceiling behind it could not be separated from
the wire. It is invisible at the sizes the design actually uses (~180px tiles,
~400px spotlight) and was checked at both. It would show if the asset were ever
used at full size — print, or a hero.

---

## 18. The hero is a campaign carousel, and the helmet is gone — 2026-08-17

**Status: implemented and green.** `verify 16/16 · 207 unit · 220 e2e.`

**SUPERSEDED TWICE OVER — see §26 and §30. Nothing in "Six of nineteen" below
describes the site as it is now.** The six posters were deleted on 2026-08-20 at
the client's request; the hard-coded `BANNERS` array was replaced on 2026-08-23
by uploads from `/admin/banners` (§26); and the nineteen-poster family itself
has since been replaced by new landscape artwork (§30). **The carousel mechanism
is still what runs** — the seven-slide track, the pips, the CSS-only pause, the
byte budget — which is why this section is kept rather than cut. Read it for the
machinery, not for the contents.

Replaced on instruction. The client's nineteen Kavalani campaign banners now
rotate in the hero stage, and the AI-generated helmet — flagged since
2026-08-11 and still unsigned-off — is no longer on the landing page.

### What was NOT touched, and why that is the point

The badge, the real `<h1>`, the two CTAs, the source order, the 136px of top
padding and the `.hero__stage` hook are unchanged. Every one of those is a
measured decision with a test behind it, and the brief was to change what sits
in the stage rather than to rebuild the hero. Treating it as a swap is what kept
`hero-mobile.spec.ts` meaningful instead of rewritten to match whatever the new
code happened to do.

### Six of nineteen, and two are excluded on a rule rather than on taste

**The Grip Guard GP1 banner is out because it is wrong about a safety rating.**
Its EN 388 icon reads `4X43D` while the glove's own label, photographed in that
same banner, reads `4131X` — cut resistance advertised as **D** where the glove
says **X, not tested**. §16 already treats banner artwork as a lead rather than
a source of record; putting that specific banner in the most prominent position
on the site would have published a false protection rating. **The Orbit Fan
banner is out** for a smaller version of the same thing: it labels the fan
`FW-40W`, a code belonging to no product (§17).

Both return by adding one line to `BANNERS` once the artwork is reissued. The
other eleven were left out for weight, not accuracy — see the byte budget below.

### Pure CSS, and that was the design constraint

No island, no hydration, works with JavaScript disabled. Seven slides on a flex
track, `translateX` in six steps over 42s, with the seventh slide a duplicate of
the first so the loop's reset lands on an identical frame. Six pips run the same
42s clock on staggered delays, so the lit pip tracks the visible slide with no
script tying them together.

**It auto-advances, so WCAG 2.2.2 requires a pause mechanism** — decorative or
not, and axe does not test for it. The control is a checkbox read by `:has()`,
copied from `Ticker.astro`, which solved this first: a pause button that needs
JavaScript to exist is no use to the visitor whose JavaScript is off, and the
animation runs for them regardless.

Slides are `alt=""` and the track is `aria-hidden`, exactly as the helmet was.
These are posters whose content is baked-in text that alt cannot reproduce, and
every product on them is a real item in the catalogue below.

### Three defects found by auditing the rendered page, not by reading the code

All three passed `npm run verify` and the axe sweep first.

1. **The card printed across the headline between 1081 and 1128px.** The
   helmet's stacking breakpoint was 1080px, measured on glyph pixels. A
   transparent PNG whose mass stops inside its own canvas can sit closer to the
   copy than an opaque rectangle can: measured with the card in place, its left
   edge landed **47px past the headline's rightmost ink** at 1081px. The
   breakpoint is now **1180px** (53px clear at the boundary, 112px above 1240).
   I had written in the component that "1080px stands and is if anything
   conservative" — that was an assumption stated as a measurement, and it was
   wrong.

2. **The inactive pip was 1.79:1 against the background.** I picked `#3a3a42`
   because it looked right and annotated it "3.2:1" from memory. Measured, it
   fails the 3:1 non-text bar it was claimed to meet. Now `#5c5c66` at
   **3.04:1**, measured. This is precisely what rule 4 means, and axe does not
   evaluate 1.4.11 on custom decorative-looking elements.

3. **The pause control did not exist on desktop.** It hung 34px below the card
   inside a hero with `overflow: hidden`, so it was clipped entirely — a WCAG
   requirement rendered to zero pixels. The controls now sit in their own row
   below the card, on flat black, which also fixed a fourth problem: white pips
   over the near-white footer strip these banners carry were invisible, and any
   scrim dark enough to fix that would have covered the client's own QR code.

### The byte budget, which is the real cost

The helmet was one 18 KB AVIF. Measured against the built output:

|  | default quality, widths ≤872 | shipped: q42, widths ≤600 |
|---|---|---|
| desktop 1440 @1x | 147 KB | **121 KB** |
| desktop 1440 @2x | 351 KB | **199 KB** |
| phone 390 @3x | 381 KB | **200 KB** |

Two things worth knowing before someone "optimises" this. **Astro's default
quality is below 58** — asking for 58 made the files *bigger*, which is how that
number was found. And `widths` deliberately stops at 600 rather than the 872 a
DPR-2 desktop would request: a 3x phone renders the card at 226px and was
pulling 678px of source for it. 42/600 was checked at 2x against the artwork's
finest detail, the QR code, which still resolves cleanly.

**This is still 7-11x the helmet's hero weight, and that is the price of the
brief.** §12 records a 23 KB font costing this page a Lighthouse point, so the
home score should be re-measured before anyone quotes it. It has not been.

### One CSP fact worth carrying

The carousel added no script, but **the hash still changed**: the breakpoint
moved from 1080 to 1180 and that number appears in the parallax script's own
`matchMedia`. One edited character in a media query invalidated the hash with no
JavaScript logic changing at all. `npm run csp` re-run, `vercel.json` committed.

---

## 19. The launch-feedback batch: sharing, a Categories menu, two link fields, and an SEO audit — 2026-08-17

**Status: implemented and green.** `verify 17/17 --full · 240 unit · 252 e2e · 94
products · 119 pages · 9 CSP hashes.`

The client reviewed the site and sent eight points, with the standing instruction
not to delay launch perfecting things. Four shipped, two are blocked on values
only they hold, and two are a project rather than a task. This section is the
record of which is which and why, because "we did most of the list" is the kind
of summary that hides the half that matters.

### What shipped

**Sharing on every product page (point 8).** WhatsApp, email and copy-link, in
`src/components/catalog/ShareRow.astro` over `src/lib/share.ts`. What travels is
the product's own name, its printed spec rows and the absolute URL. The
description is the existing `productDescription()` at the same 160-character
budget the meta description already used — a third description builder would be
a third thing to drift, and this one is already tested.

Two of the three are plain anchors, so they work with JavaScript off and cost no
bytes. Only copy-link needs script.

*The encoding is the whole risk and it is silent.* Catalogue spec values carry
`+`, `&` and `#`, and all three mean something inside a query string: `+` reaches
a mail client as a **space**, `&` starts the next parameter, `#` opens a fragment
and drops the link off the end of the message. Nothing throws. Nine unit tests
pin each against the real product it comes from, and the e2e suite re-checks
after the string has been through an HTML attribute, which is a different
failure from the builder being wrong.

**A Categories dropdown replacing three flat items (point 1).** Catalogue,
Electricals and Safety were three top-level entries; they are now one
"Categories" item whose panel carries both divisions and all fifteen ranges. Five
items in the row instead of seven, and a third division becomes a data change.

The division labels needed no data change at all — `divisions.json` has said
"Spartan Electricals" and "Spartan Safety" since it was written, and the old flat
nav was the thing shortening them. Worth knowing before someone "fixes" a
duplicate-looking name.

`src/lib/nav.ts` holds the model because the desktop menu is Astro and the mobile
panel is Preact, and the failure being guarded is a range present in one and
missing from the other — whichever renderer you happen to be looking at then
looks perfectly correct. Both build from one `buildCategoryGroups`; e2e pins the
category count on both breakpoints.

`section?: string` became `owns?: string[]`. One item now covers three subtrees —
`/catalogue`, `/electricals`, `/safety` — and a single section string could only
describe one, so the fold would have left the nav unlit on both division pages.

**No JavaScript opens the menu**: `:hover` and `:focus-within` on the `<li>`.
Closed it is `visibility: hidden`, which is what keeps its eighteen links out of
the tab order — `opacity: 0` alone leaves every one focusable and invisible. The
`<li>` is the full 84px of the nav row, and that is load-bearing: at the height of
its 11px link the pointer leaves it while travelling down to the panel and the
menu shuts in the user's face.

Electrical Accessories is marked "Soon", keyed off `productCount === 0` **and**
the status flag rather than the flag alone — Spill Control was flagged expanding
until seven SKUs landed and would otherwise still be advertising itself empty.

Measured cost per page, gzipped: **286 bytes of panel markup plus about 330 bytes
of island props, so roughly 615 bytes**, for the whole product IA and no script.
The props are the untidy half: the same category data is serialised into
`MobileNav`'s island props on every page *and* rendered into the desktop panel
markup, and on desktop the props are never read because the island hydrates at
`client:media="(max-width: 1080px)"`. Accepted rather than fixed — the two honest
fixes are reading the groups back out of the DOM, or server-rendering the mobile
list and reducing the island to a toggle, and both are a refactor of a working,
well-tested island for about 330 bytes.

**Optional datasheet and Kavalani fields (points 3 and 4) — shape only, and
inert.** `datasheetUrl` and `kavalaniUrl` on the product schema, each driving a
control that renders only when the field is present. **Neither renders for any
product today**, and that is the deliverable rather than a shortfall: there is
not one PDF in this repository or on this machine, and no Kavalani product URL is
written down anywhere in it. A datasheet link is a specification claim and a
wrong Kavalani link sends a buyer to the wrong product, so neither may be
guessed (rule 1). Supplying either is now a data edit.

The schemas refuse a wrong value, because the person filling these in will be
using a CMS field and not reading the schema: `datasheetUrl` must end in `.pdf`
(the control says "Download datasheet"; a web page would make it lie) and
`kavalaniUrl` must be absolute https.

The label is **"View on Kavalani", never "Buy on Kavalani"** — this site has no
prices, no cart and no checkout, and a control promising a purchase is the same
class of claim as structured data carrying a price that does not exist, which
`src/lib/seo.ts` refuses to emit.

**The Kavalani host is not pinned and it should be.** The strongest guard against
"View on Kavalani" navigating somewhere that is not Kavalani is requiring the
host, and that domain is recorded nowhere here — so it cannot be written down
without inventing it. A unit test asserts the current looseness explicitly rather
than leaving it an unnoticed gap.

**The SEO audit, and the two things it actually found (point 7).** All 119 built
pages were swept. Canonicals, meta descriptions, `og:image`, one `h1` per page,
no skipped heading levels, unique titles and unique descriptions were all already
clean and mostly already gated. Two defects were not.

*A long first spec row was eating the whole description.* `productDescription`
stopped at the first row that would not fit, so one oversized row hid every
shorter row behind it. `Industrial Exhaust Fan Standard` — twelve spec rows, a
160-character `Size` row first — had a 32-character meta description that was
just its name, while `Power: 40W to 350W` sat two rows down and fitted easily. It
now skips rather than stops: **20 of 94 descriptions improved, average +32
characters, worst case 32 to 155.** Nothing is invented; only which of the
product's own rows fit has changed. Rows keep document order but may now have
gaps, so the description is a summary and never a claim to be the whole
specification.

*One category page was over budget with nothing watching.*
`/catalogue/fans-ventilation/` was 176 characters, because the page appends a
product count to a description already 138 long — so the appended, derived half
was the part being cut off, which is the worst way round. The count now gives way
when the two do not fit; it is still in the page heading.

Both are now covered by a gate, `meta descriptions within 160 characters`.
**It decodes HTML entities first and that is not optional**: an ampersand ships
as a numeric entity and inch marks as `&quot;`, so measuring the raw attribute
counts five characters where a searcher sees one, and reports three failures that
are not real. That false alarm is how a gate gets ignored and then deleted. There
is deliberately no lower bound — six descriptions are short because their
brochure entries say very little, and padding one to a number would mean writing
product copy.

Titles over 60 were checked and deliberately left: 8 exist, and the format puts
the brand last precisely so that is what Google truncates. The product name and
its variant survive the cut on all 8.

### What is blocked, and on what

**Real contact details (point 6).** Still the client's to supply, and now said
out loud on every verify run rather than only in `BACKLOG.md`. Page for page
these are worse than the temporary domain: the placeholder phone number is a live
`tel:` link in the header of all 119 pages and the placeholder address is a
`mailto:` in every footer, so a buyer who tries either gets nothing. A temporary
domain costs ranking; these cost the lead itself. `whatsapp` was added to
`site.json` as an empty string and is reported as unset — rendering nothing is the
honest state for a channel with no number, and putting a plausible-looking number
in to make the site feel finished is precisely what that gate exists to catch.

**The admin panel for catalogue content and banners (points 2 and 5).** Not
attempted, and it is the largest thing on the list by a wide margin — product,
category, image, PDF, link and banner editing is Phase 3b, already designed in
`docs/superpowers/plans/2026-08-13-catalogue-editing.md`. It is also **blocked
behind a chain that has to be walked in order**: production still renders the
catalogue from committed JSON, the Postgres switch is staged but held on a stale
seed (three `Shrinkage` rows the database still holds), and the catalogue-shape
gate still reads `products.json` — so the day anything can write to those tables
the gate is checking a copy. Building write access before that chain is cleared
would mean an editor whose changes do not appear and a gate that cannot see the
data it guards.

### Two traps found, both now in `docs/TRAPS.md`

**"Shared across pages" counts page modules, not built URLs.** `ShareRow` renders
on all 94 product pages and its script is still **inlined into every one**,
because all 94 come from one dynamic route. The existing trap entry predicted the
opposite and would have had someone skip `npm run csp` — the hash count went 8 to
9, and a stale hash ships a page that renders and never hydrates. 1,040 bytes
inline per page, which also saves a request, so the outcome is fine; the
prediction was not.

**A CSS transition reads as "never happened" in a preview that is not painting.**
Verifying the dropdown's keyboard path by focusing the link and reading
`getComputedStyle` reported `visibility: hidden` indefinitely, across separate
calls seconds apart — indistinguishable from a hover-only menu, the WCAG 2.1.1
failure you would most expect to find. Nothing was wrong: the element already
matched `:focus-within` and the rule was winning. Transitions only advance while
frames are produced, and a hidden preview pane composites none. Assert it in
Playwright, or inject a rule disabling transitions before measuring.

### One pre-existing failure repaired, and one recorded

`tests/e2e/catalogue.spec.ts`'s combined-filter test had been **failing since
`d7a36a9`**, which is one of the three commits pulled in at the start of this
session. PVC Gloves took Hand Protection from 11 products to 12; one assertion
was updated and two were not. That broke it twice: the status-line wait became a
no-op — it waited for the line not to read "Showing 11", already true at 12, so
it settled instantly and the count was read before the search applied — and the
bound then compared the unfiltered 12 against a `< 11` check.

It was rewritten rather than renumbered, because its "glove" query could never
have tested what it claims: all four matches are inside Hand Protection, so a
search ignoring the category filter entirely returns the same four and passes. It
now uses "leather", which spans categories 9 to 3, so the three outcomes are
distinguishable — 3 combines, 9 means search replaced the filter, 12 means the
filter replaced the search. Proved against a planted violation.

**A genuine intermittent flake is left in place and named**:
`[mobile] /enquiry › lists the basket and persists quantity edits to the store`
timed out on a stepper button twice in six full-suite runs and passes 4/4 in
isolation. It is unrelated to anything in this batch, and the shape —
"element is not visible" under 8 local workers — points at hydration timing under
contention. CI runs 2 workers with one retry, which masks it. Queued rather than
re-rolled until green.

---

## 20. The spill control range gets real photography — 2026-08-17

**Status: implemented and green.** `verify 17/17 --full · 240 unit · 252 e2e.`

The client supplied seven masked cut-outs covering the whole spill control
range, which takes the "awaiting photography" list from twelve products to five.
These were the hardest seven to source: their campaign banner composites the
products into a warehouse scene, so unlike the brochure and datasheet artwork
there was no separable image to extract, and `tools/extract-catalog.mjs` was
never going to produce one.

### The check that mattered, and it was not the filename

The files arrived named `*nobg.png` and the panel they land on is a dark radial
gradient, so a flattened white background would render as a visible box around
each product — the exact defect `docs/TRAPS.md` records for the extraction
pipeline, which "refuses any cutout that came out fully opaque".

Verified on the alpha channel rather than on the name: all seven are 8-bit RGBA,
**40–55% fully transparent with a 6–10% soft anti-aliased edge**. That edge
fraction is the useful half of the number — a hard binary mask would show 0% and
would fringe against the gradient.

**Then verified again on the emitted output**, because Astro converts these to
WebP and a format conversion is exactly where an alpha channel gets dropped
silently. All fourteen emitted assets — seven PNG fallbacks and seven WebP —
carry byte-identical transparency percentages to their sources.

### Naming

`bn-` for banner-sourced, which extends the existing convention rather than
inventing one: the prefix names the **source document**, so `p04-` is brochure
page 4 and `ds-` is a datasheet. The three fans the client supplied on the same
day are `ds-` because their record cites the fans datasheet, not because of who
sent the file — the prefix tracks provenance, not delivery.

### What this does not fix

**These do not touch the Lighthouse ceiling, and the photography count dropping
should not be read as progress on it.** The cut-outs are 148–177px natively,
which is the low end of the catalogue's existing 100–440px range — `handoff.md`
§6 records that range as the constraint on the whole design and the cause of the
Best Practices 96 on product pages. Seven placeholders became real products;
nothing became higher resolution.

### The data edit

`src/data/products.json` was edited **as text, not round-tripped through
`JSON.parse`/`stringify`**. A re-stringify is not byte-identical to the committed
file, and the file holds 80 non-ASCII characters — `±`, `Ω`, `°`, `×`, inch marks
— which is the mangling `docs/TRAPS.md` devotes an entry to. The seven `images`
arrays were replaced in place and the non-ASCII count asserted unchanged before
and after. The diff is seven lines.

---

## 21. Kavalani links: 10 of 94, and the host is pinned — 2026-08-17

**Status: implemented and green.** `verify 17/17 --full · 242 unit · 258 e2e.`

The client had all 94 products checked against kavalani.com and returned the
results with per-row notes. Ten links are live, two are held, and the rest have a
clear answer: **Kavalani does not carry most of the Spartan range.**

That is the headline finding rather than a shortfall in the work. Seventy-two
products came back with a specific reason — Kavalani's entire glove range is four
SKUs and none is Spartan; it lists no goggles, no fall-arrest equipment, no
portable air coolers, no LED bulbs; its spill control is 3M. Those need nothing
further and should not be re-checked.

### The host is pinned, which was the open half of the field

`kavalaniUrl` now requires `https://kavalani.com/` or `https://www.kavalani.com/`.
Until the domain was confirmed the schema accepted any https URL, and a unit test
asserted that looseness deliberately so it stayed visible instead of being
forgotten. That test is now its opposite, and it includes
`https://kavalani.com.evil.test/` — a host containing the real domain as a
substring, which is what a careless check lets through.

This matters more than it looks. Nothing at the point of entry stops a pasted
wrong URL, and a control reading "View on Kavalani" that navigates elsewhere is a
lie the site would tell confidently. The build now refuses it.

### Two are held, and why that is the right call

Both are plausible matches on a Kavalani page that **prints no brand**, which is
the single attribute that would settle them — the disposable coverall and the
winter jacket. The sheet flagged both itself. They are not published, because a
wrong link is worse than no button and the confirmation is a one-line question.

### Eight more are recoverable, and they are the ones worth chasing

In each case Kavalani carries the Spartan product but **neither side publishes
the attribute that separates the variants**: three ventilation fans (three
Spartan exhaust fans listed, no size or mounting type on either side), two safety
glasses (three Spartan spectacles listed, our pages carry no model number), and
three safety shoes (one Spartan SKU listed, no cut or upper material stated).

This is a data-completeness problem on both catalogues rather than a matching
problem, which is why it did not resolve itself with more searching. Somebody who
knows the range assigns these in minutes.

### A judgement recorded rather than buried

**Six Spartan records describe a family that Kavalani splits into per-wattage or
per-size SKUs**, and each links one member of its own family — the solar flood
light links the 300W, pumps links the 1.5HP, the insect killer links the 2x15W,
the welding jacket links the Large. The backlit panel is the sharpest case: our
record covers 48W/80W/120W and Kavalani carries only the 80W.

Taken deliberately. The control says "view on Kavalani", not "buy this exact
variant", and the alternative — no link at all on six products Kavalani demonstrably
carries — serves a buyer worse. It is recorded here because it will otherwise be
reported as a mismatch by someone comparing the two catalogues side by side.

A unit test asserts no two products share a Kavalani URL, which is the error case
this shape could produce: two different records pointing at one page means one of
them is wrong.

### The negative case is tested, and it is the one that fails quietly

`tests/e2e/catalogue.spec.ts` asserts the button is **absent** on Grip Guard GP5,
chosen because Kavalani carries a four-SKU glove range with no Spartan in it —
exactly the product a careless "close enough" match would have linked. An
always-rendered button would send 84 products to a listing that does not exist,
and nothing else on the site would notice.

---

## 22. The catalogue is in Postgres, and the gate that guarded it changed shape — 2026-08-19

**Status: Stage 1 complete in the repository; one Vercel setting outstanding.**
`verify 17/17 · 259 unit · 258 e2e.` Plan:
`docs/superpowers/plans/2026-08-19-admin-content-management.md`.

Phase 2 had been staged since 2026-08-13 — tables, loader, parity harness, code
default left at `json` — and never finished. This finishes it, and it found
three things that a staged-but-unfinished migration hides well.

### What the database actually held

Credentials arrived on this machine for the first time, and the Supabase
connector was reachable. The catalogue tables were **not** in the state the
staging commit implied:

- **85 products against the repository's 94.** Nine products added since
  2026-08-13 had never been seeded, and the three fire-retardant `Shrinkage`
  rows removed on 2026-08-16 were still there. **Flipping the switch at any
  point in those four days would have rolled the live catalogue back.**
- **`datasheet_url` and `kavalani_url` did not exist as columns**, though
  `mapProduct` in the loader had been reading them since they were added. A
  Postgres build would have quietly produced 94 products with no datasheet and
  no Kavalani link, and the parity harness would have reported it as a
  difference that reads like a defect in the loader.
- `catalogue_audit` already existed and was empty, which Stage 5 needs and no
  longer has to create.

Project `spartan`, ref `wslylysakixrirxkozih`, **ap-south-1 (Mumbai)**. Worth
recording because it is also the answer to where compute should sit: the enquiry
path and every admin page round-trip to this database, while the pages buyers
actually browse make no server calls at all.

### The seeder had the same hole as the table

`PRODUCT_COLUMNS` never gained the two new fields either, so the tool that keeps
the two sources in step would have re-introduced the gap on its next run. It is
fixed, and **pinned to `productSchema` by a test** — a field added to one and not
the other now fails by name, rather than surfacing later as a mysterious parity
failure. That test is the durable part; the column list was the symptom.

### Parity, and what it is worth

`npm run catalogue:parity` reports **642 files byte-identical from both
sources**. That is the acceptance condition the design doc set for this phase and
the reason it ships alone.

Counts alone would not have been enough, so the data was checked for what
actually changed: 0 shrinkage rows, 7 spill control products, `AF-40W` reading
"Orbit Fan", 10 Kavalani links, 6 EN 388 ratings, 19 products carrying per-spec
provenance, 0 orphaned products, 0 broken hero references. And the non-ASCII
round trip is clean — `±`, `Ω` and `°` came back as themselves, which is the
check that caught the mojibake disaster on 2026-08-13.

### The shape gate had to change, and deleting it was the wrong answer

`npm run verify` hard-coded 94 products / 15 categories / 6 EN 388, read out of
`src/data/products.json`. Both halves of that stop being true the moment the
admin can edit the catalogue: the totals move for good reasons, and that file is
no longer what the site is built from.

It would have been easy to delete. It is one of the few **mechanical** defences
rule 1 has, on a catalogue of safety equipment, so it split in two instead:

- **Invariants**, checked outright, because they can never legitimately break
  whatever anyone types into an editor: every `categoryId` and `divisionId`
  resolves, every `heroProductSlug` is null or real, no duplicate slugs, and
  every product either cites a `source: { doc, page }` **or** has a
  `catalogue_audit` entry naming who entered it. That last clause is decision
  1.1 of the 2026-08-13 plan: training governs whether someone invents a figure
  today, but it does not survive staff turnover and it cannot answer a
  maintainer in two years asking where a rating came from.
- **Totals**, held against `tools/catalogue-snapshot.json`, regenerated
  deliberately with `node tools/catalogue-snapshot.mjs --write`. A number still
  cannot move without somebody acknowledging it; it is simply no longer a
  literal in a source file. Exactly the pattern the counts block already uses.

It follows `CATALOGUE_SOURCE`, so it checks the database rather than a file the
build ignores. Verified against both sources: identical totals, zero violations.

**It was proved to still bite**, because a gate that cannot fail is worse than no
gate: a stale snapshot fails naming the command that fixes it, and a planted
broken `heroProductSlug` fails naming the category. `npm run counts` reads the
same snapshot for the same reason — one number, one place, whichever way the
site is built.

### What is left

**One Vercel environment variable.** `CATALOGUE_SOURCE=postgres`, Production and
Preview, then redeploy. The code default stays `json` permanently so CI, which
holds no Supabase credentials by design, keeps building.

If that build fails, the loader threw rather than publishing a site with no
products — that is the designed behaviour, and the previous deployment stays
live.

---

## 23. Where to pick up — state as of 2026-08-19 (SUPERSEDED by §28)

Written so a new session can continue without re-deriving any of it. §22 is the
reasoning; this is the state and the next action.

### What is true right now

| | |
|---|---|
| Catalogue | **94 products / 15 categories / 2 divisions**, in Postgres AND in the committed JSON, proven byte-identical |
| Local build | Reads **Postgres** — `CATALOGUE_SOURCE=postgres` is in `.env` |
| Vercel | `CATALOGUE_SOURCE=postgres` set on Production and Preview; **added on 2026-08-19, it had never existed before**, so every prior deploy read the JSON |
| **Production** | **Rendering from Postgres, confirmed 2026-08-19.** Build succeeded and was fast |
| Gates | `verify 17/17`, 259 unit, 258 e2e, 119 pages |
| `main` | pushed, at `6b95e66` |
| Credentials | `.env` exists at the repository root with Supabase, Resend and the Vercel deploy hook filled in. It is gitignored (`.env` and `.env.*`) |

### Stage 1 is complete, and production is on Postgres

**Confirmed by the client on 2026-08-19: the Vercel build succeeded and was
fast.** That closes Phase 2, which had been staged and unfinished since
2026-08-13.

Two things worth keeping from how that confirmation had to happen.

**It could not be checked from outside, and that is not a gap in the checking —
it is what parity means.** Both sources emit identical bytes, so the live HTML
cannot tell you which one produced it. The live JS bundle hash matching a local
Postgres build was suggestive and not proof. The build log was the only place
the answer existed. Anyone re-running this migration on another environment
should expect the same and go straight to the log.

**Build time did not suffer.** The concern with moving the catalogue into
Postgres was that a build now makes network round trips before it can render a
single page — 94 products, 15 categories and 2 divisions fetched before the
first byte of HTML. In practice the build was quick enough that the client
volunteered it. Worth recording because it is the argument someone will
otherwise re-have from first principles, and because **the honest trade was
never speed — it was that offline builds have ended.** That is inherent to the
choice, not a defect, and it is why the `json` escape hatch stays.

### Stage 2: Tasks 7 and 8 are done; Task 9 is what remains

Plan: `docs/superpowers/plans/2026-08-19-admin-content-management.md`.

**Done.** `src/lib/site-content.ts` is now the seam for everything the public
site renders that is not the catalogue — what `catalog.ts` is for products.
Hero banners are `src/data/hero-banners.json` with an `order` and an `enabled`
flag; site text goes through `getSiteSettings()`; and **`site.json` has lost its
exemption from rule 3**, so a direct import of anything in `src/data/` now fails
the gate.

Two things from that work worth knowing before touching either file:

- **The carousel's clock is derived, not typed.** `heroClock(count)` in
  `site-content.ts` is pure and tested, and returns the cycle length, the
  keyframe step and the pip delays. At six banners it computes exactly the
  values that used to be hard-coded, which is what made the refactor verifiable.
  Proved by disabling a banner: five slides gave a 35s cycle and five pips.
  **Astro scoped styles cannot interpolate a frontmatter value**, so the
  generated rules ship in an `is:inline` <style>. That costs no CSP hash —
  `style-src` is `'self' 'unsafe-inline'` where `script-src` is hash-based with
  none — and every selector is prefixed `[data-hero-stage]` because the block is
  not scoped.
- **`seo.ts` no longer reads `site.json`.** `organizationJsonLd` takes the
  founding year as an option and omits `foundingDate` entirely when none is
  given, rather than guessing. That restores the rule that module's own header
  states and had quietly broken for one field.

**Task 9 is what is left of Stage 2**: `site_settings` and `hero_banners`
tables, a loader for them modelled on `supabase-catalogue.ts`, a seeder, the
`CATALOGUE_SOURCE` wiring, and extending the parity harness to cover the whole
site rather than the catalogue alone.

**Four of Task 9's steps still describe rather than show code.** That was
deliberate — Stage 1 had to land first — but it is now the thing blocking a
clean execution. Fill them in before starting.

### Two known gaps in the plan itself

- **Four steps in Task 9 describe rather than show code** — the site-content
  loader, its seeder, the `CATALOGUE_SOURCE` wiring and the parity extension.
  This was found in the plan's own self-review and left deliberately: Stage 1
  had to land first, and writing them speculatively would have meant inventing
  detail about code that did not exist. **Fill them in before executing Task 9.**
- The plan's Stages 3 to 6 (browse, edit, create/delete, upload and Publish) are
  specified but not planned. Each gets its own plan at its start, which is the
  convention the admin design doc set and the reason Phase 1's plan was worth
  following.

### Decisions taken, do not relitigate

- **Every admin may publish.** No `admins.role` column; allow-list membership is
  the whole permission model. Restricting it later is one column plus one check.
- **Publishing is an explicit button**, not publish-on-save (2026-08-13).
- **Admin-created products may leave `source` empty**; `catalogue_audit` records
  who created each row, and the shape gate accepts an audit entry in place of a
  source (2026-08-13, decision 1.1). The gate implementing this is live.

### One housekeeping item

The service-role key, the Resend key and the Vercel deploy hook URL were pasted
into a chat transcript on 2026-08-19. All three rotate in minutes. The
service-role key is the one that matters: it bypasses row-level security on
every table, including the one holding every name, email address and phone
number the site has collected.

## 24. The catalogue is editable from /admin — 2026-08-23

Plan: `docs/superpowers/plans/2026-08-20-admin-catalogue-editing.md`.
Spec: `docs/superpowers/specs/2026-08-20-admin-catalogue-editing-design.md`.

A signed-in admin can now browse every product and category, correct any field
except the slug and the EN 388 rating, and press Publish to request a build.
Six new server-rendered routes, no client-side JavaScript, one repository
module that is the only thing in the running site that writes a product.

### The three decisions that carry the weight

**Validation uses the schemas the build uses. There is no admin-side copy.**
`productSchema` and `categorySchema` now live in `src/lib/catalogue-schema.ts`
and `src/content.config.ts` re-exports them, so every existing import still
works and there is still exactly one of each. A save is validated against the
same object the Content Layer validates against at build time, which turns "this
edit would break the next build" into a form error at the moment somebody can
act on it. A copy is the obvious implementation and is a trap — the two drift,
and the failure lands hours later on a build somebody else triggered, on a
record they have never heard of.

They moved out of `content.config.ts` rather than being imported from it, and
that was measured before it was chosen: a server route that used the schema at
runtime came back with `node:fs`, `js-yaml`, `smol-toml`, `picomatch`,
`xxhash-wasm` and the loader's build-time error strings in its chunk, plus
`content.config.ts`'s module-scope `CATALOGUE_SOURCE` throw newly able to fail an
admin cold start.

**Read-only fields are enforced by ABSENCE from the accepted-field list.**
`slug`, `en388`, `source` and `status` are never read from the form. They are
carried over from the record already in the database, so a hand-crafted POST
that sets them changes nothing. The forms render them disabled, and that is a
courtesy to whoever is reading rather than the control — a `readonly` attribute
is a hint to a browser and a hand-written request ignores it. Both the unit
tests and the end-to-end tests post a forged slug, a forged EN 388 grade and a
forged source to prove it.

`en388` is the one that matters most. **X means the glove was not submitted for
that test, not that it failed**, so promoting an X to a D would advertise cut
resistance the glove has never been tested for. That is rule 1 on a piece of
protective equipment, not a cosmetic defect, which is why the grade is set from
the brochure by a developer and the form only displays it.

**Publish reports "Build requested", never "Published", and refuses outright
when unconfigured.** The deploy hook returns a job id the moment it accepts and
knows nothing about whether the build succeeds. Refusing when there is no hook
is deliberately the opposite of the enquiry rule: an unconfigured enquiry was
still written to Postgres and so was not lost, while an unconfigured publish
records nothing at all.

### What the plan got wrong, and why it matters

The plan was written before Task 3 landed and its Task 4 code was wrong in ways
worth keeping a record of, because two of them would have destroyed data
silently.

**`specsFromForm` dropped every per-row `source`.** 67 spec rows across the 94
products carry one, including the FR certification rows the schema singles out
as the ones most worth auditing — they were read off a marketing banner that
prints an EN 388 rating contradicting the glove's own label, which is precisely
why "audit a spec back to the page it came from" exists as a field. The form
has nowhere to show it and nowhere to post it, so saving any such product would
have deleted its provenance with nothing to show for it. It is now carried over
by index and **only while the value is byte-identical**: carrying it across an
edit would be worse than dropping it, because it would claim the new value came
off that page. The edit form therefore has to render existing spec rows first
and in order — that coupling is load-bearing and is commented at both ends.

**Spreading `...current` made clearing a field impossible.** An emptied Kavalani
box posts an empty string, a conditional spread declines to set the key, and the
old link survives underneath forever. Worse, the same conflation of *absent* and
*blank* made every partial POST destructive. The rule is now uniform and stated
in one place: a key missing from the form means the form did not offer that
field, so it is unchanged; a key present and empty means the editor cleared the
box.

That is not hypothetical. The product form drops its category `select` when the
category list cannot be read, so it posts no `category-id` at all — and the
plan's own end-to-end test posts three fields, which under the old reading would
have deleted every specification on the product it was proving could not be
hijacked.

**Two fields could still be blanked by a forged POST in a way the schema
accepted, so the shared schema was tightened rather than a second set of rules
added.** `productSchema.name`, `productSchema.categoryId`,
`categorySchema.name` and `categorySchema.description` are `.min(1)` as of
2026-08-23. `categoryId` is the sharp one: an empty one parsed fine and then
failed `npm run verify`'s referential invariant hours later, which is exactly
the delayed misattributed failure the shared-schema decision exists to prevent.
Verified against all 94 products and all 15 categories first — zero empties.
`slug`, `id` and `divisionId` were deliberately left alone and are in
`BACKLOG.md`; nothing can write them today.

### The Status control was dropped on purpose

The spec sketched a Published/Hidden control. `productSchema` declares
`status: 'published' | 'draft'` and **nothing filters on it** — neither
`src/lib/catalog.ts` nor `src/loaders/supabase-catalogue.ts` excludes drafts, so
a product set to draft still renders publicly. Shipping the control would be a
switch that does nothing, which this repository has already removed twice.

Making it real is not the three-line filter it looks like: hiding a product
moves the built page count that `tools/counts.test.ts` pins and the totals in
`tools/catalogue-snapshot.json`, so both gates need to express "94 products, 91
of them visible" rather than one number. It is filed in `BACKLOG.md` under P1,
and the form shows Status as read-only meanwhile.

"Add a specification" went the same way. As the plan drafted it, the button
submitted the form exactly as Save did and the page appended one blank row
either way. Making it real needs either JavaScript, which no admin page may
have, or a blank-row counter in the query string. Three blank rows do the same
job with neither, and saving yields three more.

### The first authenticated tests, and the throwaway database

Everything in `tests/e2e/admin.spec.ts` proves the guard turns people away.
Nothing had ever proved what happens after someone gets in, which was fine while
the admin only read data.

`npm run test:db:start` brings up a four-container Supabase stack, applies
`supabase/migrations`, seeds the catalogue and creates a test admin, and now
also writes `.test-db.json`. That file is the answer to "is the throwaway stack
up?" for everything that needs to know: `playwright.config.ts` feeds its
credentials to the preview server, `tests/e2e/admin-catalogue.spec.ts` throws
without it, and `npm run verify -- --full` fails without it. CI runs
`npm run test:db:start` before verify and its timeout went from 20 to 30.

**It fails rather than skipping**, and that is the whole point. A suite that
quietly dropped its only authenticated tests and still printed green is a worse
outcome than a red run with an instruction in it. The alternative to stopping is
running tests that save products against whatever `SUPABASE_URL` holds, which on
the machine of anyone who can deploy this site is the client's live catalogue —
and the publish test would deploy the production site. Playwright also stops
reusing an existing preview server in that mode, because one left running from
ordinary work holds the live credentials, and it blanks the deploy hook and the
Resend credentials so no run can trigger a deployment or post a test enquiry to
the client's real inbox.

**Two of those tests passed against a 403 before they asserted anything.**
Astro's `security.checkOrigin` defaults to on and refuses an on-demand POST
whose `Origin` header does not match the site — a genuine cross-site-request
defence nobody here had written down or tested. The forged-slug and forged-EN
388 tests were checking "the field did not change" about a request the server
had never processed. They now send the header a browser would, `forge()`
requires a 302 to `notice=catalogue-saved` before it checks anything, and a
separate test pins the origin defence itself.

### One thing this changed elsewhere

Three enquiry tests hard-coded `recorded: false`, which was correct only because
no local or CI run had ever had a database behind the preview server. With the
throwaway stack up, an enquiry genuinely is recorded, and `recorded: false`
became a false statement rather than a strict one. `tests/e2e/stack.ts` derives
the expected outcome from the run's configuration and both branches are asserted
in full — including that the "not configured, this has not reached the Spartan
team" copy is **absent** when the row was written, which would otherwise send a
buyer chasing an email for an enquiry that was already captured. Relaxing them
to accept either answer would have deleted the property they exist for. The nine
channel combinations stay unit-tested in `src/lib/enquiry-outcome.test.ts`,
without a database.

### There is no locking

Two admins editing the same product means the second save wins and the first is
lost. For a team of two to five that is the right trade — but *silently* is the
operative word, which is why every save writes a `catalogue_audit` row carrying
`before`. The overwritten values are recoverable from it.

A failed audit insert does not fail the save. The row is already written by
then, so returning `failed` would tell an editor their change was lost when it
was kept — rule 2's principle in a third place. It logs loudly instead, naming
the record that was saved but not audited.

## 25. The specification table stops being two layouts at once — 2026-08-23

`SpecTable.astro` renders two kinds of row, because the brochure prints two
kinds of line: labelled pairs (`Colors` / `Red | White | Blue …`) and unlabelled
sentences (`6-Point adjustment - perfect load distribution`). It was drawing
them in one bordered grid, so where they interleave the column boundary and the
grey `--surface-alt` label fill appeared and vanished down the table.

Measured on `/products/safety-helmets` before the change: four rows were a
single cell of 583px and one was 221px + 361px. **A vertical rule and a grey
block existed on exactly one row in five.** 49 of the 94 products mix the two
kinds, so this was over half the catalogue.

### What was rejected first, and why that was wrong

Grouping the named rows and putting the unnamed lines beneath them was the
obvious fix, and it was rejected on the first pass. The reasoning: 16 products
interleave the two shapes in a way that looks deliberate — on
`low-cut-safety-shoes-kpu` the line "Quarter | Tongue lining: Black mesh" is
printed under `Upper: KPU (Knitted Polyurethane)` and appears to describe the
upper; `winter-jacket` and `fire-retardant-pants` have the same shape. Reordering
does not fabricate a fact, but it does change which attribute a statement appears
to qualify, and that seemed worth protecting on protective equipment.

**It was the wrong call, and it cost two rounds of work.** The lines are
self-contained statements — "Quarter | Tongue lining: Black mesh" says what those
parts are made of whether or not `Upper` is directly above it — and rendered as a
group they read perfectly well. The client asked for the reordering twice before
it was done. What should have happened: raise the concern once, and treat the
answer as the decision.

Two passes were spent styling around the interleaving before removing it. Both
are recorded below, because the shape of that mistake is more useful than the
CSS was.

### Two passes that solved around the problem, and the third that solved it

**Two attempts missed, and both missed the same way — by treating the
interleaving as something to style rather than something to remove.**

*First pass:* dropped the vertical rules and the `--surface-alt` fill and
indented unnamed lines into the value column. That stopped the grid flickering
and left the column: 38% of the table reserved on `safety-helmets` for one row
in five, so the page went from a broken grid to a wide empty channel with the
single word `COLORS` in it. Tidier emptiness is still emptiness.

*Second pass:* made the column conditional — drawn only where at least half the
rows carried a label. That removed the empty channel on the ten products where
it was worst, and it still left a named row sitting between unnamed ones, which
was the thing being complained about the whole time.

*Third pass, and the actual fix:* **named rows are rendered first, unnamed lines
follow.** There is then exactly one transition instead of an alternation, the
column is used by every row that has it, and the lines below use the full width.
No conditional layout, no gutter cells, no `useColumn` — all of that existed
only to cope with the interleaving.

**The client asked for this directly, twice, before it was done.** The cost was
raised with them first and is recorded here: on `low-cut-safety-shoes-kpu` the
line "Quarter | Tongue lining: Black mesh" is printed under `Upper: KPU` and now
sits below the named block, which loosens the visual tie to the row it
elaborates. 16 products have that shape. Rendered, it reads fine — the concern
was overstated, and the earlier refusal to reorder cost two rounds.

**It is a RENDER order, not a data order, and that distinction is load-bearing.**
`specs` is filtered twice and never sorted, so the stored order is untouched.
`acceptProductEdit` in `src/lib/admin/catalogue.ts` carries a spec row's per-row
`source` across a save **by index**, matched against the order the admin form
renders — sorting the array here would be invisible on this page and would
re-attribute citations the next time anyone saved that product. The admin form
therefore still lists rows as stored, and now says on the fieldset that the
product page groups them.

### The label column is its content wide, not a fraction of the table

`width: 1%` with `white-space: nowrap` is shrink-to-fit: column one gets the
width of the widest label and nothing more. `width: 38%` was 222px held open for
the word COLORS.

The nowrap is not decoration. Without it the column collapses to min-content and
multi-word labels break onto two lines — "ARC RATING" and "TEST METHODS" both
did on `fire-retardant-pants`, which makes the rows ragged and taller for
nothing. The worst case is `premium-network-cable`, whose "Full Electrical
Characteristics" is 31 characters and takes about 250px of the 584px table: wide,
and honest, because the column is exactly its content. Below the breakpoint the
label stacks full width and the nowrap is dropped, so a long label can never
force a horizontal scroll on a phone.

### Baseline, not top

The label was `vertical-align: top` while its value took the initial `baseline`,
so a 10.5px uppercase label and a 13.5px mono value were positioned by two
different rules and sat visibly off each other — which is what the client meant
by the alignment being "completely off". Both cells are `baseline` now. On a
value that wraps, the label still lines up with its first line, which is what
`top` was reaching for and getting wrong.

### Verified by looking, not by measuring alone

The Browser pane would not composite frames for a screenshot, so verification
went through Playwright directly — a script that loads a page, crops around the
table and writes a PNG. That is what caught the wrapping labels, which no
geometry assertion had flagged.

A sweep then loaded **all 94 products at 1280px and at 390px** and checked four
things per page: no document overflow, no table overflow, no cell whose content
is wider than the cell, and every row header ordered before every full-width
line. Clean on all 188.

### The approved mockup does not cover this

`design/direction-b-forge.html` line 303 uses `th` as a full-width black section
header — `<tr><th colspan="2">Construction</th></tr>` over `td`/`td` data rows.
It never drew a per-row label and never drew an unlabelled line. The two-column
labelled row with a grey gutter cell is this implementation's own extrapolation,
so this is filling a gap the design left rather than departing from it.

### Two things found on the way, both silent

**A CSS block that had never once applied.** `.spec__feature` set the body face,
weight 500 and `--text`, under a comment explaining that these lines are prose
and setting prose in mono is the font doing decoration. All three declarations
lost to `.spec td` — (0,1,1) against (0,1,0) — so every feature line rendered as
mono at `--text-muted`, indistinguishable from the value cells. Confirmed in the
browser before touching it: computed `font-family` came back `"JetBrains Mono"`,
weight 400, `rgb(106,106,114)`. It is `.spec td.spec__feature` now. The fix only
raises contrast: `--text` is 17.9:1 on white against `--text-muted`'s 5.4:1.

**The same trap immediately bit the fix.** The mobile rule's `.spec__gutter {
display: none }` also lost to `.spec td`, and the cell stayed in the layout —
caught only by reading geometry back out of the browser rather than looking at
the page. Both are now in `docs/TRAPS.md`.

### Mobile stacks, and that needed ARIA

At 375px the table is 335px wide, so the 38% gutter took 127px and left 208px,
in which "6-Point adjustment - perfect load distribution" wrapped to three lines
beside 127px of nothing. No narrower fixed gutter rescues it either — the
longest label in the catalogue is 31 characters ("Full Electrical
Characteristics"), so `white-space: nowrap` is not available.

Below 620px the pair stacks: `display: block` on the table, tbody, tr, th and
td, label over value, full width, gutter dropped. **That transformation removes
the implicit table semantics in Chrome and Firefox**, so every role is restated
explicitly — `table`, `rowgroup`, `row`, `rowheader`, `cell`. Verified by
reading the accessibility tree at 375px: `table → rowgroup → row → rowheader
"Colors" → cell`. Without the roles that tree is a stack of anonymous blocks,
and nothing in the build, `astro check` or axe would have said so.

Table height on the helmet page went from 5 rows at up to 68px each to 277px
total, with no horizontal overflow.

## 26. Hero banners are uploaded from /admin — 2026-08-23

Spec: `docs/superpowers/specs/2026-08-23-admin-hero-banners-design.md`.
Plan: `docs/superpowers/plans/2026-08-23-admin-hero-banners.md`.

An admin uploads a banner at `/admin/banners`, names it, orders it, shows or
hides it and deletes it. No developer, no commit.

### Why this needed an architecture and not a screen

`Hero.astro` resolved banners through `import.meta.glob('/src/assets/banners/*.jpg')`
— a build-time read of the repository working tree. **A serverless function
cannot write into `src/assets/`**, so no admin UI could have put a file where
the hero would see it. The images had to move somewhere the running site can
write and the build can read, and everything else followed from that.

### The four decisions

**A private Supabase Storage bucket.** Public was the obvious choice and is the
one this repository has already rejected for its tables: RLS with zero policies
exists because *the site is published by the BUILD, not by the database*. A
public bucket is the same defect for the artwork — an ungated URL that serves
the client's files whatever the site is doing. `site-content.ts` signs a
one-hour URL per enabled banner instead.

**Optimised at build time, not served remotely.** `<Picture>` downloads each
signed URL during the build and re-emits local assets. Verified rather than
assumed: with one banner enabled, `dist/client/index.html` carries
`/_astro/verify-*.jpg` plus a responsive avif/webp set, and **contains no
reference to the Supabase host at all**. So `img-src 'self'` never widened, the
landing page keeps its image budget, and the band has known dimensions and
cannot jump.

The cost is that a banner is not live until the next build. That is the same
rhythm and the same Publish button as a catalogue edit, and it was the trade the
client chose knowingly over instant-but-unoptimised.

**Dimensions read from the file header.** `src/lib/admin/image-size.ts` parses
the JPEG `SOFn` marker and the PNG `IHDR` chunk in about thirty lines. `sharp`
is installed and would do it, but this would have been its first use **inside a
request handler** rather than at build time — a native binary in a serverless
bundle, in exchange for two numbers in the first two dozen bytes. It returns
null rather than guessing, and a null is a refused upload.

0xc0–0xcf is not a clean range of frame headers: 0xc4 is DHT, 0xc8 is JPG,
0xcc is DAC. Treating one as a frame header reads two bytes of a Huffman table
as the image's height — a plausible number, which is the worst possible answer.
There is a test for exactly that.

**The notice whitelist stays closed, and two integers ride beside it.** "The
shape is wrong" is a poor message when the admin knows the file was 1261 × 1561.
`dimensionsFrom` coerces `w` and `h` with `Number()` and drops anything that is
not a finite integer in range, so `?w=<script>` yields nothing. A number coerced
from a query parameter is not attacker text; the sentence still comes from
`ADMIN_NOTICES`.

### What the client decided

- **New banners arrive hidden.** Upload, check the thumbnail, set the order,
  then switch it on — so a half-finished banner cannot ride out on somebody
  else's Publish.
- **Wrong-shaped uploads are refused**, not cropped and not letterboxed.
  Between 3.8:1 and 4.2:1, at least 1400px wide, under 8 MB.
- **Hide and Delete are separate.** Hide keeps the artwork for a later campaign.

### The ordering decisions inside the module

`createBanner` stores the file, then the row, and takes the file back out if the
insert fails. `deleteBanner` removes **the row first**, then the object. The
reasoning is not symmetry: a row pointing at a missing file is an enabled banner
that **fails the next build**, so deleting the object first would let one
destructive click make the site unbuildable. The other order's worst case is an
orphaned file — invisible, harmless, logged.

### A protection that was lost, said plainly

`site-content.test.ts` used to assert that the Grip Guard GP1 and Orbit Fan
posters were not enabled. Both artworks state a wrong product fact — GP1's EN
388 icon reads 4X43D against the glove's own label of 4131X, advertising cut
resistance where the glove says NOT TESTED.

That test worked **by filename**. An uploaded banner has a generated path and an
admin-chosen name, so nothing in code can recognise those two artworks any more.
The protection is now Hero.astro's standing warning, the two BACKLOG.md items,
and a person not uploading them. The file comment says so rather than continuing
to claim a test covers it.

### Storage went back on in the local stack

`supabase/config.toml` was trimmed to four containers for a 7.7GB machine. It is
five now, and that file's own rule — *"re-enabling a service is fine if
something needs it"* — is what permits it. Upload code no test exercises was the
worse trade. `npm run test:db:start` creates the bucket; `npm run storage:setup`
does the same against production.

### The production database needs the migration

**This is the one step a deploy does not perform.** `hero_banners` exists in the
local stack and not in the live project, and the build proved it by failing
loudly the first time it ran against production — which is the designed
behaviour, not a defect. Before this ships:

1. apply `supabase/migrations/20260823120000_hero_banners.sql` to the live
   project, and
2. run `npm run storage:setup` once to create the bucket.

Until both are done the site cannot build, which is the correct way round: a
missing table stops a deploy rather than silently rendering a hero with no band.

### Counts

Four new server-rendered routes — 19 to 23.

## 27. The hero header gets the mockup's character — 2026-08-23

The client supplied a mockup of the headline block and asked for it. Three
additions — a hexagon badge with red rules running out of it, a heavy oblique
headline, a notched closing rule — and one deliberate exception to the type
scale.

**Weight 800 exceeds the scale on purpose.** `--fw-display` is 500, and §12
runs weight *down* as size runs *up* because optical weight grows with size.
That is still the right default, and every other display heading is untouched.
§12 also says the scale is "a ceiling per band, not a mandate"; this is one
element exceeding it on request, scoped to `.hero__title` rather than to the
token. Contrast is unaffected — at 76px this is large text either way, so brand
red on `SOLUTIONS.` is judged against 3:1 whatever the weight. `BACKLOG.md`
already carries "sign off the weight scale against the approved design", and
this is evidence for that conversation rather than a pre-emption of it.

**The badge outline is two clipped boxes.** `clip-path` removes a border along
with everything else outside the shape, so a bordered element cannot draw this.
The outer box is filled with the line colour, the inner with the page colour,
and the 1px difference is the outline — which stays 1px on the angled ends,
where a real border would have mitred badly.

### Three things that reported success without achieving it

All three were caught by looking at a screenshot, and none of them would have
failed a test written against the computed style.

**`font-style: oblique 9deg` did nothing.** Archivo ships no italic and no slant
axis, Chrome declines to synthesise one, and `getComputedStyle` returned
`"oblique 9deg"` while the glyphs rendered upright. The slant is a `skewX`
transform now.

**The transform was then overwritten by the entrance animation.** `transform`
is one property; `hero-rise` ends at `translateY(0)` and `animation-fill-mode:
both` keeps that, so the skew declared on the element lost the moment the
animation applied. `hero-rise-lean` carries the skew in both keyframes, and the
`prefers-reduced-motion` branch keeps it too — reduced motion asks for
stillness, not for a different design.

**A local build was writing expiring storage URLs into the page.** See §26 and
the first entry added to `docs/TRAPS.md` that day. `astro.config.mjs` read
`SUPABASE_URL` from `process.env`, which Vercel populates and a local `.env`
does not, so `image.domains` was empty on a developer machine — and Astro
passes a remote image it may not optimise straight through instead of failing.
Production was never affected and was checked rather than assumed: the live
home page carries zero storage references and serves `/_astro` assets.
`npm run verify` gained an eighteenth gate sweeping the built HTML for a signed
storage URL, because every other check stayed green through it.

## 28. Where to pick up — state as of 2026-08-23 (SUPERSEDED by §36)

Written so work can continue on a different computer without re-deriving any of
it. §23 is the equivalent for 2026-08-19 and is superseded by this. §22 and
§24–§27 are the reasoning; this is the state and the next action.

### What is true right now

| | |
|---|---|
| Branch | `main`, pushed, at `bf29ed2`. Nothing uncommitted. |
| Gates | **`npm run verify -- --full` = 18/18**, 323 unit tests, 295 end-to-end |
| Build | 119 pages · 23 server-rendered routes · 8 inline-script CSP hashes |
| Catalogue | 94 products / 15 categories / 2 divisions, in Postgres |
| Production | Rendering from Postgres. Catalogue editing, banner management and Publish are all live and have been used by the client. |
| Supabase | Project `spartan`, ref `wslylysakixrirxkozih`, ACTIVE_HEALTHY |
| Storage | Private bucket `banners` exists on production, holding the client's uploads |
| Vercel | `VERCEL_DEPLOY_HOOK_URL` is set on Production, and the Publish button works |
| Host | Still the temporary `spartan-ebon.vercel.app`. Buying the real domain is a launch blocker in `BACKLOG.md`. |

**Everything the admin needs is already applied to production.** The
`hero_banners` migration was applied on 2026-08-23 through the Supabase
connector, and `npm run storage:setup` created the bucket. Neither needs doing
again, and a fresh clone does not repeat them.

### Setting up the second machine

Everything is in the repository except **one file**.

1. **Clone, then `npm ci`.** Node must be **22.12 or newer**; the work was done
   on 24.
2. **Recreate `.env` at the repository root.** It is correctly gitignored and
   does not travel with the clone. Eight keys, and the first is the one people
   forget:

   ```
   CATALOGUE_SOURCE=postgres
   SUPABASE_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   SUPABASE_ANON_KEY=
   RESEND_API_KEY=
   ENQUIRY_TO_EMAIL=
   ENQUIRY_FROM_EMAIL=
   VERCEL_DEPLOY_HOOK_URL=
   ```

   **`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security completely.** The
   enquiries table has RLS with zero policies, so that key is the only thing
   between the public internet and every name, email address and phone number
   the site has collected. Move it the way you would move a password — a
   password manager or the Supabase dashboard, never email or chat. Both it and
   the anon key can be re-read from Supabase → Project Settings → API Keys, so
   copying them is never necessary.

   **`VERCEL_DEPLOY_HOOK_URL` is also a credential**: anyone holding it can
   trigger production builds. Vercel → Settings → Git → Deploy Hooks.

3. **Install Docker Desktop and start it.** On Windows it needs WSL 2:
   `wsl --install` in an Administrator PowerShell, reboot, then install Docker
   and choose the WSL 2 backend. Docker is required for `npm run dev:test` and
   for `npm run verify -- --full`; ordinary public-site work does not need it.
4. **`npx playwright install`** for the browser binaries.
5. **Verify before writing anything:**

   ```bash
   npm run verify            # expect 17/17 (playwright skipped)
   npm run test:db:start     # expect 94 products, 15 categories, bucket created
   npm run verify -- --full  # expect 18/18
   npm run test:db:stop
   ```

Two generated files are gitignored and will be absent on a fresh clone, which is
correct: `seed.sql` (written by `tools/seed-catalogue.mjs`) and `.test-db.json`
(written by `npm run test:db:start` while the throwaway stack is up).

### The one thing to get right on day one

**`npm run dev` is the wrong command for `/admin`.**

`.env` holds the live project's credentials, and `astro dev` loads `.env`, so a
plain `npm run dev` session at `/admin/catalogue` edits the client's real
catalogue and the Publish button deploys the production site. Neither asks.

```bash
npm run dev        # public pages only
npm run dev:test   # the admin: throwaway database, deploy hook and mail blanked
npm run test:db:stop
```

`npm run dev:test` starts the stack itself, points the dev server at it and
prints the test admin's sign-in. See §26 and `README.md`.

### What is finished, and where the reasoning lives

- **§24** — catalogue editing at `/admin/catalogue`. Shared-schema validation,
  read-only fields enforced by absence, Publish reports "Build requested".
- **§25** — the specification table stopped being two layouts at once.
- **§26** — hero banners uploaded from `/admin/banners` into a private bucket,
  optimised at build time.
- **§27** — the hero header's crest, oblique headline and closing rule, plus the
  three silent failures that work turned up.

`docs/TRAPS.md` grew by twelve entries over 2026-08-23. Read it before touching the
hero, the admin or anything that resolves an image — several of them are things
that leave a working-looking page.

### What to pick up next

`BACKLOG.md` is the list; these are the ones this work created or sharpened.

1. **A banner can still be published without anyone checking its facts.**
   **Narrowed on 2026-08-27, not closed (§30).** The two wrong-fact posters are
   no longer in the bucket, the table or the repository, so the specific risk
   this item was written about is gone. The general one is untouched: there is
   still no per-banner "checked against source" flag, and the three banners now
   live went up on nobody's signature. They were checked after the fact in §30
   and they hold — which is a competent design team, not a control.
2. **Sign off the weight scale against the approved design.** Already open, and
   §27 made it concrete: the hero headline is now the one element exceeding the
   scale's ceiling, scoped to `.hero__title` rather than the token.
3. **Re-measure the home page's Lighthouse score.** The hero gained a heavy
   headline and a full-width banner since the last measurement, and the banner
   is now the largest image on the site.
4. **Make `status: 'draft'` actually hide a product**, and the same for a
   category's `expanding`. Both switches exist in the data and filter nothing.
5. **Buy the real domain.** Still the largest launch blocker, and it is one
   value in `astro.config.mjs` plus a redirect.

### One flaky test, named rather than re-rolled

`[mobile] /enquiry › lists the basket and persists quantity edits to the store`
fails roughly twice in six full-suite runs locally under eight workers and
passes in isolation. It went red once during this work and passed on every run
after. It is in `BACKLOG.md` with the reproduction advice. **Do not treat a
single green run as proof it is gone**, and do not re-roll it into a retry
without reading that entry first.

## 29. The speed pass — four findings, four fixes — 2026-08-23

Scanned, measured, then fixed in order of blast radius. The scan is §BACKLOG's
"Speed" block; this is what changed and what it cost.

### What was already healthy, and must not be "optimised"

Gzipped HTML is 15/30/11 KB for home, catalogue and product. The largest client
bundle is 52 KB. Hydration is already gated — `client:visible` per product card,
`client:idle` for the drawer and filters, `client:media` for the mobile nav.
Measured CLS is **0.000** on all three page types. None of that needed
touching and none of it was touched.

**One claim in that scan was wrong, and the live site is what caught it.**
It said `/_astro` was cached immutable. Only `/fonts/` had that rule;
`/_astro` inherited Vercel's `public, max-age=0, must-revalidate`, so every
hashed asset was revalidated on every navigation. That makes fix 2 below
necessary but not sufficient — stable filenames turn a re-download into a
304, and the missing header turns the 304 into no request at all. Added
the same day, once the deployed response was read rather than the config
skimmed. Astro content-hashes everything under `/_astro`, which is exactly
the precondition `immutable` requires; HTML is untouched and must stay so.


### 1. The serverless function was 75% an image library nothing called

`_render.func` measured **25.6 MB, of which 19.1 MB was sharp**, bundled
because Astro routes an `/_image` endpoint into the function whenever a project
uses `astro:assets`. Nothing called it: public images are optimised at build
time, no server-rendered page imports `astro:assets`, and the admin's banner
thumbnails stream raw bytes through their own route. It was pure cold-start
weight on every route the function serves — including `/api/enquiry`, the most
latency-sensitive thing a buyer touches.

`image.endpoint` now points at an inert 404 (`src/lib/image-endpoint-disabled.ts`),
which keeps sharp out of the server graph so the bundler never traces it in.
Build-time optimisation is untouched and was checked rather than assumed: the
build still emits 15 avif and 316 webp variants.

**The gate is half of this fix.** A prerendered page using `<Image>` is fine; a
server-rendered one would call `/_image` at runtime and get the 404 — a broken
image on a live page with the build, `astro check` and every test green. Gate 18
refuses `astro:assets` in any file that opts out of prerendering, and refuses
the config line going missing. **Proved against a planted violation** — and the
first attempt to plant one silently did not land, because the file is CRLF and
the patch assumed LF. The gate reported clean and would have been committed
untested.

### 2. Every Publish invalidated every visitor's cached banners

A signed storage URL carries a JWT whose issued-at is minted fresh each build,
and Astro names an emitted asset from a hash of its source. So **48 banner
filenames changed on every Publish for artwork that had not changed**, on the
largest images on the highest-traffic page — so even a correctly cached browser
had nothing it could reuse.
Diffing two consecutive builds gave two disjoint filename sets.

The obvious fix — store a long-lived signed URL on the row — trades away the
short-lived-credential half of §26. This does not: `tools/fetch-banners.mjs`
downloads the enabled banners into `src/assets/banners/` before `astro build`,
and Astro treats them as ordinary local assets, hashed from **content**. Two
consecutive builds now emit identical filenames for all 48.

It also deleted a class of failure: no remote image source means `image.domains`
is gone, and with it the trap where Astro passes a remote URL it may not
optimise straight through into the markup (§27).

### 3. The Resend SDK, and the parity detail that would have failed silently

`resend` pulls `@react-email/render`, which pulls react-dom and prettier, for
one JSON POST made in six lines. None of the SDK's surface was used.

**Rule 2 made this a test job rather than a swap.** The three `ChannelState`s
are not interchangeable and a 502 to the buyer turns on the difference — and
that mapping had *no* tests while it used the SDK. It has eleven now, covering
both halves of the credential check, 200, a JSON error body, a non-JSON error
body, a throwing network, and that it never throws.

Parity was read off the SDK's source rather than the docs, and one detail
mattered: resend maps `replyTo` to **`reply_to`** on the wire. Sending camelCase
is accepted, returns 200, and is dropped — every reply to a lead would go to the
from-address instead of the buyer, with nothing in any log. There is a test
naming that.

With sharp and the SDK both gone the function is **3.3 MB, down from 25.6 MB.**

### 4. The LCP image was eager but not prioritised

`fetchpriority="high"` on the product page's main image — eager stops
lazy-loading but the browser still queues the fetch behind CSS and fonts at
default priority, and this is the measured LCP element on all 94 product pages.
The catalogue's first six cards load eagerly too; the H1 is that page's LCP
element so no metric moves, this is the grid not popping in late.

### The coverage gap this surfaced

Six hero tests assert an **empty** banner slot and pass only because
`--full` builds against the throwaway stack, whose banner table is empty.
Against a build from the live database they fail; with no credentials all 34
pass. **The gate is green on a state production is not in.** Pre-existing since
the client enabled banners rather than caused by this work, and `BACKLOG.md` now
says so and describes what a fixture would have to look like.

### What was not verified

**The authenticated admin end-to-end suite did not run.** Docker Desktop stopped
partway through the session and would not restart, so `npm run verify -- --full`
was unavailable for the last three commits. `npm run verify` is 18/18, 334 unit
tests pass, and 272 of the database-independent browser tests pass. The admin
suite touches none of these changes, but it was not run and none of those
commits claims it was. **Run it before the next deploy.**

## 30. The campaign posters are gone; three landscape banners are what ships — 2026-08-27

**No code changed. This is a record correction**, written because three earlier
sections describe a hero the site has not had for days, and one of them is the
first thing a reader meets on the subject.

### What is actually live

Read off the production `hero_banners` table and the storage bucket on
2026-08-27, not inferred from a commit:

| Order | Name | Size | Enabled |
|---|---|---|---|
| 0 | eye protection banner | 2508 × 627 | yes |
| 0 | pump banner | 2508 × 627 | yes |
| 0 | pump controller banner | 2508 × 627 | yes |

The bucket holds those three objects and nothing else — no orphans, and **not
one of the nineteen Kavalani posters**. So the artwork family §16 audited and
§18 built a carousel from is not merely unused; it is not in the system, and it
is not on this machine either (`banner images/` was removed from the repository
in `1d7de3a`).

All three are **4:1 landscape**, which is the shape §26 specified and the shape
the old posters could never be: those were portrait 1261:1561, which is why all
six were deleted on 2026-08-20 rather than letterboxed into a band.

**All three sit at `order` 0**, and that resolves deterministically rather than
arbitrarily — `getHeroBanners` sorts by `order` then `created_at`, so the band
runs eye protection, pump, pump controller, which is upload order. Worth knowing
before somebody reports the ordering control as broken.

### What this closes, and what it does not

**Closed: the two wrong-fact posters are not a live risk.** Grip Guard GP1 and
the Orbit Fan poster are absent from the bucket, the table and the repository.
The BACKLOG item reading "two campaign banners are excluded from the hero until
reissued" was describing an exclusion from an array that no longer exists.

**Not closed: nothing checks a banner's facts before it publishes.** That was
always the larger half of that item and it is untouched. The warning paragraph
in `Hero.astro` **stays exactly as written** — it is a rule about artwork, not
about six particular files, and a reissued GP1 poster would be as wrong in
September as it was in August. Do not read this section as permission to delete
it.

**Not closed: §16's provenance problem.** Ten products and an FR certification
block still trace to those JPEGs. Retiring the pictures does not upgrade the
evidence; it means you can no longer open the source.

### The three were checked against the catalogue, because §16 is why

Every model code on all three banners resolves to a real record — MP-40,
MP-158, MP-185, PC-10, FS-15, and the eye protection banner's four captions
(Safety Glasses, Over Glasses, Safety Goggles, Welding Goggles). The figures
agree too: the pump banner's HP and max-head pairs match the `Pumps` record row
for row, and the controller banner's voltage, frequency, 10A–1.1 kW, 1.5 bar,
10 bar, IP65 and one-year warranty match the PC-10 record exactly. **This set is
not GP1.** The pump banner shows three of the four models and omits MP-203,
which is a marketing choice rather than a discrepancy.

Two things to raise with the design team rather than fix here:

- **The controller banner captions two visibly different units identically.**
  The blue horizontal unit and the yellow-topped one with the pressure gauge
  both read `PC-10 AUTOMATIC PUMP CONTROLLER`. The catalogue holds one PC-10,
  and its Kavalani listing describes the horizontal blue one. What the second
  unit is, is a question for the client; the site says nothing about it either
  way, and nothing here should start.
- **"Made in India" appears on the artwork and in no record.** An origin claim
  rather than a protection rating, so it costs nothing today — noted so that it
  is not later read off the banner into the catalogue, which is exactly the
  route by which GP1 nearly became a site fact.

### The coverage gap this makes worse

§29 recorded that six hero tests assert an **empty** banner slot and pass only
because `--full` builds against the throwaway stack. That is now **three enabled
banners in production against tests that require zero** — unchanged in
substance, further from reality, and still the top of the testing backlog.

## 31. The product comes with you into the message box — 2026-08-27

**Status: implemented and green.** `verify 18/18 · 351 unit · 20 new e2e.`

/contact has told buyers since it was written to raise a product-specific
request from the catalogue, "so nobody has to work out which of four
ventilation fan sizes you meant" — and then handed them an empty box. The two
links on a product page now carry the product with them.

### What changed, in one line each

- **"Ask about this product"** goes to `/contact?product=…&name=…&intent=info`
  and the message box arrives holding `I'd like more information about:`, the
  product's name and its page URL.
- **"Request a quote"** goes to `/enquiry` with `intent=quote`, which puts the
  product **on the basket list** and opens with `Please send a quotation for:`.
  The buyer arrives with a complete, sendable enquiry.
- The generic "Request a quote" buttons on the hero, the home CTA and the
  category pages are untouched. They have no product to name.

### Three decisions worth the words

**THE LINKS STAY ORDINARY `<a>` ELEMENTS.** `products/[slug].astro` already
carried a comment saying that link is there because it works with JavaScript
off, and turning it into a click handler to smuggle state across would have
traded a working control for a convenience. Both destinations are prerendered,
so there is no request to read a parameter from; everything runs in the browser
after hydration, and without script the links still go where they always went.

**THE NAME TRAVELS IN THE URL, AND THE LINK DOES NOT.** The destination needs a
display name for the message and, at /enquiry, for the basket line — neither
page holds the catalogue, and shipping a slug-to-name map to both to avoid one
parameter costs about 2 KB gzipped each for nothing a buyer can feel. It is not
an injection route: every value is assigned with `.value`, never as HTML, and
`enquiryPayloadSchema` re-checks every field on submit. The **product link** is
a different matter and is rebuilt from the slug against the page's own origin.
A URL parameter naming a destination is how an open redirect starts, and there
was no reason to accept one. A slug that is not `[a-z0-9-]` is refused outright
rather than escaped.

**THE URL IS CLEANED THE MOMENT IT IS USED,** and at /enquiry that is not
tidiness. `addItem` increments an existing line, so with the parameters left in
the address bar a buyer who refreshed three times would be asking for four of
something they wanted one of, with nothing on screen to explain it. The message
box is only ever filled when it is empty, for the same class of reason: losing
what somebody wrote is a worse failure than never having helped them write it.

### Two lines, not sixteen

The message carries the name and the link and stops. Pasting the specification
table in was the obvious alternative and it is worse: a buyer faced with sixteen
rows they did not write deletes the lot, and takes the product name with it.

### The encoding trap, in a new place

Product names carry `&`, `+` and `#`, and in a query string those mean
next-parameter, space and fragment. `Cotton Pants & Shirts` unencoded arrives as
`Cotton Pants ` with the rest silently gone — the same failure `ShareRow` hit in
§19, and the reason `URLSearchParams` builds the href rather than a template
string. There are unit tests naming the real catalogue strings, and an
end-to-end test that walks the whole journey with that product.

### Where it lives

`src/lib/enquiry-prefill.ts` holds the two pure functions —
`readProductContext` and `prefillMessage` — so the rules are testable without a
DOM. The impure halves are four lines in `quick-enquiry.ts` (for /contact) and
a mount effect in `EnquiryForm.tsx` (for /enquiry). 15 unit tests, 10 e2e across
two projects.

## 32. Three gates that were green for the wrong reason — 2026-08-27

CI failed on the docs commit in §30, which touched two Markdown files and
nothing else. All three failures were older than that push and none of them was
visible locally. That is the theme, and it is worth more than the fixes.

### 1. A gate that passed only for people who had built once

`instructional docs name real paths` failed in CI naming `src/assets/banners/`
in three documents. The directory is written by `tools/fetch-banners.mjs` before
a build and is gitignored, so it exists on the machine of anyone who has built
with credentials and **never** on a fresh clone or in CI. Every developer saw
green; CI saw red; the documents were right the whole time.

Fixed by treating it as what it is — a generated path, in the same list as
`dist/` and `.vercel/` — rather than by editing the documents, which name it
correctly. Adding the fetch to `verify` was the other option and is worse: it
would make the public site's gate depend on Supabase being reachable, the exact
coupling `src/middleware.ts` carries an early return to avoid.

### 2. A gate that had been skipping silently on every CI run

`counts` reported `skip (vitest reported no count)` in CI and `ok` locally. The
cause was in `run()`: it returned **only stdout** when a command succeeded, and
stdout-plus-stderr when it failed. So which stream a tool chose to write its
summary on changed what the gate could see — but only on the happy path.
Vitest's summary did not land on stdout in CI, the total could not be parsed,
and the check stepped aside without failing anything.

Two changes, and the second matters more than the first. `run()` now returns
both streams either way, via `spawnSync` — success and failure behave the same.
And the skip branch was split: a **failed** unit suite still skips the counts
check, because it has already failed the run and a stale-counts error on top
would point the next reader at the wrong problem; a suite that **passed** while
its total could not be read is now a **failure**, saying so by name. A gate that
cannot see its input has to say so rather than step aside quietly.

**The first of those two changes was not the fix, and §34 is the correction.**
Merging the streams did not make the total readable on CI — the next run failed
this gate rather than skipping it, which is the split branch working exactly as
intended. Only the second change earned its place here.

### 3. Six pixels of the one control the site converts on

`"Browse catalogue" is above the fold on a 360-wide Android` measured 646.125px
against a 640px fold. The hero header restyle of 2026-08-23 — the crest, the
three-line oblique headline and the closing rule (§27) — spent the clearance
that the short-screen block had been written to buy, and put the primary CTA
6px under the crease on the tighter of the two screens it exists for. **Nothing
caught it for four commits because the full suite could not run locally** —
Docker was down, which §29 recorded at the time. This is that gap costing
something real.

**The trim came from rhythm, not from any of the three new elements.** The
crest, the slant and the rule are the mockup's character and the client asked
for them; shrinking one to satisfy a test would be undoing the design. What the
short-screen block did not touch was 48px of margin between the headline and the
rule — generous on a desktop, extravagant on a screen with 640px in total.
Trimming those two to 10px and 12px restores the edge to 620px, which is the
20px of clearance the block was written with.

Two things were ruled out and are worth naming so they are not tried again. The
hero's own 136px top padding is **clearance, not rhythm**: the sticky header's
bottom edge is at 130px on that screen, so spending it puts the crest under the
header. And the stage's 3:2 ratio below 720px is a pinned decision with its own
test.

### The flake underneath it, which was a different bug

CI reported the same test as *failed* on one project and *flaky* on the other —
passing on retry. That is not a 6px deficit, which would fail every time.
`hero-rise` starts at `translateY(16px)` and settles over about 0.9 seconds, so
a bounding box read before it ends is up to 16px lower than the layout. Under
contention the read lands mid-animation.

The tests now wait for the finite animations to finish before measuring, which
is what they always meant: "fully visible without scrolling" is a claim about
where the layout rests, not about a frame of the motion. **Infinite animations
are excluded and that exclusion is load-bearing** — the home page carries the
ticker, and `finished` on an infinite animation never resolves, so awaiting the
unfiltered list would hang until the test timed out. A worse flake than the one
being fixed. Five consecutive clean runs of the four hero specs after the change.

### One local trap found on the way

Running `tools/fetch-banners.mjs` **without** credentials empties
`src/assets/banners/`, and a later plain `astro build` **with** credentials then
fails: the rows are enabled, the files are gone. That is the loud failure §26
designed, working correctly — but it means a no-credential build leaves the
working tree in a state where only `npm run build` recovers it. Worth knowing
before diagnosing it as something else.

## 33. WhatsApp, and the first contact detail the client has actually supplied — 2026-08-27

**Status: implemented and green.** `verify 18/18 · 364 unit · 32 new e2e.`

A floating WhatsApp button on every public page, and an "Enquire on WhatsApp"
control on all 94 product pages. Both open a chat with Spartan carrying a
prepared message; the product one names the product.

### The number is real, and that is the headline

**`+973 3800 0458`, supplied by the client on 2026-08-27.** `site.json` held
`whatsapp: ""` from the day the field was added, and `npm run verify` has been
naming it as an outstanding launch blocker on every run since. That count is now
**three, not four** — phone, email and address are still placeholders.

The country code is worth noting: **+973 is Bahrain**, which agrees with the
campaign artwork (`-Bahrain-01.jpg`) and with Kavalani. The site's other
placeholder phone number is `+971 ...`, a UAE code. **Nobody should reconcile
those two by editing one to match the other** — one is a real number the client
gave and the other is a placeholder that has never been anything else.

### Three WhatsApp links now, and only two of them are leads

This is the part that will confuse the next person, so it is the part with a
test. `src/lib/share.ts` has built `https://wa.me/?text=…` since §19 — **no
recipient**, so the buyer picks who to forward a product to. That is a buyer
sending a page to a colleague. The two new controls address Spartan's own
number and are leads.

One path segment separates them, and if the implementations ever converge every
share button on the site starts messaging the company instead. `whatsapp.spec.ts`
pins the share link as recipient-less for exactly that reason, and
`src/lib/whatsapp.ts` is a second module rather than an argument to `share.ts`
so that a wrong default cannot reach across.

### Colour was measured twice, and the first measurement was wrong

Rule 4 says colour is measured. It was — and the first measurement still got it
wrong, in a way worth recording because the mistake is structural rather than
arithmetic.

WhatsApp's familiar green `#25D366` is **10.09:1** on `--surface-page`
(`#08080a`). That number is correct and it is irrelevant on its own: this is
the site's **only fixed element**, so it does not belong to a section. It floats
over whatever is behind it, and the product pages — where the second control
lives — are light. On white the same green is **1.98:1**, so the button's own
boundary fails the 3:1 WCAG 1.4.11 asks of a graphical object, on 94 pages. A
screenshot of the home page showed a perfectly good button and proved nothing.

`#128C7E`, WhatsApp's darker brand green, clears every ratio that applies:

| | |
|---|---|
| on `--surface-page` `#08080a` | **4.84:1** |
| on `--color-paper` `#f6f6f7` | **3.83:1** |
| white glyph on the fill | **4.14:1** |

The glyph is WhatsApp's logotype, which 1.4.11 exempts, so that last ratio was
never strictly required — it is met anyway, which is a better answer than
invoking an exemption. **Do not "restore the real WhatsApp green" without
re-measuring against a light section.**

### A gate caught the white glyph, and it was right to

`theme-sweep.test.ts` failed on `color: #fff` in the new component. That gate
exists because `ProductCard` once rendered every product name white on a white
card at 1.00:1 and no token ban noticed. Its allow-list was until now "a red
fill or the dark footer"; this is **the first entry that is neither**, so the
rule it encodes has been restated in place: the surface must be a known,
dark-enough fill this file's tokens do not describe — not merely "not white".

### Two decisions inside the messages

**The floating button names the site, not the page.** A control that reports
which URL somebody was reading when they tapped it reads as surveillance rather
than service. The product page's button carries a URL because there the buyer
chose to name one.

**Both messages are two lines** — the same shape as the /contact and /enquiry
prefills in §31 — so a lead arriving by any of the four routes reads the same
way in the sales team's inbox.

### Mechanics worth knowing

- **It renders nothing when there is no number.** `whatsappLink` returns null
  for an empty or malformed value and both consumers return null in turn.
  Setting `whatsapp` back to `""` removes both controls sitewide with no code
  change — the same honest empty state as the datasheet and Kavalani buttons.
- **It is in `BaseLayout`, so `/admin` never gets it.** The admin has its own
  layout. A fixed lead-capture button over an enquiry table is a way to hide a
  row.
- **Plain links, no script.** Nothing here is dynamic, so nothing needs a CSP
  hash.
- **`z-index: 40`** — above the header (25), below the mobile nav panel (60)
  and the enquiry drawer (70). A floating button reachable on top of a modal
  scrim is a control that works while the thing behind it is inert.
- **The bottom offset carries `env(safe-area-inset-bottom)`**, or the button
  sits under the iOS home indicator where the system takes the tap.
- **The accessible names differ deliberately** — "Chat with Spartan on
  WhatsApp" on the float, "Enquire on WhatsApp" on the product button. A
  product page carries both, and two links with the same name and different
  destinations is a Link Purpose failure axe reports.

### What was checked by looking, not only by asserting

The float is fixed, so the real question is what it covers. Swept every
interactive element on the home page at each scroll position and both form
pages at 375px: **no submit control, no pause control and no form field is
overlapped**. It clips the corner of large category cards and two FAQ
disclosures, all of which remain clickable elsewhere — the ordinary cost of a
floating button, recorded rather than discovered later.

### The banner-state gap is eight tests, not six

§29 recorded six hero tests that assert an empty banner slot and pass only
because `--full` builds against the throwaway stack. Against a build from the
live database it is **eight**: the two in §29's list plus
`motion.spec.ts`'s reduced-motion hero test on both projects. Measured today,
both ways round — 294 pass with an empty band, 8 fail with the client's three
banners. Unchanged in substance and still the top of the testing backlog; the
count is corrected here so the next person does not go looking for six.

## 34. The counts gate stops reading a TUI — 2026-08-27

**Status: implemented and green.** `verify 18/18 · 364 unit.`

The correction to §32's second finding. The diagnosis there was wrong; the
branch split that came with it is what turned a silent skip into a red line that
named the problem, and that is what made the third attempt possible.

### Three CI runs to learn one thing

1. The gate reported `skip (vitest reported no count)` on every CI run and `ok`
   locally. Diagnosed as `run()` discarding stderr on success. Fixed that, and
   split the branch so a passing suite with an unreadable total FAILS.
2. Next run: ` FAIL counts match the repo — the unit suite passed but its total
   could not be read`. So the stream theory was wrong, and the split branch had
   done its job — the run now said which of the two things was broken instead of
   stepping aside.
3. This change.

### What it does now, and why it is not a third theory

`tools/verify.mjs` scraped the total out of whatever vitest printed:
`out.match(/Tests\s+(\d+) passed/)`. Vitest now runs with
`--reporter=default --reporter=json --outputFile.json=…` and the total is read
from `numPassedTests`. The default reporter still prints, so a failing run reads
exactly as it did. The report goes to the OS temp directory and is deleted after
reading — a gate that dirties the working tree it is checking is its own kind of
bug.

**Say plainly what was not achieved: the CI-only difference was never
reproduced.** Colour codes, which stream, and the reporter CI selects were all
tested on this machine and all four combinations parsed correctly. At that point
the useful move is to stop needing the answer rather than to keep guessing at
it — a number that matters should not be recovered from a display format that is
free to change, on any platform.

### Proved both ways, because an alarm nobody has heard is not an alarm

The failure path was planted rather than assumed: with the report written
somewhere unreadable, the run gives

```
  ok   vitest — passed
 FAIL  counts match the repo — the unit suite passed but its total could not be
       read from the output, so the counts block was not checked
VERIFY FAILED — 17/18 gates
```

and with it restored, `ok vitest — 364 passed` and `ok counts match the repo`.
Same technique as the `astro:assets` gate in §29, and for the same reason: that
one reported clean against a planted violation that had silently failed to land.

### What the other two fixes did

Both held. The CI run that surfaced this one was otherwise clean:
`instructional docs name real paths — 144 references, all resolve`, and
`playwright — 347 passed` — which is the first time the **authenticated admin
suite has run since 2026-08-23**, Docker having been unavailable on this machine
for every local attempt since. §29's "run it before the next deploy" is
discharged, by CI rather than here.

## 35. The hero carousel gets tested, and two things fall out of it — 2026-08-27

**Status: implemented and green.** `verify 18/18 · 374 unit · 22 new e2e.`

Closing the gap §29 opened and §33 re-measured: the hero's browser tests
asserted an EMPTY banner band and passed on every CI run, while production had
shown a carousel since 2026-08-23.

### The shape of the problem, stated once

The hero has a **build-time branch**. No banners renders an empty slot; banners
render a carousel. Both states are real — a fresh deployment has none,
production has three — and a Playwright run can only ever be in one of them,
whichever the build happened to produce. CI built against the throwaway stack,
whose `hero_banners` table was empty, so it tested the state nobody was in and
reported green for it. **The carousel path had no coverage of any kind**, and
that included the WCAG 2.2.2 pause control, which axe does not test for.

### The fix splits by what each kind of test can actually decide

**Markup went to a container test.** `src/components/sections/Hero.test.ts`
renders `Hero.astro` directly through `experimental_AstroContainer` with a
mocked banner list, so it covers **both branches in one run** — no build, no
Docker, no database — on every `npm run verify`. Slide and pip counts, the loop
duplicate, the empty alts, the eager first image, the derived clock, and the
empty band's silence are all decidable from what the component emits.

**Behaviour stayed in a browser.** `tests/e2e/hero-carousel.spec.ts` asserts the
part markup cannot: that the track and the pips **stop together** when Pause is
pressed, that it toggles back, that it works from the keyboard, that it works
with JavaScript disabled, and that reduced motion stops the carousel and removes
the control. It **refuses rather than skips** when the build has no banners, the
same way the admin specs refuse without a database.

**The fixture is seeded, not hoped for.** `tools/seed-banners.mjs` draws three
flat 2800×700 panels with sharp and writes them into the throwaway stack's
bucket and table, so `--full` builds the carousel. Flat colour with no text on
purpose: a screenshot from a failing test should be unmistakably a fixture and
nobody should mistake one for artwork needing a source check. **Nothing asserts
the number three** — the tests read counts from the DOM and check the
relationships, so the fixture can change size without touching a spec.

### Two real defects the gap had been hiding

**1. On a phone the live banner band is 84px tall.** The empty slot opens out
from 4:1 to 3:2 below 720px, because at 375px a 4:1 band is too short to read.
That rule was written on `.hero__slot` and **never extended to
`.hero__frame`** — so the moment real banners arrived the band went back to 4:1
on phones. Measured against a build from the client's database: **335 × 84 at
375px wide.**

It is **not fixed here**, and that is deliberate. The fix is the content
decision BACKLOG.md has carried since the slot was built: one 2800×700 artwork
cannot fill both shapes, so either the phone letterboxes it as it does now, or
the frame crops to 3:2 and cuts the sides off posters carrying a headline and a
QR code, or a second crop is supplied. **Choosing quietly in CSS is the one
option that is not available.** The new test asserts what ships and names it as
the open question, so the decision breaks a test and gets read — which is what
the original pin was for and could not do, because it measured the empty slot
production had already stopped rendering.

**Decided the same day: the client chose to leave it**, with the cost stated.
So the 84px band is now an accepted trade rather than an open defect, and
BACKLOG.md carries it in the same form as the ticker's touch-screen pause
control — a decision with its cost written down and a test holding it in place.
**The distinction that matters: the missing `.hero__frame` rule was a defect,
and keeping 4:1 is a decision.** The record should not let the second launder
the first.

**2. A pin that measures the state you are not in is not a weaker pin.** It is
the absence of one wearing its clothes. Three separate markers had been left
around this hero — the deleted carousel tests in `home.spec.ts`, the
absence-assertions in `motion.spec.ts`, the aspect-ratio test in
`hero-mobile.spec.ts` — each written explicitly to notice when banners came
back. **All three went on passing when banners came back.** That is worth more
than the bug it hid: a marker is only a marker if the thing it watches can
change under it.

### Two mistakes made writing this, both caught by the tests failing

**`test.use({ reducedMotion: 'reduce' })` does nothing on this Playwright
version** — only `contextOptions.reducedMotion` is honoured, which
`motion.spec.ts` already documented at length and this work walked into anyway.
It compiles, it is silently discarded, and the page never enters the
reduced-motion branch. The only reason it was noticed is that the assertions
failed; had they been weaker they would have measured the ordinary page and
passed.

**`\b` is not a token boundary for a BEM class.** `hero__slot-icon` and
`hero__slot-label` both satisfy `\bhero__slot\b`, so the first count returned
four empty slots where the component renders one. The helper parses class lists
now rather than pattern-matching them.

Both were caught because the assertions were specific. A test written to a
rounder number would have absorbed either.

### Proved against planted violations

Two, in the component, following §29's practice:

- a pip per **slide** instead of per **banner** — the realistic bug, since the
  loop duplicate would light an extra pip — fails `renders one pip per banner`.
- the pause control's class renamed, standing in for its removal — fails
  `renders a pause control that a keyboard can reach`.

Both failed by name, and `Hero.astro` was restored byte-identical afterwards.

### What could not be verified here

**`--full` still did not run: Docker's WSL engine will not start on this
machine**, which is the fourth session in a row (§29, §31, §33). So
`tools/seed-banners.mjs` and its call in `test-db.mjs` are **exercised by CI
and not by me** — they are the only part of this change that has never
executed. Everything else was verified against a build made from the client's
live database, which is the same carousel state the fixture reproduces: 314
browser tests pass there, including axe and the contrast sweep, which have now
run over a hero carousel for the first time.

If CI goes red on `test:db:start`, the seeder is where to look.

## 36. Where to pick up — state as of 2026-08-29

**This is the current one.** §23 and §28 are the same section for 2026-08-19 and
2026-08-23 and are marked superseded; they are kept because their reasoning is
still the record of those days. Everything below was verified on 2026-08-29 by
running the gate and reading the live site, not inferred from commits.

### What is true right now

| | |
|---|---|
| Branch | `main`, in sync with `origin/main`. Nothing uncommitted. **No hash here on purpose** — one written into a committed file is wrong the moment that file is committed. `git log -1` is the answer. |
| Gates | **`npm run verify` = 18/18.** `-- --full` adds Playwright and needs Docker. |
| Tests | **378 unit.** The e2e total moves with the hero's build-time branch — see §35. |
| Build | 119 pages · 23 server-rendered routes · 8 inline-script CSP hashes |
| Catalogue | 94 products / 15 categories / 2 divisions, in Postgres |
| Supabase | Project `spartan`, ref `wslylysakixrirxkozih` |
| Host | Still `spartan-ebon.vercel.app`. Buying the real domain is the largest launch blocker. |

**Read off production on 2026-08-29, not assumed:**

- home 200, hero rendering **three banners** (four slide nodes — the fourth is
  the duplicated first slide the carousel needs, see §26)
- **zero** Supabase storage references in the HTML; banners served from `/_astro`
- `/_astro/*` returns `public, max-age=31536000, immutable`
- `/_image` returns **404** — sharp is out of the serverless function (§29)
- product pages carry `fetchpriority="high"` on the LCP image
- the WhatsApp control is live on the home page and on product pages (§33)

### What is finished, and where each decision lives

§24 catalogue editing · §25 the specification table · §26 hero banners from
`/admin` · §27 the hero header's crest and oblique headline · §29 the speed pass
· §30 the poster record correction · §31 product context in the enquiry message
· §32 three gates that were green for the wrong reason · §33 WhatsApp and the
first real contact detail · §34 the counts gate · §35 the hero carousel's
**tests · §37 the hero headline set in Fira Sans Italic.**

`docs/TRAPS.md` is the short list of things that pass `astro check` and are
wrong anyway. Read it before touching the hero, the admin, or anything that
resolves an image.

### Setting up a machine

§28 has the long version and it is still correct. The short version:

1. `npm ci`. **Node 22.12 or newer**; the work was done on 24.
2. **Recreate `.env`** — gitignored, does not travel, eight keys:
   `CATALOGUE_SOURCE=postgres`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `ENQUIRY_TO_EMAIL`,
   `ENQUIRY_FROM_EMAIL`, `VERCEL_DEPLOY_HOOK_URL`.
   Both Supabase keys can be re-read from the dashboard rather than copied.
   **The service-role key bypasses RLS entirely** and the deploy hook triggers
   production builds — move both like passwords.
3. **Docker Desktop**, for `npm run dev:test` and `npm run verify -- --full`.
   Public-site work does not need it.
4. `npx playwright install`.

**`npm run dev` is the wrong command for `/admin`.** `.env` holds live
credentials, so a plain dev session edits the client's real catalogue and its
Publish button deploys production. Use `npm run dev:test`, which points at the
throwaway stack and blanks the deploy hook and mail.

### Where a new session should start

1. **Buy the real domain.** One value in `astro.config.mjs` drives every
   canonical, the sitemap and robots.txt; the vercel.app host then needs a
   redirect or it becomes a duplicate of the real site.
2. **Nothing in code stops the two wrong-fact posters returning.** The test
   that named them matched on filename, and uploaded banners have generated
   paths. Grip Guard GP1 advertises cut resistance the glove does not have.
   The suggested replacement is a per-banner "checked against source" flag the
   admin must set before Show will work. **This is the one open item with a
   safety edge.**
3. **Run `npm run verify -- --full` with Docker up — DEFERRED, not forgotten.**
   The browser suite has not run on this machine since Docker crashed
   mid-session on 2026-08-23, and Docker still will not start: four zero-byte
   sockets in `%LOCALAPPDATA%\Docker\run` survive every non-elevated attempt
   to remove them. The remedy needs an Administrator shell
   (`Restart-Service WSLService -Force` then delete them) or a reboot. The
   client set this aside on 2026-08-29 to work on the front end, which is a
   reasonable call: CI runs `--full` on every push and has been green
   throughout, so this is confirmation rather than suspicion. It is still the
   one gate no local run has covered.
4. **`BACKLOG.md` P0** for the remaining launch blockers, including the three
   contact details still unset in `site.json` now that WhatsApp is real.
5. **Sign off the weight scale** (§27) and **make `status: 'draft'` actually
   hide a product** — both are switches that currently exist and do nothing.

### The one flaky test, still named rather than re-rolled

`[mobile] /enquiry › lists the basket and persists quantity edits to the store`
fails roughly twice in six full-suite runs locally under eight workers and
passes in isolation. **Do not treat a single green run as proof it is gone**,
and read its `BACKLOG.md` entry before re-rolling it into a retry.

## 37. The hero headline is set in Fira Sans — 2026-08-29

**Status: implemented and green.** `verify 18/18 · 378 unit · 4 new.`

The client supplied the Fira Sans family on 2026-08-29 for the home page's
headline. It is set there and nowhere else: `--font-display` (Archivo) still
serves every other heading on the site, so this is one element, not a
re-typesetting.

### 245 KB became 13.7 KB, and that was the whole question

The complete family is 14 MB. Its variable italic alone is 245 KB against
Archivo's 34 KB — and it would land on the ONE page §12 identifies as having the
least performance headroom, where a 23 KB font once cost a Lighthouse point.
Shipping it whole was never an option. Measured, full printable ASCII:

|  | size |
|---|---|
| variable italic, whole axis | 245.0 KB |
| characters only | 21.6 KB |
| characters + weight pinned to 800 | **13.7 KB** |

`tools/subset-hero-font.mjs` follows `subset-mono.mjs` exactly: a `COVERAGE`
constant that is the source of truth, a dynamically-imported harfbuzz binding
so the unit suite never depends on it, a committed binary so a normal build
never runs it, and the OFL licence shipped beside the file.

**Full ASCII rather than caps alone**, which would have been 6.5 KB. The
headline is `text-transform: uppercase` today, so caps alone works *today* and
produces tofu the first time somebody removes that one declaration. 7 KB is a
fair price for not booby-trapping a stylesheet.

### The italic is drawn now, and two traps left with the skew

The upright subsets to 12.9 KB — 0.8 KB less — and would still have needed
`transform: skewX(-9deg)`. For 0.8 KB the headline gets real italic letterforms
instead of a mechanical shear, and the transform goes, taking with it both
traps §27 recorded: that a `transform` on an element loses to any animation
that also sets `transform` (which is why a bespoke `hero-rise-lean` keyframe
existed — now deleted), and that `font-style: oblique` reports a slant Chrome
declines to synthesise. `.hero__title` is back on the shared `hero-rise`, and
back in the shared `prefers-reduced-motion` list it had been split out of.

### The wrap point had to be re-measured, and this is why

The cap must sit above line one and below the whole string. Fira is **18%
narrower** than Archivo at the same size, so the numbers §27 measured no longer
described the face:

|  | line 1 | whole |
|---|---|---|
| Archivo, -0.035em | 888px | 1367px |
| Fira Sans, -0.045em | **712px** | **1098px** |

940px still satisfies both, with 228px of headroom above line one instead of
52px, so the cap did not move — but it was checked rather than assumed, and the
table is in the rule.

**One thing did break, and only a screenshot found it.** The rule shipped
briefly with `max-width: PLACEHOLDER_CAP` while the measurement was pending.
CSS discards a declaration it cannot parse and keeps the rest of the rule, so
there was no error anywhere — the headline simply had no cap and ran onto a
single line. Both that and the tofu risk are now in `docs/TRAPS.md`.

### Preloaded on one page, by opt-in

Without a preload the font landed at 1093ms against a first paint of 832ms, so
the headline painted in Archivo and visibly swapped. `BaseLayout`'s two existing
preloads are global, and a third would bill all 119 pages for a font one element
on one page sets — the trap `fonts.css` already describes for the mono. So
`BaseLayout` takes `preloadHeroFont`, `src/pages/index.astro` is the only caller
that passes it, and the built output was checked to confirm no other page
carries the link. With it, the font arrives at **372ms**.

**CLS stayed 0.000** across the swap, measured under 4× CPU throttling on a
simulated 4 Mbps connection.

## 38. The landing page's interface pass — 2026-08-29

**Status: implemented, not committed.** `verify 18/18 · 389 unit · 11 new ·
329 public e2e passing, 0 failing.` Left in the working tree deliberately: the
client asked to see a browser preview before anything reached the live site.

### What this was

A design review of the above-the-fold experience, delivered as 28 numbered
findings with a priority table. Its summary was fair and worth keeping: the
page had **creative direction without enough interface refinement**. The dotted
engineering grid, the oblique red-and-black headline, the rectangular
merchandising band and the moving category rail are a real visual idea; what
was missing was hierarchy, scale and a proposition.

The plan is `docs/superpowers/plans/2026-08-29-landing-page-refinement.md`.

### The three decisions that were the business's, not the code's

They were taken so work could proceed, each is one line to reverse, and all
three are in `BACKLOG.md`.

1. **The H1 wording was NOT changed.** `Home and industrial solutions.` is the
   client's approved line and `tests/e2e/home.spec.ts` pins it. The review's
   actual complaint — a visitor could not tell what Spartan sells — is a real
   defect, and it is fixed by the eyebrow and the supporting sentence. That is
   a different change from overwriting someone's brand voice.
2. **`Browse catalogue` keeps its wording and its red.** The review suggested
   `Browse products`. The route is `/catalogue`, the nav panel says "View the
   full catalogue" and the breadcrumbs say Catalogue; changing one label of
   four buys clarity in the hero at the cost of consistency everywhere else.
3. **The placeholder phone number left the header.** See below.

### What was refused, and the number that refuses it

The review proposed a trust band reading **1,000+ PRODUCTS**, **BUILT FOR GCC
CONDITIONS** and **QUALITY ASSURED**. The catalogue holds **94** products, and
there is no source on this machine for a region claim or a certification claim.
That is rule 1, and here it is a safety rule rather than a style one.

What shipped instead counts: the hero reads the catalogue through
`src/lib/catalog.ts` and renders "94 products in 15 categories". A counted
number cannot drift into a fabricated one, and `Hero.test.ts` mocks the
catalogue with 7 and 3 precisely so that a hard-coded literal would fail.

The review also proposed relabelling `Categories` to `Products` with a mega-menu
listing Power Tools, Material Handling and Pumps. Spartan sells none of those.
The dropdown already renders both divisions and all fifteen real categories
through the seam; only the label is in question, and the client chose it on
2026-08-17.

### The changes

**The utility bar is gone.** 44px at the top of every page carrying "Follow
Spartan" and three social marks that were not links — the profiles are not
published. `.site-header--transparent` moved from `top: 44px` to `top: 0`, and
`--hero-chrome` from 130 to 86. **Those numbers plus two hero paddings are one
arithmetic chain and nothing connects them but a comment**, which is now also a
`docs/TRAPS.md` entry.

**The interface scaled up and the headline scaled down.** Logo 38 to 48px, nav
links 11 to 13px, phone 13 to 14px, hero CTAs 13.5 to 15px at 18px of padding;
the H1 ceiling 76 to 68px. The complaint was never that the headline was too
big in isolation — it was too big relative to a 38px logo and an 11px nav.
Five hand-tuned hero margins became four `--hero-gap-*` names on a 4px grid.

**The header no longer publishes a dead `tel:` link.** `site.phone` is still
`+971 00 000 0000`; until now every page carried a phone link that dials
nothing. `isPlaceholderNumber` in `src/lib/site-content.ts` decides, and the
header renders `Contact sales` while the number is a placeholder — reverting to
a real `tel:` link with no code change the day one is supplied.

**The threshold is four consecutive zeros, not three, and that is the whole
test.** The client's real WhatsApp number is `+973 3800 0458`, whose digits
contain `000`. At three, a working number would have been classified a
placeholder and hidden. `src/lib/site-content.phone.test.ts` pins both
directions.

**Search reached the header.** A plain GET form to `/catalogue`, no island and
no inline script — an inline script here would work locally and be silently
blocked in production, because `npm run csp` derives its hashes from
`dist/client`. `CatalogueFilters.tsx` seeds its box from `?q=`.

**That `?q=` is a deliberate exception to a documented rule.** The component
says filter state is not in the URL, because `/catalogue` is prerendered and a
shared `?category=` link would paint all 94 products and then visibly cut down.
That reasoning still holds for division and category — both have canonical
pages. A search term has none, and the alternative was a header box that throws
away what the buyer typed. The flash is real, and it is paid only by someone
who arrived with a term already typed.

**The carousel controls became one rail.** `01 / 03`, the pips as a continuous
track, the pause at the end. The pip geometry changed and **the clock did not** —
the animation and its 42s duration were carried across verbatim.

**The category band became navigation.** Fifteen names, fifteen real links, and
hover or focus stops the track so they are not a moving target. The duplicates
that make the loop seamless carry `tabindex="-1"` inside `aria-hidden`
containers: 15 reachable and 45 unreachable, measured in the browser. A
focusable element inside `aria-hidden` is a violation in its own right, which is
why the split exists at all.

**Red was spent more carefully.** The two decorative edge ticks went from
`--accent` to `--line-control`. The crest, the headline's red span and both CTAs
kept theirs — brand and action. When everything on a screen is red, the button
is not.

### Two things the browser caught that review did not

**The control rail was 940px against a 1176px frame.** 940 is the measure the
crest and the closing rule use — the copy column, not the band — so the rail sat
visibly inset from the artwork it controls. Found by measuring the rendered
page. It now inherits the stage's width, so the two edges cannot drift apart,
and `tests/e2e/home.spec.ts` measures both boxes.

**A hover-pause on the hero carousel turned its toggle into a one-way door.**
The design database's rule for auto-rotating media is to stop on hover, focus
and reduced motion, and it was added on that basis. `.hero__controls` sits
INSIDE `.hero__stage`, so the pointer that clicks Pause is hovering the stage —
and pressing the control a second time left the band stopped.
`tests/e2e/hero-carousel.spec.ts` has an explicit "toggle and not a one-way
door" test, and it failed. **The rule was removed and the reason is written into
the file so it is not re-added.** Generic advice lost to a specific tested
contract. `Ticker.astro` keeps its hover-pause, because there the links
genuinely move under the cursor and its control is hover-revealed by design.

### The fold arithmetic was estimated pessimistically, then measured

The supporting sentence and the taller CTAs cost roughly 63px on a 360x640
screen, against 42px handed back by the utility bar. The estimate said this
would be marginal. Measured: the primary CTA's bottom edge lands at **584px
against a 640px fold**, with 56px of clearance where the block was written with
20. The sentence is NOT dropped on a phone — it is the change that answers
"what does this company sell", and a phone is where that gets asked most. It is
set tighter, and the CTAs hand back the padding they gained.

### What did not change, and why

- **Ticker speed.** The review asked for 25–40s per traversal. It already runs
  84s over a doubled track, which is inside that band, and
  `prefers-reduced-motion` already stops it dead.
- **The sections below the fold.** The review asked for a trust band and
  category tiles after the hero. `src/pages/index.astro` already renders
  Ticker, then CategoryGrid, then FeaturedLines, before any editorial section.
- **No card was introduced anywhere.** The review was explicit that rounded
  SaaS cards, gradients and glassmorphism would make this worse. The banner
  frame went from a 4px radius to 2px rather than the other way.

### Playwright ran, and that is worth recording

§36 deferred `--full` because Docker would not start. **The public suites do not
need it** — only the authenticated admin tests do. 329 public e2e tests pass
across desktop and mobile, including 11 new ones. The admin suites are still
unrun locally, and that is unchanged from §36.

One new test was written flaky and fixed rather than shipped: clicking a link in
the moving band passed alone and failed under ten workers. Hovering pauses a
track that is mid-animation and the click can still land after it has travelled;
the fix is an assertion between the hover and the click, so the stop is
synchronised rather than hoped for. `.check()` on the pause switch is not the
alternative it looks like — the input carries `pointer-events: none`, so even a
forced click leaves it unchanged.

### Where a new session should start

Everything in §36's list still stands. Ahead of it: **look at the preview and
decide the three business questions above**, then commit. Nothing here has been
committed, so `git status` is the honest picture of what this section describes.

## 39. The hero stops being symmetrical — 2026-08-29

**Status: implemented, not committed.** `verify 18/18 · 392 unit · 332 public
e2e passing.` Still in the working tree: the client is reviewing the preview
before anything reaches the live site.

### What the second review said, and why it was right

§38's pass fixed the practical problems and made the page **more
conventional**. The review's own summary: "the hero typography is carrying
almost all the responsibility for making the page memorable, yet its
composition is extremely ordinary." Eyebrow, headline, rule, sentence, banner —
five centred strips down the middle of a page whose brand is angular and
industrial. It scored the result 7.5 functionally and 6.5 creatively, and the
diagnosis was better than the score: **the page was trying to create interest
with small decorative details around a boring composition.**

The instruction taken from it was to flip that — an interesting composition
with *fewer* decorative details — and specifically not to answer it by adding
more dots, lines, badges and arrows.

### Three moves, and nothing else

**1. The centre axis is gone.** `.hero` is `text-align: left` and the wrap is
`align-items: stretch`. Masthead, headline and lede share one left edge;
`tests/e2e/home.spec.ts` measures all three and fails if any of them drifts
back to the middle.

**2. The headline is a composition, not an H1 with a font size.** Two spans on
one source line rather than a measured wrap point. Line one runs from the left
margin at up to 72px; line two is pushed right by up to 118px and set at 1.18x,
so it lands near 85px. Leading closed to 0.84. Equal lines stack; unequal lines
that lean read as one shape, and that is the whole argument.

**The measured `max-width: 940px` wrap point is gone with it**, along with the
table of per-face line widths that set it. The break is structural now and
cannot drift when the face or the tracking changes — which is a better version
of what the cap was protecting.

**3. The counted totals became the counterweight.** The review's best single
idea: "94 products in 15 categories is actually useful design material. Use
it." The numbers left the sentence and became a `<dl>` on the right of the
composition — mono labels, display numerals, zero-padded to two digits, one
vertical red rule down its left edge. The lede keeps the language and now
carries no digits at all; a unit test asserts that, because the same fact in
two places is how one of them goes stale.

### The one grid violation, and why there is only one

An outlined `94` at up to 340px sits behind the headline. It is the same number
the index states — decoration made of data rather than of shapes — and it is
the only element allowed to break the plane.

`color: transparent` with `-webkit-text-stroke` is a safety property, not a
trick: a browser without the stroke property paints **nothing**, which is the
correct failure. A filled fallback would put a black slab across the headline.
It is anchored right and above, deliberately never behind "SOLUTIONS." — the
red word has the least contrast headroom on the page and stacking texture
behind it is exactly how a measured ratio quietly stops being true.

### Four horizontal rules became one vertical one

The review counted them: crest arms either side of the badge, the notched rule
under the headline, the rule trailing off the FEATURED label, and a progress
rail spanning the full width of the band. In a hero about 600px tall they were
competing rather than structuring.

Removed: the crest, the hexagonal badge, the closing underline, the label's
trailing rule. Added: one vertical red rule on the index. The campaign label
and the carousel controls merged into a single row above the band, which
removed a whole horizontal strip on its own, and the controls compressed from
1160px to a 340px cap — a progress indicator has no reason to mirror the width
of the thing it indexes.

**The controls moved ABOVE the band, and the constraint that put them below is
still satisfied.** That constraint was never "below"; it was "never over the
artwork", because the banners carry near-white footer strips where a white pip
is invisible and a scrim dark enough to fix it covers the client's QR code.
Above sits on the page's own surface.

### The badge went and the founding year came back, which is not a reversal

§38 removed "Est. 2015" because a hexagonal badge was spending the most
valuable line on the page on a fact that is not a proposition. It is now one
segment of `SPARTAN® / ELECTRICALS + SAFETY / EST. 2015`, a mono masthead where
it costs nothing. The objection was to the prominence, never to the fact.

The review also found the divisions confusing as a hero label. Inside a
masthead they read as provenance rather than as a title for the page, which is
what they always were.

### The header

Search stopped being a bordered box and became a **rule**: one line under the
field, icon at the right where a submit affordance belongs, uppercase technical
placeholder. A four-sided border was four more lines on a page that had too
many, and the review called the original "very generic ecommerce".

`Contact sales` became a sharp-cornered red **outline** with an ↗. A filled red
button was the obvious answer and the wrong one — the hero's primary CTA is a
red fill, and a second one in the header spends that meaning twice.

Search and Contact are one group now, hard right behind a hairline, so the row
reads as logo / navigation / tools rather than four objects drifting along a
line.

### The band gives back 6%

`max-width: 1160px`, left-aligned to the same axis as the headline. The review
was right that the hero had become "headline → explanation → giant advert", and
right about why it matters: **the artwork is uploaded by an admin and changes
every campaign, so whatever is loaded that week was setting the visual
temperature of the whole page.** The site has to stay louder than its own
advertising. The frame is 4:1 and fixed, so width is height here.

`max-width` is not binding below 1160px, so nothing about the phone changes.

### What was refused this time

- **`GCC SUPPLY` as a third index row.** No source on this machine. Rule 1.
- **`01 /` prefixes on the campaign label.** The review suggested
  `01 / FEATURED`; there is no section 02, so the 01 would have been a number
  that means nothing. Tiny technical type works because it looks like it
  carries real structure — inventing the structure is how it becomes
  decoration, which is the thing this pass exists to remove.
- **`Categories` → `Products`.** Two reviews now. The client chose the label on
  2026-08-17 and it is still their call; it stays in `BACKLOG.md`.
- **Changing the H1 wording.** Unchanged and unasked-for: the review itself
  said "don't necessarily change the words yet, change how they're treated."

### Three things measurement caught that reasoning did not

**The mobile fold broke by 77px.** The index fell back to a stacked column
below 560px, which looked fine and cost 170px on a 360x640 screen — enough to
push the primary CTA well under the crease. It stays a three-column row all the
way down and the type steps down instead; 45px instead of 170, and the CTA
lands at 607 with 33px of clearance. The estimate had said "tight". It was not
tight, it was broken.

**The nav row overflowed at exactly 1081px**, one pixel above the width where
the menu collapses. The tools group added 41px past the wrap, and nothing about
it looked wrong at 1440. `tests/e2e/navigation.spec.ts` measures that width on
purpose. A squeeze band between 1080 and 1240 pays it back out of spacing —
never out of the 44px target or the Contact outline.

**A stray `®` gap.** Loose text nodes inside a flex container become anonymous
flex items, so "Spartan" and the registered mark were two items with the row's
10px gap between them. Every masthead segment is its own span now.

### The gate caught a white that would have been legal

`Contact sales` originally filled red with white text on hover — 4.91:1 and
correct. `theme-sweep.test.ts` refused it, because keeping it meant adding
`Header.astro` to the red-surface allowlist, and that would exempt the one file
rendering on all 119 pages from a check that exists because a white-on-white
product name once shipped to every category page. **The design gave way, not
the gate.** The hover is a 10% tint now — the idiom `PillButton` already uses.

### On the browser suite

332 public e2e pass. Two full runs each showed one failure and both were
environment rather than regression: a clipboard permission flake under ten
workers, and a **429 from the enquiry API's rate limiter**, which had
accumulated hits from the many suite runs of this session against a
long-running preview server. Restarting the server and re-running gave 44/44 on
`csp.spec.ts` and `enquiry.spec.ts`. Worth knowing before anyone else chases it:
**repeatedly running the enquiry tests against one preview process will
eventually 429, and that is the limiter working.**

The admin suites are still unrun locally — Docker, unchanged from §36.

## 40. The refinement pass, and a numbering system — 2026-08-29

**Status: implemented, not committed.** `verify 18/18 · 389 unit · 333 public
e2e passing, 0 failing.` Still in the working tree for the client's review.

### What the third review said

It scored §39's hero 8/10 and opened with the instruction that matters most:
**"I would not do another major redesign from here."** The risk had flipped —
the danger was no longer blandness but overreaction, and the remaining gains
were in composition rather than ornament. Everything below is a refinement to
something already there. Nothing new was invented except one component, and
that one exists to make an element already on the page mean something.

### The headline closes up

`line-height` 0.84 → 0.74, which is 7.2px out of the gap at the 72px ceiling.
The two lines were still reading as "two formatted lines of an H1" rather than
one shape. The red line is tucked under the black one now.

The size step went 1.18 → 1.22. **The review asked for the second line to be
"5–8% larger", believing the two were the same size — it was already 18%
larger, and that is worth recording so the next person does not chase the same
ghost.** What was actually missing was the leading: at 0.84 the gap between the
lines was reading as the separation, not the size.

### The oversized numeral stopped being two things at once

It was `94`, sitting inches from a stated `94`. The review was right that the
same figure was being read twice inside one cluster, and right that the device
had to pick a role: decoration or data.

**It is decoration, and the tie-breaker is not taste.** The numeral is drawn
with `-webkit-text-stroke` over a transparent fill, so it renders as *nothing*
in a browser without that property — the correct failure for an ornament and a
disqualifying one for information. A fact whose only carrier can vanish has not
been stated. So the numeral is a section index, `aria-hidden`, and every
counted total lives in the index below as real text.

### And the numbering became a system rather than a loose number

`01` alone is as arbitrary as `94` was. The review's strongest strategic idea
was a repeatable numbering language — 01 the hero, 02 the shelf, each set huge,
outlined and cropped differently — so `src/components/primitives/SectionIndex.astro`
is that device, and it is used twice: the hero is 01 and `CategoryGrid` is 02.
Two instances is what makes it a series rather than a promise.

**Placement is passed by inherited custom properties, never by an inline
`style` attribute.** `style-src` is hash-based here and hashes do not cover
inline style *attributes* — one would have worked locally and been dropped in
production with nothing failing. The caller sets `--si-top`, `--si-right` and
`--si-size`; they inherit. The caller must also be `position: relative` and
clip its own overflow, or an oversized absolute child gives the page horizontal
scroll on a narrow screen.

### The third statistic earns its place

`DIVISIONS / 02` was called weak, and worse, said to make the range sound
unintentionally small. Agreed on both counts — and the divisions are named in
the masthead directly above, where they read as scope rather than as a total.

The suggested replacements were dealers, markets and territories. **Not one is
sourceable on this machine, so all three were refused.** The founding year is
on file, is already published on the About page, and is the one credibility
figure here that is not an invention. It moved out of the masthead in the same
edit, so it is stated exactly once — a unit test counts the occurrences.

That year has now had three addresses: a hexagonal badge on the hero's best
line, a masthead segment, and a statistic. Each move was the same judgement
with better information — the fact is worth stating, the prominence was not.

### Smaller things

- **Microcopy up a pixel, not a shade.** The masthead was one you had to search
  for. The review offered size *or* contrast, not both; size is the one to take,
  because `--text-muted` is 4.96:1 against a 4.5:1 floor and there is no darker
  muted token — "raise the contrast" would have meant inventing a colour and
  measuring it.
- **The lede tightened** to `Lighting, ventilation, water management, PPE and
  workwear for contractors and distributors.` at a 470px measure, in px rather
  than `ch` — this rule's size is a clamp, so a `ch` cap silently changes
  measure at every viewport, which is the opposite of the fixed footprint asked
  for.
- **CTAs 8px closer to the band**, taken by moving down one step of the existing
  scale rather than inventing a number beside it.
- **The control rail compressed** about 12% again, to a 300px cap.

### The progress rail had been broken since §39, quietly

The review said the progress state read as too subtle. It did, and the reason
was a real defect: `@keyframes hero-pip` animated `width` between 26px and
18px, and **a flex item with `flex-basis: 0` ignores `width` entirely.** When
the pips became flex segments in §39 the geometry changed and the keyframe did
not, so for one revision the only thing marking the active slide was its
colour. It animates `flex-grow` now — the current segment is visibly wider and
red, which is what a progress rail is supposed to look like.

### A trigger that was measuring the wrong thing

The headline's offset and size step were collapsed inside the
`(max-width: 1180px) and (max-height: 700px)` fold block, because that is where
they were first needed. That block also fires on a **1000×700 laptop window**,
where it flattened the composition into two equal flush-left lines — the exact
thing the previous review had asked us to get away from, on a screen with
plenty of width to spare. The reason to flatten is that the measure cannot pay
for an offset, and that is a question about width alone. It is a
`max-width: 640px` rule now.

### What was refused

- **`01 / FEATURED CAMPAIGN`** on the campaign label. It would have been the
  third `01` above the fold — the section index, the slide counter beside that
  very label, and then this. That is the same redundancy the review had just
  asked us to remove from the giant numeral, arriving from another direction.
  The slide counter is the number this module needs and it already has it.
- **A double period after "distributors".** Reported from a screenshot; there
  is one period in the source and one in the built HTML. Nothing to fix.
- **`Categories` → `Products`.** Asked three times now, across three reviews.
  The client chose the label on 2026-08-17 and it remains theirs; it is in
  `BACKLOG.md` and it is one string.
- **`Browse catalogue` → `Browse products`.** The review's own condition was
  "keep Catalogue if it's genuinely a catalogue-browser experience". It is —
  `/catalogue` is a filterable index of all 94 products.

### The fold got healthier, not tighter

The tightened leading and the shorter lede handed space back. On a 360×640 the
primary CTA's bottom edge is at **559px with 81px of clearance**, against 607
and 33 before this pass, and against a block originally written with 20.

### On the 429 that keeps appearing

Worth knowing before someone chases it: **Playwright reuses a server already
listening on 4321**, so a long-running preview from the browser pane becomes
the test server — carrying its accumulated in-memory rate-limit state into the
enquiry tests. Stop the preview before a full run, or expect a 429 on
`csp.spec.ts` that is the limiter working correctly.

## 41. One head, one rhythm, one numbering — 2026-08-29

**Status: implemented, not committed.** `verify 18/18 · 392 unit · 333 public
e2e passing, 0 failing.` Plan:
`docs/superpowers/plans/2026-08-29-homepage-design-system.md`.

### The diagnosis was visible in the imports

The fourth review said the page reads as "3–4 different design languages
stitched together" and that the hero "belongs to a more ambitious website than
the rest of the page". Both were literally true, and the evidence was not a
matter of taste — it was in how each section built its head:

| Section | Head |
|---|---|
| `ServiceCards`, `Faq` | the `SectionHeading` primitive |
| `About`, `Spotlight`, `EnquiryCta` | `Eyebrow` + a bespoke `<h2>` |
| `CategoryGrid` | hand-rolled `.cg__eyebrow` + `.cg__title` |
| `FeaturedLines` | hand-rolled `.fl__title`, **no eyebrow at all** |
| `TrustBand` | `.band__lead` on a full-bleed red band |

Four idioms for eight sections. Every downstream symptom — inconsistent
spacing, sections that feel templated, decoration that reads as arbitrary —
followed from there being no shared head to hang a rhythm on. **All eight
render one component now.**

### The system, stated so it can be checked

1. Every section on the home page has the same head: micro-label, heading,
   optional lede, optional trailing action, section numeral.
2. **The numbering is complete or it does not exist.** Every headed section is
   numbered in DOM order, 01 to 09. The category ticker is a band with no
   heading and takes no number. There is no third case.
3. **The numeral is 3.5x its own section's heading ceiling** — not a fixed
   size. That is what lets the hero's stay dramatic against a 72px headline and
   a content section's stay proportionate against a 46px one, with one rule
   rather than two exceptions.
4. Always top-right of the head block, outlined, 11% of `--text`, always
   `aria-hidden`. It never carries a fact — see below.
5. An emphasised word in a section heading is red. One rule on the primitive.
6. 40px between a head and the content under it. One value, everywhere.
7. Red marks action and brand, not surfaces. One red band remains: the ticker,
   which is navigation.

`tests/e2e/home.spec.ts` asserts 2 and 4 directly. **Without that invariant
this pass produces the same half-committed system it replaced, one section at a
time, the next time someone adds a section.**

### Why the numeral can never become the statistic

Asked and settled twice now, and worth stating once properly. `SectionIndex`
draws with `-webkit-text-stroke` over a transparent fill, so it renders as
*nothing* where that property is unsupported. That is the correct failure for
an ornament and a disqualifying one for information: a fact whose only carrier
can vanish has not been stated. It is decoration; the counted totals live in
the hero's index as real text.

### The crop marks are gone, and so is their spec

Four registration marks and two red edge ticks. The review's verdict was
delete, and the reasoning held: they repeated nowhere else, carried no
hierarchy, and sat far enough out to read as detached.

**`tests/e2e/hero-marks.spec.ts` was deleted with them, and that deserves
saying out loud.** The client raised a real defect against their own mockup —
the bottom marks landing on the CTAs — and that spec was written so deleting
the marks could not read as a passing fix. Deleting it alongside the decoration
is not that dodge: a collision between a mark and a button cannot recur once no
mark exists. If any of it comes back, the spec comes back with it.

### The measure widened, site-wide

`--wrap-max` 1240 → 1360. The review found the content floating in a large
empty field with the outer canvas doing nothing, and offered two ways out:
widen, or make the margins carry something. Widening is the honest one — the
margins had no work to do, and inventing some is the "decoration about
decoration" the same review asked us to stop.

**It is widened site-wide, never just in the hero.** A hero on a wider measure
than the sections under it is a fifth design language.

### The industries band joined the system

It was a full-bleed red strip with white text, and the review said it "feels
like it belongs to a different design system". The accurate version of that:
red was doing four jobs on one page — headline accent, primary CTA, category
ticker, and this surface — and a colour doing four jobs marks none of them. It
is an ordinary light section now with the shared head and `06`. The industries
and the comment recording that they are inferred from the product mix and
pending client confirmation both survived the edit.

### Three defects the browser caught that review would not have

**The catalogue heading silently lost its red word.** `CategoryGrid` set
"15 categories, **one shelf**" through `.cg__title span`; converting to the
shared head dropped the colour and the section's best typographic moment went
missing. It is a rule on the primitive now — an emphasised word in any section
heading is red — so it cannot be lost again by moving a heading.

**The numbering anchored consistently to inconsistent boxes.** `FeaturedLines`
kept its filter tabs in a `.fl__head` flex row beside the head, which
shrink-wrapped the head to its own text — so `03` landed near the middle of the
page while every other numeral sat at the measure's right edge. The rule was
being followed; the box it was following was wrong. The tabs ride in the head's
action slot now, the same move `CategoryGrid`'s "All products" link makes.

**A ratio binds where a fixed width did not.** The hero band's `max-width:
1160px` became `93.5%` so the ~6% it gives back would survive the wider
measure. But 93.5% of a 320px phone column is 299px, so the band stopped
spanning the column on a phone — `tests/e2e/hero-mobile.spec.ts` measures
exactly that and failed. The ratio now applies only above 900px, where there is
surplus width to give back and something to protect the page from.

### Measured before and after

The gap between each section head and the content under it, down the page:

```
before   0 · 0 · 0 · 52 · 32 · 0 · 52 · 0
after   40 · 40 · 40 · 40 · 40 · 40 · 40 · 40
```

Two of those zeros were regressions from this very conversion — `CategoryGrid`
and `FeaturedLines` had carried the gap on head wrappers that went away with
them. Measuring is what found them.

### What was deliberately NOT done

The review's P2 and P3 lists ask for per-section art direction: the About
helmets composed rather than floating, Featured Lines given a less repetitive
rhythm, cards standardised, the FAQ and enquiry form refined.

**Not in this pass, and the reason is the review's own closing instruction** —
"stop inventing new visual tricks and instead focus on system-building". Every
one of those is easier and safer against a shared head, a shared numeral and a
shared rhythm. Doing both at once means changing the frame and the picture in
one edit with no way to tell which caused a regression. They are in
`BACKLOG.md` with this reasoning attached.

`Categories` → `Products` has now been raised in four consecutive reviews. It
is still one string and still the client's call.

## 42. Reading the rendered page found six defects — 2026-08-29

**Status: implemented, not committed.** `verify 18/18 · 392 unit · 339 public
e2e passing.`

### What this was

The client exported the whole home page to PDF and asked whether the mistakes
were visible now. They were — six of them, and **not one was findable by
reading a component on its own.** Every gate was green through all of it.

That is the lesson worth keeping from this section: this repo has strong
per-file discipline and no habit of looking at the finished page end to end.
Four of the six below are the same shape of mistake — a rule being followed
exactly while measuring the wrong thing.

### 1. The numeral anchored to the wrong box

`SectionIndex` sat inside `.sec`, which is only as wide as the column it
occupies. In the three two-column sections — About, Spotlight, Trade Enquiries
— that put the section marker in the **middle of the page** while every
single-column section's sat at the measure's right edge. The rule "top-right of
the head block" was being honoured perfectly.

`.sec` is no longer positioned; the numeral's containing block is the
`<section>`, and its right offset is computed in to where the 1360px measure
ends — `max(gutter, (100% - wrap-max) / 2 + gutter)`. **Measured after: all
nine numerals end on the same vertical line at every width.**

### 2. Content sections carried a bigger numeral than the hero

The size rule was "3.5x the section's heading **ceiling**" — `calc(46px * 3.5)`
— so it never moved while the heading shrank with the viewport. At ~830px wide
section headings were drawing at 33px under a 161px numeral, and the hero's was
126px. The page's own hero had the smallest section marker on it.

Multiplying the whole clamp makes the rule real: `calc(clamp(30px, 4vw, 46px) *
3.5)`. The hero uses the identical expression with its own clamp, so it is the
largest by construction rather than by a chosen number.

### 3. Three numerals straddled a section boundary

`line-height: 0.7` means the ink overflows the element's own box, so a
`-0.42em` top offset put 03, 05 and 07 across the join with the boundary line
visible straight through them. The offset is `+32px` now and every numeral
stays inside its own section. **A test asserts that**, with tolerance for the
ink overflow rather than for the box.

### 4. "1 items"

Insect Killers and Cables both stock exactly one product, and the home page
said `1 ITEMS` for each. A template string with no singular case — the kind of
defect that is invisible in code review and unmissable in a rendered page.

### 5. The page stated the same three facts twice, in two vocabularies

The hero's index says `PRODUCTS 94 / CATEGORIES 15 / ESTABLISHED 2015`. Four
sections later, About's strip said `2015 ESTABLISHED / 94 PRODUCT LINES / 2
DIVISIONS` — same facts, different order, different labels, and a bare `2`
against the hero's padded `02`. Side by side in a PDF it reads as two different
datasets.

**About's strip is removed.** The hero's index is the systemised statement and
it wins; About keeps the story and the route through to `/about`, where all
three numbers still are. Nothing was invented and no fact left the site — a
duplication was removed, not a number. Reversible, and in `BACKLOG.md` as such.

### 6. Two of nine section heads were uppercase and centred

`ServiceCards` and `Faq` still carried scoped overrides — `text-transform:
uppercase` plus the `center` prop — from before the head system existed. So the
page had seven sentence-case left-aligned heads and two uppercase centred ones,
which is the "composition is inconsistent section-to-section" complaint with a
cause. Both overrides are gone. Nine heads, one case, one axis.

### What is now asserted rather than hoped for

`tests/e2e/home.spec.ts` gained three geometry invariants: every numeral ends
on the same vertical line, the hero's is the largest, and none crosses out of
its own section. They are the cheap version of looking at the whole page, and
they exist because looking at the whole page is what found all three.

### What is still open, and deliberately

The per-section art direction from §41's backlog entry is untouched: the About
helmets, Featured Lines' rhythm, the card standardisation, the FAQ and the
enquiry form. Reading the PDF confirmed rather than changed that list — the
catalogue grid is three columns and Featured Lines two directly under it, with
different card heights and different image scales, which is the card primitive
that entry describes.

`Categories` → `Products` remains the client's call, now raised in four
reviews.

## 43. The numerals go in-flow, and the page gets one rhythm — 2026-08-29

**Status: implemented, not committed.** `verify 18/18 · 392 unit · 339 public
e2e passing, 0 failing.`

### The client was right, and §42's fix was a patch on the wrong idea

A second PDF export showed the numerals still failing: `06` clipped by its own
section's `overflow: hidden`, `07` drawn straight through the Spotlight
heading, all of them floating pale in corners nothing else used. §42 had made
them *consistently positioned* — but consistently positioned **in space**,
which is decoration nailed to a wall. Every failure was a placement bug, and
placement bugs are what absolute positioning invites: each section became
responsible for clearance it could not see it owed.

### The fix is structural: the numeral is typeset WITH the head

`SectionIndex` gained a `flow` variant and `SectionHeading` places it as a grid
cell — eyebrow and heading on the left, the numeral as the head's right-hand
counterweight, any action (the catalogue's link, the featured tabs) tucked
beneath it. The layout engine reserves its space, so **clipping, collision and
drift are impossible by construction rather than guarded against by
vigilance.** The review's own rule was "always associated with the section
heading"; an absolute element is associated with nothing.

Scale dropped from 3.5x to 2.4x of the section heading's clamp — at
counterweight size it is typography; at billboard size, in flow, it would
out-shout the heading it belongs to. The hero keeps its absolute 3.5x numeral:
that one sits *behind* a composition in a file that owns both layers, and it
stays the page's largest by construction. Stroke went 11% → 15% everywhere —
at 11% it read as a printing artifact in the PDF. Secondary must not mean
barely there.

**The three §42 geometry invariants passed unchanged against the new
implementation** — same right edge, hero largest, none escaping its section.
That is what made this a safe rebuild rather than a rewrite: the contract was
already pinned, only the mechanism changed.

### One repeatable section architecture, finally

About, Spotlight and EnquiryCta had their heads INSIDE a column of their
two-column grids — the root cause of every numeral placement problem in those
sections. All three heads hoisted to a full-width row above their columns.
Every section on the page is now: head row (label / heading / numeral /
action), then content. Their grids also went `align-items: center` → `start`:
with the head gone from the column, centring opened a hole directly under the
heading.

### The scroll rhythm, measured then fixed

Before, at 842px wide:

```
padding   80 · 76 · 76 · 76 · 80 · 76 · 76 · 96   (three values, one job)
surfaces  alt RED alt white alt white alt ALT white ALT   (two invisible seams)
```

- **One token**: `--section-pad: clamp(64px, 6.5vw, 92px)` in tokens.css,
  every section. A section wanting different air is asking to leave the
  system, and that is a human decision.
- **Strict alternation**: Spotlight → white, FAQ → alt, EnquiryCta → white.
  The band/spotlight seam was grey-on-grey — a 1,300px slab with an invisible
  join — and spotlight/faq would have been white-on-white. Every section
  boundary is now visible while scrolling, which is most of what "inconsistent
  sizing" feels like from the scrollbar.

### A bug the measurement caught mid-pass

The first cut of the flow variant carried `align-self: start` — written for a
grid cell, rendered in a flex column, where align-self controls the cross axis
and `start` means LEFT. The two sections whose side column is widened by an
action rendered their numeral 41px and 235px off the shared line; every other
section masked the bug because its column was exactly numeral-wide. Caught by
measuring all nine right edges before screenshotting, fixed by deleting the
property. The comment in `SectionIndex.astro` records it so it does not come
back.

### Cleaned up rather than left behind

The `--si-top`/`--si-right` `max()` computation in `SectionHeading`, the
`position: relative` + stale comments §42 spread across four section roots,
and CategoryGrid's `overflow: hidden` (which §41 added for the absolute
numeral and which §42's PDF showed clipping `06` on TrustBand's twin) — all
removed with the mechanism that needed them.

## 44. The hero lands on two edges — 2026-08-29

**Status: implemented, not committed.** `verify 18/18 · 392 unit · 339 public
e2e passing, 0 failing.`

### The critique that drove it

The client sent a desktop screenshot and asked whether the layout was genuinely
optimal. It was not, and the failures were all the same species: **elements
aligned to numbers instead of to each other.**

- The banner stopped at 93.5% of the wrap, so its right edge met *nothing* —
  an orphan sliver of dot grid between the artwork and the margin.
- `SOLUTIONS.` was pushed right by `clamp(0px, 7vw, 118px)` — a distance that
  aligned with nothing and needed a hand-written collapse below 640px.
- The ghost `01` floated absolutely in the top-right and read as a smudge
  behind the stats rail, whose own bottom edge hung against nothing.
- The CTA row's right half was empty while the top-right was crowded.

### The principle, then the moves

**The hero now has exactly two vertical edges — the wrap's left and right —
and every element lands on one of them.** Masthead, headline, lede and CTAs on
the left; numeral, carousel controls, the banner's right edge and the spec
strip on the right. An edge shared with another element is a composition; a
distance is a guess.

1. **The staircase became flush-right and self-maintaining.** The h1 is
   `width: fit-content` and line two is `text-align: right`, so the red word's
   last letter lands exactly under the black line's last letter at every
   viewport and font size — measured: both line-ends at x=811. The margin
   clamp and its mobile collapse are deleted; the mechanism cannot drift.
2. **The numeral joined the flow.** Same `flow` treatment as every section
   head, in the composition's right grid cell, scaled by the same
   heading-multiple rule. It cannot smudge, clip or collide — and the hero
   finally became the system's first instance instead of its exception.
3. **The banner runs wrap edge to wrap edge.** The 93.5% cap is gone with its
   orphan sliver. Dominance is governed by what it always really was: the
   fixed 4:1 ratio and the frame.
4. **The spec strip closes the hero on the CTA row** — actions left, counted
   proof right, one full-measure line. It sat under the lede for one revision
   and cost the fold ~78px while the CTA row's right half sat empty; pairing
   them fixed both, and the visitor is asked to act at the exact moment the
   numbers argue they should.

### Measured, at 1280×850

CTA bottom went 901 → **793** (from below the fold to comfortably inside it).
Line-ends agree to the pixel; masthead, strip, stage and controls all span
137→1433; the numeral's right edge sits on the same line. On a 360×640 phone
the CTA clearance is **138px** — the best any revision has measured.

### Two mobile clips the phone screenshot caught

Both were swallowed by the hero's own `overflow: hidden`, so neither raised a
scrollbar: the campaign bar's PAUSE button rendered half off a 360px edge
(the label + rail total ~380px at their floors — the bar wraps now), and the
right-anchored spec strip pushed "ESTABLISHED / 2015" past the edge once the
row wrapped (it anchors left below 560px). **`overflow: hidden` turns overflow
bugs into silent crops; only looking at a rendered phone finds them.**

### Tests

The staircase test was rewritten honestly: both headline spans are full-width
blocks now, so box positions would pass vacuously — it measures the rendered
ink via a `Range` and asserts the two line-ends agree within 4px of italic
overhang. The vacuous narrow-screen margin test became an ink-containment
assertion. All three numbering-geometry invariants passed unchanged.

---

## 45. The hero's empty half, and the rail that filled it — 2026-08-30

**Status: implemented.** `verify 18/18 · 392 unit · 341 public e2e, 0 failing.`

### The instruction, because it reverses two recorded decisions

The client sent a desktop screenshot of the hero and asked for its symmetry and
empty space to be fixed. Told that §39 and §44 had settled the composition
deliberately, they answered: **"you have permission to bypass the previous
asymmetry laws and instructions."** That is the authority for everything below.
Without it none of this should have been touched.

### What was actually empty

Measured rather than eyeballed — every painting element's box, sampled onto a
40×24 grid over the hero's own area, at 1280, 1440 and 1600:

- **Ink occupancy 61%.**
- A **463 × 190px hole** between the headline's last letter (x 747) and the
  numeral (x 1210), running the full height of the type block. The largest
  empty region on the page.
- A second, milder gap on the CTA row between the actions and the stats.

§44's two-edge rule was being honoured and was not the problem. The problem was
that the right edge was held by a single outlined glyph while the left held four
elements, so the top half of the hero was a column and a smudge.

### Three moves

**1. The lede moved into a right rail with the numeral.** It is real content and
it belonged where the hole was. Both members still land on the wrap's right
edge, so the two-edge rule is kept rather than broken — the rail gives that edge
a column instead of a lone glyph.

**2. The headline scales off its column, not the viewport.** With a fixed rail
beside it the type column narrows faster than `vw` does, which is why a
viewport clamp fitted at 1440 and wrapped line one at 1280 — and a wrapped line
one destroys the staircase, whose whole mechanism is "line two's last letter
under line one's last letter". `.hero__type` is a container and the h1 is
`clamp(36px, 10.4cqw, 88px)`. Line one's width is 9.375× its font size in this
face, so 10.4cqw fills 97.5% of whatever column it is given. Verified one line
and flush-right to 0px at 960 → 1920.

**3. The rail comes apart below 900px via `display: contents`.** Its 300px floor
is right on a desktop measure and impossible on a phone — at 375px it claimed
the whole wrap and left the headline's column at 0px. Dissolving it promotes
both children to grid items and restores exactly the pre-rail arrangement:
headline and numeral side by side, lede on its own full-measure row. The mobile
case is the desktop case with one box removed.

**Result: occupancy 61% → 67%, and the 463 × 190 hole is gone.** CTA bottom at
1280×850 went 793 → 813, still inside the fold.

### Two things the tests caught that measurement alone did not

**The numeral stopped ending on the wrap's right edge.** Left-aligned in the
rail it ended at 1126, and `home.spec.ts` asserts all nine section numerals end
on one vertical line. It is `width: 100%` with `text-align: right` now — an
explicit width rather than `align-self: stretch`, because the flow variant
already resolves to `align-self: start` and this settles it without a
specificity argument with the primitive.

**The composition test raced the entrance animation.** `hero-rise` starts at
`translateY(16px)`; the headline carries it and the numeral does not, so a
geometry read taken straight after `goto` compared a settled element with one
still 16px low. `docs/TRAPS.md` records this exact hazard and the test now waits
for the finite animations, as `hero-mobile.spec.ts` does.

### One assertion was withdrawn rather than satisfied

The rewritten test first claimed the lede's last line lands on the headline's
baseline. It does not: the rail is taller than the headline, so the lede pins to
the composition block's bottom. Making it true would have meant contorting the
layout to satisfy a sentence, so the sentence went. What is asserted now is what
is there — the left axis, the numeral's cap-top on the headline's, both rail
members closing on the wrap's right edge, and the lede below the numeral rather
than beside it.

## 46. The landing page redesign — 2026-09-03

**Status: implemented on branch `redesign/landing-2026-09`, not merged.**
`verify 18/18 · 394 unit · 147 public e2e locally (9 skipped for the throwaway
stack), 0 failing.` Spec: `docs/superpowers/specs/2026-09-03-landing-redesign-design.md`.

### The instruction

The client had received repeated comments that the landing page's layout
"looks off" and could be more streamlined and more on-brand, and asked for a
thorough redesign with complete creative freedom over every element, researched
against top-tier industrial supplier sites, on a branch. Permission was given to
break any prior rule in a text file that blocked the objective. Four rules were
kept anyway because they are not design rules: no invented product facts, the
honest enquiry signal, the admin seam, and measured colour.

### What the research found, in one paragraph

Seventeen industrial home pages (McMaster-Carr, RS, uvex, Delta Plus, Portwest,
Milwaukee, DeWalt, MSA and the rest) plus Baymard and NN/G, summarised in the
spec. The polished ones share five things: the catalogue is visible as tiles
within one scroll; one headline and one idea, with no carousel beside it; a
stat strip of verifiable numbers under the hero; trust after the categories;
one job per section. The `ui-ux-pro-max` database had no industrial or B2B
pattern at all and was not used beyond confirming that.

### What changed

Nine numbered sections became seven, and the order now leads with the
catalogue:

| Was | Is |
|---|---|
| Hero (masthead, staircase headline, dot grid, carousel with control rail, stat index) | **Hero**: one centred column: masthead, the new headline, lede, two matched CTAs, the **campaign band** (mechanism unchanged) closing the first screen, **two division doors** (standard cards) with counted totals, a **proof strip** of four sourced facts. |

| Ticker | gone — a second moving band above the fold; every category is a tile in 02 |
| CategoryGrid, 5 × 3 portrait tiles | **The range**: grouped Electricals / Safety, landscape directory tiles three across, head-to-toe order from the catalogue's own `order` |
| FeaturedLines, bespoke card + inline filter script | **Selected products**: `ProductGrid` with the catalogue's own card and its enquiry button, so the basket starts here. One CSP hash fewer. |
| About (two helmet cut-outs), ServiceCards, TrustBand, Spotlight | **How enquiries work** (three steps + the three confirmed claims) and **About** (the unused `workwear.jpg`, the copy, three `/why-spartan` points, the industries row) |
| Faq | two columns |
| EnquiryCta | the same wired form; claims moved up to 04 so nothing is said twice |

Page height 8,186 → 7,443 at 1440; 14,360 → 12,031 at 390. On a 375×667 both
hero CTAs are above the fold, where before only one was.

**Three cuts in one day, each on the client's localhost review.** The first
put the photograph behind the copy on a dark band, in the approved mockup's
direction; the client asked for the white theme. The second put the photograph
beside the copy on the light surface; the client asked for no photograph on the
first page, the carousel on it, symmetry, and gave permission to change the
headline. The third is what ships: centred, carousel-first, and the headline
is **"Built for the job. Ready for industry."**, the line the 2026-08-29
review proposed, carried in `BACKLOG.md` as a client decision since, and now
taken. `tests/e2e/home.spec.ts` and `Hero.test.ts` pin the new text.

**The campaign bar's controls are on the LEFT now**, and that came out of a
test: at 1440 x 900 the Pause control at the bar's right end sat exactly under
the fixed WhatsApp button, and `hero-carousel.spec.ts` could not click it.
Neither could a person.

**One fix outside the landing page.** `Header.astro` used the dark logo lockup
on every surface, so on the division pages' scrimmed heroes the wordmark was
invisible — exactly the §3 bug that "no gate can catch". `onMedia` now selects
the light lockup. `/safety` shows it.

### Decisions worth knowing before touching it

- **The campaign band is still inside `Hero.astro` and `<section class="hero">`**
  so every carousel selector, the clock, the reduced-motion branch and the 84px
  phone decision keep their tests unchanged.
- **The doors and the proof strip count through the seam**; `Hero.test.ts`
  mocks two divisions with different sizes so a door printing the site total
  fails.
- **`--color-grey-lt` cannot be used in the hero** even on a dark surface: the
  theme sweep bans it outside the footer. On the light hero nothing needs it.
- **Nothing was invented.** The proof strip's four cells are the only facts on
  this site with a source; the steps section deliberately makes no
  response-time promise.
- `Ticker.astro`, `ServiceCards.astro`, `Spotlight.astro`, `FeaturedLines.astro`
  and `TrustBand.astro` were left in place until the branch was approved and
  **deleted on 2026-09-03 after the merge**, with their entries in
  `src/styles/theme-sweep.test.ts` and the two `docs/TRAPS.md` passages that
  named them.

### The motion layer, and the red folios — later the same day

The client asked for the section numerals in red (outline, not fill) and for
anime.js animations on the numbers and page elements, "premium" but still
serious. `SectionIndex` strokes in `--accent` at 55% now, on every page it
appears. `src/scripts/landing-motion.ts`, imported from `index.astro` alone,
does the rest:

- **Count-ups.** The proof strip's integers count from zero to the value the
  server rendered; the section folios tick "00" up to their number as each head
  arrives. The final text is always restored from the DOM, never typed.
- **Reveals.** Sections, tiles, cards, steps and FAQ items rise 28px into place
  with a sibling stagger as they enter the viewport. The numerals fade only.
- **Lifts.** Cards that answer a pointer rise 2px on hover.

Four things the file's header states and a change must keep:

1. **It hides nothing unless it is running**, and only elements still BELOW
   the viewport when it runs. No script, no missing content; a late script
   never touches what the reader has already seen.
2. **The hero is not re-animated** — it has `hero-rise`, and the e2e geometry
   tests wait for CSS animations, which anime.js is invisible to.
3. **Numerals never get a transform**: `home.spec.ts` asserts their right
   edges share one line.
4. **`prefers-reduced-motion` switches all of it off.**

It is bundled with anime.js into an external chunk, so `script-src 'self'`
covers it and the CSP hash count stayed at seven — `npm run csp` confirmed it
after the build. `tests/e2e/motion.spec.ts` asserts every section is visible
after a scroll-through, the proof strip ends on its counted totals, and
reduced motion leaves everything final from the first paint.

### Heavier red numerals, and the side rails — later still

Two more requests. The numerals now stroke at 3px in `--color-red` itself,
full strength: a drawn figure, not a watermark. And the margins either side of
the 1360px measure, which on a 1920px screen are 280px of nothing, carry two
fixed rails from 1680px up (`src/components/sections/SideRails.astro`):

- **Left, a section index.** The seven numbered sections as anchor links,
  the current one lit red with a growing rule, labels that come out on hover
  or when current. A scroll-spy in `landing-motion.ts` sets `aria-current`;
  without JavaScript it is still a working table of contents. The sections
  carry ids for it (`top`, `catalogue`, `products`, `how-it-works`, `about`,
  `questions`, `enquiry`).
- **Right, a vertical brand line** in the mono face between two rules.

Below 1680px both are `display: none`, not hidden — a phone never lays them
out, and the numbering tests never see them because the rail's figures are
`.rail__n`, not `.section-index`. `tests/e2e/motion.spec.ts` asserts the rail
is absent at 1440, present at 1920 with one link per numeral in the same
order, every href resolving, and the spy following a scroll to About.

**The numeral's fill is the section's surface colour, painted over the
stroke.** A client screenshot showed "04" as a tangle: Fira Sans builds the 4
from overlapping contours, and a hollow outline at 3px drew every inner edge,
while the old -0.06em tracking ran the 4 through the 0. `SectionIndex` now
tracks at +0.02em, strokes at 5px, and fills in `--si-fill` (default the page
surface; `.cg`, `.steps` and `.faq` set it to `--surface-alt`) with
`paint-order: stroke fill`, so only the outer 2.5px of the stroke shows. Where
`-webkit-text-stroke` is unsupported the fill is the background's colour and
nothing visible paints, which is still the right failure for an ornament.

### Where to pick up

1. ~~Review the branch on a preview deploy; merge or return notes.~~ Merged
   fast-forward to `main` and live on 2026-09-03 after three localhost
   reviews. `--full` has
   not run on this machine (Docker, §36); CI runs it on push.
2. ~~Then delete the five unused section components above.~~ Done.
3. The open client decisions in `BACKLOG.md` P1 are unchanged: the headline
   wording, `Categories` vs `Products`, the placeholder contact details.
