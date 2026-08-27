import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { addItem, clear, enquiry, removeItem, setNote, setQty } from '../../stores/enquiry';
import { readProductContext, prefillMessage } from '../../lib/enquiry-prefill';
import {
  enquiryPayloadSchema,
  toFieldErrors,
  type EnquiryFieldErrors,
} from '../../lib/enquiry-schema';

/**
 * EnquiryForm — the whole of /enquiry, as one island.
 *
 * The basket list and the contact form are deliberately not two islands. The
 * submission has to read the list at the moment the button is pressed, and the
 * list has to be editable up to that moment, so splitting them would mean
 * either a second store subscription or passing a snapshot that goes stale.
 *
 * Quantity, note and remove all go straight through src/stores/enquiry.ts —
 * the clamps, the 500-character note cap and the persistence all belong to the
 * store and are not restated here. What *is* restated, on the server, is every
 * one of those bounds: see src/lib/enquiry-schema.ts.
 *
 * The schema is imported rather than reimplemented, so the rules the buyer sees
 * and the rules /api/enquiry enforces cannot drift apart. That costs zod in the
 * client bundle and buys a single definition of what a valid enquiry is.
 */

interface Props {
  /** From src/data/site.json, so the fallback address is never typed twice. */
  email: string;
}

/** Document order. The first error in this order is the one focus moves to. */
const FIELD_ORDER = ['name', 'company', 'email', 'phone', 'country', 'message'] as const;
type FieldName = (typeof FIELD_ORDER)[number];

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function EnquiryForm({ email }: Props) {
  const items = useStore(enquiry);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errors, setErrors] = useState<EnquiryFieldErrors>({});
  const [formError, setFormError] = useState('');
  /**
   * Whether anything durable actually holds the enquiry — the database row or
   * the notification email, either will do. False only when neither channel is
   * configured on this deployment, which is the one case the confirmation must
   * not dress up as success.
   */
  const [captured, setCaptured] = useState(true);
  /** Bumped on every failed attempt so the focus effect re-runs after render. */
  const [attempt, setAttempt] = useState(0);

  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  // `ready` is two things at once, both of which want the same one-commit delay.
  //
  // The submit button ships disabled and is enabled here. Between paint and
  // hydration the handler does not exist, and a live-looking button that drops
  // the enquiry on the floor is worse than one that is visibly not ready yet.
  // A disabled default button also means Enter in a field cannot implicitly
  // submit during that window.
  //
  // It also gates the basket list. `useStore` already holds the restored basket
  // on the very first render — `get()` on an unmounted persistent atom reads
  // localStorage — while the server, which has no localStorage, rendered the
  // empty state. Rendering the list on that first pass therefore puts a <ul>
  // where the server sent a <div>, a structural mismatch that Preact reports
  // and then repairs by walking the wrong nodes. Measured: two hydration
  // errors on every load of this page with a non-empty basket. Deferring by one
  // commit makes hydration an exact match and turns the list's arrival into an
  // ordinary update. Same fix, and same reason, as EnquiryBadge.
  useEffect(() => setReady(true), []);

  /**
   * A buyer who pressed "Request a quote" on a product page arrives here with
   * that product named in the URL. Put it on the list and say so in the message,
   * so the enquiry is complete before they have typed anything.
   *
   * IN AN EFFECT, NOT IN THE FIRST RENDER. The server rendered an empty message
   * box and an empty list; producing either on the first client pass is the
   * hydration mismatch `ready` exists to avoid two fields up. After mount, both
   * are ordinary updates.
   *
   * THE URL IS CLEANED IMMEDIATELY, and here that is not tidiness. `addItem`
   * increments an existing line, so without `replaceState` a reload would add
   * the product again, and again — a buyer refreshing three times would ask for
   * four of something they wanted one of. It also stops a second prefill
   * overwriting a message they have since edited.
   *
   * The message box is only filled when it is empty, for the same reason.
   */
  useEffect(() => {
    const context = readProductContext(window.location.search, 'quote');
    if (!context) return;

    addItem({ slug: context.slug, name: context.name });

    const field = formRef.current?.querySelector<HTMLTextAreaElement>('[name="message"]');
    if (field && !field.value.trim()) {
      field.value = prefillMessage(context, window.location.origin);
    }

    const url = new URL(window.location.href);
    for (const key of ['product', 'name', 'intent']) url.searchParams.delete(key);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // Focus is moved after the render that paints the messages, so the field is
  // already described by its error when it receives focus.
  useEffect(() => {
    if (!attempt) return;
    const first = FIELD_ORDER.find((field) => errors[field]);
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    alertRef.current?.focus();
  }, [attempt]);

  useEffect(() => {
    if (status === 'sent') doneRef.current?.focus();
  }, [status]);

  const fail = (fieldErrors: EnquiryFieldErrors, message: string) => {
    setErrors(fieldErrors);
    setFormError(message);
    setStatus('error');
    setAttempt((n) => n + 1);
  };

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (status === 'sending') return;

    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? '');

    // The list is read from the store, not from the DOM: it is the thing that
    // survived the page navigation from the drawer.
    const candidate = {
      name: text('name'),
      company: text('company'),
      email: text('email'),
      phone: text('phone'),
      country: text('country'),
      message: text('message'),
      website: text('website'),
      items: enquiry.get(),
      // The only form that submits a basket, so its source is fixed rather than
      // read from the DOM.
      source: 'enquiry' as const,
    };

    const parsed = enquiryPayloadSchema.safeParse(candidate);

    if (!parsed.success) {
      const all = toFieldErrors(parsed.error.issues);
      // A real user cannot fill the honeypot, so reaching here means a script
      // did. Nothing is highlighted and nothing is focused — there is no field
      // to point at, and naming it would be a hint.
      if (all.website) {
        fail({}, 'We could not accept that submission. Please try again.');
        return;
      }
      fail(all, 'Please check the highlighted fields.');
      return;
    }

    setStatus('sending');
    setErrors({});
    setFormError('');

    let response: Response;
    try {
      response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
    } catch {
      fail(
        {},
        `We could not reach the server. Please check your connection and try again, or email us at ${email}.`,
      );
      return;
    }

    const body = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      recorded?: boolean;
      delivered?: boolean;
      errors?: EnquiryFieldErrors;
      message?: string;
    };

    if (response.ok && body.ok) {
      // Either channel holding the enquiry is enough. With the row written, a
      // mail outage costs a notification rather than the lead.
      setCaptured(Boolean(body.recorded) || Boolean(body.delivered));
      setStatus('sent');
      setErrors({});
      setFormError('');
      // Only now. Every failure path below leaves the basket exactly as it was
      // — a buyer who mistyped an email address must not also lose their list.
      clear();
      return;
    }

    if (response.status === 400) {
      fail(body.errors ?? {}, body.message ?? 'Please check the highlighted fields.');
      return;
    }

    fail(
      {},
      body.message ??
        `Something went wrong sending your enquiry. Please try again in a moment, or email us at ${email}.`,
    );
  };

  /**
   * The store is the only place quantity is clamped, so the field is written
   * back from it rather than from a second copy of the same rule — and that
   * also covers a clamp that produces the value already held, where nothing
   * re-renders and the field would otherwise keep showing "100000".
   */
  const commitQty = (slug: string, field: HTMLInputElement) => {
    setQty(slug, Number.parseInt(field.value, 10));
    const stored = enquiry.get().find((i) => i.slug === slug);
    if (stored) field.value = String(stored.qty);
  };

  if (status === 'sent') {
    return (
      <div class="ef-done">
        <svg
          class="ef-done__mark"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 12.5l5.5 5.5L20 7" />
        </svg>

        <h2 class="ef-done__title" ref={doneRef} tabIndex={-1}>
          Enquiry received.
        </h2>

        <p class="ef-done__body">
          Thank you. Our team will come back to you on the products you listed, with availability
          and pricing.
        </p>

        {/* Never dressed up. When neither the database nor the mail provider is
            configured, the enquiry exists only as a line in a server log, and
            saying otherwise would mean a buyer waiting on a reply nobody knows
            to make. This paragraph disappears on its own the moment either
            channel has credentials. */}
        {!captured && (
          <p class="ef-done__pending">
            This deployment is not configured to store or send enquiries yet, so this one has not
            reached the Spartan team. Please email <a href={`mailto:${email}`}>{email}</a> directly.
          </p>
        )}

        <a class="ef-done__link" href="/catalogue">
          Back to the catalogue
        </a>
      </div>
    );
  }

  const units = items.reduce((n, i) => n + i.qty, 0);

  return (
    <div class="ef">
      <section class="ef-list" aria-labelledby="ef-list-title">
        <div class="ef-list__bar">
          <h2 class="ef-panel__title" id="ef-list-title">
            Your list
          </h2>
          {ready && items.length > 0 && (
            <p class="ef-list__count">
              {items.length} {items.length === 1 ? 'line' : 'lines'} · {units}{' '}
              {units === 1 ? 'unit' : 'units'}
            </p>
          )}
        </div>

        {!ready ? null : items.length === 0 ? (
          <div class="ef-list__empty">
            <p class="ef-list__empty-title">No products on your list.</p>
            <p class="ef-list__empty-note">
              You can still send a general enquiry with the form. Tell us what you are looking for
              and we will point you at the right part of the range. Or add products as you browse
              and they will appear here.
            </p>
            <a class="ef-list__empty-link" href="/catalogue">
              Browse the catalogue
            </a>
          </div>
        ) : (
          <ul class="ef-items">
            {items.map((item) => (
              <li class="ef-item" key={item.slug}>
                <div class="ef-item__head">
                  <p class="ef-item__name">{item.name}</p>
                  <button
                    type="button"
                    class="ef-item__remove"
                    aria-label={`Remove ${item.name} from your enquiry`}
                    onClick={() => removeItem(item.slug)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                <div class="ef-item__controls">
                  <div class="ef-qty">
                    <button
                      type="button"
                      class="ef-qty__step"
                      aria-label={`Decrease quantity of ${item.name}`}
                      onClick={() => setQty(item.slug, item.qty - 1)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.4"
                        stroke-linecap="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <input
                      class="ef-qty__field"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={999}
                      value={item.qty}
                      aria-label={`Quantity of ${item.name}`}
                      onChange={(e) => commitQty(item.slug, e.currentTarget)}
                    />
                    <button
                      type="button"
                      class="ef-qty__step"
                      aria-label={`Increase quantity of ${item.name}`}
                      onClick={() => setQty(item.slug, item.qty + 1)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.4"
                        stroke-linecap="round"
                        aria-hidden="true"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  </div>

                  <label class="ef-item__note">
                    <span class="eq-sr">Note for {item.name}</span>
                    <textarea
                      class="ef-item__field"
                      rows={2}
                      maxLength={500}
                      placeholder="Add a note: size, colour, certification"
                      value={item.note}
                      onInput={(e) => setNote(item.slug, e.currentTarget.value)}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* `noValidate` on purpose: the browser's own bubble cannot be placed
          beside the field, cannot be styled to this palette and is not
          announced as an alert. Every rule it would have applied is applied by
          the shared schema instead, and `type="email"` / `type="tel"` are kept
          for the soft keyboards they select. */}
      <form class="ef-form" ref={formRef} onSubmit={onSubmit} noValidate aria-labelledby="ef-form-title">
        <h2 class="ef-panel__title" id="ef-form-title">
          Your details
        </h2>

        <Field
          name="name"
          label="Name"
          required
          autocomplete="name"
          error={errors.name}
        />
        <Field name="company" label="Company" autocomplete="organization" error={errors.company} />
        <Field
          name="email"
          label="Email"
          type="email"
          required
          autocomplete="email"
          error={errors.email}
        />

        <div class="ef-row">
          <Field name="phone" label="Phone" type="tel" autocomplete="tel" error={errors.phone} />
          <Field name="country" label="Country" autocomplete="country-name" error={errors.country} />
        </div>

        <Field name="message" label="Message" multiline error={errors.message} />

        {/*
          Honeypot. Hidden from sight by position rather than `display: none`,
          which the cruder bots skip; taken out of the tab order with
          `tabindex="-1"`; and hidden from assistive technology by
          `aria-hidden` on the wrapper, so nothing announces a field that must
          stay empty. Not the `hidden` attribute — Tailwind 4's preflight marks
          `[hidden]` `display:none!important`, which would put it in the group
          bots skip.
        */}
        <div class="ef-hp" aria-hidden="true">
          <label for="ef-website">Website</label>
          <input
            id="ef-website"
            name="website"
            type="text"
            tabIndex={-1}
            autocomplete="off"
            defaultValue=""
          />
        </div>

        {formError && (
          <p class="ef-alert" role="alert" tabIndex={-1} ref={alertRef}>
            {formError}
          </p>
        )}

        <button
          type="submit"
          class={`ef-submit${!ready ? ' ef-submit--pending' : status === 'sending' ? ' ef-submit--sending' : ''}`}
          disabled={!ready || status === 'sending'}
          aria-busy={status === 'sending' ? 'true' : undefined}
        >
          {status === 'sending' ? 'Sending…' : 'Send enquiry'}
          <span class="ef-submit__chev" aria-hidden="true">
            ›
          </span>
        </button>

        <p class="ef-note">
          Name and email are all we need. Everything else helps us answer faster.
        </p>

        {/* Progress is announced as well as shown: the button's label change is
            not conveyed to a screen reader that is not on the button. */}
        <span class="eq-sr" role="status" aria-live="polite">
          {status === 'sending' ? 'Sending your enquiry.' : ''}
        </span>
      </form>
    </div>
  );
}

interface FieldProps {
  name: FieldName;
  label: string;
  type?: 'text' | 'email' | 'tel';
  autocomplete?: string;
  required?: boolean;
  multiline?: boolean;
  error?: string;
}

/**
 * One labelled field. The `<label>` is always present and always visible — a
 * placeholder disappears the moment there is a value in the box, which is
 * exactly when a buyer checking a long form needs to know what the box is.
 */
function Field({ name, label, type = 'text', autocomplete, required, multiline, error }: FieldProps) {
  const id = `ef-${name}`;
  const errorId = `${id}-error`;

  return (
    <div class="ef-field">
      <label for={id}>
        {label}
        {required && (
          <>
            {' '}
            <span class="ef-field__req">
              required<span class="eq-sr"> field</span>
            </span>
          </>
        )}
      </label>

      {multiline ? (
        <textarea
          id={id}
          name={name}
          rows={5}
          maxLength={4000}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          autocomplete={autocomplete}
          aria-required={required ? 'true' : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      )}

      {error && (
        <p class="ef-field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
