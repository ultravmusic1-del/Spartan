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
