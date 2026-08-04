import { useEffect, useRef, useState } from 'preact/hooks';
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
 * Hydrated with `client:visible`, so a page of 72 cards does not pay for 72
 * islands before they are scrolled to.
 *
 * Two things are deliberately not left to colour alone. The confirmation
 * changes the *label* as well as the tint, and it is announced through a live
 * region: a tick that only appears is not perceivable without sight, and this
 * button is the only way to build an enquiry. The announcement carries the
 * running quantity so a second add of the same product is a different string —
 * an unchanged live region is not re-announced.
 *
 * Without JavaScript the button removes itself rather than sitting there dead
 * (see `.eq-add--pending` in src/styles/enquiry.css). The basket genuinely
 * requires script; a control that looks live and does nothing is worse than no
 * control at all. Every page that carries this button also carries a real
 * server-rendered route to /enquiry and /contact, so nothing is unreachable.
 */
export default function EnquiryButton({ slug, name, variant = 'card' }: Props) {
  const [ready, setReady] = useState(false);
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState('');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setReady(true);
    return () => window.clearTimeout(timer.current);
  }, []);

  const onClick = () => {
    addItem({ slug, name });
    const qty = enquiry.get().find((i) => i.slug === slug)?.qty ?? 1;

    setAdded(true);
    setMessage(`${name} added to your enquiry list. Quantity ${qty}.`);

    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setAdded(false);
      setMessage('');
    }, 2400);
  };

  const label = variant === 'solid' ? 'Add to enquiry' : 'Enquire';
  const doneLabel = variant === 'solid' ? 'Added to enquiry' : 'Added';

  return (
    <div class={`eq-add-wrap${ready ? '' : ' eq-add-wrap--pending'}`}>
      <button
        type="button"
        class={`eq-add eq-add--${variant}${added ? ' eq-add--done' : ''}`}
        aria-label={`Add ${name} to enquiry list`}
        onClick={onClick}
      >
        {added ? <TickIcon /> : <PlusIcon />}
        <span>{added ? doneLabel : label}</span>
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
