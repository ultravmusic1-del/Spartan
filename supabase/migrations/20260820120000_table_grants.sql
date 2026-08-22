-- The grants Supabase applies that the DDL migrations never captured.
--
-- WHY THIS EXISTS. Migrations 20260809083807 through 20260819115602 were read
-- back out of the live project's migration history, and they reconstruct every
-- table, view, index and constraint faithfully. They do not reconstruct the
-- GRANTs, because those were never issued by a migration: Supabase applies them
-- itself to anything created through Studio or the SQL editor.
--
-- The gap is not cosmetic. Without these, a rebuilt database has tables the
-- application cannot write to, and `service_role` — the only credential the
-- serverless functions hold — gets `permission denied for table admins` on the
-- first insert. These migrations are now the disaster-recovery artifact for
-- this schema, so a database rebuilt from them has to actually run the site.
-- It was found on 2026-08-20 when the test database could not allow-list its
-- own admin.
--
-- GRANTING `anon` EVERYTHING LOOKS ALARMING AND IS NOT. Read it with the line
-- that follows it in every table's own migration:
--
--     alter table ... enable row level security;
--
-- RLS is enabled on every table here with ZERO policies. Under RLS, a policy is
-- the only thing that can permit a row, so `anon` and `authenticated` can read
-- nothing and write nothing regardless of what is granted to them. `service_role`
-- bypasses RLS entirely, which is why it is the only credential that works and
-- why it must never reach the browser.
--
-- So the grants are Supabase's default posture and RLS is the actual control.
-- This migration exists to make a rebuilt database match production exactly,
-- not to widen access. **If a policy is ever added to one of these tables, this
-- file stops being harmless and must be revisited**, because at that moment the
-- grants below start deciding what anon can reach.
--
-- Values verified against the live project on 2026-08-20: every table and the
-- enquiry_lines view carry DELETE, INSERT, REFERENCES, SELECT, TRIGGER,
-- TRUNCATE and UPDATE for all three roles.

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- Anything created later gets the same treatment, so a new table does not
-- silently arrive unwritable and send the next person hunting.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
