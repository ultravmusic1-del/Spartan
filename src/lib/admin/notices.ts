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
