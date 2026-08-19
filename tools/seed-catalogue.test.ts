import { describe, it, expect } from 'vitest';
import { lit, json, productCells, seedSql } from './seed-catalogue.mjs';

describe('SQL literals', () => {
  it('quotes a plain string', () => {
    expect(lit('lighting')).toBe("'lighting'");
  });

  /*
   * The only escaping this file does, and the only escaping it needs: every
   * value is interpolated into a quoted literal and no identifier is ever
   * interpolated. A product name with an apostrophe in it is the ordinary case
   * that breaks a naive seeder.
   */
  it('doubles an apostrophe rather than ending the literal', () => {
    expect(lit("Men's gloves")).toBe("'Men''s gloves'");

    // The classic. The leading apostrophe is doubled, so the whole thing stays
    // one literal: opening quote, `''`, the rest, closing quote. Nothing here
    // can terminate the string early and start a new statement.
    expect(lit("'; drop table products; --")).toBe("'''; drop table products; --'");
  });

  it('emits null unquoted, so absent stays absent', () => {
    expect(lit(null)).toBe('null');
    expect(lit(undefined)).toBe('null');
    // The four-character string would satisfy a text column and mean the
    // opposite of nothing.
    expect(lit(null)).not.toBe("'null'");
  });
});

describe('jsonb literals', () => {
  it('serialises and casts', () => {
    expect(json(['a.png'])).toBe(`'["a.png"]'::jsonb`);
  });

  it('escapes quotes inside the JSON too', () => {
    expect(json({ note: "it's" })).toBe(`'{"note":"it''s"}'::jsonb`);
  });

  it('emits null unquoted', () => {
    expect(json(null)).toBe('null');
    expect(json(undefined)).toBe('null');
  });
});

describe('productCells', () => {
  const base = {
    slug: 'x',
    name: 'X',
    categoryId: 'hand',
    images: ['x.png'],
    specs: [],
    source: { doc: 'brochure', page: 16 },
    order: 1,
  };

  /*
   * 79 of the 85 products have no EN 388 rating, and the whole point of the
   * field is that a missing one reads as missing. An empty object here would
   * satisfy the column and assert that the glove was tested.
   */
  it('keeps an absent EN 388 rating absent', () => {
    const cells = productCells(base);
    expect(cells).toContain('null');
    expect(cells.join(',')).not.toContain('{}');
  });

  it('carries an EN 388 rating through when there is one', () => {
    const cells = productCells({ ...base, en388: { abrasion: '4', bladeCut: 'X' } });
    expect(cells.join(',')).toContain('"bladeCut":"X"');
  });

  it('defaults status to published, matching the Zod schema', () => {
    expect(productCells(base)).toContain("'published'");
    expect(productCells({ ...base, status: 'draft' })).toContain("'draft'");
  });

  /* Nullable since 2026-08-13 — an admin-created product may have none. */
  it('allows a missing source', () => {
    const cells = productCells({ ...base, source: undefined });
    expect(cells.filter((c) => c === 'null').length).toBeGreaterThanOrEqual(2);
  });
});

describe('non-ASCII survives the trip', () => {
  /*
   * The catalogue's specifications contain `±`, `Ω`, `°`, `×`, `—` and inch
   * marks. On 2026-08-13 every one of them reached Postgres mangled, because
   * the seed had been written to disk with PowerShell's `>` redirection, which
   * re-encodes in the console codepage. The seed itself was fine; the shell was
   * not. `--out` exists so the file is written by Node with an explicit
   * encoding, and these assert the statements carry the real characters.
   */
  it('emits the actual characters, not escapes or replacements', () => {
    const sql = seedSql().join('\n');
    for (const char of ['±', 'Ω', '—']) {
      expect(sql).toContain(char);
    }
    // The mojibake those three become when UTF-8 is read as CP437.
    for (const wrong of ['┬▒', '╬⌐', 'ΓÇö']) {
      expect(sql).not.toContain(wrong);
    }
  });

  it('keeps them intact through the jsonb literal too', () => {
    const cells = productCells({
      slug: 'x',
      name: 'X',
      categoryId: 'cables',
      images: [],
      specs: [{ label: 'Impedance', value: '100 ± 15 Ω' }],
      source: null,
      order: 1,
    });
    expect(cells.join(',')).toContain('100 ± 15 Ω');
  });
});

