import { expect, test } from '@playwright/test';

/**
 * The home page, as rebuilt on 2026-09-03
 * (docs/superpowers/specs/2026-09-03-landing-redesign-design.md).
 *
 * `src/pages/index.astro` renders Hero, CategoryGrid, SelectedProducts,
 * EnquirySteps, About, Faq and EnquiryCta. This file covers the hero's
 * composition and proposition, the fifteen-category directory and its honest
 * empty tile, the eight product cards, the header, and the section numbering
 * system that runs across all of them.
 *
 * hero-carousel.spec.ts covers the campaign band; motion.spec.ts covers
 * prefers-reduced-motion; quick-enquiry.spec.ts covers the closing form.
 */

test.describe('the hero headline', () => {
  test('renders exactly one visible h1 with the real headline text', async ({ page }) => {
    await page.goto('/');

    // `h1`, not getByRole('heading', level: 1) — the assertion is about the
    // literal element, and the previous hero's h1 was present but sr-only, so
    // "exists" is not the bar here; "visible" is.
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
    await expect(h1).toBeVisible();

    /*
     * `.textContent`, read directly, not Playwright's `toHaveText` — that
     * matcher collapses internal whitespace before comparing, which would
     * paper over exactly the defect this test exists to catch. The markup is
     * `Home and <br />industrial <br /><span>solutions.</span>`: a space was
     * added before each `<br />` because without it `textContent` runs the
     * words together ("Home andindustrial solutions.") — that has shipped
     * once already.
     */
    const text = await h1.evaluate((el) => el.textContent);
    expect(text).toBe('Home and industrial solutions.');
  });
});

