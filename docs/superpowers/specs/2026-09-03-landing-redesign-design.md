# Landing page redesign — 2026-09-03

**Brief.** The client has received repeated comments that the landing page's
layout "looks off" and could be more streamlined and more appropriate to the
brand. The instruction was a thorough redesign with complete creative freedom
over every element of the landing page, researched against top-tier industrial
supplier and manufacturer sites, on a branch. Any prior rule in a text file may
be broken if it blocks the objective.

**Scope.** `src/pages/index.astro` and the components it renders. The header,
footer and every other page are untouched except where a landing-page change
forces a test or gate to follow.

## What the research said

Seventeen home pages were read as text (McMaster-Carr, RS Components, Zoro,
Hilti, Milwaukee, DeWalt, Bosch Professional, Havells, Polycab, Finolex,
Schneider, uvex, Delta Plus, JSP, Portwest, Safety Jogger, Mallcom, Karam,
MSA) plus Baymard's homepage/category research, NN/G's B2B usability report
page, and two RFQ-form articles. The patterns that recur on the polished ones:

1. **The catalogue is visible within one scroll, as image tiles.** The sites
   that spend the hero on an app promo or an About link read as corporate
   sites, not suppliers.
2. **One headline, one idea.** The strong ones are trust claims, not product
   names or promotions. Nobody good puts a carousel or a search box in the hero.
3. **A stat strip directly under the hero**, three or four verifiable numbers.
4. **PPE brands organise head-to-toe; electrical brands by function.** Industry
   is a second route, never the first.
5. **Trust after the categories, not before**; certifications as marks, not
   sentences.
6. **Each section has one job and one CTA.** Cluttered sites have several
   carousels and three card idioms.
7. **Light ground, one saturated accent, product photography on consistent
   backgrounds, a bold display face for headlines only.**

The project's own four client reviews (handoff §38–§45) say the same thing in
different words: "visually loud and semantically quiet", "3–4 design languages
stitched together", "competent but bland".

The `ui-ux-pro-max` database was queried per `CLAUDE.md`. It has no industrial,
B2B, manufacturing or catalogue pattern; every query returned zero rows. Its
`--design-system` output proposes a generic navy SaaS palette, which
`docs/UI-UX-AUDIT.md` already says to disregard. Noted as a fallback, not used.

## What is wrong with the current page, specifically

Measured from screenshots of production at 1440, 1280 and 390:

- **The hero is five ideas stacked**: a mono masthead, a two-line staircase
  headline, an outlined numeral, a campaign banner with its own label and
  control rail, and a three-figure stat index. The eye has nowhere to settle
  and a visitor still has to scroll to learn what is sold.
- **Two moving things above the fold** (carousel and ticker). Baymard: 46% of
  homepage carousels have measurable performance problems.
- **Catalogue content is shown three times in three idioms**: the category
  shelf, the featured cards, the six service cards. The Spotlight adds a
  fourth. The page is 8,186px tall on desktop and 14,360px on a phone.
- **Nine numbered sections of equal weight.** Numbering was meant to make a
  rhythm; at nine, it is wallpaper.
- **The mobile hero** shows an 84px banner and pushes the primary CTA to
  ~1,000px on a 390×844 screen.

## The design

### Principles

- **Light site, light hero, centred.** A first cut put the hero on a dark
  band in the approved mockup's direction; the client asked for the white
  theme. A second put the client's photograph beside the copy; the client
  asked for the carousel on the first page instead and a symmetrical layout.
  Red marks action and brand, never a surface.
- **Seven sections, not nine.** Each has one job and at most one primary
  action.
- **The catalogue leads, grouped by division.** The buyer meets what is sold
  before being asked to trust the seller.
- **Every number is counted or sourced.** Nothing is invented (rule 1 stands).
- **The systems built on 2026-08-29/30 stay**: the shared head, the section
  numeral, the 4px spacing grid, the type scale, the card language, the
  measured colour pairs. This is a redesign of composition and content order,
  not of the design system.

### Section order

