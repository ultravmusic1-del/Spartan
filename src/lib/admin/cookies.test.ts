import { describe, it, expect } from 'vitest';
import { parseCookies } from './cookies';

describe('parseCookies', () => {
  it('returns nothing for an empty header', () => {
    expect(parseCookies('')).toEqual([]);
  });

  it('parses one pair', () => {
    expect(parseCookies('a=1')).toEqual([{ name: 'a', value: '1' }]);
  });

  it('parses several and trims the separator whitespace', () => {
    expect(parseCookies('a=1; b=2;c=3')).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
      { name: 'c', value: '3' },
    ]);
  });

  /*
   * Supabase session cookies are base64 and routinely end in '=' padding.
   * Splitting on every '=' rather than the first truncates the token, which
   * presents as an admin being randomly signed out rather than as a parse bug —
   * so this is the case most worth pinning down.
   */
  it('keeps an = inside the value', () => {
    expect(parseCookies('sb=eyJhbGc=')).toEqual([{ name: 'sb', value: 'eyJhbGc=' }]);
  });

  it('decodes percent-encoding', () => {
    expect(parseCookies('a=one%20two')).toEqual([{ name: 'a', value: 'one two' }]);
  });

  it('skips a malformed segment rather than throwing', () => {
    expect(parseCookies('a=1; garbage; b=2')).toEqual([
      { name: 'a', value: '1' },
      { name: 'b', value: '2' },
    ]);
  });

  it('skips a nameless cookie', () => {
    expect(parseCookies('=novalue; a=1')).toEqual([{ name: 'a', value: '1' }]);
  });

  it('keeps an empty value', () => {
    expect(parseCookies('a=; b=2')).toEqual([
      { name: 'a', value: '' },
      { name: 'b', value: '2' },
    ]);
  });

  /* A stray '%' makes decodeURIComponent throw. The raw value is still what the
     browser sent and is the best answer available — losing the whole cookie
     would sign the admin out over a cosmetic defect. */
  it('falls back to the raw value when percent-decoding fails', () => {
    expect(parseCookies('a=100%')).toEqual([{ name: 'a', value: '100%' }]);
  });
});
