# Traps

What will bite you here, and how you will know. Every entry passes `astro
check` clean or looks like a defect while being deliberate — read this before
you "fix" something. The reasoning and the measurements behind each entry are
in `handoff.md`; this file states the trap and moves on.

---

## Fails silently

`astro check` passes through every one of these. Nothing warns you.

- **A dark-surface grey on the light site.** `--color-grey` is 3.43:1 on white
  and `--color-grey-lt` is 2.06:1. Both were tuned for near-black backgrounds,
  and both render as approximately-fine grey on white — legible enough that
  nobody queries it, and under the 4.5:1 floor every label they colour needs.
  There were 80 public-site usages before the white theme.
  *Caught by:* `src/styles/theme-sweep.test.ts`, which bans both outside
  `Footer.astro`. Use `--text-muted` for text, `--line-control` for a boundary.

- **A hardcoded `#fff` that used to be correct.** The token bans above cannot
  see it, because it was never a token. `ProductCard`'s `.card__name` shipped
  briefly as white on a white card — 1.00:1, every product name on every
  category page invisible — while every token gate was green. The mirror image
  happens too: turning a white label into `--text` on a red-filled button gives
  3.92:1.
  *Caught by:* the same sweep's white-text rule, plus
  `tests/e2e/contrast.spec.ts`. Before changing a colour, know what surface it
  sits on.

- **`.on-light` inverted into `.on-dark` on 2026-08-20.** The class did not
  move, it changed meaning: light is the default now and darkness is the
  exception. A leftover `.on-light` applies light-surface rules inside the dark
  footer and renders grey on black.
  *Caught by:* `src/styles/theme-sweep.test.ts`.

- **Deleting one selector from a shared list takes the whole rule with it.**
  Removing `.hero__glow` from a `.hero__track, .hero__pip, .hero__glow {
  animation: none }` block left the first two dangling onto the rule below — so
  the hero carousel kept animating for visitors who had asked for reduced
  motion, and the page looked completely correct.
  *Caught by:* `tests/e2e/motion.spec.ts`, and nothing else would have.

- **The logo lockup does not fail loudly.** The header takes the black-wordmark
  lockup and the footer the white one. Put either on the wrong surface and the
  wordmark is invisible — but it is still a rendered `<img>` with correct
  `alt`, correct dimensions and a 200 response.
  *Caught by:* nothing. Check it by eye whenever a surface changes.

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

- **Getting the catalogue out of Node and into a database will mangle every
  non-ASCII character if a text editor is in the path.** The catalogue's
  specifications carry `±`, `Ω`, `°`, `×`, `—` and inch marks, and on
  2026-08-13 all of them reached Postgres as `┬▒`, `╬⌐` and `ΓÇö`. The seed was
  correct and the paste was correct; the corruption happened in between,
  because a BOM-less UTF-8 file was opened in an editor that guessed ANSI, and
  what got copied was the mojibake on the screen. Nothing failed — the seed
  reported success, the site built, and the damage only surfaced when
  `npm run catalogue:parity` compared 47 product pages against the JSON. Use
  `--out` so Node writes the file, and put it on the clipboard with
  `Get-Content seed.sql -Raw -Encoding utf8 | Set-Clipboard` rather than
  opening it. **This is the argument for the parity build existing at all**: no
  amount of reading the data would have caught it.

- **A CSS transition reads as "never happened" in a preview that is not
  painting, and a working feature looks broken.** The Categories dropdown is
  opened by `:hover`/`:focus-within` and transitions `opacity` and `visibility`.
  Focusing the link and then reading `getComputedStyle(panel)` reported
  `visibility: hidden, opacity: 0` indefinitely — across separate tool calls,
  with seconds between them — which reads exactly like a keyboard-inaccessible
  hover-only menu, the WCAG 2.1.1 failure you would most expect to find.
  Nothing was wrong: `panel.matches(':focus-within')` was already `true` and the
  scoped rule was present and winning. **Transitions only advance while frames
  are being produced**, and a headless or hidden preview pane composites nothing,
  so every transitioned property stays pinned at its start value forever.

  Two ways to get a real answer, and prefer the first: **assert it in Playwright**,
  which composites properly — `toBeVisible()` on the panel is the honest test.
  To check it by hand, inject
  `* { transition: none !important }` first, which makes `getComputedStyle`
  report the value the cascade actually resolves to. Reading a transitioned
  property in this environment without doing one of those tells you nothing.

