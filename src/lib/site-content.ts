/**
 * The seam for everything the public site renders that is NOT the catalogue.
 *
 * `catalog.ts` is rule 3's door for products. This is the same door for site
 * text and hero banners, and it exists for the same reason: swapping the source
 * from committed JSON to Postgres has to be a change to ONE module, not to
 * every page that happens to read a phone number.
 *
 * Stage 2 of `docs/superpowers/plans/2026-08-19-admin-content-management.md`
 * is what makes that swap, and it is what makes banner selection editable from
 * `/admin` — the admin writes rows, the build reads them through here.
 *
 * No page or component may import `src/data/hero-banners.json` directly once
 * this exists. `src/data/site.json` is still imported in fifteen places and is
 * still exempt from the seam gate; Task 8 closes that.
 */
import bannersJson from '../data/hero-banners.json';

export interface HeroBanner {
  /** Filename within `src/assets/banners/`. */
  file: string;
  /**
   * Shown in the admin only. The slides themselves are decorative and carry
   * `alt=""` — they are marketing posters whose content is baked-in text that
   * alt cannot reproduce, and every product on them is a real item in the
   * catalogue below. See the note at the top of `Hero.astro`.
   */
  name: string;
  order: number;
  enabled: boolean;
}

/**
 * The banners the hero should show, in the order it should show them.
 *
 * Filtering and sorting happen HERE rather than in the component, so a future
 * Postgres-backed implementation can push both into the query without any
 * caller changing. Same principle as `catalog.ts` computing product counts and
 * related products inside the module.
 *
 * **The carousel's clock is derived from the length of what this returns** —
 * the keyframe stops, the pip count and the cycle length are one system. See
 * `Hero.astro`, which computes all three rather than hard-coding them.
 */
export async function getHeroBanners(): Promise<HeroBanner[]> {
  return (bannersJson as HeroBanner[])
    .filter((banner) => banner.enabled)
    .sort((a, b) => a.order - b.order);
}

/** How long each slide sits still, and how long it takes to move. */
const HOLD_SECONDS = 6;
const SLIDE_SECONDS = 1;

export interface HeroClock {
  /** Total cycle length. Every animation in the carousel runs at this. */
  cycleSeconds: number;
  /** One slide's share of the cycle, as a percentage. */
  stepPct: number;
  /** How far into its own step a slide is still holding, as a percentage. */
  holdPct: number;
  /** `animation-delay` for each pip, in seconds, one per slide. */
  pipDelays: number[];
}

/**
 * The carousel's clock, derived from the slide count.
 *
 * THE KEYFRAME STOPS, THE PIP STAGGER AND THE CYCLE LENGTH ARE ONE SYSTEM.
 * They were three sets of literals in `Hero.astro` until 2026-08-19, all
 * assuming exactly six slides — so enabling a seventh banner would have
 * produced a carousel whose lit pip reported a slide that was not showing.
 * That reads as a rendering bug and is arithmetic, which is the worst kind to
 * find.
 *
 * Pure and exported so the arithmetic is testable without a browser. At six
 * slides it returns exactly the values that used to be hard-coded: a 42s cycle,
 * stops at 16.667% and 14.286%, and pips every 7s.
 */
export function heroClock(slideCount: number): HeroClock {
  if (slideCount < 1) throw new Error(`heroClock needs at least one slide, got ${slideCount}`);

  const perSlide = HOLD_SECONDS + SLIDE_SECONDS;
  const stepPct = 100 / slideCount;

  return {
    cycleSeconds: slideCount * perSlide,
    stepPct,
    holdPct: stepPct * (HOLD_SECONDS / perSlide),
    pipDelays: Array.from({ length: slideCount }, (_, i) => i * perSlide),
  };
}
