# Typography — a weight scale, and a third family for data

**Date:** 2026-08-11
**Status:** approved, not yet implemented
**Supersedes:** nothing. Extends the type system set in Task 2 and restyled by
the landing redesign (`handoff.md` §11).

## The problem

Two problems, one of them invisible until you go looking.

**The site has almost no weight contrast.** Of 85 rules that set a weight of 500
or above, 61 are `700` and 15 are `800`. Display headings are `800`, card titles
are `700`, and 11px uppercase micro labels are also `700`. Every level of the
hierarchy is shouting at roughly the same volume, which is why the largest type
reads as heavy: at `clamp(44px, 6vw, 76px)` a weight of 800 is not emphasis, it
is mass. Nine section and hero headings carry that weight today.

**The global heading rule is load-bearing for accessibility, and nothing says
so.** `src/styles/global.css` sets `h1, h2, h3, h4 { font-weight: 700 }`. WCAG
counts text as "large" — and therefore subject to the 3:1 contrast bar rather
than 4.5:1 — at ≥24px, *or* at ≥18.66px when **bold**. Three red headings sit in
that second band and pass only because of that global `700`:

| Rule | Size | Surface | Ratio | At 700 | Below 700 |
|---|---|---|---|---|---|
| `.card__title` (`ServiceCards.astro`) | 19px | `#fff` | 4.30:1 | passes (3:1) | **fails** (4.5:1) |
| `.rs__title` (`why-spartan.astro`) | 19px | `#fff` | 4.30:1 | passes | **fails** |
| `.dv__name` (`about.astro`) | 21px | `#fff` | 4.30:1 | passes | **fails** |

So the requested change — lighter headings — silently breaks WCAG AA in three
places, and **nothing in the repository would catch it**. `handoff.md` §"Verify"
states outright that rule 4 has no static gate, and that a green axe run missed
`.en td` at 4.48:1 and a serious Label in Name failure on all 72 product cards.
This is the same class of failure.

All three set `color: var(--color-red)` directly, which is how they bypass
`global.css`'s `.on-light .text-brand` enforcement in the first place.

**And the catalogue has no typographic register for data.** Spec values, EN 388
ratings and model codes are set in the same faces as prose. `4 5 4 3 X` is five
positional values where each slot means a different test; `FAS40-4` and `MP-203`
are codes a buyer transcribes into an RFQ. Set in a proportional face they read
as language, and their columns do not align.

## The design

### 1. A weight scale, as tokens

Optical weight grows with size, so a tuned scale runs weight **down** as size
runs **up**. Archivo and Inter are variable across `100 900`, so half-steps cost
nothing — the entire range already ships and the site has simply never used
below 500.

```css
--fw-monument: 450;   /* >=100px  — the 404 numeral, decorative */
--fw-display:  500;   /* 40-99px  — hero h1, division h1, section headings */
--fw-section:  550;   /* 26-39px  — stat numerals, sub-heads */
--fw-subhead:  600;   /* 15-25px  — card titles, list titles */
--fw-label:    650;   /* <15px    — uppercase micro labels, eyebrows */
--fw-body:     400;   /* unchanged */
```

Five monotonic steps replacing a flat 700/800. **Bands are assigned by a rule's
maximum size**, which for a `clamp()` is its desktop ceiling — that is where
heaviness is felt, and a single declaration cannot vary weight across a clamp
range without a media query the design does not otherwise need.

The consequence worth stating plainly: **the heaviest type on the site becomes
the smallest.** That inversion is the point. It is also why micro labels move
only 700 → 650 rather than to 600 — 11px uppercase at 0.18em tracking genuinely
needs weight, and taking those down as far as the headings would turn them to
mud. The complaint was about titles; the fix is aimed there.

Distribution of the 85 affected rules: 1 monument, 8 display, 5 section, 11
subhead, 52 label, 8 inheriting.

The 8 that declare no adjacent `font-size` cannot be banded automatically and
are assigned by hand:

