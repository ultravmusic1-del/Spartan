-- Hero banners, managed from /admin since 2026-08-23.
--
-- The IMAGE lives in Supabase Storage (private bucket `banners`); this table is
-- the metadata and the ordering. `path` is the object path within that bucket,
-- and it is unique because one row owns one file.
--
-- width/height are recorded at UPLOAD rather than derived at build time. The
-- build needs them to render a remote source without the band jumping as images
-- load, and the admin needs them to show what it accepted. Deriving them twice
-- is how the two come to disagree.
--
-- RLS enabled with zero policies, exactly like every other table here. The
-- banners are public information, but they are published by the BUILD, not by
-- the database -- the same reasoning that keeps the bucket private.
create table if not exists public.hero_banners (
  id         uuid primary key default gen_random_uuid(),
  path       text not null unique,
  name       text not null,
  width      integer not null,
  height     integer not null,
  "order"    integer not null default 0,
  enabled    boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column public.hero_banners.path is
  'Object path within the private `banners` storage bucket. Unique: one row owns one file.';

comment on column public.hero_banners.enabled is
  'False on insert, deliberately: a freshly uploaded banner must not ride out on somebody else''s Publish before anyone has looked at it.';

alter table public.hero_banners enable row level security;

-- catalogue_audit records banner changes too, so its entity list has to accept
-- one more value. Dropped and re-added rather than altered, because a check
-- constraint cannot be widened in place.
alter table public.catalogue_audit drop constraint if exists catalogue_audit_entity_check;
alter table public.catalogue_audit add constraint catalogue_audit_entity_check
  check (entity in ('division', 'category', 'product', 'banner'));