test.describe('the hero banner band', () => {
  /*
   * THE COVERAGE THAT USED TO BE HERE HAS MOVED, IN TWO DIRECTIONS.
   *
   * Two tests sat here asserting the band was EMPTY — no slides, no pips, no
   * pause control. They were honest when written on 2026-08-20, when the client
   * had just had the six portrait posters deleted. They stopped being honest on
   * 2026-08-23 when banners were uploaded again, and **nothing noticed for four
   * days**, because `--full` builds against a test database whose banner table
   * was empty. Green on a state production had left.
   *
   * Markup — slide and pip counts, the loop duplicate, the empty alts, the
   * eager first image, and the empty-band branch itself — is now in
   * `src/components/sections/Hero.test.ts`, which renders the component with
   * whatever banner list it is handed and so covers BOTH states in one run,
   * with no build and no database.
   *
   * Behaviour that needs a browser — the pause control actually stopping the
   * animation, WCAG 2.2.2 — is in `tests/e2e/hero-carousel.spec.ts`, against a
   * seeded fixture rather than an accident of configuration.
   *
   * What is left here is the home page's own concern: that the band is on the
   * page, before the shelf, and silent.
   */
  test('is present in the hero, above the category shelf', async ({ page }) => {
    await page.goto('/');

    const stage = page.locator('.hero__stage');
    await expect(stage).toBeVisible();

    // Either state passes here — this file does not own which one the build is
    // in, only that the band exists and comes before the shelf.
    const band = await stage.evaluate((el) => ({
      hasCarousel: !!el.querySelector('.hero__track'),
      hasSlot: !!el.querySelector('.hero__slot'),
    }));
    expect(band.hasCarousel || band.hasSlot).toBe(true);

    const shelfFollows = await page.evaluate(() => {
      const s = document.querySelector('.hero__stage');
      const shelf = document.querySelector('.cg__grid');
      if (!s || !shelf) return false;
      return Boolean(s.compareDocumentPosition(shelf) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(shelfFollows).toBe(true);
  });

  /**
   * The band carries marketing posters whose content is baked-in text that alt
   * cannot reproduce, and every product on them is in the catalogue below — so
   * it is decorative in either state and must not be announced. The <h1> and
   * the two CTAs carry the hero's meaning.
   */
  test('is decorative in whichever state it is in, so it is not announced', async ({ page }) => {
    await page.goto('/');

    const hidden = await page.evaluate(() => {
      const el = document.querySelector('.hero__track') ?? document.querySelector('.hero__slot');
      return el?.getAttribute('aria-hidden');
    });
    expect(hidden).toBe('true');

    // The mockup's "or browse files" affordance is never rendered — it would be
    // a link that does nothing.
    await expect(page.getByText(/browse files/i)).toHaveCount(0);
  });
});

test.describe('the category shelf', () => {
  test('lists fifteen categories with exactly one marked empty', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.cg__grid li')).toHaveCount(15);

    // Electrical Accessories stocks nothing. The design mockup filled its tile
    // with a borrowed product photo from another category — a picture in a
    // range that has no stock is a false claim, so it must render the
    // marked-empty state instead.
    //
    // This was 2 until 2026-08-17: Spill Control stocked nothing either, until
    // the campaign banners supplied a real seven-SKU range for it. The count is
    // asserted rather than the mere presence of an empty tile, so a category
    // quietly acquiring or losing stock fails here.
    await expect(page.locator('.cg__empty')).toHaveCount(1);
  });

  test('shows the catalogue-derived count on the Fans & Ventilation tile', async ({ page }) => {
    await page.goto('/');

    // Scoped to the one tile, not asserted as a bare string search on the
    // page — Body Protection legitimately shows "4 items" and a page-wide
    // search for that text would pass for the wrong reason.
    const fansTile = page
      .locator('.cg__grid li')
      .filter({ has: page.locator('.cg__name', { hasText: 'Fans & Ventilation' }) });
    await expect(fansTile).toHaveCount(1);

    // The design mockup hardcoded "4 items" here from the pre-datasheet
    // catalogue. The real count, from getCategories(), is 17 — this is the
    // assertion that would catch a copy-paste of the mockup's static array.
    await expect(fansTile.locator('.cg__count')).toHaveText('17 items');
  });
});

test.describe('selected products', () => {
  /*
   * The featured strip used to draw its own card and filter it with an inline
   * script. Since 2026-09-03 the section renders `ProductGrid` — the
   * catalogue's own card, specs and enquiry button included — so the basket
   * can start on the landing page. No tabs, no script, no CSP hash.
   */
  test('server-renders eight catalogue cards, each linking to its product', async ({ page }) => {
    await page.goto('/');
    const cards = page.locator('.sp__grid > li');
    await expect(cards).toHaveCount(8);
    for (let i = 0; i < 8; i += 1) {
      await expect(cards.nth(i).locator('a.card__link')).toHaveAttribute('href', /^\/products\//);
    }
    await expect(page.locator('[data-featured-tabs]')).toHaveCount(0);
  });

  test('carries the enquiry button on every card once hydrated', async ({ page }) => {
    await page.goto('/');
    // `client:visible` islands hydrate on scroll — docs/TRAPS.md. Scroll the
    // grid into view before counting, or the buttons legitimately do not exist.
    await page.locator('.sp__grid').scrollIntoViewIfNeeded();
    await expect(page.locator('.sp__grid > li button')).toHaveCount(8);
  });
});

test.describe('selected products without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('still lists all eight cards', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.sp__grid > li')).toHaveCount(8);
  });
});

