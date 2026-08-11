# Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Spartan home page to the "Spartan Landing.dc.html" mockup — a helmet-centred animated hero, a scrolling category ticker, a 15-card category grid and a tabbed Featured Lines strip — using the project's own high-resolution assets and its real catalogue data, while keeping all seven nav routes and restyling the five retained sections to match.

**Architecture:** The mockup is a Claude Design canvas artifact (`<x-dc>` template + `DCLogic` class, rendered by `support.js`). None of that runtime ports. Every `{{ binding }}`, `sc-for` and `style-hover` is re-authored as an Astro component with scoped CSS. All data comes from `src/lib/catalog.ts` — the mockup's hardcoded 15-category array carries 72-era counts and wrong slugs and must not be copied. Interactivity is deliberately split: the Featured Lines tabs and hero parallax use Astro's bundled `<script>` (emitted as external `/_astro/*.js`, so **no new CSP hash**), and the ticker's pause control is CSS-only via `:has()`, so it works with JavaScript disabled.

**Tech Stack:** Astro 7, TypeScript strict, scoped component CSS over `src/styles/tokens.css`, Preact islands (existing ones untouched), Vitest, Playwright + axe.

---

## Decisions locked before writing this plan

These came from the user on 2026-08-11. Do not revisit them mid-execution.

| Decision | Ruling |
|---|---|
| **Hero image** | Use the mockup's floating helmet. It is AI-generated (C2PA `trainedAlgorithmicMedia`, GPT/openai markers). Record the provenance in `handoff.md` and raise it with the client — do not ship it silently. |
| **Client hero artwork** | `hero-range-desktop.png` / `hero-range-mobile.png` stop being the landing hero. Keep the files; they are client-supplied brand assets and Task 14 records where they went. |
| **Nav** | Keep all seven existing routes. Adopt the mockup's *visual treatment* only. No `/divisions` route, no dropdown, no redirects. |
| **Retained sections** | Restyle all five (`About`, `ServiceCards`, `TrustBand`, `Spotlight`, `Faq`) to the mockup's language and keep them on the page. |
| **Copy — keep** | "Est. 2015" · "Bulk and contract pricing on quantity" · "Mixed pallets across both divisions" · "Samples on safety lines before you commit" |
| **Copy — cut** | "Send a list, a drawing or a photo of the old part" (the form has no upload) · "Quotes come back with unit price, stock position and lead time on every line" |

---

## Prerequisite — blocks Task 2, nothing else

**`src/assets/hero/helmet-hero.png` must be supplied by hand.** The DesignSync `get_file` method caps at 256 KiB and returns `truncated: true` for this asset — 196,608 bytes of a larger file. It **cannot** be fetched through the MCP.

Download it from `https://claude.ai/design/p/a3824cff-5eab-4def-9d1f-acd205eaad27` (`assets/helmet-hero.png`) and save it to `src/assets/hero/helmet-hero.png`.

Verified from the truncated header: **1254×1254, RGBA, alpha channel present.** At the 560px render that is 2.24× headroom, so it clears the project's "never upscale beyond ~2×" rule with room to spare. Do not add `widths` entries above 1254.

Every other task can proceed without it. Task 2 fails at `astro build` if it is missing, which is the intended signal.

---

## Three requirements the mockup does not satisfy

Build these in from the start. They are not polish.

1. **`prefers-reduced-motion`.** The mockup runs four infinite animations — `bob` 7s, `pulse` 6s, `sweep` 14s, `tick` 42s — plus cursor parallax. The hero it replaces documents *"No pause control, no reduced-motion branch. Nothing moves."* Every animation in this plan carries a reduced-motion branch that sets `animation: none` and disables the parallax listener.

2. **WCAG 2.2.2 Pause, Stop, Hide.** The ticker auto-starts, moves, and runs longer than five seconds. That is a Level A failure without a mechanism to pause it. axe will not flag this — the same blind spot that let a serious Label in Name failure sit on every product card at a green score. The control is built in Task 3.

3. **The two empty categories must not show a product.** The mockup renders `waterproof-fittings` for Electrical Accessories and `nonwoven-disposable-coverall` for Spill Control. Both categories have `productCount: 0` and `heroProductSlug: null`. Showing a product image in a category that has none is a claim about stock that is not true. Task 4 renders a real empty state instead.

---

## File structure

**Create**

| Path | Responsibility |
|---|---|
| `src/lib/featured.ts` | The curated Featured Lines list, named by slug. Exists because `product.order` is per-category and repeats, so `getProducts({ limit: n })` returns an arbitrary cross-category slice. |
| `src/lib/featured.test.ts` | Gates that every curated slug still resolves to a published product. |
| `src/components/sections/Ticker.astro` | The red marquee band plus its CSS-only pause control. |
| `src/components/sections/FeaturedLines.astro` | Tabbed product strip. Server-renders all cards; the tabs filter the DOM already on the page. |
| `tests/e2e/home.spec.ts` | Landing-page coverage: hero, ticker, category grid, featured tabs. |
| `tests/e2e/motion.spec.ts` | Reduced-motion branch and the ticker pause control. |

**Modify**

| Path | Change |
|---|---|
| `src/components/sections/Hero.astro` | Wholesale rewrite — helmet stage, real `<h1>`, badge, two CTAs. |
| `src/components/sections/CategoryGrid.astro` | Restyle to the 5-column card grid with count labels and a real empty state. |
| `src/components/sections/EnquiryCta.astro` | Restyle to two columns. Form markup, names and submit behaviour unchanged. |
| `src/components/layout/Header.astro` | Mockup treatment, same seven `items`. |
| `src/components/sections/About.astro` | Restyle. |
| `src/components/sections/ServiceCards.astro` | Restyle. |
| `src/components/sections/TrustBand.astro` | Restyle. |
| `src/components/sections/Spotlight.astro` | Restyle. |
| `src/components/sections/Faq.astro` | Restyle. |
| `src/pages/index.astro` | Section order. |
| `handoff.md`, `BACKLOG.md`, `docs/TRAPS.md` | Record the decisions, the AI provenance, the new traps. |

**Do not create:** any port of `support.js`, any `_ds/` directory, any copy of the mockup's `assets/products/*.png`. Our own 80 assets under `src/assets/products/` are the higher-resolution originals the mockup's copies were derived from.

---

## Task 1: The curated Featured Lines list

The mockup hardcodes eight products. `getProducts({ limit: 8 })` cannot reproduce that — `product.order` is per-category and its values repeat across categories, so an unfiltered limited call returns a semi-arbitrary slice. `handoff.md` §5 states the rule directly: **any curated featured strip must name its products by slug.**

