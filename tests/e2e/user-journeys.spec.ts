/**
 * E2E Tests - Critical User Journeys
 * - Home page load
 * - Deal card click
 * - Affiliate redirect
 * - Filter/search
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.BASE_URL || "http://localhost:9002";

test.describe("User Journey: Browse and Click Deal", () => {
  test("should load homepage with deals", async ({ page }) => {
    await page.goto(BASE_URL);

    // Verify page title
    await expect(page).toHaveTitle(/Okazje Plus|deals?/i);

    // Check for deal cards
    const dealCards = page.locator("[data-testid='deal-card']");
    const count = await dealCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display product image and price", async ({ page }) => {
    await page.goto(BASE_URL);

    const firstCard = page.locator("[data-testid='deal-card']").first();

    // Verify image is loaded
    const image = firstCard.locator("img");
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", /http/);

    // Verify price is displayed
    const price = firstCard.locator("[data-testid='deal-price']");
    await expect(price).toBeVisible();
    await expect(price).toContainText(/\d+/);
  });

  test("should navigate to deal detail page", async ({ page }) => {
    await page.goto(BASE_URL);

    // Click first deal
    const firstCard = page.locator("[data-testid='deal-card']").first();
    const link = firstCard.locator("a").first();
    const href = await link.getAttribute("href");

    expect(href).toMatch(/^\/deals?\//);

    await link.click();
    await page.waitForURL(href!);

    // Verify detail page elements
    await expect(page.locator("h1")).toBeVisible();
    const buyButton = page.locator("[data-testid='buy-now-button']");
    await expect(buyButton).toBeVisible();
  });

  test("should click affiliate link and redirect", async ({ page, context }) => {
    await page.goto(BASE_URL);

    // Get the first deal
    const firstCard = page.locator("[data-testid='deal-card']").first();
    const dealLink = firstCard.locator("a").first();
    await dealLink.click();

    // On detail page, click "Go to Store" / "Buy Now" button
    const buyButton = page.locator("[data-testid='buy-now-button']");

    // Listen for popup or new page
    const [popup] = await Promise.all([
      context.waitForEvent("page"),
      buyButton.click(),
    ]);

    // Verify we navigated to affiliate URL
    const affiliateUrl = popup.url();
    expect(affiliateUrl).toMatch(/aliexpress|convertiser|example/i);

    await popup.close();
  });

  test("should filter deals by category", async ({ page }) => {
    await page.goto(BASE_URL);

    // Open category filter
    const categoryFilter = page.locator("[data-testid='filter-category']");
    await categoryFilter.click();

    // Select category option
    const firstOption = page.locator("[data-testid='category-option']").first();
    const optionText = await firstOption.textContent();
    await firstOption.click();

    // Verify deals are filtered
    const dealCards = page.locator("[data-testid='deal-card']");
    await page.waitForTimeout(500); // Wait for filter animation

    const count = await dealCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should search for deals", async ({ page }) => {
    await page.goto(BASE_URL);

    // Type in search box
    const searchInput = page.locator("[data-testid='search-input']");
    await searchInput.fill("laptop");

    // Press enter or wait for debounced search
    await page.waitForTimeout(500);

    // Verify search results appear
    const dealCards = page.locator("[data-testid='deal-card']");
    const count = await dealCards.count();

    // At least some results or "no results" message
    const noResults = page.locator("[data-testid='no-results']");
    const hasResults = count > 0 || (await noResults.isVisible());
    expect(hasResults).toBeTruthy();
  });

  test("should change currency selector", async ({ page }) => {
    await page.goto(BASE_URL);

    const currencySelector = page.locator("[data-testid='currency-selector']");
    await currencySelector.click();

    // Select EUR
    const eurOption = page.locator("[data-testid='currency-EUR']");
    await eurOption.click();

    // Verify price displays in EUR
    const price = page.locator("[data-testid='deal-price']").first();
    const priceText = await price.textContent();
    expect(priceText).toMatch(/€|EUR/);
  });

  test("should change language selector", async ({ page }) => {
    await page.goto(BASE_URL);

    const langSelector = page.locator("[data-testid='language-selector']");
    await langSelector.click();

    // Select German
    const deOption = page.locator("[data-testid='language-DE']");
    await deOption.click();

    // Verify language changed (check URL or content)
    await expect(page).toHaveURL(/[?&]lang=de|\/de\//);
  });

  test("should vote on deal", async ({ page }) => {
    await page.goto(BASE_URL);

    // Go to deal detail
    const firstCard = page.locator("[data-testid='deal-card']").first();
    await firstCard.locator("a").first().click();

    // Click upvote button
    const upvoteButton = page.locator("[data-testid='upvote-button']");
    const initialCount = await page
      .locator("[data-testid='vote-count']")
      .textContent();

    await upvoteButton.click();

    // Verify vote count increased (debounced update)
    await page.waitForTimeout(500);
    const newCount = await page
      .locator("[data-testid='vote-count']")
      .textContent();

    expect(newCount).not.toEqual(initialCount);
  });

  test("should load more deals with pagination/infinite scroll", async ({ page }) => {
    await page.goto(BASE_URL);

    const initialCount = await page.locator("[data-testid='deal-card']").count();

    // Scroll to bottom to trigger infinite scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for new deals to load
    await page.waitForTimeout(1000);

    const finalCount = await page.locator("[data-testid='deal-card']").count();
    expect(finalCount).toBeGreaterThan(initialCount);
  });
});

test.describe("Performance & Accessibility", () => {
  test("should load page within reasonable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test("should have proper heading hierarchy", async ({ page }) => {
    await page.goto(BASE_URL);

    // Check h1 exists
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible();

    // Multiple h2s expected
    const h2s = page.locator("h2");
    expect(await h2s.count()).toBeGreaterThan(0);
  });

  test("should have accessible buttons and links", async ({ page }) => {
    await page.goto(BASE_URL);

    // Check buttons have labels
    const buttons = page.locator("button");
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const button = buttons.nth(i);
      const ariaLabel = await button.getAttribute("aria-label");
      const text = await button.textContent();
      expect(ariaLabel || text).toBeTruthy();
    }
  });
});
