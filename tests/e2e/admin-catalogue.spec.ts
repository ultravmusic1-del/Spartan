/**
 * THE FIRST AUTHENTICATED TESTS IN THIS SUITE.
 *
 * Everything in admin.spec.ts proves the guard turns people away. Nothing has
 * ever proved what happens after someone gets in, which was acceptable while
 * the admin only read data and stopped being acceptable when it started writing
 * to the catalogue.
 *
 * They run against the throwaway Supabase stack `npm run test:db:start` brings
 * up, so they are free to save whatever they like. THEY MUST NEVER BE POINTED
 * AT THE LIVE PROJECT: a test proving that editing works would be editing the
 * client's catalogue, and the publish test would deploy the production site.
 * Three things stand between here and that — this file refuses to load without
 * the stack, playwright.config.ts stops reusing a preview server that might
 * hold live credentials, and it forces VERCEL_DEPLOY_HOOK_URL empty.
 *
 * The refusal below is a THROW and not a `test.skip`. A skipped test reports
 * green, and "the authenticated tests silently did not run" is the exact
 * failure this repository exists to prevent.
 */
import { expect, test } from '@playwright/test';
import { TEST_DB_UP } from './stack';

if (!TEST_DB_UP) {
  throw new Error(
    'The authenticated admin tests need the local test database. Run `npm run test:db:start` ' +
      'first. They must not run against the live project.',
  );
}

const ADMIN = { email: 'test-admin@spartan.local', password: 'test-admin-password-1' };

/*
 * Serial, because these tests edit the same seeded catalogue. Given a distinct
 * product each, parallel would be safe right up until someone adds a sixth test
 * reusing a fourth product's slug — and the failure would be an intermittent
 * one on a screen whose whole job is to be trusted about the data.
 */
test.describe.configure({ mode: 'serial' });

async function signIn(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/admin(\?|$)/);
}

/** The session cookies, as a header, for the forged POSTs below. */
async function cookieHeader(page: import('@playwright/test').Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

/**
 * Posts a hand-crafted form and INSISTS THAT IT WAS ACCEPTED AND SAVED.
 *
 * Without this check every forged-field test below would pass vacuously: a POST
 * rejected by the guard, or refused by validation, leaves the record untouched
 * for a reason that has nothing to do with the field being read-only. The whole
 * claim is "the save went through and the forged field still did not move", so
 * the save going through has to be asserted, not assumed. It is not academic —
 * these tests were written without it and two of them passed against a 403.
 *
 * `origin` IS WHAT THAT 403 WAS. Astro's `security.checkOrigin` defaults to on
 * and rejects any on-demand POST whose Origin header does not match the site,
 * which is a genuine cross-site-request defence nobody here had written down.
 * A forged post that fails at that gate proves nothing about read-only fields,
 * so these send the header a browser would and are stopped, if at all, by the
 * thing actually under test. The defence itself is asserted separately below.
 */
async function forge(
  request: import('@playwright/test').APIRequestContext,
  cookie: string,
  origin: string,
  path: string,
  form: Record<string, string>,
): Promise<void> {
  const response = await request.post(path, {
    headers: { cookie, origin },
    form,
    maxRedirects: 0,
  });
  expect(response.status(), `POST ${path} was not accepted`).toBe(302);
  expect(response.headers()['location'], `POST ${path} did not save`).toContain(
    'notice=catalogue-saved',
  );
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test('the catalogue lists products and links to an edit form', async ({ page }) => {
  await page.goto('/admin/catalogue');

  await expect(page.getByRole('link', { name: 'Cut Flex', exact: true })).toHaveAttribute(
    'href',
    '/admin/catalogue/products/cut-flex',
  );
  await expect(page.getByRole('link', { name: 'Hand Protection' })).toBeVisible();
});

/*
 * EVERY MUTATING TEST PUTS THE RECORD BACK.
 *
 * The database is throwaway, so this is not about protecting data — it is that
 * `webServer` BUILDS THE SITE FROM THIS DATABASE before the run. On CI the
 * stack is new each time and the point is moot; locally the stack outlives the
 * run, so a test that left "Flex Fit Renamed" behind would have the next run's
 * build produce a catalogue that catalogue.spec.ts does not recognise. An
 * intermittent failure two files away is a poor price for one line saved.
 */
test('editing a product name saves and survives a reload', async ({ page }) => {
  await page.goto('/admin/catalogue/products/flex-fit');
  const name = page.getByLabel('Name', { exact: true });

  await name.fill('Flex Fit Renamed');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page.getByRole('status')).toContainText('Saved.');
  await page.reload();
  await expect(name).toHaveValue('Flex Fit Renamed');

  await name.fill('Flex-Fit');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByRole('status')).toContainText('Saved.');
  await page.reload();
  await expect(name).toHaveValue('Flex-Fit');
});

/** Every filled specification value on the page, in form order. */
async function specValues(page: import('@playwright/test').Page): Promise<string[]> {
  const values = await page
    .locator('input[name^="spec-value-"]')
    .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
  return values.filter((value) => value !== '');
}

