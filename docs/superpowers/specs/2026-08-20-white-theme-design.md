# The white theme — inverting a dark-first site

**Date:** 2026-08-20
**Status:** approved, not yet implemented
**Supersedes:** nothing. Inverts the surface decisions taken in the landing
redesign (`handoff.md` §11) and re-points, without replacing, the colour
foundations in `handoff.md` §3.

**Reference:** two client mockups, desktop and mobile, of the home page. They
are a reference and not a target — the instruction was to keep the resources the
site already has rather than lift elements out of the images.

## The problem

The site is dark-first. `src/styles/global.css` sets `body { background:
var(--color-black); color: #fff }` and every surface decision follows from
there: three dark surfaces (`--color-black`, `--color-panel`, `--color-card`),
two greys tuned for legibility *on* those surfaces, and `.on-light` as the
narrow exception for the four sections that are light.

The client wants that inverted. White page, dark footer, red retained as the
only saturated colour.

This is not a recolour of one page. Colour is set in scoped `<style>` blocks
across 33 files, with 76 hardcoded `#fff` references and 115 uses of two grey
tokens that exist specifically because the surface behind them is dark. There is
no single place where "what colour is a card" is answered, which is the actual
problem to solve — the white theme is the occasion, not the whole job.

### What makes it dangerous

Nothing in the repository fails when a colour is wrong. `astro check` passes,
the build passes, `npm run verify` passes. `handoff.md` §"Verify" states it
plainly: rule 4 has no static gate, and a green axe run is a floor rather than a
certificate — it missed `.en td` at 4.48:1 and a serious Label in Name failure
on every product card.

The single largest hazard is the two grey tokens:

| Token | Uses | On `#fff` | On `#f6f6f7` | Verdict on light |
|---|---|---|---|---|
| `--color-grey` `#8a8a92` | 61 | 3.43:1 | 3.17:1 | large text only |
| `--color-grey-lt` `#b4b4bc` | 54 | 2.06:1 | 1.91:1 | **fails outright** |

Almost every one of those 115 usages is a kicker, caption, meta line or micro
label — normal-size text by WCAG, needing 4.5:1. Carried across unchanged they
render grey-on-white that looks approximately fine to anyone not measuring, and
no gate says a word.

## Decisions taken with the client

Do not relitigate these.

1. **Scope is the whole public site** — home, About, Industries, Contact, Why
   Spartan, both division pages, catalogue index, all 15 category pages, all 94
   product pages, the enquiry basket and 404. **`/admin/*` stays dark.**
2. **White throughout, dark footer.** No dark bands are retained as
   punctuation. The two red bands stay red.
3. **Product cards become a hairline grid** — white cards separated by 1px
   rules, which is the same structure as today's 1px dark gaps. Not tinted
   tiles, not shadowed cards. The mockups contain no shadow or radius anywhere
   and this keeps that language.
4. **The hero gets a dotted grid and crop marks**, replacing the 80px line grid.
   The red radial glow is deleted.
5. **The utility bar stays**, recoloured light.
6. **A scroll-progress rule is added** under the nav.
7. **Crop marks must never collide with the CTAs**, at any width. Raised by the
   client against their own mobile mockup, where they do.

### Verified, not assumed

The transparent product cutouts were extracted against a dark background, and a
dark halo or grey fringe on any of them would show on white and would not be
fixable in CSS. Three real cutouts were rendered on white during design review
and the client confirmed the edges are clean. No re-extraction is needed.

## The design

### 1. A semantic surface layer

The existing palette in `src/styles/tokens.css` stays exactly as it is and keeps
its current meanings. A semantic layer is added on top of it, and components
reference the semantic names rather than raw colours.

| Token | Light value | Job |
|---|---|---|
| `--surface-page` | `#ffffff` | the page |
| `--surface-alt` | `#f6f6f7` | alternating bands, sunken wells |
| `--surface-raised` | `#ffffff` | cards, panels |
| `--line` | `#e4e4e7` | hairlines, grid gaps, decorative rules |
| `--line-control` | `#8a8a92` | borders that carry meaning — inputs, checkboxes |
| `--text` | `#0e0e11` | body and headings |
| `--text-muted` | `#6a6a72` | kickers, captions, meta |
| `--accent-text` | `#970000` | small red text |
| `--accent` | `#eb2927` | large display red, rules, icons |
| `--accent-fill` | `#dd1e1c` | red surfaces under white text |

