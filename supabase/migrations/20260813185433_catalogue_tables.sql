-- Phase 2: the catalogue moves into Postgres.
--
-- Columns mirror the Zod schemas in src/content.config.ts one-to-one, including
-- nullability, so those schemas stay the single contract between database,
-- Content Layer loader and pages. Anything that drifts here has to drift there
-- too, and the byte-identical build test is what catches it.
--
-- `specs` and `en388` stay jsonb: they are read as whole objects by the loader
-- and never queried into. Normalising them would buy nothing and would make the
-- round trip lossy.
--
-- RLS enabled with zero policies, exactly like public.enquiries. The build reads
-- with the service-role key; anon can neither read nor write. The catalogue is
-- public information, but it is published by the BUILD, not by the database, and
-- an anon-readable table would be a second way to get it that nobody maintains.

create table if not exists public.divisions (
  id          text primary key,
  slug        text not null unique,
  name        text not null,
  blurb       text not null,
  hero_image  text not null,
  "order"     integer not null
);

create table if not exists public.categories (
  id                 text primary key,
  slug               text not null unique,
  name               text not null,
  division_id        text not null references public.divisions(id),
  description        text not null,
  hero_product_slug  text,
  status             text not null check (status in ('active', 'expanding')),
  "order"            integer not null
);

create table if not exists public.products (
  slug           text primary key,
  name           text not null,
  variant_label  text,
  category_id    text not null references public.categories(id),
  images         jsonb not null default '[]'::jsonb,
  specs          jsonb not null default '[]'::jsonb,
  -- Absent, never defaulted: a missing EN 388 rating must read as missing. The
  -- whole point of the field is that six products have one and 79 do not.
  en388          jsonb,
  status         text not null default 'published' check (status in ('published', 'draft')),
  -- Nullable as of 2026-08-13. Brochure- and datasheet-derived records carry
  -- {doc, page}; a record created in the admin may have none, and
  -- catalogue_audit records who entered it instead. See the plan, decision 1.1.
  source         jsonb,
  "order"        integer not null
);

comment on column public.products.source is
  'Provenance for brochure/datasheet records: {doc, page}. Null for records created in the admin, whose provenance is the catalogue_audit entry that created them.';

-- Who changed what, and when. On a catalogue whose first rule is that every
-- value traces to a source, this is not optional -- and since 2026-08-13 it is
-- also the provenance of every hand-entered product.
create table if not exists public.catalogue_audit (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor       text not null,
  entity      text not null check (entity in ('division', 'category', 'product')),
  entity_id   text not null,
  action      text not null check (action in ('create', 'update', 'delete', 'restore')),
  before      jsonb,
  after       jsonb
);

create index if not exists catalogue_audit_entity_idx
  on public.catalogue_audit (entity, entity_id, at desc);

alter table public.divisions       enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.catalogue_audit enable row level security;
