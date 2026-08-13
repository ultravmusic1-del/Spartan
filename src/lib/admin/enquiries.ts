/**
 * Every admin read and write of enquiry data. The admin's equivalent of
 * src/lib/catalog.ts: pages call this and never Supabase directly, so the
 * queries stay in one auditable place.
 *
 * Uses the service-role key, which bypasses RLS. That is safe only because every
 * caller sits behind the middleware guard — if a route ever calls into here
 * without that guard, it has handed out every enquiry the site has taken.
 *
 * NOTHING HERE RETURNS AN EMPTY ARRAY TO MEAN "I COULD NOT LOOK".
 *
 * The first version did, and it was the same defect the enquiry endpoint was
 * built to avoid on the other side of the wire. `/api/enquiry` distinguishes a
 * channel that FAILED from one that was never configured, because "nothing
 * carried it" is only a lost lead if something was asked to (see
 * src/lib/enquiry-outcome.ts). The read path needs the same distinction for a
 * blunter reason: an inbox that renders "No enquiries yet" when it cannot reach
 * the database tells an operator they have no leads. That is a false statement
 * about the business, made confidently, on the one screen whose entire job is
 * to be trusted about it — and it is indistinguishable from the truth.
 *
 * So every read returns an `AdminResult`, and a caller cannot render a list
 * without having said what it will do when there is no list.
 */
import { env, configured } from '../env';
import type { EnquiryItemPayload } from '../enquiry-schema';

const URL_KEY = 'SUPABASE_URL';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';

/** Mirrors the CHECK constraint on public.enquiries.status. */
export const ENQUIRY_STATUSES = ['new', 'contacted', 'quoted', 'closed'] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export function isEnquiryStatus(value: string): value is EnquiryStatus {
  return (ENQUIRY_STATUSES as readonly string[]).includes(value);
}

/**
 * The outcome of an admin read or write.
 *
 * `unconfigured` is not `failed`, and the difference is not pedantry: one is a
 * deployment that was never given credentials — every local run and every CI
 * run — and the other is a database that was asked and did not answer. The
 * first is expected and the operator needs to be told what to set; the second
 * is an incident. Collapsing them would make the honest local state look like
 * an outage, which is how a real outage stops being noticed.
 */
export type AdminResult<T> =
  | { readonly state: 'ok'; readonly data: T }
  | { readonly state: 'unconfigured' }
  | { readonly state: 'failed' };

const ok = <T>(data: T): AdminResult<T> => ({ state: 'ok', data });
const UNCONFIGURED = { state: 'unconfigured' } as const;
const FAILED = { state: 'failed' } as const;

export interface EnquiryRow {
  id: string;
  created_at: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  country: string;
  division: string;
  message: string;
  items: EnquiryItemPayload[];
  source: string;
  status: EnquiryStatus;
  notified_at: string | null;
}

export interface DemandRow {
  product_slug: string;
  product_name: string;
  enquiries: number;
  units: number;
}

/**
 * One screen of the inbox.
 *
 * Paged because the first version selected every row with no bound at all. Two
 * separate problems, and only one of them is about page weight: PostgREST
 * applies the project's own row ceiling to an unbounded select and returns the
 * truncated set with no error and no indication that it truncated, so the inbox
 * would have started quietly hiding the oldest enquiries at some row count
 * nobody here has written down. An explicit range cannot do that, and `total`
 * comes from the count rather than from `rows.length`, so the page can always
 * say how much it is not showing.
 */
export const PAGE_SIZE = 50;

export interface EnquiryPage {
  rows: EnquiryRow[];
  /** Total matching the current filter, not the number on this page. */
  total: number;
  /** 1-based. */
  page: number;
  pages: number;
}

const ready = (): boolean => configured(URL_KEY, SERVICE_KEY);

