/**
 * The overlay header solidifies once the page has scrolled.
 *
 * WHAT THIS IS FOR. Three pages put the header over a hero — the home page,
 * `/electricals` and `/safety` — and in that mode it was `position: absolute`,
 * pinned to the document rather than the viewport. It scrolled away at 86px and
 * did not come back until the reader returned to the very top. On the home page
 * that left 99.3% of a fifteen-screen page with no navigation, no menu button
 * and no sight of the enquiry basket, which is the mechanism the site converts
 * on. Reported as a phone fault on 2026-09-12; it reproduced identically in
 * Chromium and WebKit and at every width.
 *
 * `Header.astro` now pins that mode to the viewport with `fixed`, which leaves
 * the hero's geometry alone — `sticky` would have put the bar back into normal
 * flow and added 86px above a hero that already reserves exactly that much
 * clearance for it. This supplies the half CSS cannot: a fixed TRANSPARENT bar
 * has page content running underneath it, so past the hero's own clearance it
 * has to take a background.
 *
 * IT REMOVES `on-dark` RATHER THAN OVERRIDING IT. That class means "this header
 * is over photography", which stops being true the moment the bar turns white.
 * Taking it off reverts the lockup, the link colours and every other
 * dark-surface rule together, as one state. Overriding them one by one here
 * would leave the next person to add a dark-surface rule with a header that is
 * correct in three places and wrong in the fourth — and an invisible white
 * wordmark on a white bar is a failure no gate on this project can see
 * (handoff.md §3).
 *
 * THE THRESHOLD IS THE HEADER'S OWN HEIGHT, and that is not a round number
 * picked for feel: the hero reserves precisely that much top padding for the
 * bar, so nothing legible can pass beneath it while it is still transparent.
 *
 * It runs regardless of `prefers-reduced-motion`. Nothing here animates — the
 * background is either there or it is not, and a reader who asked for less
 * motion still needs a header they can reach.
 */
const header = document.querySelector<HTMLElement>('.site-header--transparent');

if (header) {
  /* Captured once, before anything is toggled, so restoring at the top of the
     page cannot depend on reading a class this module itself removes. */
  const startsOnDark = header.classList.contains('on-dark');

  /* Read once rather than per frame: it is the rendered height of chrome whose
     size is fixed at every width, and `getBoundingClientRect` in a scroll
     handler is a forced reflow for no gain. Re-read on resize in case a
     breakpoint changes it. */
  let threshold = header.offsetHeight || 86;

  let solid: boolean | null = null;

  const paint = (): void => {
    const next = window.scrollY > threshold;
    if (next === solid) return;
    solid = next;
    header.classList.toggle('is-scrolled', next);
    if (startsOnDark) header.classList.toggle('on-dark', !next);
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
  window.addEventListener(
    'resize',
    () => {
      threshold = header.offsetHeight || threshold;
      solid = null;
      schedule();
    },
    { passive: true },
  );

  /* A reload partway down a page restores the scroll position before this runs,
     so the first paint cannot assume the top. */
  paint();
}
