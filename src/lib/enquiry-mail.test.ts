import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendEnquiryMail, type Fetcher } from './enquiry-mail';

/**
 * The mapping from what Resend answers to a `ChannelState`.
 *
 * This path had NO tests while it used the SDK — the nine outcome combinations
 * in enquiry-outcome.test.ts were covered, but nothing checked which of the
 * three states a real HTTP answer produced. Replacing the SDK with a `fetch`
 * is the moment to close that, because rule 2 turns on this exact mapping:
 * `unconfigured` is not `failed`, and a 502 to the buyer depends on the
 * difference.
 */

const MAIL = { subject: 'Enquiry', text: 'body', replyTo: 'buyer@example.com' };

/** Configured by default; individual tests unset what they need to. */
function configure(): void {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.ENQUIRY_TO_EMAIL = 'sales@example.com';
}

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.ENQUIRY_TO_EMAIL;
  delete process.env.ENQUIRY_FROM_EMAIL;
  vi.restoreAllMocks();
});

/* Typed with fetch's own signature so vi.fn infers the call arguments —
   without it the mock is a zero-arg function and mock.calls[0][1] is never. */
const ok: Fetcher = async () => new Response(JSON.stringify({ id: 'abc' }), { status: 200 });

describe('sendEnquiryMail', () => {
  it('reports unconfigured without making a request', async () => {
    const fetcher = vi.fn<Fetcher>();
    expect(await sendEnquiryMail(MAIL, fetcher)).toBe('unconfigured');
    expect(fetcher).not.toHaveBeenCalled();
  });

  /*
   * unconfigured is per-VARIABLE, not "some mail config exists". A key with no
   * recipient cannot send, and calling that `failed` would report a lost
   * channel where none was ever asked to carry anything.
   */
  it('is unconfigured when only half the credentials are present', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const fetcher = vi.fn<Fetcher>();
    expect(await sendEnquiryMail(MAIL, fetcher)).toBe('unconfigured');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports ok on a 200', async () => {
    configure();
    expect(await sendEnquiryMail(MAIL, vi.fn(ok))).toBe('ok');
  });

  /*
   * THE FIELD THAT WOULD FAIL SILENTLY. The SDK maps `replyTo` to `reply_to`
   * on the wire. Send camelCase and Resend accepts the request, returns 200,
   * and drops it — so every reply to a lead goes to the from-address instead
   * of the buyer, with nothing in any log to show for it.
   */
  it('sends reply_to in snake_case, which is what Resend reads', async () => {
    configure();
    const fetcher = vi.fn(ok);
    await sendEnquiryMail(MAIL, fetcher);

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init?.method).toBe('POST');

    const body = JSON.parse(String(init?.body));
    expect(body.reply_to).toBe('buyer@example.com');
    expect(body).not.toHaveProperty('replyTo');
    expect(body.to).toBe('sales@example.com');
    expect(body.subject).toBe('Enquiry');
    expect(body.text).toBe('body');
  });

  it('authenticates with a bearer token', async () => {
    configure();
    const fetcher = vi.fn(ok);
    await sendEnquiryMail(MAIL, fetcher);
    const headers = fetcher.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer test-key');
    expect(headers['content-type']).toBe('application/json');
  });

  /*
   * Resend refuses any `from` outside a verified domain, so the fallback is not
   * decoration — without it an unset ENQUIRY_FROM_EMAIL fails every send.
   */
  it('falls back to the always-verified sender when none is set', async () => {
    configure();
    const fetcher = vi.fn(ok);
    await sendEnquiryMail(MAIL, fetcher);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).from).toContain(
      'onboarding@resend.dev',
    );
  });

  it('prefers a configured sender over the fallback', async () => {
    configure();
    process.env.ENQUIRY_FROM_EMAIL = 'Spartan <sales@spartan.example>';
    const fetcher = vi.fn(ok);
    await sendEnquiryMail(MAIL, fetcher);
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body)).from).toBe(
      'Spartan <sales@spartan.example>',
    );
  });

  it('reports failed on a rejected request', async () => {
    configure();
    const fetcher: Fetcher = async () =>
      new Response(JSON.stringify({ name: 'validation_error', message: 'bad from' }), {
        status: 422,
      });
    expect(await sendEnquiryMail(MAIL, fetcher)).toBe('failed');
  });

  /*
   * A gateway answering HTML rather than JSON must still produce a usable log
   * line. Before this, a parse error would have buried the real failure.
   */
  it('reports failed when the error body is not JSON', async () => {
    configure();
    const fetcher: Fetcher = async () => new Response('<html>502 Bad Gateway</html>', { status: 502 });
    expect(await sendEnquiryMail(MAIL, fetcher)).toBe('failed');
  });

  it('reports failed when the network throws', async () => {
    configure();
    const fetcher: Fetcher = async () => {
      throw new Error('ECONNRESET');
    };
    expect(await sendEnquiryMail(MAIL, fetcher)).toBe('failed');
  });

  /*
   * It must never throw. The enquiry is already in Postgres by the time this
   * runs, so an exception here would abort a request whose durable half
   * already succeeded and tell the buyer their enquiry was lost.
   */
  it('never throws, whatever happens', async () => {
    configure();
    const fetcher: Fetcher = async () => {
      throw new Error('anything at all');
    };
    await expect(sendEnquiryMail(MAIL, fetcher)).resolves.toBe('failed');
  });
});
