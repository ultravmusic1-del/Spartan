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

- [x] **Confirm the AI-generated hero helmet with the client.** **Moot as of
      2026-08-17 — the helmet is no longer on the landing page.** It was
      replaced by the campaign banner carousel (`handoff.md` §18), so the
      sign-off this item was waiting for is no longer needed for anything that
      ships. It was open for six days and never signed off, which is its own
      small argument for having flagged it rather than quietly shipping it.

      `src/assets/hero/helmet-hero.png` is **retained but unused**, on the same
      reasoning that keeps the two client hero artworks: deleting supplied or
      generated material to tidy up is the wrong trade while anyone might still
      want it back. Nothing imports it. If the client confirms they never want
      it, that is the moment to delete the file.

- [x] **Two campaign banners are excluded from the hero until reissued.**
      **Moot 2026-08-27 (`handoff.md` §30) — the whole nineteen-poster family
      has been replaced.** The hero now shows three landscape banners uploaded
      through `/admin/banners`, and the bucket holds those three and nothing
      else: neither excluded poster is in the bucket, the table or the
      repository. This item described an exclusion from a `BANNERS` array in
      `Hero.astro` that no longer exists.

      **The two artwork faults themselves are NOT withdrawn.** They are still
      open above as the GP1 EN 388 item and the `FW-40W` model-code item,
      because both are wrong on artwork the client may still hold and reissue.
      Closing this entry closes the hero exclusion, not the facts.

- [ ] **Re-measure the home page's Lighthouse score.** The hero went from one
      18 KB AVIF to 121-200 KB of banner imagery (`handoff.md` §18 has the
      table). §12 records a 23 KB font costing this page a whole point, so the
      current figure is very unlikely to still be 94 — and 94 is what
      `README.md` claims. Nobody should quote that number until it is re-run.

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

      **Re-raised by the client 2026-08-17**, who asked for real phone numbers,
      WhatsApp links and email addresses before launch and suggested using the
      Kavalani details in the meantime. Those details are not in this repository
      either, so this is still blocked on values — but `npm run verify` now names
      every outstanding one on every run rather than leaving it to this file.
      Four were outstanding. **`whatsapp` landed on 2026-08-27 and three
      remain: phone, email and address.**

      The client supplied **`+973 3800 0458`**, and it is live — the floating
      button and the product pages' "Enquire on WhatsApp" control both render
      from it (`handoff.md` §33). `npm run verify` now names three unset
      details rather than four.

      **The country code is +973, Bahrain**, which agrees with the campaign
      artwork and with Kavalani. The placeholder phone number in the header is
      `+971`, a UAE code. **Do not reconcile the two by editing one to match
      the other** — one is a real number the client gave and the other has never
      been anything but a placeholder. The phone number is still blocked on the
      client.

      **Do not put a plausible-looking value into the three that remain to make
      the site feel finished** — that is the specific thing the gate exists to
      catch.

      Page for page these are worse than the temporary domain: a buyer who taps
      the header phone number or the footer email gets nothing at all, on a site
      whose only purpose is getting them to make contact. The domain costs
      ranking; this costs the lead.
