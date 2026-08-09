# Admin dashboard — program design

**Date:** 2026-08-09
**Status:** approved, Phase 1 planned
**Realises:** `handoff.md` §5 — "the admin seam"

This is the design for the whole programme. **Phase 1 has an executable plan**
(`docs/superpowers/plans/2026-08-09-admin-phase-1-auth-and-enquiries.md`).
Phases 2–4 are specified here to the level of what they must achieve and how
they will be proved; each gets its own detailed plan written at the start of that
phase, informed by what the previous one taught. Writing Phase 3's task list
today would be inventing detail about a codebase that does not exist yet.

---

## 1. The four decisions that shape everything

Taken 2026-08-09.

### Static, with a rebuild on publish

The public site stays `output: 'static'`. An admin edit writes to Postgres; a
**Publish** action fires a Vercel deploy hook and the change is live in ~60–90s.

Everything measured about this site depends on it being static — Lighthouse
95–100 across four categories, CLS 0.000, TBT 0ms — and `astro:assets` optimises
images **at build time** through `import.meta.glob`, which cannot accept a
runtime path. A catalogue changes weekly. Sub-minute publish is not a compromise
worth trading any of that for.

`productSchema` already carries `status: 'published' | 'draft'` and
`catalog.ts:publishedProducts()` already filters drafts out, so draft-then-publish
works with no schema change.

### Same repo, `/admin/*` as SSR routes

The Zod schemas in `src/content.config.ts` are the contract between loader, admin
write-validation and pages. Splitting the admin into its own deployment means
either sharing that contract across repos or duplicating it, and duplication
drifts. One repo, one contract, one deploy.

`handoff.md` records that `/api/enquiry` is the only server-rendered route and
"nothing else in the repo may set this flag without a reason as good". The admin
is that reason, and this document is the record of it.

### Supabase Storage is the image record; the build pulls images in

Uploads go to Storage. A prebuild step downloads every image the catalogue
references into `src/assets/products/` so the existing `astro:assets` pipeline —
WebP/AVIF generation, `srcset`, and Astro's clamp that makes upscaling impossible
— keeps working untouched.

The alternative, serving Storage URLs directly, loses build-time optimisation
because Supabase's image transformation CDN is a paid feature; on the free tier
you would ship full-size originals into a design whose whole image story is a
documented resolution constraint.

### Phased, each phase shippable

Phase 1 touches nothing the public site renders. Phase 2 is the dangerous one and
is proved by byte-identical output. Only then does any editing UI exist.

---

## 2. The consequence to accept

**Once the catalogue lives in Postgres and images live in Storage, no build works
offline.** `npm run build` will need network and credentials. This is inherent to
the choice, not a defect, and it is why Phase 2 keeps a documented escape hatch
(§4, Phase 2) rather than pretending otherwise.

---

## 3. Security model

### No browser-to-Supabase traffic. At all.

This is the single most important structural decision in the programme, and it
falls straight out of what the enquiry work established.

- **Auth** happens server-side: the login form POSTs to an Astro endpoint, which
  calls `signInWithPassword` and sets an HttpOnly cookie. Token refresh runs in
  middleware on each request.
- **Data** is read and written server-side with the service-role key, which never
  leaves the function.

Consequences, all good:

- `connect-src 'self'` in the CSP needs no Supabase origin.
- `public.enquiries` keeps **RLS enabled with zero policies**. Adding an
  "authenticated admins can select" policy would widen the surface for no gain,
  because nothing authenticated ever connects from a browser.
- No anon key in any page.

Authorisation is: the session cookie proves identity → the server confirms that
user is in `public.admins` → the server then uses the service key. Identity and
authority stay separate.

### Invite-only

Public signup is **disabled in the Supabase dashboard** (Authentication →
Providers → Email → "Enable sign-ups" off). Admin users are created by hand.
There is no registration route, no password reset flow that can create an
account, and no path from an anonymous visitor to an admin session.

Claude does not create the account or handle its password. The operator does that
in Supabase directly.

### The CSP trap this programme must not fall into

`script-src` is `'self'` plus seven SHA-256 hashes, and `npm run csp` derives
those hashes **from `dist/client`**. SSR admin pages are never in `dist/client`.

So an inline `<script>` on an admin page would be shipped unhashed, blocked at
runtime, and **nothing would fail the build or the CSP gate**. The page would
render and silently not work.

The rule, therefore: **admin pages emit no inline scripts.** Server-rendered
forms, progressive enhancement through Astro `<script>` tags that bundle to
external `/_astro/*.js` (allowed by `'self'`), and no client-side islands. Proved
by an e2e test that loads every admin page behind a real login and asserts zero
CSP violations — the pattern `tests/e2e/csp.spec.ts` already uses.

Phase 3 note: `img-src` is `'self' data:`, so an admin preview of a Storage image
would be blocked. It is served through a same-origin proxy endpoint rather than
by widening `img-src`.

### Middleware runs at build time too

Astro middleware executes for prerendered routes during the build. A guard that
assumes a request context would run 96 times against nothing. The middleware
early-returns for any path outside `/admin` before touching cookies.

