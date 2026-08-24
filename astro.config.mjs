import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  /*
   * TEMPORARY, 2026-08-13. This is the Vercel preview domain, set so the site
   * stops pointing at `spartan.example` — an RFC 2606 reserved name that can
   * never resolve, so every canonical tag, Open Graph URL and sitemap entry
   * named a host that does not exist.
   *
   * It is still not the final answer. Replace it with the real domain the
   * moment one is bought: this single value drives every canonical, every OG
   * URL, the sitemap's contents and the `Sitemap:` line in robots.txt, so the
   * change is one edit and a redeploy. Anything already indexed under the
   * vercel.app host will then need a redirect or it becomes a duplicate of the
   * real site — which is the argument for keeping this host out of search
   * until the domain lands (see BACKLOG.md).
   */
  site: 'https://spartan-ebon.vercel.app',
  output: 'static',
  adapter: vercel(),

  image: {
    /*
     * The runtime /_image endpoint is replaced with an inert 404, which keeps
     * sharp (19.1 MB, 75% of the serverless function on 2026-08-23) out of the
     * cold-start path of /api/enquiry and every admin route. Build-time image
     * optimisation is unaffected — see the entrypoint's header for the full
     * reasoning and for what to do if runtime optimisation is ever needed.
     */
    endpoint: { route: '/_image', entrypoint: './src/lib/image-endpoint-disabled.ts' },
  },
  integrations: [
    preact({ compat: false }),
    /*
     * The admin area is not part of the public site and must not be advertised
     * in its sitemap. @astrojs/sitemap emits every known page route, including
     * the server-rendered ones, so `/admin/login/` had been published in
     * sitemap-0.xml since the guard landed — a sitemap is a submitted, crawled
     * document, so this is the one place the admin genuinely was announced.
     *
     * This is the counterpart to `AdminLayout`'s `noindex`, not a substitute
     * for it, and it is deliberately NOT a robots.txt `Disallow` — see
     * src/pages/robots.txt.ts for why that would advertise the endpoints and
     * stop a crawler ever seeing the noindex. `npm run verify`'s "admin area
     * stays private" gate fails if an admin URL reaches either sitemap file.
     */
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/admin') }),
  ],
  vite: { plugins: [tailwind()] },
});
