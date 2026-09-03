import { expect, test } from '@playwright/test';

/**
 * The first gate for rule 4.
 *
 * `handoff.md` §"Verify" says it plainly: rule 4 has no static gate, nothing in
 * the repository resolves a rendered font size against its background, and a
 * green axe run is a floor rather than a certificate — axe missed `.en td` at
 * 4.48:1 and a serious Label in Name failure on all 72 product cards.
 *
 * WHY THIS EXISTS NOW. The weight scale (see `src/styles/tokens.css`) lowered
 * the global `h1-h4` default from 700 to 600. WCAG counts text as *large* — and
 * therefore subject to the 3:1 bar rather than 4.5:1 — at >=24px, OR at
 * >=18.66px when **bold**. Three red headings on white sat in that second band
 * and cleared 3:1 at 4.30:1 while failing 4.5:1, so they passed only because of
 * a weight declared in a different file. Lowering it broke all three at once
 * and nothing would have said so.
 *
 * WHAT THIS IS NOT. It is not a general WCAG sweep. It resolves a background by
 * walking up the ancestor chain for the first non-transparent `background-color`
 * — which is right for these flat surfaces and wrong over an image or a
 * gradient. It only checks the selectors it is given. A general sweep is a
 * larger piece of work and is deliberately not attempted here; the value of
 * this one is that adding a selector is a single line, and that a weight change
 * can no longer silently move an element across the large-text boundary.
 *
 * The division-page headers are the known case it CANNOT cover: their nav links
 * pass only because of a scrim over a photograph (6.04:1 composited, 1.11:1
 * against the raw image). That needs pixel sampling, not computed style, and is
 * queued separately in `BACKLOG.md`.
 */

/**
 * Elements whose contrast depends on the weight scale, or on the surface map,
 * holding.
 *
 * EXPANDED FOR THE WHITE THEME, 2026-08-20. Two of the original five inverted
 * rather than disappeared, and both were rewritten rather than deleted — a
 * deleted case is a pairing nobody measures again.
 */
const CASES = [
  { path: '/', selector: '.hero__lede', what: 'hero lede (#bfbfc6 on the dark band)' },
  { path: '/', selector: '.hero__proof dt', what: 'hero proof-strip label (10px mono on the dark band)' },
  { path: '/', selector: '.cg__count', what: 'category tile count (11px red on white)' },
  { path: '/', selector: '.steps__body', what: 'enquiry step body (14px muted on white)' },
  { path: '/why-spartan', selector: '.rs__title', what: 'why-spartan reason title (19px red on white)' },
  { path: '/about', selector: '.dv__name', what: 'about division name (21px, inherits h3 weight)' },
  // Moved from --color-black to --surface-alt. Measures 3.99:1 there and passes
  // ONLY as large display type — the same >=18.66px-bold boundary the
  // 2026-08-11 typography spec showed can be crossed silently by a weight
  // change in a different file.
  { path: '/', selector: '.hero__title span', what: 'hero accent (large display on --surface-alt, 3:1 bar)' },
  // Was described as "micro label on dark". It is on light now, and at 11px the
  // bar is 4.5:1, which is why Eyebrow resolves --accent-text rather than
  // brand red.
  { path: '/', selector: '.eyebrow', what: 'eyebrow micro label on light (11px, 4.5:1 bar)' },
  // Product cards and breadcrumbs live on a category page, not on the home
  // page or the catalogue index. hand-protection is chosen because it is the
  // range that also carries EN 388 tables.
  { path: '/catalogue/hand-protection', selector: '.card__kicker', what: 'product card kicker (muted micro label)' },
  { path: '/catalogue/hand-protection', selector: '.card__name', what: 'product card name' },
  { path: '/catalogue/hand-protection', selector: '.crumbs__current', what: 'breadcrumb current item on light' },
  { path: '/products/chem-guard', selector: '.en td', what: 'EN 388 rating cell — shipped once at 4.48:1, axe did not catch it' },
  // Both are hidden by media query on a phone: the utility bar below 820px and
  // the desktop nav below 1080px. `minWidth` skips rather than lets them fail
  // as "missing" — a skip says the element is absent by design, where a failure
  // would say the page is broken.
  { path: '/', selector: '.nav__link', what: 'header nav link on white', minWidth: 1081 },
  // The one dark surface left on the public site. Inside `.on-dark`,
  // --text-muted resolves back to --color-grey, which is 6.13:1 on the
  // footer's black — this asserts that re-pointing actually happened.
  { path: '/', selector: '.f-bot', what: 'footer muted text inside .on-dark' },
];

