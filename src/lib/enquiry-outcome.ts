/**
 * What the buyer is told, derived from what actually happened.
 *
 * An enquiry now travels down two independent channels: it is written to
 * Postgres (the system of record) and an email notification is sent (the nudge).
 * Either can be absent or fail without the other being affected, so the response
 * is a function of both — and getting it wrong in either direction is costly:
 *
 *  - claiming success when nothing was captured loses the lead silently, which
 *    is the failure this whole feature exists to remove;
 *  - claiming failure when the row *was* written sends the buyer round again and
 *    writes a duplicate.
 *
 * Extracted as a pure function precisely so all nine combinations can be
 * asserted directly, without a database, a mail provider or a network.
 */

/**
 * `unconfigured` and `failed` are deliberately different states. A channel with
 * no credentials has not lost anything — it was never asked to carry the
 * enquiry. A configured channel that threw has.
 */
export type ChannelState = 'unconfigured' | 'ok' | 'failed';

export interface EnquiryOutcome {
  status: number;
  body: {
    ok: boolean;
    /** The enquiry is in the database. */
    recorded: boolean;
    /** The notification email went out. */
    delivered: boolean;
    message?: string;
  };
  /**
   * True when the payload should be written to the server log as a last resort.
   * That is either because nothing else captured it, or because nothing else
   * was configured to.
   */
  logPayload: boolean;
}

const RETRY_MESSAGE =
  'We could not send your enquiry just now. Please try again in a moment, or email us directly.';

export function decideOutcome(store: ChannelState, email: ChannelState): EnquiryOutcome {
  const recorded = store === 'ok';
  const delivered = email === 'ok';

  // Any channel that carried the enquiry makes this a success. The buyer does
  // not need to know which one, and telling them "recorded but not emailed"
  // describes our plumbing rather than their outcome.
  if (recorded || delivered) {
    return { status: 200, body: { ok: true, recorded, delivered }, logPayload: false };
  }

  // Nothing is configured: local development, and CI, which holds no secrets
  // for either channel. This is not a lost lead — no channel was ever asked to
  // carry it — so it must not report an error, or every e2e test that submits
  // the form would fail against a correctly-behaving endpoint. Log it, and be
  // honest in the body that neither thing happened.
  if (store === 'unconfigured' && email === 'unconfigured') {
    return { status: 200, body: { ok: true, recorded: false, delivered: false }, logPayload: true };
  }

  // At least one channel was configured and every configured channel failed.
  // This is the only true failure, and the only case where asking the buyer to
  // try again is both honest and safe — nothing was written, so a retry cannot
  // duplicate.
  return {
    status: 502,
    body: { ok: false, recorded: false, delivered: false, message: RETRY_MESSAGE },
    logPayload: true,
  };
}
