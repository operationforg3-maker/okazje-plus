import { test, expect } from '@playwright/test';

test.describe('Forum Społeczności (Forum)', () => {
  test('ładuje stronę główną forum /pl/forum', async ({ page }) => {
    const response = await page.goto('/pl/forum');
    expect(response?.status()).toBeLessThan(400);

    // Nagłówek forum
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();

    // Przycisk lub link "Nowy wątek" / "Dodaj temat"
    const newThreadBtn = page.locator('a[href*="/forum/new"], button:has-text("Nowy wątek"), button:has-text("Dodaj temat")').first();
    await expect(newThreadBtn).toBeVisible();
  });

  test('przekierowuje lub wymaga logowania przy próbie utworzenia wątku niezalogowanym', async ({ page }) => {
    await page.goto('/pl/forum/new');

    // Niezalogowany użytkownik widzi formularz logowania / monit o autoryzację
    const authIndicator = page.getByText(/Witaj z powrotem|Zaloguj/i).first();
    await expect(authIndicator).toBeVisible({ timeout: 10000 });
  });
});
