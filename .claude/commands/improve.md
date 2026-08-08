---
description: Pick the highest-value open item from BACKLOG.md, implement it, verify it, commit it.
argument-hint: "[optional: a specific item, file, or area to work on]"
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, PowerShell, TodoWrite
---

# One improvement, done properly

You are doing **one** unit of work on the Spartan catalogue site, end to end,
and leaving the repository in a state a person would be happy to find.

`$ARGUMENTS` — if non-empty, work on that instead of choosing from the backlog.
If empty, choose.

Read `BACKLOG.md` first. Read `handoff.md` before touching anything you have not
touched before — it is long, but it is the record of what has already been tried
and what failed silently.

## The rules that are not negotiable

**1. Never invent product data.** No specification, certification, rating,
dimension, material or description may be written unless you can name its
source. Every catalogue value traces to the client's brochure PDF, and **that
PDF is not in this repository and not on this machine** — so in practice you
cannot source a new product fact at all. Where data is missing it stays missing
and gets an honest empty state.

This is safety equipment. A fabricated protection rating is a genuine hazard,
not a cosmetic defect. Two categories legitimately have zero products and say so.

You *may* change the **shape** of catalogue data — add an optional field, fix a
verified typo, reorder, restructure. You may not add or alter a product **fact**.
If a task seems to require one, it is blocked; mark it `[!]` and pick something
else.

**2. Never claim something was sent when it was not.** The enquiry path is the
only conversion mechanism on the site. A form that reports success on a dropped
submission loses the lead silently and is worse than a form that does nothing.

**3. The admin seam holds.** No page or component may import from `src/data/*`
(except `site.json`) or call `getCollection`. Everything goes through
`src/lib/catalog.ts`. `npm run verify` enforces this.

**4. Colour is measured, not chosen.** Small red text on a dark surface uses
`--color-red-light`; red *surfaces* carrying white text use `--color-red-fill`;
small red text on light uses `--color-red-deep`. "Large" means ≥24px, or
≥18.66px bold — **bold alone does not make text large**. `handoff.md` §3 has the
measured ratio for every pair. Do not reason about contrast from memory; look it
up or measure it.

## Do not "fix" these

Every one of these looks like a defect and is not. Several have already been
reported as regressions by someone who did not check. Changing one is a
regression *you* are introducing.

- **The black panel in `p19-safety-vests.png` and `p19-safety-vests-2.png`.**
  It is a deliberate DAY | NIGHT reflectivity comparison from brochure page 19,
  not a clip-forwarding failure. All 72 assets were scanned; only these two, both
  legitimate.
- **The hero video's 4-frame GOP.** Dense keyframes are the point — scrubbing
  seeks constantly. A normal long GOP halves the file and makes the scroll
  judder. No WebM either: VP9 at this GOP is *larger* than H.264.
- **The hero copy's top anchoring.** It is not centred because the bright mass of
  the film never rises above y=43%; centred, the accent line sat at 1.56:1.
- **`image-size-responsive` (Lighthouse Best Practices 96) on product pages.**
  The source photography is natively 100–440px and must never be upscaled beyond
  ~2×. It resolves when the client supplies real photography. Adding `widths`
  that upscale is not a fix.
- **The 3 `npm audit` high findings.** One chain, no upstream fix, build-time
  only, no attacker-controlled input reaches it. **Never run
  `npm audit fix --force`** — its only offered fix reintroduces 8 XSS advisories.
- **`build.inlineStylesheets: 'always'`.** Considered and rejected: it inlines
  ~41 KB into all 96 pages and loses cross-page CSS caching.
- **The two empty categories.** Spill Control and Electrical Accessories have no
  products because the brochure has none. They get honest pages, not invented
  products.

## Traps that fail silently

You will not get an error from any of these. `astro check` passes through all of
them.

- **Playwright attaches to a dev server on :4321 instead of building.** Stop the
  dev server before any e2e run, or you get confident failures unrelated to your
  change.
- **Astro's dev server serves stale scoped CSS** after a component is rewritten
  wholesale. If computed styles disagree with the file you just wrote, restart
  the dev server and clear `node_modules/.vite`.
