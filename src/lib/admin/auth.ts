/**
 * Admin authentication.
 *
 * Identity and authority are separate facts and are established separately:
 *
 *   1. The session cookie proves WHO the request is (Supabase Auth, anon key).
 *   2. Membership of public.admins proves they MAY be here (service-role key).
 *
 * A valid Supabase account is therefore not enough. Public signup is disabled in
 * the dashboard, but this second check is what makes that a belt rather than the
 * only thing holding the trousers up — a setting nobody re-reads is not a
 * control.
 *
 * THE BROWSER NEVER TALKS TO SUPABASE
 *
 * Sign-in happens in an endpoint, the session lives in an HttpOnly cookie, and
 * every data read runs server-side. That is why `connect-src 'self'` in
 * vercel.json needs no Supabase origin, why no anon key reaches any page, and
 * why public.enquiries can keep RLS with zero policies.
 */
import { createServerClient } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import { env, configured } from '../env';
import { parseCookies } from './cookies';

const URL_KEY = 'SUPABASE_URL';
const ANON_KEY = 'SUPABASE_ANON_KEY';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** True when sign-in can work at all. False locally and in CI, which hold no secrets. */
export const authConfigured = (): boolean => configured(URL_KEY, ANON_KEY, SERVICE_KEY);

export interface Admin {
  userId: string;
  email: string;
}

/**
 * A Supabase client bound to this request's cookies. Reads them from the raw
 * header (Astro has no `getAll`) and writes them back through AstroCookies, so a
 * token refreshed mid-request is persisted on the response rather than lost.
 */
export function authClient(request: Request, cookies: AstroCookies) {
  return createServerClient(env(URL_KEY), env(ANON_KEY), {
    cookies: {
      getAll: () => parseCookies(request.headers.get('cookie') ?? ''),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookies.set(name, value, {
            ...options,
            // Not negotiable regardless of what the library suggests. The token
            // is never read by page script, so httpOnly costs nothing; and a
            // session cookie without sameSite is a CSRF foothold on an area
            // whose forms change data.
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
 * Uses `getUser()`, not `getSession()`. getSession decodes the cookie and trusts
 * what it finds; the cookie is sent by the browser. getUser verifies the token
 * with the auth server. For a check that decides whether to hand over every
 * enquiry the site has ever taken, the round trip is worth it.
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
    if (!row) return null; // authenticated, but not on the allow-list

    return { userId: row.user_id as string, email: row.email as string };
  } catch (cause) {
    // Never fail open. An error here means authority could not be established,
    // and "could not establish" has to read the same as "does not have".
    console.error('[admin] auth check failed', cause);
    return null;
  }
}