- **An Astro scoped style does not isolate a class NAME from a global rule of
  the same name.** Scoping adds a `data-astro-cid-*` attribute to the
  component's own selectors; it does nothing to stop a global stylesheet
  matching that class on the same element, and the two then cascade normally.
  This became live the moment the admin gained `src/styles/admin.css` beside
  its per-page `<style>` blocks: the demand report styled its chart bars
  `.ad-bar`, which is the **admin top bar** in that file, so every bar
  inherited `min-height: 56px`, `display: flex` and 20px of horizontal padding
  and rendered as fat lozenges overflowing their column. `min-height` beats a
  local `height: 6px`, so the scoped rule looked right and did nothing. Use a
  distinct prefix per component — `dm-` on that page — not more specificity.

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

  **"Shared across pages" counts page MODULES, not built URLs, and a dynamic
  route is one module however many pages it emits.** `ShareRow.astro` renders on
  all 94 product pages and its script is still **inlined into every one of
  them**, because all 94 come from the single `src/pages/products/[slug].astro`
  route. The prediction from the paragraph above — 94 pages, therefore external,
  therefore no hash — is wrong, and it is wrong in the safe direction only
  because `npm run csp` was re-run and the count went 8 → 9. Had it not been,
  the sharing controls would have shipped blocked on every product page with
  nothing failing. Measured cost of the inline copy: 1,040 bytes on a 45.7 KB
  page, and it saves a request, so this is a fine outcome — it just is not the
  predicted one. **Check the hash count against the build after adding a script
  to a dynamic route; do not reason about it from the number of URLs.**

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

- **An admin-side copy of the catalogue schema.** `src/lib/admin/catalogue.ts`
  validates a save against `productSchema` and `categorySchema` imported from
  `src/lib/catalogue-schema.ts`, which is the same object the Content Layer
  validates with at build time. Copy them "to decouple the admin" and the two
  drift, and the failure is both delayed and misattributed: a save passes, the
  row looks fine, the admin screen renders it, and a build fails hours later —
  possibly one somebody else triggered for an unrelated reason, on a record they
  have never heard of.
  *Caught by:* nothing. Keep the import. The schemas live in their own file, and
  not in `src/content.config.ts`, only because importing that at runtime drags
  the whole Content Layer graph into an admin route — that file re-exports them,
  so there is still exactly one of each.

- **Reading a form field that is absent as if it were blank.** `FormData.get`
  returns null for a key the form never sent, and `?? ''` turns that into "the
  editor cleared this". They are not the same thing, and conflating them makes
  every partial POST destructive: the product form drops its category `select`
  when the category list cannot be read, so it posts no `category-id` at all,
  and an end-to-end test that posts three fields would delete every
  specification on the product it is checking. `given()` in
  `src/lib/admin/catalogue.ts` returns null for absent and `''` for cleared, and
  every caller distinguishes them.
  *Caught by:* `src/lib/admin/catalogue.test.ts` — "changes only what was
  posted, and loses nothing that was not". Nothing else would have.

- **`Number('')` is 0, not NaN.** An emptied number box therefore satisfies
  `z.number().int()` and saves — an order of 0 moves a product silently to the
  front of its category rather than being refused. Blank has to reach the schema
  as something it rejects.
  *Caught by:* `src/lib/admin/catalogue.test.ts` — "rejects a blank order rather
  than reading it as zero".

