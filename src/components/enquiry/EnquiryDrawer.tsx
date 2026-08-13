import { useLayoutEffect, useRef } from 'preact/hooks';
import { useStore } from '@nanostores/preact';
import { enquiry, removeItem, setNote, setQty } from '../../stores/enquiry';
import { closeDrawer, drawerOpen } from '../../stores/drawer';

const FOCUSABLE = 'a[href],button,input,textarea,select,[tabindex]:not([tabindex="-1"])';

/**
 * EnquiryDrawer — the basket itself, as a slide-over modal dialog.
 *
 * Hydrated with `client:idle` from the header, so it exists on every page and
 * the badge can always open it. It renders nothing at all while closed, so a
 * page that is never opened pays for the module and not for the DOM.
 *
 * The focus trap is MobileNav's, deliberately: one verified implementation
 * rather than a second invented one. Both of its hard-won details are kept —
 *
 *  - `useLayoutEffect`, not `useEffect`. The listener has to be installed in the
 *    same frame the panel mounts; a passive effect leaves a window between paint
 *    and installation in which Tab is unhandled, and a fast key repeat walks
 *    focus straight out.
 *  - focus landing on a non-focusable part of the panel. Clicking the panel
 *    background, or the bar beside the close button, drops focus onto <body>,
 *    and from there native Tab order resumes at the top of the document and
 *    walks out to the header behind the panel — which `aria-modal` promises
 *    cannot happen. Anything outside the panel is pulled back to the near edge.
 *
 * The one difference is the focusable selector: this panel holds number fields
 * and textareas, so `a,button` would not be exhaustive here.
 */
export default function EnquiryDrawer() {
  const open = useStore(drawerOpen);
  const items = useStore(enquiry);
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  const close = () => {
    closeDrawer();
    // Restored before the panel unmounts, exactly as MobileNav does it: focus
    // moves off the panel first, then the panel goes.
    const target = restoreRef.current;
    if (target?.isConnected) {
      target.focus();
      return;
    }
    // The trigger can legitimately be gone — emptying the basket from inside
    // the drawer removes the badge that opened it. Fall back to the nearest
    // thing that is definitely still there rather than dropping focus to <body>,
    // where the next Tab would restart at the top of the document.
    const fallback =
      document.querySelector<HTMLElement>('[data-enquiry-trigger]') ??
      document.querySelector<HTMLElement>('.site-header a, .site-header button');
    fallback?.focus();
  };

  useLayoutEffect(() => {
    if (!open) return;

    const previous = document.activeElement;
    restoreRef.current = previous instanceof HTMLElement && previous !== document.body ? previous : null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const f = panel.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      const active = document.activeElement;

      if (!(active instanceof Node) || !panel.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    const scrollLock = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('button')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = scrollLock;
    };
  }, [open]);

  if (!open) return null;

  const count = items.reduce((n, i) => n + i.qty, 0);

  /**
   * The store is the only place quantity is clamped, so the field is written
   * back from it rather than from a second copy of the same rule. That also
   * covers the case where the clamp produces the value already held: nothing
   * re-renders, so without this the field would keep showing "100000".
   */
  const commitQty = (slug: string, field: HTMLInputElement) => {
    setQty(slug, Number.parseInt(field.value, 10));
    const stored = enquiry.get().find((i) => i.slug === slug);
    if (stored) field.value = String(stored.qty);
  };

  return (
    <div class="eq-drawer">
      <div class="eq-drawer__scrim" onClick={close} />

      <div
        class="eq-drawer__panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eq-drawer-title"
      >
        <div class="eq-drawer__bar">
          <h2 class="eq-drawer__title" id="eq-drawer-title">
            Enquiry list
          </h2>
          <button type="button" class="eq-drawer__close" aria-label="Close enquiry list" onClick={close}>
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

        <div class="eq-drawer__body">
          {items.length === 0 ? (
            <div class="eq-empty">
              <p class="eq-empty__title">Your enquiry list is empty.</p>
              <p class="eq-empty__note">
                Add products as you browse, then send the whole list as one enquiry.
              </p>
              <a class="eq-empty__link" href="/catalogue">
                Browse the catalogue
              </a>
            </div>
          ) : (
            <ul class="eq-list">
              {items.map((item) => (
                <li class="eq-item" key={item.slug}>
                  <div class="eq-item__head">
                    <p class="eq-item__name">{item.name}</p>
                    <button
                      type="button"
                      class="eq-item__remove"
                      aria-label={`Remove ${item.name} from enquiry list`}
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

                  <div class="eq-qty">
                    <button
                      type="button"
                      class="eq-qty__step"
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
                      class="eq-qty__field"
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
                      class="eq-qty__step"
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

                  <label class="eq-item__note">
                    <span class="eq-sr">Note for {item.name}</span>
                    <textarea
                      class="eq-item__field"
                      rows={2}
                      maxLength={500}
                      placeholder="Add a note: size, colour, certification"
                      value={item.note}
                      onInput={(e) => setNote(item.slug, e.currentTarget.value)}
                    />
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* No footer on an empty list: a "Review enquiry" link with nothing to
            review is a dead end dressed as an action, and the empty state above
            already carries the one link worth offering. */}
        {items.length > 0 && (
          <div class="eq-drawer__foot">
            <p class="eq-drawer__count">
              {count} {count === 1 ? 'item' : 'items'}
            </p>
            {/* No prices anywhere on this site: the next step is a quotation
                request, not a checkout. */}
            <a class="eq-drawer__review" href="/enquiry">
              Review enquiry
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
