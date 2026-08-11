# Admin Phase 1 — Auth and the Enquiry Inbox — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An invite-only admin area at `/admin` where the operator signs in and works the enquiries already being captured in Postgres — list, detail, status workflow, product-demand report, CSV export.

**Architecture:** SSR routes in the existing Astro app. **No browser-to-Supabase traffic:** login POSTs to a server endpoint that calls `signInWithPassword` and sets an HttpOnly cookie; all data is read server-side with the service-role key. `public.enquiries` keeps RLS with zero policies. Authorisation is session cookie → membership of `public.admins` → service-key query.

**Tech Stack:** Astro 7 SSR routes, `@supabase/ssr` (auth only, anon key), `@supabase/supabase-js` (data, service key), Astro middleware, Vitest, Playwright.

**Design doc:** `docs/superpowers/specs/2026-08-09-admin-dashboard-design.md`

---

## Rules for this phase

1. **No inline `<script>` on any admin page.** `npm run csp` derives hashes from `dist/client`; SSR pages are never there, so an inline script ships unhashed, is blocked at runtime, and no gate catches it. Use Astro `<script>` tags (which bundle to external `/_astro/*.js`, allowed by `script-src 'self'`) or no script at all.
2. **Nothing the public site renders may change.** The 11 verify gates and the 97-page count must be untouched at the end of every task.
3. **Never widen the CSP.** If something needs a new source, stop and raise it.
4. **`npm run verify` must pass before every commit.**

## File structure

| Path | Responsibility |
|---|---|
| `src/lib/admin/cookies.ts` | Parse a `Cookie` header into name/value pairs. Pure. |
| `src/lib/admin/csv.ts` | Serialise rows to RFC 4180 CSV, neutralising formula injection. Pure. |
| `src/lib/admin/auth.ts` | Supabase auth client bound to Astro cookies; `currentAdmin()`. |
| `src/lib/admin/enquiries.ts` | All enquiry reads/writes with the service key. The admin's data seam. |
| `src/middleware.ts` | Guards `/admin/*` and `/api/admin/*`. No-ops everywhere else. |
| `src/layouts/AdminLayout.astro` | Chrome, `noindex`, nav, sign-out. |
| `src/pages/admin/login.astro` | Sign-in form. |
| `src/pages/admin/index.astro` | Enquiry list. |
| `src/pages/admin/enquiries/[id].astro` | Enquiry detail + status control. |
| `src/pages/admin/demand.astro` | Product-demand report. |
| `src/pages/api/admin/login.ts` | POST credentials → cookie. |
| `src/pages/api/admin/logout.ts` | POST → clear cookie. |
| `src/pages/api/admin/enquiries/[id].ts` | POST status change. |
| `src/pages/api/admin/export.csv.ts` | GET CSV of all enquiries. |
| `src/env.d.ts` | Types `App.Locals.admin`. |

---

### Task 1: The `admins` table

**Files:**
- Migration applied via the Supabase MCP `apply_migration` tool (project `wslylysakixrirxkozih`, name `create_admins`)
- Modify: `.env.example`

- [ ] **Step 1: Apply the migration**

```sql
-- Who may use the admin area. Membership here is the authority check; the
-- session cookie only proves identity. Kept separate from auth.users so that
-- having an account and being an admin are different facts — there is no
-- public signup, but that must stay true by design rather than by luck.
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Allow-list for /admin. Written by hand; never by the application.';

-- Zero policies, exactly as public.enquiries. Only the service-role key reads
-- this, and it does so from a serverless function that has already verified a
-- session. anon and authenticated get nothing.
alter table public.admins enable row level security;
```

- [ ] **Step 2: Verify RLS and that the table is empty**

Run via `execute_sql`:

```sql
select
  (select count(*) from public.admins) as rows,
  (select relrowsecurity from pg_class where oid = 'public.admins'::regclass) as rls_on,
  (select count(*) from pg_policies where tablename = 'admins') as policy_count;
```

Expected: `rows=0, rls_on=true, policy_count=0`

- [ ] **Step 3: Add the anon key to `.env.example`**

Append to the database section of `.env.example`:

```
# Anon/publishable key. Used ONLY for signInWithPassword on the admin login —
# never for data. Data always goes through the service-role key above.
#
# This one is safe to expose in principle, but nothing in this app sends it to
# the browser: auth happens server-side and the session lives in an HttpOnly
# cookie, so the browser never talks to Supabase at all.
SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "feat(admin): add the admins allow-list table"
```

---

### Task 2: CSV serialisation

CSV is where an export quietly corrupts data. A `message` field contains commas, quotes and newlines by construction, and a value beginning `=`, `+`, `-` or `@` is executed as a formula when the file is opened in Excel or Sheets.

**Files:**
- Create: `src/lib/admin/csv.ts`
- Test: `src/lib/admin/csv.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header row from the column list', () => {
    expect(toCsv([{ a: '1', b: '2' }], ['a', 'b'])).toBe('a,b\r\n1,2');
  });

  it('quotes fields containing a comma, a quote or a newline', () => {
    const rows = [{ v: 'a,b' }, { v: 'say "hi"' }, { v: 'line1\nline2' }];
    expect(toCsv(rows, ['v'])).toBe('v\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(toCsv([{ v: null }, { v: undefined }], ['v'])).toBe('v\r\n\r\n');
  });

  /*
   * A buyer's message starting with `=` is data, but Excel and Sheets treat a
   * leading =, +, - or @ as a formula. Prefixing with a single quote is the
   * standard neutralisation and is stripped by the spreadsheet on display.
   */
  it('neutralises formula injection without losing the character', () => {
    expect(toCsv([{ v: '=1+1' }], ['v'])).toBe("v\r\n\"'=1+1\"");
    expect(toCsv([{ v: '@SUM(A1)' }], ['v'])).toBe("v\r\n\"'@SUM(A1)\"");
    expect(toCsv([{ v: '-5' }], ['v'])).toBe("v\r\n\"'-5\"");
  });

  it('leaves an ordinary value untouched', () => {
    expect(toCsv([{ v: 'Gulf Contracting' }], ['v'])).toBe('v\r\nGulf Contracting');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/admin/csv.test.ts`
