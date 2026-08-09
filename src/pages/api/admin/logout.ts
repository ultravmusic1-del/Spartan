/**
 * Sign out. POST rather than GET so a prefetch, an image tag or a link in an
 * email cannot end someone's session for them.
 */
import type { APIRoute } from 'astro';
import { authClient, authConfigured } from '../../../lib/admin/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Best effort. Even if the call fails, `signOut` has already cleared the
  // cookies through the adapter, and landing on the login page is the right
  // outcome either way.
  if (authConfigured()) {
    try {
      await authClient(request, cookies).auth.signOut();
    } catch (cause) {
      console.error('[admin] sign-out failed', cause);
    }
  }

  return redirect('/admin/login', 302);
};

export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
