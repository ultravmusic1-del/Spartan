import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { addItem, enquiry } from '../../stores/enquiry';

interface Props {
  slug: string;
  name: string;
  /**
   * `card` is the outline button inside a ProductCard, full width of the card.
   * `solid` is the primary CTA on a product detail page — the mockup's
   * "ADD TO ENQUIRY" in the spotlight block.
   */
  variant?: 'card' | 'solid';
}

/**
 * EnquiryButton — adds one product to the basket.
 *
 * Hydrated with `client:visible`, so a full page of cards does not pay for as many
 * islands before they are scrolled to.
 *
 * Two things are deliberately not left to colour alone. The state changes the
 * *label* as well as the tint, and every add is announced through a live region:
 * a tick that only appears is not perceivable without sight, and this button is
 * the only way to build an enquiry. The announcement carries the running quantity
 * so a second add of the same product is a different string — an unchanged live
 * region is not re-announced.
 *
 * THE BUTTON REFLECTS MEMBERSHIP, AND THAT IS THE POINT OF IT. It used to flash
 * "Added" for 2.4 seconds and then revert, so a product already on the list was
 * indistinguishable from one that was not, and a second click raised the quantity
 * to 2 with nothing on screen ever saying so. On a request for quotation that is
 * the buyer asking for twice what they wanted, found by nobody until the
 * quotation comes back wrong. The state now comes from the store rather than a
 * timer, so it survives a reload and flips back when the item is removed
 * elsewhere.
 *
 * A SECOND CLICK STILL ADDS, AND THAT IS DELIBERATE. `tests/e2e/enquiry.spec.ts`
 * holds it — "the same product again: units go up, lines do not" — and repeat-add
 * is a reasonable way to ask for two of something. The defect was never that the
 * quantity rose; it was that it rose invisibly. It is now on the button's face
 * the moment it happens, and adjustable in the drawer and on /enquiry.
 *
 * The membership state is gated on `ready`. `useStore` returns the persisted
 * basket on the very first render, so an ungated read would render "In your list"
 * where the server sent "Add to enquiry" — a hydration mismatch Preact repairs by
 * walking the wrong nodes. `EnquiryBadge` defers by one commit for the same
 * reason.
 *
 * Without JavaScript the button removes itself rather than sitting there dead
 * (see `.eq-add--pending` in src/styles/enquiry.css). The basket genuinely
 * requires script; a control that looks live and does nothing is worse than no
 * control at all. Every page that carries this button also carries a real
 * server-rendered route to /enquiry and /contact, so nothing is unreachable.
 */
export default function EnquiryButton({ slug, name, variant = 'card' }: Props) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const items = useStore(enquiry);

  useEffect(() => {
    setReady(true);
    return () => window.clearTimeout(timer.current);
  }, []);

  const entry = ready ? items.find((i) => i.slug === slug) : undefined;
  const inList = entry !== undefined;
  const qty = entry?.qty ?? 0;

  const onClick = () => {
    addItem({ slug, name });
    const next = enquiry.get().find((i) => i.slug === slug)?.qty ?? 1;
    setMessage(`${name} added to your enquiry list. Quantity ${next}.`);

    /* The live region is cleared again, the button is not. The message is an
       announcement of a change and has no business being re-read every time the
       user navigates past it; the membership state is carried by the label. */
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(''), 2400);
  };

  const label = variant === 'solid' ? 'Add to enquiry' : 'Enquire';
  /* The quantity is only spoken when it is not 1: "In your list (1)" reads as
     noise, and the number matters precisely when it is no longer the default. */
  const inListLabel = qty > 1 ? `In your list (${qty})` : 'In your list';
  const visible = inList ? inListLabel : label;

  /**
   * WCAG 2.5.3 Label in Name: the accessible name must CONTAIN the visible text
   * verbatim. A static `Add ${name} to enquiry list` does not contain "Enquire",
   * so a voice-control user saying "click Enquire" could not activate the button
   * that plainly reads ENQUIRE — and the name went stale the moment the label
   * changed to "Added". Deriving it from `visible` keeps both true in both
   * states. The full sentence is not lost: the live region below still announces
   * "<name> added to your enquiry list. Quantity N."
   *
   * axe's rule for this is experimental and off by default, so the e2e axe pass
   * never saw it; Lighthouse's a11y category weights it 0. It was a real defect
   * in both places regardless.
   */
  const ariaLabel = `${visible}: ${name}`;

  return (
    <div class={`eq-add-wrap${ready ? '' : ' eq-add-wrap--pending'}`}>
      <button
        type="button"
        class={`eq-add eq-add--${variant}${inList ? ' eq-add--done' : ''}`}
        aria-label={ariaLabel}
        onClick={onClick}
      >
        {inList ? <TickIcon /> : <PlusIcon />}
        <span>{visible}</span>
      </button>

      {/* Present from hydration, so the first message lands in a region the
          assistive technology is already watching. */}
      <span class="eq-sr" role="status" aria-live="polite">
        {message}
      </span>
    </div>
  );
}

/* Drawn, not typed: a glyph would inherit the display font's metrics and an
   emoji would render as a colour bitmap that ignores currentColor entirely. */
function PlusIcon() {
  return (
    <svg
      class="eq-add__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function TickIcon() {
  return (
    <svg
      class="eq-add__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12.5l5.5 5.5L20 7" />
    </svg>
  );
}