- [x] **Put `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.** Done
      2026-08-13. Enquiries are being written to Postgres in production.

- [x] **Resend credentials in Vercel.** Done 2026-08-13 — see Done below for the
      two false starts, both worth knowing.

- [x] **Create the first admin account.** Done 2026-08-13.

- [x] **Confirm admin Phase 1 against a configured deployment.** Done
      2026-08-13, in production, by hand: sign-in, the populated inbox, the
      detail view, a status change that persisted, the demand report and the CSV
      export. The subsystem is no longer verified only by reading. See Done.

- [x] **Switch production to the Postgres catalogue.** **DONE 2026-08-19.**
      `CATALOGUE_SOURCE=postgres` set on Production and Preview — the variable
      had never existed in Vercel before, so every deploy until now read the
      committed JSON. Build succeeded, and was fast. `handoff.md` §22 and §23. Everything is proved and
      staged; this is one setting in Vercel and nothing in the repository.
      Add **`CATALOGUE_SOURCE=postgres`** to the Vercel project's environment
      variables (Production, and Preview if preview builds should match), then
      redeploy. Leave CI and the local default alone — see
      `src/content.config.ts` for why the code default stays `json`.

      **UNBLOCKED 2026-08-19. The database is current and parity is proven.**
      It held 85 products against the repository's 94, still carried the removed
      shrinkage rows, and was missing the `datasheet_url` and `kavalani_url`
      columns entirely. All three are fixed: the columns were added by migration,
      the catalogue was applied, and `npm run catalogue:parity` reports **642
      files byte-identical from both sources**. Verified beyond the counts —
      0 shrinkage rows, 7 spill control products, AF-40W reads "Orbit Fan",
      10 Kavalani links, 0 orphans, 0 broken hero references, and the non-ASCII
      round trip is clean.

      **What remains is this one Vercel setting.** Nothing else blocks it.

      Verified 2026-08-13 before staging: `npm run catalogue:parity` reports 522
      files byte-identical from both sources; the database holds 85 products, 15
      categories and 2 divisions with no orphans, no broken `heroProductSlug`, 6
      EN 388 ratings, every product sourced and zero mangled characters; and
      `npm run verify -- --full` passes 16/16 with the credentials withdrawn.

      **Failure mode if Supabase is unreachable during a deploy:** the build
      fails and the previous deployment stays live. Nothing half-publishes.

- [x] **BEFORE any catalogue editing lands, point the catalogue-shape gate at
      the database.** **Done 2026-08-19.** `tools/catalogue-snapshot.mjs` now
      holds the invariants — every `categoryId` and `divisionId` resolves, every
      `heroProductSlug` is null or real, no duplicate slugs, and every product
      either cites a source or has a `catalogue_audit` entry naming who entered
      it — and the totals live in a committed snapshot regenerated deliberately
      with `node tools/catalogue-snapshot.mjs --write`. It follows
      `CATALOGUE_SOURCE`, so it checks the database once the deployment renders
      from Postgres, and it was verified against both sources: identical totals,
      zero violations. Proved it still bites — a stale snapshot and a broken
      `heroProductSlug` were each planted and each failed by name.

- [ ] **Cover the one auth case production has not exercised.** An
      **authenticated non-admin must be refused** — a valid Supabase account
      that is not in `public.admins`. It is the last Phase 1 acceptance
      condition still verified by reading rather than running
      (`currentAdmin`'s `if (!row) return null`), and it is the check that makes
      the allow-list worth having. Needs a second Supabase user deliberately
      left off the list; a few minutes by hand, and worth doing before anyone
      else is given an account.

- [x] **There is no password reset.** Built 2026-08-13 — see Done.

- [!] **Point Supabase at the deployment so reset links work.** Blocked: needs
      the Supabase dashboard. Authentication → URL Configuration: **Site URL**
      is still the default `http://localhost:3000`, and **Redirect URLs** must
      include `https://spartan-ebon.vercel.app/admin/reset`. Until both are set
      the reset email either points at a machine that is not running or is
      refused by Supabase as an unlisted redirect. Both need revisiting when the
      real domain lands.

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

- [ ] **The Grip Guard GP1 banner misstates an EN 388 rating.** Live marketing
      artwork (`banner images/23052026-001 - Spartan Safety Gloves - Grip Guard
      GP 1-Bahrain-01.jpg`) prints an EN 388 icon reading `4X43D`. The glove's
      own label, photographed in that same banner, reads `4131X` — which is what
      the catalogue says. Against the real label the icon claims cut resistance
      **D** where the glove says **X, not tested**, and overstates tear and
      puncture too. It appears to be GP5's rating pasted onto GP1's artwork.

      **The site is correct and needs no change.** This is a request to the
      design team to reissue the asset, and it is the reason `handoff.md` §16
      treats banner artwork as a lead rather than a source of record. GP3, GP5
      and Flex-Fit were checked against the catalogue and agree exactly, so this
      reads as one artwork error rather than a systemic problem.

- [x] **Is the banner's `FW-40W` the same fan as `AF-40W`?** Yes. Confirmed by
      the client 2026-08-17 and the listing deleted; catalogue back to 94.
      `handoff.md` §17.

- [ ] **Three spec rows the widened ranges left incomplete.** The client gave
      new options on 2026-08-17 and the supporting figures did not come with
      them. Each row is qualified so no wrong pairing can be read off it, but
      the gaps are real:
      - **LED Floodlights** now list ten wattages (10W-1000W) against a
        datasheet that published five (50/150/300/400/1000W). `LED Quantity` is
        therefore printed against its own five wattages, and **six of the ten
        new wattages have no LED count, body size or lumen figure**. The
        datasheet also lists **150W, which is no longer in the range** — so that
        252pcs figure now describes a wattage the site does not offer. Ask
        whether the ten wattages replace the printed five or extend them.
      - **LED Backlit Panels** gained a 120W. **No luminous flux and no
        dimensions exist for it** — the other two wattages have both, and the
        panel sizes differ between them (595x595x30mm vs x20mm), so the 120W
        cannot be inferred from either.
      - This also bears on the unresolved flood-light conflict in `handoff.md`
        §6a: the sheet printed 1000W twice in six slots with six distinct body
        sizes. If the range has genuinely changed, that question may now be moot
        — worth asking in the same breath.

- [ ] **Does the AF-40W orbit fan carry a 2-year warranty?** The campaign banner
      says so; `Spartan Fans Product Catalog.pdf` p3 does not mention warranty at
      all. It was the one fact unique to the deleted `FW-40W` record and was
      **not** carried across, because that banner had just been shown to have the
      model code wrong and `AF-40W` is otherwise fully datasheet-sourced. If the
      client confirms it, it is a real addition to the record — and worth asking
      whether it covers the stand fan and wall fan too, since their banners claim
      it and their datasheet pages are equally silent.

