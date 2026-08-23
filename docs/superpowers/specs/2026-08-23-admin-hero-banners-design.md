# Hero banners, managed from /admin — design

**Goal.** An admin can upload a hero banner, see it, order it, switch it on or
off, and delete it, without a developer and without a commit.

**Status.** Approved by the client on 2026-08-23. Supersedes the banner half of
Stage 2 in `docs/superpowers/plans/2026-08-19-admin-content-management.md`.

---

## Why the current design cannot do this

`Hero.astro` resolves banners through `import.meta.glob('/src/assets/banners/*.jpg')`.
That is a **build-time** read of the repository working tree. A running
serverless function cannot write into `src/assets/`, so no amount of admin UI
makes an upload land where the hero can see it. The image files have to move
somewhere the running site can write and the build can read.

Current state, verified 2026-08-23: `src/data/hero-banners.json` is `[]`,
`src/assets/banners/` does not exist, and the hero renders its designed empty
band. The client's six posters were deleted on 2026-08-20 for being portrait
(1261:1561) against a 4:1 slot. **The client confirms they now have 4:1 artwork
ready**, so the slot keeps its specified shape and the admin enforces it.

## Decisions

### 1. Images live in Supabase Storage, in a PRIVATE bucket

Supabase is already the backend and already holds the credential the build uses.
Adding a second vendor for one bucket buys nothing.

**Private, not public**, and for the same reason `public.products` has RLS with
zero policies: *the site is published by the BUILD, not by the database.* A
public bucket would be a second route to the artwork that nobody maintains and
nothing gates. The build signs a short-lived URL per image with the service-role
key; the signed URLs are consumed during the build and never reach the output.

Bucket: `banners`. Object path: `<uuid>.<ext>` at the bucket root.

### 2. Optimised at build time, not served remotely at runtime

The hero passes each signed URL to Astro's `<Image>`, which downloads,
optimises and emits a local asset. Consequences, all of them wanted:

- **`img-src 'self'` is unchanged.** The shipped page references local files, so
  the CSP does not widen for the landing page.
- **The landing page keeps its image budget.** Serving originals from Supabase
  would ship full-size JPEGs to every visitor of the highest-traffic page.
- **Dimensions are known**, so the band cannot jump as images load.

The cost, accepted: **a banner is not live until the next build.** That is the
same rhythm as a catalogue edit, and the same Publish button.

`astro.config.mjs` gains the Supabase host in `image.domains`, read from
`SUPABASE_URL` at config time and omitted when it is unset.

### 3. `hero_banners` in Postgres replaces `hero-banners.json`

The JSON file is deleted. It holds `[]`, and `src/lib/site-content.ts` exists
precisely to make this swap a one-module change.

```sql
create table public.hero_banners (
  id         uuid primary key default gen_random_uuid(),
  path       text not null unique,        -- object path within the bucket
  name       text not null,               -- admin-only label; slides carry alt=""
  width      integer not null,
  height     integer not null,
  "order"    integer not null default 0,
  enabled    boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.hero_banners enable row level security;   -- zero policies
```

`width` and `height` are recorded at upload rather than re-derived at build
time: the build needs them for `<Image>`, and the admin needs them to show what
it accepted.

**With no Supabase configured, `getHeroBanners()` returns `[]`** and the hero
renders its existing empty band. There is no offline banner path, and inventing
one would mean two rendering routes in `Hero.astro` for a state nobody is in.

### 4. Dimensions are read from the file header, with no image library

A ~30-line reader for the JPEG `SOFn` marker and the PNG `IHDR` chunk, in
`src/lib/admin/image-size.ts`, unit-tested against byte fixtures.

`sharp` is installed and could do this, but it is a native binary and this would
be its first use **inside a request handler** rather than at build time. A
header read has no native dependency, no serverless bundling question, and is
testable in Vitest without a real image or a browser.

It must return null rather than guess on anything it does not recognise, and a
null is a rejected upload.

### 5. Validation, with exact numbers

| Check | Rule | Why |
|---|---|---|
| Type | `image/jpeg` or `image/png` only | What marketing artwork arrives as. Sniffed from the bytes, not trusted from the form. |
| Size | ≤ 8 MB | Ample for 2800×700; a cap the platform does not have to enforce for us. |
| Aspect | **3.8:1 to 4.2:1 inclusive** | The slot is 2800×700 = 4.0. ±5% tolerates a 2800×720 master and refuses anything that would letterbox visibly. |
| Width | **1400px to 6000px inclusive** | 1400 is half the slot's 2800 and the floor before upscaling shows, which `docs/CONTENT-EDITING.md` already forbids for product photos. |

