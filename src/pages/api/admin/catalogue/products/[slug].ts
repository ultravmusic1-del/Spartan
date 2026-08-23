/**
 * Save one product. A form POST, not a fetch: the admin pages carry no
 * client-side JavaScript, which is what keeps them clear of the inline-script
 * CSP trap described in AdminLayout.astro.
 *
 * IT RE-READS THE RECORD RATHER THAN TRUSTING THE FORM. The read-only fields —
 * slug, en388, source, status — are carried over from that read, so this route
 * cannot write a value the browser sent for them even if it wanted to. That is
 * the whole enforcement: `acceptProductEdit` never looks at those keys.
 *
 * Every branch redirects with a `notice` code rather than a message, because a
 * message in a URL is a phishing surface. See src/lib/admin/notices.ts.
 */
import type { APIRoute } from 'astro';
import { getProduct, acceptProductEdit, saveProduct } from '../../../../../lib/admin/catalogue';
import type { NoticeCode } from '../../../../../lib/admin/notices';

export const prerender = false;

const to = (path: string, notice: NoticeCode): string => `${path}?notice=${notice}`;

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const slug = params.slug ?? '';
  const detail = `/admin/catalogue/products/${slug}`;

  const current = await getProduct(slug);

  /*
   * The three read outcomes stay three, for the reason the enquiry endpoint
   * gives: an unconfigured deployment reported as a save failure sends someone
   * hunting a database problem that is a missing environment variable. And only
   * a successful read that found nothing is "not found" — a product that could
   * not be READ has not been shown not to exist.
   */
  if (current.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (current.state === 'failed') return redirect(to(detail, 'save-failed'), 302);
  if (current.data === null) return redirect(to('/admin/catalogue', 'not-found'), 302);

  const accepted = acceptProductEdit(current.data, await request.formData());
  if (!accepted.ok) {
    /*
     * The issues are logged and not shown. The notice vocabulary is a closed
     * whitelist on purpose, and Zod's messages are the wrong thing to widen it
     * for: they name schema paths rather than form fields. The notice names the
     * two fields that can realistically fail; this line is what a maintainer
     * reads when a third one starts failing.
     */
    console.warn(`[admin] rejected edit to product ${slug}:`, accepted.issues.join('; '));
    return redirect(to(detail, 'catalogue-invalid'), 302);
  }

  const result = await saveProduct(
    locals.admin?.email ?? 'unknown',
    current.data,
    accepted.product,
  );
  if (result.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to(detail, 'save-failed'), 302);

  return redirect(to(detail, 'catalogue-saved'), 302);
};
