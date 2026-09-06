import { test, expect } from '@playwright/test';

test.describe('Wyszukiwarka (Search)', () => {
  test('ładuje stronę wyszukiwania z parametrem zapytania /pl/search?q=laptop', async ({ page }) => {
    const response = await page.goto('/pl/search?q=laptop');
    expect(response?.status()).toBeLessThan(400);

    // Formularz wyszukiwania / input
    const searchInput = page.locator('input[type="search"], input[name="q"], input[placeholder*="Szukaj"]').filter({ visible: true }).first();
    await expect(searchInput).toBeVisible();

    // Sprawdzenie czy strona nie rzuciła błędu 500
    const body = page.locator('body');
    await expect(body).not.toContainText('Internal Server Error');
  });

  test('pozwala wpisać zapytanie i wyszukać z poziomu strony głównej', async ({ page }) => {
    await page.goto('/pl');

    const searchInput = page.locator('input[type="search"], input[placeholder*="Szukaj"], input[placeholder*="szukaj"]').filter({ visible: true }).first();
    await expect(searchInput).toBeVisible();

    await searchInput.fill('telefon');
    await searchInput.press('Enter');

    // Powinno przenieść na stronę wyszukiwania
    await page.waitForURL(/.*search.*q=telefon/i, { timeout: 10000 });
    await expect(page).toHaveURL(/.*search.*/);
  });
});
