/**
 * Ask Supabase to send a password-reset link.
 *
 * THE REPLY IS THE SAME WHETHER OR NOT THE ADDRESS EXISTS. This endpoint is
 * reachable without a session, so anything that varied with the address would
 * turn it into a way to ask "is this person an admin here?" one guess at a
 * time. It is the same decision the sign-in endpoint already takes by giving
 * one message for a wrong address and a wrong password alike — and Supabase
 * itself does not error on an unknown address for the same reason.
 *
 * The link lands on /admin/reset. That URL must be listed under Authentication
 * → URL Configuration → Redirect URLs in the Supabase dashboard or Supabase
 * refuses to redirect to it and the link dead-ends on its own site.
 */
import type { APIRoute } from 'astro';
import { authClient, authConfigured } from '../../../lib/admin/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const done = () => redirect('/admin/forgot?sent=1', 302);
  const back = (message: string) =>
    redirect(`/admin/forgot?error=${encodeURIComponent(message)}`, 302);

  if (!authConfigured()) return back('Password reset is not configured on this deployment.');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();

  // The one thing worth reporting: an empty box is the sender's mistake, not a
  // statement about any account.
  if (!email) return back('Enter your email address.');

  /*
   * Absolute, and derived from the request rather than hard-coded, so the same
   * code works on the Vercel host now and on the real domain later without a
   * second thing to remember to change.
   */
  const redirectTo = new URL('/admin/reset', new URL(request.url).origin).href;

  try {
    /*
     * The PKCE verifier is written to a cookie ON THIS RESPONSE by the SSR
     * client, and /admin/reset needs it to exchange the code. That is why the
     * link has to be opened in the same browser it was requested from — see
     * the note on the reset page.
     */
    await authClient(request, cookies).auth.resetPasswordForEmail(email, { redirectTo });
  } catch (cause) {
    // Logged, not shown. A failure here is ours, and reporting it differently
    // from success would leak the same thing the uniform reply protects.
    console.error('[admin] resetPasswordForEmail failed', cause);
  }

  return done();
};

export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