test.describe('the hero proposition', () => {
  const settled = async (page: import('@playwright/test').Page) => {
    /* `hero-rise` starts at translateY(16px); measure after the finite
       animations end or a box is read mid-motion. docs/TRAPS.md. */
    await page.evaluate(async () => {
      const finite = document.getAnimations().filter((a) => {
        const t = a.effect?.getComputedTiming();
        return t != null && t.iterations !== Infinity;
      });
      await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
    });
  };

  test('states what Spartan supplies in words, and the proof as sourced facts', async ({ page }) => {
    await page.goto('/');

    const lede = page.locator('.hero__lede');
    await expect(lede).toBeVisible();
    await expect(lede).toContainText('PPE and workwear');

    // 94 and 15 are COUNTED through the seam; `tools/catalogue-snapshot.json`
    // is what makes changing them deliberate. The year and the manufacturing
    // statement are the only other facts on this site with a source.
    const proof = page.locator('.hero__proof');
    await expect(proof).toContainText('94');
    await expect(proof).toContainText('15');
    await expect(proof).toContainText('2015');
    await expect(proof).toContainText('India & China');
    await expect(proof).not.toContainText('Divisions');
    await expect(proof.locator('.hero__proof-cell')).toHaveCount(4);
  });

  test('opens both divisions from the hero with counted totals', async ({ page }) => {
    await page.goto('/');
    const doors = page.locator('.hero__door');
    await expect(doors).toHaveCount(2);
    await expect(doors.nth(0)).toHaveAttribute('href', '/electricals');
    await expect(doors.nth(1)).toHaveAttribute('href', '/safety');
    // Fifteen categories split across the two doors, and every product is in
    // exactly one — the totals on the doors must add up to the proof strip's.
    const text = await doors.allTextContents();
    const numbers = text.map((t) => [...t.matchAll(/(\d+) (categor|product)/g)].map((m) => Number(m[1])));
    expect(numbers[0][0] + numbers[1][0]).toBe(15);
    expect(numbers[0][1] + numbers[1][1]).toBe(94);
  });

  test('runs the composition off one left axis and closes on the wrap', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/');
    await settled(page);

    const box = async (sel: string) => (await page.locator(sel).boundingBox())!;

    const masthead = await box('.hero__masthead');
    const title = await box('.hero__title');
    const lede = await box('.hero__lede');
    const actions = await box('.hero__actions');
    const doors = await box('.hero__doors');

    // One left axis: masthead, headline, lede, actions and doors start together.
    for (const b of [title, lede, actions, doors]) {
      expect(Math.round(b.x)).toBe(Math.round(masthead.x));
    }

    // The numeral ends on the wrap's right edge — the line every section
    // numeral on the page ends on.
    const headRight = await page
      .locator('.hero__head')
      .evaluate((el) => Math.round(el.getBoundingClientRect().right));
    const numeral = await box('.hero__head .section-index');
    expect(Math.round(numeral.x + numeral.width)).toBe(headRight);

    // Two doors of equal width, below the actions.
    const doorBoxes = await page
      .locator('.hero__door')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
    expect(Math.round(doorBoxes[0].width)).toBe(Math.round(doorBoxes[1].width));
    expect(doorBoxes[0].y).toBeGreaterThan(actions.y + actions.height);

    // The photograph is a column beside the copy, not a backdrop behind it:
    // it starts on the headline's line and its right edge is the wrap's.
    const vis = await box('.hero__vis');
    expect(vis.x).toBeGreaterThan(title.x + title.width - 8);
    expect(Math.round(vis.x + vis.width)).toBe(headRight);
    expect(Math.abs(vis.y - title.y)).toBeLessThan(4);

    // The campaign band follows the hero band on the page surface.
    const band = await box('.hero__band');
    const stage = await box('.hero__stage');
    expect(stage.y).toBeGreaterThanOrEqual(band.y + band.height - 1);
  });

  test('sets both headline lines on one edge, the second in the accent', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/');

    const ink = async (sel: string) =>
      await page.locator(sel).evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        return range.getBoundingClientRect().left;
      });

    // No staircase since 2026-09-03: the two lines start on the same axis.
    expect(Math.abs((await ink('.hero__title-a')) - (await ink('.hero__title-b')))).toBeLessThan(3);

    // Brand red on --color-black, 4.65:1 — legal because the line is >=40px.
    await expect(page.locator('.hero__title-b')).toHaveCSS('color', 'rgb(235, 41, 39)');
    const size = await page
      .locator('.hero__title-b')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(40);
  });

  test('keeps the headline inside a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');

    const box = await page.locator('.hero__title').boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);
  });
});

