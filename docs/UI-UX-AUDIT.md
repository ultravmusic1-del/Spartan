# Checking UI on glass

How to look at this site and be right about what you see. `docs/TRAPS.md` is
the list of things that pass `astro check` and are wrong anyway; this is the
list of ways *looking at the rendered page* goes wrong.

## Why this exists

A UI/UX audit on 2026-08-30 produced nine findings. Two of them should never
have been filed:

- **The 84px phone banner was reported as a defect.** It is a client decision
  taken 2026-08-27 with the cost written down and a test holding it in place.
  The report's two suggested fixes were the two reversals that decision already
  names as the only honest ones — so the analysis was right and the framing was
  wrong. Fifteen seconds in `docs/TRAPS.md` would have caught it.
- **The product-image resolution ceiling was reported as new.** `BACKLOG.md`
  has tracked it for weeks, with better numbers, and already explains that it
  is what holds product pages at Lighthouse Best Practices 96.

The same audit also spent its entire session unable to read small text in any
screenshot, because it used the editor's browser pane instead of Playwright,
and never opened `design/direction-b-forge.html` — the approved design, sitting
in the repository, which `handoff.md` calls the source of truth for spacing,
size and layout.

None of that was a missing tool. Everything needed was already on the machine.

## The order

Do these in sequence. Steps 0 and 1 cost minutes and decide whether the rest of
the work is worth anything.

### 0. Read the record before you look at the page

- **`docs/TRAPS.md`, the section "Looks like a defect, is not".** Its first
  sentence is a warning that several of the items below have already been
  reported as regressions by someone who did not check.
- **`BACKLOG.md`.** Search it for the area you are about to audit. Items marked
  `ACCEPTED FAILURE` are decisions with a stated cost, not open defects.
- **`handoff.md`.** Go here for the reasoning behind a specific component once
  you have a reason to; do not read it front to back first.

A finding that restates a tracked item is noise. A finding that reopens a
settled client decision is worse than noise — it spends the client's attention
on a question they already answered.

### 1. Read the approved design — and know what it still governs

`design/direction-b-forge.html` is the signed-off direction, and
`handoff.md` calls it the source of truth for spacing, size and layout. **That
sentence predates the seven design-review passes of 2026-08-29** (`handoff.md`
§38–§44), which deliberately moved the site off it on exactly those axes:
`--wrap-max` 1240 → 1360, every section band onto one `--section-pad`, the
crop marks deleted, the hero rebuilt, sections added and reordered. The mockup
was committed on 2026-08-03 and has not been touched since. Those reviews came
from the client, so they supersede it rather than drift from it.

So do not diff the render against it and call the differences defects. What it
still governs, verified 2026-08-30 by measuring both:

- **Proportions, which are exact.** About 50:50, Spotlight 47.5:52.5, Enquiry
  CTA 57.5:42.5 — identical in the mockup and the build. A section whose
  column ratio has drifted *is* a finding.
- **Not absolute widths or vertical rhythm.** Those are `--wrap-max` and
  `--section-pad` now, and both are reasoned in `src/styles/tokens.css`.
- **Not colour.** It shipped with its own contrast failure, recorded in
  `handoff.md`, and the site went light-first on 2026-08-20 while the mockup
  is dark throughout.
- **Not the section inventory.** The ticker and featured lines do not exist in
  it; the footer's newsletter field and social column do, and were removed by
  decision.

Three departures are open for client sign-off and must not be re-reported as
defects: the heading weight scale (600, where the mockup sets 700/800), the
Name field added to the home CTA, and the removed footer email field. All three
are in `BACKLOG.md`.

### 2. Build. Never judge pixels on the dev server

```bash
npm run build
npm run preview
```

`npm run dev` is the wrong command for visual work, for a reason that has
nothing to do with the admin warning in `CLAUDE.md`: on Windows its image
endpoint 404s on `/@fs/C:` paths, so **every image on the page is broken**.
A page with no imagery cannot be assessed, and the failure looks like a site
defect rather than a tooling one.

`npm run preview` serves the real build through `tests/preview-server.mjs`.

### 3. Screenshot with Playwright, not the editor pane

The editor's browser pane returns images scaled to roughly 800×500 and cannot
crop or zoom into a region. Every label, caption and table header on this site
is between 9px and 12px, so in a scaled pane screenshot **none of it is
legible** — which pushes you into inferring from the DOM what you should be
reading with your eyes.

Playwright is already a dependency and its browsers are installed. Drive it
through `playwright.config.ts` or a throwaway script, capture at
`deviceScaleFactor: 2` to a file, and open the file. Screenshot the viewport
and the full page separately; a full-page capture of this site is over 8000px
tall and useless for judging a fold.

### 4. Verify engine-specific claims in WebKit

Chromium is not Safari, and most of this site's traffic is a phone. Anything
you are about to assert about iOS — input zoom below 16px, `100vh`,
`position: fixed` under the home indicator, safe-area insets — gets checked in
WebKit or gets written as an inference and labelled as one.

**WebKit is probably not installed, whatever the browser directory suggests.**
A stale `webkit-<n>` folder from an older Playwright is not a usable browser;
the version in `package.json` pins the build it will launch, and a mismatch
fails at `launch()` rather than at install time. Install the matching one:

```bash
npx playwright install webkit
```

