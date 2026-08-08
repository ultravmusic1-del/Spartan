import { describe, it, expect } from 'vitest';
import { enquiryPayloadSchema } from './enquiry-schema';

const valid = {
  name: 'Sam Rahman',
  company: 'Gulf Contracting',
  email: 'sam@example.com',
  phone: '+971500000000',
  country: 'UAE',
  message: 'Please quote for a 40-site rollout.',
  items: [{ slug: 'safety-helmets', name: 'Safety Helmets', qty: 12, note: '' }],
  website: '',
};

describe('enquiryPayloadSchema', () => {
  it('accepts a valid payload', () => {
    expect(() => enquiryPayloadSchema.parse(valid)).not.toThrow();
  });

  it('rejects a malformed email', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, email: 'nope' })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects a filled honeypot', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, website: 'http://spam' })).toThrow();
  });

  it('allows an empty item list for a general enquiry', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, items: [] })).not.toThrow();
  });

  /*
   * The compact forms on the home page and /contact send a division; the full
   * /enquiry form does not, because its product list already says which
   * divisions are involved. Both shapes have to parse, and an unrecognised
   * value must not cost the enquiry — the field is routing information for a
   * human, not a lookup.
   */
  it('defaults division to empty when the form does not send one', () => {
    expect(enquiryPayloadSchema.parse(valid).division).toBe('');
  });

  it('keeps a division the compact forms send', () => {
    expect(enquiryPayloadSchema.parse({ ...valid, division: 'safety' }).division).toBe('safety');
  });

  it('accepts a division it does not recognise rather than losing the enquiry', () => {
    expect(() => enquiryPayloadSchema.parse({ ...valid, division: 'both' })).not.toThrow();
  });

  it('rejects more than 200 items', () => {
    const items = Array.from({ length: 201 }, (_, i) => ({
      slug: `s${i}`,
      name: 'X',
      qty: 1,
      note: '',
    }));
    expect(() => enquiryPayloadSchema.parse({ ...valid, items })).toThrow();
  });

  it('rejects a quantity outside 1-999', () => {
    expect(() =>
      enquiryPayloadSchema.parse({ ...valid, items: [{ slug: 'a', name: 'A', qty: 0, note: '' }] }),
    ).toThrow();
    expect(() =>
      enquiryPayloadSchema.parse({
        ...valid,
        items: [{ slug: 'a', name: 'A', qty: 1000, note: '' }],
      }),
    ).toThrow();
  });
});
