import { test, expect } from '@playwright/test';

test.describe('Katalog Produktów (Products)', () => {
  test('ładuje listę produktów na /pl/products', async ({ page }) => {
    const response = await page.goto('/pl/products');
    expect(response?.status()).toBeLessThan(400);

    const heading = page.getByRole('heading', { name: /Produkt/i }).first();
    await expect(heading).toBeVisible();

    // Sprawdzenie czy załadowały się karty produktów lub widok listy
    const productCards = page.locator('a[href*="/products/"]:not([href="/pl/products"]), [role="link"]').filter({ hasText: /zł|Produkt|ocen/i });
    await expect(productCards.first()).toBeVisible({ timeout: 15000 });
  });

  test('pozwala wejść na szczegóły produktu', async ({ page }) => {
    await page.goto('/pl/products');

    const firstProductLink = page.locator('a[href*="/products/"]:not([href="/pl/products"]), [role="link"]').filter({ hasText: /zł|Produkt|ocen/i }).first();
    await expect(firstProductLink).toBeVisible({ timeout: 15000 });

    await firstProductLink.click();
    await expect(page).toHaveURL(/.*\/products\/.+/, { timeout: 15000 });

    // Nagłówek produktu
    const productTitle = page.locator('h1').first();
    await expect(productTitle).toBeVisible();
  });
});
