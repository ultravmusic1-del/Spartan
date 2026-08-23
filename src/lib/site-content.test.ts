import { describe, it, expect } from 'vitest';
import { getHeroBanners, getSiteSettings, heroClock } from './site-content';

/**
 * The seam for everything the public site renders that is NOT the catalogue.
 *
 * `catalog.ts` is rule 3's door for products; this is the same door for site
 * text and hero banners. The point of both is that swapping the source to
 * Postgres is a one-module change — which is exactly what Stage 2 of
 * `docs/superpowers/plans/2026-08-19-admin-content-management.md` then does.
 */
describe('getHeroBanners', () => {
  /*
   * THE BANNERS MOVED TO POSTGRES AND STORAGE ON 2026-08-23, and four tests
   * that used to live here went with them. What replaced them, and what did
   * not, is worth stating rather than leaving as a shorter file.
   *
   * Gone because they cannot mean anything any more:
   *
   *   - "names a file that exists on disk" — there is no disk. The image is an
   *     object in a private bucket, and `getHeroBanners` already throws when
   *     one cannot be signed, which is a stronger check made at build time
   *     against the real thing.
   *   - "no duplicate files" — `hero_banners.path` is `unique`, so the
   *     database refuses the duplicate rather than a test noticing it later.
   *   - "returns only enabled banners, in order" — now a `where enabled` and
   *     two `order by` clauses in the query. Task 9's end-to-end test exercises
   *     it against a real database, which is the only place it is decidable.
   *
   * GONE AND NOT REPLACED, WHICH IS A REAL LOSS AND NOT A TIDY-UP:
   *
   *   "excludes the two banners held back for stating a wrong product fact".
   *   The Grip Guard GP1 poster prints an EN 388 icon reading 4X43D while the
   *   glove's own label, photographed in that same banner, reads 4131X — cut
   *   resistance advertised as D where the glove says X, NOT TESTED. The Orbit
   *   Fan banner labels the fan FW-40W, a code belonging to no product.
   *
   *   That test worked by filename. Uploaded banners have generated paths and
   *   an admin-chosen name, so nothing in code can recognise those two
   *   artworks any more. The protection is now a person not uploading them,
   *   the standing warning at the top of Hero.astro, and the two BACKLOG.md
   *   items. **If either poster is ever reissued, correct the artwork first.**
   */
  it('returns nothing when there is no database, rather than throwing', async () => {
    /*
     * Vitest runs with no Supabase credentials, so this is the unconfigured
     * contract: no banners, and specifically NOT an error. The hero's empty
     * band is a designed state and a build without a database must still
     * produce a home page.
     */
    expect(await getHeroBanners()).toEqual([]);
  });
});

/**
 * The carousel's clock.
 *
 * This is the arithmetic that made the banner list worth moving into data at
 * all. Before it existed, `Hero.astro` carried three separate sets of literals —
 * keyframe stops, pip delays and a 42s duration — every one of them assuming
 * exactly six slides. Enabling a seventh banner would have lit the wrong pip:
 * a rendering bug to look at, arithmetic in fact.
 */
describe('heroClock', () => {
  it('reproduces the six-slide values that used to be hard-coded', () => {
    const clock = heroClock(6);

    // 42s, and stops at 16.667% / 14.286% — exactly what Hero.astro's static
    // keyframes said before this was derived. That equivalence is what makes
    // the refactor verifiable: the rendered page does not change.
    expect(clock.cycleSeconds).toBe(42);
    expect(Number(clock.stepPct.toFixed(3))).toBe(16.667);
    expect(Number(clock.holdPct.toFixed(3))).toBe(14.286);
    expect(clock.pipDelays).toEqual([0, 7, 14, 21, 28, 35]);
  });

  it('adapts when a banner is enabled or disabled', () => {
    // The whole point. Three slides is a 21s cycle with pips every 7s, and the
    // steps widen to a third of the cycle each.
    const three = heroClock(3);
    expect(three.cycleSeconds).toBe(21);
    expect(Number(three.stepPct.toFixed(3))).toBe(33.333);
    expect(three.pipDelays).toEqual([0, 7, 14]);

    const seven = heroClock(7);
    expect(seven.cycleSeconds).toBe(49);
    expect(Number(seven.stepPct.toFixed(3))).toBe(14.286);
    expect(seven.pipDelays).toEqual([0, 7, 14, 21, 28, 35, 42]);
  });

  it('gives one pip delay per slide, always', () => {
    // The invariant that actually prevents the defect: a pip per slide, and the
    // last one starting exactly one slide-width before the cycle ends.
    for (const n of [1, 2, 5, 6, 9, 12]) {
      const clock = heroClock(n);
      expect(clock.pipDelays).toHaveLength(n);
      expect(clock.pipDelays[n - 1]).toBe(clock.cycleSeconds - 7);
    }
  });

  it('keeps hold shorter than a full step, or a slide would never move', () => {
    for (const n of [1, 3, 6, 11]) {
      const clock = heroClock(n);
      expect(clock.holdPct).toBeLessThan(clock.stepPct);
      expect(clock.holdPct).toBeGreaterThan(0);
    }
  });

  it('refuses a slide count that cannot make a carousel', () => {
    expect(() => heroClock(0)).toThrow(/at least one slide/);
  });
});

describe('getSiteSettings', () => {
  it('returns the contact block and the industries list', async () => {
    const s = await getSiteSettings();

    expect(typeof s.phone).toBe('string');
    expect(typeof s.email).toBe('string');
    expect(typeof s.address).toBe('string');
    expect(Array.isArray(s.industries)).toBe(true);
    expect(s.industries).toHaveLength(8);
  });

  /*
   * handoff.md §8 item 5: the eight industries are inferred from the product
   * mix, not stated in the brochure, and the data says so. The flag has to
   * travel WITH the data so the admin can present them as unconfirmed rather
   * than as fact -- the whole reason it exists is that nobody remembers a
   * caveat that lives only in a document.
   */
  it('carries the flag saying the industries are still client-unconfirmed', async () => {
    const s = await getSiteSettings();
    expect(typeof s.industriesPendingClientConfirmation).toBe('boolean');
  });

  it('gives established as a number, which is what the JSON-LD builder needs', async () => {
    const s = await getSiteSettings();
    expect(typeof s.established).toBe('number');
    expect(s.established).toBeGreaterThan(1900);
  });
});
