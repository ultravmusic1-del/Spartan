# Homepage Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the home page's four competing heading idioms into one section system, commit the numbering fully or not at all, remove the decoration that no longer earns its place, and stop the hero being the only part of the page that looks designed.

**Architecture:** One primitive — `SectionHeading.astro` — becomes the head every section renders, gaining a section numeral and an optional trailing action. Eight sections are converted to it. Nothing new is invented: the numeral, the mono micro-label, the red rule and the outlined type already exist, and this pass makes them rules rather than instances.

**Tech Stack:** Astro 7 · TypeScript strict · scoped `<style>` · Vitest · Playwright · `npm run verify`

---

## The diagnosis, in code

The review said the page reads as "3–4 different design languages stitched
together". That is literally true, and it is visible in the imports:

| Section | How it builds its head |
|---|---|
| `ServiceCards`, `Faq` | `SectionHeading` primitive |
| `About`, `Spotlight`, `EnquiryCta` | `Eyebrow` + a bespoke `<h2>` |
| `CategoryGrid` | bespoke `.cg__eyebrow` + `.cg__title` |
| `FeaturedLines` | bespoke `.fl__title`, **no eyebrow at all** |
| `TrustBand` | bespoke `.band__lead` on a full-bleed red band |

Four idioms for eight sections. Every other symptom the review lists —
inconsistent spacing, sections that feel templated, decoration that reads as
arbitrary — follows from there being no shared head to hang a rhythm on.

## The system, stated once

These are the rules the rest of this plan implements. They are written here so
a later change can be checked against them rather than guessed at.

**1. Every section on the home page has the same head.** Micro-label, heading,
optional lede, optional trailing action, and a section numeral. One component.

**2. The numbering is complete or it does not exist.** Every headed section on
the home page is numbered, in DOM order, starting at the hero. A band with no
heading — the category ticker — is not a section and is not numbered. There is
no third case.

**3. The numeral is 3.5x its own section's heading ceiling.** Not a fixed size.
That is what lets the hero's numeral stay dramatic against a 72px headline and
a content section's stay proportionate against a 46px one, while remaining one
rule rather than two exceptions.

**4. The numeral is always top-right of the head block, outlined, at 11% of
`--text`, and always `aria-hidden`.** It is decoration. It never carries a fact:
it is drawn with `-webkit-text-stroke`, which renders as nothing where the
property is unsupported, and a fact whose only carrier can vanish has not been
stated.

**5. Red marks action and brand, not surfaces.** One red band remains on the
page — the category ticker, which is navigation.

## What this plan does NOT do, and why

The review's P2 and P3 lists ask for per-section art direction: the About
helmets composed rather than floating, Featured Lines given a less repetitive
rhythm, the enquiry form and FAQ refined, cards standardised.

**Those are deliberately not in this pass.** The review's own closing
instruction is "stop inventing new visual tricks and instead focus on
system-building", and every one of those improvements is easier and safer once
there is a shared head, a shared numeral and a shared rhythm to build against.
Doing both at once means changing the frame and the picture in the same edit,
with no way to tell which one caused a regression. They go to `BACKLOG.md` with
this reasoning attached.

---

## File Structure

| File | Responsibility after this plan |
|---|---|
| `src/components/primitives/SectionHeading.astro` | The one section head: label, heading, lede, numeral, trailing action. Used by every home section and by `/about`, `/contact`, `/industries`. |
| `src/components/primitives/SectionIndex.astro` | Unchanged. The numeral's type treatment; placement still comes from inherited custom properties. |
| `src/components/sections/CategoryGrid.astro` | Converted to the shared head; `All products` becomes its action rather than a detached link. |
| `src/components/sections/FeaturedLines.astro` | Converted; gains the micro-label it never had. |
| `src/components/sections/About.astro`, `Spotlight.astro`, `EnquiryCta.astro` | Converted from `Eyebrow` + bespoke `<h2>`. |
| `src/components/sections/ServiceCards.astro`, `Faq.astro` | Already use the primitive; gain a numeral. |
| `src/components/sections/TrustBand.astro` | Stops being a full-bleed red strip and joins the system. |
| `src/components/sections/Hero.astro` | Crop marks and edge ticks removed; numeral sized by the shared rule. |
| `src/styles/tokens.css` | `--wrap-max` widened. |
| `tests/e2e/hero-marks.spec.ts` | **Deleted** with the decoration it guarded. |
| `tests/e2e/home.spec.ts` | Gains the numbering invariant. |

