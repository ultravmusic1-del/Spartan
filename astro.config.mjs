import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://spartan.example',
  output: 'static',
  adapter: vercel(),
  integrations: [preact({ compat: false }), sitemap()],
  vite: { plugins: [tailwind()] },
});