/** sRGB relative luminance, WCAG 2.x §relative-luminance. */
function luminance([r, g, b]: number[]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: number[], bg: number[]): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const parseRgb = (s: string): number[] =>
  (s.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);

for (const { path, selector, what, minWidth } of CASES) {
  test(`${what} clears its WCAG bar`, async ({ page }, testInfo) => {
    const width = page.viewportSize()?.width ?? 0;
    test.skip(
      minWidth !== undefined && width < minWidth,
      `${selector} is hidden by media query below ${minWidth}px — absent by ` +
        `design at ${testInfo.project.name}'s ${width}px, not broken`,
    );

    await page.goto(path);

    const el = page.locator(selector).first();
    await expect(el, `${selector} must exist on ${path} — a renamed class would
      otherwise make this gate pass by testing nothing`).toBeVisible();

    const measured = await el.evaluate((node) => {
      const s = getComputedStyle(node as Element);
      // Walk up for the first painted background. `transparent` and
      // `rgba(…, 0)` both mean "keep looking".
      //
      // ALPHA IS PARSED, NOT PATTERN-MATCHED — fixed 2026-08-20. This tested
      // `!/,\s*0\s*\)$/` against the whole colour string, and `rgb(0, 0, 0)`
      // ends in ", 0)" — so PURE BLACK was read as transparent and the walk
      // continued past it. The bug was invisible for as long as it existed
      // because the dark theme's surfaces are #08080a, #0e0e11 and #151519 and
      // none of them is pure black. The footer is `#000`, and the moment a case
      // measured inside it the walk sailed past the footer to the white body
      // and reported 3.43:1 against a background that is not there.
      //
      // A gate that resolves the wrong background does not fail loudly; it
      // reports a plausible number for a pairing that does not exist.
      const opaque = (c: string): boolean => {
        if (!c || c === 'transparent') return false;
        const parts = c.match(/[\d.]+/g);
        if (!parts) return false;
        return parts.length < 4 || Number(parts[3]) !== 0;
      };

      let bg = 'rgba(0, 0, 0, 0)';
      for (let n: Element | null = node as Element; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        if (opaque(c)) {
          bg = c;
          break;
        }
      }
      return {
        color: s.color,
        background: bg,
        fontSize: parseFloat(s.fontSize),
        fontWeight: parseInt(s.fontWeight, 10),
      };
    });

    // WCAG 2.1 §1.4.3: large is >=24px, or >=18.66px AND bold (>=700).
    // Bold alone does not make text large, and size alone does not either
    // below 24px — this repo has shipped a defect from each half of that.
    const isLarge =
      measured.fontSize >= 24 || (measured.fontSize >= 18.66 && measured.fontWeight >= 700);
    const bar = isLarge ? 3 : 4.5;
    const actual = ratio(parseRgb(measured.color), parseRgb(measured.background));

    expect(
      actual,
      `${what}\n` +
        `  ${measured.fontSize}px / weight ${measured.fontWeight} => ` +
        `${isLarge ? 'LARGE' : 'NORMAL'} text, bar ${bar}:1\n` +
        `  ${measured.color} on ${measured.background} = ${actual.toFixed(2)}:1`,
    ).toBeGreaterThanOrEqual(bar);
  });
}
