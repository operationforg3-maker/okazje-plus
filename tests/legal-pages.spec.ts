import { expect, test } from "@playwright/test";

const legalPages: Array<{
  slug: string;
  heroTitle: string;
  expectedSections: string[];
  breadcrumbTrail: string[];
}> = [
  {
    slug: "regulamin",
    heroTitle: "Regulamin Okazje+",
    breadcrumbTrail: ["Strona główna", "Regulamin Okazje+"],
    expectedSections: [
      "definicje",
      "postanowienia-ogolne",
      "model-biznesowy",
      "ugc",
      "grywalizacja",
      "moderacja",
      "punkty-kontaktowe",
      "odpowiedzialnosc",
      "reklamacje",
      "rodo",
      "zmiany-regulaminu",
      "postanowienia-koncowe",
    ],
  },
  {
    slug: "polityka-prywatnosci",
    heroTitle: "Polityka Prywatności Okazje+",
    breadcrumbTrail: ["Strona główna", "Polityka Prywatności Okazje+"],
    expectedSections: [
      "postanowienia-ogolne",
      "zakres-i-cele",
      "cookies",
      "udostepnianie",
      "okres-przechowywania",
      "prawa-uzytkownika",
      "bezpieczenstwo",
      "marketing",
      "profilowanie",
      "linki-zewnetrzne",
      "zmiany-polityki",
      "kontakt",
    ],
  },
];

test.describe("Strony prawne", () => {
  for (const pageConfig of legalPages) {
    test(`renderuje sekcje i nawigację dla /${pageConfig.slug}`, async ({ page }) => {
      await page.goto(`/${pageConfig.slug}`);

      await expect(page.getByRole("heading", { level: 1, name: pageConfig.heroTitle })).toBeVisible();

      const breadcrumbs = page.locator('nav[aria-label="Okazje+ breadcrumbs"]');
      for (const label of pageConfig.breadcrumbTrail) {
        await expect(breadcrumbs).toContainText(label);
      }

      const tocLinks = page.locator('nav[aria-label="Sekcje dokumentu"] a');
      await expect(tocLinks).toHaveCount(pageConfig.expectedSections.length);

      const hrefs = await tocLinks.evaluateAll((links) => links.map((link) => link.getAttribute("href")));
      expect(hrefs).toEqual(pageConfig.expectedSections.map((id) => `#${id}`));

      const firstLink = tocLinks.first();
      const firstSectionId = pageConfig.expectedSections[0];
      await firstLink.click();
      await expect(page).toHaveURL(new RegExp(`#${firstSectionId}$`));

      const sectionHeading = page.locator(`#${firstSectionId} h2, #${firstSectionId} h3`).first();
      await expect(sectionHeading).toBeVisible();

      await expect(page.locator("text=Data aktualizacji")).toBeVisible();
      await expect(page.locator("text=Dokument prawny")).toBeVisible();
    });
  }
});
