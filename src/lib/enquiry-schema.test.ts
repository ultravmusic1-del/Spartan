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
