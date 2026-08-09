# Backlog

The work queue for `/improve`. **This file is the agent's memory** — it is read at
the start of every iteration and written at the end of one. Keeping it accurate
is part of the task, not admin overhead.

Seeded 2026-08-08 from a full audit of the finished build (all 17 tasks complete,
see `handoff.md`). Priorities are P0 highest.

## How to read this

- `[ ]` open · `[~]` in progress · `[x]` done · `[!]` blocked
- **Blocked** items name what they are waiting for. Do not attempt them; do not
  invent the missing input to unblock yourself.
- Anything touching client-supplied facts (contact details, certifications,
  product specs) is blocked by definition until the client supplies them.
- Add discovered work to the bottom of the right section rather than doing it
  inline. One iteration, one item.

---

## P0 — losing leads right now

- [x] **Wire the inert enquiry forms to `/api/enquiry`.** Done for the home CTA
      and the /contact form — see Done below. The footer field was split out as
      its own item (next) because it is a newsletter subscribe, not an enquiry,
      and wiring it to an RFQ endpoint would misrepresent what the buyer asked
      for. Original note kept below for context.
      `src/components/sections/EnquiryCta.astro:45`, `src/pages/contact.astro:97`,
      `src/components/layout/Footer.astro:82` all carry the comment *"No endpoint
      until Task 14"*. Task 14 shipped. `/api/enquiry` exists, works, and already
      accepts a zero-item general enquiry (`tests/e2e/enquiry.spec.ts:367`).
      Today a buyer fills the **Contact page form**, clicks Send, and nothing
      happens at all — no request, no error, no message.
      **Snag:** all three collect *Division of interest*, which
      `enquiryPayloadSchema` has no field for. Either add `division` to the
      schema (and to the email body in `api/enquiry.ts:bodyFor`) or fold it into
      `message`. Do not silently drop it.
      **Must:** never show success unless the response says `delivered: true`;
      the existing `EnquiryForm.tsx` already models this correctly — copy its
      pending/ready gate and its error handling rather than inventing a second
      pattern.

- [x] **Decide what the footer email field is for.** Decided by the client on
      2026-08-09: **a newsletter was never intended.** Removed rather than
      wired — see Done below.

- [ ] **Confirm the Name field added to the home CTA.** Wiring the CTA required
      one: `enquiryPayloadSchema` requires a name and the form collected only
      company, division and email, so every submission would have failed
      validation. The alternative was relaxing that bound for every caller
      including /enquiry, where it is required, tested and correct. This is a
      visible change to the approved design (`design/direction-b-forge.html`
      shows three fields, the form now has four) and a person should sign it off.

- [ ] **Footer social icons link nowhere.** Three `href="#"` on all 97 pages
      (`Footer.astro`). Either the client supplies URLs or the icons come out.
      Absent the URLs, **remove them** — a link that goes nowhere is worse than
      no icon — and leave `sameAs` correspondingly absent from
      `organizationJsonLd`. This is a build decision, not a client one.

- [x] **Replace `public/robots.txt` with `src/pages/robots.txt.ts`.** Done — see
      Done below.

- [!] **Set the real domain.** Blocked: client has not confirmed one.
      `spartan.example` is RFC 2606 reserved and can never resolve, so all 96
      canonicals, every OG URL and the whole sitemap point at nothing.
      **Now a one-line edit** to `site` in `astro.config.mjs` — robots.txt
      follows from it and can no longer be left behind.
- [!] **Real contact details.** Blocked: client. `+971 00 000 0000` renders as a
      live `tel:` link in the header of all 97 pages; `sales@spartan.example` is
      a dead mailbox. `src/data/site.json`.
- [ ] **Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.** The
      table, the policies and the code are all in place; the deployment simply
      has no credentials yet, so production would still return
      `recorded: false`. The service-role key is a full-access credential and
      must be set as a Vercel environment variable only — never committed, and
      never exposed to the browser (a verify gate enforces the second half).
      Project `spartan`: `https://wslylysakixrirxkozih.supabase.co`.

