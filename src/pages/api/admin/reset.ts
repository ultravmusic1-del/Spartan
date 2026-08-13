/**
 * Set a new password.
 *
 * Runs only for someone who already holds a session, which on this path means
 * they arrived from a reset link and /admin/reset exchanged its code. There is
 * no separate token here to validate: the session IS the proof, and Supabase
 * will refuse `updateUser` without one.
 *
 * `getUser()` rather than `getSession()`, for the reason recorded in
 * src/lib/admin/auth.ts — getSession decodes a browser-supplied cookie and
 * believes it, getUser asks the auth server. This request changes a credential,
 * so it is worth the round trip.
 */
import type { APIRoute } from 'astro';
import { authClient, authConfigured } from '../../../lib/admin/auth';
import { checkPassword } from '../../../lib/admin/password';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const back = (message: string) =>
    redirect(`/admin/reset?error=${encodeURIComponent(message)}`, 302);

  if (!authConfigured()) return back('Password reset is not configured on this deployment.');

  const form = await request.formData();
  const password = String(form.get('password') ?? '');
  const confirmation = String(form.get('confirmation') ?? '');

  const problem = checkPassword(password, confirmation);
  if (problem) return back(problem);

  const supabase = authClient(request, cookies);

  const { data, error: whoError } = await supabase.auth.getUser();
  if (whoError || !data.user) {
    return back('That reset link has expired or was already used. Request a new one.');
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    // Supabase enforces its own floor and refuses a password matching the
    // current one; surface its wording rather than inventing a guess at which.
    console.error('[admin] updateUser failed', error);
    return back(error.message);
  }

  /*
   * Straight to the admin, because updateUser leaves a valid session behind.
   * The middleware still checks the allow-list on arrival — a Supabase account
   * that is not in public.admins has just changed its own password and still
   * cannot see an enquiry, which is the correct outcome.
   */
  return redirect('/admin?notice=password-changed', 302);
};

export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
