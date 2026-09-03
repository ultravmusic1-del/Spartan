/**
 * MOTION ON THE LANDING PAGE — added 2026-09-03 at the client's request:
 * counted numbers that count, sections that arrive as they are scrolled to,
 * kept restrained enough for an industrial supplier.
 *
 * Imported from `src/pages/index.astro` alone. Astro bundles it with anime.js
 * into an external `/_astro/*.js` chunk, which `script-src 'self'` allows —
 * so unlike an inline `<script>` it costs no CSP hash. `npm run csp` still
 * runs after a build to prove the hash count did not move.
 *
 * THREE RULES THIS KEEPS.
 *
 * 1. NOTHING IS HIDDEN UNLESS THIS FILE IS RUNNING. The page ships fully
 *    visible; this script hides only elements that are still BELOW the
 *    viewport at the moment it runs, then reveals them on intersection. If the
 *    script never loads, nothing is missing. If it loads late, elements the
 *    reader already saw are never touched.
 *
 * 2. THE HERO IS NOT RE-ANIMATED. It has its own CSS entrance (`hero-rise`),
 *    and `tests/e2e/home.spec.ts` measures its geometry after the finite CSS
 *    animations settle — anime.js runs its own clock, invisible to
 *    `document.getAnimations()`, so a transform from here would be measured
 *    mid-flight. Only the proof strip's numbers are touched, and a count-up
 *    moves no box.
 *
 * 3. `prefers-reduced-motion` SWITCHES ALL OF IT OFF. Numbers render their
 *    final value, sections stay where the server put them.
 *
 * SECTION NUMERALS get opacity only, never a transform: `home.spec.ts` asserts
 * every numeral's right edge sits on one vertical line, and a translateX in
 * flight would break that for whichever section is mid-reveal.
 */
import { animate, stagger, utils } from 'animejs';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Elements that rise into place, grouped by the parent whose children stagger.
   Hero doors and proof cells are included: they sit below the fold on every
   viewport the tests use, and the composition test only compares them with
   each other. */
const RISE = [
  '.hero__doors > li',
  '.hero__proof-cell',
  '.sec',
  '.cg__group-head',
  '.cg__grid > li',
  '.sp__grid > li',
  '.steps__item',
  '.steps__side',
  '.about__vis',
  '.about__copy',
  '.about__industries',
  '.faq__item',
  '.cta__inner > *',
];

/* Opacity only — see the header. The hero's own numeral is excluded because
   it is inside the first screen on every tested viewport. */
const FADE = ['.sec .section-index'];

const EASE = 'outCubic';

function belowViewport(el: Element): boolean {
  return el.getBoundingClientRect().top > window.innerHeight;
}

function siblingsIndex(el: Element, all: Element[]): number {
  const parent = el.parentElement;
  const group = all.filter((n) => n.parentElement === parent);
  return Math.max(0, group.indexOf(el));
}

function reveal(): void {
  const rise = RISE.flatMap((s) => [...document.querySelectorAll<HTMLElement>(s)]).filter(belowViewport);
  const fade = FADE.flatMap((s) => [...document.querySelectorAll<HTMLElement>(s)]).filter(belowViewport);

  if (rise.length === 0 && fade.length === 0) return;

  utils.set(rise, { opacity: 0, translateY: 28 });
  utils.set(fade, { opacity: 0 });

  const seen = new WeakSet<Element>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || seen.has(entry.target)) continue;
        seen.add(entry.target);
        observer.unobserve(entry.target);
        const el = entry.target as HTMLElement;
        if (fade.includes(el)) {
          animate(el, { opacity: [0, 1], duration: 900, ease: EASE });
          continue;
        }
        /* Siblings that enter together stagger by their order; one that
           enters alone starts at once. */
        const delay = siblingsIndex(el, rise) * 70;
        animate(el, {
          opacity: [0, 1],
          translateY: [28, 0],
          duration: 720,
          delay,
          ease: EASE,
        });
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );

  for (const el of [...rise, ...fade]) observer.observe(el);
}

/* THE COUNT-UPS. A `<dd>` whose text is a plain integer counts from zero to
   itself when it scrolls into view. The server-rendered value is the source
   of truth: it is read from the DOM, never typed here, so a catalogue change
   in /admin changes the number and the animation alike. "India & China" is
   not a number and is left alone. */
function countUps(): void {
  const cells = [...document.querySelectorAll<HTMLElement>('.hero__proof dd')].filter((dd) =>
    /^\d+$/.test(dd.textContent?.trim() ?? ''),
  );
  if (cells.length === 0) return;

  const run = (dd: HTMLElement) => {
    const target = Number(dd.textContent);
    const counter = { n: 0 };
    dd.textContent = '0';
    animate(counter, {
      n: target,
      duration: 1400,
      ease: 'outExpo',
      modifier: utils.round(0),
      onUpdate: () => {
        dd.textContent = String(counter.n);
      },
      onComplete: () => {
        dd.textContent = String(target);
      },
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        run(entry.target as HTMLElement);
      }
    },
    { threshold: 0.6 },
  );
  for (const dd of cells) observer.observe(dd);
}

/* THE SECTION FOLIOS count too: "00" ticks up to the section's own number as
   the head arrives. Text only, no transform, for the reason in the header.
   The final text is what the server rendered, restored on completion, so the
   numbering system's tests read the true value whenever they run after the
   tick — and they never run mid-tick, because a head below the fold has not
   started. */
function folios(): void {
  const numerals = [...document.querySelectorAll<HTMLElement>('.sec .section-index')].filter(
    (el) => /^\d{2}$/.test(el.textContent?.trim() ?? '') && belowViewport(el),
  );
  if (numerals.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const el = entry.target as HTMLElement;
        const target = Number(el.textContent);
        const counter = { n: 0 };
        animate(counter, {
          n: target,
          duration: 700,
          ease: 'outQuad',
          modifier: utils.round(0),
          onUpdate: () => {
            el.textContent = String(counter.n).padStart(2, '0');
          },
          onComplete: () => {
            el.textContent = String(target).padStart(2, '0');
          },
        });
      }
    },
    { threshold: 0.4 },
  );
  for (const el of numerals) observer.observe(el);
}

/* A restrained lift on the cards that answer a pointer: the hover cue in
   global.css turns the boundary red; this adds 2px of rise and takes it back,
   which is the whole of the "premium" the brief asked for on hover. */
function lifts(): void {
  const cards = document.querySelectorAll<HTMLElement>('.hero__door, .cg__card, .sp__grid .card');
  for (const card of cards) {
    card.addEventListener('pointerenter', () => {
      animate(card, { translateY: -2, duration: 220, ease: EASE });
    });
    card.addEventListener('pointerleave', () => {
      animate(card, { translateY: 0, duration: 260, ease: EASE });
    });
  }
}

if (!reduced) {
  reveal();
  countUps();
  folios();
  lifts();
}

/* Exported for the unit test; the module runs on import in the browser. */
export const motionSelectors = { RISE, FADE };
