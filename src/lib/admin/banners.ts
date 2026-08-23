/**
 * Every admin read and write of HERO BANNERS — the rows and the image files.
 *
 * The admin's third seam, after src/lib/admin/enquiries.ts and
 * src/lib/admin/catalogue.ts. It mirrors them on purpose: the same
 * `AdminResult` states, the same lazy client behind a `configured()` guard, and
 * the same rule that a read which could not look never returns an empty array
 * to say so. Read catalogue.ts's header rather than have those reasons restated
 * badly here.
 *
 * IT OWNS BOTH HALVES OF A BANNER — the row in `public.hero_banners` and the
 * object in the private `banners` bucket — because they are one thing to
 * everybody upstream. Keeping them together is what makes "delete the row
 * before the object" a decision in one file rather than a convention two
 * callers have to remember.
 *
 * Uses the service-role key, which bypasses RLS, and is therefore safe only
 * because every caller sits behind the middleware guard.
 */
import { imageSize, type ImageSize } from './image-size';
import { env, configured } from '../env';
import type { AdminResult } from './enquiries';
import type { NoticeCode } from './notices';

/* ---------------------------------------------------------- the rules -- */

/**
 * The slot is 2800 x 700. Every number here is argued in the spec; they live in
 * one exported object so the admin form can state the same limits the validator
 * enforces, rather than a prose copy that drifts away from it.
 */
export const BANNER_RULES = {
  minRatio: 3.8,
  maxRatio: 4.2,
  minWidth: 1400,
  maxWidth: 6000,
  maxBytes: 8 * 1024 * 1024,
} as const;

export type BannerUploadResult =
  | { readonly ok: true; readonly size: ImageSize }
  | { readonly ok: false; readonly code: NoticeCode; readonly size: ImageSize | null };

/**
 * Whether these bytes may become a banner.
 *
 * THE TYPE IS ESTABLISHED BY RECOGNISING THE BYTES, never taken from the form's
 * Content-Type, which is whatever the client chose to send. `imageSize`
 * returning null IS the type check: it recognises exactly the two formats this
 * accepts and refuses to guess at anything else.
 *
 * The rejected size travels back with the code so the admin can show the
 * dimensions it actually got — see `dimensionsFrom` in ./notices.ts for why
 * that is two integers rather than a message.
 */
export function acceptBannerUpload(bytes: Uint8Array, byteLength: number): BannerUploadResult {
  const size = imageSize(bytes);
  if (size === null) return { ok: false, code: 'banner-invalid-type', size: null };

  if (byteLength > BANNER_RULES.maxBytes || size.width > BANNER_RULES.maxWidth) {
    return { ok: false, code: 'banner-too-large', size };
  }

  const ratio = size.width / size.height;
  if (ratio < BANNER_RULES.minRatio || ratio > BANNER_RULES.maxRatio) {
    return { ok: false, code: 'banner-invalid-shape', size };
  }

  /*
   * Checked AFTER the ratio, deliberately. A portrait poster is also under the
   * minimum width, and "the shape is wrong" is the useful answer — being told
   * it is too narrow would send someone off to upscale a tall image, which
   * cannot help and which this repository forbids anyway.
   */
  if (size.width < BANNER_RULES.minWidth) {
    return { ok: false, code: 'banner-too-small', size };
  }

  return { ok: true, size };
}

/* ------------------------------------------------------ the data layer -- */

export type { AdminResult };

const URL_KEY = 'SUPABASE_URL';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** The bucket tools/storage-setup.mjs creates. Private — see its header. */
export const BANNER_BUCKET = 'banners';

const ok = <T>(data: T): AdminResult<T> => ({ state: 'ok', data });
const UNCONFIGURED = { state: 'unconfigured' } as const;
const FAILED = { state: 'failed' } as const;

/** The columns of public.hero_banners, verbatim. `order` is quoted in SQL. */
export interface BannerRow {
  id: string;
  path: string;
  name: string;
  width: number;
  height: number;
  order: number;
  enabled: boolean;
  created_at: string;
}

const ready = (): boolean => configured(URL_KEY, SERVICE_KEY);

async function client() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env(URL_KEY), env(SERVICE_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Every banner, hidden ones included: this is the editor's list, not the
 * site's, and a hidden banner nobody can see is a banner nobody can restore.
 *
 * Ordered by `order` then by age, so two banners sharing an order number have a
 * stable position rather than whichever one the database happened to return
 * first.
 */
export async function listBanners(): Promise<AdminResult<BannerRow[]>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { data, error, count } = await supabase
      .from('hero_banners')
      .select('*', { count: 'exact' })
      .order('order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as BannerRow[];
    // The refusal catalogue.ts makes for the same reason: a silently short list
    // is a screen that says a banner does not exist.
    if (count !== null && rows.length < count) {
      throw new Error(`read returned ${rows.length} of ${count} rows — truncated`);
    }
    return ok(rows);
  } catch (cause) {
    console.error('[admin] listBanners failed', cause);
    return FAILED;
  }
}

