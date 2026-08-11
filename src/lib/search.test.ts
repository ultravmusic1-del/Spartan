import { describe, it, expect } from 'vitest';
import { productSearchText, matchesQuery, searchTextMatches } from './search';

const earMuff = {
  name: 'Ear Muff',
  variantLabel: 'NRR 25dB',
  specs: [
    { label: 'Material', value: 'ABS cup' },
    { label: null, value: 'Adjustable headband' },
  ],
};

describe('productSearchText', () => {
  it('includes the name, the variant label and every spec value', () => {
    const text = productSearchText(earMuff);
    expect(text).toContain('ear muff');
    expect(text).toContain('nrr 25db');
    expect(text).toContain('abs cup');
    expect(text).toContain('adjustable headband');
  });

  it('drops the variant label when there is none', () => {
    // 56 of 72 products have none, so the empty case is the common one.
    const text = productSearchText({ ...earMuff, variantLabel: null });
    expect(text).toBe('ear muff\nabs cup\nadjustable headband');
  });
});

describe('matchesQuery', () => {
  it('matches on the name, case-insensitively', () => {
    expect(matchesQuery(earMuff, 'EAR')).toBe(true);
  });

  it('matches on a spec value', () => {
    expect(matchesQuery(earMuff, 'headband')).toBe(true);
  });

  /*
   * The variant label is the only thing telling the two ear muffs apart — the
   * difference is NRR 25dB vs 20dB and it appears in no other field. Without
   * this, the term a buyer actually uses finds neither of them.
   */
  it('matches on the variant label', () => {
    expect(matchesQuery(earMuff, 'nrr 25')).toBe(true);
  });

  /*
   * The fields are joined with a newline precisely so a query cannot span two
   * of them. Joined with a space, "muff abs" would match — a hit no single
   * field makes, and not what searchProducts promises.
   */
  it('does not match a query spanning two fields', () => {
    expect(matchesQuery(earMuff, 'muff abs')).toBe(false);
  });

  it('matches nothing for an empty or whitespace query', () => {
    expect(matchesQuery(earMuff, '')).toBe(false);
    expect(matchesQuery(earMuff, '   ')).toBe(false);
  });

  it('ignores surrounding whitespace in the query', () => {
    expect(matchesQuery(earMuff, '  headband  ')).toBe(true);
  });
});

describe('searchTextMatches', () => {
  /*
   * The island tests the baked `data-search` string rather than a product
   * object. Both routes must agree, or a product is findable one way and not
   * the other — which reads to a buyer as missing stock.
   */
  it('agrees with matchesQuery on the same product', () => {
    const text = productSearchText(earMuff);
    for (const q of ['ear', 'nrr 25', 'headband', 'muff abs', '', 'nothing']) {
      expect(searchTextMatches(text, q)).toBe(matchesQuery(earMuff, q));
    }
  });
});