- [ ] **Resend credentials in Vercel.** No longer a data-loss risk — with the
      database configured the enquiry is safe and the email is only the nudge —
      but until it is set nobody is told an RFQ arrived, so somebody has to
      watch the Supabase table.

## P1 — discoverability and hardening

- [x] **Add `/catalogue` to the primary navigation.** Done — see Done below.

- [x] **Build the search UI.** Done — see Done below.

- [ ] **Consider surfacing search outside `/catalogue`.** It now lives in the
      catalogue filter bar, which is the right home for it, but a buyer on a
      product page or the home page has no search affordance — they have to know
      to go to `/catalogue` first. A header search would need real thought: the
      nav row already measured 55px of clearance at 1081px with 7 items, so
      there is no room for an inline field, and a toggle/overlay is a new
      interaction pattern for this design. Not obviously worth it — raise with
      the client before building.

- [x] **Add `vercel.json` with security headers and long-cache rules.** Done —
      see Done below.

- [x] **Add CI.** Done — see Done below.

- [ ] **Analytics and error monitoring.** Zero references anywhere in `src/`.
      A lead-generation site with no measurement of the funnel it exists to
      serve. Prefer a cookieless, no-consent-banner option so it does not drag a
      consent UI onto the site; confirm the choice before wiring it.

## P2 — quality

- [ ] **Product pages are thin.** The product schema has **no description field
      at all**; all 72 are name + specs (median 3 spec rows). The richest page on
      the site has 209 words in `<main>`; most have far less, and generated meta
      descriptions are near-identical in shape across the catalogue.
      **This is not licence to write product copy.** The legitimate moves are
      structural: category-level application text, better cross-linking, and
      surfacing the related-products strip. Per-product prose needs the client.

- [ ] **`preload="auto"` on a 1.46 MB hero video** (`Hero.astro:91`) competes for
      bandwidth with the render-blocking CSS behind the LCP text element — the
      metric with the least headroom (mobile Perf 95–97). Scrubbing genuinely
      needs the buffer, so **measure before changing**, and do not touch the GOP
      (see Do Not Touch).

- [ ] **Home `h1` reads `Home and IndustrialSolutions.`** in `textContent` — the
      `<br>` leaves no space for string extraction. Cosmetic for sighted users,
      affects extraction and some screen readers.

- [!] **Real product photography.** Blocked: client. Native sizes are 100–440px,
      which is the ceiling on the design and the cause of the one Lighthouse 96.
      `srcset` is already in place, so it drops in with no markup change.
- [!] **Compress the 163 MB brochure** before any "Download brochure" button can
      exist. Blocked: needs the source PDF, which is not on this machine.
- [!] **Confirm the eight "Industries We Serve"** — inferred from the product
      mix, not stated in the brochure. Blocked: client.

## P3 — housekeeping

- [ ] `design/assets/products/` duplicates `src/assets/products/` (~10 MB).
      Deliberate — it enables byte-comparison after a re-extraction. Drop only if
      that has stopped being useful.
- [ ] 7 `astro check` hints, all unused parameters in `tools/*.mjs`. Harmless.

---

## Done

