# Catalogue editing in the admin — plan

**Date:** 2026-08-13
**Status:** proposed, not started
**Supersedes:** nothing. Implements Phase 2 and Phase 3 of
`docs/superpowers/specs/2026-08-09-admin-dashboard-design.md`.

The request: admins should be able to browse every product, edit it, delete it,
create new ones, and upload images, with routing and enough context on each
screen to work from.

---

## 0. Why this cannot start with the edit form

Three facts about the site as it stands, each of which independently blocks a
catalogue editor. They are the reason this plan is long.

**The catalogue is a set of JSON files in the repository.**
`src/content.config.ts` loads `src/data/products.json` with Astro's `file()`
loader at **build** time. The 85 product pages are prerendered HTML. An edit
saved anywhere at runtime changes none of them.

**The server cannot write those files.** The admin runs as a Vercel serverless
function on a read-only filesystem. Even if it could write, the change would
live in one warm instance, be absent from git, and vanish on the next deploy.

**Nothing about a saved edit reaches a visitor without a rebuild.** The site is
`output: 'static'` by deliberate choice, and that choice is what makes it fast
and cheap. Editing therefore needs a *publish* step, not just a *save* step.

So the order is forced: move the catalogue into Postgres first (**Phase 2**),
then build the editor on top of it (**Phase 3**). Building the editor against
the JSON files would produce a UI that appears to work and changes nothing —
the worst possible outcome, and the exact class of silent failure this project
keeps gates for.

---

## 1. Two decisions I need from you before Phase 3 starts

Phase 2 needs neither, so it can begin either way.

### 1.1 What does provenance mean for a product you type in?

Every product record carries `source: { doc, page }`, and `npm run verify` fails
if one does not. It exists so any specification can be audited back to the
printed page it was read off. It is the mechanical half of rule 1: **never
invent product data**.

A product created in the admin has no brochure page. Three options:

| | What it means | Cost |
|---|---|---|
| **A. Require a written source** *(recommended)* | The form will not save without naming where the facts came from — a datasheet filename, a supplier email with its date, "phone call with X, 12 Aug". Free text, required, shown in the admin, never on the public site. | An extra required field. Preserves rule 1 honestly. |
| **B. A synthetic source** | New records get `{ doc: 'admin', page: 0 }`. | Passes the gate while meaning nothing. It converts a real check into a formality, and it is how rule 1 dies quietly. **I would argue against this.** |
| **C. Editing only, no creation** | Admins may correct and delete but not add. | Sidesteps the question entirely; you said you want to add listings, so this is probably not it. |

**A** is what I would build unless you say otherwise.

### 1.2 Who may publish, and how automatic is it?

An edit is saved to the database immediately. Getting it in front of a buyer
means rebuilding the site (~1 minute on Vercel).

| | Behaviour |
|---|---|
| **A. Explicit Publish button** *(recommended)* | Edits accumulate; the admin sees "3 changes since last publish" and presses Publish. One rebuild for a batch of edits, and a deliberate moment before the public site changes. |
| **B. Publish on every save** | Simpler to understand; a rebuild per keystroke-batch, and no chance to review. |
| **C. Scheduled** | Rebuild nightly. Cheapest, slowest to see a correction live. |

**A** is what I would build.

---

## 2. Phase 2 — the catalogue into Postgres

**No UI. The public site must not change at all.** This is the dangerous phase
and it ships alone, as the design doc requires.

### 2.1 Tables

Three tables mirroring the existing Zod schemas exactly — `divisions`,
`categories`, `products` — with the same field names and nullability, so the
schemas stay the single contract between database, loader and pages. `specs`
and `en388` stay `jsonb`: they are read as whole objects and never queried
into.

RLS enabled with zero policies, like `enquiries`. The build reads with the
service-role key; nothing else reads at all.

### 2.2 The loader

Replace `file()` in `src/content.config.ts` with `supabaseLoader()`. It fetches
**all** rows and lets `catalog.ts` keep doing the draft filtering it already
does — preserving existing semantics exactly is what makes the acceptance test
below meaningful.

`CATALOGUE_SOURCE=json|postgres` (default `postgres`) stays as a documented
escape hatch so a build can fall back to the committed JSON if Supabase is
unreachable. Removed once Phase 3 has been live long enough to trust.

### 2.3 Acceptance: a byte-identical build

1. Build from JSON. Keep `dist/client`.
2. Seed Postgres from the same JSON.
3. Build from Postgres.
4. Diff the two directories.

**Any difference is a migration defect.** This is the strongest test available
here and it is the whole reason the phase is isolated from any UI. A new verify
gate runs the comparison.

### 2.4 What this phase breaks, and must fix

**The catalogue-shape gate stops making sense.** It currently hard-codes 85
products, 15 categories, 6 EN 388 ratings, read straight from
`src/data/products.json`. Once the catalogue is editable those numbers move for
good reasons, and once it is in Postgres that file is no longer the truth.

It must not simply be deleted — it is one of the few mechanical defences rule 1
has. It changes shape:

- **Kept and strengthened as invariants**, checked against the database: every
  product has a source; every `categoryId` resolves; every `divisionId`
  resolves; every `heroProductSlug` is null or resolves to a real product; no
  two products share a slug.
