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
      **Correction, 2026-08-10 — the "Must" above is no longer the rule, and is
      left in place only as the record of what this item was written against.**
      When it was written, email was the only channel. Since `de4b299` an
      enquiry travels down two independent channels — it is written to Postgres,
      the system of record, and an email notification is sent — and **either one
      alone is a success**. The honest signal is therefore `recorded ||
      delivered`, never `delivered` alone: with the row written, a mail outage
      costs a notification rather than a lead, and telling the buyer to try again
      would write a duplicate. `src/lib/enquiry-outcome.ts` is the implementation
      and `decideOutcome` asserts all nine combinations. Both clients read both
      fields, and `npm run verify` has a gate that fails if either stops.

- [x] **Decide what the footer email field is for.** Decided by the client on
      2026-08-09: **a newsletter was never intended.** Removed rather than
      wired — see Done below.

- [ ] **Confirm the AI-generated hero helmet with the client.** The landing hero
      is an AI-generated image — its C2PA manifest asserts
      `trainedAlgorithmicMedia` with GPT/openai markers. It depicts safety
      equipment on a site whose first rule is that nothing about safety
      equipment is invented. Shipping it was a deliberate decision taken on
      2026-08-11 and recorded in `handoff.md` §7 and §11; it still needs a
      person at the client to agree. A real product photograph drops in with no
      markup change. `src/assets/hero/helmet-hero.png`.

- [x] **Finish the landing redesign's documentation.** Done — see Done below.
      Lighthouse was re-run and corrected this item's own premise: all three
      mobile rows had moved, not only the home one.

- [x] **Decide whether the mono's Lighthouse point stands.** **Decided
      2026-08-11: keep the mono.** The register is worth the point. Home stays
      at 94 and the product page at 96 by choice, not by oversight — so if a
      future session finds those numbers and reaches for the obvious saving,
      **this is the decision it would be reversing.** The subset that got it
      from 39.5 KB to 23.1 KB stands; do not re-widen it. `handoff.md` §12.

- [ ] **Sign off the weight scale against the approved design.** Still open, and
      it is the half of that item a person still has to rule on: the scale took
      every heading off the 700/800 that `design/direction-b-forge.html`
      specifies. Same category as the Name field below and the removed footer
      email — a visible, deliberate departure from the signed-off direction that
      needs a person at the client to agree. Nothing is blocked on it.

- [ ] **Confirm the Name field added to the home CTA.** Wiring the CTA required
      one: `enquiryPayloadSchema` requires a name and the form collected only
      company, division and email, so every submission would have failed
      validation. The alternative was relaxing that bound for every caller
      including /enquiry, where it is required, tested and correct. This is a
      visible change to the approved design (`design/direction-b-forge.html`
      shows three fields, the form now has four) and a person should sign it off.

- [x] **Footer social icons link nowhere.** Done 2026-08-12 — removed, per the
      standing decision below. See Done.

- [x] **Replace `public/robots.txt` with `src/pages/robots.txt.ts`.** Done — see
      Done below.

- [!] **Set the real domain.** Blocked: one has not been bought yet. **Interim
      fix applied 2026-08-13:** `site` in `astro.config.mjs` now points at the
      Vercel host the deployment already answers on, rather than
      `spartan.example` — an RFC 2606 reserved name that can never resolve, so
      every canonical, every OG URL and the whole sitemap named a host that does
      not exist. Still a one-line edit when the real domain arrives; robots.txt
      follows from it and cannot be left behind.

      **Two things follow from the interim host, and neither is done:**
      redirect the vercel.app host to the real one once it exists, or it becomes
      a duplicate of the live site in search; and decide whether to keep this
      host out of search in the meantime (next item).

- [ ] **Decide whether the temporary host should be indexable.** The site is
      currently open to crawlers on a throwaway vercel.app address. Indexed
      there, it has to be cleaned up after the real domain lands — the usual
      call before launch is to keep a temporary host out of search entirely.
      Raised with the client 2026-08-13; **not actioned, because turning it off
      is a real change to how the public site behaves and was not asked for.**
      `src/pages/robots.txt.ts` is where it would go.
- [!] **Real contact details.** Blocked: client. `+971 00 000 0000` renders as a
      live `tel:` link in the header of every page; `sales@spartan.example` is
      a dead mailbox. `src/data/site.json`.
