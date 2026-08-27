import { describe, it, expect } from 'vitest';
import { readProductContext, productUrl, prefillMessage } from './enquiry-prefill';

const ORIGIN = 'https://spartan-ebon.vercel.app';

describe('readProductContext', () => {
  it('reads a product and its intent', () => {
    expect(
      readProductContext('?product=grip-guard-gp3&name=Grip%20Guard%20GP3&intent=quote', 'info'),
    ).toEqual({ slug: 'grip-guard-gp3', name: 'Grip Guard GP3', intent: 'quote' });
  });

  it('works with or without the leading question mark', () => {
    const withMark = readProductContext('?product=pumps&name=Pumps&intent=info', 'info');
    const without = readProductContext('product=pumps&name=Pumps&intent=info', 'info');
    expect(withMark).toEqual(without);
  });

  /**
   * The whole point of the fallback. A link that loses `intent` must still say
   * the sentence that page would have said anyway, never the other one.
   */
  it('falls back to the page intent when intent is missing or unrecognised', () => {
    expect(readProductContext('?product=pumps&name=Pumps', 'info')?.intent).toBe('info');
    expect(readProductContext('?product=pumps&name=Pumps', 'quote')?.intent).toBe('quote');
    expect(readProductContext('?product=pumps&name=Pumps&intent=refund', 'quote')?.intent).toBe(
      'quote',
    );
  });

  it('returns null when there is no product', () => {
    expect(readProductContext('', 'info')).toBeNull();
    expect(readProductContext('?utm_source=email', 'info')).toBeNull();
    expect(readProductContext('?product=&name=Pumps', 'info')).toBeNull();
  });

  it('returns null when the product has no name to show', () => {
    expect(readProductContext('?product=pumps', 'info')).toBeNull();
    expect(readProductContext('?product=pumps&name=%20%20', 'info')).toBeNull();
  });

  /**
   * A slug is rebuilt into a URL, so it is the one value that must not be
   * allowed to be creative. Anything outside the catalogue's own shape is
   * refused rather than escaped.
   */
  it('refuses a slug that is not a catalogue slug', () => {
    for (const slug of [
      '../../admin',
      'https://evil.example/x',
      'Grip-Guard',
      'grip guard',
      'grip_guard',
      'grip--guard',
      '-pumps',
      'pumps-',
    ]) {
      expect(readProductContext(`?product=${encodeURIComponent(slug)}&name=X`, 'info')).toBeNull();
    }
  });

  it('refuses values longer than the enquiry schema would accept', () => {
    expect(readProductContext(`?product=${'a'.repeat(121)}&name=X`, 'info')).toBeNull();
    expect(readProductContext(`?product=pumps&name=${'N'.repeat(201)}`, 'info')).toBeNull();
    expect(readProductContext(`?product=pumps&name=${'N'.repeat(200)}`, 'info')).not.toBeNull();
  });

  /**
   * §19's trap, in a new place. `+` means space in a query string, `&` starts
   * the next parameter and `#` starts the fragment — so a product whose name
   * carries any of them is the case that silently arrives wrong. These are the
   * real strings from the catalogue.
   */
  it('round-trips a name containing +, & and #', () => {
    for (const name of [
      'White aluminium frame + iron back cover',
      'Gloves & Gauntlets',
      'Panel #91948',
      'Khaki | Light blue',
    ]) {
      const search = `?product=pumps&name=${encodeURIComponent(name)}&intent=info`;
      expect(readProductContext(search, 'info')?.name).toBe(name);
    }
  });

  /** A newline would break the two-line message into three and read as the buyer's own text. */
  it('collapses whitespace in the name', () => {
    const search = `?product=pumps&name=${encodeURIComponent('Orbit\n\nFan   AF-40W')}`;
    expect(readProductContext(search, 'info')?.name).toBe('Orbit Fan AF-40W');
  });
});

describe('productUrl', () => {
  it('builds a product page URL on this origin', () => {
    expect(productUrl('grip-guard-gp3', ORIGIN)).toBe(`${ORIGIN}/products/grip-guard-gp3`);
  });

  it('does not double the slash when the origin carries one', () => {
    expect(productUrl('pumps', 'https://example.com/')).toBe('https://example.com/products/pumps');
  });
});

describe('prefillMessage', () => {
  const context = { slug: 'grip-guard-gp3', name: 'Grip Guard GP3', intent: 'quote' as const };

  it('asks for a quotation when that is the button that was pressed', () => {
    expect(prefillMessage(context, ORIGIN)).toBe(
      `Please send a quotation for:\n\nGrip Guard GP3\n${ORIGIN}/products/grip-guard-gp3\n\n`,
    );
  });

  it('asks for information when that is the button that was pressed', () => {
    expect(prefillMessage({ ...context, intent: 'info' }, ORIGIN)).toBe(
      `I'd like more information about:\n\nGrip Guard GP3\n${ORIGIN}/products/grip-guard-gp3\n\n`,
    );
  });

  it('says two different things, so the sales team can tell the two apart', () => {
    expect(prefillMessage(context, ORIGIN)).not.toBe(
      prefillMessage({ ...context, intent: 'info' }, ORIGIN),
    );
  });

  /** The link is built, never carried, so it cannot point off-site. */
  it('links to this origin even when the name looks like a URL', () => {
    const message = prefillMessage(
      { slug: 'pumps', name: 'https://evil.example/free-gloves', intent: 'info' },
      ORIGIN,
    );
    expect(message).toContain(`${ORIGIN}/products/pumps`);
    expect(message.split('\n').at(-3)).toBe(`${ORIGIN}/products/pumps`);
  });
});
