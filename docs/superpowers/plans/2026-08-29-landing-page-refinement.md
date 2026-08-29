# Landing Page Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take the above-the-fold experience of `/` from "good art direction without an interface pass" to a deliberately engineered one — correct hierarchy, functional scale, a supporting proposition, a real search affordance, and carousel controls that read as one system — without abandoning the existing concept.

**Architecture:** Every change is confined to five existing files (`Hero.astro`, `Header.astro`, `UtilityBar.astro`, `Ticker.astro`, `CatalogueFilters.tsx`) plus their tests and two docs. No new sections, no new dependencies, no new routes, no inline scripts. The hero's vertical rhythm is re-derived from one constant (`--hero-chrome`) once the utility bar is gone, so the geometry stays a single arithmetic chain rather than a pile of tuned numbers.

**Tech Stack:** Astro 7 · TypeScript strict · scoped `<style>` in `.astro` components · Preact island (`CatalogueFilters.tsx`) · Vitest (unit) · Playwright (e2e) · `npm run verify`

---

## Decisions taken before writing this plan

The feedback contains three questions only the business can answer. They were
answered here so work could proceed; each is one line to reverse and each is
recorded in `BACKLOG.md` by Task 12.

**1. The H1 wording is NOT changed.** The feedback is right that
`Home and industrial solutions.` is semantically quiet — but it is the
client's approved brand line, `tests/e2e/home.spec.ts` pins it, and replacing a
client's headline is their call, not a design pass's. The *defect* the feedback
identified — a visitor cannot tell what Spartan sells — is fixed by Task 4,
which adds the eyebrow and the supporting sentence the hero has never had. The
proposed alternative (`BUILT FOR THE JOB. / READY FOR INDUSTRY.`) goes to
`BACKLOG.md` as a client sign-off item.

**2. `Browse catalogue` stays the red primary, and keeps that wording.**
`CLAUDE.md` states the conversion mechanism is a multi-product enquiry basket,
and a basket is filled from the catalogue — discovery is the entrance to the
funnel, not a detour around it. The word stays `catalogue` because the route is
`/catalogue`, the nav panel says "View the full catalogue", and the breadcrumbs
say Catalogue; changing one of four labels buys clarity in the hero at the cost
of consistency everywhere else. Task 8 gives both CTAs the authority the
feedback asks for without touching either word.

**3. The placeholder phone number leaves the header.** `src/data/site.json`
still holds `+971 00 000 0000`, so today every page publishes a `tel:` link
that dials nothing. This repo has twice removed exactly this — the footer's
newsletter field and its three `href="#"` social icons — for the same reason.
Task 2 makes the header render the real `tel:` link **when the number is real**
and a `Contact sales ›` link to `/contact` while it is not, so the fix
disappears by itself the day the client supplies a number.

## What this plan deliberately does NOT do, and why

- **No invented trust claims.** Feedback §21 proposes `1,000+ PRODUCTS`,
  `BUILT FOR GCC CONDITIONS` and `QUALITY ASSURED`. The catalogue holds **94**
  products; there is no source on this machine for a region claim or a
  certification claim. That is rule 1, and it is a safety rule here, not a
  style one. Where a number is used (Task 4) it is counted from the catalogue
  at build time, exactly as `src/pages/index.astro` already counts for its meta
  description.