/**
 * Stores the file, then the row.
 *
 * THE ROW GOES LAST because the row is what everything else reads. A file with
 * no row is invisible and harmless; a row with no file is a banner that fails
 * the next build. If the insert fails the file is taken back out, so the
 * ordinary failure leaves nothing behind at all.
 */
export async function createBanner(
  actor: string,
  name: string,
  bytes: Uint8Array,
  size: ImageSize,
): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;

  const path = `${crypto.randomUUID()}.${size.type === 'image/png' ? 'png' : 'jpg'}`;
  try {
    const supabase = await client();

    const { error: uploadError } = await supabase.storage
      .from(BANNER_BUCKET)
      .upload(path, bytes, { contentType: size.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { error } = await supabase.from('hero_banners').insert({
      path,
      name,
      width: size.width,
      height: size.height,
      // Hidden on arrival, so a half-finished banner cannot ride out on
      // somebody else's Publish. The column defaults to this too; stated here
      // because it is a decision rather than a default anyone should change.
      enabled: false,
    });
    if (error) {
      await supabase.storage.from(BANNER_BUCKET).remove([path]);
      throw new Error(error.message);
    }

    await audit(supabase, actor, 'create', path, { name, ...size });
    return ok(null);
  } catch (cause) {
    console.error('[admin] createBanner failed', cause);
    return FAILED;
  }
}

/** Name, order and visibility. The image itself is never edited, only replaced. */
export async function updateBanner(
  actor: string,
  id: string,
  patch: { name?: string; order?: number; enabled?: boolean },
): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { error } = await supabase.from('hero_banners').update(patch).eq('id', id);
    if (error) throw new Error(error.message);

    await audit(supabase, actor, 'update', id, patch);
    return ok(null);
  } catch (cause) {
    console.error('[admin] updateBanner failed', cause);
    return FAILED;
  }
}

/**
 * THE ROW FIRST, THEN THE OBJECT, and the order is the whole decision.
 *
 * Delete the object first and a failure straight afterwards leaves a row
 * pointing at a file that is gone — and an ENABLED row like that fails the next
 * build, so one destructive click would have made the site unbuildable. This
 * way the failure mode is an orphaned file: invisible, harmless, and logged
 * loudly enough to clean up.
 *
 * A banner that is already gone is `ok`, not `failed`. Two people pressing
 * Delete is not an incident.
 */
export async function deleteBanner(actor: string, id: string): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();

    const { data, error: readError } = await supabase
      .from('hero_banners')
      .select('path')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!data) return ok(null);

    const path = (data as { path: string }).path;

    const { error } = await supabase.from('hero_banners').delete().eq('id', id);
    if (error) throw new Error(error.message);

    const { error: removeError } = await supabase.storage.from(BANNER_BUCKET).remove([path]);
    if (removeError) {
      console.error(
        `[admin] banner ${id} was deleted but its file ${path} remains — orphaned, harmless, worth clearing`,
        removeError.message,
      );
    }

    await audit(supabase, actor, 'delete', id, null);
    return ok(null);
  } catch (cause) {
    console.error('[admin] deleteBanner failed', cause);
    return FAILED;
  }
}

/**
 * The bytes of one banner, for the admin's own thumbnail route.
 *
 * `ok(null)` means the id is genuinely not there. It is NOT `failed`.
 */
export async function readBannerFile(
  id: string,
): Promise<AdminResult<{ bytes: ArrayBuffer; type: string } | null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();

    const { data, error } = await supabase
      .from('hero_banners')
      .select('path')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return ok(null);

    const path = (data as { path: string }).path;
    const { data: file, error: fileError } = await supabase.storage
      .from(BANNER_BUCKET)
      .download(path);
    if (fileError || !file) throw new Error(fileError?.message ?? 'the object could not be read');

    return ok({
      bytes: await file.arrayBuffer(),
      type: path.endsWith('.png') ? 'image/png' : 'image/jpeg',
    });
  } catch (cause) {
    console.error('[admin] readBannerFile failed', cause);
    return FAILED;
  }
}

/**
 * Who changed what. Reuses `catalogue_audit`, whose `entity` check constraint
 * gained 'banner' in the same migration that created the table.
 *
 * Never throws — a failed audit must not fail a write that already happened,
 * which is the rule saveProduct states at length.
 */
async function audit(
  supabase: Awaited<ReturnType<typeof client>>,
  actor: string,
  action: 'create' | 'update' | 'delete',
  entityId: string,
  after: unknown,
): Promise<void> {
  const { error } = await supabase
    .from('catalogue_audit')
    .insert({ actor, entity: 'banner', entity_id: entityId, action, before: null, after });
  if (error) {
    console.error(`[admin] banner ${entityId} was changed but NOT audited`, error.message);
  }
}
