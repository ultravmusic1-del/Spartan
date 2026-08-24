/**
 * The enquiry notification email, sent with `fetch` rather than the Resend SDK.
 *
 * WHY NOT THE SDK. `resend` pulls `@react-email/render`, which pulls react-dom
 * and prettier — about 3 MB traced into the serverless function on 2026-08-23,
 * for one JSON POST this file makes in six lines. None of the SDK's surface was
 * used: no React email templates, no attachments, no batch send. The weight
 * lands on cold starts of `/api/enquiry`, the most latency-sensitive route a
 * buyer touches.
 *
 * PARITY WAS READ OFF THE SDK, NOT THE DOCS. `node_modules/resend/dist/index.js`
 * posts to `https://api.resend.com/emails` with a Bearer key, and maps its
 * `replyTo` option to **`reply_to`** on the wire. Sending camelCase here would
 * be accepted by the API and silently dropped, so every reply to a lead would
 * go to the from-address instead of to the buyer — a lost lead with nothing in
 * any log to show for it.
 *
 * RULE 2 LIVES HERE. The return value is a `ChannelState` and never an
 * exception: by the time this runs the enquiry is already written to Postgres,
 * so a mail failure is one channel's result to be weighed against the other's.
 * The three states are not interchangeable — `unconfigured` means nothing was
 * ever asked to carry the mail, `failed` means something was asked and could
 * not. `decideOutcome` reads them differently and a 502 depends on the
 * difference.
 */
import type { ChannelState } from './enquiry-outcome';
import { env, configured } from './env';

const ENDPOINT = 'https://api.resend.com/emails';

/**
 * Resend refuses any `from` that is not on a verified domain.
 * `onboarding@resend.dev` is Resend's own always-verified sender and delivers
 * to the account's own address, which is enough to prove the path works.
 */
const FALLBACK_FROM = 'Spartan Enquiries <onboarding@resend.dev>';

export interface MailRequest {
  subject: string;
  text: string;
  /** The buyer's address, so a reply reaches them and not the from-address. */
  replyTo: string;
}

/**
 * Injected so the unit tests can drive every branch without a network, and so
 * this module has no hidden dependency on a global being the real `fetch`.
 */
export type Fetcher = typeof globalThis.fetch;

export async function sendEnquiryMail(
  mail: MailRequest,
  fetcher: Fetcher = globalThis.fetch,
): Promise<ChannelState> {
  if (!configured('RESEND_API_KEY', 'ENQUIRY_TO_EMAIL')) return 'unconfigured';

  try {
    const response = await fetcher(ENDPOINT, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env('RESEND_API_KEY')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env('ENQUIRY_FROM_EMAIL') || FALLBACK_FROM,
        to: env('ENQUIRY_TO_EMAIL'),
        // snake_case: see the header. The SDK translates; a raw POST must not
        // forget to.
        reply_to: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (!response.ok) {
      /*
       * Resend answers a failure with `{ name, message }`. Read it for the log
       * and fall back to the status when the body is not JSON — a gateway
       * returning HTML must still produce a usable line, not a parse error that
       * buries the real one.
       */
      const detail = await response
        .json()
        .then((body: unknown) => {
          const e = body as { name?: string; message?: string };
          return e?.name || e?.message ? `${e.name ?? 'error'}: ${e.message ?? ''}` : null;
        })
        .catch(() => null);

      throw new Error(detail ?? `HTTP ${response.status}`);
    }

    return 'ok';
  } catch (cause) {
    console.error('[enquiry] send failed', cause);
    return 'failed';
  }
}
