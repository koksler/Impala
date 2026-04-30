import { test, expect } from '@playwright/test';

test.describe('Impala App Home Page', () => {
  test('should load the home page and display correct titles', async ({ page }) => {
    // Navigate to the base URL (which should be handled by the local dev server)
    await page.goto('/');

    // Expect the page title to be present
    await expect(page).toHaveTitle(/Impala/i);

    // Verify that the main banner text is visible
    await expect(page.locator('text=Generate a')).toBeVisible();
    await expect(page.locator('text=Create from')).toBeVisible();

    // Verify that the projects list section is visible
    await expect(page.locator('text=Your previous projects')).toBeVisible();
  });
});