- **Counts move from pinned to recorded.** A committed snapshot file holds the
  expected totals and the gate fails when reality disagrees — exactly like the
  counts block in `CLAUDE.md`, regenerated deliberately by a script. A number
  still cannot move without somebody acknowledging it; it is simply no longer a
  literal in a source file.

**`npm run counts` and the counts block** gain the catalogue totals from the
database rather than the JSON.

**Offline builds end.** Once the catalogue lives in Postgres, no build works
without network access. That is inherent to the choice, not a defect, and it is
why the escape hatch exists.

---

## 3. Phase 3 — the editor

Built in four shippable steps. Each is useful on its own.

### 3a. Browse (read-only)

| Route | What it is |
|---|---|
| `/admin/catalogue` | Every product. Filter by division, category and status; search by name or slug; paged like the inbox. |
| `/admin/catalogue/[slug]` | One product, everything on it, read-only. Its specs, EN 388 row, images, source, category, and a link to the live page. |
| `/admin/catalogue/categories` | The 15 categories with product counts and empty-state flags. |

Ships before any editing exists. It proves the read path and the routing, and
it is immediately useful — there is currently no way to see what the catalogue
holds without opening JSON.

### 3b. Edit an existing product

A server-rendered form, one product per page, no JavaScript — same constraint
as the rest of the admin, and the reason there is no drag-to-reorder and no
live preview.

**Repeatable spec rows without script.** Specs are a variable-length list. The
form renders the existing rows plus three empty ones, and an "Add more rows"
button that submits and re-renders with more. Ugly compared to a JS repeater,
and it works with no script at all.

Guard rails that are part of the feature, not polish:

- **Slug permanence.** Changing a published product's slug breaks its URL and
  its search ranking — `docs/CONTENT-EDITING.md` already names this as a rule
  that bites. The editor refuses a silent change: it requires explicit
  confirmation on a separate step and records the old slug so a redirect can be
  emitted.
- **Empty means absent.** A cleared field saves as absent, never as `""` or
  `0`. No placeholder text that could be mistaken for a value.
- **EN 388 states the trap inline.** `X` means untested and `0` means a tested
  result of zero. That distinction is already documented as a trap and this is
  the screen where it will be got wrong.
- **Audit log.** `catalogue_audit`: actor, entity, action, before/after JSON,
  timestamp. On a catalogue whose first rule is that every value traces to a
  source, "who changed this and when" is not optional.

### 3c. Create and delete

- **Create** starts as `status: draft`, so it is invisible to the public site
  until published. Requires the source field from decision 1.1.
- **Delete** is soft by default — status `archived`, recoverable. A hard delete
  is a separate, confirmed action.
- **Referential integrity, enforced before the write, not by a 500:**
  a category with products cannot be deleted; deleting a product that is a
  category's `heroProductSlug` must repoint or clear it first (the field is
  nullable and two categories legitimately use `null`).

### 3d. Images

The one part that genuinely cannot work the way it does now. Product images are
`src/assets/products/*.png`, pulled in by `import.meta.glob` at build time and
optimised by Astro. An uploaded file cannot join that set at runtime.

- Upload to **Supabase Storage** via a plain multipart form POST — no
  JavaScript required, which is convenient given none is allowed.
- **Validated on upload**, and the checks are the feature: format, dimensions,
  and transparency. The design needs knocked-out PNGs on dark surfaces, and a
  JPEG with a white box behind the product is the single most likely mistake —
  the same failure mode as the clip-forwarding bug in `tools/README.md`.
  Rejected with a reason, not silently accepted.
- **A prebuild step pulls Storage images into `src/assets/products/`** before
  the build, so Astro's optimiser still runs and the public site's image
  pipeline is unchanged. Resolution rules still apply: never upscale beyond
  ~2×.

### 3e. Publish

- A Vercel **deploy hook**, called by a Publish action.
- The admin shows how many changes are unpublished and when the last publish
  was, so "why can't I see my edit" answers itself.
- Build status surfaced in the UI.

---

## 4. Order, and what each step is worth on its own

| Step | Ships | Useful alone? |
|---|---|---|
| Phase 2 | Catalogue in Postgres, byte-identical build | No visible change — it is the foundation |
| 3a | Browse the catalogue in the admin | Yes — first time the catalogue is visible outside JSON |
| 3b | Edit existing products, audit log | Yes — corrections without a developer |
| 3c | Create, delete, referential integrity | Yes — the full request |
| 3d | Image upload and validation | Yes — removes the last developer dependency |
| 3e | Publish button and build status | Completes the loop |

Phase 2 is the largest and least visible. 3a is small. 3b is the biggest UI
piece.

---

## 5. Risks, stated plainly

- **Phase 2 touches all 110 pages through one module.** It ships alone, behind
  the byte-identical test, with nothing else in the commit.
- **An editable catalogue weakens rule 1 by construction.** The rule survives
  only if the source field survives (decision 1.1). A UI full of empty boxes
  invites filling them in, which is precisely what the rule exists to prevent.
- **No catalogue edit can be verified on this machine.** There are no Supabase
  credentials here, so every phase after 2 is verifiable by typecheck, unit test
  and build, and by nobody's eyes until it is on a deployment. Same limitation
  as the admin redesign, and worth planning around: expect a round of
  corrections after each step goes live.
- **The two empty categories must stay honest.** Spill Control and Electrical
  Accessories have no products because the brochure has none. The editor must
  not make it convenient to fill them with placeholders.