| Rule | Now | Becomes | Why |
|---|---|---|---|
| `global.css` `h1, h2, h3, h4` | 700 | `--fw-subhead` | the global heading default |
| `En388Table` `.en td` | 800 | `--fw-subhead`, mono | 16px data cell, see §3 |
| `SolidButton` (2 rules), `PillButton` `.pill .chev` | 700 | `--fw-label` | ~13px button and chevron glyphs |
| `enquiry.css` `.eq-add` | 700 | `--fw-label` | the add-to-basket control |
| `SpecTable` `.spec__feature` | 500 | unchanged | an unlabelled prose row, already light |
| `AdminLayout` | 600 | unchanged | staff-only, outside the public type scale |

### 2. The contrast fix, and the first real gate for rule 4

The three headings above switch from `--color-red` to `--color-red-deep`
(8.40:1 on paper, better on `#fff`). That token exists for exactly this case;
these three simply never used it.

**This change ships with a gate.** A Playwright spec reads `getComputedStyle`
for a named list of red-on-light elements, derives the applicable WCAG bar from
the computed `font-size` and `font-weight`, computes the actual contrast ratio
against the resolved background, and asserts it clears.

Scope, stated honestly: this is **not** a general WCAG sweep. It cannot resolve
a background behind an image or a gradient, and it only checks selectors it is
given. It is the first thing in the repository that would catch a weight change
breaking a contrast bar, and adding a selector to it is one line. A general
sweep is a larger piece of work and is not attempted here.

The gate must fail against a planted violation before it is trusted — the
standard `npm run verify`'s robots.txt and service-role gates were held to.

### 3. JetBrains Mono Variable, for data only

| | |
|---|---|
| Family | JetBrains Mono Variable |
| Licence | OFL-1.1 |
| Source | `@fontsource-variable/jetbrains-mono@5.3.0`, latin subset |
| File | `public/fonts/jetbrains-mono-variable.woff2`, 39.5 KB |
| Axis | `font-weight: 100 800` |

One variable file, matching the pattern `src/styles/fonts.css` already documents
— and the reason IBM Plex Mono was rejected despite the better industrial
pedigree: it has no variable build, so it would need one file per weight and
would contradict that file's warning outright.

New token `--font-mono: 'JetBrains Mono', ui-monospace, monospace;`

**Where it is used** — the rule is *a value a buyer would transcribe into an
RFQ*:

- `.en td` — EN 388 rating cells. Five positional values that should align and
  read as a code.
- `.spec td` — spec **values** in labelled rows. Labels stay Archivo uppercase,
  so the two columns finally look like two different kinds of thing. Model codes
  live here too, in the `Models` row, so they are covered without a special case.

**Corrected during implementation — `.pd__variant` and `.card__variant` are NOT
mono.** This spec originally listed them on the assumption that `variantLabel`
holds model codes. It does not. Of the 25 products carrying one, six are codes
(`AY-YD2536`, `SPTSF-16`, `AF-40W`…) and the other nineteen are language:
`Without steel toe`, `Velcro closure`, `Indirect vent`, `Lightweight`, plus size
lists like `6" · 8" · 10"`. Setting those in a monospace is the same decorative
misuse the feature-row exclusion below exists to prevent, and no rule can split
the field because the distinction is semantic, not structural. The mono
therefore lands in exactly two places: `.en td` and `.spec td`.

**Where it is not used**, and all three exclusions are deliberate:

- `.spec__feature` — the unlabelled full-width rows, roughly a third of all spec
  lines. They are sentences (`100% Copper motor`), not values. Setting prose in
  mono because it happens to live in a table would be the font doing decoration
  again, which is the thing this choice was made to avoid.
- Counts like "17 items". That is language with a number in it, not data.

### 4. Loading — corrected by measurement

**This section originally claimed the home page would download zero extra bytes,
on the reasoning that a font is only fetched when a rendered element matches it
and nothing on `/` uses `--font-mono`. The second half was false.** `Spotlight`
imports `SpecTable` and `En388Table` and renders both in full for Grip Guard GP5
— it is a real data view, deliberately built on the one product with a verified
EN 388 rating. So the mono lands on the home page, which holds the lowest
Performance score on the site.

Measured, three runs each, Lighthouse 12.8.2 mobile:

| Build | Home Performance | LCP |
|---|---|---|
| before this change | 95 | 2.78 s |
| full latin subset, 39.5 KB | **91** | 3.23 s |
| weight scale only, no mono | 95 | 2.78 s |
| subset to 118 chars, axis 400–600, 23.1 KB | **94** | 2.86 s |
| subset pinned to one weight, 16.7 KB | 94 | 2.85 s |

