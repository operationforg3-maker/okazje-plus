import { test, expect } from '@playwright/test';

test.describe('Admin Panel Auth Guard', () => {
  test('redirects unauthenticated users to login page', async ({ page }) => {
    // Go to admin dashboard page
    await page.goto('/pl/admin');
    
    // Expect to be redirected to login page since user is not logged in
    await expect(page).toHaveURL(/.*login/);
  });
});