**Files:**
- Create: `src/lib/featured.ts`
- Test: `src/lib/featured.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/featured.test.ts
import { describe, expect, it } from 'vitest';
import { FEATURED_SLUGS, getFeaturedProducts } from './featured';
import { getProducts } from './catalog';

describe('featured', () => {
  /*
   * The whole point of this module. A curated strip named by slug silently
   * empties when a slug is renamed — the page still builds, the grid just has
   * fewer cards, and nothing fails. This is the gate that turns that into a
   * test failure.
   */
  it('every curated slug resolves to a published product', async () => {
    const products = await getProducts();
    const known = new Set(products.map((p) => p.slug));
    const missing = FEATURED_SLUGS.filter((s) => !known.has(s));
    expect(missing).toEqual([]);
  });

  it('returns products in the curated order, not catalogue order', async () => {
    const featured = await getFeaturedProducts();
    expect(featured.map((p) => p.slug)).toEqual([...FEATURED_SLUGS]);
  });

  it('covers both divisions, because the tabs filter by division', async () => {
    const featured = await getFeaturedProducts();
    const divisions = new Set(featured.map((p) => p.divisionId));
    expect(divisions).toEqual(new Set(['electricals', 'safety']));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/featured.test.ts`
Expected: FAIL — `Failed to resolve import "./featured"`

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/featured.ts
/**
 * The Featured Lines strip, curated by slug.
 *
 * WHY NOT getProducts({ limit: 8 }). `product.order` is per-category and its
 * values repeat across categories — only `category.order` is globally unique.
 * An unfiltered limited call therefore returns a semi-arbitrary cross-category
 * slice that changes shape whenever a category gains a product. A marketing
 * strip has to be chosen, so it is chosen here and nowhere else.
 *
 * The list is the mockup's eight, unchanged. Four Electricals, four Safety, so
 * neither division tab is ever empty.
 */
import { getCategories, getProducts, type Product } from './catalog';

export const FEATURED_SLUGS = [
  'led-floodlights',
  'slim-led-panels',
  'pumps',
  'ventilation-fans-14-inch',
  'grip-guard-gp5',
  'safety-helmets',
  'high-cut-safety-shoes',
  'fire-retardant-cotton-coveralls',
] as const;

/** A product plus the two labels the card shows above and below its name. */
export type FeaturedProduct = Product & {
  divisionId: string;
  categoryName: string;
};

