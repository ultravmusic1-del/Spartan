/**
 * The header's relationship with the page as it scrolls.
 *
 * THREE STATES, and every page uses the same three so the site behaves one way:
 *
 *   at rest    scrollY is 0. The header sits over the page. On the three pages
 *              that overlay a hero it is transparent here, which is the whole
 *              point of that mode.
 *   engaged    the page has moved. The header is opaque, because it is fixed or
 *              sticky and page content is now passing underneath it.
 *   away       the reader is scrolling DOWN. The header lifts out of view, so a
 *              phone gets its full screen back; any upward scroll brings it
 *              straight down again.
 *
 * WHY "AWAY" RATHER THAN A BAR THAT IS ALWAYS THERE. On a fifteen-screen page a
 * permanent 86px bar is 10% of a phone screen spent on chrome the reader is not
 * using, and it sits on top of the content they are. Hiding it while they move
 * away from it and returning it the instant they move back is the behaviour the
 * client described wanting before they knew it had a name: they were scrolling
 * up to get the header back.
 *
 * WHAT WENT WRONG BEFORE, because it explains the thresholds. The first version
 * only turned the header opaque past its own height, on the reasoning that the
 * hero reserves exactly that much clearance. It does not: the hero's padding is
 * `--hero-chrome + 28px`, so the masthead and the section numeral begin at 114px
 * and slid up INTO a still-transparent bar, colliding with the logo and the menu
 * button. The bar has to go opaque the moment the page moves at all, not once it
 * has moved a header's worth.
 *
 * THINGS THIS MUST NOT DO, each of which is a real failure and not a hypothetical:
 *
 *   - Hide while the mobile menu is open. The panel is INSIDE the header
 *     (docs/TRAPS.md), so lifting the header takes the open menu with it.
 *   - Hide while something in it has keyboard focus, which would scroll the
 *     focused control off screen while the reader is using it.
 *   - Slide at all for a reader who asked for reduced motion. There it simply
 *     stays put once engaged — a bar that appears and vanishes without the
 *     movement that explains it is worse than one that never leaves.
 *   - Flap. Touch scrolling delivers a stream of tiny deltas in both directions,
 *     so a direction change only counts past `DELTA`.
 */
const header = document.querySelector<HTMLElement>('.site-header');

if (header) {
  /* Captured before anything is toggled: restoring the top state cannot depend
     on reading a class this module itself removes. */
  const startsOnDark = header.classList.contains('on-dark');

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /** Past this the header is opaque. One pixel of movement is enough. */
  const ENGAGE = 1;

  /** Below this the header never lifts — it would be hiding next to its own
      resting place, which reads as a flicker rather than as getting out of the
      way. Two header heights. */
  const HIDE_AFTER = 180;

  /** A direction change smaller than this is scroll noise, not an intent. */
  const DELTA = 6;

  let lastY = Math.max(0, window.scrollY);
  let engaged: boolean | null = null;
  let away: boolean | null = null;

  const menuIsOpen = (): boolean =>
    header.querySelector('[aria-expanded="true"]') !== null;

  const holdsFocus = (): boolean =>
    header.contains(document.activeElement) && document.activeElement !== document.body;

  const setEngaged = (next: boolean): void => {
    if (next === engaged) return;
    engaged = next;
    header.classList.toggle('is-scrolled', next);
    /* `on-dark` means "this header is over photography", which stops being true
       the moment it turns opaque. Removing the class reverts the lockup, the
       link colours and every other dark-surface rule together, as one state,
       rather than each being unpicked in CSS and drifting apart later. */
    if (startsOnDark) header.classList.toggle('on-dark', !next);
  };

  const setAway = (next: boolean): void => {
    if (next === away) return;
    away = next;
    header.classList.toggle('is-away', next);
  };

  const paint = (): void => {
    /* iOS rubber-banding reports a negative scrollY past the top, which would
       otherwise read as a large upward movement and fight the top state. */
    const y = Math.max(0, window.scrollY);
    const moved = y - lastY;

    setEngaged(y > ENGAGE);

    if (reduced.matches || menuIsOpen() || holdsFocus() || y <= HIDE_AFTER) {
      setAway(false);
    } else if (moved > DELTA) {
      setAway(true);
    } else if (moved < -DELTA) {
      setAway(false);
    }

    /* Only move the reference when the gesture was big enough to act on, or a
       slow drag never accumulates past DELTA and the header never responds. */
    if (Math.abs(moved) > DELTA) lastY = y;
  };

  let ticking = false;
  const schedule = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      paint();
      ticking = false;
    });
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  /* Opening the menu or focusing something inside the header has to bring it
     back immediately, not at the next scroll event — by then the reader is
     looking at a control that is not on screen. */
  header.addEventListener('focusin', () => setAway(false));
  header.addEventListener('click', () => requestAnimationFrame(paint));
  reduced.addEventListener('change', schedule);

  /* A reload partway down a page restores the scroll position before this runs,
     so the first paint cannot assume the top. */
  paint();
}
