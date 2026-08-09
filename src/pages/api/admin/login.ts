/**
 * Sign in.
 *
 * The only place credentials are handled, and they never reach page JavaScript:
 * this is a plain form POST, the session comes back as an HttpOnly cookie, and
 * no Supabase call is ever made from the browser.
 */
import type { APIRoute } from 'astro';
import { authClient, authConfigured } from '../../../lib/admin/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const back = (message: string) =>
    redirect(`/admin/login?error=${encodeURIComponent(message)}`, 302);

  if (!authConfigured()) return back('Admin sign-in is not configured on this deployment.');

  const form = await request.formData();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');

  if (!email || !password) return back('Enter your email address and password.');

  const { error } = await authClient(request, cookies).auth.signInWithPassword({ email, password });

  // One message for a wrong address and a wrong password alike. Distinguishing
  // them tells anyone who asks which admin addresses exist.
  if (error) return back('Those credentials were not accepted.');

  return redirect('/admin', 302);
};

/**
 * Anything that is not a POST gets a straight answer rather than Astro's default
 * 404, which would read as "this endpoint does not exist". Matches the shape
 * /api/enquiry already uses.
 */
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
