# Agent guidance optimization — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the four wrong facts in the agent guidance, split it by how often each part is needed, and add four gates to `npm run verify` so the same rot cannot recur silently.

**Architecture:** Guidance splits into an instructional tier (`CLAUDE.md`, `AGENTS.md`, `docs/TRAPS.md`, `.claude/commands/improve.md`) that states what is true now, and a historical tier (`handoff.md`) that records what happened. Four new gates in `tools/verify.mjs` enforce the instructional tier: doc path integrity, twin equality, canonical counts, and the rule-2 contract. Volatile numbers live in exactly one generated block, written by a new `tools/counts.mjs` that mirrors the existing `tools/csp.mjs` in both structure and ergonomics.

**Tech Stack:** Node 22 ESM, no new dependencies. Vitest for the pure functions, `npm run verify` for the gates.

**Spec:** `docs/superpowers/specs/2026-08-10-guidance-optimization-design.md`

## Global Constraints

- **Never weaken a gate to make it pass.** If a gate proves unworkable, remove it and record why in the spec. Do not soften it until it is green.
- **Never invent product data.** This plan touches no catalogue value. If a step appears to require one, the step is wrong.
- **No new dependencies.** Everything here is Node builtins plus what is already installed.
- **Every exported function in a new `tools/*.mjs` needs JSDoc types.** `tsconfig.json` includes `**/*` and Astro's base config sets `allowJs`, so `astro check` — gate 1 — typechecks the `.test.ts` files and infers signatures from the `.mjs` source. Vitest does not typecheck, so a green test run is not evidence gate 1 will pass. Run `npx astro check` after creating any tool/test pair.
- **`handoff.md` is exempt from gate A.** History must stay free to reference deleted files. Gating it would force the record to become dishonest to stay green.
- **Commit to `agent/improvements`, never to `main`.** One commit per task.
- Commit messages end with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- Match the house comment style: this repo comments **why**, at length, not what. A comment that explains the mechanism but not the consequence is half-written.
- **Stop the dev server before any `--full` run.** Playwright attaches to whatever is on :4321 instead of building.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `tools/counts.mjs` | Create | Compute the canonical counts; render the block; write it into both twins. Exports pure functions for test and for `verify` to reuse. |
| `tools/counts.test.ts` | Create | Unit-tests the pure functions — block rendering, block replacement, path extraction, glob resolution. |
| `tools/doc-paths.mjs` | Create | Extract repo-path tokens from markdown and resolve them. Separate from `counts.mjs` because gate A and gate C share nothing but a consumer. |
| `tools/verify.mjs` | Modify | Add gates 12–15. Hoist the vitest count so gate C can reuse it. |
| `vitest.config.ts:41` | Modify | Extend `include` to reach `tools/`. |
| `package.json:15` | Modify | Add the `counts` script. |
| `docs/TRAPS.md` | Create | Silent failures, and "looks like a defect, is not". |
| `CLAUDE.md` | Rewrite | Instructional tier. Corrected, plus the counts block and a routing table. |
| `AGENTS.md` | Rewrite | Byte-identical copy of `CLAUDE.md`. |
| `.claude/commands/improve.md` | Rewrite | Loop mechanics only. |
| `handoff.md` | Modify | Header corrected, admin section added, status block dated. |
| `README.md` | Modify | Count claims replaced with a pointer. |

**Ordering is load-bearing.** Gate B lands first so the twins cannot diverge while later tasks edit them. `docs/TRAPS.md` exists before `CLAUDE.md` references it, or gate A fails. The counts block is inserted by the same task that adds gate C, or gate C fails the moment it lands.

---

### Task 1: Gate B — the twins cannot diverge

`CLAUDE.md` and `AGENTS.md` are the same git blob (`9b944ab`) maintained as two real files. This lands first so every later task that edits one is forced to edit both.

**Files:**
- Modify: `tools/verify.mjs` — new gate after section 11

**Interfaces:**
- Consumes: `record(name, ok, detail)`, `root`, `fs`, `path` — all already in scope at module level.
- Produces: nothing later tasks import.

- [ ] **Step 1: Prove the gate is needed — make the twins diverge**

```bash
printf '\ndivergence probe\n' >> AGENTS.md
```

- [ ] **Step 2: Confirm nothing currently catches it**

Run: `node -e "const fs=require('fs');console.log(fs.readFileSync('CLAUDE.md','utf8')===fs.readFileSync('AGENTS.md','utf8')?'identical':'DIVERGED')"`

Expected: `DIVERGED` — and `npm run verify` would still pass. That is the defect.

- [ ] **Step 3: Revert the probe**

```bash
git checkout -- AGENTS.md
```

- [ ] **Step 4: Add the gate**

Insert into `tools/verify.mjs` immediately after the section 11 block (`service-role key never reaches the client`) and before the e2e section:

```js
/* ------------------------------------------- 12. CLAUDE.md and AGENTS.md -- */

/*
 * These two files are one document with two names, because Claude Code reads
 * the first and other harnesses read the second. They were byte-identical when
 * this gate was written and nothing whatsoever enforced it — the copy existed
 * only because someone had remembered to make it.
 *
 * That is the same mechanism that let `.claude/commands/improve.md` go on
 * defending the hero video's GOP for eleven commits after the video was
 * deleted. Duplicated guidance with no gate drifts, and the drift is invisible
 * because prose does not fail.
 *
 * Line endings are normalised before comparing: this repo is developed on
 * Windows and git rewrites LF to CRLF in the working copy, which an editor can
 * apply to one file and not the other. That difference is not the drift this
 * gate is looking for.
 */
{
  const read = (rel) =>
    fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
  const claude = read('CLAUDE.md');
  const agents = read('AGENTS.md');
  const same = claude === agents;

  record(
    'CLAUDE.md and AGENTS.md agree',
    same,
    same
      ? `${claude.length} chars, identical`
      : 'diverged — copy one over the other, do not merge by hand',
  );
}
```

- [ ] **Step 5: Verify the gate fails when it should**

```bash
printf '\ndivergence probe\n' >> AGENTS.md
node tools/verify.mjs
```

Expected: ` FAIL  CLAUDE.md and AGENTS.md agree — diverged — copy one over the other, do not merge by hand`, and `VERIFY FAILED` in the summary.

- [ ] **Step 6: Revert and confirm green**

```bash
git checkout -- AGENTS.md
node tools/verify.mjs
```

Expected: `  ok   CLAUDE.md and AGENTS.md agree — 3634 chars, identical`, and `VERIFY PASSED`.

- [ ] **Step 7: Commit**

