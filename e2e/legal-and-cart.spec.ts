import { test, expect } from '@playwright/test';

test.describe('Strony Regulaminowe i Koszyk (Legal & Cart)', () => {
  test('ładuje stronę regulaminu /pl/regulamin bez błędów', async ({ page }) => {
    const response = await page.goto('/pl/regulamin');
    expect(response?.status()).toBeLessThan(400);

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Regulamin/i);
  });

  test('ładuje politykę prywatności /pl/polityka-prywatnosci', async ({ page }) => {
    const response = await page.goto('/pl/polityka-prywatnosci');
    expect(response?.status()).toBeLessThan(400);

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
    await expect(heading).toContainText(/Prywatno/i);
  });

  test('ładuje stronę koszyka /pl/cart', async ({ page }) => {
    const response = await page.goto('/pl/cart');
    expect(response?.status()).toBeLessThan(400);

    // Na pustym koszyku wyświetla się komunikat o pustym koszyku
    await expect(page.getByText(/Twój koszyk jest pusty|Koszyk/i).first()).toBeVisible({ timeout: 10000 });
  });
});
