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

- **`SUPABASE_SERVICE_ROLE_KEY` and Vite's build-time `import.meta.env`
  inlining.** This key bypasses row-level security completely, and the
  enquiries table is RLS-enabled with zero policies — it is the only thing
  standing between the public internet and every name, email address and
  phone number the site has collected. A client-side module referencing it
  would have the literal secret substituted into a shipped bundle with
  nothing warning at build time. `tools/verify.mjs` §11 scans
  `src/components`, `src/scripts`, `src/stores` and `src/layouts` for the
  identifier and for any import of the enquiry store module, then sweeps
  built output for the JWT payload string it would leave behind.

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
  time for all 96 prerendered pages.** `src/middleware.ts` runs for every
  route, including the 96 prerendered pages, and for those it runs at build
  time, where there is no meaningful request. Without the early return, the
  build would make 96 pointless auth round trips and the public site's build
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

- **The hero copy's top anchoring.** The hero is a static still now, not the
  scroll-scrubbed film it used to be. The bright mass of the composition
  begins around y=43%, and centred copy put the accent line inside it. Do
  not re-centre it.

- **`image-size-responsive` (Lighthouse Best Practices 96) on product
  pages.** Source photography is natively 100–440px and must never be
  upscaled beyond ~2×. It resolves when the client supplies real
  photography, with no markup change needed.

- **The 3 `npm audit` high findings.** One chain, no upstream fix,
  build-time only. **Never run `npm audit fix --force`** — its only offered
  fix reintroduces 8 XSS advisories.

- **`build.inlineStylesheets: 'always'`.** Considered and rejected: it
  inlines ~41 KB into every page, losing cross-page CSS caching.

- **The two empty categories.** Spill Control and Electrical Accessories
  have no products because the brochure has none.

- **RLS enabled with zero policies on `enquiries`.** Supabase's linter
  reports `rls_enabled_no_policy` at INFO forever. Do not "fix" it by adding
  a policy.