- **A test that forges a POST and passes because the POST was refused.** Astro's
  `security.checkOrigin` defaults to on and answers 403 to any on-demand POST
  whose `Origin` header does not match the site. Playwright's `request` fixture
  sends none, so `tests/e2e/admin-catalogue.spec.ts`'s "the slug cannot be
  changed by posting one" and its EN 388 twin both passed green against a
  request the server never processed — proving nothing about read-only fields.
  Any test whose claim is "the write went through and this field still did not
  move" has to assert that the write went through.
  *Caught by:* `forge()` in that file, which requires a 302 to
  `notice=catalogue-saved` before it will check anything.

- **A styling block that loses on specificity, under a comment saying what it
  was for.** `SpecTable.astro` had `.spec__feature { color: var(--text);
  font-weight: 500; font-family: var(--font-body) }` beneath a comment arguing
  that unlabelled spec lines are sentences and must not be set in mono. Every
  declaration lost to `.spec td`, which is (0,1,1) against a lone class's
  (0,1,0), so roughly a third of all spec rows rendered as mono at
  `--text-muted` — pixel-identical to the value cells they were meant to be
  distinguishable from. It shipped that way for the life of the component. The
  same trap then bit the mobile rule written to fix it: `.spec__gutter {
  display: none }` also lost to `.spec td`, and the cell it was meant to hide
  stayed in the layout.
  *Caught by:* nothing — `astro check` is happy, axe is happy, and the rendered
  page looks deliberate. Only `getComputedStyle` in a browser tells you. When a
  rule targets an element that a *less* specific selector in the same
  stylesheet already reaches, qualify it (`.spec td.spec__feature`) and then
  read the computed value back rather than trusting the cascade.

- **`display: block` on a table strips its semantics from the accessibility
  tree.** The responsive rule that stacks a spec label above its value sets
  `display: block` on the table, tbody, tr, th and td. In Chrome and Firefox
  that removes the implicit table roles — rows, row headers, and the pairing
  between a label and its value all disappear for a screen reader, silently,
  while the page looks correct and axe reports nothing. `SpecTable.astro`
  restates `role="table"`, `"rowgroup"`, `"row"`, `"rowheader"` and `"cell"`
  explicitly so the table survives the transformation.
  *Caught by:* reading the accessibility tree at a mobile width, which is the
  only place the loss is visible. Do not delete those roles as redundant.

- **A remote image Astro is not allowed to optimise is passed straight
  through, not rejected.** This site no longer uses remote images at all —
  hero banners are downloaded into `src/assets/banners/` by
  `tools/fetch-banners.mjs` before the build and treated as local files — and
  the reason is worth keeping. While `<Picture>` fetched a signed Supabase URL
  directly, an empty `image.domains` did not fail the build: it emitted the raw
  URL into the HTML. Signed, expiring, and blocked by `img-src 'self'`, on a
  page that still looked plausible. **If anyone reintroduces a remote image
  source, `image.domains` becomes load-bearing again and its failure mode is
  silent.**
  *Caught by:* the "no signed storage URL in the built output" gate.

- **`image.domains` is not a CSP, and `img-src` is not a download allowlist.**
  They look interchangeable and are opposites: `image.domains` says which hosts
  the BUILD may fetch an image from, `img-src` in `vercel.json` says which
  hosts a VISITOR'S BROWSER may load one from. Widening either because the
  other blocked something changes nothing and, in `img-src`'s case, weakens the
  site.
  *Caught by:* nothing — both mistakes leave a working page.

- **A "public" storage bucket is a second publishing channel.** Every table here
  runs RLS with zero policies on the stated grounds that the catalogue is
  published by the *build*, not by the database. A public bucket quietly undoes
  that for the artwork: an unmaintained, ungated URL that serves the client's
  files whatever the site is doing. The `banners` bucket is private and
  `src/lib/site-content.ts` signs a one-hour URL at build time.
  *Caught by:* nothing. `tools/storage-setup.mjs` creates it private; do not
  "fix" a signing error by flipping the bucket.

- **Playwright's `hasText` matches text content, and an input's value is not
  text content.** A row located by `hasText: 'spring-campaign'` finds nothing
  while the screen is plainly showing that name in an `<input value="...">`,
  which reads as a broken feature rather than a broken selector. Filter on the
  input instead: `.filter({ has: page.locator('input[name="name"][value="..."]') })`.
  *Caught by:* the failure screenshot, which showed a correct page. Look at it
  before changing application code.

