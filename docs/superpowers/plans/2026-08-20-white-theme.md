# White Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invert the public site from dark-first to white, behind a semantic surface-token layer, without letting a single sub-4.5:1 grey survive the move.

**Architecture:** A semantic layer (`--surface-*`, `--text-*`, `--line*`, `--accent*`) is added to `src/styles/tokens.css` on top of the existing palette, which keeps its current meanings so `src/styles/admin.css` is untouched. Public components stop naming raw colours. The dark footer becomes an `.on-dark` block that re-points the same semantic names. Three new static gates — a token-ratio test, a banned-token sweep and a crop-mark collision test — catch the failures that `astro check` and `npm run build` both pass silently.

**Tech Stack:** Astro 7, TypeScript strict, Tailwind 4, Preact islands, Vitest, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-08-20-white-theme-design.md`

---

## Read first

- `docs/TRAPS.md` — before touching any area for the first time.
- `CLAUDE.md` §"Four rules" — rule 3 (the admin seam) and rule 4 (colour is measured) both apply throughout. Rule 1 does not: no product data is touched by any task here.
- **Never weaken a gate to make it pass.**

## File structure

**Created:**

| File | Responsibility |
|---|---|
| `src/styles/tokens.test.ts` | Parses `tokens.css`, computes every declared foreground/background pair, asserts each clears its WCAG bar. The static half of rule 4. |
| `src/styles/theme-sweep.test.ts` | Sweeps public-site sources for banned tokens (`--color-grey-lt`, bare `#fff` as a text colour) and for leftover `.on-light`. Catches hazards 1 and 3 from the spec. |
| `tests/e2e/hero-marks.spec.ts` | Asserts crop marks never intersect a CTA, at 375 / 768 / 1280. |

**Modified (public site only — no file under `src/pages/admin`, `src/components/admin` or `src/styles/admin.css` is touched by any task):**

`src/styles/tokens.css` · `src/styles/global.css` · `src/styles/enquiry.css` · `src/components/primitives/{PillButton,SolidButton,Eyebrow,SectionHeading}.astro` · `src/components/layout/{Header,UtilityBar,Footer,MobileNav.tsx}` · `src/components/sections/*.astro` (11 files) · `src/components/catalog/*.astro` (7 files) · `src/pages/{index,about,contact,industries,why-spartan,enquiry,404}.astro` · `src/pages/catalogue/{index,[category]}.astro` · `src/pages/products/[slug].astro` · `tests/e2e/contrast.spec.ts` · `handoff.md` · `docs/TRAPS.md` · `vercel.json`

---

## Task 1: The semantic token layer, with a static contrast gate

The gate comes first, because the tokens are worthless if nothing checks them.

**Files:**
- Create: `src/styles/tokens.test.ts`
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Write the failing test**

Create `src/styles/tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The static half of rule 4.
 *
 * `tests/e2e/contrast.spec.ts` measures what actually rendered, which is the
 * stronger check but needs a browser, a build and a selector list. This one
 * needs none of those: it reads the declared token values and asserts that
 * every pair the design commits to clears its bar. It cannot know a token was
 * used in the wrong place — that is the e2e spec's job — but it does mean a
 * token can never be *defined* at a failing value, which is where a
 * hand-tweaked hex would otherwise slip in.
 */
const CSS = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

function token(name: string): string {
  const m = CSS.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!m) throw new Error(`token --${name} is not declared in tokens.css`);
  return m[1];
}

function rgb(hex: string): number[] {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = [...h].map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** sRGB relative luminance, WCAG 2.x §relative-luminance. */
function luminance(hex: string): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/**
 * bar 4.5 = normal-size text. bar 3 = large text (>=24px, or >=18.66px bold)
 * and non-text UI boundaries that carry meaning.
 */
const PAIRS = [
  { fg: 'text', bg: 'surface-page', bar: 4.5 },
  { fg: 'text', bg: 'surface-alt', bar: 4.5 },
  { fg: 'text-muted', bg: 'surface-page', bar: 4.5 },
  { fg: 'text-muted', bg: 'surface-alt', bar: 4.5 },
  { fg: 'accent-text', bg: 'surface-page', bar: 4.5 },
  { fg: 'accent-text', bg: 'surface-alt', bar: 4.5 },
  { fg: 'accent', bg: 'surface-page', bar: 3 },
  { fg: 'accent', bg: 'surface-alt', bar: 3 },
  { fg: 'line-control', bg: 'surface-page', bar: 3 },
  { fg: 'line-control', bg: 'surface-alt', bar: 3 },
];

describe('semantic token contrast', () => {
  for (const { fg, bg, bar } of PAIRS) {
    it(`--${fg} on --${bg} clears ${bar}:1`, () => {
      const actual = ratio(token(fg), token(bg));
      expect(
        actual,
        `--${fg} ${token(fg)} on --${bg} ${token(bg)} = ${actual.toFixed(2)}:1, needs ${bar}:1`,
      ).toBeGreaterThanOrEqual(bar);
    });
  }

  it('--accent is NOT valid for normal-size text, which is why --accent-text exists', () => {
    // Guards the distinction rather than the value. If someone "fixes" --accent
    // to clear 4.5:1 they have changed the brand red, and this should stop them
    // and make them say so out loud.
    expect(ratio(token('accent'), token('surface-page'))).toBeLessThan(4.5);
  });

  it('white text on --accent-fill clears 4.5:1', () => {
    expect(ratio('#ffffff', token('accent-fill'))).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/styles/tokens.test.ts
```

