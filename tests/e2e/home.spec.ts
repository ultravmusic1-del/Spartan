import { expect, test } from '@playwright/test';

/**
 * The redesigned home page.
 *
 * `src/pages/index.astro` renders Hero, Ticker, CategoryGrid and FeaturedLines
 * before the retained editorial sections. This file covers those four: the
 * headline (now real text, not artwork), the fifteen-category shelf and its
 * two honest empty tiles, and the featured strip's server-rendered cards plus
 * its client-side division filter — mouse, keyboard and no-JavaScript.
 *
 * motion.spec.ts covers the ticker's pause control and prefers-reduced-motion
 * separately; this file does not touch either.
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

test.describe('featured lines', () => {
  test('server-renders eight cards, four per division', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.fl__grid li')).toHaveCount(8);
  });

  test('reveals the tab row and filters by division on click', async ({ page }) => {
    await page.goto('/');

    const tabs = page.locator('[data-featured-tabs]');
    const items = page.locator('.fl__grid li:not([hidden])');

    // Server-rendered with `hidden` on the tab row; the script removes it.
    // Asserting "visible" here is safe precisely because it is false first —
    // the row starts hidden and only becomes visible once the island runs.
    await expect(tabs).toBeVisible();

    await tabs.getByRole('button', { name: 'Electricals' }).click();
    // Four of the eight curated cards are Electricals by construction
    // (src/lib/featured.ts). Unfiltered is 8, so waiting on 4 here cannot
    // settle instantly against the pre-filter state.
    await expect(items).toHaveCount(4);

    await tabs.getByRole('button', { name: 'All' }).click();
    await expect(items).toHaveCount(8);
  });

  test('filters on Enter when a tab is activated by keyboard', async ({ page }) => {
    await page.goto('/');

    const tabs = page.locator('[data-featured-tabs]');
    await expect(tabs).toBeVisible();

    const items = page.locator('.fl__grid li:not([hidden])');
    const safetyTab = tabs.getByRole('button', { name: 'Safety' });

    // Keyboard activation of a <button>, not a click. This project's tab and
    // pill controls have a history of harnesses that never synthesised a
    // click from Enter on a real <button> element — Playwright does, so this
    // is the test that would have caught it.
    await safetyTab.focus();
    await page.keyboard.press('Enter');

    await expect(items).toHaveCount(4);
    await expect(safetyTab).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('featured lines without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows all eight cards and keeps the tab row hidden', async ({ page }) => {
    await page.goto('/');

    // The script that unhides the tab row and wires the filter never runs.
    // Showing a filter that cannot filter would be worse than showing none,
    // so all eight cards stay, unfiltered, and the tab row stays hidden
    // rather than sitting inert on the page.
    await expect(page.locator('.fl__grid li')).toHaveCount(8);
    await expect(page.locator('.fl__grid li[hidden]')).toHaveCount(0);
    await expect(page.locator('[data-featured-tabs]')).toBeHidden();
  });
});

/**
 * THE 2026-08-29 DESIGN PASS.
 *
 * A review of the above-the-fold experience found it visually strong and
 * semantically quiet: a first-time visitor could read the whole first screen
 * without discovering what Spartan supplies, the primary navigation was the
 * smallest type on the page, the catalogue's search box was two clicks away,
 * and fifteen category names scrolled past in a band that could not be
 * clicked. Everything below covers a change made in answer to one of those.
 *
 * Markup-only assertions live in `src/components/sections/Hero.test.ts`, which
 * needs no browser. What is here is what genuinely needs one: a form actually
 * navigating, an island actually seeding itself, and an animation actually
 * stopping.
 */