- **`.env` does not populate `process.env`, and a config file runs before
  anything that would.** Vercel sets platform variables in `process.env`, so
  config that reads `process.env.SUPABASE_URL` works in production and reads
  `undefined` on a developer machine — with no error, because a missing value
  usually just disables a feature. It cost a local build that wrote expiring
  storage URLs into the HTML while the build, `astro check` and every test
  stayed green. `astro.config.mjs` no longer reads any environment variable,
  but anything that does must read `.env` the way Vite does:
  `loadEnv(mode, cwd, '')`, where the empty prefix is required because the
  default exposes only `VITE_`-prefixed names.
  *Caught by:* a broken image icon in a screenshot. Now also by the signed-URL
  sweep in `npm run verify`.

- **A `transform` declared on an element loses to any animation that also sets
  `transform`.** `.hero__title` carries `hero-rise`, whose last keyframe is
  `translateY(0)`, and `animation-fill-mode: both` keeps that final value — so
  `transform: skewX(-9deg)` on the same element is simply overwritten and the
  headline stands upright with nothing in the CSS looking wrong. The skew has to
  be in every keyframe, which is why `hero-rise-lean` exists. The same applies
  to the `prefers-reduced-motion` branch: `transform: none` there flattens a
  slant that is typography rather than motion.
  *Caught by:* looking at it. Nothing else can see this.

- **`font-style: oblique <angle>` reports success it did not achieve.** Archivo
  ships no italic and no slant axis, Chrome declines to synthesise an oblique
  for it, and `getComputedStyle(el).fontStyle` returns `"oblique 9deg"` anyway
  while the glyphs render upright. A test asserting the computed style would
  pass against an unslanted headline. Use a transform when the slant matters.
  *Caught by:* a screenshot.

## Looks like a defect, is not

Several of these have already been reported as regressions by someone who
did not check. Changing one is a regression *you* would be introducing.

- **The black panel in `p19-safety-vests.png` and `p19-safety-vests-2.png`.**
  A deliberate DAY | NIGHT reflectivity comparison from brochure page 19, not
  a clip-forwarding failure. All 72 assets were scanned; only these two, both
  legitimate. Reported as a regression once already.

