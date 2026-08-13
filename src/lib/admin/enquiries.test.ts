import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  listEnquiries,
  listAllEnquiries,
  getEnquiry,
  setStatus,
  getDemand,
  getCounts,
  normalisePage,
  ENQUIRY_STATUSES,
  WORKFLOW_STATUSES,
  TEST_STATUS,
  isEnquiryStatus,
  PAGE_SIZE,
  MAX_PAGE,
} from './enquiries';

/* ------------------------------------------------------------------ helpers -- */

interface Query {
  table: string;
  filters: Record<string, unknown>;
  /** What `.neq()` ruled out — how a query says "not test". */
  excluded: Record<string, unknown>;
  orderedBy: string[];
  range?: [number, number];
  countRequested?: boolean;
}

type Answer = { data: unknown; error: { message: string } | null; count?: number | null };

/**
 * A stand-in for the Supabase query builder.
 *
 * It has to be BOTH chainable and awaitable, because `listEnquiries` builds the
 * query, conditionally appends `.eq()` to it, and only then awaits — so every
 * method returns the builder and the builder is a thenable.
 */
function fakeSupabase(answer: (q: Query) => Answer) {
  const calls: Query[] = [];

  const client = {
    from(table: string) {
      const q: Query = { table, filters: {}, excluded: {}, orderedBy: [] };
      calls.push(q);

      const builder = {
        select(_columns: string, options?: { count?: string }) {
          q.countRequested = options?.count === 'exact';
          return builder;
        },
        order(column: string) {
          q.orderedBy.push(column);
          return builder;
        },
        eq(column: string, value: unknown) {
          q.filters[column] = value;
          return builder;
        },
        neq(column: string, value: unknown) {
          q.excluded[column] = value;
          return builder;
        },
        update(patch: Record<string, unknown>) {
          Object.assign(q.filters, { __update: patch });
          return builder;
        },
        range(from: number, to: number) {
          q.range = [from, to];
          return builder;
        },
        maybeSingle: () => Promise.resolve(answer(q)),
        then: (res: (v: Answer) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve(answer(q)).then(res, rej),
      };

      return builder;
    },
  };

  return { client, calls };
}

const createClient = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient }));

function useSupabase(answer: (q: Query) => Answer) {
  const { client, calls } = fakeSupabase(answer);
  createClient.mockReturnValue(client);
  return calls;
}

function configure(): void {
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
}

function unconfigured(): void {
  vi.stubEnv('SUPABASE_URL', '');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
}

const row = (id: string) => ({ id, status: 'new', items: [] });
const rows = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => row(`r${offset + i}`));

beforeEach(() => createClient.mockReset());
afterEach(() => vi.unstubAllEnvs());

/* -------------------------------------------------------------------- tests -- */

describe('enquiry status', () => {
  it('is the same values the CHECK constraint allows', () => {
    expect(ENQUIRY_STATUSES).toEqual(['new', 'contacted', 'quoted', 'closed', 'test']);
  });

  it('rejects anything else', () => {
    expect(isEnquiryStatus('new')).toBe(true);
    expect(isEnquiryStatus('test')).toBe(true);
    expect(isEnquiryStatus('archived')).toBe(false);
    expect(isEnquiryStatus('')).toBe(false);
  });

  /*
   * `test` is a status but not a stage. Everything that reports on the business
   * counts the workflow and not this, so the two lists must not drift into each
   * other — a `test` that leaked into WORKFLOW_STATUSES would put the team's own
   * submissions into the headline figures with nothing to show it had happened.
   */
  it('keeps test out of the workflow', () => {
    expect(WORKFLOW_STATUSES).toEqual(['new', 'contacted', 'quoted', 'closed']);
    expect(WORKFLOW_STATUSES).not.toContain(TEST_STATUS);
    expect(ENQUIRY_STATUSES).toContain(TEST_STATUS);
  });
});

