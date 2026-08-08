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

- [ ] **Decide what the footer email field is for.** `Footer.astro:82`, on all 97
      pages, still `onsubmit="return false"`. It is labelled *Enter email
      address* with a Submit button — a newsletter subscribe, not an enquiry.
      Three reasons it was not wired alongside the other two:
      1. There is no newsletter infrastructure of any kind in the repo.
      2. `enquiryPayloadSchema` requires a name; an email-only submit cannot
         satisfy it without weakening a bound the /enquiry form depends on.
      3. Posting it to `/api/enquiry` would send sales an RFQ from someone who
         believed they were subscribing to a mailing list. That is the same
         class of error as claiming an enquiry was sent when it was not.
      **Needs a human decision**, and the honest default is removal — a control
      that cannot do what it says is worse than no control. Options: remove it;
      relabel it as "send me the catalogue" and wire it to `/api/enquiry` with a
      marker; or add a real mailing-list integration.

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

- [ ] **Replace `public/robots.txt` with `src/pages/robots.txt.ts`.**
      The domain has to match `site` in `astro.config.mjs` and today it is
      hard-coded in a file that interpolates nothing. A static endpoint emits the
      real value at build time and makes the divergence impossible. Do this now
      even though the domain is still a placeholder — it is the mechanism, not
      the value, that is wrong.

- [!] **Set the real domain.** Blocked: client has not confirmed one.
      `spartan.example` is RFC 2606 reserved and can never resolve, so all 96
      canonicals, every OG URL and the whole sitemap point at nothing.
- [!] **Real contact details.** Blocked: client. `+971 00 000 0000` renders as a
      live `tel:` link in the header of all 97 pages; `sales@spartan.example` is
      a dead mailbox. `src/data/site.json`.
- [!] **Resend credentials in Vercel.** Blocked: client. Without them
      `/api/enquiry` logs and returns `{ ok: true, delivered: false }` — correct
      locally, but in production every RFQ becomes a log line nobody reads.

## P1 — discoverability and hardening

- [x] **Add `/catalogue` to the primary navigation.** Done — see Done below.

- [ ] **Build the search UI.** `searchProducts()` is implemented and tested in
      `src/lib/catalog.ts:94` and called from **nowhere**. 72 products across 15
      categories with no search box. The function exists; this is a UI task.
      Follow `CatalogueFilters.tsx` for the island pattern and its pending-state
      class (never the `hidden` attribute — see `handoff.md` §7).

- [ ] **Add `vercel.json` with security headers and long-cache rules.**
      Nothing emits CSP, HSTS, X-Content-Type-Options, Referrer-Policy or
      Permissions-Policy today. A CSP is unusually cheap here because the site
      loads **no third-party scripts at all** — but it must allow the inline
      `is:inline` bootstrap in `BaseLayout.astro` and Astro's island scripts.
      Same file fixes caching: only `/_astro/` gets `immutable`, so 84 KB of
      preloaded fonts and **2.9 MB of hero video** in `public/` are revalidated
      on every visit. Verify the CSP against a real page load before committing —
      a CSP that breaks hydration is worse than none.

- [ ] **Add CI.** No `.github/` exists. 146 tests that only run when somebody
      remembers. A workflow running `npm run verify -- --full` on push is enough.

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
