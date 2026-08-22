-- The enquiries table is the system of record for every RFQ the site takes.
-- Columns mirror `enquiryPayloadSchema` in src/lib/enquiry-schema.ts one-to-one
-- so the Zod schema stays the single contract between browser, endpoint and
-- database. Two columns are not in the payload: `source` (which of the three
-- forms converted) and `status` (the sales workflow), plus `notified_at` for
-- whether the Resend notification actually went out.
--
-- Deliberately absent: IP address and user-agent. The rate limiter already uses
-- the IP in memory; persisting it would add a privacy obligation for forensics
-- nobody is going to perform.
create table public.enquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  name        text not null,
  company     text not null default '',
  email       text not null,
  phone       text not null default '',
  country     text not null default '',
  division    text not null default '',
  message     text not null default '',
  items       jsonb not null default '[]'::jsonb,

  source      text not null default 'unknown'
              check (source in ('enquiry', 'home-cta', 'contact', 'unknown')),
  status      text not null default 'new'
              check (status in ('new', 'contacted', 'quoted', 'closed')),
  notified_at timestamptz
);

comment on table public.enquiries is
  'RFQ submissions from the catalogue site. Written by /api/enquiry with the service-role key only.';
comment on column public.enquiries.items is
  'Array of {slug, name, qty, note}. Empty array is legitimate: a general enquiry with no products selected.';
comment on column public.enquiries.notified_at is
  'When the Resend notification email was sent. NULL means the row exists but nobody was nudged.';

-- Working an inbox means sorting by arrival and filtering to what is untouched.
create index enquiries_created_at_idx on public.enquiries (created_at desc);
create index enquiries_status_idx on public.enquiries (status) where status = 'new';

-- RLS on with ZERO policies. anon and authenticated can therefore do nothing at
-- all — not read, not write. service_role bypasses RLS entirely and is the only
-- credential the serverless function holds. These rows carry names, email
-- addresses and phone numbers, so if the publishable key ever reaches the
-- browser it must still be worth nothing here.
alter table public.enquiries enable row level security;

-- One row per product line, for the question this catalogue exists to answer:
-- which products are actually being asked about.
--
-- `security_invoker = true` is load-bearing. Postgres views default to
-- SECURITY DEFINER semantics, which would run as the view's owner and read
-- straight past the RLS above.
create view public.enquiry_lines with (security_invoker = true) as
select
  e.id          as enquiry_id,
  e.created_at,
  e.status,
  e.company,
  item ->> 'slug'         as product_slug,
  item ->> 'name'         as product_name,
  (item ->> 'qty')::int   as qty,
  nullif(item ->> 'note', '') as note
from public.enquiries e,
     lateral jsonb_array_elements(e.items) as item;

comment on view public.enquiry_lines is
  'Unnests enquiries.items to one row per product line. Group by product_slug for demand.';