---

### Task 1: Remove the crop marks and the edge ticks

**Why:** the review's verdict is "delete them" — they repeat nowhere else, help
no hierarchy, sit too far out to feel connected, and add a layer of visual
cleverness without payoff. The page already carries the dot grid, the numerals,
the micro-labels, the red accents and the thin rules.

**The spec that guards them has to go with them, and deliberately.**
`tests/e2e/hero-marks.spec.ts` exists because the **client** raised a real
defect against their own mockup: the bottom marks landed on the CTAs. Its
header says it asserts at least one mark is visible at every width precisely so
that "deleting all four would read as a passing fix". Deleting the file while
deleting the marks is not that — the collision cannot recur once the
decoration does not exist — but it must be recorded as a decision, not a
tidy-up.

**Files:**
- Modify: `src/components/sections/Hero.astro`
- Delete: `tests/e2e/hero-marks.spec.ts`

- [ ] **Step 1: Confirm nothing else references them**

```bash
grep -rn "hero__mark\|hero__tick" src/ tests/ docs/
```

Expected: `Hero.astro` and `tests/e2e/hero-marks.spec.ts` only.

- [ ] **Step 2: Remove the markup**

Delete the whole `<div class="hero__marks">` block from `Hero.astro` — six
spans and the wrapper.

- [ ] **Step 3: Remove the rules**

Delete `.hero__mark`, `.hero__mark--tl/tr/bl/br`, `.hero__tick`,
`.hero__tick--l/r` and the `@media (max-width: 640px)` block that drops the
bottom pair. Leave a note in their place recording why.

- [ ] **Step 4: Delete the spec**

```bash
git rm tests/e2e/hero-marks.spec.ts
```

- [ ] **Step 5: Verify**

```bash
npm run verify
```

---

### Task 2: Widen the system

**Why:** the review's second point — the content floats in a large empty field
and the outer canvas is underused. Its recommendation was to widen the hero
system rather than decorate the margins.