| # | Section | Job | Surface |
|---|---|---|---|
| 01 | **Hero** | Say what Spartan is, show the campaign, offer the two divisions and the two actions | light, centred |
| — | **Proof strip** | Four verifiable facts at the hero's foot | light |
| — | **Campaign band** | The client's uploaded banners, one at a time, with pause; closes the first screen | inside the hero |
| 02 | **The range** | All 15 categories, grouped Electricals / Safety, head-to-toe within Safety | light alt |
| 03 | **Selected products** | Eight real product cards with the enquiry button, so the landing page itself fills the basket | light |
| 04 | **How enquiries work** | Three steps and the three confirmed claims; the conversion mechanism explained once | light alt |
| 05 | **About Spartan** | The story, the worker photograph, the three things the site can stand behind, and the industries row | light |
| 06 | **Questions** | The five FAQs, two columns | light alt |
| 07 | **Enquiry** | The wired quick form and the distributor link | light |

Removed from the landing page: the category ticker (a second moving band above
the fold; every category it linked is a tile in 02), the six service cards
(restated the category grid in prose), the Spotlight (one glove; 03 shows eight
products with their specs and a working enquiry button), and the hero's stat
index (moved to the proof strip). `Ticker.astro`, `ServiceCards.astro` and
`Spotlight.astro` stay in the repository, unused on this page.

### 01 Hero

**Third cut, 2026-09-03 afternoon**, after the client saw the first two on
localhost: no photograph on the first page, the campaign carousel on it, a
symmetrical composition, permission to replace the headline.

One centred column on the page surface, inside the wrap:

- **Head row**: a three-cell grid: empty, the masthead centred (`Spartan® /
  Electricals + Safety`, mono, `--text-muted`), the section numeral `01` on
  the wrap's right edge as every section's is.
- **Headline**: `Built for the job. Ready for industry.`, the line a
  2026-08-29 review proposed and `BACKLOG.md` carried under "Sign off or
  replace the hero headline", now adopted with the client's permission. Set in
  `--font-hero` (Fira Sans Italic 800), uppercase, two lines centred on one
  axis: line one in `--text`, line two in `--accent` (4.30:1 on white, legal
  at >=38px). Size `clamp(38px, 5.2vw, 72px)`.
- **Lede** (`--text-muted`, 5.36:1, <=52ch): the existing sentence.
- **Actions**: `Browse catalogue` (solid red) and `Request a quote` (outline),
  drawn as one matched pair at equal width, centred. A stretched column below
  560px.
- **Campaign band**: the wrap's full width, 4:1, directly under the actions;
  the first screen ends on it at 1440x900. Its control row sits under the
  frame with the controls on the LEFT and the label on the right, because the
  floating WhatsApp button owns the bottom-right of every viewport.
- **Division doors**: two equal `.card-surface` cards, each a link into its
  division with the blurb, counted totals and one circled chevron on the
  trailing edge.

- **Proof strip** across the hero's foot, a `--line-control` rule above, cells
  centred: `94 Products`, `15 Categories`, `Since 2015`, `Made in India &
  China`. The first two are counted; the year and the manufacturing statement
  are from the brochure. Nothing else qualifies under rule 1.

**Mobile (<=900px)**: left-aligned, one column: masthead and numeral on one
row, headline, lede, both CTAs, the campaign band, the two doors stacked, then
the proof strip as a 2x2 grid. The primary CTA must clear the fold on 375x667
and 360x640 (`tests/e2e/hero-mobile.spec.ts` keeps asserting this).

### Campaign band

The three uploaded banners keep their mechanism unchanged: `getHeroBanners`,
`heroClock`, the generated `is:inline` keyframes, the checkbox pause, the pips,
the counter, the 4:1 frame, the reduced-motion branch. It sits inside the hero
column between the actions and the doors.

It stays inside `Hero.astro` and inside `<section class="hero">` so that
`Hero.test.ts`, `hero-carousel.spec.ts` and `home.spec.ts` keep their selectors
(`.hero__stage`, `.hero__frame`, `.hero__track`, `.hero__pip`, `.hero__toggle`,
`.hero__pause`, `[data-hero-stage]`). The one assertion that changes is source
order: headline, actions, stage, doors, proof.

On a phone the band is still 4:1 and ~84px tall. That is the client's recorded
decision (`docs/TRAPS.md`) and the test that pins it stays.

Empty state (no banners): the band renders the honest empty slot, as now.

### 02 The range

