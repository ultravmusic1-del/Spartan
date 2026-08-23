/**
 * Create the private `banners` bucket if it is not already there.
 *
 * Idempotent, and pointed at whatever SUPABASE_URL holds — so the same code
 * prepares the live project and the throwaway stack. `tools/test-db.mjs` calls
 * `ensureBuckets` directly; a person runs `npm run storage:setup` once against
 * production.
 *
 * PRIVATE, and that is the decision rather than an oversight. A public bucket
 * would be a second route to the artwork that nothing gates and nobody
 * maintains — the same reasoning that gives every table here RLS with zero
 * policies. The site is published by the BUILD, and the build signs a
 * short-lived URL with the service-role key when it needs one.
 *
 * The MIME and size limits are set on the bucket as well as checked in
 * `src/lib/admin/banners.ts`. That is not duplication for its own sake: the
 * application check is what produces a readable message, and the bucket's is
 * what holds if anything ever reaches storage by another path.
 */
import { createClient } from '@supabase/supabase-js';

export const BANNER_BUCKET = 'banners';

export async function ensureBuckets(url, serviceKey) {
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await db.storage.listBuckets();
  if (error) throw new Error(`could not list buckets: ${error.message}`);

  if (data.some((bucket) => bucket.name === BANNER_BUCKET)) {
    console.log(`bucket "${BANNER_BUCKET}" already exists`);
    return;
  }

  const { error: createError } = await db.storage.createBucket(BANNER_BUCKET, {
    public: false,
    fileSizeLimit: '8MB',
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  });
  if (createError) throw new Error(`could not create the bucket: ${createError.message}`);
  console.log(`bucket "${BANNER_BUCKET}" created, private`);
}

if (process.argv[2] === 'run') {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  await ensureBuckets(url, key);
}