- [ ] **`Spartan Fans Product Catalog.pdf` p3 contradicts itself and should be
      reissued.** The page is headed "Spartan Wall Fan (AF-40W)", says
      "wall-mounted airflow", prints `Mount Type: Wall Mounted` and describes
      "secure wall mounting with a stable bracket system" — while its own
      photograph and assembly diagram show a **ceiling-mounted orbit fan**. Page
      4's genuine wall fan has the wall hardware (anchor bolts, installation
      plate, back hang trough) and page 3 has none of it, so the prose was most
      likely copied from page 4. The site now follows the photograph. Worth
      getting the source document corrected so the next person to read it does
      not undo this. `handoff.md` §17.

- [ ] **Three ratings conflict between the banners and the catalogue.** None was
      adjudicated on 2026-08-17; all three need the client, and every value is
      recorded as printed in the meantime. `handoff.md` §16.
      - Highbay IP rating — banner **IP66**, record **IP65**.
      - Solar flood light IP rating — the unit is labelled **IP67** in the
        banner, the record says **IP66**. Third IP conflict on this catalogue
        after the flood light's own photo/table disagreement in §6a.
      - Orbit fan model code — **`FW-40W`** against the catalogue's `FW-40H`
        (wall) and `AF-40W` (wall). The wall fan banner independently confirms
        `FW-40H`, so the catalogue is right about that one; whether `FW-40W` is
        a real third SKU or a blend is open.

- [ ] **Get real source documents for the ten banner-sourced products.** All ten
      added on 2026-08-17 trace to marketing artwork rather than a brochure page
      or datasheet, which is recorded per-row in `specs[].source` and per-record
      in `source.doc`. The spill control range is the one that most needs it: the
      banner gives codes, sizes and pack quantities and nothing else — no
      absorbency capacity, no material, no chemical compatibility, which are the
      figures a buyer actually selects a spill kit on. The FR certification
      block deserves the same treatment: ISO 11612 and NFPA 2112 on a website
      are regulatory claims, and right now the evidence for them is a JPEG.

- [ ] **Rename or alias the highbay.** `Industrial Canopy Pendant Lamps` is the
      highbay — same source PDF, same 100/150/200/300W, same 6500K and 120° —
      and the word "highbay" appears nowhere a buyer can search. Either rename,
      add a `variantLabel`, or fold the term into the searchable string.
      `src/lib/search.ts` already joins name, variant and spec values.

- [!] **Datasheet PDFs, for the "Download datasheet" control.** Blocked: client.
      Requested by them on 2026-08-17 and the field is built and validated —
      `datasheetUrl` on the product schema, rendering a control only when set —
      but **no PDF exists in this repository or on this machine**, so it renders
      for nothing on all 94 products. Not a bug and not a gap to fill: a datasheet
      link is a specification claim.

      Two things to know when they arrive. The schema requires the value to end
      in `.pdf`, because the control says "Download datasheet" and pointing it at
      a web page makes the button lie. And `download` is applied only to
      same-origin paths — browsers ignore it cross-origin — so a PDF committed
      under `public/` is offered as a save and an off-site one opens in a tab.
      The existing P2 item about compressing the 163 MB brochure is the same
      blocker wearing a different hat.

- [ ] **Kavalani links: 10 of 94 done, 10 more recoverable.** The client had all
      94 checked against kavalani.com on 2026-08-17 and supplied the results.
      **Most of the Spartan range is simply not carried there**, which is the
      headline finding and not a gap in the work — 72 products have a clear
      "nothing comparable listed" answer and need nothing further.

      The host is now pinned to `kavalani.com` in `src/content.config.ts`, so a
      link to anywhere else fails the build. That was the open half of this item
      and it is closed.

      **Two are held pending a one-line confirmation** — both are plausible
      matches on a Kavalani page that prints no brand, which is the one thing
      that would settle them. They are deliberately not published; a wrong link
      is worse than no button.
      - **Nonwoven Disposable Coverall** → `f_slv%20dispo_coverall%20white.html`
        (white, hooded, full sleeve, the only disposable coverall listed — but no
        brand and no GSM on the page).
      - **Winter Jacket** → `winter-jacket-with-lining-hood.html` (navy, lining,
        hood, reflective tape, no FR claim — but no brand printed).

      **Eight more are resolvable by someone who knows the range**, and this is
      the one worth chasing: in each case Kavalani carries the Spartan product,
      but neither side publishes the attribute that tells the variants apart.
      - **Three ventilation fans** — Kavalani has three Spartan exhaust fans
        (window / wall / ceiling, `BH-ELEEXHSPBF-WM`, `BH-ELEEXH-SPC`,
        `BH-ELEEXH-SPCM`). Neither side states size or mounting type.
      - **Two safety glasses** — three Spartan spectacles are listed (`90960`,
        `#91948`, `#9844A`) and our pages carry no model number, so "lightweight"
        and "adjustable temple" cannot be told apart.
      - **Three safety shoes** — one Spartan SKU is listed (`JP1 1023/8055`) and
        neither side states cut or upper material, so it cannot be assigned to
        KPU vs suede vs high-cut. One of the three is very likely this product.

      **Six Spartan records map to a Kavalani family split by wattage or size**,
      and each currently links one member of its own family: the solar flood
      light (300W linked; 100W and 200W also exist, 50W and 150W do not), pumps
      (1.5HP of four), the insect killer (2x15W of three), the welding jacket
      (Large of four sizes), the backlit panel (Kavalani carries only the 80W of
      our 48/80/120W family) and the floodlights (one listing covers 10W-1000W).
      That is a deliberate call and a defensible one — the control says "view on
      Kavalani", not "buy this exact variant" — but it is worth knowing before
      someone reports it as a mismatch.

      The label is **"View on Kavalani", not "Buy on Kavalani"** — a control
      promising a purchase on a site with no prices, no cart and no checkout is
      the same class of claim as a price in structured data. Changing it is the
      client's call, not a wording preference.

