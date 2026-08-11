# Enquiry collection — design

**Date:** 2026-08-09
**Status:** implemented
**Supersedes:** nothing. Extends Task 14 (`/api/enquiry`).

## The problem

`/api/enquiry` had no storage of any kind. An enquiry existed only as an email,
which gave four distinct ways to lose a validated buyer:

1. **No Resend credentials.** The endpoint logged the payload and returned
   `{ ok: true, delivered: false }`. On Vercel that is a function log line with
   roughly an hour of retention. Honest to the buyer, invisible to the client.
2. **Resend threw.** The catch block returned 502 and asked the buyer to try
   again — and discarded the payload without logging it. A real, validated,
   willing lead, gone, with no trace that it ever arrived.
3. **Resend accepted and the inbox lost it.** A spam filter, a typo in
   `ENQUIRY_TO_EMAIL`, a deactivated mailbox. No record anywhere.
4. **Nothing to count.** No answer to "how many RFQs last month", "which
   products get asked about", or "did we reply to that one".

(2) is the worst: the failure is silent on both sides.

## The shape of the fix

Write the enquiry durably **first**, then send email as a notification. Email
stops being the record.

```
validate → recordEnquiry() → sendNotification() → markNotified() → respond
             (recorded)          (delivered)        best effort
```

Two independent channels. Either one carrying the enquiry makes the submission a
success, so a mail outage costs a nudge rather than a buyer.

## Decisions

### Postgres via `@supabase/supabase-js`, server-side only

Rejected: direct `pg`/`postgres.js` (connection lifecycle in serverless is real
pain for no benefit at this write volume) and hand-rolled `fetch` to PostgREST
(zero-dep and tempting, but becomes a bad client the moment an upsert or filter
is needed). supabase-js is what the future admin dashboard and the
`supabaseLoader()` migration path in `handoff.md` §5 will use anyway.

Imported dynamically, mirroring how `resend` is already loaded: the module is
only needed on the path that reaches it.

**The browser never talks to Supabase.** That keeps the anon key out of the page
and `connect-src` in `vercel.json` untouched.

### One table with `items jsonb`, plus a view

Rejected: normalised `enquiries` + `enquiry_items`. supabase-js cannot do
multi-table transactions, so atomicity would need a Postgres RPC. A single insert
is atomic by definition, and `enquiry_lines` — a view that unnests `items` —
gives the same reporting power:

```sql
select product_slug, count(*), sum(qty) from enquiry_lines group by product_slug;
```

`security_invoker = true` on the view is load-bearing. Postgres views default to
definer semantics and would otherwise read straight past RLS.

### RLS enabled, zero policies

`anon` and `authenticated` can do nothing at all — not read, not write. Only
`service_role`, which bypasses RLS, can insert, and that key never leaves the
serverless function. Verified: as `anon`, both the table and the view return zero
rows while a row exists, and an insert is refused.

The rows hold names, email addresses and phone numbers. If the publishable key
ever reaches the page it must still be worth nothing here.

### `unconfigured` is not `failed`

The single most important distinction in the design, and the one that would have
broken CI.

A channel with no credentials has not lost anything — it was never asked to carry
the enquiry. A configured channel that threw has. Collapsing the two would have
502'd every enquiry in the e2e suite, because CI holds no secrets for either
channel.

`decideOutcome(store, email)` is a pure function over both states:

| Condition | Result |
|---|---|
| Either channel `ok` | 200, success |
| Both `unconfigured` | 200, `recorded:false delivered:false`, payload logged |
| Any configured, all configured failed | 502, retry, payload logged |

All nine combinations are asserted in `enquiry-outcome.test.ts`. It is pure
precisely because both available mistakes are expensive and invisible to a
passing e2e run: claiming success when nothing captured the enquiry loses the
lead this feature exists to save, and claiming failure when the row *was* written
sends the buyer round again to write a duplicate.

### The honest-reporting rule, restated

The project's existing rule was "never report an enquiry as sent when it was
not". With two channels the rule becomes: **an enquiry is received if anything
durable holds it.** The forms key their honest-failure message off
`recorded || delivered`, not `delivered` alone — so a mail outage with the row
written now correctly reads as success, and only the both-unconfigured case
still says plainly that nothing reached the Spartan team.

### Deliberately absent

- **IP address and user-agent.** The rate limiter already uses the IP in memory;
  persisting it adds a privacy obligation for forensics nobody will perform.
- **A link to the row in the notification email.** YAGNI.
- **An admin UI.** Supabase's table editor is the v1 inbox. `status`
  (`new`/`contacted`/`quoted`/`closed`) is the one column not in the payload, and
  it is what makes that editor an inbox you can work rather than a log you read.

## Schema

```sql
create table public.enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null, company text not null default '',
  email text not null, phone text not null default '',
  country text not null default '', division text not null default '',
  message text not null default '', items jsonb not null default '[]'::jsonb,
  source text not null default 'unknown'
         check (source in ('enquiry','home-cta','contact','unknown')),
  status text not null default 'new'
         check (status in ('new','contacted','quoted','closed')),
  notified_at timestamptz
);
```

Columns mirror `enquiryPayloadSchema` one-to-one, so the Zod schema stays the
single contract between browser, endpoint and database.

`source` uses `.catch('unknown')` rather than a bare enum: it is telemetry, and a
browser holding a stale cached copy of `quick-enquiry.ts` after a rename must not
have its submissions rejected over a field nobody needs to be right.

`notified_at` still NULL means the enquiry was captured but nobody was nudged —
the exact thing to query after a mail outage.

## Files

| Path | Role |
|---|---|
| `src/lib/env.ts` | `process.env` before `import.meta.env`, extracted from the endpoint now it has two consumers |
| `src/lib/enquiry-outcome.ts` | `decideOutcome` — the pure failure matrix |
| `src/lib/enquiry-store.ts` | `recordEnquiry`, `markNotified`. Never throws |
| `src/pages/api/enquiry.ts` | Ordering, and `sendNotification` returning a state rather than throwing |
| `src/components/enquiry/EnquiryForm.tsx` | `captured` replaces `delivered` |
| `src/scripts/quick-enquiry.ts` | Same rule, plus `source` from a data attribute |

## Verification

- 9-case matrix + invariant sweeps over all combinations (`enquiry-outcome.test.ts`)
- Unconfigured store returns `unconfigured`, makes no network call (`enquiry-store.test.ts`)
- `source` defaults and degrades (`enquiry-schema.test.ts`)
- Schema round-trip against the live database: defaults, the view's line count
  and unit total, `anon` blocked on table and view, both CHECK constraints
  refusing bad values
- New verify gate: the service-role key never reaches `dist/client` and no
  client-side directory names it or imports `enquiry-store`

## Follow-on

- Deployment needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
- The catalogue itself moving to Postgres (`handoff.md` §5) now has a project to
  move into.