- [x] **Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.** Done
      2026-08-13. Enquiries are being written to Postgres in production.

- [x] **Resend credentials in Vercel.** Done 2026-08-13 — see Done below for the
      two false starts, both worth knowing.

- [x] **Create the first admin account.** Done 2026-08-13.

- [x] **Confirm admin Phase 1 against a configured deployment.** Done
      2026-08-13, in production, by hand: sign-in, the populated inbox, the
      detail view, a status change that persisted, the demand report and the CSV
      export. The subsystem is no longer verified only by reading. See Done.

- [ ] **Cover the one auth case production has not exercised.** An
      **authenticated non-admin must be refused** — a valid Supabase account
      that is not in `public.admins`. It is the last Phase 1 acceptance
      condition still verified by reading rather than running
      (`currentAdmin`'s `if (!row) return null`), and it is the check that makes
      the allow-list worth having. Needs a second Supabase user deliberately
      left off the list; a few minutes by hand, and worth doing before anyone
      else is given an account.

- [ ] **There is no password reset.** The admin has no way back in from a
      forgotten password: Supabase's own recovery email points at a page this
      site does not have, so every reset is someone editing the user by hand in
      the Supabase dashboard. Survivable for one operator, not for staff. Found
      2026-08-13 while setting up the first account — the recovery link landed
      on `http://localhost:3000` with an expired-token error, which is two
      faults at once: Supabase's Site URL was still the default, and the
      redirect had nowhere to go regardless.

- [ ] **"Notified" cannot tell a missing setting from a rejected send.** The
      enquiry detail page shows `not emailed` both when the site never attempted
      delivery (no credentials) and when it attempted and the provider refused.
      During the 2026-08-13 setup the difference only existed in Resend's own
      log, which is exactly the conflation `AdminResult`'s
      `unconfigured` / `failed` split removed from every other read. The channel
      state is already computed in `src/pages/api/enquiry.ts` and thrown away —
      persisting it alongside `notified_at` would put the answer on the screen
      where the question is asked.

- [ ] **ACCEPTED FAILURE: the ticker has no pause control on touch screens.**
      Decided by the client on 2026-08-13, after the cost was put to them twice.
      The scrolling category band on the home page runs indefinitely and, on a
      phone or tablet, offers no way to stop it — a **WCAG 2.2.2 (Pause, Stop,
      Hide) Level A failure**, on a site selling safety equipment. It affects
      anyone who cannot track or tune out moving text.

      On a pointer device the control still exists and is revealed by hover or
      keyboard focus, which is conformant. `prefers-reduced-motion` still wins
      everywhere, so a visitor whose device asks for less motion gets a static
      band regardless. Neither of those covers a touch user who has made no such
      request.

      **This is a decision, not an oversight — do not silently "fix" it, and do
      not remove the test that pins it.** Reversing it is the client's call, and
      there are exactly two honest ways: stop the animation on touch too, which
      removes the obligation along with the motion, or restore the control.
      Hiding it more cleverly is not a third option. `Ticker.astro` carries the
      reasoning and `tests/e2e/motion.spec.ts` asserts the current behaviour so
      a reversal breaks a test rather than passing unnoticed.

## P1 — discoverability and hardening

- [ ] **Re-run Lighthouse on all three page types.** The table in `README.md`
      was measured on 2026-08-11 and the footer has changed since — the social
      icons came out, which is site chrome and therefore moves every page.
      §11's lesson was exactly this: the landing redesign restyled `Header` and
      `Footer` and all three mobile rows moved, not only the page that was
      touched. Home 94 and product 96 are **chosen numbers** (the mono
      decision, `handoff.md` §12) — do not "fix" them.

- [ ] **Phase 2 of the admin: the catalogue on Postgres.** This is what §5's
      seam exists for. Replace `file()` in `src/content.config.ts` with a
      database loader; `src/lib/catalog.ts` and every catalogue page are
      untouched. The acceptance test is a **byte-identical build** — build from
      JSON, migrate, build from Postgres, diff. It ships alone, behind its own
      verification, with nothing else in the commit. Three things to carry
      across: `serialiseJsonLd()`'s escaping matters the moment arbitrary text
      can enter the catalogue; the "never invent product data" rule has to
      survive contact with a UI full of empty fields inviting to be filled, and
      `docs/CONTENT-EDITING.md` is the statement of that rule for whoever
      maintains data meanwhile; and once the catalogue lives in Postgres **no
      build works offline**, which is why the phase keeps a documented
      `CATALOGUE_SOURCE=json|postgres` escape hatch rather than pretending
      otherwise.

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

- [x] **`README.md` is not covered by the doc-paths gate.** Done — see Done
      below. It surfaced exactly one pre-existing reference.

- [ ] **The division headers pass contrast only because of their scrim.** On
      `/electricals` and `/safety` the composited worst-case nav link measures
      6.04:1, but against the raw pre-scrim photograph it is **1.11:1**.
      Swapping a division hero photograph is therefore a contrast regression
      waiting to happen with nothing that would catch it — `Header.astro`
      carries a comment and there is no test. Recorded in `handoff.md` §11 as
      open and never queued here, which is why it is being added now rather
      than found again later. Either gate it or make the scrim's floor
      independent of the image beneath it.

- [ ] **Analytics and error monitoring.** Zero references anywhere in `src/`.
      A lead-generation site with no measurement of the funnel it exists to
      serve. Prefer a cookieless, no-consent-banner option so it does not drag a
      consent UI onto the site; confirm the choice before wiring it.

## P2 — quality

- [ ] **Product pages are thin.** The product schema has **no description field
      at all**; every product is name + specs. The richest page on
      the site has 209 words in `<main>`; most have far less, and generated meta
      descriptions are near-identical in shape across the catalogue.
      **Partly addressed for Electricals, and only there.** The datasheet
      integration took that division from ~24 spec rows to 169, so its pages now
      carry real electrical tables. Safety is untouched and is the thin half —
      re-audit against it, not against the catalogue average.
      **This is not licence to write product copy.** The legitimate moves are
      structural: category-level application text, better cross-linking, and
      surfacing the related-products strip. Per-product prose needs the client.

- [x] **`preload="auto"` on a 1.46 MB hero video.** Moot — the video is gone.
      The scroll-scrubbed film was replaced with a static still on 2026-08-09
      and 2.9 MB of MP4 was deleted. See Done below.

- [x] **Home `h1` reads `Home and IndustrialSolutions.`** Fixed in the same
      change: the two headline spans are now separated by `{' '}`, and the built
      `textContent` reads `Home and Industrial Solutions.` Verified against
      `dist/client/index.html`.

- [x] **Higher-resolution hero artwork.** Unblocked and done — the client
      supplied it. This item was written against the 1168×784 / 784×1168 still
      cut from the video's own frames, and said a better render would "drop in
      with no markup change". It did not quite: the supplied files are
      `hero-range-desktop.png` (1672×941) and `hero-range-mobile.png`
      (941×1672), and they carry the logo, the Arabic wordmark and the headline
      **inside the image**, so the component stopped rendering an HTML headline
      and the `<h1>` became `sr-only`. See `handoff.md` §7.

      Two consequences worth knowing before touching the hero. The artwork is
      never cropped — it sets its own height, which is what makes the CTA
      offsets percentages of the picture rather than of the viewport. And it is
      **not** bedded on flat black the way the old still was, so the section
      cannot simply be painted to match: `.hero__frame::after` fades three
      exposed edges instead. Both are documented at length in the component.

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

- **2026-08-13** — **The admin gets the design system.** It worked and looked
  like a default HTML document, for a concrete reason: `AdminLayout` used
  `system-ui` and the site's palette was retyped as ~30 raw hex literals across
  six files. `src/styles/admin.css` is now the admin's component layer — shell,
  page header, summary tiles, filter chips, table, status pills, pager, cards —
  and everything resolves to `tokens.css`. Full reasoning in `handoff.md` §14.

  *Worth knowing:* **no off-the-shelf UI kit can be used here, ever.** shadcn,
  Radix, Headless UI and MUI all need client JavaScript, and admin routes are
  server-rendered so `npm run csp` never sees them — an inline script ships
  unhashed and is blocked with nothing failing. Astro also inlines a script used
  on exactly one page, so the "processed script" escape hatch becomes the
  forbidden thing on a single-page admin route. Filters and pager are anchors,
  the status control is a form POST, mobile is a media query.

  *Worth knowing:* status is carried by **weight, not hue** — decided with the
  client. The palette has no green or amber, and adding one would put an
  unmeasured colour into the system. `new` is a filled red surface, the middle
  states are quieter outlines, `closed` recedes; every pill also renders its
  word, so nothing is colour-only.

  *Worth knowing:* the tiles count with `head: true` and an exact count, so a
  summary figure never becomes the unbounded read the previous session removed
  everywhere else. Counts and list are fetched in parallel and may disagree: a
  failed count hides the tiles, it does not blank the inbox.

  **Not seen by anyone yet.** No credentials on the build machine, so only the
  login page was checkable locally — the inbox, detail and demand screens are
  verified by typecheck, build and the boundary suite, not by eye.

  verify 16/16, 173 unit, 206 e2e.

- **2026-08-13** — **Deployed to Vercel, and the lead-capture path proved itself
  in production.** The whole point of the site, working end to end for the first
  time: an enquiry submitted on the public site was written to Postgres, showed
  up in the admin inbox, emailed the sales address, had its status changed and
  the change persisted, appeared in the demand report and came out of the CSV
  export. Everything before this was verified by reading and by tests.

  *Worth knowing:* **two email failures, and neither was a code fault.** First,
  `ENQUIRY_FROM_EMAIL` had been set to a gmail.com address — Resend will not
  send from a domain you cannot prove you own, and nobody can verify gmail.com.
  The variable exists to be left **empty**, which falls back to Resend's own
  verified sender; deleting it fixed it. Second, that fallback sender only
  delivers to the Resend account's own address, so the destination had to match
  until a real domain is verified. Both are configuration traps with no signal
  in the code, which is why they are recorded here.

  *Worth knowing:* the admin's "Notified" line reads `not emailed` for **both**
  "never tried" and "tried and was rejected", so it could not distinguish a
  missing setting from a rejected send — the answer only existed in Resend's own
  log. That is the same conflation the `unconfigured` / `failed` split removed
  everywhere else, still present on this one field. Queued below.

  *Worth knowing:* a status change that appeared not to work was not a bug. The
  dropdown opens on the current value, so pressing Save without changing it
  writes the same status back, reports success and looks like nothing happened.
  Worth remembering before debugging it again. The endpoint itself was proved
  reachable and correctly guarded from the outside: an unauthenticated POST
  answers 401, and one without an `Origin` header answers 403 from Astro's
  built-in CSRF check.

- **2026-08-12** — **Phase 1 hardened**: the admin can no longer confuse "you
  have no leads" with "I cannot see your leads". `handoff.md` §13.

  Every read returned `[]` on failure, so an unconfigured or unreachable
  deployment rendered "No enquiries yet" — the read-side twin of the defect
  `/api/enquiry` exists to avoid, and a false statement about the business on
  the screen whose job is to be trusted about it. Reads now return an
  `AdminResult` (`ok` / `unconfigured` / `failed`) and the three states stay
  apart all the way to the screen.

  *Worth knowing:* **the CSV export was the dangerous one.** Its failure path
  emitted a header row — a valid file that opens cleanly and says the business
  has no enquiries. A broken page is recoverable; a spreadsheet that lies gets
  saved, attached and quoted from. It now answers 503/502 in plain text with no
  `content-disposition`, so nothing reaches a downloads folder.

  *Worth knowing:* **two silent truncations.** Both reads were unbounded, and
  PostgREST returns a row-capped result with no error — the inbox would have
  begun hiding the oldest enquiries at an unwritten row count and the export
  would have produced a short file that looked complete. Inbox paged at 50 with
  an exact count; export batches and **fails rather than returning a partial
  set**.

  *Worth knowing:* three redirect messages had never been rendered — `/admin`
  read no `error` parameter at all, so `not-found`, `bad-request` and
  `save-failed` were dead the day they shipped. Now `src/lib/admin/notices.ts`,
  a closed whitelist: **the text is never taken from the URL**, because
  arbitrary text inside real admin chrome is a credible phish however well it is
  escaped. Uses `hasOwnProperty`, not `in` — every object inherits `toString`.

  *Worth knowing:* **the service-role gate refused the help text**, because
  `DataState.astro` named the key while telling an operator to set it, and that
  identifier is banned from `src/components`. The fix is not an allow-list
  entry: the gate matches the name because the name is the only reliable proxy
  for the access, and an exception for prose is how a real reference eventually
  gets through. Now in `docs/TRAPS.md`.

  Phase 2 was deliberately **not** started — its acceptance test is a
  byte-identical build from Postgres and there are no credentials here to run
  it. Beginning the dangerous phase unverifiable is the wrong way to begin it.

- **2026-08-12** — **Admin Phase 1 completed**, the hero WIP closed out, and the
  footer's dead social links removed. Full reasoning in `handoff.md` §13.

  Phase 1's plan had Tasks 1–6 landed since 2026-08-09 and 7–12 outstanding. All
  six are in: the enquiry repository, the inbox, the detail view and status
  workflow, the demand report, the CSV export route that `toCsv` had been
  waiting six weeks for, the private-admin verify gate and the boundary e2e
  spec. No schema change was needed — `status` has been on `public.enquiries`
  since the table was created.

  *Worth knowing:* **the new gate found a leak on its first run, and it was not
  in the new code.** `/admin/login/` had been published in `sitemap-0.xml` since
  the guard landed, because `@astrojs/sitemap` emits every known page route
  including the server-rendered ones and nobody had looked. A `noindex` asks a
  crawler not to index a page it found; a sitemap is a document you submit
  telling it to go and find one. Fixed with a `filter` in `astro.config.mjs`.
  The admin's privacy had three named controls and the one place it was actually
  being announced was a file nobody thought of as part of the admin.

  *Worth knowing:* the gate's main purpose — catching an admin page that loses
  `export const prerender = false` and is therefore built as a **public static
  file with build-time data in it** — was proved by removing that line and
  watching it fail. `tools/counts.test.ts` fired at the same time, because the
  pinned server-rendered route count drops when a route stops being one. Two
  alarms, deliberately.

  *Worth knowing:* the hero WIP had **two comments contradicting each other**
  inside one commit — the markup said both CTAs sat below the fold on a 375x667
  and a 360x640, the stylesheet said the short-screen block had made the primary
  one visible on both. A test written to assert the second failed on the
  360x640 by **8px**, on the one control the whole site converts on. Two margins
  trimmed inside that same block close it with 12px to spare. The WIP had also
  falsified a `docs/TRAPS.md` entry — the source-order trap described the exact
  arrangement the commit deliberately replaced — which is now rewritten.

  *Worth knowing:* **what a green run does not say here.** There are no Supabase
  credentials on this machine or in CI, so the boundary tests assert what an
  *unauthenticated* visitor gets (nothing, which is the property that matters
  most and holds regardless of configuration), and nothing has read a real
  enquiry. An authenticated non-admin being refused is still verified by reading
  rather than running. Queued above as a P0.

  verify 16/16, 150 unit, 199 e2e.

- **2026-08-11** — A weight scale for the type system, and JetBrains Mono for
  data. Spec:
  `docs/superpowers/specs/2026-08-11-typography-weight-and-mono-design.md`;
  the reasoning and every measurement are in `handoff.md` §12.

  Weights are tokens now and the scale runs weight down as size runs up: 450 /
  500 / 550 / 600 / 650 from the 404 numeral to the 11px labels. 78 rules
  converted by codemod. Seven were left alone because they already sat lighter
  than their band and the token would have made them **heavier** — the codemod
  only ever lowers, and the scale is a ceiling per band rather than a mandate.

  *Worth knowing:* the global `h1-h4 { font-weight: 700 }` was load-bearing for
  accessibility and nothing said so. WCAG counts >=18.66px **bold** as large
  text, so three red headings on white at 4.30:1 were clearing the 3:1 bar on a
  weight declared in a different file. Lowering it re-tested them against 4.5:1,
  which they fail. They now use `--color-red-deep`, and `.dv__name` is the one a
  diff review would have missed — it declares no weight at all, so nothing in
  its own rule changed. This shipped with `tests/e2e/contrast.spec.ts`, the
  **first gate for rule 4**; it is a named list, not a sweep, so add to it when
  you add red text on a light surface.

  *Worth knowing:* three assumptions died to measurement, in order. The home
  page would pay nothing for the mono — false, `Spotlight` renders a full spec
  table on `/`, and the full 39.5 KB file cost 4 points (95 → 91).
  `font-display: optional` would fix it — false, it changed nothing across three
  runs, because font-display governs painting and the cost is the fetch.
  Subsetting the characters was the lever — only partly: clipping the weight
  axis to 400-600 saved more than the 83-character subset did, 31.4 KB → 23.1 KB.

  Shipped at 23.1 KB and **home is 94, not 95** — one point, and one on the
  product page too. That misses the spec's own acceptance criterion, so it is
  recorded and raised as a P0 decision above rather than rounded away.

  *Worth knowing:* a subset font renders tofu rather than erroring, so
  `tools/subset-mono.test.ts` asserts the catalogue never uses a character
  outside `COVERAGE` and fails naming it — proved by removing one:
  `"Ω" (U+03A9) from premium-network-cable → "Impedance"`. And the `@font-face`
  range has to describe the *file*, not the family: the committed file is
  clipped to `400 600`, and advertising the native `100 800` would make a later
  `font-weight: 700` clamp to 600 and read as a specificity bug.

  verify 15/15, 144 unit, 167 e2e.

- **2026-08-11** — Pointed the doc-paths gate at `README.md`. It had never
  covered it: `INSTRUCTIONAL` listed `CLAUDE.md`, `AGENTS.md`, `docs/TRAPS.md`
  and `.claude/commands/improve.md`, while `README.md` — the file `CLAUDE.md`
  sends you to for "how do I run it?" — named more repo paths than the rest of
  that list combined and had none of them checked. The cost was the item
  immediately below this one: its hero section described
  `hero-range-desktop.png` as the live hero across two rewrites while the
  component pointed somewhere else, and the gate built to catch precisely that
  was not aimed at it. Coverage went from 58 references to 96.

  Proved against a planted violation before and after: a bad path in
  `README.md` is caught, and the file is clean once restored.

  *Worth knowing:* it surfaced one real reference, and it is the interesting
  case rather than a nuisance. The launch checklist explains that
  `public/robots.txt` used to hard-code the domain and **is now gone** — a true
  sentence about a path that must not resolve, which is exactly what
  `handoff.md` is exempted for. It was reworded to name the dead file by role
  (a static `robots.txt` under `public/`) rather than as a code path. That is
  not the record bending to stay green: an *instructional* document formatting
  a deleted file as a live repo path is telling a reader to go open it. Where a
  sentence genuinely must point at something that no longer exists, it belongs
  in `handoff.md` — which is why the exemption is a file and not a syntax. The
  reasoning is on `INSTRUCTIONAL` itself.

  *Worth knowing:* the list is now pinned by a test. `extractPaths` and
  `resolves` were both correct and well covered the whole time — the defect was
  never in the logic, it was in what the logic was pointed at, and nothing
  asserted that. `tools/doc-paths.test.ts` now pins the membership both ways:
  `README.md` in, `handoff.md` out. 2 unit tests added; verify 15/15, 141 unit,
  157 e2e.

- **2026-08-11** — Finished the landing redesign's documentation. The
  implementation had been green since the merge; the guidance had not caught up
  with it.

  The four traps found during the redesign are now entries in `docs/TRAPS.md`
  rather than living only in `handoff.md` §11: that an Astro `<script>` costs a
  CSP hash based on how many pages render the component and not on how the tag
  is written; that `global.css`'s blanket reduced-motion rule means no component
  here can offer a motion *opt-in*, only cancel its own animations; that
  `test.use({ reducedMotion: 'reduce' })` typechecks and is silently discarded
  on Playwright 1.62.1; and that the two empty categories must never render a
  product image.

  A fifth was found while doing it. `docs/TRAPS.md` still carried a "hero copy's
  top anchoring" entry describing the bright mass of a static still — a hero two
  rewrites dead — in the section headed "looks like a defect, is not". Guidance
  that is confidently wrong about a deleted file is worse than no guidance, so
  it was replaced with the two things that *are* load-bearing about the current
  hero: the 1080px breakpoint, and the 136px of top padding that clears the
  absolutely positioned header.

  `README.md`'s hero section described `Hero.astro` rendering the client artwork
  under an `sr-only` h1 and a `PORTRAIT` media constant, none of which survives.
  It is now two sections — the helmet hero as built, carrying the AI-generation
  flag and the sign-off it still needs, and the two client artworks as
  retained-but-unused.

  *Worth knowing:* **the Lighthouse re-run corrected the item that asked for
  it.** Both this backlog and `handoff.md` said the home row was stale and the
  two catalogue rows were unaffected. That was true of a *hero* change and wrong
  about this one — the redesign restyled `Header` and `Footer`, which render on
  every page. Measured on the current build, Lighthouse 12.8.2, five mobile runs
  on `/` and three on each other page: home 95–97 → **95**, catalogue 99 →
  **96**, product 98 → **97**. Desktop 100 across all three; CLS 0.000 and TBT
  0 ms everywhere. Every run of a given page scored identically, so the table is
  now flat numbers rather than ranges. **If you change site chrome, re-run all
  three pages, not the one you touched.**

  *Worth knowing:* the home page's LCP is the helmet, and the helmet is not what
  costs it. Of a 2.79 s mobile LCP, **0.12 s is spent loading the image** — an
  18 KB AVIF — against 1.89 s of render delay behind two render-blocking
  stylesheets (29.5 KB + 21.9 KB, 450 ms). Shrinking the hero art would buy
  almost nothing. `build.inlineStylesheets: 'always'` is still the lever and is
  still not taken.

  *Worth knowing:* `image-delivery-insight` reports the 560px helmet variant as
  oversized for a "266×266 displayed" box. It compares CSS pixels and ignores
  the mobile preset's 1.75 DPR — 266 × 1.75 = 466, and the next variant down is
  420. 560 is the correct pick, the insight is unscored, and narrowing `sizes`
  to satisfy it would ship a soft hero on every phone.

  *Worth knowing:* the first attempt wrote `path:line` references into
  `docs/TRAPS.md` and the doc-paths gate failed all four. That is the gate
  working: `tools/doc-paths.mjs` resolves a whole token as a path, and the file's
  existing convention is bare paths. A line number in a document gated only on
  path *existence* would rot with nothing noticing — which is the exact failure
  that gate was built for. The references name the describe block or the
  assertion instead. verify 15/15, 139 unit, 157 e2e.

- **2026-08-09** — Replaced the scroll-scrubbed hero film with a static still,
  at the client's request. The 240svh scroll track, the sticky stage, the
  `<video>`, the scrubbing script and 2.9 MB of MP4 are gone. The composition is
  unchanged — the still is the same product-cluster shot the film played
  through, and it is the right hero for a catalogue: it shows Spartan's actual
  products, where the pre-film photograph (`safety.jpg`) was generic stock
  safety imagery.

  Contrast was **re-measured against the rendered still** rather than inherited
  from the film, and every number improved — a single frame is never as bright
  as the worst frame across six seconds. Desktop white 19.00, accent red 3.77,
  eyebrow 5.05; mobile 18.43 / 3.91 / 5.05. All pass; the accent line carries
  the thinnest margin by design against a 3:1 bar.

  Also fixed the `Home and IndustrialSolutions.` extraction bug in passing, and
  gave each composition a real JPEG fallback — the film-era markup put AVIF in
  the `<img>` itself, so a browser without AVIF support got no image rather than
  a worse one.

  *Worth knowing:* removing the scrubber's `<script is:inline>` took the CSP
  from 7 inline-script hashes to 6. `npm run csp` had to be re-run and
  `vercel.json` committed — a stale hash does not fail the build, it ships a
  site that renders and never hydrates.

  *Worth knowing:* the first contrast measurement reported 1.00:1 for every
  element. Sampling the brightest pixel inside a text element's box finds the
  text — white headline against white. The copy has to be hidden with
  `visibility: hidden`, which keeps every box exactly where it was, so the
  measurement addresses the same pixels but sees the image and scrim behind.

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

  *Correction, 2026-08-10:* the `/video/` cache rule described above no longer
  exists. `d6808db` replaced the hero film with a static still later the same
  day and took `public/video/`, the rule and the scrubber's inline script with
  it — which is also what dropped the CSP from 7 hashes to 6. `/fonts/` still
  has its rule. Left as written rather than rewritten, because this section is
  the record of what was done on the day; a later commit undoing part of it is
  a second fact, not a reason to make the first one disappear.

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