```bash
git add tools/verify.mjs
git commit -m "$(cat <<'EOF'
test: gate that CLAUDE.md and AGENTS.md cannot diverge

They are one document with two names -- Claude Code reads the first,
other harnesses read the second -- and they were byte-identical only
because someone had remembered to make them so.

Nothing failed when duplicated guidance drifted, which is how
improve.md went on defending the hero video's 4-frame GOP for eleven
commits after d6808db deleted the file.

Line endings are normalised before comparing. The repo is developed on
Windows and git rewrites LF to CRLF in the working copy; an editor
applying that to one file and not the other is not the drift this is
looking for.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Gate A — instructional docs may not name a path that does not exist

**Files:**
- Create: `tools/doc-paths.mjs`
- Create: `tools/doc-paths.test.ts`
- Modify: `vitest.config.ts:41`
- Modify: `tools/verify.mjs` — new gate 13

**Interfaces:**
- Produces, consumed by Task 2's gate and by nothing else:
  - `INSTRUCTIONAL: readonly string[]` — the four gated files.
  - `extractPaths(markdown: string): string[]` — backtick tokens that look like repo paths.
  - `resolves(root: string, token: string): boolean` — true when the token exists; globs need one match.

- [ ] **Step 1: Extend vitest's reach to `tools/`**

`vitest.config.ts:41` currently pins `include: ['src/**/*.test.ts']`, with a comment explaining that the default swept up `tests/e2e/` and failed to collect it. That reasoning still holds and must survive the edit. Replace the `include` line with:

```ts
    include: ['src/**/*.test.ts', 'tools/**/*.test.ts'],
```

And extend the comment directly above it, after the existing sentences:

```ts
    // `tools/` is added for the same reason it is safe: it holds build and
    // verification scripts and no Playwright specs, so widening to it cannot
    // resurrect the collection failure above.
```

- [ ] **Step 2: Write the failing test**

Create `tools/doc-paths.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPaths, resolves } from './doc-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('extractPaths', () => {
  it('takes backticked repo paths', () => {
    expect(extractPaths('see `src/lib/catalog.ts` and `tools/csp.mjs`')).toEqual([
      'src/lib/catalog.ts',
      'tools/csp.mjs',
    ]);
  });

  it('takes bare root files', () => {
    expect(extractPaths('read `handoff.md` first')).toEqual(['handoff.md']);
  });

  // Everything below is a token this repo's prose genuinely contains. Each one
  // would be a false failure if the filter were naive, and a false failure in a
  // gate is how a gate gets deleted.
  it('ignores commands, tokens, routes, packages and prose', () => {
    const prose = [
      '`npm run verify -- --full`', // has whitespace
      '`--color-red-light`', // a CSS custom property
      '`/api/enquiry`', // a URL route, not a file
      '`@astrojs/vercel`', // a package specifier
      '`zod/v4`', // a package subpath
      '`text/javascript`', // a MIME type
      '`onclick=`', // an attribute
      '`recorded || delivered`', // an expression
    ].join(' ');
    expect(extractPaths(prose)).toEqual([]);
  });

  it('ignores build output, which exists only after a build', () => {
    expect(extractPaths('emitted to `dist/client/` by `.vercel/output/`')).toEqual([]);
  });

  it('deduplicates', () => {
    expect(extractPaths('`handoff.md` and again `handoff.md`')).toEqual(['handoff.md']);
  });

  it('strips trailing sentence punctuation', () => {
    expect(extractPaths('go to `src/lib/catalog.ts`.')).toEqual(['src/lib/catalog.ts']);
  });
});

