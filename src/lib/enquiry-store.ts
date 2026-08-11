/**
 * The enquiry system of record.
 *
 * Every RFQ is written here before the notification email is attempted, which is
 * the whole reason this module exists: until it did, an enquiry existed only as
 * an email, and a mail provider having a bad minute meant a validated, willing
 * buyer was discarded by the endpoint's catch block with nothing kept.
 *
 * WHY SERVICE-ROLE, SERVER-SIDE ONLY
 *
 * `public.enquiries` has RLS enabled and no policies at all, so the publishable
 * key can neither read nor write it. Only `service_role` — which bypasses RLS —
 * can insert, and that key never leaves the serverless function. The browser
 * never talks to Supabase, which also means `connect-src` in vercel.json stays
 * as it is and the CSP needs no new origin.
 *
 * The rows hold names, email addresses and phone numbers. If the publishable key
 * ever ends up in the page it must still be worth exactly nothing here.
 *
 * WHY THE CLIENT IS IMPORTED DYNAMICALLY
 *
 * Mirrors how `resend` is loaded in the endpoint: the module is only needed on
 * the one path that reaches it, and a static import would pull the whole client
 * into the function bundle even for a request that never gets past validation.
 */
import { env, configured } from './env';
import type { ChannelState } from './enquiry-outcome';
import type { EnquiryPayload } from './enquiry-schema';

const URL_KEY = 'SUPABASE_URL';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

export interface RecordResult {
  state: ChannelState;
  /** The new row's id, present only when `state` is `'ok'`. Used to mark it notified. */
  id?: string;
}

/** True when both Supabase variables are set. Exported for the endpoint's logging. */
export const storeConfigured = (): boolean => configured(URL_KEY, SERVICE_KEY);

async function client() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env(URL_KEY), env(SERVICE_KEY), {
    // No session to persist and no token to refresh: this is a stateless
    // server-side writer, and leaving these on makes the client try to use
    // storage that does not exist in a serverless runtime.
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Write one enquiry. Never throws — a store failure is a value the caller
 * reasons about alongside the email result, not an exception that would take
 * the whole request down and lose the payload the endpoint still needs to log.
 */
export async function recordEnquiry(payload: EnquiryPayload): Promise<RecordResult> {
  if (!storeConfigured()) return { state: 'unconfigured' };

  try {
    const supabase = await client();

    // `website` is the honeypot and is always empty by the time a payload gets
    // here — it is a validation device, not data, and has no column.
    const { data, error } = await supabase
      .from('enquiries')
      .insert({
        name: payload.name,
        company: payload.company,
        email: payload.email,
        phone: payload.phone,
        country: payload.country,
        division: payload.division,
        message: payload.message,
        items: payload.items,
        source: payload.source,
      })
      .select('id')
      .single();

    if (error) throw new Error(`${error.code ?? 'error'}: ${error.message}`);

    return { state: 'ok', id: data.id as string };
  } catch (cause) {
    console.error('[enquiry] store write failed', cause);
    return { state: 'failed' };
  }
}

/**
 * Stamp `notified_at` once the email is away, so a row with it still NULL means
 * the enquiry was captured but nobody was nudged about it — the exact thing you
 * want to be able to query after a mail outage.
 *
 * Best effort by design. The lead is already safe at this point, so a failure
 * here is worth a log line and nothing more; it must not turn a successful
 * submission into an error.
 */
export async function markNotified(id: string): Promise<void> {
  if (!storeConfigured()) return;

  try {
    const supabase = await client();
    const { error } = await supabase
      .from('enquiries')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(`${error.code ?? 'error'}: ${error.message}`);
  } catch (cause) {
    console.error('[enquiry] could not stamp notified_at', cause);
  }
}