Expected: FAIL — `token --text is not declared in tokens.css`.

- [ ] **Step 3: Add the semantic layer**

Append to the `:root` block in `src/styles/tokens.css`, immediately before the closing brace, after the `--fw-body` line:

```css
  /* ---------------------------------------------------------------------
     THE SEMANTIC SURFACE LAYER — added 2026-08-20 with the white theme.
     See docs/superpowers/specs/2026-08-20-white-theme-design.md.

     Everything above this comment is the PALETTE and keeps the meaning it
     has always had: --color-black is black. Nothing above was re-pointed,
     which is the only reason src/styles/admin.css needed no edit at all.

     Everything below is a JOB. Public components name jobs, never colours.
     The site is light, so these default to light; `.on-dark` in global.css
     re-points the same ten names at the dark palette and is the only place
     on the public site that does.

     Ratios are asserted by src/styles/tokens.test.ts, not by comment.
     --------------------------------------------------------------------- */
  --surface-page: #ffffff;
  --surface-alt: #f6f6f7;
  /* Same value as --surface-page today, and deliberately NOT the same token.
     A card is raised whether it sits on a white band or a grey one — the
     separation comes from the hairline, not the fill. Keeping the name
     distinct is what lets a card gain a tint later without hunting every
     white in the codebase again. */
  --surface-raised: #ffffff;

  /* Decorative separators. 1.27:1 and that is correct: WCAG's 3:1 non-text
     bar covers boundaries that convey information or state, not hairlines
     between bands. */
  --line: #e4e4e7;
  /* Boundaries that DO carry meaning — input, select and checkbox edges.
     This is --color-grey, demoted: it was never a legal muted-text colour
     on light (3.43:1 against a 4.5:1 bar) but it is a good control edge
     against a 3:1 one. */
  --line-control: #8a8a92;

  --text: #0e0e11;
  --text-muted: #6a6a72;

  /* Small red text. */
  --accent-text: #970000;
  /* Brand red: display type, rules, icons, focus rings. 4.30:1 on white —
     LARGE TEXT ONLY. Never set this on anything under 24px. */
  --accent: #eb2927;
  /* Red surfaces carrying white text. */
  --accent-fill: #dd1e1c;
```

- [ ] **Step 4: Run it to verify it passes**

```bash
npx vitest run src/styles/tokens.test.ts
```

Expected: PASS, 12 tests (ten pairs plus two guards).

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/tokens.test.ts
git commit -m "feat(tokens): a semantic surface layer, gated by measured ratios"
```

---

## Task 2: Flip the page, and rename `.on-light` to `.on-dark`

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/sections/Faq.astro:41`, `src/components/sections/ServiceCards.astro:65`, `src/pages/about.astro:144`, `src/pages/why-spartan.astro:92`
- Modify: `src/components/primitives/PillButton.astro`, `src/components/primitives/SectionHeading.astro`

- [ ] **Step 1: Flip the body and invert the helper**

In `src/styles/global.css`, replace the `body` rule:

```css
body {
  font-family: var(--font-body);
  background: var(--surface-page);
  color: var(--text);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
```

Replace the `.on-light .text-brand` rule and its comment with:

```css
/* THIS BLOCK INVERTED ON 2026-08-20 AND THE RENAME IS THE POINT.
   It was `.on-light`, the narrow exception on a dark-first site. The site is
   light now, so the exception is darkness: `.on-dark` re-points the semantic
   layer at the palette's dark values. A leftover `.on-light` would apply
   light-surface rules inside the dark footer and nothing would fail. */
.on-dark {
  --surface-page: var(--color-black);
  --surface-alt: var(--color-panel);
  --surface-raised: var(--color-card);
  --line: var(--color-line);
  --line-control: var(--color-grey);
  --text: #fff;
  --text-muted: var(--color-grey);
  --accent-text: var(--color-red-light);
  --accent: var(--color-red);
  --accent-fill: var(--color-red-fill);

  background: var(--surface-page);
  color: var(--text);
}
```

Update the focus ring to use the semantic name:

```css
:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
```

- [ ] **Step 2: Rename the four section usages**

In each of these, change the class `on-light` to nothing at all — light is now the default and the class is redundant:

- `src/components/sections/Faq.astro:41` — `<section class="faq on-light">` becomes `<section class="faq">`
- `src/components/sections/ServiceCards.astro:65` — `<section class="services on-light">` becomes `<section class="services">`
- `src/pages/about.astro:144` — `<section class="dv on-light">` becomes `<section class="dv">`
- `src/pages/why-spartan.astro:92` — `<section class="rs on-light">` becomes `<section class="rs">`

In `src/components/sections/ServiceCards.astro`, the comment at line 10 says "This is a LIGHT section, so it carries `on-light` and every primitive inside". Replace it with:

```
 * This was a light section on a dark site and carried `on-light`. The whole
 * site is light now, so the class is gone and the primitives inside need no
 * variant — see the white-theme spec, 2026-08-20.
```

- [ ] **Step 3: Make the light variant the default in the two primitives**

In `src/components/primitives/PillButton.astro`, the base `.pill` border is `rgba(255, 255, 255, 0.32)` — invisible on white. Swap the base and the variant:

```css
  .pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    background: transparent;
    color: inherit;
    /* Light is the default surface now. The old base was a white border at
       0.32 alpha, which on white is nothing at all. */
    border: 1px solid var(--line-control);
    border-radius: 999px;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 13px;
    font-weight: 500;
    padding: 11px 20px;
    /* WCAG 2.5.5 minimum touch target — do not reduce. */
    min-height: 44px;
    transition:
      border-color var(--dur-base) var(--ease-out),
      background var(--dur-base) var(--ease-out);
  }

  .pill:hover {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }

  .pill .chev {
    color: var(--accent);
    font-weight: var(--fw-label);
  }
```

Delete the `.pill--on-light` and `.pill--on-light:hover` blocks entirely, and remove `{ 'pill--on-light': onLight }` from the `class:list` at line 49. Leave the `onLight` prop in the interface **only if** other files pass it — check with `grep -rn "onLight" src` and remove the prop and every call site if it is now unused.

In `src/components/primitives/SectionHeading.astro`, do the same: delete the `.sec--on-light p` block and the `'sec--on-light': onLight` entry, and make the base `p` colour `var(--text-muted)`.

- [ ] **Step 4: Verify nothing references the old names**

```bash
grep -rn "on-light\|onLight" src
```

Expected: no output.

- [ ] **Step 5: Typecheck and commit**

```bash
npx astro check
git add src/styles/global.css src/components src/pages
git commit -m "refactor(theme): light is the default, darkness is the exception"
```

---

## Task 3: The banned-token sweep

The spec's largest hazard is a missed grey. 80 public-site usages, no gate. This is that gate, and it must exist **before** the bulk recolour so it guides it rather than grading it.

**Files:**
- Create: `src/styles/theme-sweep.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The white theme's silent-failure gate.
 *
 * `--color-grey` and `--color-grey-lt` were tuned for dark surfaces. On the
 * light site they measure 3.43:1 and 2.06:1, and almost every one of their 80
 * public-site usages was normal-size text needing 4.5:1. Carried across
 * unchanged they render grey-on-white that looks approximately fine to anyone
 * not measuring, and astro check, the build and npm run verify all pass.
 *
 * SCOPE. Only the public site. `src/styles/admin.css`, `src/pages/admin/**` and
 * `src/components/admin/**` are still dark by design and still use the palette
 * directly — that is rule 3's seam, not a leak, and sweeping them would produce
 * 35 false failures.
 *
 * The dark footer is exempt from the grey ban but NOT from the .on-light ban:
 * inside `.on-dark` the palette greys are legal again, because the surface
 * behind them is dark.
 */
const ROOT = new URL('../../', import.meta.url);

const PUBLIC_FILES = globSync('src/**/*.{astro,tsx,css}', {
  cwd: fileURLToPath(ROOT),
}).filter(
  (f) =>
    !f.includes('admin') &&
    !f.endsWith('tokens.css'), // the palette is where these are legitimately declared
);

const read = (f: string) => readFileSync(new URL(f, ROOT), 'utf8');

/** Files where the palette greys remain legal, because the surface is dark. */
const DARK_SURFACE_FILES = ['src/components/layout/Footer.astro'];