test('editing a product does not discard its specifications', async ({ page }) => {
  await page.goto('/admin/catalogue/products/chem-guard');
  const order = page.getByLabel('Order', { exact: true });
  const before = await specValues(page);
  const wasOrder = await order.inputValue();
  expect(before.length).toBeGreaterThan(0);

  await order.fill('7');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByRole('status')).toContainText('Saved.');

  await page.reload();
  expect(await specValues(page)).toEqual(before);

  await order.fill(wasOrder);
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByRole('status')).toContainText('Saved.');
});

test('the slug cannot be changed by posting one', async ({ page, request, baseURL }) => {
  await page.goto('/admin/catalogue/products/grip-guard-gp1');
  const cookie = await cookieHeader(page);

  await forge(request, cookie, baseURL!, '/api/admin/catalogue/products/grip-guard-gp1', {
    name: 'Grip Guard GP1',
    order: '1',
    slug: 'hijacked',
  });

  // The old URL still resolves, which it would not if the slug had moved.
  await page.goto('/admin/catalogue/products/grip-guard-gp1');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Grip Guard GP1');

  const moved = await page.goto('/admin/catalogue/products/hijacked');
  expect(moved?.url()).toContain('/admin/catalogue?notice=not-found');
});

test('the EN 388 rating cannot be changed by posting one', async ({ page, request, baseURL }) => {
  await page.goto('/admin/catalogue/products/cut-flex');
  const cookie = await cookieHeader(page);

  await forge(request, cookie, baseURL!, '/api/admin/catalogue/products/cut-flex', {
    name: 'Cut Flex',
    order: '6',
    'en388-bladeCut': 'D',
  });

  await page.goto('/admin/catalogue/products/cut-flex');
  const bladeCut = page
    .locator('dt', { hasText: 'Blade cut' })
    .locator('xpath=following-sibling::dd[1]');
  // X, not D. X means the glove was NOT SUBMITTED for that test, so promoting
  // it would advertise cut resistance it has never been tested for.
  await expect(bladeCut).toHaveText('X');
});

test('editing a category saves, and its id and division do not', async ({ page, request, baseURL }) => {
  await page.goto('/admin/catalogue/categories/hand');
  const name = page.getByLabel('Name', { exact: true });
  const wasName = await name.inputValue();
  const wasDescription = await page.getByLabel('Description').inputValue();
  const wasOrder = await page.getByLabel('Order', { exact: true }).inputValue();

  await name.fill('Hand Protection Renamed');
  await page.getByRole('button', { name: /save changes/i }).click();
  await expect(page.getByRole('status')).toContainText('Saved.');
  await page.reload();
  await expect(name).toHaveValue('Hand Protection Renamed');

  /*
   * The forged POST carries the record's OWN values for the editable fields, so
   * the only thing under test is whether `id` and `division-id` move. Posting
   * invented ones would have this test quietly rewrite the category's
   * description as a side effect of proving something else.
   */
  const cookie = await cookieHeader(page);
  await forge(request, cookie, baseURL!, '/api/admin/catalogue/categories/hand', {
    name: wasName,
    description: wasDescription,
    order: wasOrder,
    id: 'hijacked',
    slug: 'hijacked',
    'division-id': 'electricals',
  });

  await page.goto('/admin/catalogue/categories/hand');
  await expect(name).toHaveValue(wasName);
  await expect(page.getByLabel('Division')).toHaveValue('safety');
  await expect(page.getByLabel('Slug')).toHaveValue('hand-protection');
});

test('an invalid edit is refused and changes nothing', async ({ page }) => {
  await page.goto('/admin/catalogue/products/grip-guard-gp3');

  await page.getByLabel('Kavalani URL').fill('https://example.com/not-kavalani');
  await page.getByRole('button', { name: /save changes/i }).click();

  await expect(page.getByRole('alert')).toContainText('rejected');
  await page.reload();
  await expect(page.getByLabel('Kavalani URL')).not.toHaveValue(
    'https://example.com/not-kavalani',
  );
});

/*
 * The defence the forged posts above have to send an Origin header to get past.
 * Astro's `security.checkOrigin` is on by default and nothing in this
 * repository had written it down or tested it — so it could be turned off in a
 * config change with no gate noticing, and a signed-in admin's browser would
 * then save whatever any other site asked it to.
 */
test('a save from another origin is refused even with a valid session', async ({
  page,
  request,
}) => {
  await page.goto('/admin/catalogue/products/grip-guard-gp5');
  const cookie = await cookieHeader(page);

  const response = await request.post('/api/admin/catalogue/products/grip-guard-gp5', {
    headers: { cookie, origin: 'https://evil.example' },
    form: { name: 'Owned', order: '3' },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);

  await page.goto('/admin/catalogue/products/grip-guard-gp5');
  await expect(page.getByLabel('Name', { exact: true })).not.toHaveValue('Owned');
});

test('publish refuses when no deploy hook is configured', async ({ page }) => {
  await page.goto('/admin/catalogue');
  await page.getByRole('button', { name: /publish to live site/i }).click();

  await expect(page.getByRole('alert')).toContainText('Publishing is not configured');
});
