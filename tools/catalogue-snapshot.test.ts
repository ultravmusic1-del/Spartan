import { describe, it, expect } from 'vitest';
import { checkInvariants, totals } from './catalogue-snapshot.mjs';

/**
 * The catalogue's invariants.
 *
 * These replace three hard-coded numbers in `tools/verify.mjs`. Those numbers
 * were correct while the catalogue was a committed file that only a developer
 * could change; once it is editable from `/admin` they move for good reasons,
 * and a literal in a source file cannot express "this changed on purpose".
 *
 * The check therefore splits in two. What is asserted HERE can never
 * legitimately break, whatever anyone types into the editor. The totals move,
 * and are held against a committed snapshot that a person regenerates
 * deliberately — the same pattern the counts block in CLAUDE.md already uses.
 */

const sound = {
  divisions: [{ id: 'electricals' }, { id: 'safety' }],
  categories: [
    { id: 'hand', divisionId: 'safety', heroProductSlug: 'gp1' },
    { id: 'accessories', divisionId: 'electricals', heroProductSlug: null },
  ],
  products: [
    { slug: 'gp1', categoryId: 'hand', source: { doc: 'brochure', page: 16 } },
  ],
  audit: [],
};

describe('checkInvariants', () => {
  it('passes a well-formed catalogue', () => {
    expect(checkInvariants(sound)).toEqual([]);
  });

  it('catches a product pointing at a category that does not exist', () => {
    const bad = { ...sound, products: [{ ...sound.products[0], categoryId: 'nope' }] };
    expect(checkInvariants(bad)).toContain('gp1 has categoryId "nope", which is not a category');
  });

  it('catches a category pointing at a division that does not exist', () => {
    const bad = {
      ...sound,
      categories: [{ id: 'hand', divisionId: 'ghost', heroProductSlug: 'gp1' }],
    };
    expect(checkInvariants(bad)).toContain(
      'category hand has divisionId "ghost", which is not a division',
    );
  });

  it('catches a hero product that does not exist', () => {
    const bad = {
      ...sound,
      categories: [{ id: 'hand', divisionId: 'safety', heroProductSlug: 'ghost' }],
    };
    expect(checkInvariants(bad)).toContain(
      'category hand names heroProductSlug "ghost", which is not a product',
    );
  });

  /*
   * Electrical Accessories has no products because the brochure has none, and
   * its hero is legitimately null. An invariant that treated null as a defect
   * would push whoever hit it towards inventing a placeholder product, which is
   * the exact failure rule 1 exists to prevent.
   */
  it('allows a null heroProductSlug, which an empty category legitimately uses', () => {
    expect(checkInvariants(sound)).toEqual([]);
  });

  it('catches duplicate slugs', () => {
    const bad = { ...sound, products: [sound.products[0], sound.products[0]] };
    expect(checkInvariants(bad)).toContain('duplicate slug: gp1');
  });

  /*
   * Rule 1's mechanical half, in the form decision 1.1 of the 2026-08-13 plan
   * settled on: a record either cites a printed page, or the audit log names
   * who typed it. Training governs whether someone invents a figure today; it
   * does not survive staff turnover, and it cannot answer a maintainer in two
   * years asking where a rating came from.
   */
  it('catches a product with neither a source nor an audit entry', () => {
    const bad = { ...sound, products: [{ slug: 'gp1', categoryId: 'hand' }] };
    expect(checkInvariants(bad)).toContain(
      'gp1 has no source and no audit entry naming who entered it',
    );
  });

  it('accepts an admin-created product the audit log accounts for', () => {
    const fine = {
      ...sound,
      products: [{ slug: 'gp1', categoryId: 'hand' }],
      audit: [{ slug: 'gp1', actor: 'someone@example.com' }],
    };
    expect(checkInvariants(fine)).toEqual([]);
  });

  it('reports every violation at once rather than stopping at the first', () => {
    const bad = {
      ...sound,
      products: [
        { slug: 'a', categoryId: 'nope' },
        { slug: 'a', categoryId: 'hand', source: { doc: 'brochure', page: 1 } },
      ],
    };
    // Two distinct problems on the same input: the bad category and the
    // duplicate slug. A gate that reported one at a time would take three runs
    // to surface three defects.
    expect(checkInvariants(bad).length).toBeGreaterThanOrEqual(2);
  });
});

describe('totals', () => {
  it('counts what the snapshot pins', () => {
    expect(totals(sound)).toEqual({
      divisions: 2,
      categories: 2,
      products: 1,
      en388: 0,
    });
  });

  it('counts only products that actually carry an EN 388 rating', () => {
    const withRating = {
      ...sound,
      products: [
        ...sound.products,
        {
          slug: 'gp5',
          categoryId: 'hand',
          source: { doc: 'brochure', page: 16 },
          en388: { abrasion: '4', bladeCut: 'X', tear: '4', puncture: '3', tdmCut: 'D' },
        },
      ],
    };
    expect(totals(withRating).en388).toBe(1);
  });
});

describe('the committed snapshot', () => {
  it('matches the catalogue as it stands', async () => {
    const fs = await import('node:fs');
    const read = (f) => JSON.parse(fs.readFileSync(`src/data/${f}`, 'utf8'));
    const snapshot = JSON.parse(fs.readFileSync('tools/catalogue-snapshot.json', 'utf8'));

    expect(
      totals({
        divisions: read('divisions.json'),
        categories: read('categories.json'),
        products: read('products.json'),
      }),
    ).toEqual(snapshot);
  });
});
