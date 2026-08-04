import { useEffect, useRef, useState } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { enquiry } from '../../stores/enquiry';
import { openDrawer } from '../../stores/drawer';

/**
 * EnquiryBadge — the basket count in the header, and the drawer's trigger.
 *
 * Hydrated with `client:idle`. It renders no button at zero: an empty basket
 * has nothing to open and nothing to report.
 *
 * The live region, however, is rendered at every count including zero. A region
 * inserted into the document at the same moment its text appears is unreliably
 * announced — it has to already be there and watched. That empty span is
 * `position: absolute` at 1px, so "renders nothing at 0" still holds visually
 * and in layout.
 *
 * The first pass is never announced. `useStore` returns `store.get()` on the
 * very first render, and `get()` on an unmounted persistent atom restores from
 * localStorage — so a returning buyer's count is already correct before the
 * first effect runs, and announcing it would be reading the page furniture
 * aloud rather than reporting a change.
 *
 * Nothing here moves focus. The count changes while the buyer is somewhere else
 * on the page, so a polite region is the whole mechanism.
 */
export default function EnquiryBadge() {
  const items = useStore(enquiry);
  const count = items.reduce((n, i) => n + i.qty, 0);

  const [mounted, setMounted] = useState(false);
  const [message, setMessage] = useState('');
  const settled = useRef(false);

  // The badge waits one render before it can appear. `useStore` already has the
  // restored count on the first pass, so without this the very render that
  // hydrates would add a <button> where the server sent only the live region —
  // a structural mismatch that Preact reports and then repairs by walking the
  // wrong nodes. Deferring by one commit makes hydration an exact match and
  // turns the badge's arrival into an ordinary update.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!settled.current) {
      settled.current = true;
      return;
    }
    setMessage(
      count === 0
        ? 'Your enquiry list is empty.'
        : `${count} ${count === 1 ? 'item' : 'items'} in your enquiry list.`,
    );
  }, [count]);

  return (
    <>
      {mounted && count > 0 && (
        <button
          type="button"
          class="eq-badge"
          data-enquiry-trigger
          aria-haspopup="dialog"
          aria-label={`Open enquiry list, ${count} ${count === 1 ? 'item' : 'items'}`}
          onClick={openDrawer}
        >
          <svg
            class="eq-badge__icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M8 4h11M8 12h11M8 20h11M3.5 4h.01M3.5 12h.01M3.5 20h.01" />
          </svg>
          {/* Decorative: the count is already in the button's accessible name,
              and reading it twice is noise. Three digits would burst a 44px
              square, so 99+ is the ceiling on the pip, not on the basket. */}
          <span class="eq-badge__pip" aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        </button>
      )}

      <span class="eq-sr" role="status" aria-live="polite">
        {message}
      </span>
    </>
  );
}
