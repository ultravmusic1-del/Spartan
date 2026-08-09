/**
 * Parse a `Cookie` request header.
 *
 * Astro's `AstroCookies` exposes `get`/`set` but no `getAll`, and `@supabase/ssr`
 * needs every cookie on the request to reassemble a session token that may have
 * been split across several.
 *
 * Split on the FIRST `=` only. Supabase session cookies are base64 and routinely
 * end in `=` padding; splitting on every `=` truncates the token, and the
 * symptom is an admin being signed out at random rather than anything that looks
 * like a parse bug.
 */
export function parseCookies(header: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];

  for (const part of header.split(';')) {
    const segment = part.trim();
    if (!segment) continue;

    const eq = segment.indexOf('=');
    // `eq < 1` covers both a segment with no '=' at all and a nameless cookie.
    // Neither can be used, and neither is worth failing the whole header over.
    if (eq < 1) continue;

    const name = segment.slice(0, eq);
    const raw = segment.slice(eq + 1);

    let value = raw;
    try {
      value = decodeURIComponent(raw);
    } catch {
      // A stray '%' makes decodeURIComponent throw. The raw value is what the
      // browser sent and is the best answer available — dropping the cookie
      // would sign the admin out over a cosmetic defect.
    }

    out.push({ name, value });
  }

  return out;
}
