import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ImageMetadata } from 'astro';

/**
 * The hero's two states, rendered.
 *
 * WHY THIS FILE EXISTS. The hero has a build-time branch: with no banners it
 * renders an empty slot, and with banners it renders a carousel. Both are real
 * — a fresh deployment has none, production has three — and until now only ONE
 * of them was ever covered, because a Playwright run tests whatever state the
 * build happened to be in.
 *
 * That produced the worst kind of green. Six browser tests asserted the EMPTY
 * slot and passed on every CI run, because CI builds against the throwaway
 * stack whose `hero_banners` table is empty — while production had been showing
 * a carousel since 2026-08-23. The carousel path, which is what visitors
 * actually see, had no coverage at all. Measured 2026-08-27: 294 pass against
 * an empty band and 8 fail against a build made from the live database.
 *
 * WHY A CONTAINER AND NOT A BROWSER. The branch is decided in the frontmatter,
 * so it is not a browser question — it is a question about what this component
 * emits for a given input, and here the input can simply be handed over.
 * Both states are covered on every `npm run verify`, with no build, no Docker
 * and no database. What genuinely needs a browser — the pause control actually
 * stopping the animation — stays in `tests/e2e/hero-carousel.spec.ts`, because
 * whether CSS stops moving is not decidable from markup.
 *
 * The mock returns plain objects in the shape of `ImageMetadata`. `<Picture>`
 * only needs `src`, `width`, `height` and `format` to emit a `<picture>`, and a
 * real optimised asset would test Astro's image pipeline rather than this
 * component.
 */

const banner = (i: number) => ({
  id: `banner-${i}`,
  name: `Banner ${i}`,
  order: i,
  src: {
    src: `/src/assets/banners/fixture-${i}.png`,
    width: 2800,
    height: 700,
    format: 'png',
  } as ImageMetadata,
});

/**
 * `vi.hoisted`, because the mock factory below is lifted above every import and
 * cannot close over an ordinary `const` declared here — it would read
 * `undefined` at the moment Astro asks for the banner list.
 */
const banners = vi.hoisted(() => ({ current: [] as ReturnType<typeof banner>[] }));

vi.mock('../../lib/site-content', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/site-content')>();
  return { ...actual, getHeroBanners: async () => banners.current };
});

/**
 * The catalogue, mocked with counts that are DELIBERATELY NOT the real ones.
 *
 * The hero counts products and categories for its supporting sentence rather
 * than stating them, which is the whole point — the one number that used to go
 * stale on the home page was a typed one. A fixture holding 94 and 15 would
 * pass whether the component counted or hard-coded, so it holds 7 and 3, and
 * the assertion below would fail the moment somebody types a literal in.
 */
vi.mock('../../lib/catalog', () => ({
  getDivisions: async () => [
    { id: 'electricals', slug: 'electricals', name: 'Spartan Electricals' },
    { id: 'safety', slug: 'safety', name: 'Spartan Safety' },
  ],
  getCategories: async () => Array.from({ length: 3 }, (_, i) => ({ id: `c${i}` })),
  getProducts: async () => Array.from({ length: 7 }, (_, i) => ({ slug: `p${i}` })),
}));

/** Renders Hero.astro against whatever `banners.current` holds. */
async function renderHero(): Promise<string> {
  const { experimental_AstroContainer } = await import('astro/container');
  const container = await experimental_AstroContainer.create();
  const Hero = (await import('./Hero.astro')).default;
  return container.renderToString(Hero);
}

/**
 * Counts ELEMENTS carrying a class, and matches the class as a WHOLE token.
 *
 * Both halves were learned by getting them wrong. The generated keyframes name
 * `hero__pip` in prose, so counting raw string occurrences inflates every pip
 * count. And `\b` is not a token boundary for a BEM class: `hero__slot-icon`
 * and `hero__slot-label` both satisfy `\bhero__slot\b`, which reported four
 * empty slots where the component renders one.
 */
const countElements = (html: string, className: string): number =>
  (html.match(/class="([^"]*)"/g) ?? []).filter((attr) =>
    attr
      .slice('class="'.length, -1)
      .split(/\s+/)
      .includes(className),
  ).length;

