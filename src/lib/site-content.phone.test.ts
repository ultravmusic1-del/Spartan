import { describe, expect, it } from 'vitest';
import { isPlaceholderNumber } from './site-content';

/**
 * The header renders a `tel:` link only when there is a number to dial.
 *
 * `src/data/site.json` still holds the placeholder `+971 00 000 0000`, and a
 * `tel:` link to it is a control that does nothing — the same defect this repo
 * removed from the footer's newsletter field and its three `href="#"` social
 * icons. While the number is a placeholder the header offers a route that
 * works instead, and the moment a real number lands it must go back to being a
 * phone link with no code change at all.
 *
 * The heuristic is deliberately loose in one direction. A false positive costs
 * a header that says "Contact sales"; a false negative costs a dead `tel:`
 * link on every page of the site. Those are not the same cost, so the test
 * below pins the asymmetry rather than just the happy path.
 */
describe('isPlaceholderNumber', () => {
  it('treats the shipped placeholder as unset', () => {
    expect(isPlaceholderNumber('+971 00 000 0000')).toBe(true);
  });

  it('treats the real WhatsApp number as set', () => {
    expect(isPlaceholderNumber('+973 3800 0458')).toBe(false);
  });

  it('does not trip on a real number that merely contains zeros', () => {
    expect(isPlaceholderNumber('+973 1234 5067')).toBe(false);
  });

  it('is not fooled by punctuation between the zeros', () => {
    expect(isPlaceholderNumber('+971 (0) 00-000')).toBe(true);
  });

  it('treats an empty number as unset rather than throwing', () => {
    expect(isPlaceholderNumber('')).toBe(true);
  });
});
