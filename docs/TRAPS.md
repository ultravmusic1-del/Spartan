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
  thing.** Since 2026-09-03 `SelectedProducts` renders the catalogue's own
  `ProductCard` eight times on `/`, specs and enquiry button included (before
  that, `Spotlight` rendered `SpecTable` and `En388Table` there). Anything
  scoped to "the catalogue's data presentation" therefore lands on the page
  with the least performance headroom on the site. This was assumed away once
  already: the mono font was introduced on the reasoning that nothing on `/`
  would match it, and it cost 4 Lighthouse points before the assumption was
  checked. Grep the home page's imports before believing a component is off
  it.

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

- **A CSS placeholder is not a syntax error — it is a dropped declaration.**
  `max-width: PLACEHOLDER_CAP` left in a rule while the real number was being
  measured did not fail the build, fail `astro check`, or warn. CSS discards a
  declaration it cannot parse and keeps the rest of the rule, so the headline
  simply had no wrap cap and ran onto one line. Anything that looks like a
  value must be a value before the file is saved.
  *Caught by:* a screenshot. Nothing else can see it.

- **A subset font renders tofu, silently, for anything it does not carry.**
  `public/fonts/fira-sans-italic-variable.woff2` holds 98 characters at ONE
  weight. Change the hero headline to use a character outside that set and the
  page builds, typechecks, passes axe, and shows empty boxes. Change
  `.hero__title`'s `font-weight` and the pinned axis clamps silently back to
  800, which reads as a CSS specificity bug.
  *Caught by:* `tools/subset-hero-font.test.ts`, which reads the headline out
  of `Hero.astro` rather than restating it, checks both letter cases because
  the element is `text-transform: uppercase`, and names the offending
  character. Proved against a planted "☑".
- **The hero's top padding is arithmetic, not taste.**
  `src/components/sections/Hero.astro` carries three numbers derived from the
  height of the absolutely positioned header — `--hero-chrome`, `.hero`'s
  `padding-top`, and a second `padding-top` in its `max-width: 1180px` block.
  The header is 84px of nav plus a 2px progress rule, so all three read 86.
  Nothing connects them but this entry. Change the header's height without
  changing all three and the dot field paints up behind the nav, the crop marks
  climb into the logo, and every gate stays green — nothing here resolves a
  rendered background against a rendered header.
  It has already moved once: it was 130 while a 44px utility bar sat above the
  nav, and that bar was removed on 2026-08-29.
  *Caught by:* nothing. Read the rendered page.

- **`.hero__controls` must not carry a `max-width`.**
  940px is the measure the crest and the closing rule use, and it is the COPY
  column — the banner band is the full wrap width. Written with `max-width:
  940px` on 2026-08-29, the control rail rendered 940 wide against a 1176 frame
  and sat visibly inset from the artwork it controls. It inherits the stage's
  width instead, so the two edges cannot drift apart.
  *Caught by:* `tests/e2e/home.spec.ts`, which measures both boxes.

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

- **SUPERSEDED 2026-09-10 — the passage below describes the hero as it was
  before the 2026-09-03 redesign, and its headline claim is now false.** The
  redesign (`handoff.md` §46) moved the actions ABOVE the campaign band, so the
  order is masthead, headline, lede, both CTAs, band, doors, proof. Measured on
  the built page: the CTAs sit at y 362–418 and the band starts at 520, and
  **both CTAs are above the fold on a 390×844, a 375×667 and a 360×640** — the
  cost this entry was written to record is no longer being paid. Kept because
  the reasoning about source order, the `.wrap` split and why `order` cannot
  express it is still how the hero is built, and because the shrink numbers
  below are still the ones in the stylesheet.

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
  through five slides. (The category ticker, deleted 2026-09-03, duplicated
  its track for the same reason.)

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

