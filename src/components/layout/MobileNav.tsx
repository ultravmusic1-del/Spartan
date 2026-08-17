import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { isCurrentNavItem, type NavItem } from '../../lib/nav';

/*
 * `NavItem` and `isCurrentNavItem` used to live in this file and are now in
 * `src/lib/nav.ts`, re-exported here only so existing importers keep working.
 * They moved because the dropdown made them matter to a second renderer and
 * because pure logic in a `.tsx` cannot be unit-tested without Preact in the
 * way — `src/lib/nav.test.ts` covers them directly now.
 */
export { isCurrentNavItem, type NavItem } from '../../lib/nav';

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
 *
 * THE PANEL IS FLAT AND ALWAYS OPEN, unlike the desktop dropdown. There is no
 * accordion: the panel already scrolls, and collapsing the two divisions would
 * put a disclosure widget — with its own state, its own keyboard contract and
 * its own hydration timing — between a buyer on a phone and the fifteen ranges
 * they came to browse. Every destination is one tap from here.
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
              // page the Categories link is lit, because that is the section you
              // are in, but it is not the page you are on — and saying otherwise
              // would tell a screen reader the user is somewhere they are not.
              const isPage = current === i.href;
              return (
                <div key={i.href}>
                  <a
                    href={i.href}
                    class={isCurrent ? 'mnav-link mnav-link--on' : 'mnav-link'}
                    aria-current={isPage ? 'page' : undefined}
                  >
                    {i.label}
                  </a>

                  {i.groups?.map((group) => (
                    <div key={group.href} class="mnav-group">
                      <a
                        href={group.href}
                        class="mnav-division"
                        aria-current={current === group.href ? 'page' : undefined}
                      >
                        {group.label}
                      </a>
                      {group.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          class="mnav-sub"
                          aria-current={current === link.href ? 'page' : undefined}
                        >
                          {link.label}
                          {/* The range is real and its page says so in full; an
                              entry indistinguishable from a stocked one would be
                              a small untrue claim about stock. Same word as the
                              desktop panel — see .nav__soon in Header.astro for
                              why it is "Soon" and not the full phrase. */}
                          {link.expanding && <span class="mnav-soon">Soon</span>}
                        </a>
                      ))}
                    </div>
                  ))}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
