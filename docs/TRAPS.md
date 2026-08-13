# Traps

What will bite you here, and how you will know. Every entry passes `astro
check` clean or looks like a defect while being deliberate — read this before
you "fix" something. The reasoning and the measurements behind each entry are
in `handoff.md`; this file states the trap and moves on.

---

## Fails silently

`astro check` passes through every one of these. Nothing warns you.

- **Playwright attaches to a dev server on :4321 instead of building.**
  `playwright.config.ts` sets `reuseExistingServer: true` and its
  `webServer.command` builds first — but if anything is already listening on
  4321, Playwright attaches to *that* and never builds. With `astro dev`
  running this produced 15 confident failures that vanished the moment the
  dev server was stopped. Stop the dev server before any e2e run.

- **`test.use({ reducedMotion: 'reduce' })` does nothing.** On the pinned
  Playwright (1.62.1) `reducedMotion` is not a top-level `TestOptions` field —
  only `contextOptions.reducedMotion` is. Fixtures accept the extra key, so it
  typechecks and is then discarded: `matchMedia('(prefers-reduced-motion:
  reduce)')` stays false and every assertion under it tests a page that never
  entered the branch. Write
  `test.use({ contextOptions: { reducedMotion: 'reduce' } })`. The
  `prefers-reduced-motion` describe block in `tests/e2e/motion.spec.ts` carries
  the note.

- **Astro's dev server can serve stale scoped CSS after a component is
  rewritten wholesale.** Twice during the hero rewrite the new markup shipped
  with the previous stylesheet — `min-height` and `display` reading their old
  values while the DOM was clearly new. `astro check` passes, so nothing
  warns you. Restart the dev server and clear `node_modules/.vite` if
  computed styles disagree with the file you just wrote.

- **Tailwind utilities lose to unlayered Astro scoped styles.** Utilities
  compile into `@layer utilities`; Astro's scoped component styles are
  unlayered, and unlayered CSS beats every layer regardless of specificity.
  Passing `max-sm:hidden` to a component whose own scoped rule sets `display`
  does nothing at all. Wrap the component in an element the page owns
  instead.

- **The `hidden` attribute can never hold its space.** Tailwind 4's preflight
  ships `[hidden]` as `display: none !important`, and no ordinary author rule
  outranks `!important`. Using `hidden` for a "not yet hydrated" placeholder
  cost 134px of layout shift and CLS 0.042; a plain class gave 0px and CLS
  0.000. `hidden` is still correct where `display: none` is genuinely the
  intent.

- **No component here can offer a motion opt-in.** The
  `prefers-reduced-motion` block at the foot of `src/styles/global.css` forces
  `animation-duration: 0.01ms !important` and
  `animation-iteration-count: 1 !important` on `*, *::before, *::after`.
  No scoped rule outranks `!important`, and
  `animation-play-state: running` cannot restart an animation that has already
  run to completion. A component's own `animation: none` **does** still work,
  because the global rule forces duration and iteration-count only while the
  shorthand sets `animation-name` — that is how `Hero.astro`'s reduced-motion
  block cancels its four animations rather than racing them to 0.01ms.
  The consequence for tests: an animation collapsed this way finished, it was
  never paused, so it still computes `animation-play-state: running`.
  Asserting `paused` under reduced motion fails against a page doing exactly
  what it should — `tests/e2e/motion.spec.ts` says so, at length, in the place
  where that assertion would otherwise have gone.

- **Any island reading a persistent nanostore needs a `mounted`/`ready`
  gate.** `useStore` returns `store.get()` on the first client render, and
  `get()` on an unmounted persistent atom restores from `localStorage` — so
  the render that hydrates already has the basket while the server, having
  no `localStorage`, rendered the empty state. Two hydration mismatches were
  found and fixed this way, in `src/components/enquiry/EnquiryBadge.tsx` and
  `src/components/enquiry/EnquiryForm.tsx`. Any future island reading a
  persistent store needs the same gate.

