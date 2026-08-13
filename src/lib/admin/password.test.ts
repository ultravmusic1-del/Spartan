import { describe, it, expect } from 'vitest';
import { checkPassword, MIN_PASSWORD_LENGTH, PASSWORD_HELP } from './password';

const long = 'correct horse battery staple';

describe('checkPassword', () => {
  it('accepts a long passphrase', () => {
    expect(checkPassword(long, long)).toBeNull();
  });

  it('rejects an empty password before anything else', () => {
    expect(checkPassword('', '')).toBe('Enter a new password.');
  });

  it('rejects one shorter than the minimum', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    expect(checkPassword(short, short)).toContain('too short');
  });

  it('accepts one exactly at the minimum', () => {
    const exact = 'a'.repeat(MIN_PASSWORD_LENGTH);
    expect(checkPassword(exact, exact)).toBeNull();
  });

  it('rejects a mismatch', () => {
    expect(checkPassword(long, long + 'x')).toBe('The two passwords do not match.');
  });

  /*
   * `'🔐'.length` is 2, so a naive length check counts six emoji as twelve
   * characters. Whatever one thinks of emoji in a password, the rule has to
   * mean what it says.
   */
  it('counts code points, not UTF-16 units', () => {
    const sixEmoji = '🔐'.repeat(6);
    expect(sixEmoji.length).toBe(12);
    expect(checkPassword(sixEmoji, sixEmoji)).toContain('too short');

    const twelveEmoji = '🔐'.repeat(MIN_PASSWORD_LENGTH);
    expect(checkPassword(twelveEmoji, twelveEmoji)).toBeNull();
  });

  /*
   * A space is a legal character. Trimming before comparing would accept a
   * password here and then set one the person cannot reproduce by typing it.
   */
  it('does not trim, so a trailing space is a real difference', () => {
    expect(checkPassword(long, long + ' ')).toBe('The two passwords do not match.');
    expect(checkPassword(` ${long} `, ` ${long} `)).toBeNull();
  });

  it('publishes help text that states the same minimum it enforces', () => {
    expect(PASSWORD_HELP).toContain(String(MIN_PASSWORD_LENGTH));
  });
});
