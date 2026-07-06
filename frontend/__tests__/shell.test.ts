import test, { expect } from '@playwright/test';

/**
 * UI smoke tests against the Vite dev server (no Tauri backend).
 * Tauri `invoke` is unavailable in a plain browser, so these assert the
 * shell renders and routes work — the agent flows are covered by the
 * sidecar eval harness.
 */
test.describe('Main window shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('renders the sidebar with all sections', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Connectors' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });

  test('shows the push-to-talk hint on an empty transcript', async ({ page }) => {
    await expect(page.getByText('Hold the hotkey and speak.')).toBeVisible();
  });

  test('navigates to connectors', async ({ page }) => {
    await page.getByRole('link', { name: 'Connectors' }).click();
    await expect(page.getByRole('button', { name: 'Add server' })).toBeVisible();
  });
});

test.describe('Overlay window', () => {
  test('renders the idle mic pill', async ({ page }) => {
    await page.goto('/overlay');
    await expect(page.getByText('idle')).toBeVisible();
  });
});