**It is widened SITE-WIDE, not just in the hero.** A hero on a wider measure
than the sections beneath it is a fifth design language, which is the problem
this plan exists to remove. `--wrap-max` is the one value.

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/components/sections/Hero.astro`

- [ ] **Step 1: Widen the wrap**

In `tokens.css`, `--wrap-max: 1240px` becomes `1360px`, with a note that it is
the page's single measure and that the hero must not have its own.

- [ ] **Step 2: Make the band a ratio, not a fixed width**

`.hero__stage`'s `max-width: 1160px` becomes `max-width: 93.5%`. 1160/1240 is
the proportion §39 measured and the review has since said to stop changing the
banner's dimensions — expressing it as the ratio keeps that relationship
through the widening instead of silently undoing it.

- [ ] **Step 3: Measure the result at 1440 and 1920**

Confirm in the browser that the wrap is 1360, the band is ~1272, and no section
has gained a horizontal scrollbar.

---

### Task 3: The section head becomes the system

**Files:**
- Modify: `src/components/primitives/SectionHeading.astro`

- [ ] **Step 1: Add the numeral and the action slot**

Two new optional props — `n?: string` and `numeralScale?: number` — plus a
named slot for a trailing action. `n` absent means no numeral, which is what
keeps `/about`, `/contact` and `/industries` unchanged.

- [ ] **Step 2: Lay the head out as a grid**

Title block left, action right, numeral absolutely positioned behind the
top-right of the block at `z-index: 0` with the content at `z-index: 1`.

- [ ] **Step 3: Size the numeral from the heading**

The head sets `--si-size: calc(<heading ceiling> * 3.5)` so rule 3 above is
expressed in one declaration rather than per caller.

- [ ] **Step 4: Do not clip**

The numeral is offset upward by a fraction of its own size that stays inside
the section's existing top padding, so no section needs `overflow: hidden` —
which would clip legitimate content in `Spotlight` and `ServiceCards`.

---

### Task 4: Convert every home section to it

**Files:** `CategoryGrid`, `FeaturedLines`, `About`, `Spotlight`, `EnquiryCta`,
`ServiceCards`, `Faq`

- [ ] **Step 1: Assign the numbers, in DOM order**

`01` Hero · `02` CategoryGrid · `03` FeaturedLines · `04` About ·
`05` ServiceCards · `06` TrustBand · `07` Spotlight · `08` Faq ·
`09` EnquiryCta. The ticker is not a section and takes no number.

- [ ] **Step 2: Convert the three `Eyebrow` + bespoke `<h2>` sections**

`About`, `Spotlight`, `EnquiryCta` — replace with `SectionHeading`, keeping
their existing copy verbatim.

- [ ] **Step 3: Convert the two bespoke sections**

`CategoryGrid` keeps its two-line red-word heading via `set:html`; its
`All products` link moves into the action slot. `FeaturedLines` gains the
micro-label it has never had.

- [ ] **Step 4: Number the two that already use the primitive**

`ServiceCards` and `Faq` need only `n`.

- [ ] **Step 5: Assert the system holds**

Add to `tests/e2e/home.spec.ts`: every `.section-index` on the page reads a
distinct, zero-padded, ascending number, and the count matches the number of
section heads. This is the invariant that makes rule 2 enforceable rather than
aspirational.

---

### Task 5: The industries band joins the system

**Why:** the review says the red strip "feels like it belongs to a different
design system" and is too loud against the rest of the page. It is also the
second full-bleed red surface on one page, which is what dilutes red as the
colour of action.

**Files:** `src/components/sections/TrustBand.astro`

- [ ] **Step 1: Drop the red surface**

The band becomes an ordinary light section on `--surface-alt`, with the shared
head and `06`.

- [ ] **Step 2: Keep the chips, keep the caveat**

The eight industries stay, as outlined chips. **The comment recording that they
are inferred from the product mix and are pending client confirmation must
survive the edit** — it is the only thing on the page that says so.

- [ ] **Step 3: Check the page still has one red band**

The category ticker keeps its red, because it is navigation.

---

### Task 6: Verify, preview, record

- [ ] **Step 1:** `npm run verify` — expect 18/18.
- [ ] **Step 2:** Stop the browser-pane preview before the Playwright run;
      it listens on 4321 and Playwright reuses it, carrying its accumulated
      rate-limit state into the enquiry tests.
- [ ] **Step 3:** Full public browser suite.
- [ ] **Step 4:** Browser check at 1440 and 390: numbering ascends down the
      page, no section has a horizontal scrollbar, no numeral collides with
      content.
- [ ] **Step 5:** `handoff.md` section and `BACKLOG.md` entries for the
      deferred per-section art direction.
- [ ] **Step 6: Do NOT commit.** The client reviews the preview first.

---

## Self-Review

**Spec coverage.** P1 items: crop marks → Task 1; numbering defined → the
system rules plus Task 3; numbering continues across the page → Task 4;
side whitespace → Task 2; rest of page closer to the hero → Tasks 3–5. P2 item
6 (industries strip) → Task 5. P2 items 7–9 and all of P3 → deferred to
`BACKLOG.md` with the reasoning above, not silently dropped.

**Risk.** The largest is Task 4: seven sections change their head markup in one
pass. `tests/e2e/home.spec.ts` asserts on content selectors (`.cg__grid li`,
`.cg__count`, `.fl__grid li`, `[data-featured-tabs]`) rather than head
selectors, so the conversion should not touch them — but that is a claim to
check by running, not to rely on.

**The numbering invariant is the point of Task 4 Step 5.** Without it this pass
produces the same half-committed system it exists to replace, one section at a
time, the next time someone adds a section.