/**
 * Every `<img>` the hero rendered, with its alt.
 *
 * `null` means the attribute is absent; `''` means it is present and empty.
 * The distinction is the whole point of the decorative test, and it needs
 * parsing rather than a substring search because **Astro emits an empty alt as
 * the bare boolean attribute `alt`, not as `alt=""`** — so the obvious
 * `html.includes('alt=""')` finds nothing and a test written that way fails
 * against markup that is correct.
 */
const images = (html: string): { alt: string | null }[] =>
  (html.match(/<img\b[^>]*>/g) ?? []).map((tag) => {
    const withValue = tag.match(/\salt="([^"]*)"/);
    if (withValue) return { alt: withValue[1] };
    return { alt: /\salt(?=[\s>])/.test(tag) ? '' : null };
  });

beforeEach(() => {
  banners.current = [];
});

describe('with no banners', () => {
  /** The state a fresh deployment is in, and the one the site shipped in for three days. */
  it('renders the empty slot and nothing that moves', async () => {
    const html = await renderHero();

    expect(countElements(html, 'hero__slot')).toBe(1);
    expect(countElements(html, 'hero__slide')).toBe(0);
    expect(countElements(html, 'hero__pip')).toBe(0);
  });

  /**
   * A pause button with nothing to pause is a control that cannot do what it
   * says — the same defect this repo removed from the footer's newsletter field
   * and its three href="#" social icons. WCAG 2.2.2 only asks for a control
   * when something actually moves.
   */
  it('renders no pause control, because there is nothing to pause', async () => {
    const html = await renderHero();

    expect(countElements(html, 'hero__pause')).toBe(0);
    expect(countElements(html, 'hero__controls')).toBe(0);
    expect(html).not.toContain('hero-carousel-pause');
  });

  /** It is a note to whoever supplies the artwork, not content. */
  it('hides the slot from assistive technology', async () => {
    const html = await renderHero();
    expect(html).toMatch(/class="[^"]*hero__slot[^"]*"[^>]*aria-hidden="true"/);
  });

  /** The mockup draws "or browse files"; rendering it would be a link that does nothing. */
  it('does not render the mockup affordance that has no behaviour', async () => {
    expect(await renderHero()).not.toMatch(/browse files/i);
  });
});