`--surface-raised` and `--surface-page` hold the same value and are **not**
interchangeable. A card is `--surface-raised` whether it sits on a white band or
a grey one; the separation comes from the hairline, not from the fill. Keeping
the names distinct is what lets a card gain a tint or a border later without
finding every white in the codebase again — which is the failure this layer
exists to prevent.

Two consequences worth stating outright:

- **`--color-grey` is demoted, not deleted.** It stops being a muted-text colour
  and becomes `--line-control`, where 3.43:1 is the correct bar (3:1, non-text)
  rather than the wrong one (4.5:1, normal text). Its 61 text usages move to
  `--text-muted`.
- **`--color-grey-lt` has no role on light.** Its 54 usages move to
  `--text-muted` or stay inside the dark footer.

`admin.css` references the raw palette and never the semantic layer, so the
admin area is untouched by every part of this.

### 2. Measured ratios

Rule 4: colour is measured, not chosen. Computed with the same sRGB relative
luminance function used by `tests/e2e/contrast.spec.ts`.

| Foreground | on `#ffffff` | on `#f6f6f7` | Bar it must clear |
|---|---|---|---|
| `--text` `#0e0e11` | 19.27:1 | 17.85:1 | 4.5 — passes |
| `--text-muted` `#6a6a72` | 5.36:1 | 4.96:1 | 4.5 — passes |
| `--accent-text` `#970000` | 9.07:1 | 8.40:1 | 4.5 — passes |
| `--accent` `#eb2927` | 4.30:1 | 3.99:1 | **3.0 only — large text** |
| `--line-control` `#8a8a92` | 3.43:1 | 3.17:1 | 3.0 non-text — passes |
| white on `--accent-fill` `#dd1e1c` | 4.91:1 | — | 4.5 — passes |

`--accent` is the trap in this table. It clears 3:1 and fails 4.5:1, so it is
valid for display type, rules and icons and invalid for any small red text.
That is the entire reason `--accent-text` exists as a separate token, and it is
the same distinction rule 4 already draws between `--color-red` and
`--color-red-deep`.

`--line` at 1.27:1 is deliberate and correct: WCAG's 3:1 non-text bar applies to
UI boundaries that convey information or state, not to decorative separators.
Borders that do carry meaning use `--line-control`.

### 3. The dark footer

`.on-dark` re-points the same ten semantic names at the dark palette. It is the
only place on the public site that does. The footer keeps
`spartan-logo-light.svg`, the white-wordmark lockup.

`.on-light` inverts meaning under this design and is renamed to `.on-dark`.
Five files reference it today, including the `.on-light .text-brand` rule in
`global.css`.

### 4. Surface map

Home page, in source order:

| Band | Today | Becomes |
|---|---|---|
| `Hero` | `--color-black` | `--surface-alt` |
| `Ticker` | `--color-red-fill` | unchanged |
| `CategoryGrid` | `--color-black` | `--surface-alt` |
| `FeaturedLines` | `--color-panel` | `--surface-page` |
| `About` | `--color-panel` | `--surface-alt` |
| `ServiceCards` | `--color-paper` | `--surface-page` |
| `TrustBand` | `--color-red-fill` | unchanged |
| `Spotlight` | `--color-panel` | `--surface-alt` |
| `Faq` | `--color-paper` | `--surface-page` |
| `EnquiryCta` | `--color-black` | `--surface-alt` |
| `Footer` | dark | dark, via `.on-dark` |

The two red bands become the site's only saturated surfaces. That is what stops
an all-white page reading as limp, and it is why option C — retaining dark bands
as punctuation — was not needed.

Other page types follow the same map. The catalogue index and the 15 category
pages take the hairline card grid. `enquiry.css` (521 lines, 13 hardcoded
whites) and `MobileNav.tsx` — a dark island panel today — convert with them.

**One exception stays dark:** the division-page headers on `/electricals` and
`/safety` are photographic with a scrim, and their nav links pass only because
of that scrim (6.04:1 composited, 1.11:1 against the raw image). The scrim and
its white text stay. This is already queued in `BACKLOG.md` as needing pixel
sampling rather than computed style, and this work neither fixes nor worsens it.

### 5. The hero

- Background to `--surface-alt`.
- The 80px white line grid at 3.5% opacity is replaced by a 22px dot field.
- **`.hero__glow` is deleted.** A red radial bloom is a dark-surface device; on
  white it renders as a pink smudge. Its `hero-pulse` keyframes go with it.
- Corner crop marks and the two red edge ticks are added, drawn in `--line` and
  `--accent`, `aria-hidden`, purely decorative.

