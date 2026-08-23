# Hero Banners From /admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin uploads a hero banner, orders it, switches it on or off and deletes it, without a developer and without a commit.

**Architecture:** Images go to a private Supabase Storage bucket; `public.hero_banners` holds the metadata. `src/lib/admin/banners.ts` is the only writer, mirroring `src/lib/admin/catalogue.ts`. The build reads through `src/lib/site-content.ts`, signs a short-lived URL per enabled banner and hands it to Astro's `<Image>`, which emits a local optimised asset — so `img-src 'self'` never widens and a banner goes live at the next Publish.

**Tech Stack:** Astro 7.1.6, TypeScript strict, `@supabase/supabase-js` 2.112, Vitest, Playwright, Supabase CLI via `npx`, Docker.

**Spec:** `docs/superpowers/specs/2026-08-23-admin-hero-banners-design.md`

---

## Read first

- `docs/TRAPS.md`, and `CLAUDE.md` §"The admin area". Three rules bite: **no inline scripts on any `/admin` page**, **every admin route needs `export const prerender = false`**, and `SUPABASE_SERVICE_ROLE_KEY` must never appear under `src/components`, `src/scripts`, `src/stores` or `src/layouts`.
- `src/lib/admin/catalogue.ts` — this plan's module mirrors it deliberately. Read its header before writing a second one in a different shape.
- **Never weaken a gate to make it pass.**

## Environment facts, already verified on 2026-08-23

- Storage is reachable on the **live** project and has **no buckets yet**.
- `sharp` is installed, and is deliberately NOT used at request time — see Task 2.
- `src/data/hero-banners.json` is `[]`; `src/assets/banners/` does not exist; `Hero.astro` renders its designed empty band.
- `Hero.astro` is the ONLY consumer of `getHeroBanners()`. `src/lib/site-content.test.ts` asserts on `banner.file` and must be rewritten.
- Current gates: `npm run verify -- --full` = 17/17, 310 unit tests, 287 e2e, **19 server-rendered routes**.

## File structure

**Created**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260823120000_hero_banners.sql` | The table and its RLS |
| `tools/storage-setup.mjs` | Create the private `banners` bucket if absent. Idempotent, run against any project. |
| `src/lib/admin/image-size.ts` | Width and height from JPEG/PNG bytes. No dependencies. |
| `src/lib/admin/image-size.test.ts` | Byte-fixture tests |
| `src/lib/admin/banners.ts` | The only writer to `hero_banners` and the bucket |
| `src/lib/admin/banners.test.ts` | Validation and mapping |
| `src/pages/admin/banners.astro` | List, upload form, order/enable controls |
| `src/pages/api/admin/banners/upload.ts` | multipart POST |
| `src/pages/api/admin/banners/[id].ts` | Save / hide / show / delete |
| `src/pages/api/admin/banners/[id]/thumb.ts` | Stream the object for the admin list |
| `tests/e2e/admin-banners.spec.ts` | Authenticated upload, refusal, hide, delete |

**Modified:** `src/lib/site-content.ts` · `src/lib/site-content.test.ts` · `src/components/sections/Hero.astro` · `astro.config.mjs` · `src/lib/admin/notices.ts` · `src/layouts/AdminLayout.astro` · `supabase/config.toml` · `tools/test-db.mjs` · `tools/counts.test.ts` · `package.json` · `.github/workflows/verify.yml` · `BACKLOG.md` · `handoff.md` · `docs/TRAPS.md` · `CLAUDE.md`+`AGENTS.md`

**Deleted:** `src/data/hero-banners.json`

---

## Task 1: The table, the bucket and the local stack

**Files:**
- Create: `supabase/migrations/20260823120000_hero_banners.sql`, `tools/storage-setup.mjs`
- Modify: `supabase/config.toml`, `tools/test-db.mjs`, `package.json`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260823120000_hero_banners.sql`:

```sql
-- Hero banners, managed from /admin since 2026-08-23.
--
-- The IMAGE lives in Supabase Storage (private bucket `banners`); this table is
-- the metadata and the ordering. `path` is the object path within that bucket.
--
-- width/height are recorded at UPLOAD rather than derived at build time. The
-- build needs them for <Image> on a remote source, and the admin needs them to
-- show what it accepted. Deriving them twice is how the two disagree.
--
-- RLS enabled with zero policies, exactly like every other table here. The
-- banners are public information, but they are published by the BUILD, not by
-- the database.
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
  'Object path within the private `banners` storage bucket. Unique: one row per file.';

alter table public.hero_banners enable row level security;
```

- [ ] **Step 2: Turn storage back on in the local stack**

In `supabase/config.toml` set `enabled = true` under `[storage]`. Leave `[storage.s3_protocol]` and `[storage.vector]` disabled. Add to the "TRIMMED ON PURPOSE" comment at the top of the file:

```toml
# Storage was re-enabled on 2026-08-23: the hero banner upload path writes to a
# bucket, and upload code no test exercises is worse than one more container.
```

- [ ] **Step 3: Write the bucket setup tool**

`tools/storage-setup.mjs`:

```js
/**
 * Create the private `banners` bucket if it is not there.
 *
 * Idempotent, and pointed at whatever SUPABASE_URL holds — so the same command
 * prepares the live project and the throwaway stack. `tools/test-db.mjs` calls
 * `ensureBuckets` directly; a person runs `npm run storage:setup` once against
 * production.
 *
 * PRIVATE, and that is the decision the spec argues: a public bucket would be a
 * second route to the artwork that nobody maintains. The build signs a
 * short-lived URL with the service-role key instead.
 */
import { createClient } from '@supabase/supabase-js';

export const BANNER_BUCKET = 'banners';

export async function ensureBuckets(url, serviceKey) {
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await db.storage.listBuckets();
  if (error) throw new Error(`could not list buckets: ${error.message}`);

  if (data.some((bucket) => bucket.name === BANNER_BUCKET)) {
    console.log(`bucket "${BANNER_BUCKET}" already exists`);
    return;
  }

  const { error: createError } = await db.storage.createBucket(BANNER_BUCKET, {
    public: false,
    fileSizeLimit: '8MB',
    allowedMimeTypes: ['image/jpeg', 'image/png'],
  });
  if (createError) throw new Error(`could not create the bucket: ${createError.message}`);
  console.log(`bucket "${BANNER_BUCKET}" created, private`);
}

if (process.argv[2] === 'run') {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  await ensureBuckets(url, key);
}
```

- [ ] **Step 4: Call it from the test stack, and add the script**

In `tools/test-db.mjs`, import `ensureBuckets` and call it inside `start()` immediately after the admin is allow-listed and **before** `STACK_FILE` is written:

```js
await ensureBuckets(url, serviceKey);
```

In `package.json` scripts add:

```json
"storage:setup": "node --env-file=.env tools/storage-setup.mjs run",
```

- [ ] **Step 5: Verify against a real stack**

```bash
npm run test:db:start
```

Expected: the run reports the bucket created, then `Test database ready`. Run it a second time and it reports `already exists` — proving idempotence.

- [ ] **Step 6: Commit**

```bash
git add supabase tools/storage-setup.mjs tools/test-db.mjs package.json
git commit -m "feat(db): hero_banners, and a private bucket for the artwork"
```

---

## Task 2: Image dimensions from bytes

**Files:**
- Create: `src/lib/admin/image-size.ts`, `src/lib/admin/image-size.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/admin/image-size.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { imageSize } from './image-size';

/** A minimal PNG: signature, then an IHDR chunk carrying width and height. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/** A minimal JPEG: SOI, one skipped APP0, then an SOF0 carrying the size. */
function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0], 2);
  view.setUint16(4, 4); // APP0 length, payload of 2
  bytes.set([0xff, 0xc0], 8);
  view.setUint16(10, 17); // SOF0 length
  bytes[12] = 8; // precision
  view.setUint16(13, height);
  view.setUint16(15, width);
  return bytes;
}

describe('imageSize', () => {
  it('reads a PNG', () => {
    expect(imageSize(png(2800, 700))).toEqual({ width: 2800, height: 700, type: 'image/png' });
  });

  it('reads a JPEG, skipping the segments before SOF0', () => {
    expect(imageSize(jpeg(2800, 700))).toEqual({ width: 2800, height: 700, type: 'image/jpeg' });
  });

  it('reads the portrait poster shape that started all this', () => {
    expect(imageSize(jpeg(1261, 1561))?.height).toBe(1561);
  });

  /*
   * A null is a REFUSED UPLOAD, so every one of these must return null rather
   * than a plausible number. Guessing here would let an unreadable file through
   * with dimensions nothing checked.
   */
  it('returns null for anything it does not recognise', () => {
    expect(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
    expect(imageSize(new Uint8Array(0))).toBeNull();
    expect(imageSize(new Uint8Array([0xff, 0xd8]))).toBeNull(); // JPEG with no SOF
    expect(imageSize(png(10, 10).slice(0, 20))).toBeNull(); // truncated PNG
  });

  it('does not run off the end of a JPEG with a lying segment length', () => {
    const bytes = jpeg(100, 100);
    new DataView(bytes.buffer).setUint16(4, 60000); // APP0 claims to be huge
    expect(imageSize(bytes)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/lib/admin/image-size.test.ts
```

Expected: FAIL, `imageSize` is not exported.

- [ ] **Step 3: Implement**

`src/lib/admin/image-size.ts`:

```ts
/**
 * The width, height and type of a JPEG or PNG, read from its header.
 *
 * WHY NOT `sharp`, WHICH IS ALREADY INSTALLED. It is a native binary, and this
 * would be its first use inside a REQUEST HANDLER rather than at build time —
 * a bundling and cold-start question on a serverless platform, in exchange for
 * two numbers that live in the first two dozen bytes of the file. A header read
 * has no dependency, no binary, and is testable against byte fixtures with no
 * real image and no browser.
 *
 * IT RETURNS NULL RATHER THAN GUESSING. A null is a refused upload. The
 * alternative — a default, or a partial read — would let a file whose shape
 * nothing has established reach the hero band on the home page.
 */
export interface ImageSize {
  width: number;
  height: number;
  type: 'image/jpeg' | 'image/png';
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * SOF markers carry the dimensions. SOF4 (0xc4), SOF8 (0xc8) and SOF12 (0xcc)
 * are excluded on purpose: they are DHT, JPG and DAC, which share the range and
 * are not frame headers.
 */
const isStartOfFrame = (marker: number): boolean =>
  marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;

export function imageSize(bytes: Uint8Array): ImageSize | null {
  return pngSize(bytes) ?? jpegSize(bytes);
}

function pngSize(bytes: Uint8Array): ImageSize | null {
  // 8 signature + 4 length + 4 "IHDR" + 4 width + 4 height.
  if (bytes.length < 24) return null;
  if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20), type: 'image/png' };
}

function jpegSize(bytes: Uint8Array): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null; // Not on a marker boundary.
    const marker = bytes[offset + 1]!;

    if (isStartOfFrame(marker)) {
      return {
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
        type: 'image/jpeg',
      };
    }

    const length = view.getUint16(offset + 2);
    // A segment shorter than its own length field, or one that runs past the
    // end, means a malformed or truncated file — not a smaller image.
    if (length < 2) return null;
    offset += 2 + length;
  }

  return null;
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/lib/admin/image-size.test.ts
npx astro check
```

