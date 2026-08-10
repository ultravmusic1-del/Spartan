# Agent guidance — optimization design

**Date:** 2026-08-10
**Status:** approved
**Touches:** `CLAUDE.md`, `AGENTS.md`, `docs/TRAPS.md` (new), `handoff.md`,
`.claude/commands/improve.md`, `tools/verify.mjs`

29 of the last 30 commits on this repository are agent-authored. The guidance
files are therefore not documentation *about* the dev process — they **are** the
dev process, and their defects are shipped defects.

This document specifies a correction and a restructure, plus the gates that stop
the same rot recurring.

---

## 1. The problem, measured

`CLAUDE.md` has been edited three times in the project's life. `improve.md` once,
at creation. Thirty commits of code shipped alongside. Guidance is written once,
code is written continuously, and **nothing connects them** — so the only
mechanism keeping them in agreement is an agent remembering to update prose that
no test reads.

That mechanism has already failed, in four distinct ways.

### Wrong facts

| Location | Claims | Reality |
|---|---|---|
| `CLAUDE.md:5` | "no accounts" | Admin accounts exist — Supabase auth, an allow-list, an HttpOnly session, middleware |
| `CLAUDE.md:8` | Stack omits the database | Supabase Postgres is the **system of record** for enquiries |
| `CLAUDE.md:27` | Rule 2 keys off `delivered` | Two channels now; the honest signal is `recorded \|\| delivered` |
| `CLAUDE.md:73` | "the one SSR route (`/api/enquiry`)" | Four `prerender = false` routes, plus middleware on every route |

Rule 2 is the one that causes harm. An agent following `CLAUDE.md` alone keys the
failure message off `delivered` and tells a buyer their enquiry failed when the
row *was* written to Postgres. That inverts the rule the section exists to
protect. The correct contract is in
`docs/superpowers/specs/2026-08-09-enquiry-collection-design.md` and in
`src/lib/enquiry-outcome.ts`: `unconfigured` is not `failed`, and 502 means
*every configured channel* failed.

The SSR-route claim has a documented reason to have changed —
`docs/superpowers/specs/2026-08-09-admin-dashboard-design.md` §1 explicitly
records the admin as the exception `handoff.md` demanded. The decision was taken
properly; only `CLAUDE.md` was never told.

### Stale counts

Docs state **63** unit tests in five places — `handoff.md:8`, `:167`, `:314` and
`README.md:41`, `:209`. There are **112**. `improve.md:137` argues "146 tests
exist because each one was worth writing" — a good argument resting on a dead
number.

The spread matters more than the error. Five copies of one number, in three
files, none of which reads the test suite.

An earlier draft of this document said **104**, counted by grepping for `it(`
and `test(`. Vitest reports 112. The error was made while writing the argument
for why derived counts cannot be trusted, which is the argument itself: the
gate takes its number from the test runner, never from a grep.

`handoff.md:249` reads: *"72 is correct — if you see 74 anywhere, it is stale."*
The project already knows stale counts are its failure mode and is defending
against them with a prose warning. That is the gap this design closes.

### Dead references

`improve.md`'s "Do not fix" list instructs agents to preserve **"The hero video's
4-frame GOP"**. The video was deleted in `d6808db`; `public/video/` is gone. The
guidance defends a file that is not in the repository.

### Silent duplication

`CLAUDE.md` and `AGENTS.md` are byte-identical — the same git blob,
`9b944ab` — maintained as two real files with nothing enforcing the match.
`improve.md` restates roughly 80% of `CLAUDE.md` a third time. Triplicated prose
with no gate is how the GOP entry survived a deletion.

### Cost

`CLAUDE.md` (3.6KB) instructs reading `handoff.md` (41KB) "before changing
anything you have not touched before", which in practice is every session; the
loop adds `improve.md` (9.3KB). ~54KB, ~14k tokens, before any work begins — and
much of `handoff.md` is history (*"Task 7's defects, for the record"*) rather
than anything an implementer needs.

---

## 2. The organising principle

**Split guidance by how often it is needed, not by topic.**

A corollary does the real work:

> **Instructional documents state what is true now. `handoff.md` records what
> happened.**

