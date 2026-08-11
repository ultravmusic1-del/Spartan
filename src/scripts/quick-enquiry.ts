/**
 * Progressive enhancement for the two compact enquiry forms — the home page
 * CTA and the general enquiry form on /contact.
 *
 * WHY THIS IS NOT A PREACT ISLAND
 *
 * The full basket form at /enquiry is one, because it renders from a store and
 * its markup depends on state. These two do not: they are static markup whose
 * only dynamic behaviour is "submit, then say what happened". Converting them
 * would mean moving every rule out of the two components' `<style>` blocks,
 * because Astro's scoped styles are keyed to elements the .astro file emits and
 * a Preact component's DOM never receives that attribute. That is a large
 * change to the approved design's CSS in exchange for nothing.
 *
 * Enhancing the existing markup in place keeps both forms byte-identical in
 * appearance and costs about a kilobyte.
 *
 * WHY THERE IS NO ZOD HERE
 *
 * `enquiry-schema.ts` says it plainly: client-side validation is a courtesy,
 * never a control. Every bound is enforced again on the server, which is the
 * only place it counts. Importing the schema would ship zod to the home page —
 * the page with the least Lighthouse headroom on the site (mobile Perf 95–97,
 * LCP a text element behind render-blocking CSS) — to duplicate a check that
 * has already been made. Native `required` and `type="email"` give the buyer
 * immediate feedback for free, and the server's own field errors are rendered
 * when it rejects something.
 *
 * THE ONE RULE THIS FILE EXISTS TO KEEP
 *
 * An enquiry is only "received" if something durable holds it. The endpoint
 * reports two independent channels — `recorded` (written to Postgres) and
 * `delivered` (the notification email) — and either one is enough: with the row
 * written, a mail outage costs a nudge rather than a buyer.
 *
 * `{ ok: true, recorded: false, delivered: false }` is the case that is *not*
 * success. It means neither channel is configured on this deployment, so the
 * enquiry exists only as a line in a server log, and a form reporting "sent"
 * would leave a buyer waiting on a reply nobody knows to make. That outcome is
 * reported honestly and differently. This mirrors `EnquiryForm.tsx`, which
 * solved the same problem first.
 */

interface EnquiryResponse {
  ok?: boolean;
  recorded?: boolean;
  delivered?: boolean;
  errors?: Record<string, string>;
  message?: string;
}

/** Fields the compact forms can send. Absent ones are simply not in the FormData. */
const FIELDS = ['name', 'company', 'email', 'phone', 'country', 'division', 'message', 'website'];

function enhance(form: HTMLFormElement): void {
  const status = form.querySelector<HTMLElement>('[data-enquiry-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  // The address to fall back to when we could not deliver. Passed in from
  // site.json rather than duplicated here, so the placeholder becomes the real
  // one in a single edit.
  const fallbackEmail = form.dataset.enquiryEmail ?? '';

  const say = (state: 'idle' | 'sending' | 'sent' | 'error', message: string): void => {
    form.dataset.state = state;
    if (status) status.textContent = message;
    if (button) button.disabled = state === 'sending';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.dataset.state === 'sending') return;

    const data = new FormData(form);
    // `source` records which form converted. The schema `.catch()`es an
    // unrecognised value to 'unknown' rather than rejecting, so a stale cached
    // copy of this script can never cost an enquiry.
    const payload: Record<string, unknown> = {
      items: [],
      source: form.dataset.enquirySource ?? 'unknown',
    };
    for (const field of FIELDS) {
      // `name` and `email` are the only fields the server requires. Sending a
      // key the schema defaults is harmless; omitting one it requires is not,
      // so every present field goes even when empty.
      if (data.has(field)) payload[field] = String(data.get(field) ?? '');
    }
    // The honeypot must always be present: the schema requires the key, and a
    // form that omitted it would be rejected as malformed rather than accepted
    // as clean.
    if (!('website' in payload)) payload.website = '';

    say('sending', 'Sending…');

    let response: Response;
    try {
      response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      say(
        'error',
        fallbackEmail
          ? `We could not reach the server. Please try again, or email us at ${fallbackEmail}.`
          : 'We could not reach the server. Please check your connection and try again.',
      );
      return;
    }

    const body = (await response.json().catch(() => ({}))) as EnquiryResponse;

    if (response.ok && body.ok) {
      if (!body.recorded && !body.delivered) {
        // Neither channel is configured, so nothing durable holds this. Said
        // plainly — see the note at the top of this file. This branch
        // disappears on its own once either channel has credentials.
        say(
          'sent',
          fallbackEmail
            ? `Enquiry received, but this deployment is not configured to store or send enquiries yet, so it has not reached the Spartan team. Please email ${fallbackEmail} directly.`
            : 'Enquiry received, but this deployment is not configured to store or send enquiries yet, so it has not reached the Spartan team.',
        );
      } else {
        say('sent', 'Enquiry received. Our team will come back to you shortly.');
      }
      form.reset();
      return;
    }

    if (response.status === 400 && body.errors) {
      // One message, nearest the top of the form. There is no per-field error
      // slot in these compact layouts, and inventing one would mean changing
      // the approved design.
      const first = Object.values(body.errors)[0];
      say('error', first ?? body.message ?? 'Please check the details and try again.');
      return;
    }

    say(
      'error',
      body.message ??
        (fallbackEmail
          ? `Something went wrong sending your enquiry. Please try again in a moment, or email us at ${fallbackEmail}.`
          : 'Something went wrong sending your enquiry. Please try again in a moment.'),
    );
  });

  // Only now is the form live. Until this point the submit control is hidden by
  // `html[data-js]` gating in each component, so a visitor without JavaScript is
  // never shown a control that does nothing — the same rule the enquiry buttons
  // and the catalogue filter bar already follow.
  form.dataset.state = 'idle';
}

export function initQuickEnquiry(): void {
  document
    .querySelectorAll<HTMLFormElement>('form[data-enquiry-form]')
    .forEach((form) => enhance(form));
}
