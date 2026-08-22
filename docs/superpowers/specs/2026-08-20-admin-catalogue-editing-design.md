# Editing the catalogue from `/admin`

**Date:** 2026-08-20
**Status:** approved, not yet implemented
**Implements:** Stages 3 and 4 of `docs/superpowers/plans/2026-08-19-admin-content-management.md`, plus the Publish half of Stage 6. Its two standing decisions (provenance via `catalogue_audit`; an explicit Publish button, not publish-on-save) are inherited and not re-opened.

## Where this starts from

The catalogue has been in Postgres since 2026-08-19 and the live site builds from it: 94 products, 15 categories, 2 divisions, verified against the database rather than assumed. `catalogue_audit` exists and holds 0 rows.

The admin can do none of it. Six pages and six endpoints exist and every one is enquiries or authentication. A catalogue correction today means a developer.

**Stage 2 is not on this path.** It moves `site.json` and the hero banner list into Postgres, which is different content. It stays unfinished and this work does not touch it.

## Decisions taken with the client

Do not relitigate these.

1. **Scope is browse, edit, publish.** Creating, deleting, image upload, site text and banner selection are out.
2. **Every product field is editable except `en388`.** It is shown, never writable.
3. **Save writes live; Publish requests a build.** No draft state.
4. **Specifications are edited as paired label/value fields**, not as parsed text.
5. **Authenticated screens get real end-to-end coverage**, against an ephemeral database.

## The design

### The write path

One new module, `src/lib/admin/catalogue.ts`, mirroring `src/lib/admin/enquiries.ts`. It is the only code that writes to `products` and `categories`. Routes never call Supabase. That is rule 3's seam and it is also what keeps the service-role key in one place.

**Validation reuses the build's own schema.** `src/content.config.ts` already exports `productSchema` and `categorySchema`, and those are what the Content Layer validates against at build time. Admin saves validate against **those same objects**.

The alternative — an admin-side copy — is the obvious implementation and it is a trap. The two drift, and the failure is delayed and misattributed: a save passes, nothing looks wrong, and a build fails hours later, possibly one somebody else triggered for an unrelated reason. Sharing the schema turns that into a form error at the moment of saving.

The database row and the collection entry are not the same shape, so a mapping layer exists either way. It lives in the new module and is unit-tested in both directions.

### Routes

| Route | Purpose |
|---|---|
| `/admin/catalogue` | Every product and category, grouped by category, filterable by name |
| `/admin/catalogue/products/[slug]` | Product edit form |
| `/admin/catalogue/categories/[id]` | Category edit form |
| `/api/admin/catalogue/products/[slug]` | Save a product |
| `/api/admin/catalogue/categories/[id]` | Save a category |
| `/api/admin/catalogue/publish` | Fire the deploy hook |

All server-rendered form posts. **No client-side JavaScript**, because `/admin` never enters `dist/client` and so can never receive a CSP hash — an inline script there is blocked at runtime while every gate stays green. All carry `export const prerender = false`. The existing middleware already guards `/admin/*` and `/api/admin/*` and needs no change.

Route count moves from 13 to 19, so `npm run counts` must be re-run and `CLAUDE.md` copied to `AGENTS.md`.

### The product form

Grouped into Identity, Classification, Specifications, EN 388, and Links and provenance.

**Read-only fields are enforced server-side, not visually.** `slug`, `en388` and `source` are absent from the accepted-field list, so a hand-crafted POST cannot set them. A `readonly` attribute is a hint to a browser, not a control.

- **`slug`** is a permanent URL. Changing one breaks every existing link and discards that page's search ranking. A developer changes it deliberately, with a redirect.
- **`en388`** is the one field where a wrong value misrepresents protective equipment. `X` means *not submitted for that test*, not *failed*. It affects 6 of 94 products, so locking it costs almost nothing and removes the only genuinely dangerous edit.

**Specifications are paired fields.** `specs` is a list of `{label, value}` where `label` may be null — two of Cut Flex's four lines are unlabelled bullets, which is how the brochure prints them. One blank row always renders, so adding a line needs no control at all; an "Add a specification" post returns a page with one more blank row for bulk work.

The rejected alternative was a textarea with one `label: value` line per spec. It is nicer to type into and it cannot be trusted: the catalogue already contains `Yellow + Size/Length: 18ˮ`, a value with a colon inside it, so any split rule will eventually cut a real value in the wrong place. Rule 1 says a specification must not be silently altered.