describe('with banners', () => {
  /**
   * ONE MORE SLIDE THAN THERE ARE BANNERS. The last slide is a duplicate of the
   * first so the loop's reset lands on an identical frame — without it the
   * track visibly snaps back at the end of every cycle.
   */
  it('renders a slide per banner plus the duplicate that makes the loop seamless', async () => {
    for (const count of [2, 3, 6]) {
      banners.current = Array.from({ length: count }, (_, i) => banner(i));
      const html = await renderHero();

      expect(countElements(html, 'hero__slide')).toBe(count + 1);
      expect(countElements(html, 'hero__slot')).toBe(0);
    }
  });

  /**
   * THE COUNTER'S TOTAL IS DERIVED, NEVER TYPED. Added 2026-08-29 when the
   * controls became one rail. A fourth banner must not require an edit here,
   * which is why the assertion is on the zero-padded count rather than on the
   * literal "03" appearing somewhere in the markup.
   */
  it('states the position and the total beside the pips', async () => {
    banners.current = Array.from({ length: 3 }, (_, i) => banner(i));
    const html = await renderHero();

    expect(countElements(html, 'hero__count')).toBe(1);
    expect(html).toMatch(/hero__count-total[^>]*>\s*03\s*</);
  });

  it('pads a two-banner total to 02 rather than printing a bare 2', async () => {
    banners.current = Array.from({ length: 2 }, (_, i) => banner(i));
    expect(await renderHero()).toMatch(/hero__count-total[^>]*>\s*02\s*</);
  });

  /** One pip per banner — NOT per slide, or the duplicate would light an extra one. */
  it('renders one pip per banner, not per slide', async () => {
    for (const count of [2, 3, 6]) {
      banners.current = Array.from({ length: count }, (_, i) => banner(i));
      expect(countElements(await renderHero(), 'hero__pip')).toBe(count);
    }
  });

  /**
   * WCAG 2.2.2. The carousel starts on its own and runs past five seconds, so a
   * control is required — and axe does not test for it, so this and the browser
   * test in `hero-carousel.spec.ts` are its only guards.
   *
   * The accessible name has to START with the visible label ("Pause") or the
   * mismatch is itself a 2.5.3 Label in Name failure.
   */
  it('renders a pause control that a keyboard can reach', async () => {
    banners.current = [banner(0), banner(1), banner(2)];
    const html = await renderHero();

    expect(countElements(html, 'hero__pause')).toBe(1);
    expect(html).toContain('id="hero-carousel-pause"');
    expect(html).toContain('role="switch"');
    expect(html).toMatch(/aria-label="Pause[^"]*"/);
    expect(html).toMatch(/<label[^>]*hero__pause[^>]*>\s*Pause\s*<\/label>/);
  });

  /**
   * The slides are decorative: marketing posters whose content is baked-in text
   * that alt cannot reproduce, and every product on them is in the catalogue
   * below. So the track is hidden and every image carries an empty alt — one
   * without the other would announce a run of unlabelled images.
   */
  it('marks the track decorative and gives every slide an empty alt', async () => {
    banners.current = [banner(0), banner(1)];
    const html = await renderHero();

    expect(html).toMatch(/class="[^"]*hero__track[^"]*"[^>]*aria-hidden="true"/);
    expect(countElements(html, 'hero__slide')).toBe(3);

    const alts = images(html);
    expect(alts).toHaveLength(3);
    // Present on every image and empty on every image. An absent alt would be
    // three unlabelled images; a populated one would announce the banner's
    // admin-facing name to a visitor.
    expect(alts.every((img) => img.alt === '')).toBe(true);
    expect(html).not.toMatch(/alt="Banner \d"/);
  });

  /**
   * The first slide is the LCP element on the home page. Eager stops it being
   * lazy-loaded; `fetchpriority` is what stops the browser queueing it behind
   * CSS and fonts at default priority (handoff.md §29.4). Everything after it
   * is below the fold of the animation and must stay lazy, or a six-banner
   * carousel downloads six full-width images before the page settles.
   */
  it('loads the first slide eagerly and at high priority, and the rest lazily', async () => {
    banners.current = [banner(0), banner(1), banner(2)];
    const html = await renderHero();

    expect((html.match(/loading="eager"/g) ?? []).length).toBe(1);
    expect((html.match(/fetchpriority="high"/g) ?? []).length).toBe(1);
    // Three banners make four slides; the three after the first are lazy.
    expect((html.match(/loading="lazy"/g) ?? []).length).toBe(3);
  });

  /**
   * The cycle length, the keyframe step and the pip delays are one system
   * derived from the banner count — three sets of literals used to encode it,
   * all assuming six, so enabling a seventh lit the wrong pip. `heroClock` is
   * unit-tested separately; this checks the component actually emits it rather
   * than falling back to a constant.
   */
  it('emits a clock that changes with the number of banners', async () => {
    banners.current = [banner(0), banner(1)];
    const two = await renderHero();

    banners.current = [banner(0), banner(1), banner(2), banner(3), banner(4)];
    const five = await renderHero();

    const duration = (html: string) => html.match(/animation-duration:\s*([\d.]+)s/)?.[1];
    expect(duration(two)).toBeDefined();
    expect(duration(five)).toBeDefined();
    expect(duration(two)).not.toBe(duration(five));
  });
});

/**
 * THE PROPOSITION — what a first-time visitor can learn above the fold, and
 * where they learn it from.
 *
 * Added 2026-08-29 from a design review whose first finding was that the hero
 * was visually loud and semantically quiet. Rewritten the same day after a
 * second review found the fix had made the page more CONVENTIONAL: everything
 * centred, the numbers buried inside a sentence, four competing horizontal
 * rules. The counted totals are their own element now.
 */