- **No nav relabel from `Categories` to `Products`, and no invented mega-menu.**
  The client asked for the single `Categories` item on 2026-08-17
  (`Header.astro`'s own header comment). Feedback §19's example menu lists
  Power Tools, Material Handling and Pumps — Spartan's fifteen real categories
  are Lighting, Fans & Ventilation, Water Pumps & Controls, Insect Killers,
  Cables, Electrical Accessories, Head & Face Protection, Eye Protection,
  Hearing Protection, Hand Protection, Safety Footwear, Harnesses & Fall
  Arrest, Body Protection, Workwear, Spill Control. The dropdown already
  renders all of them from the catalogue seam. Nothing to build; the label is a
  client decision.
- **Ticker speed is already correct.** Feedback §15 asks for 25–40s. The track
  runs `84s` over a doubled string, i.e. one viewport traversal well inside
  that band, and `prefers-reduced-motion` already stops it dead
  (`src/components/sections/Ticker.astro`). No change.
- **Sections below the fold are already product-first.** Feedback §21–22 ask
  for a trust band and category tiles after the hero; `src/pages/index.astro`
  already renders `Ticker → CategoryGrid → FeaturedLines` before any editorial
  section, and `src/components/sections/TrustBand.astro` exists. No change.

---

## File Structure

| File | Responsibility after this plan |
|---|---|
| `src/components/layout/UtilityBar.astro` | **Deleted.** Its only content was three decorative non-link social marks. |
| `src/components/layout/Header.astro` | Nav at a readable scale; logo with authority; search affordance; phone that is honest about being unset. Owns the top of every page with nothing above it. |
| `src/components/sections/Hero.astro` | Eyebrow, headline, supporting line, banner stage, unified carousel controls, CTAs — on one derived spacing scale. |
| `src/components/sections/Ticker.astro` | Category band becomes navigation: every name is a real link. |
| `src/components/catalog/CatalogueFilters.tsx` | Additionally seeds its search box from `?q=` so the header search lands somewhere useful. |
| `src/components/sections/Hero.test.ts` | Extended for the eyebrow, the supporting line and the counter markup. |
| `src/lib/site-content.ts` | Gains `isPlaceholderNumber`, the one predicate the header's honesty depends on. |
| `tests/e2e/home.spec.ts` | Extended for the supporting line, the header search round trip and the category band. |
| `docs/CONTENT-EDITING.md` | Gains the banner artwork specification an editor needs before uploading. |
| `docs/TRAPS.md` | Gains the `--hero-chrome` arithmetic trap. |

---

### Task 1: Remove the social utility strip and re-seat the header

**Why:** 44px of the first screen is spent on `Follow Spartan` and three
`<span>`s that are not even links (`src/components/layout/UtilityBar.astro`
says so in a comment). It creates the utility-bar → navbar → hero stack of an
older corporate site, and it is the single cheapest vertical win above the fold.

**Files:**
- Delete: `src/components/layout/UtilityBar.astro`
- Modify: `src/components/layout/Header.astro` (import, render, `.site-header--transparent`, header comment)
- Modify: `src/components/sections/Hero.astro` (`--hero-chrome`, `.hero` padding, `@media (max-width: 1180px)` padding)

- [ ] **Step 1: Confirm every reference before deleting**

```bash
grep -rn "UtilityBar\|util--\|util__" src/ tests/ docs/ handoff.md
```

Expected: hits only in `Header.astro` (import + one render + the header
comment), `UtilityBar.astro` itself, and prose in `handoff.md`. **If any
`.astro` file outside `Header.astro` renders it, stop and re-scope this task.**

- [ ] **Step 2: Delete the component and its import**

```bash
git rm src/components/layout/UtilityBar.astro
```

In `src/components/layout/Header.astro` remove the import line:

```astro
import UtilityBar from './UtilityBar.astro';
```

and the render line directly above `<header ...>`:

```astro
<UtilityBar mode={mode} onMedia={onMedia} />
```

- [ ] **Step 3: Re-seat the transparent header at the top of the document**

In `Header.astro`'s `<style>`, replace:

```css
  /* Over a hero: out of flow, clearing the 44px utility bar. */
  .site-header--transparent {
    position: absolute;
    top: 44px;
  }
```

with:

```css
  /* Over a hero: out of flow, at the top of the document.
     Was `top: 44px` to clear a utility bar that carried three decorative
     social marks and nothing else. The bar is gone, so this is 0 and the
     chrome is 86px tall at every width — 84px of nav plus the 2px progress
     rule. `Hero.astro`'s `--hero-chrome` is that number and must move with
     it; see docs/TRAPS.md. */
  .site-header--transparent {
    position: absolute;
    top: 0;
  }
```

- [ ] **Step 4: Update the component header comment so it stops describing a deleted file**

In `Header.astro`, replace the first paragraph of the doc comment:

```
 * `transparent` (default) overlays a dark photographic hero: the utility bar is
 * `position: absolute; top: 0` and this nav is `position: absolute; top: 44px`,
 * so the hero's own padding-top clears them. Neither may sit in normal flow
 * inside a flex hero — they would be treated as flex items and drop to the
 * bottom of the viewport.
```

with:

```
 * `transparent` (default) overlays a hero: this nav is
 * `position: absolute; top: 0`, so the hero's own padding-top clears it. It
 * must not sit in normal flow inside a flex hero — it would be treated as a
 * flex item and drop to the bottom of the viewport.
 *
 * THERE IS NOTHING ABOVE IT ANY MORE. A 44px utility bar used to sit here
 * carrying "Follow Spartan" and three decorative marks that were not links,
 * and it was the first thing on every page. It was removed on 2026-08-29:
 * social profiles are not published, so the strip spent the top of the first
 * screen on content that could not be acted on.
```

- [ ] **Step 5: Re-derive the hero's chrome constant**

In `src/components/sections/Hero.astro`, replace the `--hero-chrome` block:

```css
    /* WHERE THE HEADER CHROME ENDS, and every decoration below starts there.

       The hero runs from y=0 because the utility bar and nav are absolutely
       positioned over it, so without this the dot field and the crop marks ran
       up behind the logo and the nav links. Measured rather than assumed: the
       bar occupies 0 to 44, the nav 44 to 128, and its progress rule 128 to
       130, giving 130px.

       It is the same 130 at every width. Below 820px the utility bar hides,
       but `.site-header--transparent` stays pinned at `top: 44px` on purpose
       (see UtilityBar.astro), so the chrome ends in the same place and one
       constant is correct rather than convenient. */
    --hero-chrome: 130px;
```

with:

```css
    /* WHERE THE HEADER CHROME ENDS, and every decoration below starts there.

       The hero runs from y=0 because the nav is absolutely positioned over it,
       so without this the dot field and the crop marks run up behind the logo
       and the nav links. Measured rather than assumed: the nav occupies 0 to
       84 and its progress rule 84 to 86.

       It was 130 while a 44px utility bar sat above the nav. That bar is gone
       (2026-08-29) and this moved with it. THESE THREE NUMBERS ARE ONE
       ARITHMETIC CHAIN — this constant, `.hero`'s padding-top, and the
       padding-top in the `max-width: 1180px` block below. Changing the
       header's height without changing all three puts the dot field back
       behind the nav, and nothing fails. */
    --hero-chrome: 86px;
```

- [ ] **Step 6: Re-derive both hero paddings from it**

Replace `padding: 152px 0 76px;` on `.hero` with:

```css
    /* 86px of chrome plus 22px of breathing room above the eyebrow — the same
       22px the 152/130 pair carried before the utility bar was removed. */
    padding: 108px 0 76px;
```

and in the `@media (max-width: 1180px)` block replace `padding: 136px 0 64px;`
with:

```css
      /* 86px of chrome plus 8px, matching the tighter 136/128 relationship
         this breakpoint carried before the utility bar was removed. */
      padding: 94px 0 64px;
```

- [ ] **Step 7: Correct every comment in Hero.astro that counts the deleted bar**

```bash
grep -n "utility bar\|44-128\|130px\|0 to 44" src/components/sections/Hero.astro
```

Every hit must describe an 86px chrome. Leave no sentence claiming a bar exists.

- [ ] **Step 8: Typecheck and run the unit suite**

```bash
npm run verify
```

Expected: 18/18, 378 unit tests passing, and `instructional docs name real
paths` still green — no gated doc may name `UtilityBar.astro` after this.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(header): the social utility strip goes, and the hero reclaims 44px"
```

---

### Task 2: Give the header functional scale, and stop publishing a dead phone link

**Why:** feedback §2, §3, §24, §25. The logo renders at 38px and the nav links
at 11px on a 1240px canvas under a 76px headline — the interface reads as
though the browser is zoomed out. And `site.phone` is still
`+971 00 000 0000`, so the most prominent single affordance in the header dials
nothing.

**Files:**
- Modify: `src/lib/site-content.ts`
- Modify: `src/components/layout/Header.astro`
- Create: `src/lib/site-content.phone.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/site-content.phone.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isPlaceholderNumber } from './site-content';

/**
 * The header renders a `tel:` link only when there is a number to dial.
 *
 * `src/data/site.json` still holds the placeholder `+971 00 000 0000`, and a
 * `tel:` link to it is a control that does nothing — the same defect this repo
 * removed from the footer's newsletter field and its three `href="#"` social
 * icons. While the number is a placeholder the header must offer a route that
 * works instead, and the moment a real number lands it must go back to being a
 * phone link with no code change.
 */