describe('resolves', () => {
  it('is true for a file that exists', () => {
    expect(resolves(root, 'tools/csp.mjs')).toBe(true);
  });

  it('is false for a file that does not', () => {
    expect(resolves(root, 'tools/no-such-file.mjs')).toBe(false);
  });

  it('is true for a glob with at least one match', () => {
    expect(resolves(root, 'tools/*.mjs')).toBe(true);
    expect(resolves(root, 'src/data/*')).toBe(true);
  });

  it('is false for a glob that matches nothing', () => {
    expect(resolves(root, 'tools/*.rs')).toBe(false);
  });

  it('is false for a glob whose directory is gone', () => {
    // This is the case that matters: `public/video/*.mp4` was true until
    // d6808db deleted the directory with the hero film in it.
    expect(resolves(root, 'public/video/*.mp4')).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `npx vitest run tools/doc-paths.test.ts`

Expected: FAIL — `Failed to resolve import "./doc-paths.mjs"`.

- [ ] **Step 4: Write the implementation**

Create `tools/doc-paths.mjs`:

```js
/**
 * Repo-path references in the instructional guidance.
 *
 * WHY THIS EXISTS
 *
 * `.claude/commands/improve.md` spent eleven commits instructing agents not to
 * "fix" the hero video's 4-frame GOP. The video was deleted in d6808db. Prose
 * does not fail, so nothing said anything, and the guidance went on defending a
 * file that was not in the repository.
 *
 * WHY handoff.md IS NOT CHECKED BY THE CALLER
 *
 * The instructional tier states what is true now; handoff.md records what
 * happened. History has to stay free to say "the 2.9 MB of MP4 in
 * `public/video/` are all gone" — that sentence is correct precisely because
 * the path does not resolve. Gating it would force the record to become
 * dishonest in order to stay green, which is the trade this project refuses
 * everywhere else.
 */
import fs from 'node:fs';
import path from 'node:path';

/** The files this gate applies to. handoff.md is deliberately absent. */
export const INSTRUCTIONAL = ['CLAUDE.md', 'AGENTS.md', 'docs/TRAPS.md', '.claude/commands/improve.md'];

/** A token starting with one of these is a repo path worth checking. */
const DIRS = new Set(['src', 'tools', 'tests', 'docs', 'public', 'design', '.github', '.claude']);

/** Bare filenames that are real paths despite having no directory. */
const ROOT_FILES = new Set([
  'package.json', 'package-lock.json', 'vercel.json', 'astro.config.mjs',
  'tsconfig.json', 'vitest.config.ts', 'playwright.config.ts',
  'README.md', 'CLAUDE.md', 'AGENTS.md', 'handoff.md', 'BACKLOG.md', '.env.example',
]);

/*
 * Build output. These are legitimate references whose existence depends on
 * whether a build has run, so checking them would make the gate's result depend
 * on the order the caller happened to use.
 */
const IGNORED = ['dist/', '.vercel/', 'node_modules/'];

/**
 * Backticked tokens that look like repo paths.
 *
 * Conservative on purpose. A bare `p19-safety-vests.png` is a real file and is
 * NOT returned, because a rule loose enough to catch it also catches every
 * `package.json`-shaped word in prose. A gate that cries wolf is a gate someone
 * deletes; missing a case costs nothing, because the case was never covered
 * before this file existed either.
 *
 * JSDoc is load-bearing: `tsconfig.json` includes `**\/*` with `allowJs`, so
 * `astro check` typechecks the .test.ts importing this and infers the signature
 * from here.
 *
 * @param {string} markdown
 * @returns {string[]}
 */
export function extractPaths(markdown) {
  const found = new Set();

  for (const [, raw] of markdown.matchAll(/`([^`\n]+)`/g)) {
    const token = raw.trim().replace(/[.,;:!?)]+$/, '');
    if (!token) continue;
    if (/\s/.test(token)) continue; // `npm run verify`, `recorded || delivered`
    if (token.startsWith('/')) continue; // `/api/enquiry` — a route, not a file
    if (token.startsWith('@')) continue; // `@astrojs/vercel` — a package
    if (IGNORED.some((prefix) => token.startsWith(prefix))) continue;

    const qualifies = token.includes('/')
      ? DIRS.has(token.split('/')[0])
      : ROOT_FILES.has(token);
    if (qualifies) found.add(token);
  }

  return [...found];
}

/**
 * True when the token exists. A glob needs at least one match.
 *
 * @param {string} root
 * @param {string} token
 * @returns {boolean}
 */
export function resolves(root, token) {
  if (!token.includes('*')) return fs.existsSync(path.join(root, token));

  const dir = path.join(root, path.dirname(token));
  if (!fs.existsSync(dir)) return false;

  // Escape everything literal, then let `*` be the only wildcard.
  const pattern = path
    .basename(token)
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');

  const rx = new RegExp(`^${pattern}$`);
  return fs.readdirSync(dir).some((entry) => rx.test(entry));
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tools/doc-paths.test.ts`

Expected: PASS, 9 tests.

- [ ] **Step 5a: Typecheck, because gate 1 will**

`tsconfig.json` includes `**/*` and excludes only `dist`, and Astro's base config sets `allowJs`. So `astro check` reads this new `.test.ts`, follows the import into the `.mjs`, and infers the signatures from the JSDoc above. Vitest does not typecheck, so a passing test proves nothing here.

Run: `npx astro check`

Expected: `0 errors`. If it reports `Could not find a declaration file` or an argument-type mismatch, the JSDoc on the exported function is missing or wrong — fix the annotation, not the call site.

- [ ] **Step 6: Add the gate**

Insert into `tools/verify.mjs` after the section 12 block from Task 1:

```js
/* ------------------------------------ 13. instructional docs name real paths -- */

/*
 * See tools/doc-paths.mjs for why this exists and why handoff.md is exempt.
 *
 * `docs/TRAPS.md` may not exist yet when this gate first lands; a missing file
 * in the list is skipped rather than failed, because the gate's job is to check
 * the references inside a document, not to assert which documents exist. The
 * counts gate below would notice a document that vanished.
 */
{
  const { INSTRUCTIONAL, extractPaths, resolves } = await import('./doc-paths.mjs');
  const problems = [];
  let checked = 0;

  for (const rel of INSTRUCTIONAL) {
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) continue;
    for (const token of extractPaths(fs.readFileSync(file, 'utf8'))) {
      checked += 1;
      if (!resolves(root, token)) problems.push(`${rel} names \`${token}\`, which does not exist`);
    }
  }

  record(
    'instructional docs name real paths',
    problems.length === 0,
    problems.length ? problems.slice(0, 5).join('; ') : `${checked} references, all resolve`,
  );
}
```

- [ ] **Step 7: Verify the gate fails when it should**

```bash
printf '\nSee `src/lib/does-not-exist.ts` for details.\n' >> CLAUDE.md
node tools/verify.mjs
```

Expected: ` FAIL  instructional docs name real paths — CLAUDE.md names \`src/lib/does-not-exist.ts\`, which does not exist`.

Note the twin gate from Task 1 also fails here, because only `CLAUDE.md` was touched. That is correct behaviour and confirms Task 1 works.

- [ ] **Step 8: Revert and confirm green**

```bash
git checkout -- CLAUDE.md
node tools/verify.mjs
```

Expected: both gates `ok`, `VERIFY PASSED`.

- [ ] **Step 9: Commit**

```bash
git add tools/doc-paths.mjs tools/doc-paths.test.ts tools/verify.mjs vitest.config.ts
git commit -m "$(cat <<'EOF'
test: gate that instructional docs name paths that exist

improve.md spent eleven commits telling agents not to "fix" the hero
video's 4-frame GOP. d6808db deleted the video. Prose does not fail, so
nothing said anything.

The extractor is deliberately conservative: a bare `p19-safety-vests.png`
is a real file and is not checked, because a rule loose enough to catch
it also flags every package.json-shaped word in prose. A gate that cries
wolf gets deleted, and missing that case costs nothing -- it was never
covered before this file existed.

handoff.md is exempt, and that is the point of the split. History has to
stay free to say the MP4s in `public/video/` are gone; that sentence is
correct precisely because the path does not resolve.

vitest's include gains `tools/` and keeps the comment explaining why it
is pinned -- tools/ holds no Playwright specs, so widening to it cannot
resurrect the collection failure that pinned it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Gate D — the enquiry clients honour `recorded`

`CLAUDE.md:27` currently teaches that the UI keys off `delivered`. Both clients already do the right thing; this pins it before the rewrite in Task 6 changes the prose.

**Files:**
- Modify: `tools/verify.mjs` — new gate 14

**Interfaces:**
- Consumes: `record`, `root`, `fs`, `path`.
- Produces: nothing.

- [ ] **Step 1: Confirm both clients pass today**

Run: `grep -n "recorded" src/components/enquiry/EnquiryForm.tsx src/scripts/quick-enquiry.ts`

Expected: `EnquiryForm.tsx:171` shows `setCaptured(Boolean(body.recorded) || Boolean(body.delivered))` and `quick-enquiry.ts:114` shows `if (!body.recorded && !body.delivered)`.

- [ ] **Step 2: Add the gate**

Insert into `tools/verify.mjs` after the section 13 block:

```js
/* --------------------------------------- 14. the enquiry clients tell the truth -- */

/*
 * Rule 2: never report an enquiry as sent when it was not — and, just as
 * importantly, never report one as lost when it was kept.
 *
 * An enquiry travels two independent channels. It is written to Postgres, which
 * is the system of record, and an email notification is sent. Either is enough
 * for the submission to be a success: with the row written, a mail outage costs
 * a notification, not a lead. So the honest signal is `recorded || delivered`,
 * and a client keying off `delivered` alone tells a willing buyer their enquiry
 * failed while the row sits in the database.
 *
 * That is not hypothetical. CLAUDE.md described exactly that wrong contract
 * until 2026-08-10, so an agent following the guidance would have introduced
 * it.
 *
 * The e2e suite already pins the response SHAPE with exhaustive toEqual
 * assertions. This pins that the UI reads it. Comments are stripped first
 * because both files explain the two-channel model in prose, and a naive grep
 * would pass on the explanation while the code did the wrong thing.
 */
{
  const clients = ['src/components/enquiry/EnquiryForm.tsx', 'src/scripts/quick-enquiry.ts'];
  const problems = [];

  for (const rel of clients) {
    const code = fs
      .readFileSync(path.join(root, rel), 'utf8')
      .replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    if (!/\brecorded\b/.test(code))
      problems.push(`${rel} never reads \`recorded\` — it can only report a stored enquiry as lost`);
  }

  record(
    'enquiry clients honour `recorded`',
    problems.length === 0,
    problems.length ? problems.join('; ') : `${clients.length} clients read both channels`,
  );
}
```

- [ ] **Step 3: Verify the gate fails when it should**

Temporarily edit `src/scripts/quick-enquiry.ts:114` from `if (!body.recorded && !body.delivered) {` to `if (!body.delivered) {`, and delete the `recorded?: boolean;` line at `:46`. Then:

Run: `node tools/verify.mjs`

Expected: ` FAIL  enquiry clients honour \`recorded\` — src/scripts/quick-enquiry.ts never reads \`recorded\` — it can only report a stored enquiry as lost`.

- [ ] **Step 4: Revert and confirm green**

```bash
git checkout -- src/scripts/quick-enquiry.ts
node tools/verify.mjs
```

Expected: `  ok   enquiry clients honour \`recorded\` — 2 clients read both channels`.

- [ ] **Step 5: Commit**

```bash
git add tools/verify.mjs
git commit -m "$(cat <<'EOF'
test: gate that the enquiry clients read `recorded`, not `delivered`

An enquiry travels two independent channels and either is enough for
the submission to be a success -- with the row in Postgres, a mail
outage costs a notification rather than a lead. So the honest signal is
`recorded || delivered`, and a client keying off `delivered` alone tells
a willing buyer their enquiry failed while the row sits in the database.

Not hypothetical: CLAUDE.md described exactly that wrong contract, so an
agent following the guidance would have written it.

The e2e suite already pins the response shape with exhaustive toEqual
assertions. This pins that the UI respects it. Comments are stripped
first, because both files explain the two-channel model in prose and a
naive grep would pass on the explanation while the code did the
opposite.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Gate C — one live count, generated

The biggest task. `63` appears in five places against an actual 104. This makes exactly one place hold a live number and fails when it drifts.

**Deviation from the spec, decided here:** the **e2e count is excluded** from the block. Including it would mean every regeneration runs the full Playwright suite, making the write step cost minutes — and a tool expensive enough to avoid is a tool that gets avoided. Better to omit a number than to make the mechanism unattractive. The spec's §4C is amended by this task's commit.

**Files:**
- Create: `tools/counts.mjs`
- Create: `tools/counts.test.ts`
- Modify: `package.json:15` — add the `counts` script
- Modify: `tools/verify.mjs` — hoist the vitest count; new gate 15
- Modify: `CLAUDE.md`, `AGENTS.md` — insert the block

**Interfaces:**
- Produces:
  - `MARKERS: { start: string; end: string }`
  - `TARGETS: readonly string[]` — `['CLAUDE.md', 'AGENTS.md']`
  - `computeCounts(opts?: { unitTests?: number }): Counts` where `Counts = { products, categories, divisions, ssrRoutes, builtPages, cspHashes, unitTests }`, all `number`
  - `renderBlock(counts: Counts): string`
  - `replaceBlock(text: string, block: string): string | null` — `null` when the file has no markers
- Consumes from Task 2: nothing. The two tools are independent.

- [ ] **Step 1: Write the failing test**

Create `tools/counts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MARKERS, renderBlock, replaceBlock, computeCounts } from './counts.mjs';

const sample = {
  products: 72,
  categories: 15,
  divisions: 2,
  ssrRoutes: 4,
  builtPages: 97,
  cspHashes: 6,
  unitTests: 104,
};

describe('renderBlock', () => {
  it('is delimited by the markers', () => {
    const block = renderBlock(sample);
    expect(block.startsWith(MARKERS.start)).toBe(true);
    expect(block.endsWith(MARKERS.end)).toBe(true);
  });

  it('states every count', () => {
    const block = renderBlock(sample);
    for (const value of Object.values(sample)) {
      expect(block).toContain(String(value));
    }
  });

  it('is stable across calls, so a diff means a real change', () => {
    expect(renderBlock(sample)).toBe(renderBlock({ ...sample }));
  });
});

describe('replaceBlock', () => {
  it('swaps an existing block and leaves the rest alone', () => {
    const before = `# Title\n\n${renderBlock({ ...sample, unitTests: 63 })}\n\ntail text\n`;
    const after = replaceBlock(before, renderBlock(sample));
    expect(after).toContain('# Title');
    expect(after).toContain('tail text');
    expect(after).toContain('104');
    expect(after).not.toContain('63');
  });

  it('returns null when there are no markers, rather than appending', () => {
    // Appending would silently produce a second block, and the gate would then
    // compare against whichever one the regex found first.
    expect(replaceBlock('# Title\n\nno markers here\n', renderBlock(sample))).toBeNull();
  });

  it('is idempotent', () => {
    const block = renderBlock(sample);
    const once = replaceBlock(`# T\n\n${block}\n`, block);
    expect(replaceBlock(once!, block)).toBe(once);
  });
});

describe('computeCounts', () => {
  it('reads the catalogue from src/data, not from a constant', () => {
    const counts = computeCounts({ unitTests: 0 });
    expect(counts.products).toBe(72);
    expect(counts.categories).toBe(15);
    expect(counts.divisions).toBe(2);
  });

  it('counts every server-rendered route', () => {
    // /api/enquiry, /api/admin/login, /api/admin/logout, /admin/login.
    // handoff.md still called this "the one SSR route" after the admin landed.
    expect(computeCounts({ unitTests: 0 }).ssrRoutes).toBe(4);
  });

  it('takes the unit-test count from the caller', () => {
    // verify.mjs already ran vitest and parsed the number. Running it a second
    // time here would double the slowest gate in the suite.
    expect(computeCounts({ unitTests: 999 }).unitTests).toBe(999);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tools/counts.test.ts`

Expected: FAIL — `Failed to resolve import "./counts.mjs"`.

- [ ] **Step 3: Write the implementation**

Create `tools/counts.mjs`:

```js
/**
 * The canonical counts, generated from the repository.
 *
 *   node tools/counts.mjs          print the block
 *   node tools/counts.mjs --write  write it into CLAUDE.md and AGENTS.md
 *
 * WHY THIS EXISTS
 *
 * On 2026-08-10 the docs stated 63 unit tests in five places — handoff.md three
 * times, README.md twice — against an actual 104. improve.md argued "146 tests
 * exist because each one was worth writing", an argument resting on a dead
 * number. handoff.md:249 already carried the warning "72 is correct — if you
 * see 74 anywhere, it is stale", which is the project defending against this
 * exact failure with prose and losing.
 *
 * So there is now one live copy of every volatile number, it is generated, and
 * `npm run verify` fails when it drifts. Everywhere else either points here or
 * is explicitly dated history.
 *
 * WHY THIS MIRRORS tools/csp.mjs
 *
 * Same problem, same shape: a value that must track the build, whose staleness
 * nothing else notices. The CSP tool is already trusted and already in the
 * loop's muscle memory, so this one is deliberately not novel.
 *
 * WHY THE E2E COUNT IS NOT HERE
 *
 * Writing it would mean a full Playwright run on every regeneration — minutes,
 * every time. A tool expensive enough to avoid is a tool that gets avoided, and
 * an omitted number costs less than an unused gate.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const MARKERS = {
  start: '<!-- counts:start — generated by `npm run counts`; `npm run verify` fails when stale -->',
  end: '<!-- counts:end -->',
};

/** Both twins carry the block, because gate 12 compares them byte for byte. */
export const TARGETS = ['CLAUDE.md', 'AGENTS.md'];

const json = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));

/** Every built HTML page, including 404.html. */
function builtPages(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += builtPages(full);
    else if (entry.name.endsWith('.html')) total += 1;
  }
  return total;
}

/**
 * Routes that opt out of prerendering.
 *
 * handoff.md called `/api/enquiry` "the only server-rendered route" and said
 * nothing else may set the flag "without a reason as good". The admin dashboard
 * was that reason and the decision is recorded in its design doc — but the
 * count went stale anyway, in three documents. Counting the flag is cheaper
 * than remembering to.
 */
function ssrRoutes(dir = path.join(root, 'src/pages')) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += ssrRoutes(full);
    else if (/\.(astro|ts)$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      if (/export\s+const\s+prerender\s*=\s*false/.test(text)) total += 1;
    }
  }
  return total;
}

/** Only used by `--write`. verify.mjs has already run vitest and passes its number in. */
function runVitest() {
  try {
    const out = execFileSync('npx', ['vitest', 'run'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      maxBuffer: 64 * 1024 * 1024,
    });
    return Number(out.match(/Tests\s+(\d+) passed/)?.[1] ?? 0);
  } catch {
    return 0;
  }
}

/**
 * @typedef {object} Counts
 * @property {number} products
 * @property {number} categories
 * @property {number} divisions
 * @property {number} ssrRoutes
 * @property {number} builtPages
 * @property {number} cspHashes
 * @property {number} unitTests
 */

/**
 * JSDoc is load-bearing here, not decoration. `tsconfig.json` includes `**\/*`
 * with `allowJs`, so `astro check` — gate 1 — typechecks the .test.ts that
 * imports this and infers this signature from the source. Without the
 * annotation TS reads `{ unitTests } = {}` as `{ unitTests?: undefined }` and
 * rejects `computeCounts({ unitTests: 104 })` at the only call site that
 * matters.
 *
 * @param {{ unitTests?: number }} [opts]
 * @returns {Counts}
 */
export function computeCounts({ unitTests } = {}) {
  const vercel = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
  return {
    products: json('src/data/products.json').length,
    categories: json('src/data/categories.json').length,
    divisions: json('src/data/divisions.json').length,
    ssrRoutes: ssrRoutes(),
    builtPages: builtPages(path.join(root, 'dist/client')),
    cspHashes: (vercel.match(/sha256-/g) ?? []).length,
    unitTests: unitTests ?? runVitest(),
  };
}

/**
 * @param {Counts} c
 * @returns {string}
 */
export function renderBlock(c) {
  return [
    MARKERS.start,
    '',
    `**${c.products} products** across **${c.categories} categories**, in **${c.divisions} divisions**.`,
    '',
    `**${c.builtPages} built pages** · **${c.ssrRoutes} server-rendered routes** · ` +
      `**${c.cspHashes} inline-script CSP hashes** · **${c.unitTests} unit tests**.`,
    '',
    MARKERS.end,
  ].join('\n');
}

/*
 * Deliberately returns null rather than appending when the markers are absent.
 * Appending would produce a second block on the next run and the gate would
 * then compare against whichever one the regex reached first — a gate that
 * passes while the visible number is wrong.
 */
const BLOCK = /<!-- counts:start[\s\S]*?<!-- counts:end -->/;

/**
 * @param {string} text
 * @param {string} block
 * @returns {string | null} null when `text` carries no markers
 */
export function replaceBlock(text, block) {
  if (!BLOCK.test(text)) return null;
  return text.replace(BLOCK, block);
}

/* ------------------------------------------------------------------ main -- */

if (process.argv[1]?.endsWith('counts.mjs')) {
  if (!fs.existsSync(path.join(root, 'dist/client'))) {
    console.error('dist/client does not exist. Run `npm run build` first.');
    process.exit(1);
  }

  const counts = computeCounts();
  const block = renderBlock(counts);

  if (!process.argv.includes('--write')) {
    console.log(block);
    process.exit(0);
  }

  for (const rel of TARGETS) {
    const file = path.join(root, rel);
    const text = fs.readFileSync(file, 'utf8');
    const next = replaceBlock(text, block);
    if (next === null) {
      console.error(
        `${rel} has no counts block. Add these two lines where it belongs and re-run:\n\n${MARKERS.start}\n${MARKERS.end}\n`,
      );
      process.exit(1);
    }
    fs.writeFileSync(file, next);
  }

  console.log(`${TARGETS.join(' and ')} updated — ${counts.unitTests} unit tests, ${counts.builtPages} pages.`);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tools/counts.test.ts`

Expected: PASS, 9 tests. If `builtPages` is 0, run `npm run build` first — the test does not assert it, but the later steps need `dist/client`.

- [ ] **Step 4a: Typecheck, because gate 1 will**

Run: `npx astro check`

Expected: `0 errors`. The `computeCounts({ unitTests: 999 })` call in the test is the one that fails without the `@param {{ unitTests?: number }}` annotation — TS otherwise infers `{ unitTests?: undefined }` from the `= {}` default and rejects the number.

- [ ] **Step 5: Add the npm script**

In `package.json`, after the `csp` line at `:15`:

```json
    "counts": "node tools/counts.mjs --write",
```

- [ ] **Step 6: Insert the empty markers into both twins**

Add to `CLAUDE.md` immediately after the intro paragraph and stack line — before `## Read these`:

```markdown
<!-- counts:start — generated by `npm run counts`; `npm run verify` fails when stale -->
<!-- counts:end -->
```

Then make `AGENTS.md` an exact copy:

```bash
cp CLAUDE.md AGENTS.md
```

- [ ] **Step 7: Generate the block**

```bash
npm run build && npm run counts
```

Expected: `CLAUDE.md and AGENTS.md updated — <N> unit tests, 97 pages.`

**Do not expect a number from this document.** The count before this plan started was 112 (vitest's own figure — an earlier draft said 104, from a grep, and was wrong). Task 2 added 9 tests and Step 1 of this task added 9 more, so `<N>` is somewhere near 130. Read the number the tool prints and use it in the next steps. A plan that hardcodes a count is the defect this task exists to fix.

Confirm both files now carry the same populated block:

```bash
diff CLAUDE.md AGENTS.md && echo IDENTICAL
```

- [ ] **Step 8: Hoist the vitest count in `tools/verify.mjs`**

The counts gate needs the number section 2 already parsed. Replace the section 2 block with:

```js
/* ---------------------------------------------------------- 2. unit tests -- */

// Hoisted: the counts gate below reuses this rather than running the suite a
// second time, which would double the slowest gate in the file.
let unitTests = null;

{
  const r = run('npx', ['vitest', 'run']);
  const m = r.out.match(/Tests\s+(\d+) passed/);
  if (m) unitTests = Number(m[1]);
  record('vitest', r.ok, m ? `${m[1]} passed` : r.ok ? 'passed' : 'see output above');
  if (!r.ok) console.log(r.out.slice(-2000));
}
```

- [ ] **Step 9: Add the gate**

Insert into `tools/verify.mjs` after the section 14 block:

```js
/* --------------------------------------------- 15. the counts are current -- */

/*
 * See tools/counts.mjs for the history. The short version: five copies of one
 * number, in three files, none of which read the test suite.
 *
 * Skipped when vitest did not report a count — a failed test run has already
 * failed the suite, and reporting a stale-counts error on top of it would point
 * the next reader at the wrong problem.
 */
{
  const { computeCounts, renderBlock, replaceBlock, TARGETS } = await import('./counts.mjs');

  if (unitTests === null) {
    console.log('  skip   counts (vitest reported no count)');
  } else {
    const expected = renderBlock(computeCounts({ unitTests }));
    const problems = [];

    for (const rel of TARGETS) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
      if (replaceBlock(text, expected) === null) problems.push(`${rel} has no counts block`);
      else if (!text.includes(expected)) problems.push(`${rel} is stale — run \`npm run counts\``);
    }

    record(
      'counts match the repo',
      problems.length === 0,
      problems.length ? problems.join('; ') : `${unitTests} tests, generated block current`,
    );
  }
}
```

- [ ] **Step 10: Verify the gate fails when it should**

Rewrite whatever unit-test count the block now holds back to the stale `63`, in both twins at once so the twin gate stays green and this gate is the only one that speaks:

```bash
node -e "const fs=require('fs');for(const f of ['CLAUDE.md','AGENTS.md'])fs.writeFileSync(f,fs.readFileSync(f,'utf8').replace(/\*\*\d+ unit tests\*\*/,'**63 unit tests**'))"
node tools/verify.mjs
```

Expected: ` FAIL  counts match the repo — CLAUDE.md is stale — run \`npm run counts\`; AGENTS.md is stale — run \`npm run counts\``.

