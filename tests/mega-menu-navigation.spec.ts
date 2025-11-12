import { expect, test } from "@playwright/test";

test.describe("Mega menu - nawigacja drzewo", () => {
  test("otwiera menu, wybiera kategorię i podkategorię (jeśli dostępne)", async ({ page }) => {
    await page.goto("/");

    // Otwórz mega menu przez hover na przycisku "Katalog"
    const katalogBtn = page.getByRole("button", { name: "Katalog" });
    await expect(katalogBtn).toBeVisible();
    await katalogBtn.hover();

    // Czekaj na render treści menu
    const menuContent = page.locator('[class*="NavigationMenuContent"], [data-radix-popper-content-wrapper]');
    await expect(menuContent).toBeVisible();

    // Jeśli nie ma kategorii (fallback), zakończ test łagodnie
    const emptyMsg = page.locator('text=Brak zdefiniowanych kategorii');
    if (await emptyMsg.isVisible().catch(() => false)) {
      test.skip(true, "Brak danych kategorii w środowisku testowym");
    }

    // Lista kategorii po lewej
    const categoriesNav = page.locator('nav[aria-label="Kategorie"]');
    await expect(categoriesNav).toBeVisible();
    const firstCategoryBtn = categoriesNav.getByRole('button').first();
    const firstCategoryName = await firstCategoryBtn.textContent();
    await firstCategoryBtn.hover();
    await firstCategoryBtn.click();

    // W środkowej kolumnie powinno pojawić się breadcrumb z nazwą kategorii lub opis
    if (firstCategoryName) {
      await expect(page.locator('nav:has-text("Strona główna")')).toContainText(firstCategoryName.trim());
    }

    // Spróbuj kliknąć pierwszą podkategorię (jeśli istnieje), a potem zweryfikuj URL
    const subcategoryLink = page.locator('a[href*="/products?mainCategory="]').first();
    if (await subcategoryLink.isVisible().catch(() => false)) {
      const beforeUrl = page.url();
      await subcategoryLink.click();
      await expect(page).not.toHaveURL(beforeUrl);
      await expect(page).toHaveURL(/\/products\?mainCategory=/);
    } else {
      test.skip(true, "Brak podkategorii do kliknięcia w środowisku testowym");
    }
  });
});