- [ ] **A flaky e2e test, left in place and named rather than re-rolled.**
      `[mobile] /enquiry › lists the basket and persists quantity edits to the
      store` timed out clicking a quantity stepper — "element is not visible" —
      **twice in six full-suite runs on 2026-08-17**, and passes 4/4 when run in
      isolation. Nothing in that batch touched the enquiry basket.

      The shape points at hydration timing under contention: local runs use 8
      workers, CI uses 2 with one retry, which is why CI has never shown it. That
      also means CI is not proof it is gone. Worth reproducing with
      `--repeat-each` under `--workers=8` before changing anything, because a
      timing fix aimed at the wrong frame is how a flake becomes permanent.

- [ ] **The mobile nav island is handed the whole category tree on every page.**
      `MobileNav`'s serialised island props went from a few hundred bytes to
      **2,689 (about 330 gzipped)** when the Categories dropdown landed, and the
      same data is *also* rendered into the desktop panel markup — so every page
      carries it twice, and on desktop the props are never read at all because the
      island hydrates at `client:media="(max-width: 1080px)"`.

      Accepted deliberately at the time; recorded because it is the kind of number
      that only ever grows. The two honest fixes are reading the groups back out
      of the server-rendered DOM, or server-rendering the mobile list and reducing
      the island to a toggle. Both are a refactor of a working, well-tested island
      for about 330 bytes, which is why neither was done.

- [ ] **Photography for 5 products.** Down from 16, then 12: the client supplied
      masked cut-outs of the three fans on 2026-08-17 (`handoff.md` §17) and the
      whole seven-SKU spill control range later the same day (§20).

      What remains is **the three portable air coolers, PVC gloves and solar
      street lights** — and they are two different asks. The air coolers need a
      separable image from a flattened datasheet page raster; the other two need
      the same treatment the spill range just got, because their banner
      composites the product into a styled scene with no clean cut-out in it.
      Same ask as the existing P2 item — plain background, no composited scene.

      **Worth raising while asking:** the three supplied fans are 640–950px wide
      against a catalogue where every other product photo is natively 100–440px.
      That ceiling is what causes the Lighthouse Best Practices 96 on product
      pages, and `srcset` has been in place since Task 8 — so re-shooting the
      *existing* range at that quality would resolve it with no code change.

      **The spill control cut-outs do not help that ceiling** — they are 148–177px
      natively, at the low end of the existing range. They fix an empty
      placeholder, not the resolution problem, and nobody should read the
      photography count dropping as progress on the Lighthouse number.

## P1 — discoverability and hardening

### Speed — scanned and measured 2026-08-23

What is already healthy, so nobody "fixes" it: gzipped HTML is 15/30/11 KB
for home/catalogue/product, the largest JS bundle is 52 KB, hydration is
visible/idle/media-gated, CLS measured 0.000 on all three page types, images
ship as avif/webp with lazy loading.

**One line of that paragraph was wrong when first written and is corrected
here:** it claimed `/_astro` was cached immutable. It was not — only
`/fonts/` had that rule, and `/_astro` inherited Vercel's default of
`public, max-age=0, must-revalidate`, confirmed against the live response.
The header was added on 2026-08-23.

- [x] **75% of the serverless function is an image library nothing uses at
      runtime.** **Done 2026-08-23** (`02c1cc3`, `handoff.md` §29.1) — the
      adapter route to `/_image` now points at an inert 404, sharp leaves the
      server graph, and gate 18 refuses `astro:assets` in any file that opts
      out of prerendering. Original note follows. Measured 2026-08-23: `_render.func` is 25.6 MB, of which
      19.1 MB is sharp — bundled because Astro routes a `/_image` endpoint into
      the function. Nothing legitimate hits it: every public image is optimised
      at BUILD time into `/_astro/*`, no server-rendered page imports
      `astro:assets` (verified by grep), and the admin thumbnail route streams
      raw bytes. The cost is cold-start weight on every route the function
      serves — including `/api/enquiry`, the most latency-sensitive thing a
      buyer touches. Two candidate fixes, neither to be done casually:
      the Vercel adapter's `imageService: true` (moves the endpoint to Vercel's
      optimizer; verify build-time behaviour is untouched first), or the
      adapter's `excludeFiles` (leaves `/_image` a landmine — MUST ship with a
      verify gate banning `astro:assets` from server-rendered pages).

