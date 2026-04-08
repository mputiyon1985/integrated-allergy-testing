import { test, expect } from '@playwright/test';

test.describe('Kiosk Consent Page (no patient session)', () => {
  test('redirects to kiosk home when no patient session', async ({ page }) => {
    await page.goto('/kiosk/consent');
    // Should redirect to /kiosk since no patient in sessionStorage
    await expect(page).toHaveURL(/\/kiosk$/, { timeout: 5000 });
  });
});