describe('normalisePage', () => {
  it('clamps anything a query string can hold to a page that can be asked for', () => {
    expect(normalisePage('2')).toBe(2);
    expect(normalisePage(null)).toBe(1);
    expect(normalisePage('0')).toBe(1);
    expect(normalisePage('-4')).toBe(1);
    expect(normalisePage('banana')).toBe(1);
    expect(normalisePage('2.9')).toBe(2);
    // A negative `from` makes PostgREST return an error rather than page one,
    // so this clamp is what stops `?page=-1` reading as an outage.
    expect(normalisePage(Number.NEGATIVE_INFINITY)).toBe(1);
  });

  /*
   * The upper bound matters for the same reason. `(1e20 - 1) * 50` stringifies
   * as "5e+21", PostgREST rejects it as an integer, and the read throws — so
   * without this clamp a mistyped page number renders as a DATABASE OUTAGE.
   */
  it('bounds the page above, so a huge value cannot reach a query as exponent notation', () => {
    expect(normalisePage('1e20')).toBe(MAX_PAGE);
    expect(normalisePage(Number.MAX_SAFE_INTEGER)).toBe(MAX_PAGE);
    expect(normalisePage(Number.POSITIVE_INFINITY)).toBe(1); // not finite
    expect(String((MAX_PAGE - 1) * 50)).toMatch(/^\d+$/);
  });
});

/*
 * The distinction this module exists for. An unconfigured deployment — every
 * local run and every CI run — must never be reported as an empty inbox.
 */
