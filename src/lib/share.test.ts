import { describe, it, expect } from 'vitest';
import { shareTargets } from './share';

const product = {
  slug: 'slim-led-panels',
  name: 'Slim LED Panels',
  variantLabel: null,
  categoryId: 'lighting',
  images: ['p04-slim-led-panels.png'],
  specs: [
    { label: 'Material', value: 'White aluminium frame + iron back cover + glass LGP' },
    { label: 'Power', value: '18W | 24W | 30W' },
  ],
  status: 'published' as const,
  source: { doc: 'brochure', page: 4 },
  order: 1,
};

const URL_ = 'https://spartan.example/products/slim-led-panels';

describe('shareTargets', () => {
  it('carries the product name, a description and the page link', () => {
    const t = shareTargets(product, URL_);
    expect(t.message).toContain('Slim LED Panels');
    expect(t.message).toContain('White aluminium frame');
    expect(t.message).toContain(URL_);
  });

  it('names the variant, so two SKUs sharing a name are told apart', () => {
    // 16 products share a name with a sibling and differ only by this label.
    // A share message reading only "Ear Muff" describes both of them.
    const t = shareTargets({ ...product, name: 'Ear Muff', variantLabel: 'NRR 25dB' }, URL_);
    expect(t.message).toContain('Ear Muff NRR 25dB');
    expect(t.subject).toBe('Ear Muff NRR 25dB — Spartan');
  });

  /*
   * THE ENCODING TESTS ARE THE POINT OF THIS FILE.
   *
   * The message is pasted whole into a query string, and catalogue spec values
   * are full of characters that mean something there. Every one of these is a
   * real value from `src/data/products.json`, not an invented edge case:
   *
   *   `+`  reaches a mail client as a SPACE when unencoded — the material row
   *        above would read "White aluminium frame  iron back cover".
   *   `#`  opens a fragment, so everything after it is dropped from the query
   *        entirely. The link would go missing from the end of the message.
   *   `&`  starts the next parameter, so the rest of the body would be parsed
   *        as an unrecognised field and discarded.
   *
   * None of these fails loudly. They produce a share message that sends and
   * arrives truncated or mangled, which is exactly the class of defect this
   * codebase keeps finding by measuring rather than by reading.
   */
  it('encodes a `+` in a spec value rather than letting it become a space', () => {
    const t = shareTargets(product, URL_);
    expect(t.whatsapp).toContain('%2B');
    expect(t.whatsapp).not.toMatch(/frame\+iron/);
    expect(t.email).toContain('%2B');
  });

  it('encodes `&` and `#`, so nothing after them is dropped', () => {
    const hazard = {
      ...product,
      specs: [{ label: 'Standard', value: 'EN 397 & EN 50365 #2 grade' }],
    };
    const t = shareTargets(hazard, URL_);
    expect(t.whatsapp).toContain('%26');
    expect(t.whatsapp).toContain('%23');
    // The link is the last thing in the message and the first casualty of a
    // stray `#`. Assert it survived intact.
    expect(decodeURIComponent(t.whatsapp.split('?text=')[1]!)).toContain(URL_);
  });

  it('builds a wa.me link with no recipient, so the sender picks the contact', () => {
    const t = shareTargets(product, URL_);
    expect(t.whatsapp.startsWith('https://wa.me/?text=')).toBe(true);
  });

  it('builds a mailto with no recipient and both fields', () => {
    const t = shareTargets(product, URL_);
    expect(t.email.startsWith('mailto:?subject=')).toBe(true);
    expect(t.email).toContain('&body=');
  });

  it('keeps the message short enough to preview, and always ends on the link', () => {
    // The description budget is the same 160 the page's meta description uses.
    // A share message is read in a notification preview, so a wall of spec rows
    // is worse than a short one.
    const long = {
      ...product,
      specs: Array.from({ length: 40 }, (_, i) => ({ label: `Row ${i}`, value: 'x'.repeat(30) })),
    };
    const t = shareTargets(long, URL_);
    expect(t.message.length).toBeLessThan(400);
    expect(t.message.endsWith(URL_)).toBe(true);
  });

  it('still produces a usable message for a product with no spec rows', () => {
    // Nothing in the catalogue is specless today, but an honest empty state is
    // the rule here — a product that says little must share as little, not fall
    // back to invented copy.
    const bare = { ...product, specs: [] };
    const t = shareTargets(bare, URL_);
    expect(t.message).toContain('Slim LED Panels');
    expect(t.message).toContain(URL_);
  });

  it('passes the plain URL through for the copy-link control', () => {
    expect(shareTargets(product, URL_).url).toBe(URL_);
  });
});