Expected: FAIL — `Failed to resolve import "./csv"`

- [ ] **Step 3: Implement**

```ts
/**
 * RFC 4180 CSV, with one deliberate departure.
 *
 * A field beginning `=`, `+`, `-` or `@` is executed as a formula by Excel and
 * Google Sheets. Enquiry messages are attacker-supplied free text, so exporting
 * them verbatim hands whoever opens the file a script written by a stranger.
 * Prefixing with a single quote is the standard neutralisation; spreadsheets
 * strip it on display, so nothing is lost to a human reader.
 */
const RISKY = /^[=+\-@]/;

function field(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const safe = RISKY.test(raw) ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) || safe !== raw ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: readonly T[],
  columns: readonly (keyof T & string)[],
): string {
  const lines = [columns.join(','), ...rows.map((r) => columns.map((c) => field(r[c])).join(','))];
  return lines.join('\r\n');
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/admin/csv.test.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/csv.ts src/lib/admin/csv.test.ts
git commit -m "feat(admin): add CSV serialisation with formula-injection guard"
```

---

### Task 3: Cookie header parsing

`@supabase/ssr` needs to read every cookie on the request. Astro's `AstroCookies` has no `getAll`, so this parses the raw header. Kept separate and pure because a cookie parser is exactly the kind of thing that looks obviously right and is not.

**Files:**
- Create: `src/lib/admin/cookies.ts`
- Test: `src/lib/admin/cookies.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseCookies } from './cookies';

describe('parseCookies', () => {
  it('returns nothing for an empty header', () => {
    expect(parseCookies('')).toEqual([]);
  });

  it('parses one pair', () => {
    expect(parseCookies('a=1')).toEqual([{ name: 'a', value: '1' }]);
  });

  it('parses several and trims the separator whitespace', () => {
    expect(parseCookies('a=1; b=2;c=3')).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
      { name: 'c', value: '3' },
    ]);
  });

  /* Supabase session cookies are base64 and can contain '='. Splitting on every
     '=' rather than the first would truncate the token and silently sign the
     admin out. */
  it('keeps an = inside the value', () => {
    expect(parseCookies('sb=eyJhbGc=')).toEqual([{ name: 'sb', value: 'eyJhbGc=' }]);
  });

  it('decodes percent-encoding', () => {
    expect(parseCookies('a=one%20two')).toEqual([{ name: 'a', value: 'one two' }]);
  });

  it('skips a malformed segment rather than throwing', () => {
    expect(parseCookies('a=1; garbage; b=2')).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/admin/cookies.test.ts`
Expected: FAIL — cannot resolve `./cookies`

- [ ] **Step 3: Implement**

```ts
/**
 * Parse a `Cookie` request header.
 *
 * Astro's `AstroCookies` exposes `get`/`set` but no `getAll`, and `@supabase/ssr`
 * needs every cookie on the request to reassemble a chunked session token.
 *
 * Split on the FIRST `=` only: Supabase session cookies are base64 and routinely
 * end in padding, and splitting on every `=` truncates the token — which
 * presents as an admin being randomly signed out rather than as a parse bug.
 */
export function parseCookies(header: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];

  for (const part of header.split(';')) {
    const segment = part.trim();
    if (!segment) continue;

    const eq = segment.indexOf('=');
    if (eq < 1) continue; // no '=', or a nameless cookie — neither is usable

    const name = segment.slice(0, eq);
    const raw = segment.slice(eq + 1);

    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // A stray '%' makes decodeURIComponent throw. The raw value is still the
      // best answer available and is what the browser sent.
    }
    out.push({ name, value });
  }

  return out;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/admin/cookies.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/cookies.ts src/lib/admin/cookies.test.ts
git commit -m "feat(admin): add cookie header parsing"
```

---

### Task 4: The auth client and `currentAdmin()`

**Files:**
- Create: `src/lib/admin/auth.ts`
- Modify: `package.json` (add `@supabase/ssr`)

- [ ] **Step 1: Install the dependency**

```bash
npm install @supabase/ssr --save
```

- [ ] **Step 2: Write `src/lib/admin/auth.ts`**