- **`client:visible` islands do not hydrate in a background tab.** The
  rendering pipeline is frozen, `IntersectionObserver` never fires, and every
  enquiry button stays stuck in its pending state. Force a paint or keep the
  tab foregrounded.

- **`astro:assets` cannot take a runtime string path — use the
  `import.meta.glob` pattern.**

  ```ts
  const productImages = import.meta.glob<{ default: ImageMetadata }>('/src/assets/products/*.png');
  const loader = productImages[`/src/assets/products/${product.images[0]}`];
  const image = loader ? (await loader()).default : undefined;
  ```

  Root-absolute glob gives root-absolute keys, so it works unchanged from any
  directory. Lazy (no `eager`) so only rendered images are emitted —
  verified: 26 referenced images produced 52 variants, not all 72. Astro
  clamps `widths` down to the source's native size, so upscaling cannot
  happen by accident; `widths` requires `sizes`.

- **A green axe run is not a claim that a page passes WCAG.** axe's rule for
  `label-content-name-mismatch` (WCAG 2.5.3 Label in Name, serious impact) is
  experimental and off by default, so the e2e axe pass never ran it;
  Lighthouse weights it 0, so it never showed up in the accessibility score
  either. The category read 100 while every `EnquiryButton` had a serious
  WCAG A failure: the button reads ENQUIRE and its accessible name was `Add
  <product> to enquiry list`, which does not contain "Enquire".

- **A stale CSP hash ships a site that renders and never hydrates.**
  `script-src` is hash-based with no `'unsafe-inline'`, so any change to an
  inline script — adding one, removing one, editing one — changes which
  hashes it needs. `npm run csp` must be re-run and `vercel.json` committed
  after any such change. A stale hash does not fail the build; the page ships
  looking fine and never hydrates.

- **Whether an Astro `<script>` costs a CSP hash depends on how many pages
  render the component, not on how the tag is written.** Astro extracts a
  processed `<script>` to an external `/_astro/` chunk — which `'self'`
  already allows — only when it is shared across pages; a script that renders
  on exactly one page is inlined into that page's HTML and needs a hash.
  `EnquiryCta`'s is external because it renders on `/` and `/contact`; the
  hero's and Featured Lines' are inline because both render on `/` alone.
  So **rendering an existing component on one more page can move its script
  between those two states and invalidate a hash with nobody having edited any
  JavaScript.** Re-run `npm run csp` after changing *where* a component
  renders, not only after changing what it does.

- **The home page is a product data view, so "product-page only" is not a
  thing.** `Spotlight` imports `SpecTable` and `En388Table` and renders both in
  full for Grip Guard GP5 on `/`. Anything scoped to "the catalogue's data
  presentation" therefore lands on the page with the least performance headroom
  on the site. This was assumed away once already: the mono font was introduced
  on the reasoning that nothing on `/` would match it, and it cost 4 Lighthouse
  points before the assumption was checked. Grep `Spotlight.astro`'s imports
  before believing a component is off the home page.

- **A weight change can move text across the WCAG large-text boundary, and
  nothing here would tell you.** "Large" is >=24px, **or** >=18.66px *and* bold
  (>=700) — so a heading between 18.66 and 24px is held above the 3:1 bar by its
  weight alone, and dropping that weight silently re-tests it against 4.5:1.
  Three red headings on white sat exactly there at 4.30:1, passing on a weight
  declared in `src/styles/global.css` rather than in their own rules.
  `tests/e2e/contrast.spec.ts` covers those; it is a named list, not a sweep, so
  **add to it when you add red text on a light surface.**

- **`font-display` governs rendering, not fetching.** `optional` was tried to
  recover a Lighthouse point lost to a 40 KB font and changed nothing at all,
  three runs identical. The font is still downloaded and still competes for
  bandwidth under simulated throttling; `font-display` only decides what paints
  while it arrives. To recover the point you must ship fewer bytes.

