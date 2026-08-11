# Spartan Catalogue Website — Handoff

**Last updated:** 2026-08-10
**Branch:** `agent/improvements` — all work lands here. **`main` no longer tracks it**, despite what this line said through the `feat/catalogue-site` era; it has fallen behind and nothing merges it forward automatically. `git log main..agent/improvements` is the difference.
**State:** **The catalogue build is complete and verified. The admin subsystem is in progress.** The public site builds end to end and the full enquiry path works from product card to submitted RFQ. Admin Phase 1 has landed its auth foundation — sign-in, sign-out, the session guard and the CSV serialiser — but no dashboard page exists yet. See §7 "The admin subsystem".

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

### The hero is two client artworks, art-directed

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

**What has actually landed is the auth foundation, not all of Phase 1.**
`public.admins`, cookie parsing, the auth module, the middleware guard, the
sign-in and sign-out endpoints, the login page and `AdminLayout`. **There is no
`/admin` index page yet**, so a successful sign-in currently redirects to a route
that does not exist. The enquiry inbox, the detail view, the status workflow, the
product-demand report and the CSV export route are all still to come — the CSV
*serialiser* shipped ahead of the endpoint that will use it, and `toCsv` has
tests but no caller.

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

**What Phase 1 still owes.** The design doc's acceptance conditions for the phase
include e2e coverage of the auth boundary — an unauthenticated request to every
admin route redirects, and an authenticated non-admin is refused — and zero CSP
violations on every admin page behind a real login. **Neither test exists yet;
`tests/e2e/` has no admin spec.** Until they do, the guard is verified by reading
it rather than by running it, which is exactly the standard the rest of this
project does not accept.

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