Three findings, all of which contradicted a plausible assumption:

- **The font is the cost, and it is bandwidth, not rendering.** Removing it
  restored 95 exactly. `font-display: optional` was tried first on the theory
  that render behaviour was the problem: it changed nothing at all, because
  `font-display` governs how a font *paints* and the cost here is the *fetch*.
- **Clipping the weight axis saves more than subsetting the characters.**
  Characters alone: 39.5 → 31.4 KB. Adding the axis clip: → 23.1 KB.
- **The last 6.4 KB buys nothing.** Pinning to a single weight also scores 94,
  so the two-weight design is free and is kept: `.spec td` at 400 because a
  dense table should not shout, `.en td` at 600 because five rating cells are
  the most consulted figures on a glove page.

**The honest outcome is 94, not 95, and that misses this spec's own acceptance
criterion.** It is recorded rather than rounded away. The trade is one
Lighthouse point and ~75 ms of LCP on the home page, against the catalogue
having a typographic register for data. It is a judgement call and it belongs to
a person, so it is flagged in the report rather than settled here.

There is deliberately **no `<link rel="preload">`** for the mono: the two
existing preloads in `BaseLayout.astro` are global, and preloading would raise
its priority against the LCP image, which is the opposite of what the
measurement asks for.

`vercel.json`'s existing `/fonts/(.*)` rule already gives it a year of immutable
caching; no change needed there.

**The subset creates a tofu risk, and it is gated.** `COVERAGE` in
`tools/subset-mono.mjs` is the source of truth for what the font carries;
`tools/subset-mono.test.ts` asserts the catalogue never uses a character outside
it and fails naming the character, its codepoint and the product that introduced
it. Proved against a planted gap: removing `Ω` reported
`"Ω" (U+03A9) from premium-network-cable → "Impedance"`.

## What this does not change

- No colour token values. Rule 4's measured ratios in `handoff.md` §3 stand.
- No font sizes. Only weights, three colours, and three families' worth of
  `font-family` on data cells.
- No body copy weight — `--fw-body` stays 400.
- No inline scripts, so no CSP hash change and no `npm run csp` run.

## Risks

**This is a visible departure from the approved design.** `design/direction-b-forge.html`
is the signed-off direction and it sets these headings at 700/800. Changing them
is the same category of decision as the Name field added to the home CTA and the
removed footer email field, both of which `handoff.md` records as needing
sign-off. It is recorded in `handoff.md` and `BACKLOG.md` rather than left to be
discovered.

**52 label rules is a wide mechanical diff.** The change is `700` → `var(--fw-label)`
across ~30 files. It is applied by script rather than by hand to avoid
transcription error, and the diff is reviewed before commit. Note that a
PowerShell `Set-Content` round-trip corrupts this repository's UTF-8 em dashes —
the codemod uses Node's `fs` with explicit `utf8`.

**The mono is 23.1 KB and it lands on the home page, not only on product pages.**
This risk was written on a false premise — see §4, which records the measurement
that corrected it and the 95 → 94 outcome that follows.

## Acceptance

1. `npm run verify -- --full` green, all gates. **Met.**
2. The new contrast gate fails against a planted violation and passes without.
   **Met** — planting `--color-red` back on `.card__title` produced
   `19px / weight 600 => NORMAL text, bar 4.5:1 · rgb(235,41,39) on
   rgb(255,255,255) = 4.30:1`.
3. Lighthouse re-run on `/` and `/products/grip-guard-gp5`: home Performance
   must not regress below 95, and no Accessibility score may fall.
   **Accessibility held at 100. Performance is 94 — this criterion is NOT met**,
   and §4 records why, what was tried, and what the remaining point costs.
4. No rule anywhere still sets a literal `font-weight` of 700 or 800 on a
   display-font element — the scale is the only source. **Met**, 78 rules
   converted; 7 left alone because they already sat lighter than their band and
   the token would have made them heavier.
5. The mono subset covers every character the catalogue sets in it, gated by a
   test that fails naming the offender. **Met**, proved against a planted gap.
