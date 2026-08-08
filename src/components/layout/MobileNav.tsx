import { useLayoutEffect, useRef, useState } from 'preact/hooks';

export interface NavItem {
  href: string;
  label: string;
  /**
   * Path prefix this item also owns, for links that head a section rather than
   * naming a single page. Catalogue is the only one: `/catalogue` is the index
   * and the 15 category pages live beneath it, so an exact-match-only rule
   * would leave the nav unmarked on 15 of the 16 pages the item covers.
   *
   * Product pages are deliberately NOT included — they live at `/products/…`
   * and reach the catalogue through their breadcrumb, which already says where
   * they sit.
   */
  section?: string;
}

/**
 * Whether a nav item is the page you are on, or the section you are in.
 * Shared by the desktop menu in Header.astro and the panel below, so the two
 * can never disagree about which link is lit.
 */
export function isCurrentNavItem(item: NavItem, current: string | undefined): boolean {
  if (!current) return false;
  if (current === item.href) return true;
  return item.section ? current.startsWith(`${item.section}/`) : false;
}

interface Props {
  items: NavItem[];
  /** Normalised current pathname, used to mark the active item. */
  current?: string;
}

/**
 * MobileNav — the hamburger trigger and full-screen menu panel below 1081px.
 *
 * Hydrated with `client:media="(max-width: 1080px)"`, so desktop ships none of
 * this JavaScript. The trigger is still server-rendered at every width; CSS in
 * Header.astro hides it from 1081px up, where the desktop menu takes over.
 *
 * While the panel is open it is a modal dialog: focus moves into it, Tab and
 * Shift+Tab cycle within it, the page behind cannot scroll, and Escape closes
 * it and returns focus to the trigger.
 */
export default function MobileNav({ items, current }: Props) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  // A layout effect, not a passive one: the listener has to be installed in the
  // same frame the panel mounts. With useEffect there is a window between paint
  // and the effect in which Tab is unhandled, and a fast key repeat walks focus
  // straight out of the panel.
  useLayoutEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      // Every focusable element in the panel is an anchor or a button, so this
      // selector is exhaustive; nothing else in here can take focus.
      const f = panel.querySelectorAll<HTMLElement>('a,button');
      if (!f.length) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      const active = document.activeElement;

      // Clicking any non-focusable part of the panel — its background, the bar
      // beside the close button — drops focus onto <body>. From there native
      // Tab order resumes at the top of the document and walks out to the
      // header behind the panel, which `aria-modal` promises cannot happen.
      // Anything outside the panel is pulled back to the near edge.
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
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('a')?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        class="mnav-trigger"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      {open && (
        <div
          id="mobile-nav"
          ref={panelRef}
          class="mnav-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <div class="mnav-panel__bar">
            <button type="button" class="mnav-close" aria-label="Close menu" onClick={close}>
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
          <nav class="mnav-list" aria-label="Primary">
            {items.map((i) => {
              const isCurrent = isCurrentNavItem(i, current);
              // `aria-current="page"` only for an exact match. On a category
              // page the Catalogue link is lit, because that is the section you
              // are in, but it is not the page you are on — and saying otherwise
              // would tell a screen reader the user is somewhere they are not.
              const isPage = current === i.href;
              return (
                <a
                  key={i.href}
                  href={i.href}
                  class={isCurrent ? 'mnav-link mnav-link--on' : 'mnav-link'}
                  aria-current={isPage ? 'page' : undefined}
                >
                  {i.label}
                </a>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
