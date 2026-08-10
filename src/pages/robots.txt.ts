import type { APIRoute } from 'astro';
import { absoluteUrl, requireSite } from '../lib/seo';

/**
 * /robots.txt — emitted at build time from the one configured origin.
 *
 * This was a static file in `public/`, which interpolates nothing, so the
 * sitemap URL was typed out by hand alongside `site` in astro.config.mjs. Two
 * copies of one value, and changing either without the other is silent:
 * changing only the config leaves this file pointing at the wrong host, and
 * changing only this file leaves every canonical tag on all 96 pages pointing
 * at the wrong one. Nothing warns you, and the failure is invisible until a
 * crawler acts on it.
 *
 * Deriving it from `Astro.site` removes the second copy. There is now one place
 * the domain is written, and the launch step is a single edit rather than a
 * matched pair.
 *
 * `requireSite` is shared with Seo.astro rather than defaulted here: a
 * robots.txt advertising `undefined/sitemap-index.xml` is worse than a build
 * that stops and names the cause.
 *
 * Prerendered — `output: 'static'` is the default and this route does not opt
 * out. This file must never become a serverless function; it is one string that
 * cannot change between requests.
 */
export const GET: APIRoute = ({ site }) => {
  const origin = requireSite(site);

  // ASCII only, deliberately. This route is prerendered, so Astro writes the
  // body to dist/client/robots.txt and the headers below never reach the wire —
  // the host labels the file from its extension instead. Vercel sends
  // `text/plain; charset=utf-8` for .txt, but a body that cannot be misread
  // under any labelling is one fewer thing depending on that. Hence hyphens
  // rather than the em dashes used everywhere else in this repo.
  const body = `# Spartan
#
# Generated at build time from \`site\` in astro.config.mjs - do not add a copy
# of the domain to this file or to public/. One origin, one place.
#
# /api/enquiry is deliberately absent from the sitemap: it is the RFQ submission
# endpoint, it answers POST, and it is not a page. It is left crawlable rather
# than disallowed because a Disallow line is a public index of your endpoints,
# and there is nothing behind this one to find.

User-agent: *
Allow: /

Sitemap: ${absoluteUrl('/sitemap-index.xml', origin)}
`;

  // Kept accurate even though a prerender discards it: if this route ever has a
  // reason to become server-rendered, the correct header is already here rather
  // than something to remember.
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
