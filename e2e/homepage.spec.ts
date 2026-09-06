import { test, expect } from '@playwright/test';

test.describe('Strona Główna (Homepage)', () => {
  test('ładuje stronę główną /pl i podstawowe elementy interfejsu', async ({ page }) => {
    const response = await page.goto('/pl');
    expect(response?.status()).toBeLessThan(400);

    // Header i nawigacja
    const nav = page.locator('header, nav').first();
    await expect(nav).toBeVisible();

    // Wyszukiwarka na stronie głównej (widoczna w danej rozdzielczości)
    const searchInput = page.locator('input[type="search"], input[placeholder*="Szukaj"], input[placeholder*="szukaj"]').filter({ visible: true }).first();
    await expect(searchInput).toBeVisible();

    // Sprawdzenie obecności linków nawigacyjnych
    const dealsLink = page.locator('a[href*="/deals"]').first();
    await expect(dealsLink).toBeVisible();

    const productsLink = page.locator('a[href*="/products"]').first();
    await expect(productsLink).toBeVisible();

    // Stopka
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('posiada poprawny tytuł strony', async ({ page }) => {
    await page.goto('/pl');
    await expect(page).toHaveTitle(/Okazje Plus|Okazje\+/i);
  });
});