```ts
/**
 * Admin authentication.
 *
 * Identity and authority are separate facts and are established separately:
 *
 *   1. The session cookie proves WHO the request is (Supabase Auth, anon key).
 *   2. Membership of public.admins proves they MAY be here (service-role key).
 *
 * A valid Supabase account is therefore not enough. Public signup is disabled in
 * the dashboard, but this check is what makes that a belt rather than the only
 * thing holding the trousers up.
 *
 * The browser never talks to Supabase. Sign-in happens in an endpoint, the
 * session lives in an HttpOnly cookie, and every data read runs server-side —
 * which is why `connect-src` in the CSP needs no Supabase origin.
 */
import { createServerClient } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { env, configured } from '../env';
import { parseCookies } from './cookies';

const URL_KEY = 'SUPABASE_URL';
const ANON_KEY = 'SUPABASE_ANON_KEY';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

export const authConfigured = (): boolean => configured(URL_KEY, ANON_KEY, SERVICE_KEY);

export interface Admin {
  userId: string;
  email: string;
}

/**
 * A Supabase client bound to this request's cookies. Reads them from the raw
 * header (Astro has no `getAll`) and writes them back through AstroCookies, so
 * a refreshed token is persisted on the response.
 */
export function authClient(request: Request, cookies: AstroCookies) {
  return createServerClient(env(URL_KEY), env(ANON_KEY), {
    cookies: {
      getAll: () => parseCookies(request.headers.get('cookie') ?? ''),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookies.set(name, value, {
            ...options,
            // Not negotiable regardless of what Supabase suggests: the token is
            // never read by client script, and a lax same-site cookie on an
            // admin session is a CSRF foothold.
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
          });
        }
      },
    },
  });
}

/**
 * The admin making this request, or null.
 *
 * `getUser()` rather than `getSession()`: getSession trusts the cookie's own
 * contents, which the browser controls. getUser verifies the token with the auth
 * server. For a route that decides whether to hand over every enquiry the site
 * has ever taken, the round trip is worth it.
 */
export async function currentAdmin(request: Request, cookies: AstroCookies): Promise<Admin | null> {
  if (!authConfigured()) return null;

  try {
    const { data, error } = await authClient(request, cookies).auth.getUser();
    if (error || !data.user) return null;

    const { createClient } = await import('@supabase/supabase-js');
    const service = createClient(env(URL_KEY), env(SERVICE_KEY), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: row, error: lookupError } = await service
      .from('admins')
      .select('user_id, email')
      .eq('user_id', data.user.id)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);
    if (!row) return null; // authenticated, but not an admin

    return { userId: row.user_id as string, email: row.email as string };
  } catch (cause) {
    // Never fall open. An error here means we could not establish authority, and
    // "could not establish" must read the same as "does not have".
    console.error('[admin] auth check failed', cause);
    return null;
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npx astro check`
Expected: `0 errors`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/admin/auth.ts
git commit -m "feat(admin): add server-side auth with an admins allow-list check"
```

---

### Task 5: The middleware guard

**Files:**
- Create: `src/middleware.ts`
- Create: `src/env.d.ts` (does not exist yet — this project has been running on Astro's generated types alone)

- [ ] **Step 1: Type `App.Locals`**

Create `src/env.d.ts`:

```ts
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /**
     * Set by src/middleware.ts for any guarded /admin route, and therefore
     * present on every admin page. Optional in the type because middleware does
     * not run before a prerendered public page.
     */
    admin?: import('./lib/admin/auth').Admin;
  }
}
```

- [ ] **Step 2: Write the middleware**

```ts
/**
 * The admin guard.
 *
 * TWO THINGS THAT WILL BITE IF FORGOTTEN
 *
 * 1. This runs for EVERY route, including the 96 prerendered pages — and for
 *    those it runs at BUILD time, where there is no meaningful request. The
 *    early return is therefore not an optimisation; without it the build does 96
 *    pointless auth round trips and the public site's build depends on Supabase
 *    being reachable.
 *
 * 2. `/api/admin/*` needs guarding as much as `/admin/*`. Protecting only the
 *    pages leaves every endpoint they call wide open, which is the more valuable
 *    target — the pages just render what the endpoints hand over.
 */
import { defineMiddleware } from 'astro:middleware';
import { currentAdmin } from './lib/admin/auth';

/** Reachable without a session, because they are how you get one. */
const OPEN = new Set(['/admin/login', '/api/admin/login']);

function guarded(pathname: string): boolean {
  const path = pathname.replace(/\/$/, '') || '/';
  if (OPEN.has(path)) return false;
  return path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!guarded(context.url.pathname)) return next();

  const admin = await currentAdmin(context.request, context.cookies);

  if (!admin) {
    // An endpoint gets a status it can act on; a page gets sent to the login
    // form. Redirecting a fetch() would hand the caller an HTML login page with
    // a 200 on it, which reads as success.
    if (context.url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ ok: false, message: 'Not authorised.' }), {
        status: 401,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    return context.redirect('/admin/login', 302);
  }

  context.locals.admin = admin;
  return next();
});
```

- [ ] **Step 3: Confirm the public build is untouched**

Run: `npm run verify`
Expected: `VERIFY PASSED — 11/11 gates`, `astro build — clean`, 97 pages.

If the page count moved, the middleware is running somewhere it should not.

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts src/env.d.ts
git commit -m "feat(admin): guard /admin and /api/admin with session middleware"
```

---

### Task 6: Login page and auth endpoints

**Files:**
- Create: `src/layouts/AdminLayout.astro`, `src/pages/admin/login.astro`, `src/pages/api/admin/login.ts`, `src/pages/api/admin/logout.ts`

- [ ] **Step 1: Write `src/layouts/AdminLayout.astro`**

