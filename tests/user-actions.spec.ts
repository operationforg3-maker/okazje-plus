import { test, expect } from '@playwright/test';

// Minimal helpers
import type { Page } from '@playwright/test';
async function login(page: Page) {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  if (!email || !password) {
    test.skip(true, 'Brak TEST_USER_EMAIL / TEST_USER_PASSWORD w env');
    return;
  }
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Hasło', { exact: true }).fill(password);
  await Promise.all([
    page.waitForURL('**/'),
    page.getByRole('button', { name: 'Zaloguj się' }).click()
  ]);
}

// Test scenariusze zalogowanego użytkownika

test.describe('Akcje zalogowanego użytkownika', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Głosowanie na okazji (upvote)', async ({ page }) => {
    await page.goto('/');
    // Znajdź pierwszą kartę okazji prowadzącą do /deals/
    const firstDealLink = page.locator('a[href^="/deals/"]').first();
    await expect(firstDealLink).toBeVisible();
    await firstDealLink.click();
    await page.waitForLoadState('networkidle');

    const upvoteBtn = page.getByRole('button', { name: 'Głosuj za' });
    await expect(upvoteBtn).toBeVisible();
    // Temperatura przed
    const tempLocator = page.locator('text=°').first(); // fallback jeśli brak dedykowanego selektora
    // Klik upvote
    await upvoteBtn.click();
    // Brak błędu toastu
    await expect(page.locator('text=Błąd')).toHaveCount(0);
  });

  test('Dodanie komentarza (jeśli sekcja dostępna)', async ({ page }) => {
    await page.goto('/');
    const firstDealLink = page.locator('a[href^="/deals/"]').first();
    await firstDealLink.click();
    await page.waitForLoadState('networkidle');
    // Szukaj pola komentarza
    const commentInput = page.getByPlaceholder(/Komentarz|Dodaj komentarz/i);
    if (await commentInput.isVisible().catch(() => false)) {
      await commentInput.fill('Testowy komentarz E2E');
      // Przycisk wyślij
      const sendBtn = page.getByRole('button', { name: /Dodaj|Wyślij|Komentarz/i });
      if (await sendBtn.isVisible().catch(() => false)) {
        await sendBtn.click();
        // Oczekuj pojawienia się tekstu komentarza (prosty fallback)
        await expect(page.locator('text=Testowy komentarz E2E')).toBeVisible({ timeout: 5000 });
      } else {
        test.skip(true, 'Brak przycisku dodania komentarza');
      }
    } else {
      test.skip(true, 'Brak dostępnego pola komentarza');
    }
  });

  test('Dodanie do ulubionych (serce)', async ({ page }) => {
    await page.goto('/');
    const firstDealLink = page.locator('a[href^="/deals/"]').first();
    await firstDealLink.click();
    await page.waitForLoadState('networkidle');
    // Ikona serca (Heart) – możemy odwołać się do svg + przycisku
    const heartBtn = page.locator('button:has(svg[class*="heart"])');
    if (await heartBtn.isVisible().catch(() => false)) {
      await heartBtn.click();
      // Sprawdź brak błędu w toastach
      await expect(page.locator('text=Błąd')).toHaveCount(0);
    } else {
      test.skip(true, 'Brak przycisku ulubionych');
    }
  });

  test('Ustawienie alertu cenowego (jeśli dostępny przycisk)', async ({ page }) => {
    await page.goto('/');
    const firstProductLink = page.locator('a[href^="/products/"]').first();
    if (!(await firstProductLink.isVisible().catch(() => false))) {
      test.skip(true, 'Brak produktów do testu alertu cenowego');
    }
    await firstProductLink.click();
    await page.waitForLoadState('networkidle');
    const alertBtn = page.getByRole('button', { name: /Alert cenowy|Ustaw alert/i });
    if (await alertBtn.isVisible().catch(() => false)) {
      await alertBtn.click();
      const priceInput = page.getByRole('spinbutton');
      if (await priceInput.isVisible().catch(() => false)) {
        await priceInput.fill('99');
        const confirm = page.getByRole('button', { name: /Zapisz|Ustaw|Potwierdź/i });
        if (await confirm.isVisible().catch(() => false)) {
          await confirm.click();
          // Sprawdź brak błędu toastu
          await expect(page.locator('text=Błąd')).toHaveCount(0);
        } else {
          test.skip(true, 'Brak przycisku potwierdzenia alertu');
        }
      } else {
        test.skip(true, 'Brak pola ceny dla alertu');
      }
    } else {
      test.skip(true, 'Brak przycisku alertu cenowego');
    }
  });
});