- **2026-08-09** — **Enquiries are now stored, not just emailed.** Until this
  landed `/api/enquiry` had no storage of any kind: an enquiry existed only as
  an email, and the branch that ran when Resend threw returned 502 and
  **discarded the payload without logging it** — a validated, willing buyer lost
  with no trace on either side.

  The enquiry is now written to Postgres first and the email is a notification.
  Supabase project `spartan`, one `enquiries` table with `items jsonb`, plus an
  `enquiry_lines` view that unnests it so "which products are actually asked
  about" is a `group by`. Single insert, so atomicity needs no RPC. RLS on with
  zero policies — `anon` can neither read nor write, and only the service-role
  key, which never leaves the serverless function, can insert. The browser never
  talks to Supabase, so `connect-src` is untouched.

  Design doc: `docs/superpowers/specs/2026-08-09-enquiry-collection-design.md`.
  13 unit tests added; verify 11/11.

  *Worth knowing:* `unconfigured` and `failed` had to be different channel
  states, and treating them alike would have 502'd every enquiry in the e2e
  suite — CI holds no secrets for either channel, so both come back
  unconfigured, and "nothing carried it" is only a lost lead if something was
  asked to. The rule is *every **configured** channel failed*, and
  `decideOutcome` is a pure function precisely so all nine combinations are
  asserted directly rather than inferred from a passing e2e run.

  *Worth knowing:* the view needs `security_invoker = true`. Postgres views
  default to definer semantics, so without it `enquiry_lines` would have read
  straight past the RLS on the table it reads from — verified by querying both
  as `anon` and getting zero rows from each while a row existed.

  *Worth knowing:* a data-modifying CTE's rows are not visible to the rest of
  the same statement, so the first round-trip check reported the view returning
  0 lines for a row it had just inserted. The view was fine; the test was wrong.

- **2026-08-09** — Removed the footer email field. It was labelled *Enter email
  address* with a Submit button — a newsletter subscribe, with no mailing list
  behind it and, per the client, never intended as one. A control that cannot do
  what it says is worse than no control, and wiring it to `/api/enquiry` would
  have sent sales an RFQ from someone who believed they were subscribing.

  The contact strip now carries address, phone and email — three real facts —
  with the email as a `mailto:` on the same 44px target treatment the phone
  number already had, and `justify-content: space-between` so the row does not
  bunch left where the field used to sit. `--f-input-bg` went with it.

  The mockup (`design/direction-b-forge.html`) still shows the field; this is a
  deliberate departure from the approved design, recorded in the component. No
  test referenced it.

- **2026-08-09** — Added `.github/workflows/verify.yml`. Runs
  `npm run verify -- --full` — the identical command a developer runs and the
  one `/improve` requires before committing — on every push and PR, so CI
  cannot drift from what people actually run, and any gate added to
  `tools/verify.mjs` arrives in CI for free. Chromium only (both Playwright
  projects use it), report uploaded on failure, superseded runs cancelled.

  Verified by running the exact CI sequence locally from a clean
  `npm ci`: 10/10 gates, 137 e2e. That mattered — `npm ci` re-runs the install
  that npm 11 blocks scripts for, and had `allowScripts` not covered esbuild,
  CI would have failed on its first step with the binary missing.

- **2026-08-09** — Added search to the catalogue filter bar. `searchProducts()`
  had been written and tested since Task 5 and called from nowhere.

  The matching rule moved to `src/lib/search.ts` and is now shared:
  `searchProducts` uses it server-side, and the page bakes the same string into
  each card's `data-search` at build time so the island applies the identical
  test in the browser. Two implementations would drift, and a product findable
  one way but not the other reads to a buyer as missing stock. Search combines
  with the division and category filters rather than replacing them, and
  narrows the DOM already on the page — nothing is fetched, so the page stays
  complete for a crawler and with JavaScript off.

  A second empty state was needed: "No products in this range yet" is a claim
  about Spartan's catalogue and is wrong for a search miss, which is a
  statement about the term. 9 unit + 8 e2e added; verify 10/10, 137 e2e.

  *Worth knowing:* the fields are joined with `\n`, not a space, so a query
  cannot span two of them — joined with a space, "muff abs" would match a
  product named "Ear Muff" whose first spec began "ABS", a hit no single field
  makes. There is a test for exactly that.

  *Worth knowing:* two of the new e2e assertions were silently useless at
  first. Waiting on "the safety-helmets card is visible" settles instantly
  because it is already true of the unfiltered 72, so the count read afterwards
  was still 72 — it passed when run alone and failed in the full suite. When
  waiting for a filter to apply, assert something **false before it applies**:
  the status line changing, or a sibling product having *disappeared*.