test.describe('header search', () => {
  /*
   * DESKTOP-ONLY, AND THAT IS THE DESIGN, NOT A GAP. Below the 1080px menu
   * boundary the row is logo, trigger and badge, and the search box would take
   * the width the trigger needs — the second test in this block asserts it is
   * hidden there. The `mobile` project is a 393px Pixel 5, so these run against
   * an explicit desktop viewport rather than being skipped: the behaviour is
   * the same in both projects once the width is.
   */
  test('carries the typed term through to the catalogue filter', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const box = page.locator('.nav__search-input');
    await expect(box).toBeVisible();

    await box.fill('helmet');
    await box.press('Enter');

    // A plain GET form: no island, no inline script, and therefore no CSP
    // hash to keep in sync.
    await page.waitForURL(/\/catalogue\?q=helmet$/);

    // The island seeds itself from `?q=` on mount — the one URL parameter it
    // reads, and the reason is in CatalogueFilters.tsx.
    await expect(page.locator('#cf-search')).toHaveValue('helmet');

    const shown = page.locator('.cf__count, [data-search]:visible');
    await expect
      .poll(async () => await page.locator('li:not([hidden]) [data-search]').count())
      .toBeLessThan(94);
    expect(await shown.count()).toBeGreaterThan(0);
  });

  test('is absent below the desktop menu boundary rather than crowding the trigger', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.goto('/');

    // Not removed from the DOM — hidden. Search is still one tap away through
    // the mobile panel's /catalogue link, which carries the same field.
    await expect(page.locator('.nav__search')).toBeHidden();
    await expect(page.locator('.nav__mobile')).toBeVisible();
  });
});

test.describe('the header phone affordance', () => {
  test('offers a route that works while the number is a placeholder', async ({ page }) => {
    // `.nav__tel` is hidden below 520px, where the row belongs to the trigger.
    // The affordance is a desktop one; the assertion is about which affordance
    // it is, so it is made at a width where it exists.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const tel = page.locator('.nav__tel');
    await expect(tel).toBeVisible();

    const href = await tel.getAttribute('href');

    // THE POINT OF THIS TEST. `site.phone` ships as `+971 00 000 0000`, and a
    // `tel:` link to it dials nothing on every page of the site. Either the
    // number is real and this is a tel: link, or it is not and this goes
    // somewhere that works — never a tel: link to a placeholder.
    if (href?.startsWith('tel:')) {
      expect(href).not.toMatch(/0{4,}/);
    } else {
      expect(href).toBe('/contact');
      await expect(tel).toContainText('Contact sales');
    }
  });
});

test.describe('the carousel control rail', () => {
  test('aligns with the banner it controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const controls = page.locator('.hero__controls');
    if ((await controls.count()) === 0) {
      // The empty-band state has no controls, by design: a pause button with
      // nothing to pause is a dead affordance. Nothing to align.
      test.skip();
      return;
    }

    const frameBox = (await page.locator('.hero__frame').boundingBox())!;
    const railBox = (await controls.boundingBox())!;

    /*
     * THE RAIL IS DELIBERATELY NOT THE WIDTH OF THE BAND ANY MORE.
     *
     * It was, briefly, and before that it was 940px against a 1176px frame —
     * the copy column's measure, which left it visibly inset from the artwork
     * it controls. Matching the frame fixed that and created a different
     * problem: a progress indicator spanning 1160px reads as one more
     * horizontal rule across a hero that already had too many. It is capped at
     * 340 now and sits at the right end of the campaign bar.
     *
     * What still has to hold is that it stays INSIDE the band's own edges.
     */
    expect(railBox.width).toBeLessThan(400);
    expect(railBox.x).toBeGreaterThanOrEqual(Math.round(frameBox.x) - 1);
    expect(railBox.x + railBox.width).toBeLessThanOrEqual(
      Math.round(frameBox.x + frameBox.width) + 1,
    );
  });
});

/**
 * THE NUMBERING IS COMPLETE OR IT DOES NOT EXIST.
 *
 * A design review on 2026-08-29 called the previous half-implementation
 * "borrowed rather than designed": the hero carried `01`, the catalogue shelf
 * carried `02` placed by different logic, and the other seven sections carried
 * nothing. Its verdict was the right one — commit fully or remove it, because
 * a halfway system is worse than none.
 *
 * This is the invariant that keeps that decision from rotting. Without it the
 * page drifts back to half-committed one section at a time, the next time
 * somebody adds a section and forgets the numeral, and nothing anywhere would
 * say so.
 */