- [x] **Every Publish invalidates every visitor's cached banners and re-encodes
      all 48 variants.** Verified 2026-08-23 by diffing two consecutive builds:
      the banner asset filenames are disjoint across builds, because the signed
      storage URL's token changes per build and Astro keys both its image cache
      and the emitted hash on the full URL. Cost: ~10s of re-encoding per
      Publish that the Vercel build cache cannot absorb, plus each returning
      visitor re-downloads ~60 KB of banners that did not change, despite the
      `immutable` cache header. The fix is a DESIGN DECISION, not a patch: sign
      once at upload with a long expiry and store the URL on the row (stable
      cache key, but weakens "short-lived" from the spec §26), or accept the
      churn. Client should choose.

      **Done 2026-08-23** (`cddbfec`, `handoff.md` §29.2) — and neither of the
      two options above is what shipped. `tools/fetch-banners.mjs` downloads
      the enabled banners into `src/assets/banners/` before `astro build`, so
      Astro hashes them from CONTENT rather than from a URL carrying a fresh
      token. Two consecutive builds now emit identical filenames for all 48,
      and the short-lived-credential half of §26 is intact.

- [x] **The Resend SDK drags ~3 MB into the enquiry function for one HTTPS
      POST.** **Done 2026-08-23** (`34fd8d0`, `handoff.md` §29.3) — replaced
      with one `fetch`, and the `unconfigured`/`failed` mapping gained eleven
      tests it never had, including the `replyTo` → `reply_to` wire detail that
      would have sent every reply to the wrong address in silence. Original
      note follows. `resend`'s dependency tree (@react-email/render → react-dom +
      prettier) is bundled into `_render.func` while `src/pages/api/enquiry.ts`
      uses none of it — the send is one JSON POST to `api.resend.com`. A raw
      `fetch` removes it. **Rule-2 territory**: the enquiry email is a delivery
      channel, so this change needs its error-mapping preserved exactly
      (`unconfigured` vs `failed`) and the outcome tests run before and after.

- [x] **The product page's LCP image is `loading="eager"` but not
      `fetchpriority="high"`.** One attribute in `ProductImage`/the product
      page template, across all 94 pages. The hero banner already has it; this
      is the same reasoning applied to the second page type. While there: the
      catalogue grid lazy-loads all 110 images including row one, so the grid
      pops in late — LCP is unaffected (the H1 is the LCP element, measured),
      so eager-loading the first ~6 cards is cosmetic polish, not a metric fix.

      **Done 2026-08-23** (`1552268`, `handoff.md` §29.4).


- [ ] **Restore the hero carousel's test coverage — NOW OVERDUE, and the tests
      that remain assert a state the site is no longer in.** The client uploaded
      three real banners on 2026-08-23, so the live hero shows a carousel while
      `home.spec.ts` and `hero-mobile.spec.ts` still assert an *empty* slot.

      **They pass only because `npm run verify -- --full` builds against the
      throwaway stack, whose `hero_banners` table is empty.** Verified
      2026-08-23: against a build made from the live database those six tests
      fail, and against a build with no Supabase credentials all 34 pass.

      **Re-measured 2026-08-27 and it is EIGHT, not six** (`handoff.md` §33):
      the six above plus `motion.spec.ts`'s reduced-motion hero test on both
      projects. Measured both ways round on the same day — 294 pass with an
      empty band, 8 fail with the client's three banners. So the
      gate is green on a state production is not in, which is the shape of
      coverage this repo treats as worse than none.

      Fixing it means deciding what the fixture is. Seeding a banner into the
      test stack makes the carousel testable and turns the *empty-slot* tests
      into the ones that cannot run; both states are real and both deserve
      cover, so this probably wants a seeded banner plus a way to build the
      empty case deliberately.

      The original note follows. The carousel path itself is still exercised by
      nothing.

      What was removed, and must come back with the artwork:

      - `tests/e2e/home.spec.ts` — seven slides against six banners, six pips,
        one eager image and five lazy, and the pause control stopping the track
        and the pips *together*. That last one is **WCAG 2.2.2** and axe does
        not test for it, so it has no other guard.
      - `src/lib/site-content.test.ts` — "at least two banners, or the carousel
        is not one". Deleted rather than relaxed to `>= 0`: a floor of zero is
        not a weaker version of that rule, it is the absence of it dressed as a
        passing test.

      All of it is in the parent of the commit that emptied the band, so this is
      a restore rather than a rewrite.

      **Do not restore the Grip Guard GP1 or Orbit Fan artwork** — see the two
      wrong-product-fact items below. `site-content.test.ts` still names both
      filenames.

