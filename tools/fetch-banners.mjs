/**
 * Download the enabled hero banners into `src/assets/banners/` before the build.
 *
 * WHY THIS EXISTS, AND WHY IT IS BETTER THAN THE REMOTE URL IT REPLACES.
 *
 * Banners used to be fetched by `<Picture>` straight from a signed Supabase
 * Storage URL during the build. That worked, and it churned: a signed URL
 * carries a JWT whose issued-at changes every time it is minted, Astro names
 * an emitted asset from a hash of the source URL, so **every Publish produced
 * 48 new banner filenames for byte-identical artwork.** The `immutable` cache
 * header was defeated for the largest images on the highest-traffic page, and
 * every returning visitor re-downloaded them. Measured 2026-08-23 by diffing
 * two consecutive builds: the two sets of filenames were disjoint.
 *
 * The obvious fix — store a long-lived signed URL on the row — trades away the
 * short-lived-credential half of the decision in §26. This does not. The file
 * is downloaded here with the service-role key, the signed URL lives for
 * seconds inside this process, and Astro then treats the banner as an ordinary
 * local asset: hashed from its CONTENT, so the name changes only when the
 * artwork does. The bucket stays private and nothing time-limited goes near
 * the build output.
 *
 * IT IS ALSO A RETURN TO THE SIMPLER PATH. `image.domains`, the remote-image
 * download allowlist, and the whole class of "Astro passed a remote URL
 * through unoptimised" failures go away with it — see docs/TRAPS.md.
 *
 * UNCONFIGURED IS NOT AN ERROR. With no Supabase credentials this writes
 * nothing and exits 0, and the hero renders its designed empty band. That is
 * the offline build, and it must keep working.
 */
import { createClient } from '@supabase/supabase-js';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BUCKET = 'banners';
const OUT_DIR = fileURLToPath(new URL('../src/assets/banners/', import.meta.url));

/** Same precedence as src/lib/env.ts: a real environment variable wins. */
function env(key) {
  return (process.env[key] ?? '').trim();
}

export async function fetchBanners() {
  const url = env('SUPABASE_URL');
  const key = env('SUPABASE_SERVICE_ROLE_KEY');

  await mkdir(OUT_DIR, { recursive: true });

  if (!url || !key) {
    console.log('[banners] no Supabase credentials — skipping, the hero will render its empty band');
    await emptyDir();
    return [];
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await db
    .from('hero_banners')
    .select('path')
    .eq('enabled', true)
    .order('order', { ascending: true });
  if (error) throw new Error(`[banners] could not read hero_banners: ${error.message}`);

  const wanted = (data ?? []).map((row) => row.path);

  /*
   * Cleared first, so a banner disabled or deleted in the admin does not linger
   * as a stale file that the glob would still find. The directory is generated
   * and gitignored; nothing here is anyone's to keep.
   */
  await emptyDir();

  for (const path of wanted) {
    const { data: file, error: downloadError } = await db.storage.from(BUCKET).download(path);
    /*
     * Loud, for the reason Hero.astro has always given: a banner that cannot be
     * resolved must fail the BUILD rather than render a gap on the home page.
     */
    if (downloadError || !file) {
      throw new Error(
        `[banners] "${path}" is enabled but could not be downloaded: ` +
          `${downloadError?.message ?? 'no body'}`,
      );
    }
    await writeFile(new URL(path, `file://${OUT_DIR.replace(/\\/g, '/')}`), Buffer.from(await file.arrayBuffer()));
  }

  console.log(`[banners] ${wanted.length} enabled banner(s) written to src/assets/banners/`);
  return wanted;
}

async function emptyDir() {
  if (!existsSync(OUT_DIR)) return;
  for (const name of await readdir(OUT_DIR)) {
    await rm(new URL(name, `file://${OUT_DIR.replace(/\\/g, '/')}`), { force: true });
  }
}

if (process.argv[2] === 'run') await fetchBanners();