describe('white theme sweep', () => {
  it('finds public source files to sweep', () => {
    // A glob that silently matches nothing would make every test below pass.
    expect(PUBLIC_FILES.length).toBeGreaterThan(25);
  });

  it('no public file outside the dark footer uses --color-grey-lt', () => {
    const offenders = PUBLIC_FILES.filter(
      (f) => !DARK_SURFACE_FILES.includes(f) && read(f).includes('--color-grey-lt'),
    );
    expect(
      offenders,
      '--color-grey-lt is 2.06:1 on white and fails at every size. Use --text-muted.',
    ).toEqual([]);
  });

  it('no public file outside the dark footer uses --color-grey', () => {
    const offenders = PUBLIC_FILES.filter(
      (f) =>
        !DARK_SURFACE_FILES.includes(f) &&
        /var\(--color-grey\)/.test(read(f)),
    );
    expect(
      offenders,
      '--color-grey is 3.43:1 on white — large text only. Use --text-muted for ' +
        'text, or --line-control for a control boundary.',
    ).toEqual([]);
  });

  it('no file anywhere still references the renamed .on-light helper', () => {
    const offenders = PUBLIC_FILES.filter((f) => /on-light|onLight/.test(read(f)));
    expect(
      offenders,
      '.on-light inverted meaning on 2026-08-20 and is now .on-dark. A leftover ' +
        'applies light-surface rules inside the dark footer, silently.',
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run src/styles/theme-sweep.test.ts
```

Expected: FAIL — the two grey tests list roughly 25 offending files. The `.on-light` test should already PASS from Task 2.

`node:fs`'s `globSync` was confirmed available on this machine (Node v24.14.1) while this plan was written, so the import above is correct as given. Note it is a Node 22+ API — if CI ever runs an older Node, this test is the first thing that breaks, and the fix is `fast-glob`, which Astro already ships.

- [ ] **Step 3: Do not implement yet**

This test stays red until Task 9. That is deliberate — it is the checklist for Tasks 4 through 9, and each of those tasks shortens its failure list.

- [ ] **Step 4: Commit the failing gate**

```bash
git add src/styles/theme-sweep.test.ts
git commit -m "test(theme): gate the 80 greys that would otherwise survive the move"
```

---

## Task 4: Header, utility bar and mobile nav

**Files:**
- Modify: `src/components/layout/Header.astro` (8 `#fff`, 6 grey, 2 `rgba(255`)
- Modify: `src/components/layout/UtilityBar.astro` (1 grey, 2 `rgba(255`)
- Modify: `src/components/layout/MobileNav.tsx`

- [ ] **Step 1: Swap the logo lockup**

In `src/components/layout/Header.astro`, change the import at line 29 and the usage at line 93:

```astro
import logoDark from '../../assets/brand/spartan-logo.svg';
```

```astro
<img src={logoDark.src} width={logoDark.width} height={logoDark.height} alt="Spartan" />
```

Replace the comment at line 14 — it currently reads "Both modes are dark surfaces, so this uses the **light** logo lockup":

```
 * Both modes are LIGHT surfaces as of the white theme (2026-08-20), so this
 * uses the black-wordmark lockup. The white-wordmark one stays in the footer,
 * which is the only dark surface left on the public site. `handoff.md` §3
 * records that putting the wrong lockup on the wrong surface is a real bug
 * that has already happened once on this project.
```

- [ ] **Step 2: Recolour both header modes**

```css
  .site-header--solid {
    position: sticky;
    top: 0;
    background: var(--surface-page);
    border-bottom: 1px solid var(--line);
  }
```

Replace every `#fff` text colour in this file with `var(--text)`, every `var(--color-grey)` with `var(--text-muted)`, and every `rgba(255, 255, 255, …)` border with `var(--line)`. The active-nav underline uses `var(--accent)`.

- [ ] **Step 3: Add the scroll-progress rule**

Append to `src/components/layout/Header.astro`'s style block:

```css
  /* The scroll-progress rule under the nav.
     Scroll-driven CSS animation, so NO inline script and therefore no new CSP
     hash — the 9-hash count in CLAUDE.md is unchanged by this. Browsers without
     `animation-timeline` simply paint the static hairline underneath and never
     scale the bar, which is the correct degraded state for a decorative
     progress indicator. */
  .site-header__progress {
    height: 2px;
    background: var(--line);
    overflow: hidden;
  }

  .site-header__progress::after {
    content: '';
    display: block;
    height: 100%;
    background: var(--accent);
    transform-origin: 0 50%;
    transform: scaleX(0);
  }

  @supports (animation-timeline: scroll()) {
    .site-header__progress::after {
      animation: header-progress linear;
      animation-timeline: scroll(root block);
    }
  }

  @keyframes header-progress {
    from { transform: scaleX(0); }
    to   { transform: scaleX(1); }
  }
```

Add the element immediately after the closing `</nav>` inside the header:

```astro
<div class="site-header__progress" aria-hidden="true"></div>
```

It is decorative and duplicates information the scrollbar already carries, so it is `aria-hidden` and gets no `role="progressbar"`.

- [ ] **Step 4: Recolour the utility bar and mobile nav**

In `UtilityBar.astro`: background to `var(--surface-alt)`, its hairline to `var(--line)`, `--color-grey` to `var(--text-muted)`, and the social mark fill to `var(--text-muted)`.

In `MobileNav.tsx`: the panel background becomes `var(--surface-page)`, its text `var(--text)`, its dividers `var(--line)`.

- [ ] **Step 5: Verify and commit**

```bash
npx astro check
npx vitest run src/styles/theme-sweep.test.ts
```

Expected: `astro check` clean. The sweep still fails, but `Header.astro`, `UtilityBar.astro` and `MobileNav.tsx` are no longer in the offender lists.

```bash
git add src/components/layout
git commit -m "refactor(header): light chrome, black lockup, scroll-progress rule"
```

---

## Task 5: The hero, and the crop-mark collision gate

**Files:**
- Create: `tests/e2e/hero-marks.spec.ts`
- Modify: `src/components/sections/Hero.astro`

- [ ] **Step 1: Write the failing collision test**

Create `tests/e2e/hero-marks.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

/**
 * The client raised this against their own mockup: in the mobile comp the
 * bottom crop marks sit on top of the CTA buttons. Marks are decoration and
 * CTAs are the conversion path, so this is not a taste question — it is a
 * decoration overlapping a tap target.
 *
 * Below 640px the bottom pair is DROPPED rather than repositioned. At 375px the
 * CTAs are full-width and stacked and there is no corner left to draw into, so
 * moving the marks only relocates the collision. A dropped mark passes this
 * test by not existing, which is the intended outcome, so the test also asserts
 * that at least one mark is visible at every width — otherwise deleting all
 * four would be a passing "fix".
 */
const WIDTHS = [375, 768, 1280];

for (const width of WIDTHS) {
  test(`hero crop marks clear the CTAs at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const marks = page.locator('.hero__mark');
    const ctas = page.locator('.hero__actions a');

    await expect(ctas.first()).toBeVisible();
    expect(
      await marks.count(),
      'every crop mark deleted would pass a pure non-overlap assertion',
    ).toBeGreaterThan(0);

    const markBoxes = await marks.evaluateAll((els) =>
      els
        .filter((e) => getComputedStyle(e).display !== 'none')
        .map((e) => e.getBoundingClientRect())
        .map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })),
    );
    const ctaBoxes = await ctas.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })),
    );

    for (const m of markBoxes) {
      for (const c of ctaBoxes) {
        const overlaps =
          m.x < c.x + c.w && m.x + m.w > c.x && m.y < c.y + c.h && m.y + m.h > c.y;
        expect(
          overlaps,
          `a crop mark at (${m.x}, ${m.y}) overlaps a CTA at (${c.x}, ${c.y}) at ${width}px`,
        ).toBe(false);
      }
    }
  });
}
```

- [ ] **Step 2: Run it to verify it fails**

Stop any dev server first — Playwright starts its own.

```bash
npx playwright test tests/e2e/hero-marks.spec.ts
```

Expected: FAIL — `.hero__mark` does not exist yet, so the count assertion fails.

- [ ] **Step 3: Recolour the hero and add the marks**

In `src/components/sections/Hero.astro`:

Background:

```css
  .hero {
    position: relative;
    background: var(--surface-alt);
    min-height: 760px;
    overflow: hidden;
    display: grid;
    align-items: center;
    align-content: center;
  }