- **Electrical Accessories is missing from every shelf, menu and filter, and
  its page still answers.** It has no products because the brochure has none —
  `productCount: 0`, `heroProductSlug: null` — and on 2026-09-10 it was
  withdrawn from everything a buyer looks at. The seam is
  `getListedCategories()` in `src/lib/catalog.ts`; `getCategories()` is still
  the whole catalogue and is what `getStaticPaths`, the admin and every name
  lookup read, which is why `/catalogue/electrical-accessories` is still built
  and still returns 200. **Do not "fix" the mismatch by pointing the page
  builder at the listed set** — that turns a withdrawn range into a 404 for
  anyone holding the link.

  It follows that **the site's rendered category counts are 14, not 15**, and
  the two are meant to differ. Every buyer-facing count is derived from the
  same list it sits beside, so a division door reading 6 above a shelf of 5 is
  the failure this arrangement prevents. `src/data/categories.json` still holds
  fifteen and `npm run verify` still checks fifteen.

  Until that date the category was listed with a "Range expanding" tile
  carrying **no product image**. The reasoning behind the missing image has not
  changed and still binds anything that brings such a tile back: the design
  mockup filled it with a photograph borrowed from another category, and a
  product image in a category that stocks nothing is an untrue claim about
  stock — the same class of error as an invented specification.
  `tests/e2e/home.spec.ts` now asserts zero empty tiles rather than deleting
  the check, so a tile that reappears must carry real stock.

  Spill Control was the second such category until 2026-08-17, when the
  campaign banners supplied a real seven-SKU range for it. That is why every
  test of this keys off `productCount` and not the `expanding` flag alone.

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

- **A no-credential run of `tools/fetch-banners.mjs` EMPTIES
  `src/assets/banners/`, and the next plain `astro build` with credentials then
  fails.** The rows are enabled, the files are gone, and the build stops rather
  than rendering a hero with a missing band — which is §26 working as designed.
  But it means any build you run with the Supabase variables blanked (to
  reproduce CI, say) leaves the working tree in a state only `npm run build`
  recovers, because that is what chains the fetch. `npx astro build` alone will
  keep failing and the error names the file rather than the cause.

- **`src/assets/banners/` is generated, so a gate that checks it passes only for
  people who have built once.** It is gitignored and absent from a fresh clone
  and from CI. `tools/doc-paths.mjs` names it alongside `dist/` for exactly this
  reason; a check that resolves it will be green on every developer's machine
  and red in CI, which is the most expensive way for a gate to be wrong.

- **A URL that fills the enquiry basket must clear its own parameters.**
  `/enquiry?product=…` adds the product on mount, and `addItem` INCREMENTS an
  existing line rather than duplicating it — so parameters left in the address
  bar turn every reload into another unit. `src/lib/enquiry-prefill.ts`'s
  consumers call `history.replaceState` the moment they have read the context,
  and that call is correctness, not tidiness. The same `replaceState` is what
  stops a second prefill overwriting a message the buyer has since edited.

- **Geometry read straight after `page.goto('/')` on the home page is up to 16px
  low.** `hero-rise` starts at `translateY(16px)` and settles over ~0.9s, so a
  bounding box taken before it ends measures a frame of the motion rather than
  the layout. It fails under contention and passes on retry, which reads as a
  flaky test rather than a timing bug. `heroSettled()` in
  `tests/e2e/hero-mobile.spec.ts` waits for the finite animations — and filters
  the infinite ones out, because `finished` on the ticker never resolves and
  awaiting it hangs the test until timeout.

- **There are THREE WhatsApp links on a product page and only two of them
  message Spartan.** `src/lib/share.ts` builds `https://wa.me/?text=…` with **no
  recipient**, so the buyer picks who to forward a product to.
  `src/lib/whatsapp.ts` builds `https://wa.me/<number>?text=…`, which opens a
  chat with the company. One path segment separates "send this to a colleague"
  from "message the supplier", and neither control says which it is beyond its
  label. They are two modules for that reason — do not merge them, and do not
  relabel one to match the other. `tests/e2e/whatsapp.spec.ts` pins the share
  link as recipient-less.

