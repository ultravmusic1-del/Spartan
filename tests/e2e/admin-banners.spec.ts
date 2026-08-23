/**
 * Uploading, showing, hiding and deleting a hero banner, signed in.
 *
 * REAL JPEGs, not the byte fixtures the unit tests use. `src/lib/admin/image-size.ts`
 * is tested against hand-built headers because a header is its whole input —
 * but this path stores a file, streams it back through the thumbnail route and
 * hands it to Astro at build time, and a header with no image data would sail
 * through all three and fail at the one place no test is watching. `sharp` is
 * already a dependency, so a genuine encoded image costs nothing here.
 *
 * Runs against the throwaway stack, whose bucket `npm run test:db:start`
 * creates. It must never be pointed at the live project: these tests write
 * files into storage and delete them again. See tests/e2e/stack.ts.
 */
import sharp from 'sharp';
import { expect, test } from '@playwright/test';
import { TEST_DB_UP } from './stack';

if (!TEST_DB_UP) {
  throw new Error(
    'The authenticated admin tests need the local test database. Run `npm run test:db:start` ' +
      'first. They must not run against the live project.',
  );
}

const ADMIN = { email: 'test-admin@spartan.local', password: 'test-admin-password-1' };

/* Serial: these share one bucket and one table, and each asserts on a list. */
test.describe.configure({ mode: 'serial' });

/** A real JPEG of the given size, solid colour, small enough to be quick. */
async function jpegOf(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 200, g: 40, b: 30 } },
  })
    .jpeg({ quality: 40 })
    .toBuffer();
}

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
}

/**
 * The list row for a banner, found by the value of its name field.
 *
 * NOT `hasText`. A banner's name lives in an `<input value="...">`, and an
 * input's value is not text content — `hasText` matches nothing and the row
 * looks absent while the screen is showing it correctly. Cost an hour once.
 */
const row = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.bn').filter({ has: page.locator(`input[name="name"][value="${name}"]`) });

/** Upload one file through the real form and wait for the redirect to land. */
async function upload(
  page: import('@playwright/test').Page,
  bytes: Buffer,
  name: string,
): Promise<void> {
  await page.goto('/admin/banners');

  // Scoped to the upload form: every list row carries a Name field too, so an
  // unscoped getByLabel matches several the moment one banner exists.
  const form = page.locator('form[action="/api/admin/banners/upload"]');
  await form.getByLabel('Image file').setInputFiles({
    name: `${name}.jpg`,
    mimeType: 'image/jpeg',
    buffer: bytes,
  });
  await form.getByLabel('Name', { exact: true }).fill(name);
  await form.getByRole('button', { name: 'Upload', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/banners\?notice=/);
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('a 4:1 banner uploads, and arrives hidden', async ({ page }) => {
  await upload(page, await jpegOf(2800, 700), 'spring-campaign');

  await expect(page.getByRole('status')).toContainText('Banner uploaded');
  const banner = row(page, 'spring-campaign');
  await expect(banner).toHaveCount(1);
  await expect(banner).toContainText('2800 × 700');
  /* The decision that a fresh banner cannot ride out on someone else's Publish. */
  await expect(banner).toContainText('Hidden');
});

test('the thumbnail is served from this origin and is a real image', async ({ page }) => {
  await page.goto('/admin/banners');
  const thumb = page.locator('.bn__shot').first();
  const src = await thumb.getAttribute('src');
  expect(src).toMatch(/^\/api\/admin\/banners\/[0-9a-f-]+\/thumb$/);

  // naturalWidth is 0 for a broken image, so this is what distinguishes a
  // route that returned bytes from one that returned a 404 the page ignored.
  await expect
    .poll(async () => thumb.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
});

test('a portrait poster is refused, and told its own dimensions', async ({ page }) => {
  /* 1261x1561 is the exact shape of the six posters deleted on 2026-08-20. */
  await upload(page, await jpegOf(1261, 1561), 'portrait-poster');

  const alert = page.getByRole('alert');
  await expect(alert.first()).toContainText('four times as wide');
  await expect(page.locator('.ad-alert')).toContainText('1261 × 1561');

  // Refused means nothing was stored, not merely that a message appeared.
  await expect(row(page, 'portrait-poster')).toHaveCount(0);
});

test('show puts a banner on the site, and hide takes it off again', async ({ page }) => {
  await page.goto('/admin/banners');
  const banner = row(page, 'spring-campaign');

  await banner.getByRole('button', { name: 'Show' }).click();
  await expect(page.getByRole('status')).toContainText('Banner updated');
  await expect(row(page, 'spring-campaign')).toContainText('Showing on the site');

  await row(page, 'spring-campaign').getByRole('button', { name: 'Hide' }).click();
  await expect(row(page, 'spring-campaign')).toContainText('Hidden');
});

/*
 * Show and Hide post no name and no order. Under a naive endpoint that reads an
 * absent field as blank, pressing Show would wipe the name — which is the trap
 * src/lib/admin/catalogue.ts names, here in its second home.
 */
test('showing a banner does not wipe its name or its order', async ({ page }) => {
  await page.goto('/admin/banners');
  const banner = () => row(page, 'spring-campaign');

  await banner().getByLabel('Order').fill('7');
  await banner().getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Banner updated');

  await banner().getByRole('button', { name: 'Show' }).click();
  await expect(banner()).toContainText('Showing on the site');
  await expect(banner().getByLabel('Order')).toHaveValue('7');
  await expect(banner().getByLabel('Name')).toHaveValue('spring-campaign');

  await banner().getByRole('button', { name: 'Hide' }).click();
});

test('delete removes the banner', async ({ page }) => {
  await page.goto('/admin/banners');
  await row(page, 'spring-campaign').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('status')).toContainText('Banner deleted');
  await expect(row(page, 'spring-campaign')).toHaveCount(0);
});