```

Replace `.hero__grid`'s line grid with the dot field:

```css
  /* A 22px dot field, replacing the 80px line grid the dark hero used. It
     reads as a drawing sheet rather than graph paper, which is what the
     client's mockup asked for. */
  .hero__grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(var(--line) 1px, transparent 1px);
    background-size: 22px 22px;
  }
```

**Delete `.hero__glow` entirely** — the rule, the `@keyframes hero-pulse` block, the `.hero__glow { animation: none }` entry in the reduced-motion block, and the `<div class="hero__glow" aria-hidden="true"></div>` at line 228. A red radial bloom is a dark-surface device; on white it is a pink smudge.

Add the marks inside `.hero`, immediately after `.hero__grid`:

```astro
  <div class="hero__marks" aria-hidden="true">
    <span class="hero__mark hero__mark--tl"></span>
    <span class="hero__mark hero__mark--tr"></span>
    <span class="hero__mark hero__mark--bl"></span>
    <span class="hero__mark hero__mark--br"></span>
    <span class="hero__tick hero__tick--l"></span>
    <span class="hero__tick hero__tick--r"></span>
  </div>
```

```css
  .hero__mark {
    position: absolute;
    width: 22px;
    height: 22px;
    border: 0 solid var(--line-control);
  }

  .hero__mark--tl { top: 28px; left: 28px; border-top-width: 1px; border-left-width: 1px; }
  .hero__mark--tr { top: 28px; right: 28px; border-top-width: 1px; border-right-width: 1px; }
  .hero__mark--bl { bottom: 28px; left: 28px; border-bottom-width: 1px; border-left-width: 1px; }
  .hero__mark--br { bottom: 28px; right: 28px; border-bottom-width: 1px; border-right-width: 1px; }

  .hero__tick {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 1px;
    background: var(--accent);
  }

  .hero__tick--l { left: 0; }
  .hero__tick--r { right: 0; }

  /* THE BOTTOM PAIR IS DROPPED BELOW 640px, NOT MOVED.
     The CTAs go full-width and stacked here, so the bottom corners are inside
     the button column and there is nowhere to relocate a mark to — shifting it
     only moves the collision. Gated by tests/e2e/hero-marks.spec.ts. */
  @media (max-width: 640px) {
    .hero__mark--bl,
    .hero__mark--br {
      display: none;
    }
  }