- **The floating WhatsApp button is the only `position: fixed` element on the
  public site, so it has no surface — it floats over both the dark and the light
  ones.** Contrast for it therefore cannot be measured against one section the
  way every other colour decision here is. WhatsApp's familiar `#25D366` is
  10.09:1 on `--surface-page` and **1.98:1 on white**, so it passes on the home
  page and fails its 3:1 graphical-object boundary on all 94 product pages. The
  shipped `#128C7E` is 4.84:1 / 3.83:1 / 4.14:1 across dark, light and the white
  glyph. Re-measure against a LIGHT section before changing it.

- **The hero has a BUILD-TIME branch, so a browser test can only ever see one of
  its two states.** No banners renders an empty slot; banners render a carousel.
  Which one `--full` tests is decided by whether the throwaway stack has banners
  in it — and for four days it had none while production had three, so six tests
  asserted an empty band and passed while the carousel had no coverage at all,
  the WCAG 2.2.2 pause control included. `tools/seed-banners.mjs` now seeds the
  fixture, `tests/e2e/hero-carousel.spec.ts` REFUSES rather than skips when the
  band is empty, and `src/components/sections/Hero.test.ts` covers both branches
  by rendering the component directly. **Do not add a hero assertion to a spec
  that is silent about which state it needs.**

- **`prefers-reduced-motion` in Playwright needs `contextOptions.reducedMotion`,
  not `reducedMotion`.** On the pinned version `test.use({ reducedMotion:
  'reduce' })` compiles, is silently discarded, and the page never enters the
  branch — so the assertions run against the ordinary page. `motion.spec.ts` has
  documented this since it was written and `hero-carousel.spec.ts` still walked
  into it. Assertions specific enough to fail are the only reason it was caught.

- **`\b` is not a token boundary for a BEM class name.** `hero__slot-icon` and
  `hero__slot-label` both match `/\bhero__slot\b/`, so counting elements that way
  reported four empty slots where one is rendered. Parse the class list and
  compare tokens instead. The same trap applies to any `hero__x` / `hero__x-y`
  pair, which is most of this codebase's markup.

- **The 3:2 phone rule is on `.hero__slot` and NOT on `.hero__frame`, and the
  4:1 that leaves on a phone is now DELIBERATE.** The empty band opens out on a
  phone and the real carousel does not, so the live band is 335 × 84 at 375px.
  That asymmetry started as a defect; the client was shown the cost on
  2026-08-27 and chose to keep it, so **do not "fix" it and do not delete the
  test in `tests/e2e/hero-carousel.spec.ts` that pins it.** Cropping to 3:2 cuts
  the sides off artwork carrying a headline and a QR code, which is why
  reversing it needs the client rather than a CSS edit.

- **The header's logo lockup follows `onMedia`, and before 2026-09-03 it did
  not.** `Header.astro` rendered the black-wordmark lockup on every surface, so
  the division pages' dark heroes had an invisible wordmark for weeks — a
  rendered `<img>` with correct `alt`, dimensions and a 200, which is why
  nothing caught it. A page whose header sits on a dark surface must pass
  `headerOnMedia` to `BaseLayout`; the home page does now.

