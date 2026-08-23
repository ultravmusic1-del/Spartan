/**
 * `astro dev` pointed at the throwaway database instead of the client's.
 *
 * WHY THIS EXISTS, AND WHY `npm run dev` IS NOT THE ANSWER FOR THE ADMIN.
 *
 * `.env` holds the LIVE project's credentials, and `astro dev` loads `.env` into
 * Vite's env, which `src/lib/env.ts` reads as its fallback. So a plain
 * `npm run dev` session on /admin/catalogue is editing the real catalogue — and
 * `VERCEL_DEPLOY_HOOK_URL` is set in there too, so the Publish button on that
 * screen deploys the production site. Neither of those asks for confirmation,
 * because in production both are exactly what an admin means.
 *
 * There is nothing wrong with `npm run dev` for the public site, and this does
 * not replace it. It exists so that "try the admin locally" has an answer that
 * is one command rather than five exports someone has to get right every time.
 *
 * `process.env` WINS OVER `import.meta.env` — that ordering is decided in
 * src/lib/env.ts and this depends on it. The variables below are set on the
 * child process, so they take precedence over the same names in `.env` without
 * touching that file. Three of them are deliberately set to EMPTY:
 *
 *   VERCEL_DEPLOY_HOOK_URL  Publish must refuse rather than deploy. This is the
 *                           one that would be expensive to get wrong.
 *   RESEND_API_KEY          A test enquiry must not reach the client's inbox.
 *   ENQUIRY_TO_EMAIL        Same.
 *
 * Empty rather than absent, because `configured()` asks whether the value is a
 * non-empty string and an absent one would fall through to `.env` again.
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { start, STACK_FILE, TEST_ADMIN } from './test-db.mjs';

/*
 * Started here rather than left as a step to remember. `start` is idempotent —
 * `supabase start` on a running stack keeps its data and the seed is a
 * conflict-do-update rewrite — so this costs a second on the second run and two
 * minutes on the first. Making the safe command the easy command is the point;
 * a safe path with a prerequisite is a path people skip.
 */
if (!existsSync(STACK_FILE)) {
  console.log('Test database is not up. Starting it — this takes a minute the first time.\n');
}
await start();

const stack = JSON.parse(readFileSync(STACK_FILE, 'utf8'));

const env = {
  ...process.env,
  SUPABASE_URL: stack.url,
  SUPABASE_ANON_KEY: stack.anonKey,
  SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey,
  // So the public pages render from the same throwaway database the admin
  // edits, and an edit is visible on the site after a restart rather than
  // seeming to have done nothing.
  CATALOGUE_SOURCE: 'postgres',
  VERCEL_DEPLOY_HOOK_URL: '',
  RESEND_API_KEY: '',
  ENQUIRY_TO_EMAIL: '',
};

console.log(`
──────────────────────────────────────────────────────────────────────
  Admin, against the THROWAWAY database. Nothing here touches the
  client's catalogue, and Publish will refuse rather than deploy.

  Sign in    http://localhost:4321/admin/login
  Email      ${TEST_ADMIN.email}
  Password   ${TEST_ADMIN.password}
  Catalogue  http://localhost:4321/admin/catalogue

  Edits go to the local Postgres and are thrown away by
  \`npm run test:db:stop\`. \`npm run test:db:start\` reseeds the
  catalogue back to src/data/*.json at any time.
──────────────────────────────────────────────────────────────────────
`);

const child = spawn('npx', ['astro', 'dev'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env,
});

// The stack is deliberately LEFT RUNNING on exit. Stopping it here would throw
// away the edits someone was in the middle of looking at, and would make a
// restart cost another cold boot. `npm run test:db:stop` is the off switch.
child.on('exit', (code) => process.exit(code ?? 0));