This is the exact defect the task exists to prevent — `63` against reality — reproduced deliberately.

- [ ] **Step 11: Fix it the documented way and confirm green**

```bash
npm run counts && node tools/verify.mjs
```

Expected: `  ok   counts match the repo — <N> tests, generated block current`, `VERIFY PASSED`.

- [ ] **Step 11a: Renumber the e2e banner**

`tools/verify.mjs:392` labels the Playwright section `9. e2e (opt)` — a pre-existing typo, since section 9 is the CSP gate. With gates 12–15 now sitting above it the duplicate reads as a mistake in this change. Correct the banner to `16. e2e (opt)`.

- [ ] **Step 12: Record the e2e deviation in the spec**

In `docs/superpowers/specs/2026-08-10-guidance-optimization-design.md` §4C, replace the sentence *"The e2e count is asserted only under `--full`, since only then is it known."* with:

```markdown
The e2e count is **excluded**, decided during implementation. Writing it would
mean a full Playwright run on every regeneration — minutes, every time — and a
tool expensive enough to avoid is a tool that gets avoided. An omitted number
costs less than an unused gate.
```

- [ ] **Step 13: Commit**

```bash
git add tools/counts.mjs tools/counts.test.ts tools/verify.mjs package.json CLAUDE.md AGENTS.md docs/superpowers/specs/2026-08-10-guidance-optimization-design.md
git commit -m "$(cat <<'EOF'
feat: generate the canonical counts and gate them against the repo

The docs stated 63 unit tests in five places -- handoff.md three times,
README.md twice -- against an actual 104. improve.md argued "146 tests
exist because each one was worth writing", resting on a dead number. And
handoff.md:249 already carried "72 is correct -- if you see 74 anywhere,
it is stale", which is this project defending against the same failure
with prose, and losing.

There is now one live copy of every volatile number. It is generated
from src/data, the built output and vercel.json, and `npm run verify`
fails when it drifts. The shape deliberately mirrors tools/csp.mjs:
same problem, same ergonomics, nothing novel to learn.

replaceBlock returns null rather than appending when the markers are
missing. Appending would produce a second block on the next run, and the
gate would compare against whichever one the regex reached first -- a
gate that passes while the visible number is wrong.

The e2e count is excluded, and the spec is amended to say so. Writing it
would run the full Playwright suite on every regeneration, and a tool
expensive enough to avoid is a tool that gets avoided.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `docs/TRAPS.md`

The silent-failure catalogue, gathered from `handoff.md` and `improve.md` into one document that can be read without reading either. This must exist before `CLAUDE.md` references it, or gate A fails.

**Files:**
- Create: `docs/TRAPS.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a path `CLAUDE.md` and `improve.md` will reference in Tasks 6 and 7.