- **A screenshot of the home page taken without scrolling shows every section
  below the fold at opacity 0, and that is the motion layer, not a defect.**
  `src/scripts/landing-motion.ts` hides below-viewport elements at load and
  reveals them on intersection; a full-page capture straight after `goto`
  photographs the hidden state. Scroll through the page first (the
  screenshot helper in `docs/UI-UX-AUDIT.md`'s workflow does), or capture
  under `prefers-reduced-motion: reduce`, where the layer does nothing. The
  same applies to the proof strip's numbers, which read "0" for the first
  second after they enter the viewport.


## The phone layout, since 2026-09-10

- **`SectionHeading` is one column below 700px, and `.sec__side` is
  `display: contents` there.** That promotes the numeral and the action into
  the head's own grid so each can be placed on its own row — numeral, body,
  action. **`display: contents` changes box generation, not the DOM**, so
  `.sec--side > .section-index` matches nothing: `.sec__side` is still the
  span's parent element. Write the descendant form. The child form fails
  *silently and half-correctly* — auto-placement still drops the numeral into
  row 1 once `.sec__body` is pinned to row 2, so the order looks right and only
  the alignment is wrong, which is exactly the kind of near-miss that gets
  shipped.

- **The numeral is flush LEFT on a phone and flush RIGHT everywhere else, and
  both are deliberate.** `SectionHeading`'s own comments say the numeral is
  "always at the right edge of the measure"; that is the two-column head, where
  it counterweights the text beside it. In one column there is nothing to
  counterweight. Do not "restore" the right edge on mobile.

- **`ProductGrid` goes to one column below 600px, and 600 is derived, not
  chosen.** A two-up card clears ~280px at a 600px viewport, which is where
  `-webkit-line-clamp: 2` on a spec row holds ~70 characters and stops cutting
  values. Below that the clamp ate real specifications: 6 of 24 spec rows at
  390px, 8 of 24 at 360px, and what it cut was the model list and the power
  range. **Narrowing this card again reintroduces that**, and the section's own
  lede promises "the specifications printed for each".

- **There is no `--pg-cols-xs`, and that is not an oversight.** The other three
  counts are `Math.min(n, cols)` so a grid holding fewer products than columns
  does not stretch its hairlines across empty cells. At one column the minimum
  is always 1 for any grid that renders at all.

- **The home page is ~13,250px tall at 390px, up from ~11,850px, and the single
  product column is why.** That was the accepted cost of printing whole
  specifications. If it needs to come down, show fewer products at the phone
  breakpoint — do not narrow the card.

## The About picture, since 2026-09-10

- **`src/assets/hero/glove-drill.png` is a GENERATED image, and it prints an
  EN 388 rating that has no source.** Legible on the back of the glove: a CE
  mark, an EN 388 shield and `3131X`. The Latex Coated Gloves it resembles carry
  **no** recorded EN 388 rating — brochure page 17 states none, so the field is
  absent and the product page correctly shows nothing. **The home page therefore
  displays a five-part protection rating that the product's own page declines to
  give.**

  The markings were painted out on 2026-09-10 and **restored the same day on the
  client's explicit instruction**, after that measurement was put to them. It is
  recorded as a decision, not an oversight. **It is not settled**: brochure
  page 17 decides it. If the page prints `3131X`, fill in the product's `en388`
  and the contradiction goes away; if it prints anything else, this image is
  wrong. **Check any replacement for printed ratings before committing it;
  nothing in `npm run verify` reads pixels.**

- **It lives in `assets/hero/`, not `assets/products/`.** Everything in
  `assets/products/` is a brochure photograph of a real item. Moving this file
  there would put a generated picture into the catalogue's evidence.

- **The drill is deliberate and is not a claim about the range.** Spartan sells
  no power tools; the client's call on 2026-09-10 was that a tool in shot reads
  as the work being done. Do not file it as a defect.

- **There is no plate behind the picture and no red corner rule, both on
  purpose.** It ran briefly on `--surface-alt` with the rule marking the
  block's top-left corner. The client asked for the grey to go on 2026-09-10;
  with no filled block there is no corner to mark, and the drill's bit reaches
  into exactly that spot, so the rule rendered as a red bar across the tip of
  the tool. `overflow` is visible on `.about__vis` for the same reason — there
  is no plate edge to clip the chatter against.

- **`.about__rig` exists because `.about__vis` belongs to the reveal.**
  `.about__vis` is in `RISE` in `src/scripts/landing-motion.ts`, so anime.js
  writes an inline `transform` on it. A CSS animation on the same element would
  win — **animations outrank inline styles** — and swallow the reveal. The rig,
  the shake and the spin layer all sit inside it, where the reveal never reaches.

- **THE CUE IS THE BLURRED CHUCK, NOT THE SHAKE.** The first version shook the
  whole picture and read as a trembling page rather than a running tool. What
  says "this drill is on" is that the chuck loses its knurl — a cylinder
  spinning about its own axis keeps its outline and smears its surface — so
  `glove-drill-spin.png` is the same frame with only that chuck blurred, on
  transparency, cross-faded over the still one. **If the picture is ever
  replaced, that second file has to be regenerated with it** or the drill will
  spin a chuck that is no longer there.

- **The blur is masked by the region's own alpha eroded well inside the
  silhouette.** Blur it without eroding and the colour spreads past the edge as
  a grey haze on white, which reads as a rendering fault. Both ends of the
  region fade out so it meets the numbered clutch collar — which does not turn —
  without a seam.

- **The motion is three animations on three elements, and reduced motion turns
  them off in three separate rules.** One shared selector list would be a single
  edit away from silently reviving the motion for everyone who asked for none,
  which is exactly how `.hero__glow` got away once. `tests/e2e/motion.spec.ts`
  asserts all three names are `none` **and that the spin layer's opacity is 0** —
  its resting 0 is declared outside the keyframes, so `animation: none` is only
  enough while nobody gives that layer a fill mode.

## The side rails and the footer, since 2026-09-11

- **The rails are masked at the footer's top edge, and the mask is driven from
  JavaScript.** Both are `position: fixed` and centred on the viewport, so at
  the bottom of the page they printed light grey mono type across the near-black
  footer. `railAbsorb()` in `src/scripts/landing-motion.ts` writes `--rail-cut`,
  the distance from each rail's top to the footer's top, on every scroll;
  `SideRails.astro` masks the rail off at that distance. **Change the footer's
  markup and this still works — it measures `document.querySelector('footer')`
  — but delete the `<footer>` element and the rails silently stop being masked.**

- **`--rail-cut` defaults to `4000px`, not `100%`, and that is load-bearing.**
  The fade band is subtracted from the cut, so a `100%` default would fade the
  bottom 30px of every rail permanently — including for a reader with
  JavaScript off, who never gets a corrected value. The default has to put both
  gradient stops past the end of the box.

- **`railAbsorb()` is OUTSIDE landing-motion's `if (!reduced)` branch, with
  `railSpy()`.** Rails printed over the footer is a layout defect, not a
  flourish, so a reader who asked for less motion still needs it fixed. Moving
  it inside restores the bleed for exactly those readers and every other test
  still passes; `tests/e2e/motion.spec.ts` has a reduced-motion case that fails
  if anyone does.

- **The left rail also fades out; the right rail only masks. Both are
  deliberate.** A clipped continuous line reads as running under the footer,
  which is the effect. A clipped NUMBERED LIST reads as broken — and at the
  bottom of the page the mask eats precisely the entries the scroll-spy has lit,
  leaving an index whose current item is the one you cannot see. So the left
  rail carries `data-rail-absorb="fade"` and goes to `opacity: 0` rather than
  standing truncated. Do not "fix" the asymmetry.

- **`[data-rail]` still means the LEFT rail alone.** Two side-rail tests use it
  as a single-element locator. The absorb hook is the separate
  `[data-rail-absorb]`, which is on both; widening `data-rail` breaks those two
  tests with a strict-mode violation rather than an assertion failure.

## The gap that hid a red CI for two weeks, found 2026-09-11

- **`npm run verify` green does NOT mean CI will be green, and the gap is
  Docker.** `--full` refuses to run without the throwaway Supabase stack, that
  stack needs Docker, and Docker does not run on the machine this is developed
  on. So every local run asserts `TEST_DB_UP === false` and CI asserts `true` —
  two different branches of `tests/e2e/stack.ts`, and only one of them is ever
  executed here. **A change to the enquiry outcome, the success receipt or
  anything under `/admin` is unverified until CI reports.** Say so rather than
  reporting the local green as cover.

- **The enquiry response body is compared EXHAUSTIVELY, so adding a field to it
  breaks the e2e suite.** `expectEnquiryBody` in `tests/e2e/stack.ts` splits off
  `reference` and `toEqual`s the rest; anything new arriving in that body fails
  three tests. That is deliberate — the two clients key their honesty off the
  contract — so **when you add a field, come here**. `toMatchObject` would make
  the failure go away and delete the property at the same time.

- **`reference` appears in the response only when a row was written**, so it is
  invisible to every local run. This is what kept CI red for 18 runs from
  2026-08-30: the field was added at the route, the exhaustive compare saw a
  fourth key on every DB-backed run, and nothing on this machine could reproduce
  it. `withReference` in `src/lib/enquiry-outcome.ts` now holds that rule as a
  pure function and `enquiry-outcome.test.ts` pins the **key set** on both
  branches — locally, with no container. **Pin a response contract in a unit
  test; an e2e test that needs a container is not a gate you can run.**

- **Actions logs are 403 without a token even though the repo is public.** Run
  and job metadata, conclusions and check-run annotations all read fine
  unauthenticated from `api.github.com`, and that is enough to find WHICH step
  failed and WHEN it started — the annotation itself only says "exit code 1".
  For the actual error, either `gh auth login` or read it in the browser.

## The phone hero, since 2026-09-12

- **The campaign band paints ABOVE the two CTAs on a phone and BELOW them on
  desktop, and the document order matches desktop.** The swap is `order` in the
  `max-width: 900px` block, where `.hero__wrap` becomes a flex column for no
  other reason. **Do not "tidy" the orders away** — they are written out in full
  for all five children on purpose, because one stray `order: -1` is unreadable
  later.

- **`.hero__actions` lives OUTSIDE `.hero__copy`, and that is load-bearing.**
  `order` only reorders siblings, and the stage is a child of `.hero__wrap`;
  while the actions were nested inside `.hero__copy` no rule could interleave
  them. Putting them back inside silently kills the phone order — the page still
  renders, just in the desktop order at every width. The same split, for the
  same reason, is what the pre-September hero used.

- **The band's Pause control is reached by Tab AFTER the two buttons although it
  paints above them on a phone.** Known and accepted: one control, on the
  breakpoint where tabbing is rarest. Reordering the document to fix it would
  move the identical mismatch onto desktop, where keyboard use is common.
  Reading order is unaffected — the slides are decorative with empty alt.

- **The band is full-bleed on a phone but the CONTROL ROW is not.** The negative
  margin on `.hero__stage` takes everything inside it edge to edge, which
  printed "01" against the left edge of the screen and "CAMPAIGN" against the
  right; `.hero__bar` gets `--wrap-pad` back. Artwork may touch the edge, type
  read as a label may not. **Anything else added inside the stage needs the same
  treatment.**

- **Width was the lever, not a taller crop, and the 4:1 ratio is untouched.**
  The client asked for a more prominent band; escaping the wrap's padding took
  it from 335 x 84 to 375 x 94 at a 375px viewport with nothing cut. The ratio
  is its own client decision because the artwork carries a headline and a QR
  code — see the entry above. `hero-carousel.spec.ts` pins ratio, left edge and
  width together.

- **`.hero__doors` is `display: none` below 900px, not removed.** The markup and
  every unit test that counts the doors are untouched, which means
  **`toHaveCount` cannot tell that they are hidden** — `home.spec.ts` went on
  passing on the mobile project while measuring something invisible until it was
  pinned to a desktop viewport. Assert the box, not the count.

## The overlay header, since 2026-09-12

- **`.site-header--transparent` is `position: fixed`, and it was `absolute`.**
  Absolute pinned it to the DOCUMENT, so on the only three pages that use this
  mode — `/`, `/electricals`, `/safety` — it scrolled away at 86px and did not
  return until the reader went back to the very top. **Do not "restore"
  absolute**: the other 115 pages already have a header that follows the reader,
  and on the home page this left 99.3% of a fifteen-screen page with no menu
  button and no sight of the enquiry basket.

- **`fixed`, NOT `sticky`.** Sticky puts the header back in normal flow, which
  adds 86px above a hero that already reserves exactly that much padding to
  clear it. Fixed keeps it out of flow, so no hero geometry moves.

- **A fixed TRANSPARENT bar has page content running under it**, so it must take
  a background once scrolled. `src/scripts/header-scroll.ts` adds `is-scrolled`
  past the header's own height — which is the hero's reserved clearance, so
  nothing legible passes beneath the bar while it is still transparent.

- **The script REMOVES `on-dark` rather than overriding it**, and that is
  deliberate. The class means "this header is over photography", which stops
  being true the moment the bar turns white. Unpicking the dark-surface rules
  one at a time in CSS would leave the next person to add one with a header
  correct in three places and wrong in the fourth.

- **Both logo lockups now ship and CSS picks one.** It used to be a single
  `<img>` chosen at build time from `onMedia`, which cannot survive a surface
  that changes mid-scroll: on the two division pages the white wordmark would
  end up on a white bar. **That failure is invisible to every gate here** — an
  invisible wordmark is still a rendered `<img>` with correct alt, dimensions
  and a 200. `navigation.spec.ts` asserts the visible/hidden pair on both
  surfaces.

- **`@media (scripting: none)` puts it back to `absolute`.** The background is
  written by a script; with no script, a fixed transparent bar would sit over
  the page with content running under it and both illegible. The fallback is the
  old defect, which is strictly better than unreadable chrome. **Do not delete
  that block when tidying.**

- **This header's `<script>` is INLINE, not bundled, and it needed a CSP hash.**
  Astro inlines a small module rather than emitting a file, so adding it took
  the hash count from 7 to 8 and the page was blocked at runtime until
  `npm run csp` ran — the header rendered, nothing failed, and the bar simply
  never solidified. The CSP gate does catch it; the build and `astro check` do
  not. **Adding or editing a script here means `npm run csp` and committing
  `vercel.json`.**

## The header's three states, since 2026-09-12

- **The header is opaque from ONE pixel of scroll, not from its own height.**
  The first attempt used its height as the threshold, reasoning that the hero
  reserves exactly that much clearance. It does not — the hero's padding is
  `--header-h + 28px` — so between 0 and 86px the masthead and the section
  numeral slid up into a still-transparent fixed bar and collided with the logo
  and the menu button. **Raising this threshold reintroduces that.**

- **`transform` on the header makes it the containing block for the mobile nav
  panel, which is INSIDE it.** The panel is `position: fixed` and would hang off
  an 86px bar instead of covering the screen. Two things stop that: the script
  refuses to hide while the menu is open, and
  `.site-header:has([aria-expanded='true'])` clears the transform outright,
  which also closes the ~200ms window where the transition is still running as
  the panel appears. **Never add `will-change: transform` here** — it creates the
  same containing block permanently, for every page.

- **`is-away` is suppressed under reduced motion, in the script and not only in
  CSS.** Removing the transition alone would leave a bar that vanishes and
  reappears with nothing to explain the movement, which is worse than one that
  never leaves.

- **`scroll-padding-top` lives on `html` and is what keeps in-page anchors out
  from under the header.** It was missing on all 118 pages: `#about` landed at
  y=0 with the header covering the first 87px of it. It belongs on the scrolling
  CONTAINER, so it covers every anchor, `scrollIntoView` and focus scrolling at
  once — `scroll-margin-top` per target is the same number copied as many times
  as there are targets.

- **`--header-h` in tokens.css is the one number three things depend on**: the
  hero's top padding, `scroll-padding-top`, and the header's own height. This
  file used to say these were "one arithmetic chain and nothing but this comment
  connects them". Now the token connects them — **do not re-inline it.**