This is what makes the gates tractable. An instructional file may not reference a
path that does not exist; a historical file must be free to say "the MP4s in
`public/video/` are gone" without a gate calling it a defect. Gating history
would force the record to become dishonest to stay green — the exact trade this
project refuses everywhere else.

---

## 3. File roles

| File | Role | When read | Size now → target |
|---|---|---|---|
| `CLAUDE.md` | Identity, invariants, verify contract, commands, routing table | Auto-loaded, every session | 3.6KB → ~5KB |
| `AGENTS.md` | Byte-identical twin for non-Claude harnesses | — | unchanged, **gated** |
| `docs/TRAPS.md` | **New.** Silent failures, and "looks like a defect, is not" | Touching an unfamiliar area | — → ~8KB |
| `handoff.md` | History, reasoning, measured data | When you need *why* | 41KB → ~40KB, corrected |
| `.claude/commands/improve.md` | Loop mechanics only | Per `/improve` | 9.3KB → ~3.5KB |

Routine guidance reading: ~54KB → ~16KB.

### `CLAUDE.md`

Small enough that its cost is never worth avoiding. Carries: what the project is,
the four invariants (rule 2 corrected, admin subsystem named), the verify
contract, the commands, the generated counts block (§4C), and a routing table
saying which file answers which kind of question.

Gains, all currently absent: the admin subsystem and its middleware; the
service-role-key leak gate; `src/lib/env.ts`'s `process.env`-first precedence and
why (Vite inlines `import.meta.env.*` at build time, so a secret added after a
build never reaches an inlined reference); `.github/workflows/verify.yml`;
`tools/brand-sheet.mjs`.

### `AGENTS.md`

Stays a byte-identical copy rather than becoming a pointer file. A pointer
depends on a foreign harness choosing to follow it; a copy does not. Duplication
is acceptable **only** because §4B makes divergence impossible.

### `docs/TRAPS.md`

Two sections.

**Fails silently** — the things `astro check` passes straight through: Playwright
attaching to a running dev server; stale scoped CSS after a wholesale component
rewrite; Tailwind utilities losing to unlayered Astro scoped styles; `hidden`
never holding its space; the `mounted`/`ready` gate every island reading a
persistent nanostore needs; `client:visible` not hydrating in a background tab;
`astro:assets` refusing a runtime path; a green axe run not being a WCAG claim;
CSP hashes going stale without failing the build; the service-role key and
`import.meta.env` inlining; the middleware's build-time early return.

**Looks like a defect, is not** — moved wholesale from `improve.md`, because
nothing about it is loop-specific. The DAY|NIGHT panel in the two safety-vest
images has been reported as a regression once (`handoff.md:282`); that can
happen in any session, not only inside `/improve`. The hero-GOP entry is deleted
here rather than carried across.

An earlier draft of this document said **twice**. The sources say once, and the
error propagated from here into the plan and then into `docs/TRAPS.md` before
review caught it. It is recorded rather than quietly corrected because it is the
same failure this document is about — a number written from memory, copied
forward by people trusting the copy, in a project whose first rule is that no
value ships without a source that can be named.

### `handoff.md`

Keeps the history, the reasoning and the measured data — the contrast table (§3),
the 72-product distribution (§6), the extraction behaviours. These are why the
document is worth its size.

Corrections only: the header (`Last updated: 2026-08-05`, `Branch:
feat/catalogue-site`, "the build is finished" — none true after eleven commits),
a new section for the admin subsystem, and §7's "what a next session picks up",
which still lists the admin dashboard as future work after auth has shipped. The
status block at `handoff.md:7–13` is reframed as a dated snapshot so it stops
reading as a live claim.

The contrast table stays where it is. It is thirteen rows, it does not drift, and
moving it into the always-loaded tier would cost every session to save the
occasional lookup.

### `.claude/commands/improve.md`

Loop mechanics only: orient, choose one item, mark `[~]`, understand, implement,
verify, commit to `agent/improvements`, update `BACKLOG.md`, report — plus the
stop-and-ask conditions. It **references** the four rules instead of restating
them. Restating them is what let it drift.

---

## 4. Gates — `tools/verify.mjs`

New gates follow the existing `record(name, ok, detail)` convention.

### A. Doc path integrity