- **Tailwind utilities lose to Astro scoped styles.** Utilities compile into
  `@layer utilities`; scoped component styles are unlayered, and unlayered CSS
  beats every layer regardless of specificity. Passing `max-sm:hidden` to a
  component that sets `display` itself does nothing.
- **The `hidden` attribute can never hold its space** — Tailwind 4's preflight
  makes it `!important`. Use a class for "not yet hydrated" placeholders. Using
  `hidden` cost 134px of layout shift once already.
- **Any island reading a persistent nanostore needs a `mounted`/`ready` gate.**
  `useStore` returns `store.get()` on first client render, which restores from
  `localStorage` — so hydration renders a basket the server could not have. See
  `EnquiryBadge.tsx` and `EnquiryForm.tsx` for the fix.
- **`client:visible` islands do not hydrate in a background browser tab.** The
  rendering pipeline is frozen and IntersectionObserver never fires. Not a bug.
- **`astro:assets` cannot take a runtime string path.** Use the
  `import.meta.glob` pattern in `handoff.md` §7.
- **A green axe run is not a claim that a page passes WCAG.** axe missed a
  serious WCAG A failure on 72 product cards; Lighthouse weights it 0, so the
  accessibility score read 100 with the defect present.

## The loop

Work through these in order. Use TodoWrite to track them.

1. **Orient.** Read `BACKLOG.md`. Run `git log --oneline -10` to see what recent
   iterations did — do not repeat or undo them.

2. **Choose one item.** Highest priority that is genuinely actionable. Skip
   anything marked `[!]`. Prefer finishing something started (`[~]`) over
   starting something new. **One item per iteration** — a small change that is
   verified and committed beats three that are half-done.

   If every unblocked item is done, do not invent filler work. Re-audit instead:
   look for a real defect, add it to the backlog with evidence, and stop.

3. **Mark it `[~]` in `BACKLOG.md`** before you start, so a crashed iteration is
   visible as unfinished rather than lost.

4. **Understand before changing.** Read the files involved and the surrounding
   code. Match the existing style: this repo comments *why*, not *what*, and the
   comments are load-bearing. A change that reads as though a different person
   wrote it is a defect even if it works.

5. **Implement.** Smallest change that genuinely completes the item. Do not
   bundle unrelated cleanups.

6. **Verify.** `npm run verify` must pass. If your change touches anything
   interactive, hydrated, or user-facing, run `npm run verify -- --full` for the
   e2e suite. **Add or extend a test for what you changed** — 146 tests exist
   because each one was worth writing.

   If verification fails, fix it. If you cannot fix it, revert your change,
   record what you learned in the backlog item, and stop. **Never commit a red
   gate, and never weaken a gate to make it pass.**

7. **Commit** to the `agent/improvements` branch, never to `main`:

   ```
   git rev-parse --verify agent/improvements >/dev/null 2>&1 \
     && git checkout agent/improvements \
     || git checkout -b agent/improvements
   ```

   One commit per item. Message says what changed and why, in the style of the
   existing log (`git log` to check). End with:

   ```
   Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
   ```

   Do **not** push. Do **not** merge to `main`. A human reviews the branch.

8. **Update `BACKLOG.md`.** Mark the item `[x]`, move it to the Done section with
   the date and short commit hash. If you discovered new work, add it to the
   right section **with evidence** — a file and line, or a measurement. A backlog
   item without evidence is a guess and wastes the next iteration.

9. **Report** in three or four sentences: what you changed, how you verified it,
   and anything the next iteration should know. If you found something you could
   not act on, say so plainly.

## When to stop and ask instead

Stop and report rather than proceeding if:

- the item needs a client-supplied fact (a domain, a phone number, a
  certification, a spec) — mark it `[!]` and move on;
- the change would alter the approved visual design in a way a person would
  notice, beyond the item's stated scope;
- verification fails in a way you do not understand;
- the right fix contradicts something in `handoff.md`. That document is the
  record of what was already tried. If you believe it is wrong, say why and let a
  human decide — one section of it was wrong once, and it was corrected by
  measurement, not by assertion.

Being honest that an iteration produced nothing is a good outcome. Producing
plausible-looking work that nobody asked for is not.