describe('without credentials', () => {
  beforeEach(unconfigured);

  it('reports every read as unconfigured, never as empty', async () => {
    expect(await listEnquiries()).toEqual({ state: 'unconfigured' });
    expect(await listAllEnquiries()).toEqual({ state: 'unconfigured' });
    expect(await getEnquiry('id')).toEqual({ state: 'unconfigured' });
    expect(await getDemand()).toEqual({ state: 'unconfigured' });
    // Zeroed tiles would read as "no leads", which is the lie this module exists
    // to prevent — the same reason an empty list is not an acceptable answer.
    expect(await getCounts()).toEqual({ state: 'unconfigured' });
  });

  it('reports a write as unconfigured, never as a plain failure', async () => {
    expect(await setStatus('id', 'closed')).toEqual({ state: 'unconfigured' });
  });

  it('makes no network call and never builds a client', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await listEnquiries();
    await listAllEnquiries();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe('listEnquiries', () => {
  beforeEach(configure);

  it('asks for one page and derives the page count from the total, not the rows', async () => {
    const calls = useSupabase(() => ({ data: rows(PAGE_SIZE), error: null, count: 120 }));

    const result = await listEnquiries({ page: 2 });

    expect(result).toMatchObject({ state: 'ok' });
    if (result.state !== 'ok') throw new Error('unreachable');
    expect(result.data.rows).toHaveLength(PAGE_SIZE);
    expect(result.data.total).toBe(120);
    expect(result.data.page).toBe(2);
    expect(result.data.pages).toBe(3);
    expect(calls[0].range).toEqual([PAGE_SIZE, PAGE_SIZE * 2 - 1]);
    expect(calls[0].countRequested).toBe(true);
  });

  it('reports one page when there is nothing at all, rather than zero', async () => {
    useSupabase(() => ({ data: [], error: null, count: 0 }));

    const result = await listEnquiries();

    if (result.state !== 'ok') throw new Error('expected ok');
    // Zero pages would render "page 1 of 0", and `pages` is what the pager
    // compares against to decide whether "next" exists.
    expect(result.data.pages).toBe(1);
    expect(result.data.total).toBe(0);
    expect(result.data.rows).toEqual([]);
  });

  /*
   * A stale bookmark, or a filter worked down since the link was made. Rendered
   * verbatim this produced "Showing 49901–49900 of 120" over an empty table.
   */
  it('falls back to the last page when asked for one past the end', async () => {
    const calls = useSupabase((q) => {
      const from = q.range?.[0] ?? 0;
      // 120 rows => 3 pages. Anything at or beyond offset 150 is past the end.
      if (from >= 150) return { data: [], error: null, count: 120 };
      return { data: rows(20), error: null, count: 120 };
    });

    const result = await listEnquiries({ page: 999 });

    if (result.state !== 'ok') throw new Error('expected ok');
    expect(result.data.page).toBe(3);
    expect(result.data.pages).toBe(3);
    expect(result.data.rows).not.toHaveLength(0);
    // One wasted round trip, only in this rare case — the second asks for the
    // last page rather than the requested one.
    expect(calls).toHaveLength(2);
    expect(calls[1].range).toEqual([100, 149]);
  });

  it('does not re-query when the requested page exists', async () => {
    const calls = useSupabase(() => ({ data: rows(20), error: null, count: 120 }));
    await listEnquiries({ page: 2 });
    expect(calls).toHaveLength(1);
  });

  /*
   * created_at is not unique, so it cannot be the only sort key: an order that
   * is not total lets a row land on two pages, or on none.
   */
  it('orders by a unique tiebreaker as well as the timestamp', async () => {
    const calls = useSupabase(() => ({ data: [], error: null, count: 0 }));
    await listEnquiries();
    expect(calls[0].orderedBy).toEqual(['created_at', 'id']);
  });

  it('passes a status filter through', async () => {
    const calls = useSupabase(() => ({ data: [], error: null, count: 0 }));
    await listEnquiries({ status: 'quoted' });
    expect(calls[0].filters.status).toBe('quoted');
  });

  it('reports a database error as failed, not as empty', async () => {
    useSupabase(() => ({ data: null, error: { message: 'connection refused' }, count: null }));
    expect(await listEnquiries()).toEqual({ state: 'failed' });
  });
});

describe('listAllEnquiries', () => {
  beforeEach(configure);

  it('keeps reading until a short batch, so an export is never silently truncated', async () => {
    const calls = useSupabase((q) => {
      const from = q.range?.[0] ?? 0;
      // Two full pages, then a partial one.
      if (from === 0) return { data: rows(PAGE_SIZE, 0), error: null };
      if (from === PAGE_SIZE) return { data: rows(PAGE_SIZE, PAGE_SIZE), error: null };
      return { data: rows(7, PAGE_SIZE * 2), error: null };
    });

    const result = await listAllEnquiries();

    if (result.state !== 'ok') throw new Error('expected ok');
    expect(result.data).toHaveLength(PAGE_SIZE * 2 + 7);
    expect(calls).toHaveLength(3);
  });

  it('stops after one batch when the first is already short', async () => {
    const calls = useSupabase(() => ({ data: rows(3), error: null }));
    const result = await listAllEnquiries();
    if (result.state !== 'ok') throw new Error('expected ok');
    expect(result.data).toHaveLength(3);
    expect(calls).toHaveLength(1);
  });

  it('orders by a unique tiebreaker, so no row spans two batches or none', async () => {
    const calls = useSupabase(() => ({ data: rows(1), error: null }));
    await listAllEnquiries();
    expect(calls[0].orderedBy).toEqual(['created_at', 'id']);
  });

  /*
   * The backstop, and the reason it fails rather than returning what it has: a
   * truncated CSV is a file that looks complete. Handing back a partial export
   * would be the exact failure this batching was written to prevent.
   */
  it('fails rather than returning a partial export if the batches never end', async () => {
    useSupabase(() => ({ data: rows(PAGE_SIZE), error: null }));
    expect(await listAllEnquiries()).toEqual({ state: 'failed' });
  });
});

describe('getEnquiry', () => {
  beforeEach(configure);

  it('separates "no such enquiry" from "could not look"', async () => {
    useSupabase(() => ({ data: null, error: null }));
    expect(await getEnquiry('missing')).toEqual({ state: 'ok', data: null });

    useSupabase(() => ({ data: null, error: { message: 'boom' } }));
    expect(await getEnquiry('missing')).toEqual({ state: 'failed' });
  });
});

describe('setStatus', () => {
  beforeEach(configure);

  it('reports success and failure distinctly', async () => {
    useSupabase(() => ({ data: null, error: null }));
    expect(await setStatus('id', 'contacted')).toEqual({ state: 'ok', data: null });

    useSupabase(() => ({ data: null, error: { message: 'check constraint' } }));
    expect(await setStatus('id', 'contacted')).toEqual({ state: 'failed' });
  });
});

describe('getCounts', () => {
  beforeEach(configure);

  it('counts by status without reading any rows, and sums only the workflow', async () => {
    const per: Record<string, number> = { new: 4, contacted: 2, quoted: 1, closed: 7, test: 99 };

    const calls = useSupabase((q) => {
      if (q.table === 'enquiry_lines') return { data: null, error: null, count: 12 };
      return { data: null, error: null, count: per[String(q.filters.status)] ?? 0 };
    });

    const result = await getCounts();

    if (result.state !== 'ok') throw new Error('expected ok');
    expect(result.data.byStatus).toEqual(per);

    /*
     * 14, not 113. The chips need the test count so they can be found, but the
     * headline total is a statement about the business and the team's own
     * submissions are not part of it. The 99 here is deliberately absurd: a sum
     * that included it could not be mistaken for correct.
     */
    expect(result.data.total).toBe(14);
    expect(result.data.lines).toBe(12);

    // One per status plus one for the lines view. Every one asks for a count
    // and no rows — a tile must never become an unbounded read.
    expect(calls).toHaveLength(6);
    expect(calls.every((c) => c.countRequested)).toBe(true);

    // And the line count is of real enquiries only, so it agrees with demand.
    const lines = calls.find((c) => c.table === 'enquiry_lines');
    expect(lines?.excluded.status).toBe(TEST_STATUS);
  });

  it('reports a failure as failed rather than as a row of zeros', async () => {
    useSupabase(() => ({ data: null, error: { message: 'boom' }, count: null }));
    expect(await getCounts()).toEqual({ state: 'failed' });
  });
});

describe('getDemand', () => {
  beforeEach(configure);

  it('counts distinct enquiries per product and sums units', async () => {
    useSupabase(() => ({
      data: [
        { product_slug: 'gp5', product_name: 'Grip Guard GP5', qty: 2, enquiry_id: 'a' },
        { product_slug: 'gp5', product_name: 'Grip Guard GP5', qty: 3, enquiry_id: 'b' },
        { product_slug: 'visor', product_name: 'Visors', qty: 9, enquiry_id: 'a' },
      ],
      error: null,
    }));

    const result = await getDemand();

    if (result.state !== 'ok') throw new Error('expected ok');
    // gp5 leads on enquiry count (2 vs 1) even though visor has more units —
    // "how many buyers asked" is the question this report answers.
    expect(result.data).toEqual([
      { product_slug: 'gp5', product_name: 'Grip Guard GP5', enquiries: 2, units: 5 },
      { product_slug: 'visor', product_name: 'Visors', enquiries: 1, units: 9 },
    ]);
  });

  /*
   * The whole reason the status exists. A test enquiry the team submitted while
   * checking the site is not demand, and leaving it in would put their own
   * clicks into the figures someone buys stock from.
   */
  it('excludes test enquiries', async () => {
    const calls = useSupabase(() => ({ data: [], error: null }));
    await getDemand();
    expect(calls[0].excluded.status).toBe(TEST_STATUS);
  });

  it('reports a missing view as failed rather than as no demand', async () => {
    useSupabase(() => ({ data: null, error: { message: 'relation does not exist' } }));
    expect(await getDemand()).toEqual({ state: 'failed' });
  });

  /*
   * enquiry_lines holds one row per product line per enquiry, so it reaches the
   * row ceiling at a fraction of the enquiry count — this read needs batching
   * sooner than the export does, and was the one unbounded select left.
   */
  it('reads the view in batches rather than in one unbounded select', async () => {
    const line = (id: string) => ({
      product_slug: 'gp5',
      product_name: 'Grip Guard GP5',
      qty: 1,
      enquiry_id: id,
    });

    const calls = useSupabase((q) => {
      const from = q.range?.[0] ?? 0;
      if (from === 0) {
        return { data: Array.from({ length: PAGE_SIZE }, (_, i) => line(`a${i}`)), error: null };
      }
      return { data: [line('z')], error: null };
    });

    const result = await getDemand();

    if (result.state !== 'ok') throw new Error('expected ok');
    expect(calls).toHaveLength(2);
    expect(calls[0].range).toEqual([0, PAGE_SIZE - 1]);
    // Every line counted, across both batches.
    expect(result.data[0].enquiries).toBe(PAGE_SIZE + 1);
    // A total order, or a row could land in two batches or in none.
    expect(calls[0].orderedBy).toEqual(['enquiry_id', 'product_slug']);
  });
});