Every backtick-quoted repo path in the instructional tier (`CLAUDE.md`,
`AGENTS.md`, `docs/TRAPS.md`, `.claude/commands/improve.md`) must resolve. Globs
must match at least one file.

A token is treated as a repo path when it contains `/` and begins with a known
top-level directory (`src/`, `tools/`, `tests/`, `docs/`, `public/`, `design/`,
`.github/`, `.claude/`), or matches a known root file. Package specifiers
(`@astrojs/vercel`) do not qualify and are not checked. Build outputs (`dist/`,
`.vercel/`, `node_modules/`) are allowlisted — they are legitimate references
whose existence depends on build ordering.

`handoff.md` is **exempt**, per §2.

### B. Twin equality

`CLAUDE.md` and `AGENTS.md` must be byte-identical. Trivial, deterministic, and
it removes the only cost of keeping the copy.

### C. Canonical counts

Volatile numbers live in exactly one place: a generated block in `CLAUDE.md`
delimited by HTML comments, regenerated with `--write`. Same pattern and same
ergonomics as `npm run csp`, which this project already relies on for the same
class of problem — a value that must track the build and fails silently when it
does not.

Asserted: product, category and division counts from `src/data/*.json`; SSR
routes by `prerender = false`; built pages from `dist/client`; inline-script
hashes from `vercel.json`; and the unit-test count taken from the vitest run
`verify` already performs — the exact number, not a grep. The e2e count is
**excluded**, decided during implementation. Writing it would mean a full
Playwright run on every regeneration — minutes, every time — and a tool
expensive enough to avoid is a tool that gets avoided. An omitted number
costs less than an unused gate.

Instructional prose makes no other count claims. `handoff.md`'s numbers stay, as
dated history.

`README.md` is the exception to §7's "out of scope": it is not agent guidance,
but `README.md:41` and `:209` state the test count and are wrong by the same
mechanism. Its **count claims** come into the gate; its prose and structure do
not.

This catches 63 → 104. It would have caught 74 → 72.

### D. Rule-2 contract

Both enquiry clients — `src/components/enquiry/EnquiryForm.tsx` and
`src/scripts/quick-enquiry.ts` — must reference `recorded`, not `delivered`
alone.

The e2e suite already pins the response *shape* with exhaustive `toEqual`s. This
pins that the UI *respects* it. It is the invariant most likely to be broken
quietly, and the one `CLAUDE.md` currently teaches backwards.

---

## 5. Not gated, deliberately

**Rule 4, colour.** No static check can know a rendered font size against a
resolved background without reimplementing the cascade. A gate that half-works
here is worse than none: it would report green while small red text sits on
`--color-card` at 4.23:1.

This project has already been bitten by exactly that — `handoff.md:416` records
Lighthouse reading 100 on accessibility with a serious WCAG A failure present on
72 product cards, because the rule that would have caught it was weighted 0. A
colour gate covering only the easy cases would recreate that false confidence.

Rule 4 stays prose-enforced. The real enforcement remains the `onLight` prop on
`Eyebrow`, `PillButton` and `SectionHeading` — the rule expressed in code rather
than remembered.

---

## 6. Verification

The work is verified by `npm run verify` passing with the four new gates active,
and specifically by:

- **A** failing when a path is deleted from the repo but left in `CLAUDE.md`.
- **B** failing when `AGENTS.md` is edited alone.
- **C** failing today against the checked-in `63`, and passing after `--write`.
- **D** failing when a client is changed to key off `delivered` alone.

Each is asserted by making the change, observing the gate fail, and reverting —
not by reasoning that it would.

No gate is weakened to make the suite pass. If a gate proves unworkable it is
removed with the reason recorded here, not softened until it is green.

---

## 7. Out of scope

- Rewriting `README.md` or `docs/CONTENT-EDITING.md`. Neither is agent guidance.
  `README.md`'s **count claims** are corrected and gated per §4C — they are wrong
  by the same mechanism as the rest — but nothing else about either file is
  touched.
- `BACKLOG.md` structure. It is working.
- Hooks in `.claude/settings.json`. Considered and deferred — the gates cover the
  same invariants at commit time, and hooks add a second enforcement surface that
  can itself drift.
- Any change to product data, components or the build.