Expected: 5 tests pass, 0 typecheck errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/image-size.ts src/lib/admin/image-size.test.ts
git commit -m "feat(admin): image dimensions from the header, with no native dependency"
```

---

## Task 3: The upload rules

**Files:**
- Create: `src/lib/admin/banners.test.ts`
- Create: `src/lib/admin/banners.ts` (validation half only; the database half is Task 4)

- [ ] **Step 1: Write the failing tests**

`src/lib/admin/banners.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { acceptBannerUpload, BANNER_RULES } from './banners';

/** A JPEG header of the requested size — the same fixture shape as image-size.test.ts. */
function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0], 2);
  view.setUint16(4, 4);
  bytes.set([0xff, 0xc0], 8);
  view.setUint16(10, 17);
  bytes[12] = 8;
  view.setUint16(13, height);
  view.setUint16(15, width);
  return bytes;
}

describe('acceptBannerUpload', () => {
  it('accepts the slot shape', () => {
    const result = acceptBannerUpload(jpeg(2800, 700), 400_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.size).toEqual({ width: 2800, height: 700, type: 'image/jpeg' });
  });

  it('accepts a 2800x720 master, which is inside the tolerance', () => {
    expect(acceptBannerUpload(jpeg(2800, 720), 400_000).ok).toBe(true);
  });

  /*
   * The shape that started this: the client's six posters were 1261x1561 and
   * were deleted rather than squeezed into a 4:1 band.
   */
  it('refuses a portrait poster and says what it got', () => {
    const result = acceptBannerUpload(jpeg(1261, 1561), 400_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('banner-invalid-shape');
    expect(result.size).toEqual({ width: 1261, height: 1561, type: 'image/jpeg' });
  });

  it('refuses an image too small to render sharply', () => {
    const result = acceptBannerUpload(jpeg(800, 200), 400_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('banner-too-small');
  });

  it('refuses a file over the size cap, and an image over the width cap', () => {
    expect(acceptBannerUpload(jpeg(2800, 700), BANNER_RULES.maxBytes + 1)).toMatchObject({
      ok: false,
      code: 'banner-too-large',
    });
    expect(acceptBannerUpload(jpeg(8000, 2000), 400_000)).toMatchObject({
      ok: false,
      code: 'banner-too-large',
    });
  });

  it('refuses anything that is not a JPEG or a PNG', () => {
    expect(acceptBannerUpload(new Uint8Array([0x47, 0x49, 0x46, 0x38]), 100)).toMatchObject({
      ok: false,
      code: 'banner-invalid-type',
    });
  });

  /* Both boundaries of the ratio window, on both sides. */
  it('holds the ratio window exactly', () => {
    expect(acceptBannerUpload(jpeg(3800, 1000), 400_000).ok).toBe(true); // 3.8
    expect(acceptBannerUpload(jpeg(4200, 1000), 400_000).ok).toBe(true); // 4.2
    expect(acceptBannerUpload(jpeg(3799, 1000), 400_000).ok).toBe(false);
    expect(acceptBannerUpload(jpeg(4201, 1000), 400_000).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run src/lib/admin/banners.test.ts
```

Expected: FAIL, module not found.

- [ ] **Step 3: Implement the validation half**

Create `src/lib/admin/banners.ts` with the header, `BANNER_RULES` and `acceptBannerUpload`. Exact code:

```ts
/**
 * Every admin read and write of HERO BANNERS — the rows and the image files.
 *
 * The admin's third seam, after src/lib/admin/enquiries.ts and
 * src/lib/admin/catalogue.ts. It mirrors them on purpose: same `AdminResult`
 * states, same lazy client behind a `configured()` guard, same rule that a read
 * which could not look never returns an empty array to say so. Read
 * catalogue.ts's header rather than have those reasons restated badly here.
 *
 * It owns BOTH halves of a banner — the row in `public.hero_banners` and the
 * object in the private `banners` bucket — because they are one thing to
 * everybody upstream and keeping them together is what makes "delete the row
 * before the object" a decision in one file rather than a convention.
 */
import { imageSize, type ImageSize } from './image-size';
import { env, configured } from '../env';
import type { AdminResult } from './enquiries';
import type { NoticeCode } from './notices';

/**
 * The slot is 2800x700. Every number here is in the spec with its reasoning;
 * they live in one exported object so the admin form can state the same limits
 * the validator enforces, rather than a prose copy that drifts.
 */
export const BANNER_RULES = {
  minRatio: 3.8,
  maxRatio: 4.2,
  minWidth: 1400,
  maxWidth: 6000,
  maxBytes: 8 * 1024 * 1024,
} as const;

export type BannerUploadResult =
  | { readonly ok: true; readonly size: ImageSize }
  | { readonly ok: false; readonly code: NoticeCode; readonly size: ImageSize | null };

/**
 * Whether these bytes may become a banner.
 *
 * THE TYPE IS SNIFFED FROM THE BYTES, never taken from the form's Content-Type,
 * which is whatever the client chose to send. `imageSize` returning null IS the
 * type check: it recognises exactly the two formats this accepts.
 *
 * The rejected size is returned alongside the code so the admin can show the
 * dimensions it actually got. See src/lib/admin/notices.ts for why that travels
 * as two integers rather than as a message.
 */
export function acceptBannerUpload(bytes: Uint8Array, byteLength: number): BannerUploadResult {
  const size = imageSize(bytes);
  if (size === null) return { ok: false, code: 'banner-invalid-type', size: null };

  if (byteLength > BANNER_RULES.maxBytes || size.width > BANNER_RULES.maxWidth) {
    return { ok: false, code: 'banner-too-large', size };
  }

  const ratio = size.width / size.height;
  if (ratio < BANNER_RULES.minRatio || ratio > BANNER_RULES.maxRatio) {
    return { ok: false, code: 'banner-invalid-shape', size };
  }

  // Checked after the ratio so a portrait poster is told it is the wrong SHAPE,
  // which is the useful answer, rather than that it is too narrow.
  if (size.width < BANNER_RULES.minWidth) {
    return { ok: false, code: 'banner-too-small', size };
  }

  return { ok: true, size };
}
```

- [ ] **Step 4: Run the tests**

```bash
npx vitest run src/lib/admin/banners.test.ts
```

Expected: FAIL — `NoticeCode` does not yet include the banner codes. That is Task 5; add the codes now if the typecheck blocks you, or run Task 5 first. Either order works; the tests must pass before Task 4 begins.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/banners.ts src/lib/admin/banners.test.ts
git commit -m "feat(admin): the banner upload rules, and the numbers behind them"
```

---

## Task 4: Notice codes, and the two integers

**Files:**
- Modify: `src/lib/admin/notices.ts`, `src/lib/admin/notices.test.ts`

- [ ] **Step 1: Add the codes**

In `ADMIN_NOTICES`:

```ts
  'banner-uploaded': {
    text: 'Banner uploaded. It is hidden until you switch it on, and appears on the site at the next build.',
    tone: 'success',
  },
  'banner-saved': {
    text: 'Banner updated. The change appears on the site at the next build.',
    tone: 'success',
  },
  'banner-deleted': { text: 'Banner deleted, and its image file with it.', tone: 'success' },
  'banner-invalid-type': {
    text: 'That file was not a JPEG or a PNG, so nothing was uploaded.',
    tone: 'error',
  },
  'banner-invalid-shape': {
    text: 'The hero band is a wide strip, so a banner has to be roughly four times as wide as it is tall — 2800 × 700 is the size to aim for. Nothing was uploaded.',
    tone: 'error',
  },
  'banner-too-small': {
    text: 'That image is too small to stay sharp across the hero band. It needs to be at least 1400 pixels wide, and 2800 is better. Nothing was uploaded.',
    tone: 'error',
  },
  'banner-too-large': {
    text: 'That image is over the limit — 8 MB, and 6000 pixels wide. Nothing was uploaded.',
    tone: 'error',
  },
```

- [ ] **Step 2: Add the integer passthrough**

Append to `src/lib/admin/notices.ts`:

```ts
/**
 * The dimensions a rejected upload actually had, if the URL carries them.
 *
 * THE WHITELIST IS NOT BEING WIDENED. Every word an admin reads still comes
 * from `ADMIN_NOTICES`; this returns two NUMBERS to sit beside that sentence.
 * "The shape is wrong" is a poor message when the admin knows the file was
 * 1261 × 1561 and cannot say so.
 *
 * A number coerced out of a query parameter is not attacker text: anything that
 * is not a finite integer in a sane range becomes null and renders nothing.
 * `Number('<script>')` is NaN, and NaN fails every check below.
 */
export function dimensionsFrom(
  width: string | null,
  height: string | null,
): { width: number; height: number } | null {
  const w = Number(width);
  const h = Number(height);
  const sane = (n: number) => Number.isInteger(n) && n >= 1 && n <= 20000;
  return sane(w) && sane(h) ? { width: w, height: h } : null;
}
```

- [ ] **Step 3: Test it**

Append to `src/lib/admin/notices.test.ts`:

```ts
describe('dimensionsFrom', () => {
  it('passes a real pair through', () => {
    expect(dimensionsFrom('1261', '1561')).toEqual({ width: 1261, height: 1561 });
  });

  /* The whole reason this is numbers and not text. */
  it('yields nothing for anything that is not a plain integer', () => {
    for (const bad of ['<script>alert(1)</script>', '1e9', '12.5', '-4', '0', '99999', '', null]) {
      expect(dimensionsFrom(bad, '700')).toBeNull();
      expect(dimensionsFrom('2800', bad)).toBeNull();
    }
  });
});
```

Add `dimensionsFrom` to the file's import.

- [ ] **Step 4: Run and commit**

```bash
npx vitest run src/lib/admin/notices.test.ts src/lib/admin/banners.test.ts
git add src/lib/admin/notices.ts src/lib/admin/notices.test.ts
git commit -m "feat(admin): banner notices, and two integers beside the whitelist"
```

---

## Task 5: The repository module

**Files:**
- Modify: `src/lib/admin/banners.ts`

- [ ] **Step 1: Append the types and the client**

```ts
export type { AdminResult };

const URL_KEY = 'SUPABASE_URL';
const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY';
export const BANNER_BUCKET = 'banners';

const ok = <T>(data: T): AdminResult<T> => ({ state: 'ok', data });
const UNCONFIGURED = { state: 'unconfigured' } as const;
const FAILED = { state: 'failed' } as const;

export interface BannerRow {
  id: string;
  path: string;
  name: string;
  width: number;
  height: number;
  order: number;
  enabled: boolean;
  created_at: string;
}

const ready = (): boolean => configured(URL_KEY, SERVICE_KEY);

async function client() {
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(env(URL_KEY), env(SERVICE_KEY), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 2: Append the reads and writes**

```ts
/** Every banner, hidden ones included: this is the editor's list. */
export async function listBanners(): Promise<AdminResult<BannerRow[]>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { data, error, count } = await supabase
      .from('hero_banners')
      .select('*', { count: 'exact' })
      .order('order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as BannerRow[];
    // The same refusal catalogue.ts makes: a silently short list is a screen
    // that says a banner does not exist.
    if (count !== null && rows.length < count) throw new Error('banner read was truncated');
    return ok(rows);
  } catch (cause) {
    console.error('[admin] listBanners failed', cause);
    return FAILED;
  }
}

/** Stores the file, then the row. The row is what the site reads, so it goes last. */
export async function createBanner(
  actor: string,
  name: string,
  bytes: Uint8Array,
  size: ImageSize,
): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;
  const path = `${crypto.randomUUID()}.${size.type === 'image/png' ? 'png' : 'jpg'}`;
  try {
    const supabase = await client();
    const { error: uploadError } = await supabase.storage
      .from(BANNER_BUCKET)
      .upload(path, bytes, { contentType: size.type, upsert: false });
    if (uploadError) throw new Error(uploadError.message);

    const { error } = await supabase.from('hero_banners').insert({
      path,
      name,
      width: size.width,
      height: size.height,
      enabled: false,
    });
    if (error) {
      // The file is up and nothing points at it. Take it back out rather than
      // leave an orphan nobody can see or reach.
      await supabase.storage.from(BANNER_BUCKET).remove([path]);
      throw new Error(error.message);
    }

    await audit(supabase, actor, 'create', path, { name, ...size });
    return ok(null);
  } catch (cause) {
    console.error('[admin] createBanner failed', cause);
    return FAILED;
  }
}

/** Name, order and visibility. The image itself is never edited. */
export async function updateBanner(
  actor: string,
  id: string,
  patch: { name?: string; order?: number; enabled?: boolean },
): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { error } = await supabase.from('hero_banners').update(patch).eq('id', id);
    if (error) throw new Error(error.message);
    await audit(supabase, actor, 'update', id, patch);
    return ok(null);
  } catch (cause) {
    console.error('[admin] updateBanner failed', cause);
    return FAILED;
  }
}

/**
 * ROW FIRST, THEN THE OBJECT, and the order is the whole decision.
 *
 * Delete the object first and a failure afterwards leaves a row pointing at a
 * file that is gone — and an ENABLED row like that fails the next build, so a
 * destructive click would have made the site unbuildable. This way the failure
 * mode is an orphaned file: invisible, harmless, and logged.
 */
export async function deleteBanner(actor: string, id: string): Promise<AdminResult<null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { data: row, error: readError } = await supabase
      .from('hero_banners')
      .select('path')
      .eq('id', id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) return ok(null); // Already gone. Not a failure.

    const { error } = await supabase.from('hero_banners').delete().eq('id', id);
    if (error) throw new Error(error.message);

    const { error: removeError } = await supabase.storage
      .from(BANNER_BUCKET)
      .remove([(row as { path: string }).path]);
    if (removeError) {
      console.error(
        `[admin] banner row ${id} deleted but its file ${(row as { path: string }).path} remains`,
        removeError.message,
      );
    }

    await audit(supabase, actor, 'delete', id, null);
    return ok(null);
  } catch (cause) {
    console.error('[admin] deleteBanner failed', cause);
    return FAILED;
  }
}

/** The bytes of one banner, for the admin's own thumbnail route. */
export async function readBannerFile(
  id: string,
): Promise<AdminResult<{ bytes: ArrayBuffer; type: string } | null>> {
  if (!ready()) return UNCONFIGURED;
  try {
    const supabase = await client();
    const { data: row, error } = await supabase
      .from('hero_banners')
      .select('path')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return ok(null);

    const path = (row as { path: string }).path;
    const { data, error: fileError } = await supabase.storage.from(BANNER_BUCKET).download(path);
    if (fileError || !data) throw new Error(fileError?.message ?? 'no file');
    return ok({
      bytes: await data.arrayBuffer(),
      type: path.endsWith('.png') ? 'image/png' : 'image/jpeg',
    });
  } catch (cause) {
    console.error('[admin] readBannerFile failed', cause);
    return FAILED;
  }
}

/** Reuses catalogue_audit: `entity` gains 'banner' in the migration. */
async function audit(
  supabase: Awaited<ReturnType<typeof client>>,
  actor: string,
  action: 'create' | 'update' | 'delete',
  entityId: string,
  after: unknown,
): Promise<void> {
  const { error } = await supabase
    .from('catalogue_audit')
    .insert({ actor, entity: 'banner', entity_id: entityId, action, before: null, after });
  if (error) console.error('[admin] banner change was NOT audited', error.message);
}
```

- [ ] **Step 2b: Widen the audit check constraint**

`catalogue_audit.entity` is `check (entity in ('division','category','product'))`. Add to the Task 1 migration:

```sql
alter table public.catalogue_audit drop constraint if exists catalogue_audit_entity_check;
alter table public.catalogue_audit add constraint catalogue_audit_entity_check
  check (entity in ('division', 'category', 'product', 'banner'));
```

- [ ] **Step 3: Verify and commit**

```bash
npx astro check
npx vitest run
git add src/lib/admin/banners.ts supabase/migrations
git commit -m "feat(admin): the banner repository, rows and files in one module"
```

---

## Task 6: The public read path

**Files:**
- Modify: `src/lib/site-content.ts`, `src/lib/site-content.test.ts`
- Delete: `src/data/hero-banners.json`

- [ ] **Step 1: Replace `HeroBanner` and `getHeroBanners`**

```ts
export interface HeroBanner {
  id: string;
  /** A short-lived signed URL. Consumed by the build; never in the output. */
  url: string;
  /** Shown in the admin only. Slides carry alt="" — see Hero.astro. */
  name: string;
  width: number;
  height: number;
  order: number;
}

/**
 * The banners the hero should show, in the order it should show them.
 *
 * Reads Postgres and signs one URL per enabled banner. The bucket is PRIVATE,
 * so this is the only way the artwork is reachable — and the signed URLs are
 * spent during the build, because <Image> downloads and re-emits each one as a
 * local asset. Nothing time-limited reaches a visitor.
 *
 * UNCONFIGURED RETURNS AN EMPTY LIST, and the hero renders its designed empty
 * band. There is no offline banner path: the files live in storage, and
 * inventing a second source would mean two rendering routes in Hero.astro for a
 * state nobody is in.
 */
export async function getHeroBanners(): Promise<HeroBanner[]> {
  if (!configured('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY')) return [];

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('hero_banners')
    .select('id, path, name, width, height, order')
    .eq('enabled', true)
    .order('order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(`hero banners could not be read: ${error.message}`);

  const rows = (data ?? []) as Array<Omit<HeroBanner, 'url'> & { path: string }>;

  return Promise.all(
    rows.map(async (row) => {
      const { data: signed, error: signError } = await supabase.storage
        .from('banners')
        .createSignedUrl(row.path, 3600);
      // Loud, for the reason Hero.astro already gives: a banner that cannot be
      // resolved must fail the build rather than render a gap on the home page.
      if (signError || !signed) {
        throw new Error(`hero banner "${row.path}" is enabled but its file could not be read`);
      }
      return { ...row, url: signed.signedUrl };
    }),
  );
}
```

Add `import { env, configured } from './env';` and delete the `bannersJson` import.

- [ ] **Step 2: Delete the JSON and rewrite its tests**

```bash
git rm src/data/hero-banners.json
```

In `src/lib/site-content.test.ts`, delete every `getHeroBanners` test that asserts on `banner.file` or on `src/assets/banners/`. Replace with one that pins the unconfigured contract:

```ts
describe('getHeroBanners', () => {
  /*
   * Vitest runs with no Supabase credentials, which is the state this asserts:
   * no banners, and specifically NOT an error. The hero's empty band is a
   * designed state, and a build with no database must still produce a home page.
   */
  it('returns nothing when there is no database, rather than throwing', async () => {
    expect(await getHeroBanners()).toEqual([]);
  });
});
```

Leave every `heroClock` test untouched — that arithmetic is unchanged.

- [ ] **Step 3: Verify and commit**

```bash
npx vitest run src/lib/site-content.test.ts
git add -A
git commit -m "feat(site): hero banners come from Postgres and storage"
```

---

## Task 7: The hero renders a remote image

**Files:**
- Modify: `src/components/sections/Hero.astro`, `astro.config.mjs`

- [ ] **Step 1: Allow the Supabase host**

In `astro.config.mjs`, inside `defineConfig({...})`:

```js
  /*
   * The hero's banners are fetched from Supabase Storage at BUILD time and
   * re-emitted as local assets, so this list is what lets the build download
   * them — it does not widen anything a visitor's browser reaches. Derived from
   * SUPABASE_URL so it follows the project, and empty when that is unset, which
   * is the state where there are no banners to fetch anyway.
   */
  image: {
    domains: process.env.SUPABASE_URL ? [new URL(process.env.SUPABASE_URL).hostname] : [],
  },
```

- [ ] **Step 2: Replace the glob**

In `Hero.astro`, delete the `bannerImages` glob and the `BANNERS` resolution block, and replace with:

```ts
const BANNERS = await getHeroBanners();
```

Delete the now-unused `import type { ImageMetadata } from 'astro'`. Add `import { Image } from 'astro:assets';`.

Replace the slide `<img>`/`<Image>` usage with:

```astro
<Image
  src={banner.url}
  width={banner.width}
  height={banner.height}
  alt=""
  loading={index === 0 ? 'eager' : 'lazy'}
  class="hero__slide-img"
/>
```

Keep every existing class name, the clock, the pips and the empty-state branch exactly as they are.

- [ ] **Step 3: Verify**

```bash
npx astro check
npm run build
```

Expected: 0 errors, build clean. With no banners enabled the hero still renders its empty band.

- [ ] **Step 4: Commit**

```bash
git add src/components/sections/Hero.astro astro.config.mjs
git commit -m "feat(hero): render banners from storage, optimised at build time"
```

---

## Task 8: The admin screen and its routes

**Files:**
- Create: `src/pages/admin/banners.astro`, `src/pages/api/admin/banners/upload.ts`, `src/pages/api/admin/banners/[id].ts`, `src/pages/api/admin/banners/[id]/thumb.ts`
- Modify: `src/layouts/AdminLayout.astro`

- [ ] **Step 1: The nav entry**

In `AdminLayout.astro`'s `NAV`, after Catalogue:

```ts
  { href: '/admin/banners', label: 'Banners', owns: (p: string) => p.startsWith('/admin/banners') },
```

- [ ] **Step 2: The thumbnail route**

`src/pages/api/admin/banners/[id]/thumb.ts`:

```ts
/**
 * The image bytes for one banner, served from this origin.
 *
 * WHY A PROXY AND NOT THE STORAGE URL. `img-src 'self'` covers the whole site,
 * and widening it to a second origin so that one admin screen can show a
 * picture is a poor trade — the bucket is private in any case. This route sits
 * behind the same middleware guard as every other /api/admin path.
 */
import type { APIRoute } from 'astro';
import { readBannerFile } from '../../../../../lib/admin/banners';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const result = await readBannerFile(params.id ?? '');
  if (result.state !== 'ok') return new Response(null, { status: 503 });
  if (result.data === null) return new Response(null, { status: 404 });

  return new Response(result.data.bytes, {
    headers: {
      'content-type': result.data.type,
      // Private, because it is: an admin's session is what authorised it.
      'cache-control': 'private, max-age=300',
    },
  });
};
```

- [ ] **Step 3: The upload route**

`src/pages/api/admin/banners/upload.ts`:

```ts
import type { APIRoute } from 'astro';
import { acceptBannerUpload, createBanner } from '../../../../lib/admin/banners';
import type { NoticeCode } from '../../../../lib/admin/notices';

export const prerender = false;

const LIST = '/admin/banners';
const to = (notice: NoticeCode, extra = ''): string => `${LIST}?notice=${notice}${extra}`;

export const POST: APIRoute = async ({ request, redirect, locals }) => {
  const form = await request.formData();
  const file = form.get('file');
  const name = (form.get('name')?.toString() ?? '').trim();

  if (!(file instanceof File) || file.size === 0) {
    return redirect(to('banner-invalid-type'), 302);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const accepted = acceptBannerUpload(bytes, file.size);
  if (!accepted.ok) {
    /* The dimensions ride along as two integers so the message can name what it
       got. See dimensionsFrom in src/lib/admin/notices.ts. */
    const extra = accepted.size ? `&w=${accepted.size.width}&h=${accepted.size.height}` : '';
    return redirect(to(accepted.code, extra), 302);
  }

  const result = await createBanner(
    locals.admin?.email ?? 'unknown',
    name || file.name,
    bytes,
    accepted.size,
  );
  if (result.state === 'unconfigured') return redirect(to('save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to('save-failed'), 302);

  return redirect(to('banner-uploaded'), 302);
};
```

- [ ] **Step 4: The update/delete route**

`src/pages/api/admin/banners/[id].ts`:

```ts
import type { APIRoute } from 'astro';
import { updateBanner, deleteBanner } from '../../../../lib/admin/banners';
import type { NoticeCode } from '../../../../lib/admin/notices';

export const prerender = false;

const LIST = '/admin/banners';
const to = (notice: NoticeCode): string => `${LIST}?notice=${notice}`;

export const POST: APIRoute = async ({ params, request, redirect, locals }) => {
  const id = params.id ?? '';
  const form = await request.formData();
  const actor = locals.admin?.email ?? 'unknown';
  const intent = form.get('intent')?.toString() ?? 'save';

  if (!id) return redirect(to('bad-request'), 302);

  const result =
    intent === 'delete'
      ? await deleteBanner(actor, id)
      : await updateBanner(actor, id, {
          name: (form.get('name')?.toString() ?? '').trim() || undefined,
          order: Number.isInteger(Number(form.get('order'))) ? Number(form.get('order')) : undefined,
          enabled: intent === 'show' ? true : intent === 'hide' ? false : undefined,
        });

  if (result.state === 'unconfigured') return redirect(to('save-unconfigured'), 302);
  if (result.state === 'failed') return redirect(to('save-failed'), 302);
  return redirect(to(intent === 'delete' ? 'banner-deleted' : 'banner-saved'), 302);
};
```

- [ ] **Step 5: The page**

`src/pages/admin/banners.astro` — server-rendered, `export const prerender = false`, `Astro.locals.admin!`, `listBanners()`, `noticeFor` plus `dimensionsFrom(params.get('w'), params.get('h'))` rendered after the notice when present. It contains:

- an upload `<form method="post" action="/api/admin/banners/upload" enctype="multipart/form-data">` with `<input type="file" name="file" accept="image/jpeg,image/png" required>`, a `name` text field, and a submit;
- a hint stating the limits from `BANNER_RULES` — read them from the object, do not retype the numbers;
- for each banner a row with `<img src={`/api/admin/banners/${b.id}/thumb`} alt="" width="160">`, its dimensions, a `name` input, an `order` number input, Save, Hide or Show, and Delete — each a separate `<form method="post" action={`/api/admin/banners/${b.id}`}>` with a `name="intent"` submit button;
- `<DataState state={result.state} subject="banners" />` when the read is not ok, and an honest empty state when it is ok and empty.

No inline scripts. Match the class vocabulary in `src/styles/admin.css` (`ad-card`, `ad-fields`, `ad-field`, `ad-label`, `ad-input`, `ad-hint`, `ad-btn`, `ad-btn-ghost`, `ad-actions`, `ad-panel`, `ad-table`, `ad-muted`).

- [ ] **Step 6: Verify and commit**

```bash
npx astro check
git add src/pages/admin/banners.astro src/pages/api/admin/banners src/layouts/AdminLayout.astro
git commit -m "feat(admin): upload, order and remove hero banners"
```

---

## Task 9: Authenticated end-to-end tests

**Files:**
- Create: `tests/e2e/admin-banners.spec.ts`
- Modify: `tests/e2e/admin.spec.ts`

- [ ] **Step 1: Write the spec**

Model it on `tests/e2e/admin-catalogue.spec.ts` exactly: import `TEST_DB_UP` from `./stack` and throw without it, sign in per test, `test.describe.configure({ mode: 'serial' })`, desktop only.

Generate the fixtures in the test rather than committing binaries — the same JPEG header builder the unit tests use, at 2800×700 and at 1261×1561, uploaded with `setInputFiles({ name, mimeType: 'image/jpeg', buffer })`.

Cover: upload a 4:1 file and see it listed; upload the portrait one and see the refusal **with 1261 and 1561 rendered**; Show then Hide; Delete and see it gone.

- [ ] **Step 2: Add the new paths to the boundary spec**

In `tests/e2e/admin.spec.ts`, add `/admin/banners` to `PAGES`.

- [ ] **Step 3: Run**

```bash
npm run test:db:start
npx playwright test tests/e2e/admin-banners.spec.ts --reporter=line
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e
git commit -m "test(admin): prove a banner can be uploaded, refused, hidden and deleted"
```

---

## Task 10: Gates, CI and the record

**Files:**
- Modify: `.github/workflows/verify.yml`, `tools/counts.test.ts`, `CLAUDE.md`, `AGENTS.md`, `BACKLOG.md`, `handoff.md`, `docs/TRAPS.md`

- [ ] **Step 1: The route count**

`tools/counts.test.ts` pins 19. It becomes **23**: `/admin/banners`, `/api/admin/banners/upload`, `/api/admin/banners/[id]`, `/api/admin/banners/[id]/thumb`. Update the literal and name the four in the comment above it.

- [ ] **Step 2: CI creates the bucket**

`npm run test:db:start` already calls `ensureBuckets`, so the existing CI step covers it. Confirm the workflow still passes with storage enabled and raise `timeout-minutes` if the extra container pushes it.

- [ ] **Step 3: Document**

- `CLAUDE.md` §"The admin area": a paragraph on banners — private bucket, build-time optimisation, `img-src` deliberately unchanged, and that a banner is live at the next Publish. Copy to `AGENTS.md`.
- `docs/TRAPS.md`, under "Fails silently": **a public bucket is a second publishing channel**, and **`image.domains` is a build-time allowlist, not a CSP** — widening it does not let a browser fetch anything, and confusing the two leads to widening the wrong one.
- `handoff.md` §26: the decisions, and what the plan got wrong if anything did.
- `BACKLOG.md`: close "Decide what a phone does with a 4:1 banner" if this settles it, or restate it against real artwork.

- [ ] **Step 4: The full gate**

```bash
npm run test:db:start
npm run build
npm run counts
cp CLAUDE.md AGENTS.md
npm run verify -- --full
npm run test:db:stop
```

Expected: 17/17.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: gates and documentation for admin-managed banners"
```

---

## Self-review

**Spec coverage.** Private bucket → 1. Build-time optimisation → 7. `hero_banners` replaces the JSON → 1, 6. Header-read dimensions → 2. Validation numbers → 3. Closed whitelist plus two integers → 4. New banners start hidden → 5 (`enabled: false` on insert). Hide vs Delete → 5, 8. Proxy thumbnails → 8. Storage re-enabled locally → 1. Fails the build when a file is missing → 6. Testing → 2, 3, 4, 9. Gates → 10.

**Known soft spots, flagged rather than hidden.**

- **Task 5's audit reuses `catalogue_audit`** and therefore needs its check constraint widened; that SQL is in Task 5 Step 2b but belongs in Task 1's migration file. Apply it there.
- **Task 3 Step 4 fails until Task 4 adds the notice codes.** The dependency is stated; do Task 4 first if the typecheck blocks.
- **`crypto.randomUUID()`** is global on Node 22+, which `package.json` already requires. No import.
- **Astro's `<Image>` with a remote source requires `width` and `height`** — they come from the row, which is why they are columns rather than derived.
- **The signed URL lives one hour.** A build slower than that would fail on the last banner; at 94 products the build is well under a minute, and the failure would be loud rather than silent.
- **`site-content.ts` will hold the service-role key path**, which is allowed under `src/lib` and is what `npm run verify`'s gate checks for — it bans the name under `src/components`, `src/scripts`, `src/stores` and `src/layouts` only. `Hero.astro` is a component and must NOT gain a Supabase import; it calls `getHeroBanners()` and nothing else.
