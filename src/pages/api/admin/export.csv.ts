import type { APIRoute } from 'astro';
import { listAllEnquiries } from '../../../lib/admin/enquiries';
import { toCsv } from '../../../lib/admin/csv';

export const prerender = false;

const COLUMNS = [
  'created_at',
  'status',
  'source',
  'name',
  'company',
  'email',
  'phone',
  'country',
  'division',
  'message',
  'lines',
  'units',
  'products',
] as const;

/**
 * NEVER SERVE A CSV THAT COULD NOT BE READ.
 *
 * The obvious failure handling here — fall through and emit the header row —
 * produces a valid, downloadable file that opens cleanly in Excel and says the
 * business has no enquiries. It is the single most dangerous output this route
 * could produce, because unlike a broken page it gets saved, attached and
 * quoted from. A download that fails loudly is recoverable; a spreadsheet that
 * lies is not, and nothing downstream of it will ever ask again.
 *
 * So a read that did not succeed answers with an error status and a plain-text
 * body, and no `content-disposition` — nothing lands in the downloads folder.
 */
const problem = (status: number, message: string): Response =>
  new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });

export const GET: APIRoute = async () => {
  const result = await listAllEnquiries();

  if (result.state === 'unconfigured') {
    return problem(
      503,
      'No export: this deployment has no database credentials, so no enquiries could be read.\n' +
        'This is not a statement that there are none. Set SUPABASE_URL and\n' +
        'SUPABASE_SERVICE_ROLE_KEY and try again.\n',
    );
  }

  if (result.state === 'failed') {
    return problem(
      502,
      'No export: the database was asked for the enquiries and did not answer.\n' +
        'No file has been produced rather than a partial one. Try again; if it\n' +
        'persists, check the Supabase project and the server logs.\n',
    );
  }

  const rows = result.data.map((e) => ({
    created_at: e.created_at,
    status: e.status,
    source: e.source,
    name: e.name,
    company: e.company,
    email: e.email,
    phone: e.phone,
    country: e.country,
    division: e.division,
    message: e.message,
    lines: e.items.length,
    units: e.items.reduce((n, i) => n + i.qty, 0),
    products: e.items.map((i) => `${i.slug} x${i.qty}`).join(' | '),
  }));

  // The BOM is what makes Excel read this as UTF-8 rather than the local
  // codepage; without it every non-ASCII name in the export is mangled.
  return new Response('﻿' + toCsv(rows, COLUMNS), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="spartan-enquiries.csv"',
      'cache-control': 'no-store',
    },
  });
};
