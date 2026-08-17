/**
 * The copy-link control on a product page.
 *
 * WHY ONLY THIS ONE CONTROL NEEDS SCRIPT
 *
 * WhatsApp and email are plain anchors — `https://wa.me/?text=…` and
 * `mailto:?subject=…&body=…` — built on the server by `src/lib/share.ts`. They
 * work with JavaScript off, they work for a crawler, and they cost nothing. Only
 * "copy link" cannot be an anchor, because putting text on the clipboard is not
 * something markup can do.
 *
 * WHY THIS IS NOT A PREACT ISLAND
 *
 * Same reason as `quick-enquiry.ts`: the markup is static and its only dynamic
 * behaviour is "act, then say what happened". An island would move the row's
 * scoped CSS out of the component for nothing.
 *
 * WHY THERE IS A SECOND COPY MECHANISM
 *
 * `navigator.clipboard` is only defined in a secure context. The deployed site
 * is HTTPS and localhost counts as secure, so it is there in practice — but a
 * preview served over plain HTTP on a LAN address is not, and that is exactly
 * how this site gets shown to the client. The `execCommand` path is deprecated
 * and universally supported, so the control keeps its promise on both. A button
 * labelled "Copy link" that silently does nothing is the dead-control defect
 * this codebase removed from the footer once already.
 *
 * FEEDBACK IS ANNOUNCED, NOT JUST SHOWN
 *
 * The label swaps to "Copied" and the same word is written to a `role="status"`
 * region. A visible-only change is invisible to a screen reader, and swapping
 * the label alone is not reliably announced when focus is already on the button.
 *
 * The accessible name of this button is its own text content, which is what
 * keeps WCAG 2.5.3 (Label in Name) satisfied through the swap — the visible word
 * and the announced word stay the same word. Do not add an `aria-label` here:
 * the catalogue already shipped a serious Label in Name failure on every product
 * card that way (docs/TRAPS.md).
 */

/** How long "Copied" stays before the label returns to "Copy link". */
const REVERT_MS = 2400;

/**
 * Clipboard write, with the non-secure-context fallback. Resolves to whether the
 * text actually made it — never throws, because a rejected clipboard permission
 * must read as "not copied" and not as an unhandled error in the console.
 */
async function writeToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission refused, or a browser that defines the API and blocks it.
      // Fall through to the legacy path rather than giving up here.
    }
  }

  /*
   * `execCommand` is read off the document rather than called directly, and that
   * is deliberate on two counts. It is genuine feature detection — the method is
   * deprecated and a browser is entitled to drop it, in which case this must
   * report "not copied" rather than throw. And it keeps TypeScript's deprecation
   * diagnostic off the shared `astro check` output, which is a short, curated
   * list this repo keeps at zero errors and seven known hints.
   *
   * DO NOT DELETE THIS BRANCH AS DEAD MODERNISATION. It is the only path that
   * works outside a secure context, which is how the site gets shown over a LAN
   * address, and it also covers a browser that defines the Clipboard API and
   * refuses the permission.
   */
  const exec = (document as Document & { execCommand?: (command: string) => boolean }).execCommand;
  if (typeof exec !== 'function') return false;

  const field = document.createElement('textarea');
  field.value = text;
  // Off-screen but still focusable and selectable. `readonly` stops a mobile
  // keyboard opening; `position: fixed` keeps the page from scrolling to it.
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.top = '0';
  field.style.left = '-9999px';
  document.body.appendChild(field);

  try {
    field.select();
    field.setSelectionRange(0, text.length);
    return exec.call(document, 'copy');
  } catch {
    return false;
  } finally {
    field.remove();
  }
}

function enhance(button: HTMLButtonElement): void {
  const url = button.dataset.shareCopy;
  if (!url) return;

  const label = button.querySelector<HTMLElement>('[data-share-label]');
  // Scoped to the button's own row rather than the document, so this stays
  // correct if a second share row ever renders on one page.
  const status = button.closest('[data-share]')?.querySelector<HTMLElement>('[data-share-status]');
  const idle = label?.textContent ?? 'Copy link';
  let timer: number | undefined;

  const say = (text: string): void => {
    if (label) label.textContent = text;
    // Cleared and re-set so an identical message is announced a second time; a
    // live region whose text has not changed is not re-read.
    if (status) {
      status.textContent = '';
      status.textContent = text;
    }
  };

  button.addEventListener('click', async () => {
    const copied = await writeToClipboard(url);

    window.clearTimeout(timer);
    say(copied ? 'Copied' : 'Press Ctrl+C to copy');

    if (!copied) {
      // Nothing landed on the clipboard, so the address bar is the honest
      // fallback. Said rather than pretended.
      timer = window.setTimeout(() => say(idle), REVERT_MS * 2);
      return;
    }

    timer = window.setTimeout(() => say(idle), REVERT_MS);
  });

  // Live only now. Until this runs the control is hidden by `html[data-js]`
  // gating in ShareRow.astro, so a visitor without JavaScript is never shown a
  // button that cannot do anything — the same rule the enquiry buttons, the
  // quick-enquiry forms and the catalogue filter bar already follow.
  button.dataset.shareReady = '';
}

export function initShare(): void {
  document
    .querySelectorAll<HTMLButtonElement>('button[data-share-copy]')
    .forEach((button) => enhance(button));
}
