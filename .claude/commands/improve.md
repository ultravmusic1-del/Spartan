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

## Before you start

`CLAUDE.md` holds the four rules. They are not negotiable and this command does
not restate them — restating them is how this file came to defend a video that
had been deleted for eleven commits.

`docs/TRAPS.md` holds what fails silently and what only looks like a defect.
Read it before touching an area you have not touched before.

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

   If an item turns out to need a product fact that cannot be sourced, it is
   blocked: mark it `[!]` and pick something else.

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
   e2e suite. **Add or extend a test for what you changed** — every test here
   was worth writing.

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