- **The hero's stacking breakpoint is 1180px, and it belongs to whatever is in
  the stage — not to the hero.** It was **1080px** for the helmet, measured on
  **glyph pixels** (the lit dome reaching the pill CTA's actual letterforms) and
  not on element boxes, which disagree by ~400px.

  Replacing the helmet with the banner carousel on 2026-08-17 broke that number
  and it took a measurement to notice. A transparent PNG whose mass stops well
  inside its own canvas can sit closer to the copy than an **opaque rectangle**
  can: with the card in place at 1080px, the card's left edge landed **47px past
  the headline's rightmost ink** — a poster printed across the word "SOLUTIONS"
  on any window between 1081 and 1128. `npm run verify` passed, the axe sweep
  passed, and nothing else would ever have caught it.

  The crossover is 1128px; 1180px leaves 53px at the boundary and 112px above
  1240, where both sides are centred and the gap stops changing. **If the stage
  contents change again, re-measure this — the number is a property of the
  artwork, not of the layout.** Stacking is the fix rather than shrinking or
  fading the stage, for the same reason it always was: nothing is layered over
  anything, so the card runs at full opacity and the copy sits on flat black.

  **That number lives in three places and they must agree**: two `@media` blocks
  in `Hero.astro` and a `matchMedia('(min-width: 1181px)')` in its own script.
  Editing the script changes its bytes, so `npm run csp` has to be re-run —
  moving this breakpoint invalidated a CSP hash with no JavaScript logic
  changing at all.

  The 136px of top padding is separate and unchanged: `Header.astro` is
  `position: absolute` and occupies y 0–128, so the hero's own padding-top is
  the only thing clearing it — at 96px the badge collided with the header logo
  at every width from 375 to 1024.

- **The hero source order IS the mobile layout, and the CTAs deliberately sit
  after the carousel.** Below 1180px `.hero` is `display: block`, so the DOM
  decides the stack: badge and headline, then the stage, then the actions. That
  is why `.hero__actions` lives in its own `.wrap` rather than inside
  `.hero__copy` — CSS `order` cannot interleave the stage (a child of `.hero`)
  with the actions (a grandchild of `.hero__wrap`), so the split is what makes
  the order expressible at all. **This costs above-the-fold CTA visibility on a
  short phone and that was the call, taken 2026-08-12.** Both CTAs are fully
  visible on a 390×844 and a 414×896. On a 375×667 iPhone SE and a 360×640
  Android **only the primary one is**, and only because a
  `(max-height: 700px)` query shrinks the stage and tightens two margins;
  "Request a quote" is below the fold on both and that is the accepted price.
  The margins are part of it — the shrink alone was never enough by itself.
  **That shrink was 58vw for the helmet and is 38vw for the carousel**: a 4:5
  portrait card is ~24% taller than the landscape helmet stage at the same
  width, and the carousel added a 44px control row that WCAG 2.2.2 does not let
  us drop to buy the space back. Measured on the 360×640, the tighter of the
  two, the primary CTA now clears the fold by 19px where the helmet cleared it
  by 12px.
  An earlier version put the stage last to dodge the problem entirely — moving
  `.hero__actions` back inside the first `.hero__copy` reverts it. On desktop the stage is absolutely positioned under
  the copy, so the split is invisible there, but it does make `.hero` a two-row
  grid — which is why `.hero` sets `align-content: center`.

- **The hero carousel is one clock in four places, and the seventh slide is not
  a mistake.** The track renders `BANNERS.length + 1` slides: the last is a
  second copy of the first. The animation runs 0 → −600% and restarts at 0, and
  that reset is invisible *only* because both frames are the same image — delete
  the duplicate and the loop either shows a blank frame or visibly rewinds
  through five slides. `Ticker.astro` duplicates its track for the same reason.

  Changing the slide count means changing **four** things together, and three of
  them are silent if you miss them: the `hero-carousel` keyframe percentages,
  the six `hero-pip` `animation-delay` values, the 42s duration on both, and the
  `SLIDES` array. Get the delays wrong and the lit pip reports a slide that is
  not the one showing — which looks like a rendering bug and is arithmetic.

  The pips and the track must also **pause together**. They are stopped by one
  `:has(.hero__toggle:checked)` rule for exactly that reason; pausing only the
  track leaves the pip walking on alone.

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

- **The hero carousel's clock is derived from the slide count, and the rules
  that carry it are NOT scoped.** `heroClock()` in `src/lib/site-content.ts`
  returns the cycle length, the keyframe step and the pip delays from one input:
  how many banners are enabled. Three sets of literals used to encode that, all
  assuming six, so enabling a seventh lit the wrong pip — a rendering bug to
  look at, arithmetic in fact.

  Two consequences. **Astro's scoped `<style>` cannot interpolate a frontmatter
  value**, so the generated keyframes ship in an `is:inline` block instead —
  which is unscoped, so every selector in it is prefixed `[data-hero-stage]`.
  Drop that prefix and you have the `.ad-bar` collision above, on a class the
  rest of the site does not use yet but might.

  And **an inline `<style>` costs no CSP hash while an inline `<script>` does**:
  `style-src` is `'self' 'unsafe-inline'`, `script-src` is hash-based with no
  `'unsafe-inline'` at all. Do not reason from one to the other. Generating a
  script the same way would need `npm run csp` re-run on every change to any
  value it interpolates.

- **Nothing under `src/data/` may be imported by a page or component, and that
  now includes `site.json`.** It was exempt until 2026-08-19 because there was
  nowhere else for a page to get a phone number; `src/lib/site-content.ts` is
  that somewhere. The gate matches any `data/*.json` import from `src/pages` or
  `src/components`, so the exemption cannot be reinstated by accident.
