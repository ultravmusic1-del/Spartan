/**
 * The messages an admin page may show in response to a redirect.
 *
 * WHY A WHITELIST AND NOT A MESSAGE IN THE URL. Every one of these codes
 * arrives in a query string, which is anyone's to write — a link in an email, a
 * bookmark, a page somebody else controls. Rendering the parameter itself, even
 * escaped as text, lets a stranger put words in the admin's mouth: "Your
 * session is insecure, sign in again at ..." rendered inside the real admin
 * chrome is a credible phish that costs nothing to send. The login page already
 * takes the weaker precaution of rendering its `error` parameter as text
 * content rather than markup; this is the stronger one, and it is available
 * here because the set of things that can go wrong is closed.
 *
 * An unrecognised code is therefore not an error to report — it is a parameter
 * to ignore. `noticeFor` returns null and the page renders nothing.
 */
export type NoticeTone = 'error' | 'success';

export interface Notice {
  readonly text: string;
  readonly tone: NoticeTone;
}

export const ADMIN_NOTICES = {
  saved: { text: 'Status updated.', tone: 'success' },
  'password-changed': {
    text: 'Password changed, and you are signed in. Any other device using the old password will need the new one.',
    tone: 'success',
  },
  'not-found': {
    text: 'That enquiry does not exist. Check the link, or pick one from the list below.',
    tone: 'error',
  },
  'bad-request': { text: 'That request was not valid, so nothing was changed.', tone: 'error' },
  'save-failed': {
    text: 'Could not save that change — the database rejected it or was unreachable. Nothing was changed; please try again.',
    tone: 'error',
  },
  'save-unconfigured': {
    text: 'Could not save that change: this deployment has no database credentials, so the admin is read-only. Nothing was changed.',
    tone: 'error',
  },
  /*
   * NEITHER OF THE SUCCESS MESSAGES BELOW CLAIMS THE CHANGE IS LIVE, because
   * neither knows. A save reaches Postgres; the site is rendered by a build,
   * and a build can fail. A deploy hook returns a job id and knows nothing
   * about the outcome. That is rule 2's principle in a second place: an
   * enquiry is never reported as sent when it was not, and an edit is never
   * reported as published when a build might be failing.
   */
  'catalogue-saved': {
    text: 'Saved. The change is in the database and will appear on the site at the next build.',
    tone: 'success',
  },
  /*
   * It does NOT say "check the highlighted fields". Nothing is highlighted:
   * the save is a POST that redirects, so the form comes back showing the last
   * saved values and the rejected typing is gone. Saying so is worse copy and
   * true copy, and an editor who is told to look for highlighting that does not
   * exist will hunt for it.
   */
  'catalogue-invalid': {
    text: 'That change was rejected because the build would reject it too, so nothing was saved. The most likely cause is the order number or one of the links — a datasheet must end in .pdf and a Kavalani link must be on kavalani.com.',
    tone: 'error',
  },
  'publish-requested': {
    text: 'Build requested. It usually takes about a minute for changes to appear on the live site.',
    tone: 'success',
  },
  'publish-unconfigured': {
    text: 'Publishing is not configured on this deployment, so no build was requested.',
    tone: 'error',
  },
  'publish-failed': {
    text: 'The build could not be requested. Nothing was published.',
    tone: 'error',
  },
  /*
   * BANNERS. A newly uploaded one is hidden on purpose — see the `enabled`
   * column's comment — so the success message says so rather than leaving
   * someone waiting for it to appear.
   */
  'banner-uploaded': {
    text: 'Banner uploaded. It stays hidden until you switch it on, and appears on the site at the next build.',
    tone: 'success',
  },
  'banner-saved': {
    text: 'Banner updated. The change appears on the site at the next build.',
    tone: 'success',
  },
  'banner-deleted': { text: 'Banner deleted, and its image file with it.', tone: 'success' },
  'banner-invalid-type': {
    text: 'That file was not a JPEG or a PNG, so nothing was uploaded.',
    tone: 'error',
  },
  'banner-invalid-shape': {
    text: 'The hero band is a wide strip, so a banner has to be roughly four times as wide as it is tall — 2800 × 700 is the size to aim for. Nothing was uploaded.',
    tone: 'error',
  },
  'banner-too-small': {
    text: 'That image is too small to stay sharp across the hero band. It needs to be at least 1400 pixels wide, and 2800 is better. Nothing was uploaded.',
    tone: 'error',
  },
  'banner-too-large': {
    text: 'That image is over a limit — a file must be under 8 MB and no more than 6000 pixels wide. Nothing was uploaded.',
    tone: 'error',
  },
} as const satisfies Record<string, Notice>;

export type NoticeCode = keyof typeof ADMIN_NOTICES;

export function isNoticeCode(value: string): value is NoticeCode {
  return Object.prototype.hasOwnProperty.call(ADMIN_NOTICES, value);
}

/** The notice for a `?notice=` parameter, or null if there is nothing to say. */
export function noticeFor(value: string | null): Notice | null {
  if (value === null || !isNoticeCode(value)) return null;
  return ADMIN_NOTICES[value];
}

/**
 * The dimensions a rejected upload actually had, if the URL carries them.
 *
 * THE WHITELIST IS NOT BEING WIDENED. Every word an admin reads still comes out
 * of `ADMIN_NOTICES` above; this returns two NUMBERS to sit beside that
 * sentence. "The shape is wrong" is a poor message when the admin knows the
 * file was 1261 x 1561 and has no way to say so.
 *
 * A number coerced out of a query parameter is not attacker text. Anything that
 * is not a finite integer in a sane range becomes null and renders nothing —
 * `Number('<script>alert(1)</script>')` is NaN, and NaN fails every check here.
 * The upper bound is a rendering sanity limit, not a validation rule; the real
 * limits live in `BANNER_RULES`.
 */
export function dimensionsFrom(
  width: string | null,
  height: string | null,
): { width: number; height: number } | null {
  const w = Number(width);
  const h = Number(height);
  const sane = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 20000;
  return sane(w) && sane(h) ? { width: w, height: h } : null;
}