- [ ] **Step 1: Write the document**

Create `docs/TRAPS.md` with exactly two sections. Source every entry from the existing text rather than rewriting from memory — the wording in `handoff.md` was arrived at by measurement.

**Section 1, "Fails silently"** — one entry each, each stating the mechanism *and* the consequence:

| Trap | Source |
|---|---|
| Playwright attaches to a dev server on :4321 instead of building | `handoff.md:369` |
| Astro's dev server serves stale scoped CSS after a wholesale component rewrite | `handoff.md:371` |
| Tailwind utilities lose to unlayered Astro scoped styles | `handoff.md:375` |
| The `hidden` attribute can never hold its space (Tailwind 4 preflight, `!important`) | `handoff.md:377` |
| Any island reading a persistent nanostore needs a `mounted`/`ready` gate | `handoff.md:318` |
| `client:visible` islands do not hydrate in a background tab | `handoff.md:454` |
| `astro:assets` cannot take a runtime string path — use the `import.meta.glob` pattern | `handoff.md:320-330` |
| A green axe run is not a claim that a page passes WCAG | `handoff.md:416` |
| A stale CSP hash ships a site that renders and never hydrates | `handoff.md:365` |
| `SUPABASE_SERVICE_ROLE_KEY` and Vite's build-time `import.meta.env` inlining | `tools/verify.mjs` §11 comment |
| `src/lib/env.ts` reads `process.env` first, and the order is the whole point | `src/lib/env.ts` header |
| The middleware's early return is not an optimisation — it runs at build time for all 96 prerendered pages | `src/middleware.ts` header |
| A data-modifying CTE's rows are not visible to the rest of the same statement | `handoff.md:436` |

