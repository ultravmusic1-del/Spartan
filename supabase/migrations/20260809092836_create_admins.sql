-- Who may use the admin area. Membership here is the authority check; the
-- session cookie only proves identity. Kept separate from auth.users so that
-- having an account and being an admin are different facts — there is no
-- public signup, but that must stay true by design rather than by luck.
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);

comment on table public.admins is
  'Allow-list for /admin. Written by hand; never by the application.';

-- Zero policies, exactly as public.enquiries. Only the service-role key reads
-- this, and it does so from a serverless function that has already verified a
-- session. anon and authenticated get nothing.
alter table public.admins enable row level security;