describe('the proposition', () => {
  it('names both divisions in the masthead', async () => {
    const html = await renderHero();
    expect(html).toContain('Electricals + Safety');
  });

  it('drops the "Spartan" prefix, which the logo above has just said', async () => {
    const html = await renderHero();
    expect(html).not.toContain('Spartan Electricals');
  });

  /**
   * THE FOUNDING YEAR IS A STATISTIC NOW, AND THAT IS ITS THIRD ADDRESS.
   *
   * It was a hexagonal "Est. 2015" badge on the hero's most valuable line; it
   * became one segment of the mono masthead; it is now the third row of the
   * counted index. Each move was the same judgement applied with better
   * information — the fact is worth stating, the prominence was not.
   *
   * What put it in the index was a review calling "DIVISIONS / 02" a weak
   * third statistic that made the range sound unintentionally small. The
   * suggested replacements were dealers, markets and territories; not one of
   * them is sourceable on this machine, so all three were refused under rule 1
   * and the founding year is the credibility figure that is actually on file.
   *
   * IT MUST APPEAR EXACTLY ONCE. Stating it in the masthead as well would be
   * the same duplication this pass removed from the giant numeral.
   */
  it('states the founding year once, as a statistic rather than a badge', async () => {
    const html = await renderHero();

    expect(countElements(html, 'hero__badge')).toBe(0);
    expect((html.match(/2015/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<dt[^>]*>Established<\/dt>/);
  });

  it('carries exactly one supporting sentence, and no numbers inside it', async () => {
    const html = await renderHero();
    expect(countElements(html, 'hero__lede')).toBe(1);

    const lede = html.match(/class="[^"]*hero__lede[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
    expect(lede.length).toBeGreaterThan(20);
    // The totals moved OUT of this sentence and became the index beside it.
    // A digit reappearing here means the two have started saying the same
    // thing in two places, which is how one of them goes stale.
    expect(lede).not.toMatch(/\d/);
  });

  /**
   * THE INDEX COUNTS, IT DOES NOT STATE.
   *
   * The fixture at the top of this file mocks the catalogue with 7 products
   * and 3 categories precisely so a hard-coded "94" would fail here. Padded to
   * two digits, which is the register the slide counter and the masthead both
   * speak in.
   */
  it('renders the counted totals as an index of three padded pairs', async () => {
    const html = await renderHero();

    expect(countElements(html, 'hero__index')).toBe(1);
    expect(countElements(html, 'hero__index-row')).toBe(3);

    // `[^>]*` on both tags, not bare `<dt>`: Astro stamps a scope attribute
    // onto every element it renders, so an exact-tag regex matches nothing
    // and fails against markup that is correct.
    expect(html).toMatch(/<dt[^>]*>Products<\/dt>\s*<dd[^>]*>07<\/dd>/);
    expect(html).toMatch(/<dt[^>]*>Categories<\/dt>\s*<dd[^>]*>03<\/dd>/);
    // Not padded: `padStart(2)` leaves a four-digit year alone, which is what
    // makes it safe to apply to every row rather than case by case.
    expect(html).toMatch(/<dt[^>]*>Established<\/dt>\s*<dd[^>]*>2015<\/dd>/);
  });

  /**
   * THE OVERSIZED NUMERAL IS A SECTION INDEX, NOT A STATISTIC.
   *
   * It was the product count, and a review caught the flaw: an outlined 94 sat
   * inches from a stated 94, so the same figure was read twice inside one
   * cluster and the device was decoration and data at once.
   *
   * The tie-breaker is not taste. `SectionIndex` draws with
   * `-webkit-text-stroke` over a transparent fill, so it renders as NOTHING in
   * a browser without that property — the right failure for an ornament and a
   * disqualifying one for information. A fact whose only carrier can vanish
   * has not been stated. So the numeral is "01", it is aria-hidden, and every
   * counted total lives in the index below as real text.
   */
  it('marks the hero as section 01, decoratively and out of the accessibility tree', async () => {
    const html = await renderHero();

    expect(countElements(html, 'section-index')).toBe(1);
    expect(html).toMatch(/class="[^"]*section-index[^"]*"[^>]*aria-hidden="true"[^>]*>\s*01\s*</);

    // And it is no longer a copy of a statistic: the fixture's product count
    // is 7, which must appear only in the index.
    expect((html.match(/>07</g) ?? []).length).toBe(1);
  });

  /**
   * The headline is two spans on ONE source line. `tests/e2e/home.spec.ts`
   * reads `textContent` directly rather than through a matcher that collapses
   * whitespace, because "Home andindustrial" has shipped once already — a
   * newline introduced between these spans puts it straight back.
   */
  it('keeps the headline text exact across the two composed lines', async () => {
    const html = await renderHero();
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? '';
    expect(h1.replace(/<[^>]+>/g, '')).toBe('Home and industrial solutions.');
  });
});