- [ ] **Decide what a phone does with a 4:1 banner.** The slot holds 4:1 above
      720px and opens out to 3:2 below it, because at 375px a 4:1 band is 84px
      tall — too short to read as a banner or hold its own label. One 2800 × 700
      artwork cannot fill both, so the first real banner forces a choice:
      letterbox it on the phone, or supply a second crop. Nothing is cropped
      today because the band is empty. Pinned by
      `tests/e2e/hero-mobile.spec.ts` so the tension is visible rather than
      discovered.

- [ ] **Re-run Lighthouse on all three page types.** The table in `README.md`
      was measured on 2026-08-11 and the footer has changed since — the social
      icons came out, which is site chrome and therefore moves every page.
      §11's lesson was exactly this: the landing redesign restyled `Header` and
      `Footer` and all three mobile rows moved, not only the page that was
      touched. Home 94 and product 96 are **chosen numbers** (the mono
      decision, `handoff.md` §12) — do not "fix" them.

- [ ] **Phase 2 of the admin: the catalogue on Postgres.** This is what §5's
      seam exists for.

      **The client asked for the editing UI directly on 2026-08-17** — products,
      categories, images, content, PDFs, product links and homepage banners, with
      the stated objective of not needing development support for a content
      change. That is Phase 3b, and this item plus the two below it are the
      chain it is blocked behind, in order:

      1. production still renders the catalogue from committed JSON;
      2. the Postgres switch is staged but held on a stale seed (three
         `Shrinkage` rows the database still holds);
      3. the catalogue-shape gate still reads `src/data/products.json`, so the
         day anything can write to those tables the gate is checking a copy.

      Shipping write access before that is walked gives an editor whose changes
      do not appear on the site and a gate that cannot see the data it guards.
      Banner management (their point 5) is the same project: `BANNERS` is a
      hard-coded array in `src/components/sections/Hero.astro`, and moving it
      into the database is a small piece of the same phase, not a shortcut past
      it. **Worth telling them the order, since they asked for the end of it.** Replace `file()` in `src/content.config.ts` with a
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

- [ ] **Make `status: 'draft'` actually hide a product.** `productSchema`
      declares it and **nothing filters on it**: neither `src/lib/catalog.ts`
      nor `src/loaders/supabase-catalogue.ts` excludes drafts, so a product set
      to draft still renders publicly. The admin edit form deliberately does not
      offer the control, and shows Status as read-only instead, because a switch
      that does nothing is the defect this repo has already removed twice.

      It is not the three-line filter it looks like. Hiding a product changes
      the built page count that `tools/counts.test.ts` pins and the totals in
      `tools/catalogue-snapshot.json`, and both gates need reworking to express
      "94 products, 91 of them visible" rather than one number. The category
      form has the same shape of gap for `status: expanding`, which DOES change
      what the public page says and so is a smaller job.

- [ ] **Three identifier fields can still be empty as far as the schema is
      concerned.** `name`, `categoryId` and a category's `description` were
      tightened to `.min(1)` on 2026-08-23, when the admin form made a blank one
      reachable. `slug`, `id` and `divisionId` were left as bare `z.string()`
      because nothing can write them — they are carried over from the existing
      record on every save, so today the only way to get an empty one is to
      insert it into Postgres by hand.

      It becomes real the day admin-*created* records land, and it arrives
      alongside the other decision that stage forces: `productSchema` requires
      `source` while `products.source` is nullable, deliberately, because a
      record typed into the admin has no brochure page to cite. Both belong in
      that piece of work rather than being guessed at now.
- [x] **Apply the hero banner migration to the live project.** **Done
      2026-08-23** — the migration was applied through the Supabase connector
      and `npm run storage:setup` created the bucket; `handoff.md` §28 records
      both, and §30 confirms the bucket now holds the client's three banners.
      A fresh clone does not repeat either step. Original note follows.

      `hero_banners`
      exists only in the throwaway stack. Until
      `supabase/migrations/20260823120000_hero_banners.sql` is applied to
      production and `npm run storage:setup` has created the bucket, **the
      production build fails** — loudly and on purpose, rather than rendering a
      hero with no band. Nothing else in the deploy performs this step.

- [ ] **Nothing checks a banner's facts before it publishes.** Retitled and
      narrowed 2026-08-27 (`handoff.md` §30); **not closed.**

      `site-content.test.ts` used to assert that the Grip Guard GP1 and Orbit
      Fan artworks were not enabled, matching on filename. Uploaded banners have
      generated paths and admin-chosen names, so that test could not survive and
      was removed rather than weakened.

      **What changed:** both posters have since left the system entirely, so the
      specific risk is no longer live. **What did not:** any JPEG an admin
      uploads reaches the most prominent position on the site with nothing
      between it and a buyer. The three banners live today were audited against
      the catalogue after the fact and every model code and figure holds
      (§30) — after the fact is the problem.

      Still worth a per-banner "checked against source" flag the admin has to
      set before Show will work. And if a GP1 reissue is ever uploaded, the
      artwork must be corrected first: it prints an EN 388 icon reading 4X43D
      against the glove's own label of 4131X — cut resistance advertised where
      the glove says NOT TESTED.
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