test.describe('the hero proposition', () => {
  test('states what Spartan supplies in words, and the totals as an index', async ({ page }) => {
    await page.goto('/');

    const lede = page.locator('.hero__lede');
    await expect(lede).toBeVisible();
    await expect(lede).toContainText('PPE and workwear');

    // 94 and 15 are the catalogue's real totals and they are COUNTED, not
    // typed — `tools/catalogue-snapshot.json` is what makes changing them a
    // deliberate act. If this fails after a genuine catalogue change, these
    // numbers are what is stale, not the hero.
    const index = page.locator('.hero__index');
    await expect(index).toContainText('94');
    await expect(index).toContainText('15');

    // The third row was "DIVISIONS / 02" until a review called it a weak
    // statistic that made the range sound unintentionally small. The
    // replacements suggested — dealers, markets, territories — are all
    // unsourceable here, so the founding year took the slot: on file, already
    // published on the About page, and the one credibility figure that is not
    // an invention.
    await expect(index).toContainText('2015');
    await expect(index).not.toContainText('Divisions');
  });

  test('runs the composition off a left axis rather than centring it', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/');

    /*
     * THE HERO'S BLANDNESS WAS MEASURABLE, so this guards against it coming
     * back. A design review found the composition "killing the energy" with
     * five centred strips stacked down the middle.
     *
     * THE LEDE LEFT THE LEFT AXIS ON 2026-08-30, at the client's explicit
     * instruction, and this test changed with it rather than being deleted.
     * The old arrangement — masthead, headline and lede all on one left edge,
     * numeral alone on the right — measured a 463 x 190 hole between the
     * headline's last letter and that numeral, the largest empty region on the
     * page. The lede is real content and now fills it.
     *
     * What is asserted instead is stricter than what it replaced: the block is
     * still driven off the left axis, and the rail's two members each share a
     * real edge with the headline rather than sitting at a chosen distance
     * from it.
     */
    /* Wait for `hero-rise` before measuring anything. It starts at
       translateY(16px), the headline carries it and the numeral does not, so a
       geometry read taken straight after `goto` compares a settled element with
       one still 16px low — which is exactly what this assertion caught the
       first time it was written. docs/TRAPS.md records the same hazard. */
    await page.evaluate(async () => {
      const finite = document.getAnimations().filter((a) => {
        const t = a.effect?.getComputedTiming();
        return t != null && t.iterations !== Infinity;
      });
      await Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
    });

    const box = async (sel: string) => (await page.locator(sel).boundingBox())!;

    const masthead = await box('.hero__masthead');
    const title = await box('.hero__title');
    const lede = await box('.hero__lede');
    const numeral = await box('.hero__composition .section-index');

    // The left axis survives: masthead and headline still start together.
    expect(Math.round(title.x)).toBe(Math.round(masthead.x));

    // The lede is in the right rail, clear of the headline's column.
    expect(lede.x).toBeGreaterThan(title.x + title.width);

    // A shared edge, not a distance: the numeral starts on the headline's line.
    expect(Math.round(numeral.y)).toBe(Math.round(title.y));

    // The rail closes on the wrap's right edge, which is the hero's second
    // vertical edge and the line every section numeral on the page ends on.
    const wrapRight = await page
      .locator('.hero__composition')
      .evaluate((el) => Math.round(el.getBoundingClientRect().right));
    expect(Math.round(numeral.x + numeral.width)).toBe(wrapRight);
    expect(Math.round(lede.x + lede.width)).toBe(wrapRight);

    // The lede is below the numeral in the rail, not beside it.
    expect(lede.y).toBeGreaterThan(numeral.y + numeral.height);

    // And the counted index still anchors the opposite end of the CTA row.
    const index = await box('.hero__index');
    expect(index.x).toBeGreaterThan(title.x + 600);
  });

  test("steps the second headline line right, flush to the first line's end", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.goto('/');

    /*
     * THE STAIRCASE IS AN ALIGNMENT NOW, NOT A DISTANCE. The h1 is
     * `fit-content` and line two is right-aligned inside it, so the red word's
     * last letter lands under the black line's last letter at every width —
     * an edge shared with another element instead of a margin that aligned
     * with nothing. Both spans are full-width blocks, so the assertion has to
     * measure the rendered TEXT via a Range; the span boxes are identical by
     * construction and would pass vacuously.
     */
    const ink = async (sel: string) =>
      await page.locator(sel).evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        return { left: r.left, right: r.right };
      });

    const a = await ink('.hero__title-a');
    const b = await ink('.hero__title-b');

    // Flush right: the two line-ends agree to within a couple of pixels of
    // italic overhang. Stepped left: line two starts well inside line one.
    expect(Math.abs(a.right - b.right)).toBeLessThan(4);
    expect(b.left).toBeGreaterThan(a.left + 60);

    const sizeA = await page
      .locator('.hero__title-a')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const sizeB = await page
      .locator('.hero__title-b')
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(sizeB).toBeGreaterThan(sizeA * 1.1);
  });

  test('keeps the staircase coherent on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto('/');

    // No off-screen ink: the flush-right mechanism self-limits to the h1's
    // own width, where the old margin-based offset needed a hand-written
    // collapse below 640px and once shipped without one.
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

test.describe('the category band as navigation', () => {
  test('every category is a real link, and only one copy is reachable', async ({ page }) => {
    await page.goto('/');

    // Fifteen reachable, and the duplicates that make the loop seamless carry
    // tabindex="-1" inside aria-hidden containers — out of the tab order and
    // out of the accessibility tree. A focusable element inside aria-hidden
    // would be a violation in its own right.
    const reachable = page.locator('.ticker a:not([tabindex="-1"])');
    await expect(reachable).toHaveCount(15);
    await expect(page.locator('.ticker a[tabindex="-1"]')).toHaveCount(45);

    await expect(reachable.first()).toHaveAttribute('href', /^\/catalogue\/[a-z0-9-]+$/);
  });

  test('stops under the pointer so a name can be read and clicked', async ({ page }, testInfo) => {
    /*
     * SKIPPED ON THE MOBILE PROJECT, and a viewport change cannot fix it.
     * The rule is inside `@media (hover: hover) and (pointer: fine)`, and the
     * Pixel 5 device profile sets touch — so `hover` is `none` there no matter
     * how wide the window is. That is deliberate: a hover rule that can latch
     * on a tap would leave the band stopped with no way to restart it, which
     * is the trap `Ticker.astro` records for the touch case.
     */
    test.skip(testInfo.project.name === 'mobile', 'hover does not exist on a touch device');

    await page.goto('/');

    const track = page.locator('.ticker__track');
    await expect(track).toHaveCSS('animation-play-state', 'running');

    // Without this the links are a moving target: a buyer reaching for "Hand
    // Protection" lands on "Safety Footwear". It is a convenience, NOT the
    // WCAG 2.2.2 mechanism — that is still the checkbox, because hover does
    // not exist on a touch screen.
    await page.locator('.ticker').hover();
    await expect(track).toHaveCSS('animation-play-state', 'paused');
  });

  test('lands on the category page it names', async ({ page }, testInfo) => {
    /*
     * DESKTOP ONLY, and the reason is a decision rather than a shortcut.
     *
     * On a touch device the band has no pause mechanism at all — a known,
     * client-accepted WCAG 2.2.2 failure recorded in `Ticker.astro` — and the
     * hover rule that stops it cannot apply either. Clicking a marquee that
     * cannot be stopped is racy by construction, and a test that flakes is
     * worse than a test that says what it does not cover. That the links exist
     * and point at real category pages IS covered on both projects, by the
     * test above.
     */
    test.skip(testInfo.project.name === 'mobile', 'no way to stop the band on touch');

    await page.goto('/');

    const first = page.locator('.ticker a:not([tabindex="-1"])').first();
    const href = await first.getAttribute('href');

    /*
     * WAIT FOR IT TO ACTUALLY STOP BEFORE CLICKING.
     *
     * The first version hovered and clicked in the next statement. It passed
     * alone and failed under ten workers: hovering pauses a track that is
     * mid-animation, and the click can still land after it has travelled. The
     * assertion between the two is the synchronisation — not decoration.
     *
     * `.check()` on the pause switch is NOT the alternative it looks like: the
     * input carries `pointer-events: none`, so even a forced click leaves it
     * unchanged. It is reachable by keyboard, which is what it is for.
     */
    await page.locator('.ticker').hover();
    await expect(page.locator('.ticker__track')).toHaveCSS('animation-play-state', 'paused');

    await first.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator('h1')).toBeVisible();
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

    expect(trimmed.length).toBeGreaterThanOrEqual(8);

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

    // The category ticker is a band, not a section: no heading, no number.
    // If it ever gains one, that is a decision, not a default.
    expect(await page.locator('.ticker .section-index').count()).toBe(0);
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

    expect(rights.length).toBeGreaterThanOrEqual(9);
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
