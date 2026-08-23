/**
 * The image bytes of one banner, served from this origin.
 *
 * WHY A PROXY AND NOT THE STORAGE URL DIRECTLY. `img-src 'self'` covers the
 * whole site, and widening it to a second origin so that one admin screen can
 * show a picture is a poor trade — the CSP is the strongest thing standing
 * between a compromised dependency and an exfiltration channel. The bucket is
 * private in any case, so a storage URL would have to be signed per render.
 *
 * It sits behind the same `src/middleware.ts` guard as every other
 * `/api/admin/*` path, so an unauthenticated request gets 401 and never
 * reaches this code.
 */
import type { APIRoute } from 'astro';
import { readBannerFile } from '../../../../../lib/admin/banners';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const result = await readBannerFile(params.id ?? '');

  // 503, not 404: the banner may exist perfectly well and be unreadable, and
  // telling an admin their artwork is gone when the database was merely
  // unreachable is the same lie the enquiry detail page refuses to tell.
  if (result.state !== 'ok') return new Response(null, { status: 503 });
  if (result.data === null) return new Response(null, { status: 404 });

  return new Response(result.data.bytes, {
    headers: {
      'content-type': result.data.type,
      // Private, because it is: an admin's session is what authorised this.
      // A shared cache holding banner artwork keyed only by URL would serve it
      // to the next request that guessed the id.
      'cache-control': 'private, max-age=300',
    },
  });
};