- [ ] **CI is the only place the full suite runs, and that is the actual
      finding.** Three gates were green locally and red or silently skipped in
      CI on 2026-08-27 (`handoff.md` §32), and one of them had let a real
      6px regression sit on the primary CTA for four commits. All three are
      fixed. What is not fixed is the reason they went unnoticed: `--full`
      needs Docker, Docker is not always up, and the habit of pushing on a
      `verify` that skips Playwright is what makes CI the first place anything
      is learned. Worth deciding whether `verify` should say something louder
      than `skip` when the browser suite did not run.

- [ ] **Decide whether the floating WhatsApp button belongs on /contact and
      /enquiry.** It is sitewide as asked, which means it sits on the two pages
      whose entire job is the form the buyer is already looking at. Nothing is
      broken — it overlaps no field and no submit control, checked at 375px —
      but it is a second conversion path offered next to the first, and the
      basket is the mechanism the rest of the site is built around. A judgement
      call for the client rather than a defect. `handoff.md` §33.

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

- **2026-08-27** — **The product comes with you into the message box, and three
  gates that were green for the wrong reason.** `handoff.md` §31 and §32.

  "Ask about this product" and "Request a quote" now carry the product to the
  form they open. /contact arrives holding an information request naming the
  product and linking to it; /enquiry puts the product **on the basket list**
  and opens with a quotation request, so the buyer lands on a complete,
  sendable enquiry. The generic quote buttons elsewhere are untouched — they
  have no product to name.

  *Worth knowing:* **the links stay ordinary `<a>` elements.** Both
  destinations are prerendered, so the work happens in the browser after
  hydration and the controls still go where they always went with JavaScript
  off — which is why `products/[slug].astro` kept that link in the first place.

  *Worth knowing:* **the name travels in the URL and the link does not.** The
  product link is rebuilt from the slug against the page's own origin, and a
  slug outside `[a-z0-9-]` is refused rather than escaped. A URL parameter
  naming a destination is how an open redirect starts.

  *Worth knowing:* **the URL is cleaned the moment it is used, and at /enquiry
  that is not tidiness.** `addItem` increments an existing line, so parameters
  left in the address bar would mean a buyer who refreshed three times asking
  for four of something they wanted one of.

  *Worth knowing:* **the CI failures were all older than the commit that
  surfaced them.** A doc-paths gate that only passed for people who had built
  once; a counts gate that had been skipping silently on every CI run because
  `run()` dropped stderr on success; and six pixels of the primary CTA under
  the fold on a 360-wide screen, left by the hero restyle four commits earlier
  and unseen because the full suite could not run locally. All three fixed, and
  the counts gate now fails rather than skips when it cannot read its input.

- **2026-08-17** — **The client's launch-feedback batch: four of eight points.**
  Full reasoning in `handoff.md` §19. Sharing on every product page, one
  Categories dropdown replacing three flat nav items, optional datasheet and
  Kavalani link fields, and an SEO audit that found two real defects. Two points
  are blocked on values only the client holds (queued above), and two are Phase
  3b (queued above, with the chain they sit behind).

  *Worth knowing:* **the two inert features are the deliverable, not a
  shortfall.** `datasheetUrl` and `kavalaniUrl` render controls for zero of 94
  products, because no PDF and no Kavalani URL exists anywhere here and neither
  may be guessed. What shipped is the shape, which rule 1 explicitly allows, plus
  schemas that refuse a wrong value — the person filling these in will be using a
  CMS field, not reading the schema.

  *Worth knowing:* **the share encoding is the silent risk and it is now pinned.**
  Spec values carry `+`, `&` and `#`, and in a query string those mean space,
  next-parameter and fragment. A `+` in "White aluminium frame + iron back cover"
  reaches a mail client as a space; a `#` drops the product link off the end of
  the message. Nothing throws. Nine unit tests pin each against the real product
  it comes from, and e2e re-checks after the string has been through an HTML
  attribute.

  *Worth knowing:* **`docs/TRAPS.md` was wrong about CSP hashes and is corrected.**
  "Shared across pages" counts page *modules*, not built URLs — `ShareRow` renders
  on 94 product pages and is still inlined into every one, because all 94 come
  from one dynamic route. The hash count went 8 to 9. Following the old entry
  would have meant skipping `npm run csp`, and a stale hash ships a page that
  renders and never hydrates.

  *Worth knowing:* **the Categories menu opens with no JavaScript at all** —
  `:hover` and `:focus-within` on the `<li>` — and is `visibility: hidden` when
  closed so its eighteen links stay out of the tab order. The `<li>` is the full
  84px nav row on purpose: at the height of its 11px link the pointer leaves it
  on the way down to the panel and the menu shuts in the user's face.

  *Worth knowing:* the SEO audit's real find was that `productDescription` stopped
  at the first spec row too long to fit, so one oversized row hid every shorter
  row behind it. **20 of 94 descriptions improved**, average +32 characters, worst
  case 32 to 155. `Industrial Exhaust Fan Standard` had twelve spec rows and a
  meta description that was just its name.

  *Worth knowing:* two new gates, both proved against planted violations —
  `meta descriptions within 160 characters` (which **must** decode HTML entities
  first, or it reports three failures that are not real) and a launch-blocker note
  naming every unset contact detail.

  *Worth knowing:* it also repaired `tests/e2e/catalogue.spec.ts`, **failing since
  `d7a36a9`** and unrelated to any of this. Its "glove" query could never have
  tested what it claimed — all four matches sit inside the category being filtered
  — so it was rewritten around "leather", which spans categories, rather than
  renumbered.

  verify 17/17 --full, 240 unit, 252 e2e.