describe('the emitted seed', () => {
  it('orders the tables so foreign keys resolve', () => {
    const statements = seedSql();
    const first = statements.findIndex((s) => s.includes('into public.divisions'));
    const second = statements.findIndex((s) => s.includes('into public.categories'));
    const third = statements.findIndex((s) => s.includes('into public.products'));
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
  });

  it('is idempotent — every statement upserts', () => {
    for (const statement of seedSql()) {
      expect(statement).toContain('on conflict');
      expect(statement).toContain('do update set');
    }
  });

  /*
   * Chunking cuts between statements, never inside one. A blurb containing a
   * semicolon and a newline would defeat any text-splitting heuristic, so the
   * slicing is done on the array and this asserts the result is still whole
   * statements.
   */
  it('emits whole statements only', () => {
    for (const statement of seedSql()) {
      expect(statement.trimEnd().endsWith(';')).toBe(true);
      expect(statement.startsWith('insert into public.')).toBe(true);
    }
  });
});

/*
 * ADDED 2026-08-17, after the Supabase table was found to be missing two
 * columns the loader already reads.
 *
 * `productSchema` gained `datasheetUrl` and `kavalaniUrl` on 2026-08-17, months
 * after this seeder was written, and nothing connected the two. The failure is
 * silent in the worst way: the INSERT succeeds, the row is simply short a
 * field, and `npm run catalogue:parity` then reports a difference that reads
 * like a defect in the LOADER rather than in the seeder that produced the data.
 *
 * So the column list is asserted against the schema itself. A field added to
 * one and not the other now fails here, naming the field, instead of surfacing
 * as a mysterious parity failure later.
 */
describe('the seeder round-trips every field in the schema', () => {
  it('PRODUCT_COLUMNS covers every key of productSchema, and nothing else', async () => {
    const { productSchema } = await import('../src/content.config');
    const { PRODUCT_COLUMNS } = await import('./seed-catalogue.mjs');

    /** camelCase in the JSON and the schema; snake_case in Postgres. */
    const toColumn = (key: string) => key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
    /** `"order"` is quoted in the column list because it is a reserved word. */
    const bare = (col: string) => col.replace(/"/g, '');

    const expected = Object.keys(productSchema.shape).map(toColumn).sort();
    const actual = PRODUCT_COLUMNS.map(bare).sort();

    expect(actual).toEqual(expected);
  });

  it('emits a cell for every column, so the two can never drift out of step', async () => {
    const { PRODUCT_COLUMNS, productCells } = await import('./seed-catalogue.mjs');
    const minimal = {
      slug: 'x',
      name: 'X',
      variantLabel: null,
      categoryId: 'hand',
      images: ['a.png'],
      specs: [],
      status: 'published',
      source: { doc: 'brochure', page: 1 },
      order: 1,
    };
    expect(productCells(minimal)).toHaveLength(PRODUCT_COLUMNS.length);
  });

  it('writes an absent optional field as null, never as an empty string', async () => {
    const { productCells } = await import('./seed-catalogue.mjs');
    const cells = productCells({
      slug: 'x',
      name: 'X',
      variantLabel: null,
      categoryId: 'hand',
      images: [],
      specs: [],
      status: 'published',
      source: null,
      order: 1,
    });

    /*
     * This matters more than it looks. Both new fields are validated by a regex
     * that an empty string FAILS, and the loader writes the key only when the
     * column is non-NULL. An empty string would therefore round-trip into the
     * schema and break the build -- which is the right outcome, but only
     * because it is never written that way in the first place.
     */
    expect(cells).not.toContain("''");
    expect(cells.filter((c) => c === 'null').length).toBeGreaterThan(0);
  });
});