```astro
---
/**
 * Admin chrome.
 *
 * Deliberately NOT BaseLayout: that emits canonical, Open Graph and JSON-LD
 * through Seo.astro, all of which describe a public document. It also keeps the
 * admin off the public site's CSS and JS budget entirely.
 *
 * NO INLINE SCRIPTS ON ANY ADMIN PAGE. `npm run csp` derives its hashes from
 * dist/client, and these routes are server-rendered so they are never in it — an
 * inline script here would ship unhashed and be blocked at runtime with nothing
 * failing the build. Use an Astro <script> tag (bundled to an external file,
 * which `script-src 'self'` allows) or no script at all.
 */
interface Props {
  title: string;
  admin?: { email: string };
}
const { title, admin } = Astro.props;
---

<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>{title} — Spartan admin</title>
    <link rel="icon" href="/favicon.svg" />
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    {
      admin && (
        <header class="ad-head">
          <nav aria-label="Admin">
            <a href="/admin">Enquiries</a>
            <a href="/admin/demand">Demand</a>
          </nav>
          <form method="post" action="/api/admin/logout">
            <span>{admin.email}</span>
            <button type="submit">Sign out</button>
          </form>
        </header>
      )
    }
    <main id="main"><slot /></main>
  </body>
</html>

<style>
  :root {
    color-scheme: dark;
  }
  body {
    margin: 0;
    background: #08080a;
    color: #f6f6f7;
    font-family: system-ui, sans-serif;
  }
  .skip {
    position: absolute;
    left: -9999px;
  }
  .skip:focus {
    left: 8px;
    top: 8px;
    padding: 8px;
    background: #dd1e1c;
    color: #fff;
  }
  .ad-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 12px 24px;
    border-bottom: 1px solid #232329;
  }
  .ad-head nav a {
    margin-right: 16px;
    color: #b4b4bc;
  }
  main {
    padding: 24px;
  }
  button {
    min-height: 44px;
    padding: 0 16px;
    background: #dd1e1c;
    color: #fff;
    border: 0;
    cursor: pointer;
  }
</style>
```

- [ ] **Step 2: Write `src/pages/api/admin/login.ts`**

```ts
/**
 * Sign in. The ONLY place credentials are handled, and they never reach the
 * browser's JavaScript: this is a plain form POST, the session comes back as an
 * HttpOnly cookie, and no Supabase call is ever made from the page.
 */
import type { APIRoute } from 'astro';
import { authClient, authConfigured } from '../../../lib/admin/auth';

export const prerender = false;

const back = (redirect: (path: string, status: 302) => Response, message: string) =>
  redirect(`/admin/login?error=${encodeURIComponent(message)}`, 302);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!authConfigured()) return back(redirect, 'Admin sign-in is not configured on this deployment.');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!email || !password) return back(redirect, 'Enter your email address and password.');

  const { error } = await authClient(request, cookies).auth.signInWithPassword({ email, password });

  // One message for a wrong address and a wrong password alike. Distinguishing
  // them tells an attacker which admin addresses exist.
  if (error) return back(redirect, 'Those credentials were not accepted.');

  return redirect('/admin', 302);
};
```

- [ ] **Step 3: Write `src/pages/api/admin/logout.ts`**

```ts
import type { APIRoute } from 'astro';
import { authClient, authConfigured } from '../../../lib/admin/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (authConfigured()) await authClient(request, cookies).auth.signOut();
  return redirect('/admin/login', 302);
};
```

- [ ] **Step 4: Write `src/pages/admin/login.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { currentAdmin } from '../../lib/admin/auth';

export const prerender = false;

// Already signed in? Nothing to do here.
if (await currentAdmin(Astro.request, Astro.cookies)) return Astro.redirect('/admin', 302);

const error = Astro.url.searchParams.get('error');
---

<AdminLayout title="Sign in">
  <h1>Spartan admin</h1>

  {error && <p role="alert" class="err">{error}</p>}

  <form method="post" action="/api/admin/login">
    <label for="email">Email address</label>
    <input id="email" name="email" type="email" autocomplete="username" required />

    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required />

    <button type="submit">Sign in</button>
  </form>

  <p class="note">Accounts are created by hand in Supabase. There is no signup.</p>
</AdminLayout>

<style>
  form {
    display: grid;
    gap: 8px;
    max-width: 320px;
  }
  input {
    min-height: 44px;
    padding: 0 12px;
    background: #151519;
    border: 1px solid #232329;
    color: #fff;
  }
  .err {
    max-width: 320px;
    padding: 12px;
    border-left: 3px solid #ef3a38;
    background: #151519;
  }
  .note {
    margin-top: 24px;
    color: #8a8a92;
    font-size: 13px;
  }
</style>
```

- [ ] **Step 5: Create the admin user (OPERATOR ACTION — not Claude)**

In the Supabase dashboard for project `spartan`:
1. Authentication → Providers → Email → turn **"Enable sign-ups" OFF**.
2. Authentication → Users → **Add user** → set an email and password.
3. Run, substituting the real values:

```sql
insert into public.admins (user_id, email)
select id, email from auth.users where email = 'YOUR_EMAIL_HERE';
```

- [ ] **Step 6: Verify and commit**

Run: `npm run verify`
Expected: `VERIFY PASSED — 11/11 gates`

```bash
git add src/layouts/AdminLayout.astro src/pages/admin/login.astro src/pages/api/admin/
git commit -m "feat(admin): add sign-in, sign-out and the admin layout"
```

---

### Task 7: The enquiry repository

