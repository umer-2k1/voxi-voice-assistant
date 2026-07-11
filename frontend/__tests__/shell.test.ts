import test, { expect } from '@playwright/test';

/**
 * UI smoke tests against the Vite dev server (no Tauri backend).
 * Tauri `invoke` is unavailable in a plain browser, so these assert the
 * shell renders and routes work — the agent flows are covered by the
 * sidecar eval harness.
 */
test.describe('Main window shell', () => {
  test.beforeEach(async ({ page }) => {
    // Skip the first-run wizard; it has its own test below.
    await page.addInitScript(() => {
      localStorage.setItem('vox-onboarded', '1');
    });
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
    await expect(page.getByRole('button', { name: 'Browse directory' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add custom' })).toBeVisible();
  });

  test('directory lists the Google connectors with shared sign-in', async ({ page }) => {
    await page.getByRole('link', { name: 'Connectors' }).click();
    await page.getByRole('button', { name: 'Browse directory' }).click();
    await expect(page.getByText('Gmail', { exact: true })).toBeVisible();
    await expect(page.getByText('Google Drive', { exact: true })).toBeVisible();
    await expect(page.getByText('Google Calendar', { exact: true })).toBeVisible();
    await expect(page.getByText('shared sign-in').first()).toBeVisible();
  });
});

test.describe('Overlay window', () => {
  test('renders the idle mic pill', async ({ page }) => {
    await page.goto('/overlay');
    await expect(page.getByText('idle')).toBeVisible();
  });
});

test.describe('First-run onboarding', () => {
  test('shows the wizard until completed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Talk to your computer.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
  });
});
