/**
 * Change an enquiry's status. A form POST, not a fetch: the admin pages carry no
 * client-side JavaScript, which is what keeps them clear of the inline-script
 * CSP trap described in AdminLayout.astro.
 *
 * Every branch redirects with a `notice` code rather than a message. The code is
 * resolved against a closed whitelist when it is rendered — see
 * src/lib/admin/notices.ts for why a message in a URL is a phishing surface.
 */
import type { APIRoute } from 'astro';
import { setStatus, isEnquiryStatus } from '../../../../lib/admin/enquiries';
import type { NoticeCode } from '../../../../lib/admin/notices';

export const prerender = false;

const to = (path: string, notice: NoticeCode): string => `${path}?notice=${notice}`;

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const id = params.id ?? '';
  const form = await request.formData();
  const status = String(form.get('status') ?? '');

  // The middleware has already established this is an admin. This check is about
  // the value, which is still just a string off the wire.
  if (!id || !isEnquiryStatus(status)) return redirect(to('/admin', 'bad-request'), 302);

  const result = await setStatus(id, status);
  const detail = `/admin/enquiries/${id}`;

  /*
   * The three outcomes stay three. Reporting an unconfigured deployment as a
   * generic save failure would send an operator looking for a database problem
   * that is really a missing environment variable — and reporting either as a
   * success would leave them believing a status they can see is stale.
   */
  if (result.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to(detail, 'save-failed'), 302);

  return redirect(to(detail, 'saved'), 302);
};