- **Clipping a variable font's weight axis saves more than subsetting its
  characters.** Measured on JetBrains Mono: characters alone took 39.5 KB to
  31.4 KB, adding an axis clip to 400-600 took it to 23.1 KB.
  **The `@font-face` `font-weight` range must then match the file** — advertising
  the family's native `100 800` against a file clipped to `400 600` makes the
  browser clamp silently, so a later `font-weight: 700` renders at 600 and reads
  as a CSS specificity bug. `tools/subset-mono.mjs` owns both numbers.

- **A subset font renders tofu, not an error, for a character it lacks.**
  `COVERAGE` in `tools/subset-mono.mjs` is the source of truth for what the mono
  carries and `tools/subset-mono.test.ts` fails naming the character, its
  codepoint and the product that introduced it. When it fails, add the character
  and re-run the subsetter — **do not widen the test**, whose whole value is
  being narrower than the font.

- **`SUPABASE_SERVICE_ROLE_KEY` and Vite's build-time `import.meta.env`
  inlining.** This key bypasses row-level security completely, and the
  enquiries table is RLS-enabled with zero policies — it is the only thing
  standing between the public internet and every name, email address and
  phone number the site has collected. A client-side module referencing it
  would have the literal secret substituted into a shipped bundle with
  nothing warning at build time. The **service-role key never reaches the
  client** gate in `tools/verify.mjs` scans `src/components`, `src/scripts`,
  `src/stores` and `src/layouts` for the identifier and for any import of the
  enquiry store module, then sweeps built output for the JWT payload string it
  would leave behind. Named, not numbered: the gates are ordered by cost and
  the numbers in that file's comments move whenever one is inserted.

  **That gate matches the identifier, so writing it in a comment or in help
  text inside one of those four directories fails the build too.** This is not
  a false positive to be exempted — the name is the only reliable proxy for the
  access, the gate cannot tell prose from a property read, and an allow-list
  entry is exactly the kind of exception that eventually lets a real reference
  through. `src/components/admin/DataState.astro` hit this while telling an
  operator which variables to set; it now describes the service-role key and
  points at `README.md` rather than naming it. Put the literal in `src/lib`,
  `src/pages` or `src/middleware.ts`, all of which are server-only.

- **`src/lib/env.ts` reads `process.env` first, and the order is the whole
  point.** Vite inlines `import.meta.env.*` at build time, and the build runs
  on Vercel — so a secret added to the project *after* a build would never
  reach an inlined reference. `process.env` is read at request time and is
  what a platform environment variable actually populates.
  `import.meta.env` stays as the fallback only because `astro dev` loads
  `.env` into Vite's env and not into `process.env`, so local development
  still needs it. This logic lived inside `src/pages/api/enquiry.ts` until a
  second consumer appeared; the precedence is subtle enough that two copies
  would eventually disagree, and the copy that lost would fail only in
  production.

- **The middleware's early return is not an optimisation — it runs at build
  time for all 97 prerendered pages.** `src/middleware.ts` runs for every
  route, including the 97 prerendered pages, and for those it runs at build
  time, where there is no meaningful request. Without the early return, the
  build would make 97 pointless auth round trips and the public site's build
  would start depending on Supabase being reachable. `/api/admin/*` needs
  guarding as much as `/admin/*` — protecting only the pages leaves every
  endpoint they call wide open, and the endpoints are the more valuable
  target.

- **A data-modifying CTE's rows are not visible to the rest of the same
  statement.** The first round-trip check inserted a row and read a view
  back in one statement, got 0 lines, and looked like a broken view. The
  view was fine — an insert's rows in a CTE are not visible to a `SELECT`
  elsewhere in that same statement, only to statements that run after it.

## Looks like a defect, is not

Several of these have already been reported as regressions by someone who
did not check. Changing one is a regression *you* would be introducing.

- **The black panel in `p19-safety-vests.png` and `p19-safety-vests-2.png`.**
  A deliberate DAY | NIGHT reflectivity comparison from brochure page 19, not
  a clip-forwarding failure. All 72 assets were scanned; only these two, both
  legitimate. Reported as a regression once already.