async function client() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env(URL_KEY), env(SERVICE_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The largest page that may be asked for.
 *
 * An upper bound is needed, not just a lower one. `from` is derived from the
 * page, and `?page=1e20` produces an offset around 5e21 whose `String()` form
 * is `"5e+21"` — PostgREST rejects that as an integer, the read throws, and the
 * screen reports a DATABASE OUTAGE for what is really a mistyped URL. Reporting
 * a client error as an outage is the same class of lie this module exists to
 * stop, so the value is clamped at both ends before it can reach a query.
 */
export const MAX_PAGE = 1_000_000;

/** Clamp a page number off the wire to something that can be asked for. */
export function normalisePage(value: string | number | null | undefined): number {
  const n = typeof value === 'number' ? value : Number(value ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_PAGE, Math.max(1, Math.floor(n)));
}

export interface ListOptions {
  status?: EnquiryStatus;
  page?: number;
}

export async function listEnquiries(
  options: ListOptions = {},
): Promise<AdminResult<EnquiryPage>> {
  if (!ready()) return UNCONFIGURED;

  try {
    const supabase = await client();

    const fetchPage = async (page: number) => {
      const from = (page - 1) * PAGE_SIZE;
      let query = supabase
        .from('enquiries')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        // The tiebreaker, for the reason given on listAllEnquiries: created_at
        // is not unique, and an order that is not total lets a row appear on
        // two pages or on none.
        .order('id', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (options.status) query = query.eq('status', options.status);

      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as EnquiryRow[], total: count ?? 0 };
    };

    const requested = normalisePage(options.page);
    let { rows, total } = await fetchPage(requested);
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    /*
     * A page past the end comes back empty while `total` is not, and rendering
     * that verbatim gives "Showing 49901–49900 of 120" over an empty table —
     * arithmetic that is not wrong so much as meaningless, from a stale
     * bookmark or a filter that has since been worked down. One extra round
     * trip in a case that is rare by construction buys a screen that says
     * something true, so the last page is fetched instead.
     */
    if (requested > pages) {
      ({ rows, total } = await fetchPage(pages));
      return ok({ rows, total, page: pages, pages });
    }

    return ok({ rows, total, page: requested, pages });
  } catch (cause) {
    console.error('[admin] listEnquiries failed', cause);
    return FAILED;
  }
}

/**
 * Every enquiry, for the CSV export.
 *
 * Batched rather than one unbounded select, for the reason on PAGE_SIZE: an
 * unbounded select is silently truncated at the project's row ceiling, and a
 * *truncated export* is the worst shape this failure can take — it is a file
 * that looks complete, gets opened in a spreadsheet, and is treated as the
 * whole record. The loop stops on a short batch, and `MAX_BATCHES` is a
 * backstop so a server that kept returning full pages could not spin here
 * forever.
 */
const MAX_BATCHES = 200;

/**
 * Read every row of something, in batches.
 *
 * `fetch` must apply a TOTAL order — a unique column in the sort keys — because
 * offset paging over a non-unique order is not stable: two rows the database
 * considers equal may come back in a different order for each batch, so one is
 * returned twice and the other never. `created_at` alone is not total; the
 * tables here add `id`.
 *
 * This does not make a batched read atomic. A row inserted between two batches
 * still shifts the window and can duplicate a row across the seam. That is
 * accepted rather than solved with a snapshot: the alternative is keyset paging
 * or a repeatable-read transaction, neither of which PostgREST offers across
 * separate requests, and an admin export racing an inbound RFQ is both rare and
 * self-correcting on the next export.
 */
async function readAll<T>(
  fetch: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const all: T[] = [];

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const from = batch * PAGE_SIZE;
    const { data, error } = await fetch(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as T[];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) return all;
  }

  // Reaching here means MAX_BATCHES * PAGE_SIZE rows without a short batch.
  // Returning the partial set would be exactly the silent truncation this
  // function exists to prevent, so say so instead.
  throw new Error(`read exceeded ${MAX_BATCHES * PAGE_SIZE} rows`);
}

export async function listAllEnquiries(): Promise<AdminResult<EnquiryRow[]>> {
  if (!ready()) return UNCONFIGURED;

  try {
    const supabase = await client();
    return ok(
      await readAll<EnquiryRow>((from, to) =>
        supabase
          .from('enquiries')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
      ),
    );
  } catch (cause) {
    console.error('[admin] listAllEnquiries failed', cause);
    return FAILED;
  }
}

/** `ok` with `null` means the id is genuinely not there — not that the read failed. */
export async function getEnquiry(id: string): Promise<AdminResult<EnquiryRow | null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { data, error } = await supabase.from('enquiries').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return ok((data as EnquiryRow) ?? null);
  } catch (cause) {
    console.error('[admin] getEnquiry failed', cause);
    return FAILED;
  }
}

export async function setStatus(id: string, status: EnquiryStatus): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { error } = await supabase.from('enquiries').update({ status }).eq('id', id);
    if (error) throw new Error(error.message);
    return ok(null);
  } catch (cause) {
    console.error('[admin] setStatus failed', cause);
    return FAILED;
  }
}

interface DemandLine {
  product_slug: string;
  product_name: string;
  qty: number;
  enquiry_id: string;
}

/**
 * Which products are actually being asked about — the question a catalogue
 * lead-generation site exists to answer. Reads the enquiry_lines view, which
 * unnests items, so this is a plain aggregate rather than jsonb gymnastics.
 *
 * Batched like the export, and it needs it SOONER than the export does: this
 * view holds one row per product line per enquiry, so at a few lines per RFQ it
 * reaches the row ceiling at a fraction of the enquiry count. Truncated here
 * the failure is silent and consequential — the counts still render as fact,
 * and this is the screen someone buys stock from.
 */
export async function getDemand(): Promise<AdminResult<DemandRow[]>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const lines = await readAll<DemandLine>((from, to) =>
      supabase
        .from('enquiry_lines')
        .select('product_slug, product_name, qty, enquiry_id')
        // A total order across the batches. The view has no single unique
        // column, but an enquiry names a given product at most once, so the
        // pair is unique.
        .order('enquiry_id', { ascending: true })
        .order('product_slug', { ascending: true })
        .range(from, to),
    );

    const byProduct = new Map<string, DemandRow & { ids: Set<string> }>();
    for (const line of lines) {
      const row = byProduct.get(line.product_slug) ?? {
        product_slug: line.product_slug,
        product_name: line.product_name,
        enquiries: 0,
        units: 0,
        ids: new Set<string>(),
      };
      row.ids.add(line.enquiry_id);
      row.units += line.qty;
      byProduct.set(line.product_slug, row);
    }

    return ok(
      [...byProduct.values()]
        .map(({ ids, ...row }) => ({ ...row, enquiries: ids.size }))
        .sort((a, b) => b.enquiries - a.enquiries || b.units - a.units),
    );
  } catch (cause) {
    console.error('[admin] getDemand failed', cause);
    return FAILED;
  }
}
