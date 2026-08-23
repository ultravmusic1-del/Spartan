/**
 * Save, show, hide or delete one banner.
 *
 * Four buttons, one route, told apart by the `intent` the pressed submit
 * carries. A form POST rather than a fetch, for the reason every other admin
 * endpoint gives: no admin page carries client-side JavaScript.
 *
 * SHOW AND HIDE ARE NOT DELETE, and keeping them on separate intents is the
 * point rather than an implementation detail — hiding takes a banner off the
 * site at the next build and keeps the artwork for a later campaign, and only
 * `delete` removes the file.
 */
import type { APIRoute } from 'astro';
import { updateBanner, deleteBanner } from '../../../../lib/admin/banners';
import type { NoticeCode } from '../../../../lib/admin/notices';

export const prerender = false;

const LIST = '/admin/banners';
const to = (notice: NoticeCode): string => `${LIST}?notice=${notice}`;

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const id = params.id ?? '';
  if (!id) return redirect(to('bad-request'), 302);

  const form = await request.formData();
  const actor = locals.admin?.email ?? 'unknown';
  const intent = form.get('intent')?.toString() ?? 'save';

  if (intent === 'delete') {
    const result = await deleteBanner(actor, id);
    if (result.state === 'unconfigured') return redirect(to('save-unconfigured'), 302);
    if (result.state === 'failed') return redirect(to('save-failed'), 302);
    return redirect(to('banner-deleted'), 302);
  }

  /*
   * Absent is not blank, the same rule src/lib/admin/catalogue.ts states at
   * length: a field the form did not offer is unchanged, so `undefined` here
   * means "leave it alone" rather than "set it to nothing". The Show and Hide
   * buttons carry no name or order, and must not wipe either.
   */
  const rawName = form.has('name') ? (form.get('name')?.toString() ?? '').trim() : '';
  const rawOrder = form.has('order') ? Number(form.get('order')) : Number.NaN;

  const result = await updateBanner(actor, id, {
    ...(rawName !== '' ? { name: rawName } : {}),
    ...(Number.isInteger(rawOrder) ? { order: rawOrder } : {}),
    ...(intent === 'show' ? { enabled: true } : {}),
    ...(intent === 'hide' ? { enabled: false } : {}),
  });

  if (result.state === 'unconfigured') return redirect(to('save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to('save-failed'), 302);
  return redirect(to('banner-saved'), 302);
};
