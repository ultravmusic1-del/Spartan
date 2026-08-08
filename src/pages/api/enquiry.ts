import type { APIRoute } from 'astro';
import { enquiryPayloadSchema, toFieldErrors, type EnquiryPayload } from '../../lib/enquiry-schema';

/**
 * /api/enquiry — the site's only server-rendered route.
 *
 * Everything else is `output: 'static'`. This one endpoint opts out, so the
 * Vercel adapter emits 96 static pages plus a single serverless function.
 * Nothing else in the repo may set this flag without a reason as good.
 */
export const prerender = false;

/* ------------------------------------------------------------------ config -- */

/**
 * `process.env` first, `import.meta.env` second.
 *
 * Vite inlines `import.meta.env.*` at build time, and on Vercel the build runs
 * on Vercel — so a secret added to the project *after* a build would never
 * reach an inlined reference. `process.env` is read at request time and is what
 * a platform env var actually populates. `import.meta.env` stays as the
 * fallback because `astro dev` loads `.env` into Vite's env and not into
 * `process.env`, so local development needs it.
 */
const env = (key: string): string =>
  (process.env[key] ?? (import.meta.env as Record<string, unknown>)[key] ?? '').toString().trim();

/**
 * Resend refuses any `from` that is not on a verified domain, so this cannot be
 * hard-coded to the client's eventual address before that domain exists.
 * `onboarding@resend.dev` is Resend's own always-verified sender and works with
 * any key, which keeps the very first credentialed test a one-variable change.
 */
const FALLBACK_FROM = 'Spartan Enquiries <onboarding@resend.dev>';

/* -------------------------------------------------------------- rate limit -- */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

/**
 * In-memory, per-instance, and honest about it.
 *
 * This Map lives in one serverless instance's heap. On Vercel that means:
 *
 *  - it is emptied by every cold start, so an attacker who pauses long enough
 *    for the instance to be reclaimed starts from zero;
 *  - it is not shared between concurrent instances, so N instances allow
 *    5 x N requests in the window, and a burst is exactly what causes Vercel to
 *    spin up more instances;
 *  - a distributed sender rotating IPs is not slowed at all.
 *
 * What it does buy is real but narrow: it stops one person hammering the submit
 * button, one broken client retrying in a loop, and the cheapest kind of script
 * that posts from a single address. Anything beyond that needs shared state
 * (Vercel KV, Upstash, Redis) or an edge-level control, and the honeypot plus
 * server-side validation are doing more of the anti-abuse work than this is.
 */
const hits = new Map<string, number[]>();

function rateLimited(ip: string, now = Date.now()): boolean {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);

  // Unbounded growth would be a slow leak in a long-lived instance. Sweeping on
  // write costs nothing at this traffic and needs no timer.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }

  return false;
}

/**
 * `clientAddress` is the adapter's answer and is correct on Vercel. The header
 * is the fallback for a dev server, where it is absent. The first entry of
 * `x-forwarded-for` is client-controlled and must never be trusted for
 * anything but this — it bounds nothing security-critical.
 */
function clientIp(request: Request, address: string | undefined): string {
  if (address) return address;
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}

/* ------------------------------------------------------------------ email -- */

function subjectFor(payload: EnquiryPayload): string {
  const who = payload.company || payload.name;
  const lines = payload.items.length;
  const detail = lines === 0 ? 'general enquiry' : `${lines} ${lines === 1 ? 'product' : 'products'}`;
  return `Spartan enquiry — ${who} (${detail})`;
}

/** Plain text, not HTML: this goes to a sales inbox and gets replied to, not read as a page. */
function bodyFor(payload: EnquiryPayload): string {
  const units = payload.items.reduce((n, i) => n + i.qty, 0);

  const manifest = payload.items.length
    ? payload.items
        .map((item, index) => {
          const head = `${index + 1}. ${item.name}  x${item.qty}`;
          const slug = `   slug: ${item.slug}`;
          const note = item.note ? `   note: ${item.note}` : null;
          return [head, slug, note].filter(Boolean).join('\n');
        })
        .join('\n')
    : '(No products selected — general enquiry.)';

  return [
    'NEW ENQUIRY — spartan catalogue',
    '',
    `Name:     ${payload.name}`,
    `Company:  ${payload.company || '—'}`,
    `Email:    ${payload.email}`,
    `Phone:    ${payload.phone || '—'}`,
    `Country:  ${payload.country || '—'}`,
    `Division: ${payload.division || '—'}`,
    '',
    'MESSAGE',
    payload.message || '—',
    '',
    `PRODUCTS (${payload.items.length} ${payload.items.length === 1 ? 'line' : 'lines'}, ${units} ${units === 1 ? 'unit' : 'units'})`,
    manifest,
    '',
    `Submitted ${new Date().toISOString()}`,
  ].join('\n');
}

/* ------------------------------------------------------------------ route -- */

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);

  if (rateLimited(ip)) {
    return json(
      {
        ok: false,
        message:
          'Too many enquiries from this connection. Please wait a few minutes and try again, or email us directly.',
      },
      429,
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ ok: false, message: 'We could not read that submission. Please try again.' }, 400);
  }

  const parsed = enquiryPayloadSchema.safeParse(raw);

  if (!parsed.success) {
    const errors = toFieldErrors(parsed.error.issues);

    // The honeypot is never named back to the sender. Telling a bot which of
    // eight fields betrayed it is telling it how to pass next time, and a real
    // user can never reach this branch — the field is hidden, untabbable and
    // hidden from assistive technology.
    if ('website' in errors) {
      return json(
        { ok: false, message: 'We could not accept that submission. Please try again.' },
        400,
      );
    }

    return json({ ok: false, errors, message: 'Please check the highlighted fields.' }, 400);
  }

  const payload = parsed.data;
  const apiKey = env('RESEND_API_KEY');
  const to = env('ENQUIRY_TO_EMAIL');

  // No credentials: the client has not supplied a Resend key or a destination
  // address yet (handoff.md section 8, item 2). Log the enquiry so the whole
  // flow is exercisable end to end, and say plainly in the response that
  // nothing was delivered. `delivered: false` is not a detail — a site that
  // claims to have sent an RFQ it dropped loses the lead silently.
  if (!apiKey || !to) {
    console.warn(
      '[enquiry] RESEND_API_KEY or ENQUIRY_TO_EMAIL is unset — nothing was sent. Payload:\n' +
        bodyFor(payload),
    );
    return json({ ok: true, delivered: false }, 200);
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from: env('ENQUIRY_FROM_EMAIL') || FALLBACK_FROM,
      to,
      replyTo: payload.email,
      subject: subjectFor(payload),
      text: bodyFor(payload),
    });

    if (error) throw new Error(`${error.name}: ${error.message}`);
  } catch (cause) {
    console.error('[enquiry] send failed', cause);
    return json(
      {
        ok: false,
        message:
          'We could not send your enquiry just now. Please try again in a moment, or email us directly.',
      },
      502,
    );
  }

  return json({ ok: true, delivered: true }, 200);
};

/**
 * Anything that is not a POST gets a straight answer rather than Astro's
 * default 404, which would read as "this endpoint does not exist".
 */
export const ALL: APIRoute = () =>
  new Response('Method Not Allowed', { status: 405, headers: { allow: 'POST' } });