**Files:**
- Create: `src/lib/admin/enquiries.ts`
- Test: `src/lib/admin/enquiries.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { listEnquiries, getEnquiry, setStatus, ENQUIRY_STATUSES, isEnquiryStatus } from './enquiries';

afterEach(() => vi.unstubAllEnvs());

function unconfigured(): void {
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
}

describe('enquiry status', () => {
  it('is the same four values the CHECK constraint allows', () => {
    expect(ENQUIRY_STATUSES).toEqual(['new', 'contacted', 'quoted', 'closed']);
  });

  it('rejects anything else', () => {
    expect(isEnquiryStatus('new')).toBe(true);
    expect(isEnquiryStatus('archived')).toBe(false);
    expect(isEnquiryStatus('')).toBe(false);
  });
});

/* Unconfigured must degrade the same way the write path does: empty results and
   a false, never a throw that would 500 the admin area on a machine with no
   secrets. */
describe('without credentials', () => {
  it('lists nothing rather than throwing', async () => {
    unconfigured();
    await expect(listEnquiries()).resolves.toEqual([]);
  });

  it('returns null for a single enquiry', async () => {
    unconfigured();
    await expect(getEnquiry('00000000-0000-0000-0000-000000000000')).resolves.toBeNull();
  });

  it('reports a status change as unsuccessful', async () => {
    unconfigured();
    await expect(setStatus('00000000-0000-0000-0000-000000000000', 'closed')).resolves.toBe(false);
  });

  it('makes no network call', async () => {
    unconfigured();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await listEnquiries();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run src/lib/admin/enquiries.test.ts`
Expected: FAIL — cannot resolve `./enquiries`

- [ ] **Step 3: Implement**

```ts
/**
 * Every admin read and write of enquiry data. The admin's equivalent of
 * src/lib/catalog.ts: pages call this and never Supabase directly, so the
 * queries stay in one auditable place.
 *
 * Uses the service-role key, which bypasses RLS. That is safe only because every
 * caller sits behind the middleware guard — if a route ever calls into here
 * without that guard, it has handed out every enquiry the site has taken.
 */
import { env, configured } from '../env';
import type { EnquiryItemPayload } from '../enquiry-schema';

const URL_KEY = 'SUPABASE_URL';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** Mirrors the CHECK constraint on public.enquiries.status. */
export const ENQUIRY_STATUSES = ['new', 'contacted', 'quoted', 'closed'] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export function isEnquiryStatus(value: string): value is EnquiryStatus {
  return (ENQUIRY_STATUSES as readonly string[]).includes(value);
}

export interface EnquiryRow {
  id: string;
  created_at: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  division: string;
  message: string;
  items: EnquiryItemPayload[];
  source: string;
  status: EnquiryStatus;
  notified_at: string | null;
}

export interface DemandRow {
  product_slug: string;
  product_name: string;
  enquiries: number;
  units: number;
}

const ready = (): boolean => configured(URL_KEY, SERVICE_KEY);

async function client() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env(URL_KEY), env(SERVICE_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listEnquiries(status?: EnquiryStatus): Promise<EnquiryRow[]> {
  if (!ready()) return [];
  try {
    const supabase = await client();
    let query = supabase.from('enquiries').select('*').order('created_at', { ascending: false });
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as EnquiryRow[];
  } catch (cause) {
    console.error('[admin] listEnquiries failed', cause);
    return [];
  }
}

export async function getEnquiry(id: string): Promise<EnquiryRow | null> {
  if (!ready()) return null;
  try {
    const supabase = await client();
    const { data, error } = await supabase.from('enquiries').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as EnquiryRow) ?? null;
  } catch (cause) {
    console.error('[admin] getEnquiry failed', cause);
    return null;
  }
}

export async function setStatus(id: string, status: EnquiryStatus): Promise<boolean> {
  if (!ready()) return false;
  try {
    const supabase = await client();
    const { error } = await supabase.from('enquiries').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
    return true;
  } catch (cause) {
    console.error('[admin] setStatus failed', cause);
    return false;
  }
}

/**
 * Which products are actually being asked about — the question a catalogue
 * lead-generation site exists to answer. Reads the enquiry_lines view, which
 * unnests items, so this is a plain aggregate rather than jsonb gymnastics.
 */
export async function getDemand(): Promise<DemandRow[]> {
  if (!ready()) return [];
  try {
    const supabase = await client();
    const { data, error } = await supabase
      .from('enquiry_lines')
      .select('product_slug, product_name, qty, enquiry_id');
    if (error) throw new Error(error.message);

    const byProduct = new Map<string, DemandRow & { ids: Set<string> }>();
    for (const line of (data ?? []) as {
      product_slug: string;
      product_name: string;
      qty: number;
      enquiry_id: string;
    }[]) {
      const row = byProduct.get(line.product_slug) ?? {
        product_slug: line.product_slug,
        product_name: line.product_name,
        enquiries: 0,
        units: 0,
        ids: new Set<string>(),
      };
      row.ids.add(line.enquiry_id);
      row.units += line.qty;
      byProduct.set(line.product_slug, row);
    }

    return [...byProduct.values()]
      .map(({ ids, ...row }) => ({ ...row, enquiries: ids.size }))
      .sort((a, b) => b.enquiries - a.enquiries || b.units - a.units);
  } catch (cause) {
    console.error('[admin] getDemand failed', cause);
    return [];
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/lib/admin/enquiries.test.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/enquiries.ts src/lib/admin/enquiries.test.ts
git commit -m "feat(admin): add the enquiry repository"
```

---

### Task 8: Enquiry list, detail and status change

**Files:**
- Create: `src/pages/admin/index.astro`, `src/pages/admin/enquiries/[id].astro`, `src/pages/api/admin/enquiries/[id].ts`

- [ ] **Step 1: Write `src/pages/api/admin/enquiries/[id].ts`**