- **2026-08-09** — Added `vercel.json`: CSP, HSTS, X-Content-Type-Options,
  Referrer-Policy, Permissions-Policy, X-Frame-Options, COOP/CORP, plus
  year-long immutable caching for `/fonts/` and `/video/` (2.9 MB of hero video
  and 84 KB of preloaded fonts were revalidated on every visit — only
  `/_astro/` had a cache rule).

  `script-src` is **hash-based, not `'unsafe-inline'`**. Measured first: 172
  distinct inline scripts in the output, but only **7 are executable** — the
  rest are JSON-LD data blocks, which browsers do not execute. 7 is small
  enough to hash. `tools/csp.mjs` derives them from the build (`npm run csp`)
  and a verify gate re-derives and fails on drift, because a stale hash does
  not fail the build — it ships and the site never hydrates.

  `tests/preview-server.mjs` now applies vercel.json's header rules, which is
  what makes any of this testable: a preview serving no policy cannot show that
  the policy breaks the site. 20 e2e added, including a real hydration and a
  real enquiry POST under the live policy. verify 10/10, 129 e2e passing.

  *Worth knowing:* the blocker was the footer's `onsubmit="return false"` —
  the site's only inline event handler, on all 97 pages, and inline handlers
  need `'unsafe-inline'` or `'unsafe-hashes'`. It is now a `<div>` not a
  `<form>`. Removing the element rather than the attribute is what makes it
  safe: a form with a single text input submits on Enter whether or not it has
  a submit button, so `type="button"` alone would have let it navigate with the
  address in a query string.

- **2026-08-09** — Replaced `public/robots.txt` with `src/pages/robots.txt.ts`,
  which derives the `Sitemap:` URL from `Astro.site` at build time. The domain
  is now written in exactly one place, so setting it is a single edit that can
  no longer half-happen. Added a verify gate asserting the emitted robots.txt
  names the same origin as the home page's canonical, and that a
  `public/robots.txt` has not come back to shadow the endpoint — proved against
  a planted violation. Updated the now-false paragraphs in README.md §3 and
  handoff.md §7. 6 e2e added; verify 9/9, 109 e2e passing.

  *Worth knowing:* a prerendered endpoint's `Response` headers never reach the
  wire — Astro writes the body to a file and the host labels it by extension.
  The robots.txt body is therefore pure ASCII rather than relying on a
  `charset` header that gets discarded.

- **2026-08-09** — Added Catalogue to the primary navigation, heading the three
  product-browsing routes. `NavItem` gained an optional `section` prefix and a
  shared `isCurrentNavItem()` so the desktop menu and the mobile panel cannot
  disagree about which link is lit; Catalogue lights on all 15 category pages
  but takes `aria-current="page"` only on the index itself. Product pages light
  nothing — they sit at `/products/…` and their breadcrumb already says where
  they are. Measured at 1081px, the narrowest width the desktop menu is shown
  at: 55px clearance either side, no overflow. 10 e2e added (first coverage the
  primary nav has had); verify 8/8, 103 e2e passing.

  *Worth knowing:* a bare `/* … */` comment between JSX attributes parses as
  attributes. `astro build` succeeded and all 103 e2e passed with `is`, `not`
  and `and` being emitted into the markup — only `astro check` caught it. Put
  explanatory comments above the `return`, never between attributes.

- **2026-08-08** — Wired the home CTA and the /contact form to `/api/enquiry`.
  Both were `type="button"` inside a form whose `onsubmit` returned false, so a
  buyer could complete the Contact page and press Send with no request, no
  error and no message. Added `division` to `enquiryPayloadSchema` (optional,
  defaults empty) and to the email body rather than dropping the field the two
  forms collect. Behaviour is a shared progressive-enhancement script,
  `src/scripts/quick-enquiry.ts`, not a Preact island — an island would have
  meant moving both forms' scoped CSS out of their components for no gain, and
  no zod on the client keeps the home page (least Lighthouse headroom on the
  site) from carrying a duplicate of a check the server already makes.
  `delivered: false` is reported as recorded-not-sent, never as success.
  Submit controls are `html[data-js]`-gated with a real fallback route.
  3 unit tests + 10 e2e across both projects; verify 8/8, 93 e2e passing.
