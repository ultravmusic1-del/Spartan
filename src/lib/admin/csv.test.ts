import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';

describe('toCsv', () => {
  it('writes a header row from the column list', () => {
    expect(toCsv([{ a: '1', b: '2' }], ['a', 'b'])).toBe('a,b\r\n1,2');
  });

  it('quotes fields containing a comma, a quote or a newline', () => {
    const rows = [{ v: 'a,b' }, { v: 'say "hi"' }, { v: 'line1\nline2' }];
    expect(toCsv(rows, ['v'])).toBe('v\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"');
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(toCsv([{ v: null }, { v: undefined }], ['v'])).toBe('v\r\n\r\n');
  });

  /*
   * A buyer's message starting with `=` is data, but Excel and Sheets treat a
   * leading =, +, - or @ as a formula. Prefixing with a single quote is the
   * standard neutralisation and is stripped by the spreadsheet on display.
   */
  it('neutralises formula injection without losing the character', () => {
    expect(toCsv([{ v: '=1+1' }], ['v'])).toBe('v\r\n"\'=1+1"');
    expect(toCsv([{ v: '@SUM(A1)' }], ['v'])).toBe('v\r\n"\'@SUM(A1)"');
    expect(toCsv([{ v: '-5' }], ['v'])).toBe('v\r\n"\'-5"');
    expect(toCsv([{ v: '+1' }], ['v'])).toBe('v\r\n"\'+1"');
  });

  it('leaves an ordinary value untouched', () => {
    expect(toCsv([{ v: 'Gulf Contracting' }], ['v'])).toBe('v\r\nGulf Contracting');
  });

  it('renders numbers without quoting them', () => {
    expect(toCsv([{ lines: 2, units: 212 }], ['lines', 'units'])).toBe('lines,units\r\n2,212');
  });

  it('emits only a header for no rows', () => {
    expect(toCsv([], ['a', 'b'])).toBe('a,b');
  });
});
