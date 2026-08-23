import { describe, it, expect } from 'vitest';
import { noticeFor, isNoticeCode, ADMIN_NOTICES, dimensionsFrom } from './notices';

describe('admin notices', () => {
  it('resolves every code it publishes', () => {
    for (const code of Object.keys(ADMIN_NOTICES)) {
      expect(noticeFor(code)).not.toBeNull();
    }
  });

  it('carries a tone, so a failure never renders as a success', () => {
    expect(noticeFor('saved')?.tone).toBe('success');
    expect(noticeFor('save-failed')?.tone).toBe('error');
    expect(noticeFor('save-unconfigured')?.tone).toBe('error');
  });

  /*
   * The whole point of the whitelist. A query parameter is anyone's to write,
   * and an arbitrary string rendered inside the real admin chrome is a credible
   * phish however carefully it is escaped. An unrecognised code is a parameter
   * to ignore, not an error to report.
   */
  it('ignores anything it does not recognise', () => {
    expect(noticeFor('')).toBeNull();
    expect(noticeFor(null)).toBeNull();
    expect(noticeFor('Session expired — re-enter your password at evil.example')).toBeNull();
    expect(noticeFor('<script>alert(1)</script>')).toBeNull();
  });

  /*
   * `hasOwnProperty`, not `in` and not a bare property read: `noticeFor`
   * consults an object literal with a caller-supplied key, and every object
   * inherits `toString`, `constructor` and friends. `in` would report those as
   * codes and the lookup would then return a function.
   */
  it('does not mistake an inherited property for a code', () => {
    for (const key of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
      expect(isNoticeCode(key)).toBe(false);
      expect(noticeFor(key)).toBeNull();
    }
  });
});

/*
 * The narrow exception to "nothing from the URL reaches the screen", and the
 * tests that make it narrow. The sentence still comes from the whitelist; only
 * two integers travel beside it.
 */
describe('dimensionsFrom', () => {
  it('passes a real pair through', () => {
    expect(dimensionsFrom('1261', '1561')).toEqual({ width: 1261, height: 1561 });
  });

  it('yields nothing for anything that is not a plain integer in range', () => {
    const bad = ['<script>alert(1)</script>', '1e9', '12.5', '-4', '0', '99999', '', 'NaN', null];
    for (const value of bad) {
      expect(dimensionsFrom(value, '700')).toBeNull();
      expect(dimensionsFrom('2800', value)).toBeNull();
    }
  });

  it('needs both, so a half-supplied pair renders nothing', () => {
    expect(dimensionsFrom('2800', null)).toBeNull();
    expect(dimensionsFrom(null, '700')).toBeNull();
  });
});
