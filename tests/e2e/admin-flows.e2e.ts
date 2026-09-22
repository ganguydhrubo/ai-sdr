import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end checks that the admin app works against the server store: every action goes
 * through an API route and survives a full page reload (the bug the original build had).
 * The dev server runs in DEMO_MODE with APEX_PERSIST=false, so delivery is simulated.
 */

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page must not scroll horizontally').toBeLessThanOrEqual(0);
}

test.describe('Admin app — server-backed flows', () => {
  test.skip(({ viewport }) => !!viewport && viewport.width < 768, 'admin shell is desktop-first');

  test('dashboard renders live stats and approving a draft actually dispatches it', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('stat-total-leads')).not.toHaveText('');
    await expect(page.getByTestId('approval-queue')).toBeVisible();
    const approve = page.getByRole('button', { name: /Approve & Send/ }).first();
    if (await approve.isVisible()) {
      await approve.click();
      await expect(page.getByTestId('notice-ok')).toContainText(/sent \(simulated\)|delivered/i, { timeout: 15_000 });
    }
    await expectNoHorizontalOverflow(page);
  });

  test('adding a lead persists on the server and shows up after a reload', async ({ page }) => {
    await page.goto('/leads');
    await page.getByTestId('open-add-lead').click();
    const name = `E2E Lead ${Date.now().toString().slice(-6)}`;
    await page.getByPlaceholder('e.g. Vikram Malhotra').fill(name);
    await page.getByPlaceholder('e.g. Bharat Precision Tools Pvt Ltd').fill('E2E Forgings Pvt Ltd');
    await page.getByPlaceholder('9876543210').fill(`98${Date.now().toString().slice(-8)}`);
    await page.getByTestId('submit-add-lead').click();
    await expect(page.getByTestId('notice-ok')).toContainText('ingested', { timeout: 20_000 });
    await expect(page.getByTestId('leads-table')).toContainText(name);

    await page.reload();
    await expect(page.getByTestId('leads-table')).toContainText(name, { timeout: 15_000 });
  });

  test('the kill switch is a server setting: it survives a reload and shows the banner', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('kill-switch').click();
    await expect(page.getByTestId('kill-switch-banner')).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await expect(page.getByTestId('kill-switch-banner')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('kill-switch').click();
    await expect(page.getByTestId('kill-switch-banner')).toHaveCount(0, { timeout: 10_000 });
  });

  test('minting a talk link from the Voice Hub produces a working talk page', async ({ page }) => {
    await page.goto('/voice');
    await page.getByTestId('open-mint').click();
    await page.getByTestId('mint-submit').click();
    await expect(page.getByTestId('minted-link')).toBeVisible({ timeout: 15_000 });
    const url = (await page.getByTestId('minted-link').locator('.font-mono').textContent()) || '';
    expect(url).toContain('/talk/');
    await page.goto(new URL(url).pathname);
    await expect(page.getByText('Statutory AI Voice Disclosure')).toBeVisible();
  });

  test('settings: delivery mode and ICP weights save through the API', async ({ page }) => {
    await page.goto('/settings');
    await page.getByTestId('delivery-SIMULATED').check();
    await page.getByTestId('save-delivery').click();
    await expect(page.getByTestId('notice-ok')).toContainText('Delivery settings saved', { timeout: 10_000 });
    await page.getByTestId('save-weights').click();
    await expect(page.getByTestId('notice-ok')).toContainText('ICP scoring matrix saved', { timeout: 10_000 });
    await expect(page.getByTestId('integrations')).toBeVisible();
  });

  test('inbox: simulating an inbound reply classifies it and drafts an AI reply that can be sent', async ({ page }) => {
    await page.goto('/inbox');
    await page.getByTestId('custom-inbound').fill('Can you share pricing for our 12-person sales team?');
    await page.getByRole('button', { name: 'Process' }).click();
    await expect(page.getByTestId('notice-ok')).toContainText(/classified as/i, { timeout: 20_000 });
    const send = page.getByTestId('inbox-thread').getByRole('button', { name: 'Send' }).last();
    await expect(send).toBeVisible();
    await send.click();
    await expect(page.getByTestId('notice-ok')).toContainText(/sent \(simulated\)|delivered/i, { timeout: 15_000 });
  });
});