```ts
/**
 * Change an enquiry's status. A form POST, not a fetch: the admin pages carry no
 * client-side JavaScript, which is what keeps them clear of the inline-script
 * CSP trap described in AdminLayout.astro.
 */
import type { APIRoute } from 'astro';
import { setStatus, isEnquiryStatus } from '../../../../lib/admin/enquiries';

export const prerender = false;

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const id = params.id ?? '';
  const form = await request.formData();
  const status = String(form.get('status') ?? '');

  // The middleware has already established this is an admin. This check is about
  // the value, which is still just a string off the wire.
  if (!id || !isEnquiryStatus(status)) return redirect('/admin?error=bad-request', 302);

  const ok = await setStatus(id, status);
  return redirect(ok ? `/admin/enquiries/${id}` : `/admin/enquiries/${id}?error=save-failed`, 302);
};
```

- [ ] **Step 2: Write `src/pages/admin/index.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { listEnquiries, isEnquiryStatus, ENQUIRY_STATUSES } from '../../lib/admin/enquiries';

export const prerender = false;

const admin = Astro.locals.admin!;
const filter = Astro.url.searchParams.get('status') ?? '';
const enquiries = await listEnquiries(isEnquiryStatus(filter) ? filter : undefined);
---

<AdminLayout title="Enquiries" admin={admin}>
  <h1>Enquiries</h1>

  <nav class="filters" aria-label="Filter by status">
    <a href="/admin" aria-current={filter === '' ? 'page' : undefined}>All</a>
    {
      ENQUIRY_STATUSES.map((s) => (
        <a href={`/admin?status=${s}`} aria-current={filter === s ? 'page' : undefined}>
          {s}
        </a>
      ))
    }
    <a class="export" href="/api/admin/export.csv">Export CSV</a>
  </nav>

  {
    enquiries.length === 0 ? (
      <p>No enquiries{filter ? ` with status “${filter}”` : ''} yet.</p>
    ) : (
      <table>
        <thead>
          <tr>
            <th>Received</th>
            <th>Company</th>
            <th>Name</th>
            <th>Lines</th>
            <th>Source</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {enquiries.map((e) => (
            <tr>
              <td>
                <a href={`/admin/enquiries/${e.id}`}>
                  {new Date(e.created_at).toISOString().slice(0, 16).replace('T', ' ')}
                </a>
              </td>
              <td>{e.company || '—'}</td>
              <td>{e.name}</td>
              <td>{e.items.length}</td>
              <td>{e.source}</td>
              <td>{e.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
</AdminLayout>

<style>
  .filters {
    display: flex;
    gap: 16px;
    margin: 16px 0;
  }
  .filters a {
    color: #b4b4bc;
    min-height: 44px;
    display: flex;
    align-items: center;
  }
  .filters a[aria-current='page'] {
    color: #ef3a38;
  }
  .export {
    margin-left: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 10px 12px;
    border-bottom: 1px solid #232329;
  }
  td a {
    color: #fff;
  }
</style>
```

- [ ] **Step 3: Write `src/pages/admin/enquiries/[id].astro`**

```astro
---
import AdminLayout from '../../../layouts/AdminLayout.astro';
import { getEnquiry, ENQUIRY_STATUSES } from '../../../lib/admin/enquiries';

export const prerender = false;

const admin = Astro.locals.admin!;
const enquiry = await getEnquiry(Astro.params.id ?? '');

if (!enquiry) return Astro.redirect('/admin?error=not-found', 302);

const error = Astro.url.searchParams.get('error');
const units = enquiry.items.reduce((n, i) => n + i.qty, 0);
---

<AdminLayout title={`Enquiry from ${enquiry.company || enquiry.name}`} admin={admin}>
  <p><a href="/admin">← All enquiries</a></p>
  <h1>{enquiry.company || enquiry.name}</h1>

  {error && <p role="alert" class="err">Could not save that change. Please try again.</p>}

  <dl>
    <dt>Received</dt><dd>{new Date(enquiry.created_at).toISOString()}</dd>
    <dt>Name</dt><dd>{enquiry.name}</dd>
    <dt>Email</dt><dd><a href={`mailto:${enquiry.email}`}>{enquiry.email}</a></dd>
    <dt>Phone</dt><dd>{enquiry.phone || '—'}</dd>
    <dt>Country</dt><dd>{enquiry.country || '—'}</dd>
    <dt>Division</dt><dd>{enquiry.division || '—'}</dd>
    <dt>Source</dt><dd>{enquiry.source}</dd>
    <dt>Notified</dt>
    <dd>{enquiry.notified_at ? new Date(enquiry.notified_at).toISOString() : 'not emailed'}</dd>
  </dl>

  <h2>Message</h2>
  <p class="msg">{enquiry.message || '—'}</p>

  <h2>Products ({enquiry.items.length} lines, {units} units)</h2>
  {
    enquiry.items.length === 0 ? (
      <p>General enquiry — no products selected.</p>
    ) : (
      <table>
        <thead><tr><th>Product</th><th>Slug</th><th>Qty</th><th>Note</th></tr></thead>
        <tbody>
          {enquiry.items.map((i) => (
            <tr>
              <td>{i.name}</td>
              <td><a href={`/products/${i.slug}`}>{i.slug}</a></td>
              <td>{i.qty}</td>
              <td>{i.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  <h2>Status</h2>
  <form method="post" action={`/api/admin/enquiries/${enquiry.id}`}>
    <label for="status">Status</label>
    <select id="status" name="status">
      {ENQUIRY_STATUSES.map((s) => <option value={s} selected={s === enquiry.status}>{s}</option>)}
    </select>
    <button type="submit">Save</button>
  </form>
</AdminLayout>

<style>
  dl { display: grid; grid-template-columns: 160px 1fr; gap: 4px 16px; }
  dt { color: #8a8a92; }
  .msg { white-space: pre-wrap; max-width: 70ch; }
  .err { padding: 12px; border-left: 3px solid #ef3a38; background: #151519; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #232329; }
  select { min-height: 44px; background: #151519; color: #fff; border: 1px solid #232329; }
  form { display: flex; gap: 8px; align-items: end; }
</style>
```

