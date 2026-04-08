import { test, expect } from '@playwright/test';

test.describe('Kiosk DOB Entry', () => {
  test('shows DOB input and Continue button', async ({ page }) => {
    await page.goto('/kiosk');
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
  });

  test('Continue button is disabled without DOB', async ({ page }) => {
    await page.goto('/kiosk');
    const button = page.getByRole('button', { name: /continue/i });
    await expect(button).toBeDisabled();
  });

  test('Continue button enables after DOB entry', async ({ page }) => {
    await page.goto('/kiosk');
    await page.locator('input[type="date"]').fill('1990-05-15');
    const button = page.getByRole('button', { name: /continue/i });
    await expect(button).toBeEnabled();
  });

  test('shows kiosk branding header', async ({ page }) => {
    await page.goto('/kiosk');
    await expect(page.getByText('Patient Check-In')).toBeVisible();
  });
});