Head: eyebrow `The catalogue`, title `Everything we supply, on <span>one
shelf</span>.`, action `All 94 products ›` (counted). Then two groups, each
with a division label row (`Electricals — 5 categories · 33 products`, then
`Safety — 10 categories · 61 products`, counted, each label a link to the
division page) and its tiles beneath. Safety's tiles are ordered head-to-toe
as the catalogue's `order` field already has them (head, eye, hearing, hand,
foot, harness, body, workwear, spill).

Tiles: the existing `.cg__card` — `.card-surface`, product cut-out on
`--surface-alt`, uppercase name, count. Five per row on desktop, three at
≤1100px, two at ≤640px. The two empty categories keep their `Range expanding`
tile with no image (`docs/TRAPS.md`; the test that pins two empty tiles stays).

### 03 Selected products

Head: eyebrow `Selected products`, title `A cross-section of both divisions.`,
lede counted (`8 of 94 products …`). Then `ProductGrid` with eight products —
the same `ProductCard` the catalogue uses, so the landing page carries the
catalogue's card and its `Add to enquiry` island. The eight come from
`src/lib/featured.ts` unchanged (four per division). No division tabs: the
inline filter script and its CSP hash go, and the section works identically
with JavaScript off.

### 04 How enquiries work

Head: eyebrow `Trade enquiries`, title `Build a list, send it once.`. Three
numbered steps in a row (`01 Add products as you browse`, `02 Send one request
across both divisions`, `03 We reply with availability and pricing`), each a
short sentence. Below, the three client-confirmed claims from `EnquiryCta`
(bulk and contract pricing, mixed pallets, samples on safety lines) as a
hairline list. One action: `Start an enquiry ›` to `/enquiry`. No response-time
promise — none has been confirmed.

### 05 About Spartan

Head: eyebrow `About Spartan`, title `A trusted name in electricals and
safety.`. Two columns: the worker photograph `src/assets/hero/workwear.jpg`
(client-supplied, currently unused on the home page) at 4:5, and the copy —
the two existing paragraphs, then three short points lifted verbatim from
`/why-spartan` (specifications stated per product; glove ratings shown as
printed; gaps shown as gaps), then `Read more ›` to `/about`. Below the columns,
the industries row from `TrustBand` (eight chips, still marked pending client
confirmation in the source) with its `Where it goes` label. `TrustBand.astro`
is folded in here rather than kept as its own numbered section.

### 06 Questions

Unchanged content. The list becomes two columns above 900px so the section is
half as tall. First item open, as now.

### 07 Enquiry

The wired quick form stays exactly as it is (its contract is tested end to
end). Composition tightens: head, then a two-column row with the explanatory
copy and the distributor button on the left and the form on the right as a
raised panel. The three claims move up to 04, so they are not stated twice.

### Numbering

Seven numbered heads: 01 hero, 02–07 for the sections above. The campaign band
and the proof strip are bands with no head and take no number (the same rule
the ticker had). `home.spec.ts` continues to assert the series is complete and
gapless, that every numeral ends on one vertical line, and that the hero's is
the largest.

### Colour and type

No new tokens and no new pairings: every colour in the hero is one of the
light pairs already measured in `handoff.md` §3 — `--text` and `--text-muted`
on `--surface-alt` and `--surface-raised`, `--accent-text` for small red,
`--accent` only on the ≥40px headline line (3.99:1 on `--surface-alt`).

### Tests

Rewritten to match: `Hero.test.ts` (proposition assertions), `home.spec.ts`
(hero composition, featured lines, ticker), `hero-mobile.spec.ts` (source
order), `motion.spec.ts` (ticker parts), `contrast.spec.ts` (the ServiceCards
case on `/` becomes the hero lede, proof label, tile count and step body). Nothing that pins a client
decision is weakened: the 84px phone band, the two empty tiles, the headline
text, the honest enquiry outcome.

`npm run csp` re-runs because an inline script leaves the page. `npm run
counts` re-runs after the build. `--full` cannot run on this machine (Docker,
handoff §36); CI runs it on push.

## Out of scope

Header labels (`Categories` vs `Products`), the headline wording, the phone
placeholder, the real domain — all client decisions in `BACKLOG.md`, none of
them blocking this work.