```

Recolour the rest of the file: the badge border to `var(--line-control)`, its text to `var(--accent-text)`, `.hero__title` to `var(--text)` with its `span` on `var(--accent)` (large display type, 3:1 bar — this is the one place brand red is legal at scale), the pips to `var(--line-control)` with the active pip `var(--accent)`, and the pause control to `var(--text)` on `var(--surface-page)` with a `var(--line-control)` border.

- [ ] **Step 4: Run the collision test to verify it passes**

```bash
npx playwright test tests/e2e/hero-marks.spec.ts
```

Expected: PASS, 3 tests. If it fails at 1280, increase the mark inset or the hero's horizontal padding — do not shrink the CTA row.

- [ ] **Step 5: Re-hash the CSP and commit**

The hero's inline parallax script sits in this file and its media query holds a breakpoint value. If the script text changed by even one character its hash is stale, and **a stale hash does not fail the build — it ships a hero that never parallaxes.**

```bash
npm run build
npm run csp
git diff --stat vercel.json
```

If `vercel.json` changed, that confirms the hash moved and the regenerated file must be committed.

```bash
git add src/components/sections/Hero.astro tests/e2e/hero-marks.spec.ts vercel.json
git commit -m "feat(hero): white stage, dot field, crop marks that clear the CTAs"
```

---

## Task 6: The remaining home-page sections

**Files:** `src/components/sections/{Ticker,CategoryGrid,FeaturedLines,About,ServiceCards,TrustBand,Spotlight,Faq,EnquiryCta,DivisionPage}.astro`

- [ ] **Step 1: Apply the surface map**

Change only the section background declaration in each:

| File | From | To |
|---|---|---|
| `CategoryGrid.astro` | `var(--color-black)` | `var(--surface-alt)` |
| `FeaturedLines.astro` | `var(--color-panel)` | `var(--surface-page)` |
| `About.astro` | `var(--color-panel)` | `var(--surface-alt)` |
| `ServiceCards.astro` | `var(--color-paper)` | `var(--surface-page)` |
| `Spotlight.astro` | `var(--color-panel)` | `var(--surface-alt)` |
| `Faq.astro` | `var(--color-paper)` | `var(--surface-page)` |
| `EnquiryCta.astro` | `var(--color-black)` | `var(--surface-alt)` |

`Ticker.astro` and `TrustBand.astro` keep `var(--color-red-fill)` — change that reference to `var(--accent-fill)` for consistency but **do not change the colour**; white on it is 4.91:1 and already correct.

- [ ] **Step 2: Recolour their contents**

In every one of these files, and in `DivisionPage.astro`:

- `#fff` used as a **text** colour becomes `var(--text)`. `#fff` inside `Ticker.astro` and `TrustBand.astro` stays `#fff` — it sits on red.
- `var(--color-grey)` and `var(--color-grey-lt)` become `var(--text-muted)`.
- `var(--color-line)` becomes `var(--line)`.
- `var(--color-card)` becomes `var(--surface-raised)`.
- `var(--color-red)` on text under 24px becomes `var(--accent-text)`. On rules, icons and display type it becomes `var(--accent)`.

**`DivisionPage.astro` exception:** its photographic header keeps its scrim and its white text. Do not convert anything inside the scrim — those nav links pass only because of it (6.04:1 composited, 1.11:1 against the raw image), and the pixel-sampling gate they need is queued separately in `BACKLOG.md`.

- [ ] **Step 3: Verify and commit**

```bash
npx astro check
npx vitest run src/styles/theme-sweep.test.ts
```

Expected: `astro check` clean; the sections no longer appear in the sweep's offender lists.

```bash
git add src/components/sections
git commit -m "refactor(sections): the home page takes the white surface map"
```

---

## Task 7: Catalogue components — the hairline card grid

**Files:** `src/components/catalog/{ProductCard,ProductGrid,CategoryTile,Breadcrumbs,SpecTable,En388Table,ShareRow}.astro`

- [ ] **Step 1: Convert the card to a hairline grid**

In `src/components/catalog/ProductCard.astro`:

```css
  .card {
    display: flex;
    flex-direction: column;
    width: 100%;
    background: var(--surface-raised);
    transition: background var(--dur-base) var(--ease-out);
  }

  .card:hover {
    background: var(--surface-alt);
  }
```

`.card__name` becomes `var(--text)`, `.card__kicker` becomes `var(--text-muted)`, and the focus ring's `var(--color-red)` becomes `var(--accent)`.

**Leave the `.card__media` comment and rules exactly as they are.** It records that product cutouts are transparent PNGs sitting directly on the card with no plate, and that a visible rectangle means the extraction pipeline regressed. That is still true and still the right alarm — the cutouts were confirmed clean on white during design review.

- [ ] **Step 2: Invert the grid gap**

In `src/components/catalog/ProductGrid.astro`, the 1px gaps are painted by a dark background behind the grid. Change that background to `var(--line)` so the gaps read as hairlines on white. Same change in `CategoryTile.astro` if it paints its own grid.

- [ ] **Step 3: Convert the remaining four**

`Breadcrumbs.astro`, `SpecTable.astro`, `En388Table.astro`, `ShareRow.astro`: apply the same substitutions listed in Task 6 Step 2.

`En388Table.astro` needs attention: `handoff.md` records `.en td` shipping at 4.48:1 and axe missing it. Give its cells `var(--text)`, not a muted token, and add it to the contrast spec in Task 10.

- [ ] **Step 4: Verify and commit**

```bash
npx astro check
npx vitest run src/styles/theme-sweep.test.ts
git add src/components/catalog
git commit -m "refactor(catalog): white cards on hairline rules"
```

---

## Task 8: Pages

**Files:** `src/pages/{index,about,contact,industries,why-spartan,enquiry,404}.astro`, `src/pages/catalogue/{index,[category]}.astro`, `src/pages/products/[slug].astro`, `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Apply the same substitutions**

Work through each file applying Task 6 Step 2's substitution list. The heaviest are `src/pages/enquiry.astro` (15 `#fff`, 11 grey) and `src/pages/catalogue/index.astro` (7 `#fff`, 5 grey).