- **2026-08-13** — **Phase 2: the catalogue can now be read from Postgres.**
  `src/loaders/supabase-catalogue.ts` is the swap `handoff.md` §5 was built for
  — `catalog.ts` and all 110 pages are untouched and cannot tell which loader
  filled the store. Plan:
  `docs/superpowers/plans/2026-08-13-catalogue-editing.md`.

  *Worth knowing:* **it defaults to `json`, not `postgres`, and that is a
  departure from the design doc on purpose.** Until a Postgres build has been
  proved byte-identical, the safe direction to fail is towards the committed
  files. Flip the default after `npm run catalogue:parity` passes.

  *Worth knowing:* **the loader throws on an empty table.** A read that errors
  or returns nothing is a broken read, not an empty catalogue — a migration
  half-run, a wrong project, a key without access. Building from it would
  publish a site with no products and no error anywhere. A failed build is
  enormously cheaper than a silent one.

  *Worth knowing:* the two loaders give products **different entry ids** —
  `file()` keys on an `id` field products do not have, this one keys on `slug`.
  Safe because `catalog.ts` is the only module allowed to call `getCollection`
  (rule 3, gated) and it reads `entry.data`, never `entry.id`. The parity test
  proves that rather than assuming it.

  *Worth knowing:* `en388` and `source` are **omitted, not set to null**, when
  absent. 79 of 85 products have no EN 388 rating and an empty object would
  assert the glove had been tested.

  Divisions, categories and all 85 products are seeded and verified in the live
  project. verify 16/16, 205 unit, 216 e2e.

- **2026-08-13** — **Password reset, and the signed-out screens rebuilt.**
  `/admin/forgot` requests a link, `/admin/reset` completes it, and sign-in now
  offers a way through to them. `handoff.md` §14.

  *Worth knowing:* **it works without JavaScript only because of PKCE.**
  Supabase's default recovery flow returns the token in the URL **fragment**,
  which is never sent to the server — unreadable by a page that cannot run
  script, which admin pages cannot. `@supabase/ssr` uses PKCE, where the link
  comes back with `?code=` in the query string, and that reaches the server.
  The cost is real and is stated on the confirmation screen: PKCE pairs the code
  with a verifier cookie written when the reset was *requested*, so the link
  must be opened in the same browser that asked for it.

  *Worth knowing:* the code is exchanged when the page LOADS, not in the POST.
  It is single-use, so spending it on the submit would mean a rejected password
  burned the link and forced the whole request again.

  *Worth knowing:* the confirmation names a condition — "if that address has an
  admin account" — rather than asserting delivery. Saying "sent" of an address
  with no account would be a lie; saying "no such account" would turn the page
  into a way to ask who has one. An e2e test sweeps it for the phrases that
  would give it away.

  *Worth knowing:* six routes are now outside the guard rather than two, which
  is the widest the unauthenticated surface has been. Each is justified on
  `OPEN` itself, and the rule is unchanged: nothing that reads or writes enquiry
  data belongs in that set.

  *Worth knowing:* a new test caught a real dead end rather than a bad
  assertion. The reset page's "not configured" branch — the state of every local
  and CI run, so the first one a developer meets — showed bad news and linked
  nowhere.

  Passwords are checked by a pure module: 12 characters minimum, counted in code
  points so six emoji do not pass as twelve, and no composition rule, which
  pushes people to `Password1!` instead of a passphrase.

  verify 16/16, 183 unit, 216 e2e.

- **2026-08-13** — **A `test` enquiry status**, so the team's own submissions
  stop counting as demand. Migration `add_test_enquiry_status` widens the CHECK
  constraint only, so nothing existing could violate it. `handoff.md` §14.

  *Worth knowing:* `ENQUIRY_STATUSES` and `WORKFLOW_STATUSES` are now different
  things and the difference is load-bearing — the first is every value the
  column may hold, the second is the four stages a real enquiry moves through
  and is what anything reporting on the business sums. A unit test asserts
  `test` is in one and not the other, because a leak that way would put the
  team's clicks into the headline figures silently.

  *Worth knowing:* it is excluded from demand, the tiles and the line count, and
  deliberately **not** from the All chip (which lists everything, so it counts
  everything) or the CSV export (the raw record, with a status column anyone can
  filter). Dropping rows from an export would be the truncated-file defect again.

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