`banner-too-large` covers **both** upper bounds — a file over 8 MB and an image
wider than 6000px — and its message states both, because an admin who hit one
has no way to tell which from the code alone.

A refusal names the requirement **and the dimensions it received** — see 6.

### 6. Notice codes stay a closed whitelist; two integers may travel beside them

`src/lib/admin/notices.ts` exists because a message in a query string lets a
stranger put words inside the admin chrome. That does not change.

But "your image is the wrong shape" is a poor message when the admin knows the
image was 1261×1561 and cannot say so. So the refusal carries `w` and `h`
alongside the code. They are read with `Number()`, dropped unless finite
integers between 1 and 20000, and rendered as numbers. **A number coerced from a
query parameter is not attacker text**, and the sentence around it still comes
from the whitelist.

New codes: `banner-uploaded`, `banner-saved`, `banner-deleted`,
`banner-invalid-type`, `banner-invalid-shape`, `banner-too-small`,
`banner-too-large`. `save-failed` and `save-unconfigured` are reused.

### 7. A new banner starts hidden

`enabled` defaults to false. Upload, check the thumbnail, set the order, then
switch it on. A half-finished banner cannot ride out on somebody else's Publish.

### 8. Hide and Delete are different actions

**Hide** clears `enabled`. It comes off the site at the next build and stays in
the admin for a later campaign.

**Delete** removes the row, then the object. **Row first**: if the object delete
fails afterwards the result is an orphaned file, which is harmless and logged.
The other order leaves a row pointing at a missing object, which fails the next
build — a destructive action making the *site* unbuildable is the worse failure.

### 9. Admin thumbnails come through an admin-only route

`/api/admin/banners/[id]/thumb` reads the object with the service key and
streams it back. The alternative is widening `img-src` site-wide so one admin
screen can show a picture, and the bucket is private anyway.

### 10. Storage is re-enabled in the local test stack

`supabase/config.toml` has `[storage] enabled = false` — the stack was trimmed
to four containers for a 7.7GB machine. Testing an upload path means turning it
back on. That file's own comment permits this: *"Re-enabling a service is fine
if something needs it."* Upload code that no test exercises is the worse trade.

---

## Surfaces

| Route | Purpose |
|---|---|
| `/admin/banners` | List, upload form, order and enable controls |
| `/api/admin/banners/upload` | `multipart/form-data` POST: validate, store, insert row |
| `/api/admin/banners/[id]` | POST: save name/order, hide/show, or delete |
| `/api/admin/banners/[id]/thumb` | GET: stream the object for the admin list |

All four are `export const prerender = false` and sit behind `src/middleware.ts`.
No inline scripts: ordering is a number input and a Save, exactly as the
catalogue edit form does it.

`AdminLayout`'s nav gains a Banners entry.

## What fails the build, deliberately

`Hero.astro` currently throws when an enabled banner is not in the assets
folder, on the stated grounds that *a banner that cannot be resolved must fail
the build rather than render a gap.* That rule is kept and re-pointed: an
enabled row whose object cannot be signed or fetched throws. The home page is
the one page where a silent hole is least acceptable.

## Testing

**Unit.** `imageSize()` against JPEG and PNG byte fixtures, truncated files,
and non-images. The validation rules as a pure function — every boundary in the
table above, both sides. The notice codes' integer passthrough, including that
`?w=<script>` yields no numbers.

**End-to-end**, authenticated, against the throwaway stack with storage on:
upload a generated 4:1 JPEG and see it listed; upload a portrait one and see it
refused with its own dimensions shown; hide, show, delete. Written the way
`tests/e2e/admin-catalogue.spec.ts` is, including asserting a forged POST was
actually accepted before concluding anything from it.

## Gates this moves

- **Four new server-rendered routes**: 19 → 23. `npm run counts`, plus the
  hand-maintained literal in `tools/counts.test.ts`.
- **A new migration**, and `supabase/config.toml` changes.
- `src/lib/site-content.test.ts` is rewritten: it currently asserts `banner.file`
  against `src/assets/banners/`, which stops existing.
- CSP: **unchanged**, and that is the point of decisions 2 and 9.

## Out of scope

- **Reordering by dragging.** Needs client JavaScript, which no admin page may
  have.
- **Cropping or resizing in the admin.** Refusing a wrong-shaped upload is this
  slice's answer; an editor is its own project.
- **Alt text per banner.** Slides carry `alt=""` deliberately — they are
  marketing posters whose baked-in text alt cannot reproduce, and every product
  on them is in the catalogue below. `name` stays admin-only. Revisit only if a
  banner ever carries information found nowhere else on the page.
- **Banners anywhere but the home hero.**
