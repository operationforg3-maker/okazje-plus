import { test, expect } from '@playwright/test';

test.describe('Ochrona Tras i Autoryzacja (Auth Guard)', () => {
  test('przekierowuje niezalogowanego użytkownika z /pl/admin do /pl/login', async ({ page }) => {
    await page.goto('/pl/admin');
    await expect(page).toHaveURL(/.*login/, { timeout: 15000 });
  });

  test('formularz logowania na /pl/login jest poprawnie renderowany', async ({ page }) => {
    const response = await page.goto('/pl/login');
    expect(response?.status()).toBeLessThan(400);

    // Pole adresu email
    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    await expect(emailInput).toBeVisible();

    // Przycisk logowania
    const submitBtn = page.locator('button[type="submit"], button:has-text("Zaloguj")').first();
    await expect(submitBtn).toBeVisible();
  });
});
