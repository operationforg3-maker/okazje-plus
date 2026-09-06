import { test, expect } from '@playwright/test';

test.describe('Katalog Okazji (Deals)', () => {
  test('ładuje listę okazji na /pl/deals', async ({ page }) => {
    const response = await page.goto('/pl/deals');
    expect(response?.status()).toBeLessThan(400);

    // Nagłówek sekcji okazji
    const heading = page.getByRole('heading', { name: /Okazje/i }).first();
    await expect(heading).toBeVisible();

    // Sprawdzenie czy załadowały się karty okazji (mające role="link")
    const dealCards = page.locator('[role="link"]').filter({ hasText: /zł|AliExpress|%/i });
    await expect(dealCards.first()).toBeVisible({ timeout: 15000 });
  });

  test('pozwala przejść do szczegółów okazji', async ({ page }) => {
    await page.goto('/pl/deals');

    // Znajdź pierwszą kartę okazji
    const firstDealCard = page.locator('[role="link"]').filter({ hasText: /zł|AliExpress|%/i }).first();
    await expect(firstDealCard).toBeVisible({ timeout: 15000 });

    // Czekamy na hydrację i powtarzamy kliknięcie w razie opóźnienia hydracji
    await expect(async () => {
      await firstDealCard.locator('h4').first().click();
      await expect(page).toHaveURL(/.*\/deals\/.+/, { timeout: 3000 });
    }).toPass({ timeout: 20000 });

    // Strona szczegółów musi zawierać nagłówek h1 (tytuł okazji)
    const dealTitle = page.locator('h1').first();
    await expect(dealTitle).toBeVisible();

    // Sekcja komentarzy / dyskusji lub przycisk przejścia do oferty
    const actionElement = page.locator('#deal-discussion, button:has-text("Przejdź"), a:has-text("Przejdź")').first();
    await expect(actionElement).toBeVisible();
  });
});
