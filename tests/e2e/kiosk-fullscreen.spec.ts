import { test, expect } from '@playwright/test';

test.describe('Kiosk Fullscreen', () => {
  test('shows fullscreen button in header', async ({ page }) => {
    await page.goto('/kiosk');
    await expect(page.getByRole('button', { name: /fullscreen/i })).toBeVisible();
  });

  test('kiosk header shows logo', async ({ page }) => {
    await page.goto('/kiosk');
    await expect(page.locator('img[alt="Integrated Allergy Testing"]')).toBeVisible();
  });
});