**Section 2, "Looks like a defect, is not"** — moved verbatim from `.claude/commands/improve.md`, **minus the hero-video GOP entry**, which describes a file deleted in `d6808db`:

- The black panel in `p19-safety-vests.png` and `p19-safety-vests-2.png` — a deliberate DAY | NIGHT reflectivity comparison from brochure page 19. All 72 assets were scanned; only these two, both legitimate. Reported as a regression once already — handoff.md:282 says once, and an earlier draft of this plan said twice.
- The hero copy's top anchoring — the bright mass of the composition begins around y=43% and centred copy put the accent line inside it.
- `image-size-responsive` (Lighthouse Best Practices 96) on product pages — source photography is natively 100–440px and must never be upscaled beyond ~2×.
- The 3 `npm audit` high findings — one chain, no upstream fix, build-time only. **Never run `npm audit fix --force`**; its only offered fix reintroduces 8 XSS advisories.
- `build.inlineStylesheets: 'always'` — considered and rejected: ~41 KB inlined into every page, losing cross-page CSS caching.
- The two empty categories — Spill Control and Electrical Accessories have no products because the brochure has none.
- RLS enabled with zero policies on `enquiries` — Supabase's linter reports `rls_enabled_no_policy` at INFO forever. Do not "fix" it by adding a policy.