- [ ] **Step 4: Verify and commit**

Run: `npm run verify`
Expected: `VERIFY PASSED — 11/11 gates`

```bash
git add src/pages/admin/ src/pages/api/admin/
git commit -m "feat(admin): add the enquiry list, detail view and status workflow"
```

---

### Task 9: Demand report and CSV export

**Files:**
- Create: `src/pages/admin/demand.astro`, `src/pages/api/admin/export.csv.ts`

- [ ] **Step 1: Write `src/pages/api/admin/export.csv.ts`**

```ts
import type { APIRoute } from 'astro';
import { listEnquiries } from '../../../lib/admin/enquiries';
import { toCsv } from '../../../lib/admin/csv';

export const prerender = false;

const COLUMNS = [
  'created_at', 'status', 'source', 'name', 'company',
  'email', 'phone', 'country', 'division', 'message', 'lines', 'units', 'products',
] as const;

export const GET: APIRoute = async () => {
  const rows = (await listEnquiries()).map((e) => ({
    created_at: e.created_at,
    status: e.status,
    source: e.source,
    name: e.name,
    company: e.company,
    email: e.email,
    phone: e.phone,
    country: e.country,
    division: e.division,
    message: e.message,
    lines: e.items.length,
    units: e.items.reduce((n, i) => n + i.qty, 0),
    products: e.items.map((i) => `${i.slug} x${i.qty}`).join(' | '),
  }));

  // The BOM is what makes Excel read this as UTF-8 rather than the local
  // codepage; without it every non-ASCII name in the export is mangled.
  return new Response('﻿' + toCsv(rows, COLUMNS), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="spartan-enquiries.csv"',
      'cache-control': 'no-store',
    },
  });
};
```

- [ ] **Step 2: Write `src/pages/admin/demand.astro`**

```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { getDemand } from '../../lib/admin/enquiries';

export const prerender = false;

const admin = Astro.locals.admin!;
const demand = await getDemand();
---

<AdminLayout title="Product demand" admin={admin}>
  <h1>Product demand</h1>
  <p class="note">
    Products ordered by how many separate enquiries name them. Counts every
    enquiry regardless of status.
  </p>

  {
    demand.length === 0 ? (
      <p>No products have been enquired about yet.</p>
    ) : (
      <table>
        <thead><tr><th>Product</th><th>Enquiries</th><th>Units</th></tr></thead>
        <tbody>
          {demand.map((d) => (
            <tr>
              <td><a href={`/products/${d.product_slug}`}>{d.product_name}</a></td>
              <td>{d.enquiries}</td>
              <td>{d.units}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
</AdminLayout>

<style>
  .note { color: #8a8a92; max-width: 60ch; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #232329; }
  td a { color: #fff; }
</style>
```

- [ ] **Step 3: Verify and commit**

Run: `npm run verify`
Expected: `VERIFY PASSED — 11/11 gates`

```bash
git add src/pages/admin/demand.astro src/pages/api/admin/export.csv.ts
git commit -m "feat(admin): add the product demand report and CSV export"
```

---

### Task 10: Keep the admin out of the index

**Files:**
- Modify: `tools/verify.mjs`

**`robots.txt` is deliberately NOT changed.** The instinct is to add
`Disallow: /admin/`, and it is wrong twice over:

1. `src/pages/robots.txt.ts` already carries a reasoned position against
   `Disallow` lines — "a Disallow line is a public index of your endpoints".
   Adding one would advertise the admin area to anyone who reads robots.txt,
   which is everyone.
2. It would be self-defeating. `Disallow` prevents *crawling*, so a crawler never
   fetches the page and never sees the `noindex` meta tag. A URL that is
   disallowed but linked from anywhere external can still appear in results as a
   bare URL. `noindex` without `Disallow` is the combination that actually keeps
   a page out of an index.

The controls are the middleware (nothing is served) and the `noindex` meta in
`AdminLayout.astro` (nothing is indexed). Obscurity is not among them.

- [ ] **Step 1: Add a verify gate**

Append to `tools/verify.mjs`, before the e2e section:

```js
/* ------------------------------------------- 12. the admin area stays private -- */

/*
 * The failure this catches is one missing line.
 *
 * An admin page without `export const prerender = false` is silently
 * PRERENDERED: Astro runs it at build time, with no request, no session and no
 * middleware guard, and writes the result into dist/client as a static file.
 * That file is then served to anyone who asks, with whatever enquiry data the
 * build-time query returned. The build succeeds. Every test that checks the
 * boundary at runtime still passes, because the runtime is no longer involved.
 *
 * Also asserts no admin URL reached the sitemap.
 */
{
  const problems = [];

  const leaked = htmlFiles(path.join(root, 'dist/client')).filter((f) =>
    path.relative(root, f).replace(/\\/g, '/').includes('/admin/'),
  );
  if (leaked.length)
    problems.push(`${leaked.length} admin page(s) were prerendered into dist/client`);

  for (const name of ['sitemap-0.xml', 'sitemap-index.xml']) {
    const file = path.join(root, 'dist/client', name);
    if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('/admin'))
      problems.push(`an admin URL reached ${name}`);
  }

  record(
    'admin area stays private',
    problems.length === 0,
    problems.length ? problems.join('; ') : 'nothing prerendered, nothing in the sitemap',
  );
}
```

