/**
 * The admin guard.
 *
 * TWO THINGS THAT WILL BITE IF FORGOTTEN
 *
 * 1. This runs for EVERY route, including the 97 prerendered pages — and for
 *    those it runs at BUILD time, where there is no meaningful request. The
 *    early return is therefore not an optimisation. Without it the build makes
 *    97 pointless auth round trips, and the public site's build starts depending
 *    on Supabase being reachable.
 *
 * 2. `/api/admin/*` needs guarding as much as `/admin/*`. Protecting only the
 *    pages leaves every endpoint they call wide open, and the endpoints are the
 *    more valuable target — the pages only render what those hand over.
 */
import { defineMiddleware } from 'astro:middleware';
import { currentAdmin } from './lib/admin/auth';

/** Reachable without a session, because they are how a session is obtained. */
const OPEN = new Set(['/admin/login', '/api/admin/login']);

function guarded(pathname: string): boolean {
  // Normalise a trailing slash so `/admin/login/` cannot slip past OPEN as an
  // unguarded path, and `/admin/` still matches `/admin`.
  const path = pathname.replace(/\/+$/, '') || '/';
  if (OPEN.has(path)) return false;
  return path === '/admin' || path.startsWith('/admin/') || path.startsWith('/api/admin/');
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!guarded(context.url.pathname)) return next();

  const admin = await currentAdmin(context.request, context.cookies);

  if (!admin) {
    // An endpoint gets a status it can act on; a page gets sent to the login
    // form. Redirecting a fetch would hand the caller an HTML login page under a
    // 200, which reads as success.
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