`src/pages/404.astro` uses `--fw-monument` on a large numeral — that is display type and takes `var(--accent)` or `var(--text)`, not `var(--accent-text)`.

In `src/layouts/BaseLayout.astro`, any `#fff` that set a page-level background or text colour becomes the semantic equivalent. Do not touch `src/layouts/AdminLayout.astro`.

- [ ] **Step 2: Verify and commit**

```bash
npx astro check
npx vitest run src/styles/theme-sweep.test.ts
git add src/pages src/layouts/BaseLayout.astro
git commit -m "refactor(pages): every public page on the white surface map"
```

---

## Task 9: The enquiry islands, and the footer

**Files:** `src/styles/enquiry.css` (13 `#fff`, 4 grey, 4 `rgba(255`), `src/components/layout/Footer.astro`

- [ ] **Step 1: Convert `enquiry.css`**

Same substitution list. Form controls are the one place `--line-control` matters: input, select, textarea and checkbox borders take `var(--line-control)` at 3.43:1, not `var(--line)` at 1.27:1, because those boundaries carry meaning.

- [ ] **Step 2: Make the footer explicitly dark**

In `src/components/layout/Footer.astro`, add `on-dark` to the root element's class list and change `--f-bg` to `var(--surface-page)` — which inside `.on-dark` resolves to `--color-black`.

The footer keeps `spartan-logo-light.svg`. Its `var(--color-grey)` and `var(--color-red-light)` usages stay: inside `.on-dark` they are on a dark surface and legal, which is why `Footer.astro` is the one file exempted in the sweep.

- [ ] **Step 3: Run the sweep — it must now pass**

```bash
npx vitest run src/styles/theme-sweep.test.ts
```

Expected: PASS, 4 tests. If any file is still listed, convert it — **do not add it to `DARK_SURFACE_FILES`** unless it genuinely renders on a dark surface.

- [ ] **Step 4: Commit**

```bash
git add src/styles/enquiry.css src/components/layout/Footer.astro
git commit -m "refactor(enquiry,footer): light forms, and a footer that declares its darkness"
```

---

## Task 10: Expand the rendered-contrast gate

**Files:** `tests/e2e/contrast.spec.ts`

- [ ] **Step 1: Rewrite the two inverted cases and add the new pairs**

Replace the `CASES` array:

```ts
/** Elements whose contrast depends on the weight scale or the surface map holding. */
const CASES = [
  { path: '/', selector: '.card__title', what: 'ServiceCards card title (19px red on white)' },
  { path: '/why-spartan', selector: '.rs__title', what: 'why-spartan reason title (19px red on white)' },
  { path: '/about', selector: '.dv__name', what: 'about division name (21px, inherits h3 weight)' },
  // Moved from --color-black to --surface-alt with the white theme. Measures
  // 3.99:1 there and passes ONLY as large display type — the same 18.66px-bold
  // boundary the 2026-08-11 typography spec showed can be crossed silently by a
  // weight change in another file.
  { path: '/', selector: '.hero__title span', what: 'hero accent (large display on #f6f6f7, 3:1 bar)' },
  // Was "micro label on dark". It is on light now and the bar is 4.5:1.
  { path: '/', selector: '.eyebrow', what: 'eyebrow micro label on light' },
  { path: '/', selector: '.card__kicker', what: 'product card kicker (muted micro label)' },
  { path: '/', selector: '.card__name', what: 'product card name' },
  { path: '/catalogue', selector: '.crumbs__current', what: 'breadcrumb current item on light' },
  { path: '/', selector: '.util__label', what: 'utility bar label on --surface-alt' },
  { path: '/', selector: '.nav__link', what: 'header nav link on white' },
  { path: '/', selector: '.f-bot', what: 'footer muted text inside .on-dark' },
];
```

All eleven selectors were confirmed to exist while this plan was written. `.f-bot`,
`.f-item small` and `.f-main p` are the three footer rules carrying
`--color-grey`; `.f-bot` is the representative one. Breadcrumbs expose
`.crumbs__current` and `.crumbs__sep` — there is no `.crumbs a`.

If a class is renamed later, the existing `toBeVisible()` assertion is what stops
this gate passing by testing nothing. Do not delete that assertion.

Add `.en td` from `En388Table.astro` if a product page reliably renders one; find a product with an EN 388 rating first via `grep -rln "en388" src/data`.

- [ ] **Step 2: Run it**

```bash
npx playwright test tests/e2e/contrast.spec.ts
```

