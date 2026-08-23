/**
 * Receive a banner image.
 *
 * A real `multipart/form-data` POST from a real `<form>` — no fetch, because no
 * admin page carries client-side JavaScript. That is what keeps these screens
 * clear of the inline-script CSP trap described in AdminLayout.astro.
 *
 * VALIDATION HAPPENS BEFORE ANYTHING IS STORED. `acceptBannerUpload` reads the
 * bytes, and only bytes it recognises as a JPEG or PNG of roughly the right
 * shape ever reach the bucket.
 */
import type { APIRoute } from 'astro';
import { acceptBannerUpload, createBanner } from '../../../../lib/admin/banners';
import type { NoticeCode } from '../../../../lib/admin/notices';

export const prerender = false;

const LIST = '/admin/banners';
const to = (notice: NoticeCode, extra = ''): string => `${LIST}?notice=${notice}${extra}`;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  const file = form.get('file');
  const name = (form.get('name')?.toString() ?? '').trim();

  // An empty file input posts a zero-byte File rather than nothing at all, so
  // the size check is what catches "pressed Upload without choosing anything".
  if (!(file instanceof File) || file.size === 0) {
    return redirect(to('banner-invalid-type'), 302);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const accepted = acceptBannerUpload(bytes, file.size);

  if (!accepted.ok) {
    /*
     * The dimensions ride along as two integers so the message can name what it
     * actually got — "the shape is wrong" is a poor answer when the admin knows
     * the file was 1261 x 1561. See `dimensionsFrom` in lib/admin/notices.ts
     * for why that is safe and why it is numbers rather than text.
     */
    const extra = accepted.size ? `&w=${accepted.size.width}&h=${accepted.size.height}` : '';
    console.warn(
      `[admin] rejected banner upload: ${accepted.code}`,
      accepted.size ?? '(unrecognised bytes)',
    );
    return redirect(to(accepted.code, extra), 302);
  }

  const result = await createBanner(
    locals.admin?.email ?? 'unknown',
    // The filename is a reasonable default label and a poor one to insist on.
    name || file.name,
    bytes,
    accepted.size,
  );

  if (result.state === 'unconfigured') return redirect(to('save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to('save-failed'), 302);

  return redirect(to('banner-uploaded'), 302);
};
