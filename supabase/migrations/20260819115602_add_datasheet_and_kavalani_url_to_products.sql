-- The loader already read both of these; the table did not have them. Added
-- 2026-08-19 when the catalogue moved to Postgres and the mismatch surfaced.
alter table public.products add column if not exists datasheet_url text;
alter table public.products add column if not exists kavalani_url  text;