### Not indexed

`robots.txt` gains `Disallow: /admin`, the admin layout emits
`<meta name="robots" content="noindex, nofollow">`, and admin routes are SSR so
they never enter the sitemap. The verify gate's "97 pages, one title and one
canonical each" count must not move.

---

## 4. The phases

### Phase 1 — Auth and the enquiry inbox

**Ships:** login, session guard, enquiry list, enquiry detail, status workflow
(`new → contacted → quoted → closed`), the product-demand report from
`enquiry_lines`, and CSV export.

**Touches nothing the public site renders.** No catalogue migration, no loader
change, no change to any of the 96 pages.

**Proved by:** the 11 existing verify gates still passing unchanged, the page
count still 97, e2e coverage of the auth boundary (an unauthenticated request to
every admin route redirects, and a non-admin authenticated user is refused), and
zero CSP violations on every admin page.

Detailed plan exists.

### Phase 2 — The catalogue into Postgres

**Ships:** `divisions`, `categories`, `products` tables seeded from the JSON, and
a custom Astro Content Layer loader replacing `file()` in `content.config.ts`.

**No UI.** The public site must be unchanged.

**Proved by byte-identical build output.** Build the site from JSON, keep
`dist/client`; migrate; build from Postgres; diff. Any difference is a migration
defect. This is the strongest acceptance test available and it is the reason this
phase is isolated from any editing UI — if the two builds match, the seam held.

The loader fetches **all** rows and `catalog.ts` keeps filtering drafts, rather
than filtering in the loader. Preserving the existing semantics exactly is what
makes the byte-identical test meaningful.

**Escape hatch:** `CATALOGUE_SOURCE=json|postgres`, defaulting to postgres, so a
build can fall back to the committed JSON if Supabase is unreachable. Removed
once Phase 3 has been live long enough to trust.

**Risks:** this phase touches all 96 pages through one module. It ships alone,
behind its own verification, and nothing else lands with it.

### Phase 3 — Catalogue CRUD and image assets

**Ships:** create/edit/delete for products and categories, image upload to
Storage, the prebuild sync, the Publish action wired to a Vercel deploy hook, and
build status in the UI.

Guard rails that are part of the feature, not polish:

- **Slug permanence.** `docs/CONTENT-EDITING.md` names this as a rule that bites:
  changing a published product's slug breaks its URL and its search ranking. The
  editor refuses silently changing one — it requires an explicit confirmation and
  records the old slug so a redirect can be emitted.
- **Referential integrity.** A category with products cannot be deleted. Deleting
  a product that is a category's `heroProductSlug` must repoint or clear it —
  the field is nullable and two categories legitimately use `null`.
- **"Never invent product data" at the point of entry.** Empty fields stay empty
  and submit as absent, never as `""` or `0`. No placeholder text in an input
  that could be mistaken for a value. The EN 388 editor states inline that `X`
  means untested and `0` means a tested result of zero, because that distinction
  is already documented as a trap and this is the screen where it will be got
  wrong.
- **Audit log.** `catalogue_audit`: actor, entity, action, before/after JSON,
  timestamp. On a catalogue whose first rule is that every value traces to a
  source, "who changed this and when" is not optional.
- **Image validation on upload.** Format, dimensions and transparency are checked
  and reported. The design needs knocked-out PNGs on dark surfaces; a JPEG with a
  white box behind the product is the single most likely upload mistake, and it
  is the same failure mode as the clip-forwarding bug in `tools/README.md`.

### Phase 4 — Bulk import and preview

**Ships:** CSV/JSON import of many products, and a draft preview.

The import is **never applied directly**. Upload → parse → validate every row
against `productSchema` → present a diff of what would be created, updated and
skipped, plus every validation error with its row number → the admin confirms →
applied in one transaction. An import that silently defaults a missing field is
the "never invent product data" rule failing at scale, so a row with a missing
required value is reported, not filled.

Draft preview renders a `status: draft` product through the real product template
on an SSR admin route, so what you approve is what publishes.

---

## 5. New tables

Phase 1 adds one:

```sql
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- zero policies: service-role only, same as public.enquiries
```

Phases 2–3 add `divisions`, `categories`, `products` and `catalogue_audit`, all
mirroring the Zod schemas in `src/content.config.ts`, all RLS-enabled with zero
policies.

## 6. New environment variables

| Variable | Phase | Purpose |
|---|---|---|
| `SUPABASE_ANON_KEY` | 1 | Auth only — `signInWithPassword`. Never used for data. |
| `VERCEL_DEPLOY_HOOK_URL` | 3 | Fired by Publish. A secret: anyone holding it can trigger builds. |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` already exist.

## 7. What this programme must not break

Every one of these is an existing, verified invariant:

- 11 verify gates, 96 unit tests, 137 e2e tests
- 97 pages with exactly one title and one canonical each
- No price, availability or rating in structured data
- The admin seam: no page or component imports `src/data/*` or calls
  `getCollection` directly
- `script-src` with no `'unsafe-inline'`
- The service-role key never reaching `dist/client`
- Lighthouse ≥95 on all four categories
