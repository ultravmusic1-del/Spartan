import { describe, expect, it } from 'vitest';
import { setStatusInJson } from './product-visibility.mjs';

/*
 * The one piece of the tool that can go quietly wrong: editing the right
 * product's status line in products.json and nothing else. A slip here
 * republishes the wrong product, or rewrites the whole file's formatting.
 */
const fixture = `[
  {
    "slug": "pvc-gloves",
    "name": "PVC Gloves",
    "status": "published",
    "order": 12
  },
  {
    "slug": "pvc-gloves-long",
    "name": "PVC Gloves Long",
    "status": "published",
    "order": 13
  }
]
`;

describe('setStatusInJson', () => {
  it('changes only the named product, and only its status line', () => {
    const { text, before } = setStatusInJson(fixture, 'pvc-gloves', 'draft');
    expect(before).toBe('published');
    expect(text).toBe(fixture.replace('"status": "published"', '"status": "draft"'));
    expect(JSON.parse(text)[1].status).toBe('published');
  });

  it('does not match a slug that merely starts with the one asked for', () => {
    const { text } = setStatusInJson(fixture, 'pvc-gloves-long', 'draft');
    expect(JSON.parse(text).map((p: { status: string }) => p.status)).toEqual(['published', 'draft']);
  });

  it('round-trips hide then show to the original bytes', () => {
    const hidden = setStatusInJson(fixture, 'pvc-gloves', 'draft').text;
    expect(setStatusInJson(hidden, 'pvc-gloves', 'published').text).toBe(fixture);
  });

  it('refuses an unknown slug rather than doing nothing', () => {
    expect(() => setStatusInJson(fixture, 'no-such-product', 'draft')).toThrow(/no product/);
  });
});
