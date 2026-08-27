/**
 * Seed the throwaway stack with hero banners, so a test build renders the
 * carousel production is actually in.
 *
 * WHY THIS EXISTS. `--full` builds against the local stack, whose `hero_banners`
 * table was empty — so every browser test ran against a hero with an EMPTY
 * banner band while production had shown a carousel since 2026-08-23. Six tests
 * asserted that empty band and passed on every CI run, the carousel path had no
 * browser coverage at all, and the WCAG 2.2.2 pause control had no guard of any
 * kind. Measured 2026-08-27: 294 pass against an empty band, 8 fail against a
 * build from the live database. That is the shape of green this repo treats as
 * worse than red.
 *
 * WHY THE FIXTURE IS GENERATED AND NOT COMMITTED. Three 2800x700 images are
 * about the least interesting bytes imaginable, and committing them would put
 * binary fixtures in a repository whose only other images are the client's
 * artwork — where a stray file gets mistaken for a real banner. sharp is
 * already a dependency (Astro's image pipeline uses it at build time), so
 * drawing three flat panels costs nothing and the fixture cannot drift.
 *
 * THEY LOOK NOTHING LIKE THE CLIENT'S ARTWORK, ON PURPOSE. Flat colour with no
 * text: a screenshot from a failing test should be unmistakably a fixture, and
 * nobody should be able to confuse one of these with a poster that needs
 * checking against a source document.
 *
 * THE COUNT IS NOT WHAT THE TESTS ASSERT AGAINST. They read the number of pips
 * and slides out of the DOM and check the relationships between them, so this
 * can be three or six without touching a spec. Two is the floor: a carousel of
 * one is not a carousel, and the loop-duplicate rule is invisible below two.
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

/** Matches the shape the admin's upload route accepts: 4:1, well over 1400px wide. */
const WIDTH = 2800;
const HEIGHT = 700;

/**
 * Deterministic ids, so re-running against a live stack replaces the fixture
 * rather than accumulating copies of it. `supabase start` keeps its data, and
 * `test:db:start` is expected to be idempotent — a seeder that appended would
 * turn every restart into a longer carousel and quietly change what the clock
 * arithmetic is being tested with.
 */
const FIXTURES = [
  { path: 'fixture-banner-1.png', name: 'Test banner 1', tint: { r: 20, g: 90, b: 140 } },
  { path: 'fixture-banner-2.png', name: 'Test banner 2', tint: { r: 140, g: 60, b: 30 } },
  { path: 'fixture-banner-3.png', name: 'Test banner 3', tint: { r: 40, g: 120, b: 70 } },
];

const panel = (tint) =>
  sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: tint },
  })
    .png()
    .toBuffer();

/**
 * Upload the files and write the rows.
 *
 * ENABLED TRUE, WHICH IS THE OPPOSITE OF THE ADMIN'S DEFAULT. A banner uploaded
 * through `/admin/banners` arrives hidden so a half-finished one cannot ride
 * out on somebody else's Publish (handoff.md §26). Nothing here is
 * half-finished, and a fixture nobody enabled would rebuild the empty band this
 * exists to replace.
 */
export async function seedBanners(url, serviceKey) {
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  for (const [index, fixture] of FIXTURES.entries()) {
    const body = await panel(fixture.tint);

    const { error: uploadError } = await db.storage
      .from('banners')
      .upload(fixture.path, body, { contentType: 'image/png', upsert: true });
    if (uploadError) {
      throw new Error(`could not upload ${fixture.path}: ${uploadError.message}`);
    }

    /*
     * `onConflict: 'path'` because that column carries the unique constraint —
     * one row owns one file. Upserting on id would insert a second row for the
     * same object on the second run.
     */
    const { error: rowError } = await db
      .from('hero_banners')
      .upsert(
        {
          path: fixture.path,
          name: fixture.name,
          width: WIDTH,
          height: HEIGHT,
          order: index,
          enabled: true,
        },
        { onConflict: 'path' },
      );
    if (rowError) {
      throw new Error(`could not write the row for ${fixture.path}: ${rowError.message}`);
    }
  }

  /*
   * A row enabled with no file behind it FAILS THE BUILD — `tools/fetch-banners.mjs`
   * refuses rather than rendering a hero with a hole in it. So a stale row left
   * by an earlier fixture, or by a test that uploaded one, would break every
   * subsequent run in a way that looks nothing like its cause.
   */
  const { data: rows, error: listError } = await db
    .from('hero_banners')
    .select('path')
    .eq('enabled', true);
  if (listError) throw new Error(`could not read back the banners: ${listError.message}`);

  const wanted = new Set(FIXTURES.map((f) => f.path));
  const strays = (rows ?? []).map((r) => r.path).filter((p) => !wanted.has(p));
  if (strays.length) {
    const { error } = await db.from('hero_banners').delete().in('path', strays);
    if (error) throw new Error(`could not clear stray banners: ${error.message}`);
  }

  console.log(
    `[banners] ${FIXTURES.length} fixture banner(s) seeded${strays.length ? `, ${strays.length} stray row(s) cleared` : ''}`,
  );
  return FIXTURES.length;
}
