import { test, expect } from '@playwright/test';

test.describe('Admin Panel Harvester Page', () => {
  test.skip('allows launching harvester job and shows sections', async ({ page }) => {
    // Mock login should be set here if applicable
    await page.goto('/pl/admin/harvester');
    
    // Check main title
    const header = page.locator('h1:has-text("Kombajn Importu")');
    await expect(header).toBeVisible();
    
    // Check tabs
    await expect(page.locator('role=tab[name="Import"]')).toBeVisible();
    await expect(page.locator('role=tab[name="Ulepszanie"]')).toBeVisible();
    await expect(page.locator('role=tab[name="Zadania"]')).toBeVisible();
    await expect(page.locator('role=tab[name="Harmonogramy"]')).toBeVisible();
  });
});