### Publish

Pressing Publish POSTs to `VERCEL_DEPLOY_HOOK_URL`. The hook returns a job id immediately and says nothing about whether the build succeeds.

**So the screen reports "Build requested at HH:MM", never "Published".** This is rule 2's principle in a second place: an enquiry is never reported as sent when it was not, and an edit is never reported as live when a build might be failing. State what is known.

**With no hook configured, publish refuses**, with an explicit "publishing is not configured". This is deliberately the opposite of the enquiry rule, where `unconfigured` is not `failed` because the enquiry was still recorded in Postgres. A publish records nothing. It either requested a build or it did not.

### Audit, and the concurrency it covers for

Every save writes a `catalogue_audit` row. The table already has `actor`, `action`, `entity`, `entity_id`, `before` and `after`, so one insert gives a full before/after history at no design cost.

It earns its place three times over: it is the history, it satisfies the shape gate's "cites a brochure page **or** has an audit entry", and it is the recovery path for the thing this design does not prevent.

**There is no locking.** Two people editing the same product means the second save wins and the first is lost. For a team of two to five that is the right trade, but *silently* is the operative word, and `before` is what makes the overwritten values recoverable. Optimistic locking is a `updated_at` column and one comparison if it is ever wanted; it is not wanted yet.

### Errors

A save that cannot reach Supabase re-renders the form with everything the editor typed still in it, plus the error. It never returns a blank form. A failed deploy hook says so plainly rather than showing success.

## Testing

### The schema has to be captured first

**There is no committed schema.** No `supabase/` directory, no migrations. `seed.sql` inserts data, not tables. The production schema exists in exactly one place, the live cloud project, and if that were lost it would have to be reconstructed by reading the loaders.

Nothing can be tested against a throwaway database until there is something to create the database from, so the first task is pulling the schema into `supabase/migrations/` and committing it. This is worth doing on its own merits; this work forces it.

### The setup

1. `supabase/migrations/` holds the schema. `supabase/config.toml` configures the local stack.
2. `supabase start` brings up Postgres **and** Auth in Docker, applies migrations, then runs `seed.sql` and `tools/seed-catalogue.mjs`.
3. A test admin is created through the local Auth admin API at setup and inserted into `admins`. It lives only as long as the container, so there are no long-lived credentials and nothing to leak.
4. Playwright signs in once, reuses the session, and exercises browse, edit and save against a database it may freely mutate.
5. `VERCEL_DEPLOY_HOOK_URL` is unset in tests, so publish exercises the refusal path and no deployment can be triggered from CI.

### The costs, on the record

This roughly doubles the CI setup surface and adds a Docker dependency to a pipeline that currently runs `npm ci` and one command. `verify.yml`'s 20 minute timeout will likely need raising.

Locally, `npm run verify -- --full` will need the stack running. When Docker is unavailable it **fails with an instruction rather than skipping**. A skipped test that reports green is the failure mode this repository exists to prevent.

### What the gates cover

- `npm run verify`'s catalogue-shape gate follows `CATALOGUE_SOURCE`, so it already validates whatever the admin wrote into Postgres. Free coverage.
- Totals are held against `tools/catalogue-snapshot.json`. Editing does not change totals, so no regeneration. Creating and deleting would; that is a later stage.
- Unit tests: the mapping both ways, schema validation, and read-only field enforcement against hand-crafted posts.
- End-to-end: sign in, browse, edit, save, and publish's refusal path.

## Prerequisite

**Docker Desktop must be installed on the development machine.** Without it `supabase start` cannot run, the authenticated tests can be written but never executed locally, and the first real run would be on GitHub Actions — a blind push-and-wait loop. The Supabase CLI itself needs no install; `npx supabase` resolves 2.115.0 already.

Every other credential is present: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `VERCEL_DEPLOY_HOOK_URL` and `CATALOGUE_SOURCE` are all populated in `.env`.

## Out of scope

- Creating and deleting products or categories, and the referential integrity that comes with them.
- Image upload and Supabase Storage.
- Site text and hero banner selection, which is Stage 2 and still unfinished.
- Any change to the public site's appearance or behaviour.
- Roles. Every admin may publish, decided 2026-08-19; restricting it later is an `admins.role` column and one check.