Open with one sentence stating the document's job and pointing at `handoff.md` for the reasoning behind any entry.

- [ ] **Step 2: Confirm every path in it resolves**

Gate A will check this file the moment it exists.

Run: `node tools/verify.mjs`

Expected: `  ok   instructional docs name real paths` with a higher reference count than before. If it fails, a path in the new document is wrong — fix the document, not the gate.

- [ ] **Step 3: Confirm the GOP entry did not survive the move**

Run: `grep -rn "GOP" docs/TRAPS.md .claude/commands/improve.md CLAUDE.md`

Expected: no match in `docs/TRAPS.md`. A match in `improve.md` is expected until Task 7.

- [ ] **Step 4: Commit**

```bash
git add docs/TRAPS.md
git commit -m "$(cat <<'EOF'
docs: gather the silent failures into docs/TRAPS.md

These were spread across handoff.md's 41 KB of narrative and
improve.md's "do not fix" list, so reaching them meant reading a history
document interleaved with entries like "Task 7's defects, for the
record". They are now one document that answers one question: what will
bite me, and how will I know.

The "looks like a defect" list moves out of improve.md wholesale.
Nothing about it was loop-specific -- the DAY | NIGHT panel in the two
safety-vest images has been reported as a regression once, and that can
happen in any session.

The hero video's 4-frame GOP entry does not come across. d6808db deleted
the video.

Wording is taken from handoff.md rather than rewritten. Those sentences
were arrived at by measurement and paraphrasing them loses the numbers.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Rewrite `CLAUDE.md` and `AGENTS.md`

**Files:**
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md` (by copy)

**Interfaces:**
- Consumes: `docs/TRAPS.md` from Task 5, the counts block from Task 4.
- Produces: the routing table `improve.md` defers to in Task 7.

- [ ] **Step 1: Fix the four wrong facts**

| Line | Currently | Becomes |
|---|---|---|
| `:5` | "no prices, no cart, no checkout, no accounts" | "no prices, no cart, no checkout, no public accounts" — then one sentence: the site has an authenticated admin at `/admin`, and buyers never sign in. |
| `:8` | `Astro 7 · TypeScript strict · Tailwind 4 · Preact islands · nanostores · Vercel.` | Append `· Supabase Postgres`. |
| `:27-28` | Rule 2 keying off `delivered` | See Step 2. |
| `:73-74` | "the one SSR route (`/api/enquiry`)" | "the server-rendered routes" — the count comes from the generated block, so state no number here. |

- [ ] **Step 2: Rewrite rule 2**

Replace the rule-2 paragraph with:

```markdown
**2. Never report an enquiry as sent when it was not — and never report one as
lost when it was kept.** An enquiry travels two independent channels: it is
written to Postgres, which is the system of record, and an email notification is
sent. Either one is enough for the submission to be a success. The honest signal
is therefore `recorded || delivered`, not `delivered` alone, and `unconfigured`
is not `failed` — a channel with no credentials was never asked to carry
anything. 502 means *every configured channel* failed. `npm run verify` gates
that both clients read `recorded`.
```

- [ ] **Step 3: Add the missing subsystems**

A short `## The admin` section covering, in one or two sentences each:

- `/admin/*` and `/api/admin/*`, guarded by `src/middleware.ts`; sign-in is Supabase auth against an allow-list table.
- The middleware runs for every route **including at build time** for the prerendered pages — its early return is correctness, not speed.
- `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely and must never appear under `src/components`, `src/scripts`, `src/stores` or `src/layouts`. Vite inlines `import.meta.env.*` at build time, so one client-side reference substitutes the literal secret into a shipped bundle with nothing warning. `npm run verify` gates it.
- `src/lib/env.ts` reads `process.env` first and `import.meta.env` second, and the order is the point.

- [ ] **Step 4: Add the routing table**

Replace the `## Read these` list with a table that answers *which file for which question*:

| Question | File |
|---|---|
| What will bite me here? | `docs/TRAPS.md` |
| Why is it like this? | `handoff.md` |
| How do I run it? | `README.md` |
| What should I work on? | `BACKLOG.md` |
| How do I edit the catalogue without being a developer? | `docs/CONTENT-EDITING.md` |

The current instruction to read `handoff.md` "before changing anything you have not touched before" becomes: read `docs/TRAPS.md` before touching an unfamiliar area, and `handoff.md` when you need the reasoning. That is the change that buys back the context.

- [ ] **Step 5: Update the Verify section**

Add `npm run counts` beside `npm run csp`, and note that the four doc gates exist so guidance cannot drift. Keep `**Never weaken a gate to make it pass.**` exactly as it is.

- [ ] **Step 6: Mirror to `AGENTS.md`**

```bash
cp CLAUDE.md AGENTS.md
```

- [ ] **Step 7: Verify**

```bash
npm run verify
```

Expected: all gates ok, including `CLAUDE.md and AGENTS.md agree`, `instructional docs name real paths`, and `counts match the repo`. If the counts gate fails, the block was disturbed by the rewrite — run `npm run counts` and re-verify.

- [ ] **Step 8: Confirm the wrong facts are gone**

```bash
grep -n "no accounts\|the one SSR route\|one server-rendered" CLAUDE.md
```

Expected: no matches.

- [ ] **Step 9: Commit**

```bash
git add CLAUDE.md AGENTS.md
git commit -m "$(cat <<'EOF'
docs: correct CLAUDE.md and route it at the tier that answers the question

Four facts were wrong. "No accounts" predates admin auth. The stack line
omitted the database that is now the system of record. "The one SSR
route" is four. And rule 2 keyed the honest-failure message off
`delivered` alone, so an agent following it would tell a buyer their
enquiry failed while the row sat in Postgres -- inverting the rule the
section exists to protect.

Rule 2 now states the two-channel contract: `recorded || delivered`,
`unconfigured` is not `failed`, and 502 means every *configured* channel
failed. Gate 14 holds it.

The admin subsystem, the service-role key and env.ts's process.env-first
precedence were absent entirely, so an agent rediscovered them or walked
into them.

"Read handoff.md before changing anything you have not touched before"
became a 41 KB tax on every session, most of it history. It is replaced
by a routing table: docs/TRAPS.md for what will bite you, handoff.md for
why it is like this.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Slim `.claude/commands/improve.md` to loop mechanics

**Files:**
- Modify: `.claude/commands/improve.md`

**Interfaces:**
- Consumes: `CLAUDE.md`'s rules from Task 6, `docs/TRAPS.md` from Task 5.

- [ ] **Step 1: Delete what is now stated elsewhere**

Remove: the four rules section (restated from `CLAUDE.md`), the "Do not fix these" section (now `docs/TRAPS.md`), and the "Traps that fail silently" section (now `docs/TRAPS.md`). This is the bulk of the 9.3 KB.

- [ ] **Step 2: Replace them with a pointer**

```markdown
## Before you start