- **The hero's 1080px breakpoint, and its 136px of top padding.** Below
  1080px the helmet stage stops sitting beside the copy and stacks under it.
  That number was measured on **glyph pixels** — the lit helmet reaching the
  pill CTA's actual letterforms, with the stage pushed to its worst-case
  parallax offset — not on element boxes; the two disagree by ~400px and only
  the glyph number is real. Overlapped, brand red on the lit helmet measured
  1.04:1. Stacking is the fix rather than a lower stage opacity, which would
  have to reach 0.15 to clear 3:1 and would delete the artwork to buy
  compliance. The 136px is not a design choice either: `Header.astro` is
  `position: absolute` and occupies y 0–128, so the hero's own padding-top is
  the only thing clearing it — at 96px the badge collided with the header logo
  at every width from 375 to 1024.

- **The hero source order IS the mobile layout, and the CTAs deliberately sit
  after the helmet.** Below 1080px `.hero` is `display: block`, so the DOM
  decides the stack: badge and headline, then the stage, then the actions. That
  is why `.hero__actions` lives in its own `.wrap` rather than inside
  `.hero__copy` — CSS `order` cannot interleave the stage (a child of `.hero`)
  with the actions (a grandchild of `.hero__wrap`), so the split is what makes
  the order expressible at all. **This costs above-the-fold CTA visibility on a
  short phone and that was the call, taken 2026-08-12.** Both CTAs are fully
  visible on a 390×844 and a 414×896. On a 375×667 iPhone SE and a 360×640
  Android **only the primary one is**, and only because a
  `(max-height: 700px)` query shrinks the stage to 58vw and tightens two
  margins; "Request a quote" is below the fold on both and that is the accepted
  price. The margins are part of it — the stage shrink alone left the primary
  CTA 8px past the fold at 360×640, which is the width where this is tightest.
  An earlier version put the stage last to dodge the problem entirely — moving
  `.hero__actions` back inside the first `.hero__copy` reverts it. On desktop the stage is absolutely positioned under
  the copy, so the split is invisible there, but it does make `.hero` a two-row
  grid — which is why `.hero` sets `align-content: center`.

- **The helmet artwork is not centred in its own canvas.** Its opaque pixels
  run y=125..1085 of 1254, so the helmet's centre sits 1.675% above the middle
  of the square PNG it ships in. CSS centres the picture *box*, so the halo,
  sweep and ring are concentric with the transparent square and not with the
  helmet — measured 22.6px of float at the desktop render size before the bob
  adds anything. `--helmet-art-offset` corrects it on `.hero__helmet`. Two
  consequences: the mobile `.hero__helmet` rule replaces the desktop
  `transform` wholesale, so it has to re-declare the translate by hand or the
  correction silently vanishes; and there is deliberately **no horizontal
  counterpart**, because the opaque box is already centred to within 1px and
  the ring clears the helmet by only ~26px on each side against ~83px above and
  below. Re-measure off the alpha channel if the artwork is ever re-cut.

- **`image-size-responsive` (Lighthouse Best Practices 96) on product
  pages.** Source photography is natively 100–440px and must never be
  upscaled beyond ~2×. It resolves when the client supplies real
  photography, with no markup change needed.

- **The 3 `npm audit` high findings.** One chain, no upstream fix,
  build-time only. **Never run `npm audit fix --force`** — its only offered
  fix reintroduces 8 XSS advisories.

- **`build.inlineStylesheets: 'always'`.** Considered and rejected: it
  inlines ~41 KB into every page, losing cross-page CSS caching.

- **The two empty categories, and the empty tiles on the home shelf.** Spill
  Control and Electrical Accessories have no products because the brochure has
  none — `productCount: 0`, `heroProductSlug: null`. On the home page's
  category shelf they render a marked "Range expanding" tile with **no product
  image**. The design mockup filled both with photographs borrowed from other
  categories; a product image in a category that stocks nothing is an untrue
  claim about stock, which on this site is the same class of error as an
  invented specification. `tests/e2e/home.spec.ts` asserts that exactly two
  tiles render the empty state.

- **RLS enabled with zero policies on `enquiries`.** Supabase's linter
  reports `rls_enabled_no_policy` at INFO forever. Do not "fix" it by adding
  a policy.