**WebKit cannot reach the preview server without one header change.**
`tests/preview-server.mjs` faithfully replays `vercel.json`'s headers, and the
policy carries `upgrade-insecure-requests`. Chromium exempts `localhost` from
that upgrade; WebKit does not, so every stylesheet and font is requested over
HTTPS, fails with `SSL connect error`, and the page renders at browser
defaults — 13px inputs, no padding, black borders. Nothing announces this: the
page loads, the screenshot looks like a styling regression, and every
measurement you take is of an unstyled document. Strip that one directive in a
Playwright `route` handler for the WebKit run. It is a no-op in production,
where the origin is already HTTPS.

Not the same as a real device, and say so when it matters.

### 5. Run the project's own sweep

```bash
npm run test:db:start
npm run verify -- --full
npm run test:db:stop
```

`--full` runs axe over 13 sampled paths. Your own spot checks do not replace
it. It needs Docker; it **fails rather than skips** without the throwaway
database, which is deliberate.

A green axe run is a floor, not a certificate — `CLAUDE.md` names two real
failures it has missed. Contrast is still yours to measure.

### 6. Measure; do not eyeball

Ratios, sizes and offsets get read off the rendered page —
`getBoundingClientRect`, `getComputedStyle`, `elementsFromPoint` — not
estimated from an image and not recalled from the source. `handoff.md` §3 has
the measured ratio for every brand colour pair; rule 4 says do not reason about
contrast from memory, and that applies to an agent's memory of the stylesheet
it read ten minutes ago.

### 7. Decide: defect, or decision?

Before filing anything, answer both:

- Is it in `docs/TRAPS.md` or `BACKLOG.md` already?
- Does a test hold it in place? A decision on this project usually has one.

If it is a decision you disagree with, the honest form is "this accepted cost
is larger than recorded, here is the measurement" — not a defect report.

### 8. Screenshot the home page wide as well

Two of its features only exist from 1680px up — the side rails in the
margins — and the motion layer hides below-fold sections until they are
scrolled to. A 1440-wide capture cannot show the rails and an unscrolled
capture shows empty sections; take a 1920 capture, and scroll through first
(`docs/TRAPS.md`).

## Six things that lie when you look at them

Each of these produced a wrong conclusion in a real session.

**A `z-index` in the stylesheet is not the `z-index` in the render.** Walk the
ancestor chain for `position`, `transform`, `filter`, `opacity` and
`isolation`, and find the stacking context the element is actually sorted in.
`handoff.md` §33 states the floating WhatsApp button sits "below the mobile nav
panel (60)". It does not: the panel's 60 is scoped inside a header at 25, and
the button is at 40. The record states the intent; only the render settles it.

**`body { overflow: hidden }` is not a scroll lock.** When
`document.scrollingElement` is `html`, the page scrolls behind your open
drawer. Test it — `scrollTo(0, 400)` and read `scrollY` back — rather than
reading the rule and believing it.

**`element.focus()` does not trigger `:focus-visible`.** Scripted focus reports
`outline-style: none` on elements whose focus ring is perfectly good. Press Tab
and read the active element. A "missing focus ring" sweep done in script will
be wrong on every item.

**A lazy image below the fold reports `complete === false` and
`naturalWidth === 0`.** That is not a broken image. Confirm against
`dist/client/` before reporting a 404.

**A screenshot taken immediately after `navigate` catches the entrance
animation.** `hero-rise` runs 0.7s with delays, so the hero photographs empty
and reads as a layout collapse. Wait for the animation to settle, or the bug
you file will be the camera's.

**Contrast is against the resolved ancestor background.** Most elements are
`background-color: rgba(0, 0, 0, 0)`. Walk up until you hit a real colour, or
every ratio you compute is against transparent and meaningless.

**A page that renders at browser defaults looks like a CSS bug, not a loading
one.** The WebKit case above is the example: sane-looking numbers, all wrong.
Before believing a measurement, assert something you already know — a token
resolves, `body` has its background — and treat a blank `--line-control` or a
transparent `body` as "the stylesheet never arrived", not as a finding.

**A `client:visible` island below the fold is inert, and clicking it silently
does nothing.** This one cost a false defect report against the enquiry basket
— the site's entire conversion mechanism — and the report was wrong. On a
product page `EnquiryButton` sits at y≈1233. At 1440×900 that is above the
fold, so it hydrates on load and any click works. At 375×812 it is below the
fold, the island still carries its `ssr` attribute, and a scripted `.click()`
lands on a button with no handler: no error, no badge, no store write. It reads
exactly like "the basket is broken on mobile".

Scroll the element into view, wait for hydration, then click — the basket works
identically on both viewports, in both engines. `client:visible` is deliberate
here so a catalogue page does not hydrate 94 buttons. Before reporting any
mobile interaction as broken, check `astro-island[ssr]` on the control you just
clicked, and prefer a real `page.click()` (which scrolls) over a synthetic one.

## The skill advises; it does not measure

The **ui-ux-pro-max** skill is a database of styles, palettes, pairings and UX
guidelines, and `CLAUDE.md` explains how to install and invoke it. It is good
for "what pattern fits this product type" and useless for "is this ratio legal
on this surface". It knows nothing about this site's tokens and nothing about
safety equipment. Rules 1 and 4 outrank anything it proposes.

Its palette recommendations in particular will not match this site — it
proposes a generic professional navy. The palette is settled in
`src/styles/tokens.css` and is not a thing to reopen from a database.

## One stale reference to distrust

The generated design bundle at the repository root is **not** tracked, carries
its own "needs recompile" marker, and its README describes a dark site with a
near-black `<body>`. The shipped site is light-first, with dark sections opted
in through `.on-dark`. Do not use it as a reference for the current visual
language; `src/styles/tokens.css` and `design/direction-b-forge.html` are the
live sources.
