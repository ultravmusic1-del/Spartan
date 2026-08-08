import { expect, test } from '@playwright/test';

/**
 * The two compact enquiry forms — the home page CTA and the general enquiry
 * form on /contact.
 *
 * Both were inert until `/api/enquiry` was wired to them: `type="button"`
 * inside a form whose `onsubmit` returned false, so a buyer could fill the
 * Contact page in full, press Send, and have nothing happen at all. These tests
 * exist so that cannot come back silently.
 *
 * Nothing is mocked. `/api/enquiry` is the real built endpoint served by
 * tests/preview-server.mjs, and with no `RESEND_API_KEY` in the environment it
 * answers `200 { ok: true, delivered: false }` — so the assertions below check
 * for the *honest* "recorded but not sent" wording and never for a claim that
 * an email went out.
 *
 * The endpoint rate-limits 5 submissions per IP per 10 minutes in one process's
 * memory, and `reuseExistingServer` lets that process outlive a run. Each
 * submitting test therefore presents itself as a distinct client. The `11.`
 * prefix keeps this file's addresses clear of enquiry.spec.ts's `10.` ones,
 * which would otherwise share a bucket across the two files.
 */

let submissions = 0;

function submissionIp(): string {
  submissions += 1;
  const second = Math.floor(Date.now() / 1000) % 251;
  return `11.${second}.${process.pid % 251}.${submissions}`;
}

test.describe('the compact enquiry forms', () => {
  test('the contact form submits and reports the honest delivery state', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': submissionIp() });
    await page.goto('/contact');

    const form = page.locator('form.cf2');
    // The script sets this once it has attached its listener. Before that the
    // submit control is hidden, so this is the enhancement wait.
    await expect(form).toHaveAttribute('data-state', 'idle');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/enquiry')),
      (async () => {
        await form.getByLabel('Name', { exact: true }).fill('Dana Okafor');
        await form.getByLabel('Company', { exact: true }).fill('Northlight Facilities');
        await form.getByLabel('Email', { exact: true }).fill('dana@example.com');
        await form.getByLabel('Message', { exact: true }).fill('Do you stock arc-rated coveralls?');
        await form.getByRole('button', { name: 'Send enquiry' }).click();
      })(),
    ]);

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ ok: true, delivered: false });

    // The one assertion this file exists for: no credentials means the enquiry
    // was recorded and NOT sent, and the form has to say so.
    await expect(form).toHaveAttribute('data-state', 'sent');
    const status = form.locator('[data-enquiry-status]');
    await expect(status).toContainText('not configured');
    await expect(status).toContainText('has not reached the Spartan team');
  });

  test('the home CTA sends the division the buyer picked', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': submissionIp() });
    await page.goto('/');

    const form = page.locator('form.cta__box');
    await form.scrollIntoViewIfNeeded();
    await expect(form).toHaveAttribute('data-state', 'idle');

    const [request] = await Promise.all([
      page.waitForRequest((r) => r.url().includes('/api/enquiry') && r.method() === 'POST'),
      (async () => {
        await form.getByLabel('Name', { exact: true }).fill('Priya Raman');
        await form.getByLabel('Company', { exact: true }).fill('Harbour Works');
        await form.getByLabel('Email', { exact: true }).fill('priya@example.com');
        await form.getByLabel('Division of interest', { exact: true }).selectOption('safety');
        await form.getByRole('button', { name: 'Send enquiry' }).click();
      })(),
    ]);

    // `division` had no field in enquiryPayloadSchema when these forms were
    // wired up. Dropping it silently was the easy wrong answer — the buyer told
    // us which half of the catalogue they care about and the sales inbox needs
    // to see it.
    const payload = JSON.parse(request.postData() ?? '{}');
    expect(payload.division).toBe('safety');
    expect(payload.name).toBe('Priya Raman');
    expect(payload.website).toBe('');

    await expect(form).toHaveAttribute('data-state', 'sent');
  });

  test('a server-side rejection is shown rather than swallowed', async ({ page }) => {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': submissionIp() });
    await page.goto('/contact');

    const form = page.locator('form.cf2');
    await expect(form).toHaveAttribute('data-state', 'idle');

    // Native validation would stop an empty name before it reached the network,
    // so the field is filled with whitespace: the browser is satisfied and the
    // server's `.trim().min(1)` is not. That is the path where a form can look
    // like it worked and quietly do nothing.
    await form.getByLabel('Name', { exact: true }).fill('   ');
    await form.getByLabel('Email', { exact: true }).fill('someone@example.com');

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/enquiry')),
      form.getByRole('button', { name: 'Send enquiry' }).click(),
    ]);

    await expect(form).toHaveAttribute('data-state', 'error');
    await expect(form.locator('[data-enquiry-status]')).toContainText('Please enter your name');
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  /*
   * There is no way to post these forms without script, so the submit control
   * is not shown at all and a line pointing at a real route takes its place.
   * This is the same rule the enquiry buttons and the catalogue filter bar
   * follow: never show a visitor a control that cannot work.
   */
  test('the contact form hides its submit and offers a real alternative', async ({ page }) => {
    await page.goto('/contact');

    await expect(page.locator('.cf2__submit')).toBeHidden();
    await expect(page.locator('.cf2__nojs')).toBeVisible();
    await expect(page.locator('.cf2__nojs')).toContainText('needs JavaScript');
  });

  test('the home CTA hides its submit and offers a real alternative', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('.cta__submit')).toBeHidden();
    const fallback = page.locator('.cta__nojs');
    await expect(fallback).toBeVisible();
    await expect(fallback.getByRole('link', { name: 'Open the enquiry page' })).toHaveAttribute(
      'href',
      '/enquiry',
    );
  });
});
