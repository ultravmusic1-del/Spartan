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

/**
 * The files this gate applies to. handoff.md is deliberately absent.
 *
 * README.md was absent too until 2026-08-11, and that omission cost exactly
 * what this file was written to prevent: its hero section went on describing
 * `hero-range-desktop.png` as the live hero across two rewrites, with the
 * component pointed at a different file the whole time. README.md is the door
 * CLAUDE.md sends you through for "how do I run it?" — it is instructional by
 * any reading, and it names more repo paths than the rest of this list
 * combined.
 *
 * Admitting it cost one rewording, and the trade is worth stating. README's
 * launch checklist explains that `public/robots.txt` used to hard-code the
 * domain and is now gone — a true sentence about a path that must not resolve,
 * which is precisely the case handoff.md is exempt for. It was reworded to name
 * the dead file by role rather than as a code path. That is not the record
 * being bent to stay green: an instructional document formatting a deleted file
 * as a live repo path is telling a reader to go and open it. Where a sentence
 * genuinely needs to point at something that no longer exists, it belongs in
 * handoff.md, which is why the exemption is a file and not a syntax.
 */
export const INSTRUCTIONAL = [
  'CLAUDE.md',
  'AGENTS.md',
  'README.md',
  'docs/TRAPS.md',
  '.claude/commands/improve.md',
];

/** A token starting with one of these is a repo path worth checking. */
const DIRS = new Set(['src', 'tools', 'tests', 'docs', 'public', 'design', '.github', '.claude']);

/** Bare filenames that are real paths despite having no directory. */
const ROOT_FILES = new Set([
  'package.json', 'package-lock.json', 'vercel.json', 'astro.config.mjs',
  'tsconfig.json', 'vitest.config.ts', 'playwright.config.ts',
  'README.md', 'CLAUDE.md', 'AGENTS.md', 'handoff.md', 'BACKLOG.md', '.env.example',
]);

/*
 * Generated paths. These are legitimate references whose existence depends on
 * whether something has run, so checking them would make the gate's result
 * depend on the order — or the credentials — the caller happened to have.
 *
 * `src/assets/banners/` is the one that is not build output and is easy to miss.
 * `tools/fetch-banners.mjs` downloads the enabled hero banners into it before
 * `astro build`, and it is gitignored, so it is absent from a fresh clone and
 * from any run without Supabase credentials. It cost a red CI run on 2026-08-27
 * while every local run was green, because a developer who had built once had
 * the directory and CI never did. Adding the fetch to `verify` would have made
 * the public site's gate depend on Supabase being reachable, which is the exact
 * coupling `src/middleware.ts` has an early return to avoid.
 */
const IGNORED = ['dist/', '.vercel/', 'node_modules/', 'src/assets/banners/'];

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