Expected: PASS. Any failure is a real defect — **fix the colour, never the bar.**

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/contrast.spec.ts
git commit -m "test(contrast): cover the pairs the white theme created"
```

---

## Task 11: Documentation

**Files:** `handoff.md`, `docs/TRAPS.md`

- [ ] **Step 1: Update `handoff.md` §3**

Rule 4 sends readers to §3 for ratios and forbids reasoning from memory, so a stale §3 is worse than none. Under "Colour — measured, not chosen", add the semantic layer table and the ten measured ratios from the spec, and mark the dark-surface guidance as applying to `.on-dark` and `/admin` only.

Under "Logo — two lockups", correct "The site is dark-first, so most surfaces need the **light** lockup" — the reverse is now true, with the light lockup used only in the footer.

Add a new section recording the white theme, dated 2026-08-20, pointing at the spec.

- [ ] **Step 2: Add three entries to `docs/TRAPS.md` §"Fails silently"**

One for each hazard: the greys, the hero's CSP hash, and the `.on-light` rename. Each should name the gate that now catches it, so a reader knows the trap is closed rather than merely described.

- [ ] **Step 3: Check `CLAUDE.md` needs no edit**

Rule 4 names `--color-red-light`, `--color-red-fill` and `--color-red-deep` by job. The semantic layer points at those same three colours and does not change their jobs, so rule 4 stands as written. **If any edit does prove necessary, edit `CLAUDE.md` and copy it byte-identical over `AGENTS.md` — never edit both by hand**, and never touch a digit inside the counts block.

```bash
diff CLAUDE.md AGENTS.md && echo "identical"
```

- [ ] **Step 4: Commit**

```bash
git add handoff.md docs/TRAPS.md
git commit -m "docs: record the white theme, and close three traps behind gates"
```

---

## Task 12: Full verification

- [ ] **Step 1: Stop the dev server**

`npm run verify -- --full` runs Playwright, which starts its own server and will collide with a running `astro dev`.

- [ ] **Step 2: Run the gate**

```bash
npm run verify -- --full
```

Expected: green. This covers typecheck, unit tests, invariants, build, output sweeps, Playwright and axe over 13 sampled paths.

Axe will now be measuring a light site for the first time. Treat any new violation as a real defect. `handoff.md` records axe missing `.en td` at 4.48:1 and a Label in Name failure on every product card, so **a green axe run is a floor, not a certificate** — the contrast spec from Task 10 is what actually certifies rule 4.

- [ ] **Step 3: Regenerate the derived files**

```bash
npm run csp
npm run counts
```

`counts` will change: this plan adds roughly 17 unit tests to the 272 in `CLAUDE.md`'s counts block. **Never edit that block by hand** — `npm run counts` writes it from the build, and a hand-edited digit fails its own gate.

Re-copy `CLAUDE.md` to `AGENTS.md` if `counts` touched it:

```bash
cp CLAUDE.md AGENTS.md
diff CLAUDE.md AGENTS.md && echo identical
```

- [ ] **Step 4: Re-run verify after regeneration**

```bash
npm run verify -- --full
```

Expected: green, including the counts and doc-parity gates.

- [ ] **Step 5: Commit**

```bash
git add vercel.json CLAUDE.md AGENTS.md
git commit -m "chore: regenerate CSP hashes and counts for the white theme"
```

---

## Task 13: The banner check — the one thing no gate covers

The 19 banner JPGs are dark photographic posters designed to sit on black. On a white hero they become heavy dark rectangles. The spec commits to putting this in front of the client rather than deciding it.

- [ ] **Step 1: Serve the built site**

```bash
npm run build
npm run preview
```

Note: `npm run preview` runs `tests/preview-server.mjs`, **not** `astro preview`.

- [ ] **Step 2: Capture the hero cycling all six enabled banners**

Screenshot the hero at 1280 and at 375, across the full carousel cycle. Six banners are enabled; the clock is derived from the count, so the cycle length is not a fixed number — read it from `Hero.astro`'s computed clock rather than assuming.

- [ ] **Step 3: Show the client and stop**

Present the screenshots and ask whether the posters read correctly on white. **Do not call this work done before that answer.** If they read as too heavy, the fix is artwork, not CSS, and belongs in `BACKLOG.md` — not in a filter or an opacity hack over a product image, which would misrepresent the goods.

---

## Self-review

**Spec coverage.** Every section of the spec maps to a task: semantic layer → 1; measured ratios → 1 (static) and 10 (rendered); dark footer → 2 and 9; surface map → 6, 7, 8; hero → 5; crop-mark rule → 5; header → 4; contrast gate → 10; documentation → 11; the three silent failures → 3 (greys and `.on-light`) and 5 (CSP hash); the ungateable banner check → 13; out-of-scope items are enforced by Task 3's admin exclusion and stated in Tasks 6 and 8.

**Naming consistency.** `--surface-page`, `--surface-alt`, `--surface-raised`, `--line`, `--line-control`, `--text`, `--text-muted`, `--accent-text`, `--accent`, `--accent-fill` — ten names, used identically in Tasks 1, 2, 4, 5, 6, 7, 8, 9. `.on-dark` is the only class introduced. `.hero__mark` is the selector in both Task 5's markup and its test.

**Known soft spots, flagged rather than hidden.** Task 6's substitution list is a rule rather than a per-line diff, because listing 80 individual edits would be less reliable to follow than the sweep test that verifies the outcome — the gate, not the list, is what guarantees completeness. Task 5's mark inset of 28px is a starting value, not a measured one; the collision test is what settles it, and the fix direction is stated (grow the inset, never shrink the CTA row). Task 13 cannot be automated at all and ends in a question to the client rather than a green check.
