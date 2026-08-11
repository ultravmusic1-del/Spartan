/**
 * Server-side environment reading, in one place.
 *
 * `process.env` first, `import.meta.env` second, and the order is the whole
 * point. Vite inlines `import.meta.env.*` at build time, and on Vercel the build
 * runs on Vercel — so a secret added to the project *after* a build would never
 * reach an inlined reference. `process.env` is read at request time and is what
 * a platform environment variable actually populates. `import.meta.env` stays as
 * the fallback because `astro dev` loads `.env` into Vite's env and not into
 * `process.env`, so local development needs it.
 *
 * This lived inside src/pages/api/enquiry.ts until the Supabase store became a
 * second consumer. The precedence above is subtle enough that two copies would
 * eventually disagree, and the copy that lost would fail only in production.
 */
export function env(key: string): string {
  return (process.env[key] ?? (import.meta.env as Record<string, unknown>)[key] ?? '')
    .toString()
    .trim();
}

/** True when every named variable holds a non-empty value. */
export function configured(...keys: readonly string[]): boolean {
  return keys.every((key) => env(key) !== '');
}
