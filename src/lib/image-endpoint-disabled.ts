/**
 * The runtime image endpoint, deliberately inert.
 *
 * WHY THIS EXISTS. Astro routes an `/_image` endpoint into the serverless
 * function whenever a project uses `astro:assets`, and that endpoint imports
 * sharp — which on 2026-08-23 measured 19.1 MB of a 25.6 MB function, 75% of
 * the cold-start weight on every route the function serves, `/api/enquiry`
 * included. Nothing on this site ever calls it: every public image is
 * optimised at BUILD time and emitted under `/_astro/`, no server-rendered
 * page imports `astro:assets` (`npm run verify` now gates exactly that), and
 * the admin's banner thumbnails stream raw bytes through their own route.
 *
 * Pointing `image.endpoint.entrypoint` at this module keeps sharp out of the
 * server graph entirely, so the bundler never traces it into the function.
 * BUILD-TIME OPTIMISATION IS UNTOUCHED — the sharp service still runs during
 * `astro build`; this only replaces the request-time endpoint.
 *
 * 404, not 500: to a crawler probing `/_image?href=...` the honest answer is
 * that there is nothing here, and a 5xx would page whoever watches error
 * rates. If a server-rendered page ever legitimately needs runtime image
 * optimisation, delete this file, remove `image.endpoint` from
 * `astro.config.mjs`, and expect the function to grow by the size of sharp —
 * that cost coming back should be a decision, not an accident.
 */
import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = () =>
  new Response(null, {
    status: 404,
    headers: { 'x-reason': 'runtime image optimisation is disabled; images are built ahead of time' },
  });