`CLAUDE.md` holds the four rules. They are not negotiable and this command does
not restate them — restating them is how this file came to defend a video that
had been deleted for eleven commits.

`docs/TRAPS.md` holds what fails silently and what only looks like a defect.
Read it before touching an area you have not touched before.
```

- [ ] **Step 3: Keep the loop intact**

Steps 1–9 (orient, choose one item, mark `[~]`, understand, implement, verify, commit, update `BACKLOG.md`, report) and the "When to stop and ask instead" section stay as they are. They are the only genuinely loop-specific content in the file.

- [ ] **Step 4: Remove the dead test count**

`:137` reads "146 tests exist because each one was worth writing". Replace with "every test here was worth writing" — the argument does not need a number, and a number here is a number that goes stale.

- [ ] **Step 5: Verify**

```bash
npm run verify
```

Expected: `instructional docs name real paths` ok. The file is in `INSTRUCTIONAL`, so any path removed along with the deleted sections is now checked in its new home instead.

- [ ] **Step 6: Confirm the size drop and the dead entries**

```bash
wc -c .claude/commands/improve.md
grep -n "GOP\|146" .claude/commands/improve.md
```

Expected: roughly 3.5 KB, down from 9312 bytes. No matches for either.

- [ ] **Step 7: Commit**

```bash
git add .claude/commands/improve.md
git commit -m "$(cat <<'EOF'
docs: reduce /improve to loop mechanics

The command restated CLAUDE.md's four rules, carried its own copy of the
"do not fix" list, and repeated handoff.md's silent-failure catalogue --
roughly 80% of it was a third copy of guidance that lives elsewhere.

That third copy is what drifted. It went on telling agents to preserve
the hero video's 4-frame GOP for eleven commits after d6808db deleted
the video, and it argued from "146 tests exist" when there were 104.

What is left is the part that is genuinely loop-specific: pick one item,
mark it in progress, implement, verify, commit to agent/improvements,
update the backlog, report -- and the conditions for stopping instead.

The test count comes out entirely. The argument for writing tests does
not need a number, and a number here is a number that goes stale.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Correct `handoff.md` and `README.md`

`handoff.md` stays the historical tier and keeps its size. Only its false present-tense claims change.

**Files:**
- Modify: `handoff.md:3-17`, `:158-168`, `:444-456`, plus a new admin section
- Modify: `README.md:41`, `:209`

**Interfaces:**
- Consumes: nothing. This task is last because it is the only one no gate covers.

- [ ] **Step 1: Correct the header**

`handoff.md:3-5` claims `Last updated: 2026-08-05`, `Branch: feat/catalogue-site`, and "All 17 tasks complete and verified. The build is finished." Eleven commits have landed since, on `agent/improvements`. Update the date to `2026-08-10`, the branch to `agent/improvements`, and replace the state line with one that says the catalogue build is complete and the admin subsystem is in progress.

- [ ] **Step 2: Date the status block**

`handoff.md:7-13` is a fenced block of test and build numbers that reads as a live claim. Introduce it with `**As of 2026-08-05:**` so it is unambiguously a snapshot. Do not update the numbers — this is history, and `CLAUDE.md`'s generated block is where the live ones are.

- [ ] **Step 3: Add the admin section**

After §7's "Enquiries are stored, not just emailed", add a section covering what the eleven commits did: server-side auth against an allow-list, the session cookie, `src/middleware.ts` and why its early return is correctness rather than speed, CSV export with a formula-injection guard, and the design doc it realises (`docs/superpowers/specs/2026-08-09-admin-dashboard-design.md`).

- [ ] **Step 4: Correct "what a next session picks up"**

`handoff.md:444-456` still lists the admin dashboard as future work. Phase 1 has shipped. Rewrite item 2 to say what remains of it and leave items 1 and 3 alone.

- [ ] **Step 5: Note the tooling that arrived**

`handoff.md:158-168`'s command list predates `npm run verify`, `npm run csp`, `npm run counts`, `tools/brand-sheet.mjs` and `.github/workflows/verify.yml`. Add them.

- [ ] **Step 6: Remove README's count claims**

`README.md:41` reads `| \`npm run test\` | Vitest unit tests — **63 tests**. |` and `:209` reads `npm run test        # vitest — 63 unit tests`. Both are wrong and neither is gated. Replace the numbers with no number:

- `:41` → `| \`npm run test\` | Vitest unit tests. |`
- `:209` → `npm run test        # vitest unit tests`

The live count lives in `CLAUDE.md`'s generated block and nowhere else.

- [ ] **Step 7: Confirm no stale 63 survives**

```bash
grep -rn "63 tests\|63 unit\|63 passed\|63 passing" README.md CLAUDE.md AGENTS.md docs/TRAPS.md .claude/commands/improve.md
```

Expected: no matches. Matches inside `handoff.md` are correct — that file is dated history now.

- [ ] **Step 8: Full verification**

Stop the dev server first — Playwright attaches to whatever is on :4321 instead of building.

```bash
npm run verify -- --full
```

Expected: `VERIFY PASSED`, all gates including the four new ones, and the Playwright suite green.

- [ ] **Step 9: Commit**

```bash
git add handoff.md README.md
git commit -m "$(cat <<'EOF'
docs: bring handoff.md and README's counts up to date

handoff.md's header claimed the branch was feat/catalogue-site, the date
was 2026-08-05, and the build was finished. Eleven commits had landed on
agent/improvements since, adding an entire admin subsystem, and §7 still
listed the admin dashboard as work a next session would pick up.

The status block is now explicitly dated rather than updated. It is a
snapshot of what was true when it was written, and CLAUDE.md's generated
block is where the live numbers are.

README's two "63 tests" claims lose their numbers entirely rather than
gaining correct ones. There is one live count in this repository now and
a second copy is a second thing to go stale.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Done

- `npm run verify` passes with 14 gates, four of them new — 15 under `--full`, which adds Playwright. (Ten `record()` calls exist today; the domain placeholder is an advisory note and does not count.)
- Exactly one live copy of every volatile count, generated, gated.
- Routine guidance reading down from ~54 KB to ~16 KB.
- The four wrong facts in `CLAUDE.md` corrected, rule 2 gated in code.
- No gate weakened, and one spec deviation (the e2e count) recorded with its reason.
