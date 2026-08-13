import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://spartan.example',
  output: 'static',
  adapter: vercel(),
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