test.describe('the section numbering system', () => {
  test('runs 01 upward with no gaps and no repeats', async ({ page }) => {
    await page.goto('/');

    const numerals = await page.locator('.section-index').allTextContents();
    const trimmed = numerals.map((t) => t.trim());

    expect(trimmed.length).toBeGreaterThanOrEqual(7);

    // Zero-padded to two digits, ascending by one, starting at 01. Written as
    // the expected array rather than as a loop so a failure prints the actual
    // sequence, which is the thing you need to see.
    const expected = trimmed.map((_, i) => String(i + 1).padStart(2, '0'));
    expect(trimmed).toEqual(expected);
  });

  test('numbers every headed section, and only sections', async ({ page }) => {
    await page.goto('/');

    // One numeral per shared head, plus the hero's — the hero composes its own
    // head rather than rendering the primitive, and it is section 01.
    const heads = await page.locator('.sec').count();
    const numerals = await page.locator('.section-index').count();
    expect(numerals).toBe(heads + 1);

    // The campaign band inside the hero has no heading and takes no number.
    // If it ever gains one, that is a decision, not a default.
    expect(await page.locator('.hero__stage .section-index').count()).toBe(0);
  });

  test('keeps every numeral out of the accessibility tree', async ({ page }) => {
    await page.goto('/');

    // Decoration, always. `SectionIndex` draws with `-webkit-text-stroke` over
    // a transparent fill and renders as nothing where that is unsupported, so
    // it must never be the only carrier of anything a reader needs.
    const exposed = await page.locator('.section-index:not([aria-hidden="true"])').count();
    expect(exposed).toBe(0);
  });
});

/**
 * THE NUMERALS SHARE ONE EDGE AND ONE SCALE.
 *
 * Added after reading a PDF of the rendered page, which showed three things no
 * amount of reading the CSS had: the numeral in every two-column section sat
 * in the MIDDLE of the page rather than at the measure's edge, because it was
 * anchored to a head block whose width varied; content sections carried a
 * BIGGER numeral than the hero, because the size rule multiplied a heading's
 * clamp ceiling rather than the heading; and three of them crossed the
 * boundary into the section above with the join visible straight through them.
 *
 * All three were the same shape of mistake — a rule that was being followed
 * exactly while measuring the wrong thing — and none of them is visible in a
 * component read on its own. These assertions are the cheap version of looking
 * at the whole page.
 */
test.describe('the numbering system holds its geometry', () => {
  test('every numeral ends on the same vertical line', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const rights = await page.locator('.section-index').evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().right)),
    );

    expect(rights.length).toBeGreaterThanOrEqual(7);
    expect(new Set(rights).size).toBe(1);
  });

  test('the hero carries the largest numeral on the page', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const sizes = await page.locator('.section-index').evaluateAll((els) =>
      els.map((el) => parseFloat(getComputedStyle(el).fontSize)),
    );

    const [hero, ...sections] = sizes;
    // 3.5x the section's own heading, so the hero's is larger by construction.
    // If a content section ever out-scales it, the multiplier has been applied
    // to a ceiling somewhere instead of to the live clamp.
    expect(hero).toBeGreaterThan(Math.max(...sections));
  });

  test('no numeral crosses out of its own section', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const escapes = await page.locator('.section-index').evaluateAll((els) =>
      els
        .map((el) => {
          const box = el.getBoundingClientRect();
          const section = el.closest('section')!.getBoundingClientRect();
          return { n: el.textContent?.trim(), above: Math.round(section.top - box.top) };
        })
        // `line-height: 0.7` means the ink overflows the element's own box, so
        // a little tolerance is honest; a numeral genuinely straddling the join
        // sits tens of pixels out, not two.
        .filter((r) => r.above > 8),
    );

    expect(escapes).toEqual([]);
  });
});