describe('isPlaceholderNumber', () => {
  it('treats the shipped placeholder as unset', () => {
    expect(isPlaceholderNumber('+971 00 000 0000')).toBe(true);
  });

  it('treats the real WhatsApp number as set', () => {
    expect(isPlaceholderNumber('+973 3800 0458')).toBe(false);
  });

  it('does not trip on a real number that merely contains zeros', () => {
    expect(isPlaceholderNumber('+973 1234 5067')).toBe(false);
  });

  it('is not fooled by punctuation between the zeros', () => {
    expect(isPlaceholderNumber('+971 (0) 00-000')).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx vitest run src/lib/site-content.phone.test.ts
```

Expected: FAIL — `does not provide an export named 'isPlaceholderNumber'`.

- [ ] **Step 3: Implement the predicate**

Append to `src/lib/site-content.ts`:

```ts
/**
 * True when `site.phone` is still the shipped placeholder rather than a number
 * a buyer can dial.
 *
 * Three or more consecutive zeros in the digits is the test. It is a heuristic
 * and deliberately a loose one: the cost of a false positive is a header that
 * offers "Contact sales" instead of a phone link, and the cost of a false
 * negative is a `tel:` link that dials nothing on all 119 pages. Those are not
 * the same cost.
 *
 * `+971 00 000 0000` -> true. `+973 3800 0458` -> false.
 */
export function isPlaceholderNumber(phone: string): boolean {
  return /0{3,}/.test(phone.replace(/\D/g, ''));
}
```

- [ ] **Step 4: Run the test again**

```bash
npx vitest run src/lib/site-content.phone.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Use it in the header**

In `Header.astro`'s frontmatter, add `isPlaceholderNumber` to the existing
`site-content` import, then replace:

```astro
const telHref = `tel:${site.phone.replace(/[^+\d]/g, '')}`;
```

with:

```astro
/*
 * THE PHONE LINK IS CONDITIONAL, and that is not defensive coding — it is the
 * difference between an affordance and a lie. `site.phone` ships as
 * `+971 00 000 0000`; a `tel:` link to it appears in the header of every page
 * and dials nothing. Until a real number arrives the header offers the contact
 * page, which works. Asserted in src/lib/site-content.phone.test.ts.
 */
const phoneIsReal = !isPlaceholderNumber(site.phone);
const telHref = `tel:${site.phone.replace(/[^+\d]/g, '')}`;
```

Replace the render:

```astro
    <a class="nav__tel" href={telHref}>{site.phone}</a>
```

with:

```astro
    {
      phoneIsReal ? (
        <a class="nav__tel" href={telHref}>
          <span class="nav__tel-label">Sales</span>
          {site.phone}
        </a>
      ) : (
        <a class="nav__tel nav__tel--fallback" href="/contact">
          Contact sales<span class="nav__tel-chev" aria-hidden="true">›</span>
        </a>
      )
    }
```

- [ ] **Step 6: Scale the logo, the nav type and the phone**

In `Header.astro`'s `<style>`, replace the `.nav__logo img` rule:

```css
  .nav__logo img {
    height: 38px;
    width: auto;
  }
```

with:

```css
  /* 48px, up from 38px on 2026-08-29. The lockup was reading as navbar
     metadata beside a 68px headline; the brandmark has to look like it owns
     the page. 48 plus 18 of clear space top and bottom still fits the 84px
     row, so the nav height and every number derived from it are unchanged. */
  .nav__logo img {
    height: 48px;
    width: auto;
  }
```

Replace `font-size: 11px;` inside `.nav__link` with:

```css
    /* 13px, up from 11px. At 11px with 0.16em tracking the primary navigation
       was the smallest type on the page, sitting under the largest. Still
       --fw-label, which the weight scale assigns to anything below 15px. */
    font-size: 13px;
```

Raise `.nav__tel`'s `font-size: 13px;` to `font-size: 14px;` and add after that
rule:

```css
  /* The qualifier that gives the number a job. Feedback: a phone number
     floating alone on the right reads as placeholder content. 11px on
     --text-muted, which is 4.96:1 on --surface-page. */
  .nav__tel-label {
    margin-right: 8px;
    color: var(--text-muted);
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .nav__tel--fallback {
    gap: 6px;
  }

  .nav__tel-chev {
    color: var(--accent);
  }

  .nav__tel--fallback:hover {
    color: var(--accent-text);
  }
```

- [ ] **Step 7: Keep the row on one line at the desktop breakpoint**

The links grew from 11px to 13px, so give the gap back:

```css
  .nav__menu ul {
    display: flex;
    /* 22px, down from 28px. The links grew from 11px to 13px on 2026-08-29;
       the row keeps its total width so the 1080px breakpoint still lands
       where it did. */
    gap: 22px;
    list-style: none;
  }
```

- [ ] **Step 8: Verify**

```bash
npm run verify
```

Expected: 18/18. The unit count rises by 4 — **`npm run counts` is deliberately
deferred to Task 12**, because that block is regenerated from a build once at
the end.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat(header): the interface scales up, and the dead tel: link stands down"
```

---

### Task 3: Put a real search affordance in the header

**Why:** feedback §20. The catalogue has 94 products across 15 categories and a
working search box — on `/catalogue`, below the fold, behind a click. An
industrial buyer who arrives knowing what they want has no route to it from the
header.

**The trade this makes, stated up front.** `CatalogueFilters.tsx` documents a
deliberate decision that filter state is NOT in the URL, because `/catalogue`
is prerendered: a shared `?category=` link would render all 94 products and then
visibly cut down after hydration. That reasoning holds and is not being
overturned for categories — they have canonical pages. It does **not** extend
to a search term, which has no canonical page, and the alternative here is a
header box that throws away what the buyer typed. So `?q=` is the one URL
parameter the island reads, the flash is accepted for it alone, and the
component's comment is amended to say so rather than left contradicting the
code.

**Files:**
- Modify: `src/components/layout/Header.astro`
- Modify: `src/components/catalog/CatalogueFilters.tsx`
- Modify: `tests/e2e/home.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

Append to `tests/e2e/home.spec.ts`:

```ts
test.describe('header search', () => {
  test('carries the typed term through to the catalogue filter', async ({ page }) => {
    await page.goto('/');

    const box = page.locator('.nav__search-input');
    await expect(box).toBeVisible();

    await box.fill('glove');
    await box.press('Enter');

    await page.waitForURL(/\/catalogue\/?\?q=glove/);

    // The island seeds itself from ?q= on mount, so the catalogue's own search
    // field shows the term the buyer typed in the header.
    await expect(page.locator('#cf-search')).toHaveValue('glove');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx playwright test tests/e2e/home.spec.ts -g "header search"
```

Expected: FAIL — `.nav__search-input` does not exist.

**If Docker is down and the e2e stack will not start, record it and continue.
The browser suite is confirmation here, not the only check — and an unrun test
is reported as unrun, never as passed.**

- [ ] **Step 3: Add the form to the header**

In `Header.astro`, between the `</nav>` closing tag and the phone affordance,
insert:

```astro
    {/* A plain GET form, so search works with no JavaScript at all: it lands
        on /catalogue, which server-renders every product. The island there
        reads `?q=` on mount and narrows the list.

        NOT an island itself, and not an inline script. `script-src` here is
        hash-based with no 'unsafe-inline', and `npm run csp` derives hashes
        from `dist/client` — a script added here would work locally and be
        silently blocked in production. */}
    <form class="nav__search" action="/catalogue" method="get" role="search">
      <label class="nav__search-label" for="nav-search">Search products</label>
      <span class="nav__search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="m20 20-3.6-3.6"></path>
        </svg>
      </span>
      <input
        class="nav__search-input"
        id="nav-search"
        name="q"
        type="search"
        placeholder="Search products"
        autocomplete="off"
      />
    </form>
```

- [ ] **Step 4: Style it in the same technical language**

Add to `Header.astro`'s `<style>`:

```css
  /* Square, hairlined, and deliberately not a pill. The site's whole visual
     argument is hard lines; a rounded search field is the one control that
     would make this header look like every other SaaS header. */
  .nav__search {
    position: relative;
    display: flex;
    align-items: center;
    flex-shrink: 1;
    min-width: 0;
  }

  /* Available to a screen reader, not to the eye — a placeholder is not an
     accessible name, and `role="search"` alone does not label the field. */
  .nav__search-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .nav__search-icon {
    position: absolute;
    left: 12px;
    display: grid;
    place-items: center;
    pointer-events: none;
    color: var(--text-muted);
  }

  .nav__search-icon svg {
    width: 15px;
    height: 15px;
  }

  .nav__search-input {
    width: clamp(150px, 16vw, 220px);
    /* WCAG 2.5.5 minimum touch target — do not reduce. */
    min-height: 44px;
    padding: 0 12px 0 34px;
    background: transparent;
    /* A control edge carries meaning, so --line-control (3:1 bar), never the
       decorative --line. Same reasoning as PillButton's outline. */
    border: 1px solid var(--line-control);
    border-radius: 0;
    color: var(--text);
    font-family: var(--font-body);
    font-size: 13px;
    transition: border-color var(--dur-base) var(--ease-out);
  }

  .nav__search-input::placeholder {
    color: var(--text-muted);
  }

  .nav__search-input:hover {
    border-color: var(--text-muted);
  }

  .nav__search-input:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-color: var(--accent);
  }

  /* Below the desktop menu boundary the row is logo + trigger + badge, and the
     search box would take the width the trigger needs. Search stays one tap
     away: the mobile panel links /catalogue, which carries the same field. */
  @media (max-width: 1080px) {
    .nav__search {
      display: none;
    }
  }
```

- [ ] **Step 5: Seed the island from `?q=`**

In `CatalogueFilters.tsx`, replace:

```tsx
  const [query, setQuery] = useState('');
```

with:

```tsx
  /*
   * SEEDED FROM `?q=`, AND `?q=` ONLY.
   *
   * The note above says filter state is not in the URL, and for division and
   * category that still holds — both have real server-rendered addresses, so a
   * query parameter would publish a second URL for content that already has a
   * canonical one.
   *
   * A search term has no such address, and the header's search box has to land
   * somewhere. The alternative was a box that discards what the buyer typed,
   * which is worse than the cost this accepts: /catalogue is prerendered, so
   * the page paints every product and this narrows them on mount. That flash
   * is real. It is the price of search working with JavaScript switched off,
   * and it is paid only by someone who arrived with a term already typed.
   */
  const [query, setQuery] = useState('');

  useEffect(() => {
    const seed = new URLSearchParams(window.location.search).get('q');
    if (seed) setQuery(seed);
  }, []);
```

- [ ] **Step 6: Run the e2e test**

```bash
npx playwright test tests/e2e/home.spec.ts -g "header search"
```

Expected: PASS.

- [ ] **Step 7: Verify and commit**

```bash
npm run verify
```

```bash
git add -A && git commit -m "feat(header): search reaches the catalogue from every page"
```

---

### Task 4: Say what Spartan sells, above the fold

**Why:** feedback §1, §12, §18 — the three highest-impact items in the list.
The hero currently spends its most valuable line on `Est. 2015`, a ten-year-old
founding date that is respectable and not distinctive, and offers no sentence at
all explaining what the company supplies.

**Every fact used here is counted from the catalogue at build time.** No claim
is typed in. `src/pages/index.astro` already does exactly this for its meta
description and its comment explains why.

**Files:**
- Modify: `src/components/sections/Hero.astro`
- Modify: `src/components/sections/Hero.test.ts`
- Modify: `tests/e2e/home.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

Add to `src/components/sections/Hero.test.ts`:

```ts
describe('the proposition', () => {
  it('names both divisions in the eyebrow rather than a founding date', async () => {
    const html = await renderHero();
    expect(html).toContain('Electricals');
    expect(html).toContain('Safety');
    expect(html).not.toContain('Est. 2015');
  });

  it('carries exactly one supporting sentence under the headline', async () => {
    const html = await renderHero();
    expect(countElements(html, 'hero__lede')).toBe(1);
  });

  it('counts the catalogue rather than stating a number', async () => {
    const html = await renderHero();
    // The seeded fixture is not the production catalogue, so a hard-coded 94
    // would fail here — which is exactly what this assertion is for.
    expect(html).toMatch(/\d+ products in \d+ categories/);
  });
});
```

- [ ] **Step 2: Run and watch them fail**

```bash
npx vitest run src/components/sections/Hero.test.ts
```

Expected: FAIL — three failures: `Electricals` absent, `hero__lede` count 0, no
product/category sentence.

- [ ] **Step 3: Read the catalogue in the hero frontmatter**

At the top of `Hero.astro`'s frontmatter, beside the existing `site-content`
import, add:

```astro
import { getCategories, getDivisions, getProducts } from '../../lib/catalog';

/*
 * THE HERO NOW COUNTS THE CATALOGUE, AND IT GOES THROUGH THE SEAM.
 *
 * Rule 3: never `src/data/*`, never `getCollection`. This is the same read
 * `src/pages/index.astro` already performs for its meta description, and for
 * the same reason — the only number on that page that could go stale was a
 * typed one. Both this component and that page are prerendered, so the read
 * happens at build time.
 *
 * Rule 1 is why the sentence says what it says. The feedback this came from
 * proposed "1,000+ PRODUCTS" and "QUALITY ASSURED"; the catalogue holds 94
 * products and there is no source on this machine for a certification claim.
 * A counted number cannot drift into a fabricated one.
 */
const [divisions, categories, products] = await Promise.all([
  getDivisions(),
  getCategories(),
  getProducts(),
]);
```

- [ ] **Step 4: Replace the badge with an eyebrow that carries meaning**

In the template, replace:

```astro
    <div class="hero__crest">
      <div class="hero__badge">
        <span class="hero__badge-est">Est. 2015</span>
      </div>
    </div>
```

with:

```astro
    {/* WAS "Est. 2015" UNTIL 2026-08-29. A founding date ten years back is
        respectable and not a proposition, and it occupied the one line a
        first-time visitor reads before the headline. What replaces it is the
        two division names — the shortest true answer to "what is this
        company?" — read through the catalogue seam, so a third division would
        appear here on its own. */}
    <div class="hero__crest">
      <div class="hero__badge">
        <span class="hero__badge-est">
          {divisions.map((d) => d.name.replace(/^Spartan\s+/, '')).join(' · ')}
        </span>
      </div>
    </div>
```

- [ ] **Step 5: Add the supporting sentence**

Directly after the `.hero__underline` div, insert:

```astro
    {/* THE SENTENCE THE HERO NEVER HAD. Feedback, 2026-08-29: a visitor could
        read the whole first screen without learning what Spartan supplies.
        Every noun here is a real category name and both numbers are counted —
        see the frontmatter. */}
    <p class="hero__lede">
      Lighting, ventilation and water management alongside protective equipment
      and workwear. {products.length} products in {categories.length} categories,
      supplied to contractors and distributors.
    </p>
```

- [ ] **Step 6: Style the eyebrow and the lede**

Change `.hero__badge-est`'s `font-size: 10.5px;` to:

```css
    /* 12px, up from 10.5px. It carries the divisions now rather than four
       characters of date, and it is the first line a visitor reads. */
    font-size: 12px;
```

and add after the `.hero__underline` rule:

```css
  /* One sentence, one measure, and deliberately NOT the display face — the
     hero's job above this line is volume, and its job here is to be read.
     --text-muted is 4.96:1 on --surface-alt. */
  .hero__lede {
    max-width: 62ch;
    margin: 20px auto 0;
    color: var(--text-muted);
    font-family: var(--font-body);
    font-size: clamp(15px, 1.25vw, 17.5px);
    font-weight: var(--fw-body);
    line-height: 1.6;
    text-wrap: balance;
  }
```

- [ ] **Step 7: Run the unit tests**

```bash
npx vitest run src/components/sections/Hero.test.ts
```

Expected: PASS.

- [ ] **Step 8: Add the e2e assertion**

In `tests/e2e/home.spec.ts`, inside the hero describe:

```ts
  test('states what Spartan supplies, with counted numbers', async ({ page }) => {
    await page.goto('/');
    const lede = page.locator('.hero__lede');
    await expect(lede).toBeVisible();
    await expect(lede).toContainText('94 products in 15 categories');
    await expect(page.getByText('Est. 2015')).toHaveCount(0);
  });
```

- [ ] **Step 9: Verify and commit**

```bash
npm run verify
```

```bash
git add -A && git commit -m "feat(hero): the first screen says what Spartan sells"
```

---

### Task 5: One spacing scale, and a headline that stops shouting over the interface

**Why:** feedback §2 and §17. The hero title ceiling is 76px while the nav was
11px; the gaps between headline, stage, controls and CTAs are five separately
tuned numbers (`22`, `26`, `30`, `14`, `28`) that do not belong to a system.

**Files:**
- Modify: `src/components/sections/Hero.astro`

- [ ] **Step 1: Introduce the scale on `.hero`**

Add to the `.hero` rule, under `--hero-chrome`:

```css
    /* THE HERO'S VERTICAL SCALE. Five hand-tuned margins (22/26/30/14/28)
       became five names on a 4px grid, so a relationship can be reasoned about
       rather than nudged. Read top to bottom: gaps tighten as the eye moves
       down inside a group and open between groups.

       Anything that changes one of these must be able to say which group
       boundary it is moving. */
    --hero-gap-tight: 12px;   /* inside a group: rule to lede, band to controls */
    --hero-gap-close: 20px;   /* headline to its own rule */
    --hero-gap-step: 32px;    /* group to group: eyebrow to headline, lede to stage */
    --hero-gap-open: 40px;    /* the stage group to the CTA row */
```

- [ ] **Step 2: Point the existing margins at it**

| Rule | Was | Becomes |
|---|---|---|
| `.hero__title` | `margin: 22px 0 0;` | `margin: var(--hero-gap-step) 0 0;` |
| `.hero__underline` | `margin: 26px auto 0;` | `margin: var(--hero-gap-close) auto 0;` |
| `.hero__lede` (Task 4) | `margin: 20px auto 0;` | `margin: var(--hero-gap-tight) auto 0;` |
| `.hero__stage` | `margin-top: 30px;` | `margin-top: var(--hero-gap-step);` |
| `.hero__controls` | `margin-top: 14px;` | `margin-top: var(--hero-gap-tight);` |
| `.hero__actions` | `margin-top: 28px;` | `margin-top: var(--hero-gap-open);` |

- [ ] **Step 3: Bring the headline ceiling down**

Replace `.hero__title`'s `font-size: clamp(38px, 5.6vw, 76px);` with:

```css
    /* Ceiling 68px, down from 76px on 2026-08-29. The headline was not too big
       in isolation — it was too big relative to a 38px logo and an 11px nav,
       both of which went up in the same pass. 68px is still comfortably "large
       text" for WCAG, so --accent remains legal on it.

       The floor is unchanged: 38px is what the phone was measured at. */
    font-size: clamp(38px, 5.1vw, 68px);
```

- [ ] **Step 4: Leave the short-screen block literal, and say why**

The `@media (max-width: 1180px) and (max-height: 700px)` block hard-codes
margin overrides (`10px`, `12px`, `16px`, `8px`, `16px`). Keep the values and
add above that block:

```css
  /* THE SHORT-SCREEN BLOCK OVERRIDES THE SCALE ABOVE, ON PURPOSE. These are
     not the scale's steps; they are trims measured on a 360x640 to keep the
     CTAs inside a 640px fold. Keep them literal — naming them would imply they
     move with the scale, and they do not. */
```

- [ ] **Step 5: Verify**

```bash
npm run verify
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "refactor(hero): five tuned margins become one vertical scale"
```

---

### Task 6: The carousel controls become one system

**Why:** feedback §7. Three pips on the left and a `PAUSE` label on the far
right do not read as one control. The feedback asks for `01 / 03 ━━━━━ ⏸`,
which is also more informative: it says how many banners there are.

**Three constraints must survive this task** — all documented in `Hero.astro`,
and at least two were bugs once:
1. The pause is a checkbox read by `:has()`, with **no JavaScript**.
2. The accessible name must **start with the visible label text** (`Pause`), or
   it is a 2.5.3 Label in Name failure.
3. Controls sit **below** the artwork, never over it — the banners carry
   near-white strips.

**Files:**
- Modify: `src/components/sections/Hero.astro`
- Modify: `src/components/sections/Hero.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `Hero.test.ts` inside `describe('with banners')`:

```ts
  it('states the position and the total beside the pips', async () => {
    const html = await renderHero();
    expect(countElements(html, 'hero__count')).toBe(1);
    // Three seeded banners, so the total is 03 — zero-padded, and derived.
    expect(html).toMatch(/hero__count-total[^>]*>\s*03\s*</);
  });

  it('keeps the pause control and its label-in-name contract', async () => {
    const html = await renderHero();
    expect(countElements(html, 'hero__pause')).toBe(1);
    expect(html).toMatch(/aria-label="Pause[^"]*"/);
    expect(html).toMatch(/<label[^>]*hero__pause[^>]*>[\s\S]*?Pause[\s\S]*?<\/label>/);
  });
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx vitest run src/components/sections/Hero.test.ts -t "states the position"
```

Expected: FAIL — `hero__count` count is 0.

- [ ] **Step 3: Rebuild the controls row**

Replace the whole `.hero__controls` block in the template with:

```astro
            {/* ONE ROW, ONE SYSTEM. Was three pips hard left and a Pause label
                hard right, which read as two unrelated widgets. Now: a
                counter, the pips as a track, and the pause — reading left to
                right like an instrument.

                STILL BELOW THE BAND, NEVER OVER IT. The banners carry
                near-white footer strips; a white pip on one is invisible, and
                a scrim dark enough to fix that covers the client's own QR code.

                The counter is aria-hidden with the pips: the track is
                decorative and every product in it is a real link further down
                the page. Announcing "01 of 03" would describe a carousel a
                screen reader has already been told to ignore. */}
            <div class="hero__controls">
              <p class="hero__count" aria-hidden="true">
                <span class="hero__count-now">01</span>
                <span class="hero__count-sep">/</span>
                <span class="hero__count-total">
                  {String(BANNERS.length).padStart(2, '0')}
                </span>
              </p>

              <div class="hero__pips" aria-hidden="true">
                {BANNERS.map(() => (
                  <span class="hero__pip" />
                ))}
              </div>

              <label class="hero__pause" for="hero-carousel-pause">
                Pause
              </label>
            </div>
```

- [ ] **Step 4: Make the pips a continuous track and seat the counter**

Replace the `.hero__controls` and `.hero__pips` rules with:

```css
  /* A rail, not three scattered parts: counter, track, control — with the
     track taking the free space so the row reads as one instrument at any
     width. `max-width` matches the frame above it so the two align. */
  .hero__controls {
    display: flex;
    align-items: center;
    gap: 16px;
    max-width: 940px;
    margin: var(--hero-gap-tight) auto 0;
    padding: 0 2px;
  }

  .hero__count {
    display: flex;
    align-items: baseline;
    gap: 4px;
    margin: 0;
    flex-shrink: 0;
    /* Data, not language — a slide index is exactly what --font-mono is for. */
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: var(--fw-label);
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  /* --accent-text, not --accent: 11px is far below the 24px large-text bar,
     and brand red is 4.30:1 on white. Rule 4. */
  .hero__count-now {
    color: var(--accent-text);
  }

  .hero__count-sep {
    opacity: 0.5;
  }

  /* The pips fill the rail rather than clustering at one end. Each is a
     segment of a single line, which is what makes the row read as progress. */
  .hero__pips {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
```

- [ ] **Step 5: Widen each pip without touching the clock**

**Read the existing `.hero__pip` rule first.**

```bash
grep -n -A 20 "\.hero__pip {" src/components/sections/Hero.astro
```

Change only its box — `width` becomes `flex: 1 1 0` plus `min-width: 0` — and
carry every `animation`, `animation-delay` and `:nth-child` declaration across
**verbatim**. The comment at the top of the style block is explicit that the
slide count, the keyframe percentages and the pip delays are one system; this
step changes geometry and must not change timing.

- [ ] **Step 6: Give the pause a matching weight**

Change `.hero__pause`'s `font-size: 11px;` to `font-size: 11.5px;` and add
`flex-shrink: 0;` so it never compresses when the rail is narrow.

- [ ] **Step 7: Run the tests**

```bash
npx vitest run src/components/sections/Hero.test.ts
```

Expected: PASS.

- [ ] **Step 8: Confirm the carousel e2e still holds**

```bash
npx playwright test tests/e2e/hero-carousel.spec.ts
```

Expected: PASS. **If Docker is unavailable, say so — do not report this as
passed.**

- [ ] **Step 9: Verify and commit**

```bash
npm run verify
```

```bash
git add -A && git commit -m "feat(hero): the carousel controls read as one instrument"
```

---

### Task 7: Frame the banner, and let the dot field breathe around it

**Why:** feedback §6 and §10. The banner is dynamic, so the surrounding
interface is what makes it feel intentional rather than pasted in; and the 22px
dot field currently runs at full strength straight behind the artwork.

**Files:**
- Modify: `src/components/sections/Hero.astro`

- [ ] **Step 1: Add the frame label**

Directly inside `.hero__stage`, before the `<figure>`, insert:

```astro
            {/* The frame's own label. It is what turns a dropped-in image into
                a slot the design owns — the same move as the counter below.
                Decorative: it describes the module, not the artwork, and the
                artwork itself is already aria-hidden. */}
            <p class="hero__frame-label" aria-hidden="true">Featured</p>
```

- [ ] **Step 2: Style the label and tighten the frame**

```css
  /* Sits on the frame's top-left corner, in the technical register the crop
     marks and the counter already speak. */
  .hero__frame-label {
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 940px;
    margin: 0 auto 8px;
    font-family: var(--font-mono);
    font-size: 10.5px;
    font-weight: var(--fw-label);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .hero__frame-label::after {
    content: '';
    flex: 1 1 auto;
    height: 1px;
    background: var(--line);
  }
```

and on `.hero__frame`, add:

```css
    /* 2px, and not one more. The rectangle is the design's argument; this is
       just enough to stop the corner reading as a clipping error. The feedback
       is explicit that big rounded SaaS cards would make this worse. */
    border: 1px solid var(--line);
    border-radius: 2px;
```

- [ ] **Step 3: Fade the dot field behind the stage**

**Read the existing `.hero__grid` rule and its `mask-image` first.**

```bash
grep -n -A 30 "\.hero__grid {" src/components/sections/Hero.astro
```

Append a radial layer to the existing `mask-image` list rather than replacing
it, and composite the two:

```css
    /* THREE ZONES, per the feedback: full strength at the outer canvas, softer
       through the hero copy, faintest immediately around the banner. The dots
       are the brand's engineering register and they were competing with the
       artwork they sit behind.

       Appended to the existing linear mask, not replacing it —
       `mask-composite: intersect` multiplies the two, so the top-of-hero fade
       this already had is preserved. */
    mask-image:
      /* ...the existing linear-gradient stays exactly as it is... */,
      radial-gradient(
        120% 60% at 50% 62%,
        rgba(0, 0, 0, 0.25) 0%,
        rgba(0, 0, 0, 0.6) 45%,
        rgba(0, 0, 0, 1) 75%
      );
    mask-composite: intersect;
```

- [ ] **Step 4: Verify and commit**

```bash
npm run verify
```

```bash
git add -A && git commit -m "feat(hero): the banner gets a frame and the dot field gets out of its way"
```

---

### Task 8: Give both CTAs authority

**Why:** feedback §8. After a 68px headline and a full-width banner the user
reaches a 13.5px button with 14px of vertical padding. The two primary business
actions are the smallest interactive elements above the fold.

`SolidButton` and `PillButton` are shared across the site, so the size goes in
the hero's own override block — where the hero already overrides `.pill`.

**Files:**
- Modify: `src/components/sections/Hero.astro`

- [ ] **Step 1: Find the existing override**

```bash
grep -n "hero__actions" src/components/sections/Hero.astro
```

Note the existing `.hero__actions :global(.pill)` rule — it already sets
`padding: 14px 24px` and `font-size: 13.5px`.

- [ ] **Step 2: Scale both buttons in the hero only**

```css
  /* THE HERO'S BUTTONS ARE BIGGER THAN THE SITE'S, and only here. After a 68px
     headline and a full-bleed banner, the default 13.5px/14px CTA reads as a
     footnote — but the same button in a card grid does not have that problem,
     so this is a hero override rather than a change to the primitives.

     The primitives' 44px minimum target is cleared by construction: 15px of
     type plus 18px of padding top and bottom is 51px. */
  .hero__actions :global(.solid) {
    padding: 18px 34px;
    font-size: 15px;
    letter-spacing: 0.05em;
  }

  .hero__actions :global(.pill) {
    padding: 17px 30px;
    font-size: 14.5px;
  }
```

- [ ] **Step 3: Open the gap between them**

Change `.hero__actions`'s `gap: 14px;` to `gap: 16px;`.

- [ ] **Step 4: Re-check the short-screen fold**

The `(max-width: 1180px) and (max-height: 700px)` block exists because the CTAs
must stay inside a 640px fold on a 360x640 phone. Taller buttons eat into that,
so add to that block:

```css
    /* The hero CTAs grew on 2026-08-29; on a 640px fold they hand back the
       extra padding rather than the fold handing back the buttons. */
    .hero__actions :global(.solid),
    .hero__actions :global(.pill) {
      padding-block: 13px;
    }
```

- [ ] **Step 5: Confirm the crop marks still clear them**

```bash
npx playwright test tests/e2e/hero-marks.spec.ts tests/e2e/hero-mobile.spec.ts
```

Expected: PASS — these tests exist precisely because the client once found the
decorative marks landing on the CTAs. **If Docker is unavailable, this is
unverified and must be reported as unverified.**

- [ ] **Step 6: Verify and commit**

```bash
npm run verify
```

```bash
git add -A && git commit -m "feat(hero): the two business actions get the weight they earn"
```

---

### Task 9: The category band becomes navigation

**Why:** feedback §14. Fifteen category names scroll past in a red band and
none of them can be clicked. It is the most direct expression of the
catalogue's breadth on the page, and it is currently decoration.

**The accessibility constraint that shapes the whole task.** The track is
duplicated to make the loop seamless, and every copy is currently
`aria-hidden`. Links cannot simply be dropped in: a focusable element inside
`aria-hidden` is a violation in its own right. So **one copy becomes real
navigation and every duplicate keeps `aria-hidden` plus `tabindex="-1"` on its
anchors**, which removes them from both the accessibility tree and the tab
order.

**Files:**
- Modify: `src/components/sections/Ticker.astro`
- Modify: `tests/e2e/home.spec.ts`

- [ ] **Step 1: Write the failing e2e tests**

```ts
test.describe('category band', () => {
  test('every category is a link, and only one copy is reachable', async ({ page }) => {
    await page.goto('/');

    const reachable = page.locator('.ticker a:not([tabindex="-1"])');
    await expect(reachable).toHaveCount(15);

    const href = await reachable.first().getAttribute('href');
    expect(href).toMatch(/^\/catalogue\/[a-z0-9-]+$/);
  });

  test('pauses under the pointer so a name can be read and clicked', async ({ page }) => {
    await page.goto('/');
    const track = page.locator('.ticker__track');
    await page.locator('.ticker').hover();
    await expect(track).toHaveCSS('animation-play-state', 'paused');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx playwright test tests/e2e/home.spec.ts -g "category band"
```

Expected: FAIL — zero anchors inside `.ticker`.

- [ ] **Step 3: Build a shelf of links instead of a joined string**

In `Ticker.astro`'s frontmatter, replace:

```astro
const text = categories.map((c) => c.name).join(' · ') + ' · ';
const copy = text.repeat(2);
```

with:

```astro
/*
 * FOUR COPIES, AND EXACTLY ONE OF THEM IS REACHABLE.
 *
 * The loop is seamless only while the track is at least twice the viewport —
 * it translates by exactly half of itself — and that reasoning is unchanged
 * from the two-span version this replaces. What changed on 2026-08-29 is that
 * the names are links now, and duplication stopped being a rendering detail
 * and became an accessibility problem: four copies of fifteen links is sixty
 * tab stops for one shelf.
 *
 * So the first set is the real navigation, and every other anchor carries
 * `tabindex="-1"` inside an `aria-hidden` container — out of the tab order and
 * out of the accessibility tree, present only to make the pixels loop.
 */
const shelf = categories.map((c) => ({ name: c.name, href: `/catalogue/${c.slug}` }));
```

- [ ] **Step 4: Rewrite the markup**

Replace the two `<span>{copy}</span>` lines with:

```astro
  <div class="ticker__track">
    <nav class="ticker__set" aria-label="Product categories">
      {shelf.map((c) => (
        <a class="ticker__item" href={c.href}>{c.name}</a>
      ))}
    </nav>

    {[0, 1, 2].map(() => (
      <div class="ticker__set" aria-hidden="true">
        {shelf.map((c) => (
          <a class="ticker__item" href={c.href} tabindex="-1">{c.name}</a>
        ))}
      </div>
    ))}
  </div>
```

**Note the track itself is no longer `aria-hidden`** — it cannot be, now that
it contains the real navigation. Update the comment above the pause control,
which currently justifies its `aria-label` on the basis that the track is
hidden:

```astro
  <!-- The band is real navigation now, so "Pause" has a visible referent. The
       aria-label still restates what is being paused, and it still has to
       START with the visible label text ("Pause") or the mismatch is itself a
       2.5.3 Label in Name failure. -->
```

- [ ] **Step 5: Style the items and keep the separator**

Replace the `.ticker__track span` rule with:

```css
  .ticker__set {
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }

  .ticker__item {
    display: inline-flex;
    align-items: center;
    /* WCAG 2.5.5: the band is 46.8px tall and the link fills it. */
    min-height: 44px;
    padding: 0 18px;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: var(--fw-label);
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #fff;
    white-space: nowrap;
    text-decoration: none;
    transition:
      background var(--dur-fast) var(--ease-out),
      color var(--dur-fast) var(--ease-out);
  }

  /* The separator the joined string used to carry, as a pseudo-element so it
     belongs to the layout rather than to the text. */
  .ticker__item::after {
    content: '·';
    margin-left: 18px;
    opacity: 0.55;
  }

  /* Inversion on hover, per the feedback: the hovered category reads as
     selected rather than merely underlined. --accent-text on #fff is 9.07:1
     (handoff.md §3 measures 8.40:1 against --color-paper, a darker surface;
     this button sits on pure white). */
  .ticker__item:hover,
  .ticker__item:focus-visible {
    background: #fff;
    color: var(--accent-text);
  }

  .ticker__item:hover::after,
  .ticker__item:focus-visible::after {
    opacity: 0;
  }

  /* Inset, like the pause button's: the band clips with `overflow: hidden`, so
     an outward offset puts the ring outside the clip region. */
  .ticker__item:focus-visible {
    outline: 2px solid var(--color-red-dark);
    outline-offset: -2px;
  }
```

- [ ] **Step 6: Pause under the pointer**

Add beside the existing `:has(:checked)` pause rule:

```css
  /* HOVER PAUSES THE BAND. Without this the links are a moving target — a
     buyer reaching for "Hand Protection" clicks "Safety Footwear". It is also
     a second WCAG 2.2.2 mechanism for anyone with a pointer, on top of the
     checkbox.

     `:focus-within` is the keyboard's equivalent: tabbing into the band stops
     it, so the focused link does not travel out from under the focus ring. */
  .ticker:hover .ticker__track,
  .ticker:focus-within .ticker__track {
    animation-play-state: paused;
  }
```

- [ ] **Step 7: Confirm the clock is unchanged**

```bash
grep -n "84s\|ticker-run\|translateX(-50%)" src/components/sections/Ticker.astro
```

The track was two spans of two copies; it is now four sets of one. Total width
and the `-50%` translation are unchanged, so `84s` stays and the traversal stays
inside the 25–40s band the feedback asks for. **Write that in a comment beside
the animation** rather than leaving it to be rediscovered.

- [ ] **Step 8: Run the tests**

```bash
npx playwright test tests/e2e/home.spec.ts -g "category band"
npx playwright test tests/e2e/a11y.spec.ts
```

Expected: PASS. **Report honestly if Docker blocks these.**

- [ ] **Step 9: Verify and commit**

```bash
npm run verify
```

```bash
git add -A && git commit -m "feat(ticker): the category band becomes navigation"
```

---

### Task 10: Write the banner artwork specification down

**Why:** feedback §13. Every banner is uploaded by a non-developer through
`/admin/banners`, and the upload validator enforces geometry but says nothing
about legibility. The screenshot in the feedback shows product labels already
close to unreadable at desktop size.

This task ships documentation and no behaviour, and that is correct: the rules
are editorial judgements a validator cannot check.

**Files:**
- Modify: `docs/CONTENT-EDITING.md`
- Modify: `docs/TRAPS.md`

- [ ] **Step 1: Confirm the enforced constraints before writing about them**

```bash
grep -rn "3.8\|4.2\|1400\|aspect" src/lib/admin/
```

Write only what the code actually enforces. Everything else is guidance, and
the section must say which is which.

- [ ] **Step 2: Add the specification to `docs/CONTENT-EDITING.md`**

```markdown
## Hero banner artwork

The hero band is 4:1 and nearly full-width on a desktop screen; on a phone it is
the same artwork at roughly a third of that width. That second fact is the one
that catches people out — type that is comfortable in the design file is
unreadable on the device most buyers arrive on.

**What the uploader enforces, and will reject:**

- JPEG or PNG
- aspect ratio between 3.8:1 and 4.2:1
- at least 1400px wide

**What it cannot enforce, and you have to hold to:**

- **Master size 2800 x 700.** Anything smaller gets upscaled by the build.
- **8% safe margin on all four sides.** The band is cropped at narrow widths.
- **No text below 28px in the master.** At 2800px wide that is about 11px on a
  1240px screen and about 6px on a phone. 6px is not small — it is absent.
- **At most four product groups.** Five is a contact sheet, not a banner.
- **No body copy at all.** A banner is a headline, a product and a mark.
- **A new banner arrives hidden.** Look at it on a phone before switching it
  on; that is what the hidden state is for.

**Check the facts before you upload, not after.** A banner is artwork to the
uploader and a product claim to a buyer. Two posters were withdrawn from this
site for printing a protection rating the product does not carry. Nothing in
the code can catch that.
```

- [ ] **Step 3: Add the arithmetic trap to `docs/TRAPS.md`**

```markdown
## The hero's top padding is arithmetic, not taste

`src/components/sections/Hero.astro` carries `--hero-chrome`, a `padding-top`
on `.hero`, and a second `padding-top` in its `max-width: 1180px` block. All
three derive from the height of the absolutely positioned header — 84px of nav
plus its 2px progress rule, 86px — and nothing connects them but this sentence.

Change the header's height and the dot field paints behind the nav, the crop
marks climb into the logo, and every gate stays green: nothing here resolves a
rendered background against a rendered header. `npm run verify` will not save
you and neither will `astro check`.

It has already moved once. It was 130px while a 44px utility bar sat above the
nav; that bar was removed on 2026-08-29 and all three numbers moved together.
```

- [ ] **Step 4: Verify the doc-path gate still passes**

```bash
npm run verify
```

Expected: `instructional docs name real paths` green — `docs/TRAPS.md` is in
the gated set, so every backticked repo path added above must resolve.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "docs: the banner specification an uploader needs, and the hero's arithmetic trap"
```

---

### Task 11: Spend red more carefully

**Why:** feedback §16. Red is the headline accent, the crest rules, the crop
ticks, the primary CTA, the ticker, the trust band and the logo. When
everything is red, the button is not.

This is a **reduction**, and it touches only decoration — never a control,
never a token, never a contrast pairing. Rule 4 stands: any pairing that
changes gets measured, and `handoff.md` §3 holds the ratios.

**Files:**
- Modify: `src/components/sections/Hero.astro`

- [ ] **Step 1: Inventory red above the fold**

```bash
grep -n "accent\|--color-red" src/components/sections/Hero.astro
```

List every hit and mark it `control`, `brand` or `decoration`.

- [ ] **Step 2: Demote decoration only**

The two edge ticks are decoration by their own comment. Take them to the line
token:

```css
  /* Was --accent. Two red ticks at the hero's edges were competing with the
     one red thing on this screen a visitor is meant to act on. The marks are a
     register; the CTA is the signal. */
  .hero__tick {
    background: var(--line-control);
  }
```

**Leave `.hero__crest`'s rules, the headline's red span and both CTAs alone.**
Those are brand and action respectively, and the feedback explicitly wants the
red headline treatment kept.

- [ ] **Step 3: Verify and commit**

```bash
npm run verify
```

```bash
git add -A && git commit -m "refactor(hero): red goes back to meaning action"
```

---

### Task 12: Verify, preview, and write the decisions down

**Why:** the user has asked to see a browser preview before anything is pushed,
and this repo's standard is that the reasoning survives the conversation.

**Files:**
- Modify: `handoff.md` (new section, appended after §37)
- Modify: `BACKLOG.md`
- Modify: `CLAUDE.md` and `AGENTS.md` (counts block only, via `npm run counts`)

- [ ] **Step 1: Full gate**

```bash
npm run verify
```

Expected: 18/18.

- [ ] **Step 2: Regenerate the counts block from a real build**

```bash
npm run counts
```

then mirror it:

```bash
cp CLAUDE.md AGENTS.md
```

**Never edit a digit inside the counts block by hand** — `CLAUDE.md` says so and
a gate checks it.

- [ ] **Step 3: Browser preview**

```bash
npm run build
```

Serve it and open the home page in the preview pane. Check at 1440 wide and at
390 wide, by screenshot and by `read_page`:

- the header has no strip above it
- the logo reads as the brand, not as metadata
- the search box is present and focusable
- the eyebrow names both divisions and `Est. 2015` is gone
- one sentence sits under the headline with counted numbers
- the controls row reads `01 / 03 ━━━━ Pause`
- the CTAs are the largest interactive things above the fold
- the category band pauses under the pointer and its names are links

- [ ] **Step 4: Record the decisions in `handoff.md`**

Append a new numbered section after §37 covering: the three business decisions
taken in this plan's preamble and who owns reversing them; the utility bar
removal and the arithmetic that moved with it; the `?q=` exception to
`CatalogueFilters`' no-URL-state rule and why it is bounded to search; the
ticker's aria-hidden/tabindex split; and what was refused under rule 1, with the
number that refutes it (94, not 1,000+).

- [ ] **Step 5: Add the open client decisions to `BACKLOG.md`**

Under P1:

```markdown
- [ ] **Sign off or replace the hero headline.** The 2026-08-29 design pass kept
      `Home and industrial solutions.` because it is the client's line and
      `tests/e2e/home.spec.ts` pins it, and fixed the underlying complaint — a
      visitor could not tell what Spartan sells — with the eyebrow and the
      supporting sentence instead. The reviewed alternative was
      `BUILT FOR THE JOB. / READY FOR INDUSTRY.` **This is a client decision,
      not a developer one.** Changing it is one line in `Hero.astro` and one
      assertion in `tests/e2e/home.spec.ts`.

- [ ] **Decide whether `Categories` should read `Products`.** Feedback,
      2026-08-29. The client asked for the single `Categories` item on
      2026-08-17, so this is theirs to reverse. The dropdown already renders
      both divisions and all fifteen real categories from the catalogue seam;
      only the label is in question.

- [ ] **Decide whether `Browse catalogue` should read `Browse products`.** Kept
      as-is in the 2026-08-29 pass for consistency with `/catalogue`, the nav
      panel's "View the full catalogue" and the breadcrumbs — changing one of
      four labels buys hero clarity at the cost of consistency. One word in
      `Hero.astro`.
```

Under P0, beside the existing contact-details blocker:

```markdown
- [ ] **The header phone link is now conditional, which hides the blocker.**
      Since 2026-08-29 the header renders `Contact sales ›` while `site.phone`
      is the `+971 00 000 0000` placeholder, and reverts to a real `tel:` link
      the moment a number is supplied — `isPlaceholderNumber` in
      `src/lib/site-content.ts`. **The number is still unset.** This made the
      site honest, not complete.
```

- [ ] **Step 6: Do NOT commit or push**

The user has asked to see the preview before anything reaches the live site.
Leave the work in the working tree, report what is green and what is unverified,
and hand over.

---

## Self-Review

**Spec coverage.** Feedback items and where they land: §1 → Task 4 + BACKLOG ·
§2 → Tasks 2, 5 · §3 → Tasks 1, 2, 3 · §4 → Task 1 · §5 → no change (already
correct) · §6 → Task 7 · §7 → Task 6 · §8 → Task 8 · §9 → decision, recorded ·
§10 → Task 7 · §11 → Tasks 6, 7 (the counter and the frame label give the marks
a system to belong to) · §12 → Task 4 · §13 → Task 10 · §14 → Task 9 · §15 → no
change (already 84s) · §16 → Task 11 · §17 → Task 5 · §18 → Task 4 · §19 →
refused, BACKLOG · §20 → Task 3 · §21 → refused under rule 1, reasons stated ·
§22 → no change (already product-first) · §23 → held throughout; no card is
introduced · §24 → Task 2 · §25 → Task 2 · §26 → the whole plan · §27 → the
whole plan · §28 → the task order follows its priority table, except that the
P0 "improve hero proposition" is split into the part a developer owns (Task 4)
and the part the client owns (BACKLOG).

**Placeholder scan.** No TBD, no "add error handling", no "similar to Task N".
Three steps say "read the existing rule before editing and carry X across
verbatim" — that is an instruction to read specific named declarations, not a
placeholder. It exists because those declarations are the carousel clock and
the grid mask, both load-bearing and both longer than is worth transcribing
incorrectly.

**Type consistency.** `isPlaceholderNumber` is defined in Task 2 Step 3 and
used in Task 2 Step 5 and Task 12 Step 5 under the same name and signature.
`--hero-chrome`, `--hero-gap-tight`, `--hero-gap-close`, `--hero-gap-step` and
`--hero-gap-open` are defined in Tasks 1 and 5 and consumed in Tasks 5, 6 and 7
under those exact names. `.hero__lede`, `.hero__count`, `.hero__frame-label`,
`.nav__search-input`, `.ticker__item` and `.ticker__set` each appear first in
the task that creates them and are unchanged thereafter.

**One gap, named rather than hidden.** Tasks 3, 6, 8 and 9 lean on Playwright
for their strongest assertions, and `handoff.md` §36 records that Docker has not
started on this machine since 2026-08-23. If it is still down, those tests
cannot run locally and the honest report is "unverified", not "passed". CI runs
`--full` on every push, so the browser suite is one push away — but a push is
exactly what the user has withheld until they have seen the preview.