- [ ] **Step 2: Prove the gate bites**

Temporarily remove `export const prerender = false;` from `src/pages/admin/demand.astro`, run `npm run verify`, and confirm the gate FAILS naming the prerendered page. Restore the line and confirm it passes.

A gate that has never been seen to fail is a gate nobody knows works.

- [ ] **Step 3: Commit**

```bash
git add tools/verify.mjs
git commit -m "feat(admin): gate against an admin page being prerendered"
```

---

### Task 11: End-to-end coverage of the auth boundary

**Files:**
- Create: `tests/e2e/admin.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
/**
 * The admin boundary, tested against the real built app.
 *
 * CI holds no Supabase credentials, so `authConfigured()` is false and
 * `currentAdmin()` returns null for every request. That is exactly the state
 * these tests need: an unauthenticated visitor. What is asserted here is that
 * such a visitor gets NOTHING — which is the property that matters most and the
 * one that must hold whether or not the deployment is configured.
 */
import { test, expect } from '@playwright/test';

const PAGES = ['/admin', '/admin/demand', '/admin/enquiries/00000000-0000-0000-0000-000000000000'];
const ENDPOINTS = ['/api/admin/export.csv'];

test.describe('the admin boundary', () => {
  for (const path of PAGES) {
    test(`${path} redirects an unauthenticated visitor to the login form`, async ({ page }) => {
      const response = await page.goto(path);
      expect(new URL(page.url()).pathname).toBe('/admin/login');
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Spartan admin' })).toBeVisible();
    });
  }

  for (const path of ENDPOINTS) {
    test(`${path} answers 401 rather than redirecting`, async ({ request }) => {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status()).toBe(401);
      expect(await response.json()).toEqual({ ok: false, message: 'Not authorised.' });
    });
  }

  test('no enquiry data appears anywhere in an unauthenticated response', async ({ page }) => {
    await page.goto('/admin');
    const body = await page.content();
    for (const leak of ['@example.com', 'enquiries', 'Gulf Contracting']) {
      expect(body.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  test('the login page is noindex', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  });

  /* The trap this whole phase is shaped around: `npm run csp` hashes inline
     scripts found in dist/client, and SSR admin pages are never there. An inline
     script here would ship unhashed and be blocked with nothing failing the
     build, so the only place it can be caught is at runtime under the real
     policy. */
  test('the login page runs with zero CSP violations', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('Content Security Policy')) violations.push(m.text());
    });
    await page.goto('/admin/login');
    await page.waitForLoadState('networkidle');
    expect(violations).toEqual([]);
  });

  test('the login page carries no inline script at all', async ({ page }) => {
    await page.goto('/admin/login');
    const inline = await page.$$eval('script:not([src])', (nodes) =>
      nodes.filter((n) => n.textContent && n.textContent.trim().length > 0).length,
    );
    expect(inline).toBe(0);
  });
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm run verify -- --full`
Expected: `VERIFY PASSED — 12/12 gates`, playwright **153 passed** — 8 new tests across 2 projects, up from 137.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/admin.spec.ts
git commit -m "test(admin): cover the auth boundary, noindex and the CSP"
```

---

### Task 12: Documentation

**Files:**
- Modify: `README.md`, `handoff.md`, `BACKLOG.md`, `CLAUDE.md`, `AGENTS.md`

- [ ] **Step 1: README** — add an "Admin" section: the URL, that accounts are created by hand in Supabase with signups disabled, the three environment variables, and that the browser never talks to Supabase.

- [ ] **Step 2: handoff.md** — add an "Admin area" subsection under §7 recording: the no-inline-script CSP trap and why `npm run csp` cannot catch it; that middleware runs at build time for all 96 prerendered pages and why the early return is load-bearing; that a missing `prerender = false` silently turns an admin page into a public static file, and that gate 12 exists for it; that identity (cookie) and authority (`public.admins`) are separate checks; that `getUser()` is used rather than `getSession()` because the latter trusts a browser-controlled cookie; and **why robots.txt still has no `Disallow`** — it would advertise the admin area and would stop crawlers seeing the `noindex` that actually keeps it out of the index.

- [ ] **Step 3: CLAUDE.md and AGENTS.md** — add to the rules: "No inline scripts on `/admin` pages — they cannot be hashed and will be blocked."

- [ ] **Step 4: BACKLOG.md** — mark Phase 1 done with what was built and what was learned; add Phase 2 as the next item.

- [ ] **Step 5: Commit**

```bash
git add README.md handoff.md BACKLOG.md CLAUDE.md AGENTS.md
git commit -m "docs: record the admin area and its two traps"
```

---

## Definition of done

- [ ] `npm run verify -- --full` → 12/12 gates
- [ ] Unit tests **113** (96 + 5 CSV + 6 cookies + 6 enquiries)
- [ ] Playwright **153** (137 + 8 × 2 projects)
- [ ] Page count still **97** — the admin adds no prerendered pages
- [ ] The operator can sign in, read every enquiry, change a status, see demand and download the CSV
- [ ] An unauthenticated request to every admin route and endpoint yields nothing
- [ ] `public.enquiries` still has **zero** RLS policies
- [ ] `vercel.json` **unchanged** — no CSP widening
