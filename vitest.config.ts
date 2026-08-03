import { getViteConfig } from 'astro/config';

// `getViteConfig` boots the Astro integration pipeline so virtual modules such
// as `astro:content` resolve inside tests.
export default getViteConfig({ test: { globals: true, environment: 'node' } });