Layout does not change. The hero already renders badge → `<h1>` → banner stage →
pips → pause → two CTAs, which is the order both mockups show. This is a
recolour, not a rebuild, and the source-order and 136px-padding decisions
recorded in `Hero.astro` and `tests/e2e/hero-mobile.spec.ts` stand.

#### The crop-mark collision rule

Marks anchor to the hero's padding-box corners. The content column reserves a
clearance the marks may not enter.

**Below 640px the bottom pair is dropped, not repositioned.** At 375px the CTAs
are full-width and stacked; there is no corner left to draw into, so relocating
the marks only moves the collision somewhere else.

This is gated, not eyeballed: a Playwright case asserts the bounding boxes of
every crop mark and every CTA in `.hero__actions` do not intersect, at 375, 768
and 1280.

### 6. Header

- Utility bar stays, recoloured to light. Its hairline moves to `--line`.
- Both header modes — `--transparent` over a hero, `--solid` elsewhere — are
  light now. The `--solid` background moves to `--surface-page`.
- **The logo swaps to `spartan-logo.svg`**, the black-wordmark lockup that
  already exists for light backgrounds. Neither lockup is recoloured or
  redrawn. `handoff.md` §3 records that using the wrong lockup on the wrong
  surface is a real bug that has occurred on this project before.
- The scroll-progress rule uses `animation-timeline: scroll()`. **No new inline
  script**, therefore no new CSP hash, and no change to the 9-hash count.
  Browsers without scroll-driven animation support show a static hairline, which
  is the correct degraded state for a decorative progress indicator.

## Gates

### The contrast gate carries this change

`tests/e2e/contrast.spec.ts` resolves a rendered colour against its first
painted ancestor background and takes one line per selector. It grows from 5
cases to cover the pairs this change creates: product card name and kicker,
breadcrumbs, spec-table cells, FAQ body, utility-bar text, nav links, and the
footer's muted text inside `.on-dark`.

Two existing cases invert and are **rewritten rather than deleted**:

- `.eyebrow` is described as "micro label on dark" and will not be on dark.
- `.hero__title span` moves to `#f6f6f7`, where it measures 3.99:1 and passes
  only as large display type. Its entry must say so, because that is exactly the
  boundary the typography spec of 2026-08-11 showed can be crossed silently by a
  weight change in a different file.

### Documentation is part of the change

`handoff.md` §3 documents a dark-first site and rule 4 sends the reader there
for ratios while forbidding reasoning from memory. Leaving it stale makes the
one authoritative reference actively misleading, which is worse than having
none. It is updated in the same commit as the code.

`CLAUDE.md` §"Four rules" item 4 names the three red tokens by job. Those jobs
are unchanged — the semantic layer points at the same three colours — so item 4
needs no edit. If any edit to `CLAUDE.md` does prove necessary, it is copied
byte-identical to `AGENTS.md`, never edited twice.

### Things that pass every gate and are still wrong

1. **A missed grey.** 115 candidates, no gate, renders as approximately-fine
   grey on white.
2. **The hero's inline parallax script.** It contains a breakpoint value inside
   its own media query, so editing the hero can invalidate its hash. A stale
   hash does not fail the build — it ships a hero that never parallaxes.
   `npm run csp` re-run and `vercel.json` committed.
3. **A leftover `.on-light`.** Renaming to `.on-dark` inverts the meaning; a
   missed one silently applies light-surface rules inside the dark footer.

### Cannot be gated

The 19 banner JPGs are dark photographic posters designed to sit on black. On a
white hero they become heavy dark rectangles. One banner was rendered on white
during design review and read correctly, but that is one of six enabled and the
judgement belongs to the client. **The built hero must be shown cycling all six
before this work is called done.**

### Verification

`npm run verify -- --full` green — typecheck, 272 unit tests, invariants, build,
output sweeps, Playwright and axe over 13 sampled paths. Then `npm run csp` and
`npm run counts` re-run from that build, with `vercel.json` committed.

A green run does not certify rule 4. It certifies rules 2 and 3 and the built
output. Rule 4 is certified by the contrast spec's case list, and that list is
only as good as the selectors in it.

## Out of scope

- **`/admin/*` stays dark.** Its own stylesheet, its own palette, untouched.
- **No product data is touched.** This is presentational only, so rule 1 is not
  in play — no specification, rating, dimension or description changes.
- **No copy changes.**
- **Division-page photo headers keep their scrim**, and the pixel-sampling gate
  they need stays in `BACKLOG.md`.
- **No dark-mode toggle.** The semantic layer makes one cheap later; building it
  now is speculation. YAGNI.