export async function getFeaturedProducts(): Promise<FeaturedProduct[]> {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const byId = new Map(categories.map((c) => [c.id, c]));

  const out: FeaturedProduct[] = [];
  for (const slug of FEATURED_SLUGS) {
    const product = bySlug.get(slug);
    // A missing slug is dropped rather than thrown: the unit test above is the
    // place that fails, and a marketing strip should never break a build.
    if (!product) continue;
    const category = byId.get(product.categoryId);
    if (!category) continue;
    out.push({ ...product, divisionId: category.divisionId, categoryName: category.name });
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/featured.test.ts`
Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/featured.ts src/lib/featured.test.ts
git commit -m "feat(home): curate the featured strip by slug, not by limit"
```

---

## Task 2: The helmet hero

Replaces `Hero.astro` wholesale. The client artwork and its orientation switch, edge fade and 82% CTA offsets all go — that composition is documented in `handoff.md` §7 and Task 14 moves it to the historical record.

**Files:**
- Modify: `src/components/sections/Hero.astro` (full rewrite)
- Requires: `src/assets/hero/helmet-hero.png` from the Prerequisite section

- [ ] **Step 1: Confirm the asset is present and correctly sized**

Run:
```bash
node -e "require('sharp')('src/assets/hero/helmet-hero.png').metadata().then(m=>console.log(m.width+'x'+m.height,m.hasAlpha))"
```
Expected: `1254x1254 true`

If this errors, stop — the Prerequisite is unmet and the rest of this task cannot be verified.

- [ ] **Step 2: Write the component**

```astro
---
// src/components/sections/Hero.astro
import { getImage } from 'astro:assets';
import helmet from '../../assets/hero/helmet-hero.png';
import SolidButton from '../primitives/SolidButton.astro';
import PillButton from '../primitives/PillButton.astro';
import wordmark from '../../assets/brand/spartan-logo-light.svg';

/**
 * Hero — the helmet as monument.
 *
 * REPLACED THE CLIENT ARTWORK on 2026-08-11. The previous hero was a supplied
 * 1672x941 composition that carried the logo, Arabic wordmark and headline as
 * pixels, which is why its <h1> was sr-only. This one renders a real headline,
 * so the h1 is visible text again and the image is decorative.
 *
 * THE HELMET IS AI-GENERATED. Its C2PA manifest asserts trainedAlgorithmicMedia
 * with GPT/openai markers. That is a deliberate, recorded decision — see
 * handoff.md and BACKLOG.md. It depicts safety equipment on a site whose rule
 * is that nothing about safety equipment is invented, so it is flagged to the
 * client rather than quietly shipped. `alt=""` because the headline carries the
 * meaning and the image asserts nothing about a real product.
 *
 * NATIVE SIZE IS 1254x1254 and it renders at 560. Astro clamps `widths` down to
 * the source, so nothing here can upscale; do not add entries above 1254.
 *
 * MOTION. Four things move: the helmet bobs, a glow pulses, a red arc sweeps,
 * and the whole stage parallaxes toward the cursor. All four stop under
 * prefers-reduced-motion, and the parallax listener is never attached in that
 * case rather than being attached and ignored.
 */
const WIDTHS = [420, 560, 840, 1120, 1254];
const helmetAvif = await getImage({ src: helmet, widths: WIDTHS, format: 'avif' });
const helmetWebp = await getImage({ src: helmet, widths: WIDTHS, format: 'webp' });
---

<section class="hero" data-hero>
  <div class="hero__grid" aria-hidden="true"></div>

  <div class="hero__stage" data-hero-stage aria-hidden="true">
    <div class="hero__glow"></div>
    <div class="hero__sweep"></div>
    <div class="hero__ring"></div>
    <picture class="hero__helmet">
      <source type="image/avif" srcset={helmetAvif.srcSet.attribute} sizes="(max-width: 900px) 76vw, 560px" />
      <source type="image/webp" srcset={helmetWebp.srcSet.attribute} sizes="(max-width: 900px) 76vw, 560px" />
      <img
        src={helmetWebp.src}
        alt=""
        width={helmet.width}
        height={helmet.height}
        fetchpriority="high"
        loading="eager"
        decoding="async"
      />
    </picture>
  </div>

  <div class="hero__copy">
    <div class="hero__badge">
      <span class="hero__badge-hazard"></span>
      <span class="hero__badge-body">
        <img src={wordmark.src} alt="Spartan" width="72" height="15" />
        <span class="hero__badge-rule"></span>
        <span class="hero__badge-est">Est. 2015</span>
      </span>
    </div>

    <h1 class="hero__title">Home and<br />industrial<br /><span>solutions.</span></h1>

    <div class="hero__actions">
      <SolidButton href="/catalogue">Browse catalogue</SolidButton>
      <PillButton href="/enquiry">Request a quote</PillButton>
    </div>
  </div>
</section>

<style>
  .hero {
    position: relative;
    background: var(--color-black);
    min-height: 660px;
    overflow: hidden;
    display: grid;
    align-items: center;
  }

  /* The 80px graph paper behind everything. Decorative and very low contrast,
     so it never competes with the copy. */
  .hero__grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 80px 80px;
  }

  /* The parallax target. The script writes --px/--py; with no script they stay
     0 and this is a static translate of nothing. */
  .hero__stage {
    position: absolute;
    right: 0;
    top: 50%;
    width: 660px;
    height: 660px;
    margin-top: -330px;
    transform: translate3d(calc(var(--px, 0) * -26px), calc(var(--py, 0) * -18px), 0);
    transition: transform 700ms var(--ease-out);
    z-index: 1;
  }

  .hero__glow,
  .hero__sweep,
  .hero__ring {
    position: absolute;
    left: 50%;
    top: 52%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
  }

  .hero__glow {
    width: 540px;
    height: 540px;
    background: radial-gradient(
      circle,
      rgba(235, 41, 39, 0.42) 0%,
      rgba(235, 41, 39, 0.14) 42%,
      rgba(235, 41, 39, 0) 70%
    );
    filter: blur(6px);
    animation: hero-pulse 6s ease-in-out infinite;
  }

  .hero__sweep {
    width: 500px;
    height: 500px;
    border: 1px solid rgba(235, 41, 39, 0.28);
    background: conic-gradient(from 0deg, rgba(235, 41, 39, 0.28), rgba(235, 41, 39, 0) 28%);
    -webkit-mask: radial-gradient(circle, transparent 66%, #000 67%);
    mask: radial-gradient(circle, transparent 66%, #000 67%);
    animation: hero-sweep 14s linear infinite;
  }

  .hero__ring {
    width: 596px;
    height: 596px;
    border: 1px dashed rgba(255, 255, 255, 0.09);
  }

  .hero__helmet {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 560px;
    margin: -280px 0 0 -280px;
    display: block;
  }

  .hero__helmet img {
    width: 100%;
    height: auto;
    display: block;
    animation: hero-bob 7s ease-in-out infinite;
    filter: drop-shadow(0 46px 60px rgba(0, 0, 0, 0.75)) drop-shadow(0 0 40px rgba(235, 41, 39, 0.18));
  }

  .hero__copy {
    position: relative;
    z-index: 2;
    padding: 0 var(--wrap-pad);
    max-width: 660px;
  }

  /* The skewed hazard-stripe badge. The inner span un-skews so the text inside
     stays upright. */
  .hero__badge {
    display: inline-flex;
    align-items: stretch;
    transform: skewX(-12deg);
    border: 1px solid var(--color-line);
    background: rgba(21, 21, 25, 0.6);
    overflow: hidden;
    animation: hero-rise 0.6s var(--ease-out) both;
  }

  .hero__badge-hazard {
    width: 30px;
    display: block;
    background-image: repeating-linear-gradient(115deg, var(--color-red) 0 7px, #08080a 7px 14px);
  }

  .hero__badge-body {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px 8px 14px;
    transform: skewX(12deg);
  }

  .hero__badge-body img {
    height: 15px;
    width: auto;
    display: block;
  }

  .hero__badge-rule {
    width: 1px;
    height: 13px;
    background: var(--color-line);
    display: block;
  }

  /* red-light, not red: this is 11px text on --color-card, where brand red is
     4.23:1 and fails AA. See handoff.md §3. */
  .hero__badge-est {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-red-light);
  }

  .hero__title {
    margin: 26px 0 0;
    font-family: var(--font-display);
    font-size: clamp(44px, 6vw, 76px);
    font-weight: 800;
    line-height: 0.96;
    letter-spacing: -0.035em;
    text-transform: uppercase;
    color: #fff;
    animation: hero-rise 0.7s var(--ease-out) 0.08s both;
  }

  /* Brand red is correct here — this is display type well over the 24px bar. */
  .hero__title span {
    color: var(--color-red);
  }

  .hero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    margin-top: 44px;
    animation: hero-rise 0.7s var(--ease-out) 0.18s both;
  }

  @keyframes hero-bob {
    0%,
    100% {
      transform: translate3d(0, -10px, 0) rotate(-1.6deg);
    }
    50% {
      transform: translate3d(0, 14px, 0) rotate(1.4deg);
    }
  }
  @keyframes hero-pulse {
    0%,
    100% {
      opacity: 0.5;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 0.85;
      transform: translate(-50%, -50%) scale(1.06);
    }
  }
  @keyframes hero-sweep {
    from {
      transform: translate(-50%, -50%) rotate(0);
    }
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }
  @keyframes hero-rise {
    from {
      opacity: 0;
      transform: translateY(16px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Below 900px the stage stops being a side-by-side and sits behind the copy
     at reduced opacity, because there is no width for both. */
  @media (max-width: 900px) {
    .hero {
      min-height: 560px;
      padding: 96px 0 56px;
    }
    .hero__stage {
      right: 50%;
      transform: translate(50%, 0);
      top: 46%;
      width: 76vw;
      height: 76vw;
      margin-top: 0;
      opacity: 0.5;
    }
    .hero__helmet {
      width: 76vw;
      margin: 0;
      left: 0;
      top: 0;
      transform: none;
    }
    .hero__glow,
    .hero__sweep,
    .hero__ring {
      width: 82%;
      height: 82%;
    }
  }

  /* Nothing moves, and the entrance animations resolve to their end state
     rather than never running — `both` on a cancelled animation would leave the
     copy at opacity 0. */
  @media (prefers-reduced-motion: reduce) {
    .hero__helmet img,
    .hero__glow,
    .hero__sweep {
      animation: none;
    }
    .hero__badge,
    .hero__title,
    .hero__actions {
      animation: none;
      opacity: 1;
      transform: none;
    }
    .hero__stage {
      transition: none;
    }
  }
</style>

<script>
  /*
   * Cursor parallax.
   *
   * This is a bundled module script, NOT `is:inline` — Astro emits it as a file
   * under /_astro/, which `script-src 'self'` already allows. It therefore adds
   * no inline-script hash and `npm run csp` output is unchanged. Never convert
   * it to is:inline without re-running that command.
   */
  const hero = document.querySelector<HTMLElement>('[data-hero]');
  const stage = document.querySelector<HTMLElement>('[data-hero-stage]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (hero && stage && !reduce.matches) {
    hero.addEventListener('pointermove', (event) => {
      // Pointer, not mouse: a touch drag would otherwise leave the stage stuck
      // wherever the finger lifted.
      if (event.pointerType !== 'mouse') return;
      const rect = hero.getBoundingClientRect();
      stage.style.setProperty('--px', String((event.clientX - rect.left) / rect.width - 0.5));
      stage.style.setProperty('--py', String((event.clientY - rect.top) / rect.height - 0.5));
    });

    hero.addEventListener('pointerleave', () => {
      stage.style.setProperty('--px', '0');
      stage.style.setProperty('--py', '0');
    });
  }
</script>
```

- [ ] **Step 3: Typecheck and build**

Run: `npx astro check && npx astro build`
Expected: 0 errors; build clean

- [ ] **Step 4: Confirm no new inline-script hash was introduced**

Run: `npm run csp && git diff --stat vercel.json`
Expected: no change to `vercel.json`. If it changed, the script was emitted inline — stop and fix before committing.

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/Hero.astro src/assets/hero/helmet-hero.png
git commit -m "feat(hero): rebuild around the floating helmet"
```

---

## Task 3: The ticker, with a real pause control

**Files:**
- Create: `src/components/sections/Ticker.astro`

The control is a checkbox styled as a button, read by `:has()`. No JavaScript, so it works on a page with scripting disabled — which matters, because WCAG 2.2.2 is not waived by the user having JS off.

- [ ] **Step 1: Write the component**

```astro
---
// src/components/sections/Ticker.astro
import { getCategories } from '../../lib/catalog';

/**
 * The scrolling category band.
 *
 * WCAG 2.2.2 (Pause, Stop, Hide) applies: this starts automatically, moves, and
 * runs well past five seconds. That is a Level A failure without a pause
 * mechanism, and axe does not test for it — the same class of blind spot that
 * left a serious Label in Name failure on every product card at a green score.
 *
 * The control is a checkbox read by `:has()`, deliberately not an island: a
 * pause button that needs JavaScript to exist is not a mechanism for a visitor
 * who has JavaScript off, and the animation runs for them regardless.
 *
 * The track is duplicated and translated -50%, which is what makes the loop
 * seamless. Both copies are aria-hidden — the band is decorative, every
 * category it names is a real link in the grid below.
 */
const categories = await getCategories();
const text = categories.map((c) => c.name).join(' · ') + ' · ';
---

<div class="ticker">
  <div class="ticker__track" aria-hidden="true">
    <span>{text}</span>
    <span>{text}</span>
  </div>

  <input class="ticker__toggle" type="checkbox" id="ticker-pause" />
  <label class="ticker__btn" for="ticker-pause">
    <span class="ticker__btn-pause">Pause</span>
    <span class="ticker__btn-play">Play</span>
  </label>
</div>

<style>
  .ticker {
    position: relative;
    background: var(--color-red-fill);
    overflow: hidden;
    padding: 13px 0;
  }

  .ticker__track {
    display: flex;
    width: max-content;
    animation: ticker-run 42s linear infinite;
  }

  .ticker__track span {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: #fff;
    white-space: nowrap;
  }

  @keyframes ticker-run {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }

  /* Visually hidden but focusable — `display: none` would take it out of the
     tab order and there would be no keyboard route to the control. */
  .ticker__toggle {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .ticker__btn {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    min-height: 44px;
    padding: 0 10px;
    cursor: pointer;
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #fff;
    background: rgba(0, 0, 0, 0.28);
    border: 1px solid rgba(255, 255, 255, 0.35);
  }

  .ticker__btn:hover {
    background: rgba(0, 0, 0, 0.45);
  }

  /* The focus ring has to be driven off the input, since the label is what is
     visible and the input is what receives focus. */
  .ticker__toggle:focus-visible + .ticker__btn {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }

  .ticker__btn-play {
    display: none;
  }

  .ticker:has(.ticker__toggle:checked) .ticker__track {
    animation-play-state: paused;
  }
  .ticker:has(.ticker__toggle:checked) .ticker__btn-pause {
    display: none;
  }
  .ticker:has(.ticker__toggle:checked) .ticker__btn-play {
    display: inline;
  }

  /* Paused from the start, and the control then reads "Play" — so a visitor who
     asked for no motion can still opt into it. */
  @media (prefers-reduced-motion: reduce) {
    .ticker__track {
      animation-play-state: paused;
    }
    .ticker__btn-pause {
      display: none;
    }
    .ticker__btn-play {
      display: inline;
    }
    .ticker:has(.ticker__toggle:checked) .ticker__track {
      animation-play-state: running;
    }
    .ticker:has(.ticker__toggle:checked) .ticker__btn-pause {
      display: inline;
    }
    .ticker:has(.ticker__toggle:checked) .ticker__btn-play {
      display: none;
    }
  }
</style>
```

- [ ] **Step 2: Build and commit**

Run: `npx astro check && npx astro build`
Expected: 0 errors; build clean

```bash
git add src/components/sections/Ticker.astro
git commit -m "feat(home): add the category ticker with a pause control"
```

---

## Task 4: Restyle the category grid

**Files:**
- Modify: `src/components/sections/CategoryGrid.astro`

- [ ] **Step 1: Read the current component first**

Run: `cat src/components/sections/CategoryGrid.astro`

Keep its existing data call and its links. Only the markup and CSS below change.

- [ ] **Step 2: Write the component**

```astro
---
// src/components/sections/CategoryGrid.astro
import type { ImageMetadata } from 'astro';
import { Image } from 'astro:assets';
import { getCategories, getProducts } from '../../lib/catalog';

/**
 * The fifteen-category shelf.
 *
 * THE TWO EMPTY CATEGORIES SHOW NO PRODUCT. Electrical Accessories and Spill
 * Control both have productCount 0 and heroProductSlug null. The mockup filled
 * them with `waterproof-fittings` and `nonwoven-disposable-coverall` — a
 * product image in a category that stocks nothing is a claim about stock that
 * is not true, so they get a marked empty tile instead.
 *
 * Counts come from getCategories(), which derives productCount from the
 * published set. The mockup's hardcoded numbers are from the 72-product era —
 * it has Fans & Ventilation at 4 against a real 17.
 */
const categories = await getCategories();
const products = await getProducts();
const bySlug = new Map(products.map((p) => [p.slug, p]));

// Root-absolute glob so the keys are root-absolute and this works unchanged
// from any directory. Lazy, so only rendered images are emitted.
const productImages = import.meta.glob<{ default: ImageMetadata }>('/src/assets/products/*.png');

const tiles = await Promise.all(
  categories.map(async (category) => {
    const hero = category.heroProductSlug ? bySlug.get(category.heroProductSlug) : undefined;
    const file = hero?.images[0];
    const loader = file ? productImages[`/src/assets/products/${file}`] : undefined;
    const image = loader ? (await loader()).default : undefined;
    return {
      ...category,
      image,
      countLabel: category.productCount === 0 ? 'Expanding' : `${category.productCount} items`,
    };
  }),
);

const divisionNames: Record<string, string> = {
  electricals: 'Electricals',
  safety: 'Safety',
};
---

<section class="cg">
  <div class="wrap">
    <div class="cg__head">
      <div>
        <p class="cg__eyebrow">The catalogue</p>
        <h2 class="cg__title">
          {categories.length} categories, <span>one shelf</span>
        </h2>
      </div>
      <a class="cg__all" href="/catalogue">All products ›</a>
    </div>

    <ul class="cg__grid">
      {
        tiles.map((tile) => (
          <li>
            <a class="cg__card" href={`/catalogue/${tile.slug}`}>
              <span class="cg__media">
                {
                  tile.image ? (
                    <Image src={tile.image} alt="" widths={[160, 240]} sizes="160px" loading="lazy" />
                  ) : (
                    <span class="cg__empty">Range expanding</span>
                  )
                }
              </span>
              <span class="cg__body">
                <span class="cg__name">{tile.name}</span>
                <span class="cg__meta">
                  <span>{divisionNames[tile.divisionId] ?? tile.divisionId}</span>
                  <span class="cg__count">{tile.countLabel}</span>
                </span>
              </span>
            </a>
          </li>
        ))
      }
    </ul>
  </div>
</section>

<style>
  .cg {
    background: var(--color-black);
    padding: 80px 0;
  }

  .cg__head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 32px;
  }

  .cg__eyebrow,
  .cg__all,
  .cg__count {
    color: var(--color-red-light);
  }

  .cg__eyebrow {
    margin: 0;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .cg__title {
    margin: 14px 0 0;
    font-family: var(--font-display);
    font-size: clamp(30px, 4vw, 46px);
    font-weight: 800;
    line-height: 1.04;
    letter-spacing: -0.025em;
    text-transform: uppercase;
    color: #fff;
  }

  .cg__title span {
    color: var(--color-red);
  }

  .cg__all {
    flex: none;
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .cg__grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 14px;
  }

  .cg__card {
    display: block;
    background: var(--color-card);
    border: 1px solid var(--color-line);
    text-decoration: none;
    height: 100%;
    transition: border-color var(--dur-base) var(--ease-out);
  }

  .cg__card:hover,
  .cg__card:focus-visible {
    border-color: var(--color-red);
  }

  .cg__media {
    height: 128px;
    background: var(--color-black);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .cg__media :global(img) {
    max-height: 104px;
    max-width: 82%;
    width: auto;
    height: auto;
    object-fit: contain;
  }

  .cg__empty {
    font-family: var(--font-display);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-grey);
  }

  .cg__body {
    display: block;
    padding: 14px 14px 16px;
  }

  .cg__name {
    display: block;
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.25;
    text-transform: uppercase;
    color: #fff;
  }

  .cg__meta {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 7px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-grey);
  }

  @media (max-width: 1100px) {
    .cg__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (max-width: 640px) {
    .cg__grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .cg__head {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
```

- [ ] **Step 3: Verify the two empty categories render the empty state**

Run:
```bash
npx astro build && node -e "
const fs=require('fs');
const html=fs.readFileSync('dist/client/index.html','utf8');
const n=(html.match(/Range expanding/g)||[]).length;
console.log('empty tiles:',n);
process.exit(n===2?0:1)"
```
Expected: `empty tiles: 2`, exit 0

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/CategoryGrid.astro
git commit -m "feat(home): restyle the category shelf, with honest empty tiles"
```

---

## Task 5: Featured Lines with division tabs

**Files:**
- Create: `src/components/sections/FeaturedLines.astro`

All eight cards are server-rendered; the tabs hide and show them. That keeps the section complete for a crawler and with JavaScript off — the same approach the catalogue filter bar already uses.

- [ ] **Step 1: Write the component**

```astro
---
// src/components/sections/FeaturedLines.astro
import type { ImageMetadata } from 'astro';
import { Image } from 'astro:assets';
import { getFeaturedProducts } from '../../lib/featured';

/**
 * Featured Lines.
 *
 * Every card is server-rendered and the tabs narrow the DOM already on the
 * page — nothing is fetched. With JavaScript off the tab row hides itself and
 * all eight remain visible, which is the honest fallback: showing a filter that
 * cannot filter is worse than showing none.
 *
 * The list is curated in src/lib/featured.ts and named by slug, because
 * product.order is per-category and repeats. See that module's header.
 */
const featured = await getFeaturedProducts();
const productImages = import.meta.glob<{ default: ImageMetadata }>('/src/assets/products/*.png');

const cards = await Promise.all(
  featured.map(async (product) => {
    const loader = productImages[`/src/assets/products/${product.images[0]}`];
    return { ...product, image: loader ? (await loader()).default : undefined };
  }),
);

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'electricals', label: 'Electricals' },
  { id: 'safety', label: 'Safety' },
];
---

<section class="fl" data-featured>
  <div class="wrap">
    <div class="fl__head">
      <h2 class="fl__title">Featured lines</h2>
      <div class="fl__tabs" data-featured-tabs hidden>
        {
          TABS.map((tab, i) => (
            <button
              type="button"
              class="fl__tab"
              data-tab={tab.id}
              aria-pressed={i === 0 ? 'true' : 'false'}
            >
              {tab.label}
            </button>
          ))
        }
      </div>
    </div>

    <ul class="fl__grid">
      {
        cards.map((card) => (
          <li data-division={card.divisionId}>
            <a class="fl__card" href={`/products/${card.slug}`}>
              <span class="fl__media">
                {card.image && (
                  <Image src={card.image} alt="" widths={[220, 320]} sizes="220px" loading="lazy" />
                )}
              </span>
              <span class="fl__body">
                <span class="fl__cat">{card.categoryName}</span>
                <span class="fl__name">{card.name}</span>
                <span class="fl__cta">View product ›</span>
              </span>
            </a>
          </li>
        ))
      }
    </ul>
  </div>
</section>

<style>
  .fl {
    background: var(--color-panel);
    border-top: 1px solid var(--color-line);
    padding: 76px 0;
  }

  .fl__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 30px;
    flex-wrap: wrap;
  }

  .fl__title {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(28px, 3.6vw, 40px);
    font-weight: 800;
    letter-spacing: -0.02em;
    text-transform: uppercase;
    color: #fff;
  }

  .fl__tabs {
    display: flex;
    gap: 8px;
  }

  .fl__tab {
    min-height: 44px;
    padding: 0 20px;
    cursor: pointer;
    background: transparent;
    color: var(--color-grey-lt);
    border: 1px solid var(--color-line);
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .fl__tab[aria-pressed='true'] {
    background: var(--color-red-fill);
    border-color: var(--color-red-fill);
    color: #fff;
  }

  .fl__grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }

  .fl__grid li[hidden] {
    display: none;
  }

  .fl__card {
    display: block;
    height: 100%;
    background: var(--color-card);
    border: 1px solid var(--color-line);
    text-decoration: none;
    transition: border-color var(--dur-base) var(--ease-out);
  }

  .fl__card:hover,
  .fl__card:focus-visible {
    border-color: var(--color-red);
  }

  .fl__media {
    height: 178px;
    background: var(--color-black);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .fl__media :global(img) {
    max-height: 140px;
    max-width: 78%;
    width: auto;
    height: auto;
    object-fit: contain;
  }

  .fl__body {
    display: block;
    padding: 16px;
  }

  .fl__cat {
    display: block;
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-grey);
  }

  .fl__name {
    display: block;
    margin-top: 7px;
    font-family: var(--font-display);
    font-size: 16px;
    font-weight: 700;
    text-transform: uppercase;
    color: #fff;
  }

  .fl__cta {
    display: block;
    margin-top: 14px;
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-red-light);
  }

  @media (max-width: 1100px) {
    .fl__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 560px) {
    .fl__grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<script>
  /*
   * Bundled module script — emitted under /_astro/, so no inline-script hash.
   *
   * The tab row ships `hidden` and this removes it, which is what guarantees
   * the no-JS fallback shows all eight cards rather than a dead control.
   */
  const section = document.querySelector<HTMLElement>('[data-featured]');
  const tabs = section?.querySelector<HTMLElement>('[data-featured-tabs]');

  if (section && tabs) {
    tabs.hidden = false;
    const buttons = [...tabs.querySelectorAll<HTMLButtonElement>('.fl__tab')];
    const items = [...section.querySelectorAll<HTMLLIElement>('.fl__grid li')];

    tabs.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.fl__tab');
      if (!button) return;
      const wanted = button.dataset.tab;
      for (const other of buttons) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      for (const item of items) {
        item.hidden = wanted !== 'all' && item.dataset.division !== wanted;
      }
    });
  }
</script>
```

- [ ] **Step 2: Build and commit**

Run: `npx astro check && npx astro build`
Expected: 0 errors; build clean

```bash
git add src/components/sections/FeaturedLines.astro
git commit -m "feat(home): add the tabbed featured lines strip"
```

---

## Task 6: Restyle the enquiry section

**Files:**
- Modify: `src/components/sections/EnquiryCta.astro`

**Do not touch the `<form>`, its field `name` attributes, its labels, the honeypot `website` field, or the submit handling.** That form is wired to `/api/enquiry` and reports `recorded || delivered`; a gate in `npm run verify` fails if either client stops reading `recorded`. This task changes the surrounding layout and the copy only.

- [ ] **Step 1: Read the current component**

Run: `cat src/components/sections/EnquiryCta.astro`

- [ ] **Step 2: Replace the lede and add the claims list**

The two cut claims must not appear. Replace the lede paragraph's text with copy that asserts only what the site can stand behind:

```astro
<p class="cta__lede">
  Build a list as you browse, or tell us what you need here. Every enquiry
  reaches the same desk and is answered by a person.
</p>

<ul class="cta__claims">
  <li>Bulk and contract pricing on quantity</li>
  <li>Mixed pallets across both divisions</li>
  <li>Samples on safety lines before you commit</li>
</ul>
```

Add the two-column shell and the list styling:

```css
.cta__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 72px;
  align-items: start;
}

.cta__claims {
  list-style: none;
  margin: 30px 0 0;
  padding: 0;
  border-top: 1px solid var(--color-line);
}

.cta__claims li {
  padding: 16px 0;
  border-bottom: 1px solid var(--color-line);
  font-size: 14px;
  color: var(--color-grey-lt);
}

@media (max-width: 900px) {
  .cta__inner {
    grid-template-columns: 1fr;
    gap: 40px;
  }
}
```

- [ ] **Step 3: Prove the cut claims are absent from the built output**

Run:
```bash
npx astro build && node -e "
const fs=require('fs');
const html=fs.readFileSync('dist/client/index.html','utf8');
const banned=['photo of the old part','stock position and lead time'];
const hits=banned.filter(b=>html.includes(b));
console.log('banned phrases present:',hits);
process.exit(hits.length?1:0)"
```
Expected: `banned phrases present: []`, exit 0

- [ ] **Step 4: Confirm the enquiry gate still passes**

Run: `node tools/verify.mjs 2>&1 | grep -E "enquiry clients|vitest"`
Expected: both `ok`

- [ ] **Step 5: Commit**

```bash
git add src/components/sections/EnquiryCta.astro
git commit -m "feat(home): restyle the enquiry section and cut two unverified claims"
```

---

## Task 7: Restyle the header

**Files:**
- Modify: `src/components/layout/Header.astro`

**The `items` array does not change.** All seven routes stay, and `isCurrentNavItem` keeps working. Only the visual treatment moves toward the mockup: uppercase Archivo at 11px/700 with `.16em` tracking, `--color-grey-lt` links, `#fff` for the current item, and a `--color-red-fill` "Request a quote" button at the right.

- [ ] **Step 1: Apply the treatment**

```css
.nav__link {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-grey-lt);
}

.nav__link:hover,
.nav__link--on {
  color: #fff;
}

.nav__quote {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 22px;
  background: var(--color-red-fill);
  color: #fff;
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.nav__quote:hover {
  background: var(--color-red-dark);
}
```

`--color-red-fill`, not `--color-red`: this is a red surface carrying white text, and brand red is 4.30:1 against white. `handoff.md` §3 states the rule.

- [ ] **Step 2: Apply the same type treatment to the footer**

Modify: `src/components/layout/Footer.astro`

**Keep the contact strip.** The mockup's footer is a logo and a copyright line, and adopting it literally would delete the address, phone and `mailto:` that `76c68c6` added — three real facts replaced by nothing. Apply the heading and label treatment only:

```css
.f-head {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-red-light);
}
```

`--color-red-light`, not `--color-red`: `.f-head` is 11px on a dark surface. This is the pairing `handoff.md` §3 lists by name.

The three `href="#"` social icons are a known open item in `BACKLOG.md` and are **not** in scope here — do not remove them in this task.

- [ ] **Step 3: Confirm the nav tests still pass**

Run: `npx playwright test tests/e2e/navigation.spec.ts`
Expected: all pass, both projects

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Header.astro src/components/layout/Footer.astro
git commit -m "feat(header): adopt the mockup treatment, keep all seven routes"
```

---

## Task 8: Assemble the page

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Update the imports and section order**

```astro
import Hero from '../components/sections/Hero.astro';
import Ticker from '../components/sections/Ticker.astro';
import About from '../components/sections/About.astro';
import ServiceCards from '../components/sections/ServiceCards.astro';
import TrustBand from '../components/sections/TrustBand.astro';
import CategoryGrid from '../components/sections/CategoryGrid.astro';
import FeaturedLines from '../components/sections/FeaturedLines.astro';
import Spotlight from '../components/sections/Spotlight.astro';
import Faq from '../components/sections/Faq.astro';
import EnquiryCta from '../components/sections/EnquiryCta.astro';
```

```astro
<main id="main">
  <Hero />
  <Ticker />
  <CategoryGrid />
  <FeaturedLines />
  <About />
  <ServiceCards />
  <TrustBand />
  <Spotlight />
  <Faq />
  <EnquiryCta />
</main>
```

The catalogue leads now — the ticker hands straight into the shelf it names. The five retained sections sit between the product content and the enquiry close.

- [ ] **Step 2: Build and check the page count is unchanged**

Run: `npx astro build`
Expected: clean, **110 pages** — this task adds no routes

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(home): assemble the new landing order"
```

---

## Task 9: End-to-end coverage

**Files:**
- Create: `tests/e2e/home.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

test.describe('the landing page', () => {
  test('has exactly one h1 and it is visible text, not an image', async ({ page }) => {
    await page.goto('/');
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Home and');
    await expect(h1).toContainText('solutions.');
  });

  test('the helmet is decorative, so it carries an empty alt', async ({ page }) => {
    await page.goto('/');
    const img = page.locator('.hero__helmet img');
    await expect(img).toHaveAttribute('alt', '');
  });

  test('every category has a tile and the two empty ones show no product', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.cg__grid li')).toHaveCount(15);
    // Electrical Accessories and Spill Control.
    await expect(page.locator('.cg__empty')).toHaveCount(2);
  });

  test('the category counts come from the catalogue, not from the mockup', async ({ page }) => {
    await page.goto('/');
    // Fans & Ventilation is 17 after the datasheet integration. The mockup
    // hardcoded the pre-datasheet 4, so this is the assertion that catches a
    // copy-paste of its array.
    const card = page.locator('.cg__card', { hasText: 'Fans & Ventilation' });
    await expect(card.locator('.cg__count')).toHaveText('17 items');
  });

  test('featured lines server-renders eight cards and the tabs narrow them', async ({ page }) => {
    await page.goto('/');
    const items = page.locator('.fl__grid li');
    await expect(items).toHaveCount(8);

    const tabs = page.locator('[data-featured-tabs]');
    await expect(tabs).toBeVisible();

    await page.getByRole('button', { name: 'Electricals' }).click();
    const visible = page.locator('.fl__grid li:not([hidden])');
    await expect(visible).toHaveCount(4);

    await page.getByRole('button', { name: 'All' }).click();
    await expect(visible).toHaveCount(8);
  });
});

test.describe('the landing page without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows all eight featured cards and hides the dead tab row', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.fl__grid li')).toHaveCount(8);
    await expect(page.locator('[data-featured-tabs]')).toBeHidden();
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/home.spec.ts`
Expected: all pass, both projects

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/home.spec.ts
git commit -m "test: cover the new landing page"
```

---

## Task 10: Motion and pause coverage

**Files:**
- Create: `tests/e2e/motion.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { expect, test } from '@playwright/test';

test.describe('the ticker pause control', () => {
  test('exists, is reachable by keyboard, and pauses the animation', async ({ page }) => {
    await page.goto('/');

    const toggle = page.locator('#ticker-pause');
    const track = page.locator('.ticker__track');

    await expect(track).toHaveCSS('animation-play-state', 'running');

    // Keyboard, not a click on the label — WCAG 2.2.2 needs a *mechanism*, and
    // a control only operable by mouse is not one.
    await toggle.focus();
    await page.keyboard.press('Space');

    await expect(track).toHaveCSS('animation-play-state', 'paused');
    await expect(page.locator('.ticker__btn-play')).toBeVisible();
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('stops the hero animations and starts the ticker paused', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero__helmet img')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.hero__glow')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.hero__sweep')).toHaveCSS('animation-name', 'none');
    await expect(page.locator('.ticker__track')).toHaveCSS('animation-play-state', 'paused');
  });

  test('the copy is still visible — a cancelled entrance must not leave it at opacity 0', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('.hero__title')).toBeVisible();
    await expect(page.locator('.hero__title')).toHaveCSS('opacity', '1');
    await expect(page.locator('.hero__actions')).toHaveCSS('opacity', '1');
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test tests/e2e/motion.spec.ts`
Expected: all pass, both projects

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/motion.spec.ts
git commit -m "test: gate the reduced-motion branch and the ticker pause control"
```

---

## Phase 2 — restyle the five retained sections

Tasks 11–13 re-skin `About`, `ServiceCards`, `TrustBand`, `Spotlight` and `Faq` so the page does not visibly mix two design generations. **No content changes in any of them** — markup structure, headings and copy stay as they are.

**Read each component in full before editing it.** These five are not specified line-by-line here for a reason: each already carries scoped CSS with comments recording why particular values were chosen, and several of those are measured contrast decisions rather than aesthetic ones. Overwrite the treatment, not the reasoning. If a comment explains a colour, that colour is load-bearing — check it against the table below rather than replacing it.

The shared treatment, applied to all five:

| Element | Value |
|---|---|
| Eyebrow | `var(--font-display)`, 12px, 700, `.2em` tracking, uppercase, `var(--color-red-light)` |
| Section heading | `var(--font-display)`, `clamp(28px, 4vw, 46px)`, 800, `line-height: 1.04`, `-0.025em`, uppercase, `#fff` |
| Accent word | `var(--color-red)` — display type only, never on body copy |
| Card | `background: var(--color-card)`, `border: 1px solid var(--color-line)`, hover `border-color: var(--color-red)` |
| Body copy on dark | `var(--color-grey-lt)` |
| Meta / label text | 11px, `.1em` tracking, uppercase, `var(--color-grey)` |
| Section rhythm | `padding: 76px 0`, alternating `--color-black` / `--color-panel`, `border-top: 1px solid var(--color-line)` |

**The colour rule is not negotiable.** Small red text on a dark surface uses `--color-red-light`; red surfaces under white text use `--color-red-fill`. Brand `--color-red` is for display type ≥24px, icons, rules and borders only. `handoff.md` §3 has the measured ratios.

### Task 11: About and TrustBand

**Files:**
- Modify: `src/components/sections/About.astro`
- Modify: `src/components/sections/TrustBand.astro`

- [ ] **Step 0** — Read both files first: `cat src/components/sections/About.astro src/components/sections/TrustBand.astro`
- [ ] **Step 1** — Apply the table above to `About.astro`. Alternate it to `--color-panel` so it separates from the black `FeaturedLines` above it.
- [ ] **Step 2** — Apply it to `TrustBand.astro`, keeping its existing `--color-red-fill` band.
- [ ] **Step 3** — Run `npx astro check && npx astro build`. Expected: 0 errors, clean.
- [ ] **Step 4** — Commit:

```bash
git add src/components/sections/About.astro src/components/sections/TrustBand.astro
git commit -m "style(home): restyle About and TrustBand to the new language"
```

### Task 12: ServiceCards and Spotlight

**Files:**
- Modify: `src/components/sections/ServiceCards.astro`
- Modify: `src/components/sections/Spotlight.astro`

- [ ] **Step 0** — Read both files first: `cat src/components/sections/ServiceCards.astro src/components/sections/Spotlight.astro`
- [ ] **Step 1** — Apply the card treatment to `ServiceCards.astro`.
- [ ] **Step 2** — Apply the heading and body treatment to `Spotlight.astro`. Leave its product image handling alone — it already uses the `import.meta.glob` pattern and the resolution ceiling applies.
- [ ] **Step 3** — Run `npx astro check && npx astro build`. Expected: 0 errors, clean.
- [ ] **Step 4** — Commit:

```bash
git add src/components/sections/ServiceCards.astro src/components/sections/Spotlight.astro
git commit -m "style(home): restyle ServiceCards and Spotlight to the new language"
```

### Task 13: Faq

**Files:**
- Modify: `src/components/sections/Faq.astro`

- [ ] **Step 0** — Read the file first: `cat src/components/sections/Faq.astro`
- [ ] **Step 1** — Apply the heading and body treatment. The open toggle keeps `--color-red-fill`, per the existing rule for red surfaces under white text.
- [ ] **Step 2** — Run `npx playwright test tests/e2e` and confirm no existing FAQ assertion broke.
- [ ] **Step 3** — Commit:

```bash
git add src/components/sections/Faq.astro
git commit -m "style(home): restyle the FAQ to the new language"
```

---

## Task 14: Documentation and the full gate

**Files:**
- Modify: `handoff.md`, `BACKLOG.md`, `docs/TRAPS.md`, `CLAUDE.md`, `AGENTS.md`

- [ ] **Step 1: Replace `handoff.md` §7's hero section**

Retire the client-artwork description to history and record the new one. It must state:

- The helmet is **AI-generated** — C2PA `trainedAlgorithmicMedia`, GPT/openai markers, native 1254×1254 — and this was a recorded decision on 2026-08-11, not an oversight. It is flagged to the client.
- `hero-range-desktop.png` and `hero-range-mobile.png` are **retained but unused** by the landing page. They are client-supplied brand assets and deleting them would discard supplied material.
- The `<h1>` is **visible text again**. The sr-only h1 existed only because the previous artwork carried the headline as pixels.
- The hero's `<script>` is **bundled, not `is:inline`** — it adds no CSP hash. Converting it to `is:inline` requires `npm run csp`.

- [ ] **Step 2: Add three entries to `docs/TRAPS.md`**

```markdown
- **The hero and Featured Lines `<script>` tags are bundled, not inline.** Astro
  emits them under `/_astro/`, which `script-src 'self'` already allows, so they
  add no inline-script hash. Adding `is:inline` to either silently requires
  `npm run csp` and a `vercel.json` recommit — and a stale hash does not fail
  the build, it ships a site that never hydrates.

- **The two empty categories must never show a product image.** Electrical
  Accessories and Spill Control have `productCount: 0` and
  `heroProductSlug: null`. The design mockup filled both with a borrowed product
  photo. A product image in a category that stocks nothing is a claim about
  stock, and it is not true.

- **The ticker's pause control is a checkbox read by `:has()`, deliberately not
  an island.** WCAG 2.2.2 needs a mechanism that exists for a visitor with
  JavaScript off. Replacing it with a Preact island removes the mechanism for
  exactly the visitors who cannot get it back.
```

- [ ] **Step 3: Update `BACKLOG.md`**

Add under P0:

```markdown
- [ ] **Confirm the AI-generated hero helmet with the client.** The landing
      hero is an AI-generated image (C2PA `trainedAlgorithmicMedia`, GPT). It
      depicts safety equipment on a site whose stated rule is that nothing about
      safety equipment is invented. The decision to ship it was taken
      deliberately on 2026-08-11 and recorded in `handoff.md`; it still needs a
      person at the client to agree. A real product photograph drops in with no
      markup change.
```

- [ ] **Step 4: Regenerate the counts block and sync the twins**

```bash
npm run counts -- --write
cp CLAUDE.md AGENTS.md
```

- [ ] **Step 5: Run the full gate**

Run: `npm run verify -- --full`
Expected: **all gates pass.** The unit count rises by 3 (Task 1) and the e2e count by 9 (Tasks 9–10).

If `astro build` reports anything other than 110 pages, a route was added by accident — this plan adds none.

- [ ] **Step 6: Commit**

```bash
git add handoff.md BACKLOG.md docs/TRAPS.md CLAUDE.md AGENTS.md
git commit -m "docs: record the landing redesign, the AI hero and three new traps"
```

---

## Verification summary

| Check | Command | Expected |
|---|---|---|
| Full gate | `npm run verify -- --full` | all gates pass |
| Unit | `npx vitest run` | 137 passed (134 + 3) |
| E2E | `npx playwright test` | 146 passed (137 + 9) |
| Build | `npx astro build` | clean, 110 pages |
| CSP | `npm run csp && git diff --stat vercel.json` | no change |
| Reduced motion | `npx playwright test tests/e2e/motion.spec.ts` | pass |

**Stop the dev server before any Playwright run.** `reuseExistingServer: true` means Playwright attaches to whatever is on 4321 and never builds.

## Out of scope

- Lighthouse re-measurement. The `/` row in `README.md` is already marked stale; this changes the LCP element again and the row should be re-run, but that is its own task.
- Any change to `/catalogue`, `/products/*`, the enquiry API, or the admin area.
- Deleting the client hero artwork files.
