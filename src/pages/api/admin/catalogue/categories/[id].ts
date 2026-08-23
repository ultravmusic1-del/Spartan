/**
 * Save one category. A form POST for the same reason the product endpoint is
 * one: no admin page carries client-side JavaScript.
 *
 * It re-reads the record and carries `id`, `slug`, `divisionId` and `status`
 * over from that read, so those four cannot be written from the wire whatever
 * the form posts. See src/lib/admin/catalogue.ts.
 */
import type { APIRoute } from 'astro';
import { getCategory, acceptCategoryEdit, saveCategory } from '../../../../../lib/admin/catalogue';
import type { NoticeCode } from '../../../../../lib/admin/notices';

export const prerender = false;

const to = (path: string, notice: NoticeCode): string => `${path}?notice=${notice}`;

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const id = params.id ?? '';
  const detail = `/admin/catalogue/categories/${id}`;

  const current = await getCategory(id);
  if (current.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (current.state === 'failed') return redirect(to(detail, 'save-failed'), 302);
  if (current.data === null) return redirect(to('/admin/catalogue', 'not-found'), 302);

  const accepted = acceptCategoryEdit(current.data, await request.formData());
  if (!accepted.ok) {
    console.warn(`[admin] rejected edit to category ${id}:`, accepted.issues.join('; '));
    return redirect(to(detail, 'catalogue-invalid'), 302);
  }

  const result = await saveCategory(
    locals.admin?.email ?? 'unknown',
    current.data,
    accepted.category,
  );
  if (result.state === 'unconfigured') return redirect(to(detail, 'save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to(detail, 'save-failed'), 302);

  return redirect(to(detail, 'catalogue-saved'), 302);
};
