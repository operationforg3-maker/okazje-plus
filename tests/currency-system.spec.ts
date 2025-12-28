import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Currency System
 * 
 * Tests currency switching, price display, and auto-updates
 */

test.describe('Currency System E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should display prices in default currency (PLN)', async ({ page }) => {
    // Find first deal card
    const dealCard = page.locator('[data-testid="deal-card"]').first();
    
    // Should contain price with PLN symbol
    const priceText = await dealCard.locator('[data-testid="deal-price"]').textContent();
    expect(priceText).toMatch(/zł/);
  });

  test('should have currency selector in header', async ({ page }) => {
    // Look for currency selector
    const currencySelector = page.locator('[data-testid="currency-selector"]');
    
    await expect(currencySelector).toBeVisible();
    
    // Should show default currency
    const currentCurrency = await currencySelector.textContent();
    expect(currentCurrency).toContain('PLN');
  });

  test('should switch currency when user selects different option', async ({ page }) => {
    // Open currency dropdown
    const currencyDropdown = page.locator('[data-testid="currency-dropdown-trigger"]');
    await currencyDropdown.click();
    
    // Select USD option
    const usdOption = page.locator('button:has-text("USD")');
    await usdOption.click();
    
    // Wait for prices to update
    await page.waitForTimeout(500);
    
    // Prices should now show USD symbol
    const priceText = page.locator('[data-testid="deal-price"]').first();
    await expect(priceText).toContainText(/\$/);
  });

  test('should persist currency selection in localStorage', async ({ page, context }) => {
    // Set currency to EUR
    const currencyDropdown = page.locator('[data-testid="currency-dropdown-trigger"]');
    await currencyDropdown.click();
    
    const eurOption = page.locator('button:has-text("EUR")');
    await eurOption.click();
    
    // Create new page to verify persistence
    const newPage = await context.newPage();
    await newPage.goto('/');
    await newPage.waitForLoadState('networkidle');
    
    // Currency should still be EUR
    const currencySelector = newPage.locator('[data-testid="currency-selector"]');
    const currentCurrency = await currencySelector.textContent();
    expect(currentCurrency).toContain('EUR');
    
    await newPage.close();
  });

  test('should correctly convert prices when switching currencies', async ({ page }) => {
    // Get PLN price
    const priceElement = page.locator('[data-testid="deal-price"]').first();
    const plnPrice = await priceElement.textContent();
    
    // Extract numeric value (remove symbol and whitespace)
    const plnValue = parseFloat(plnPrice?.replace(/[^\d.,]/g, '') || '0');
    
    // Switch to USD
    const currencyDropdown = page.locator('[data-testid="currency-dropdown-trigger"]');
    await currencyDropdown.click();
    
    const usdOption = page.locator('button:has-text("USD")');
    await usdOption.click();
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Get USD price
    const usdPrice = await priceElement.textContent();
    const usdValue = parseFloat(usdPrice?.replace(/[^\d.,]/g, '') || '0');
    
    // USD should be roughly 4x smaller than PLN (assuming 1 USD ≈ 4 PLN)
    // Allow 10% margin for rounding
    expect(usdValue).toBeLessThan(plnValue / 3.5);
    expect(usdValue).toBeGreaterThan(plnValue / 4.5);
  });

  test('should display prices correctly on deal detail page', async ({ page }) => {
    // Click first deal to open detail page
    const dealLink = page.locator('[data-testid="deal-card"] >> a').first();
    await dealLink.click();
    
    // Wait for detail page to load
    await page.waitForLoadState('networkidle');
    
    // Should show price in PLN
    const priceSection = page.locator('[data-testid="price-section"]');
    await expect(priceSection).toBeVisible();
    
    const priceText = await priceSection.textContent();
    expect(priceText).toMatch(/zł|PLN/i);
  });

  test('should display price history chart in user currency', async ({ page }) => {
    // Navigate to deal with price history
    const dealWithHistory = page.locator('[data-testid="deal-card"]:has([data-testid="price-history"])').first();
    const dealLink = dealWithHistory.locator('a').first();
    await dealLink.click();
    
    // Wait for detail page
    await page.waitForLoadState('networkidle');
    
    // Find price history chart
    const chartContainer = page.locator('[data-testid="price-history-chart"]');
    if (await chartContainer.isVisible()) {
      // Check Y-axis label has currency
      const yAxisLabel = page.locator('[data-testid="chart-y-axis"]');
      const labelText = await yAxisLabel.textContent();
      
      expect(labelText).toMatch(/PLN|zł|Cena/i);
    }
  });

  test('should handle missing currency gracefully', async ({ page }) => {
    // Clear localStorage to simulate missing currency
    await page.evaluate(() => {
      localStorage.removeItem('selectedCurrency');
    });
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Should still show prices (fallback to PLN)
    const priceElements = page.locator('[data-testid="deal-price"]');
    await expect(priceElements.first()).toBeVisible();
  });

  test('should update currency when switching tabs', async ({ browser }) => {
    // Create two contexts to simulate two tabs
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both open same page
    await page1.goto('/');
    await page2.goto('/');
    
    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    // Set different currencies in each
    let dropdown1 = page1.locator('[data-testid="currency-dropdown-trigger"]');
    await dropdown1.click();
    await page1.locator('button:has-text("USD")').click();
    
    let dropdown2 = page2.locator('[data-testid="currency-dropdown-trigger"]');
    await dropdown2.click();
    await page2.locator('button:has-text("EUR")').click();
    
    // Currency selections should be independent
    let selector1 = await page1.locator('[data-testid="currency-selector"]').textContent();
    let selector2 = await page2.locator('[data-testid="currency-selector"]').textContent();
    
    expect(selector1).toContain('USD');
    expect(selector2).toContain('EUR');
    
    await context1.close();
    await context2.close();
  });

  test('should format prices with correct decimal places', async ({ page }) => {
    // Get first price
    const priceText = await page.locator('[data-testid="deal-price"]').first().textContent();
    
    // Should have exactly 2 decimal places
    // Match patterns like: "123,45 zł" or "123.45 $"
    expect(priceText).toMatch(/\d+[.,]\d{2}/);
  });

  test('should cache currency rates to avoid excessive API calls', async ({ page }) => {
    // Monitor network requests
    const requests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('api.nbp.pl')) {
        requests.push(request.url());
      }
    });
    
    // Switch currencies multiple times
    for (let i = 0; i < 3; i++) {
      const dropdown = page.locator('[data-testid="currency-dropdown-trigger"]');
      await dropdown.click();
      
      const option = page.locator('button:has-text("USD")');
      await option.click();
      
      await page.waitForTimeout(200);
    }
    
    // Should have made 0-1 API calls (cached after first)
    // Note: If running with Genkit, this might be different
    expect(requests.length).toBeLessThanOrEqual(1);
  });

  test('should all currency options be available', async ({ page }) => {
    const dropdown = page.locator('[data-testid="currency-dropdown-trigger"]');
    await dropdown.click();
    
    // Check all expected currencies are present
    const currencies = ['PLN', 'USD', 'EUR', 'GBP'];
    
    for (const currency of currencies) {
      const option = page.locator(`button:has-text("${currency}")`);
      await expect(option).toBeVisible();
    }
  });
});

test.describe('Currency System Accessibility', () => {
  test('should have accessible currency selector', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const dropdown = page.locator('[data-testid="currency-dropdown-trigger"]');
    
    // Should have proper ARIA attributes
    expect(await dropdown.getAttribute('role')).toBe('button');
    
    // Should have accessible label
    const label = await dropdown.getAttribute('aria-label');
    expect(label).toBeTruthy();
  });

  test('should support keyboard navigation for currency selector', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const dropdown = page.locator('[data-testid="currency-dropdown-trigger"]');
    
    // Focus dropdown
    await dropdown.focus();
    
    // Press Enter to open
    await page.keyboard.press('Enter');
    
    // Should be open
    const menu = page.locator('[data-testid="currency-dropdown-menu"]');
    await expect(menu).toBeVisible();
    
    // Arrow down to next option
    await page.keyboard.press('ArrowDown');
    
    // Press Enter to select
    await page.keyboard.press('Enter');
    
    // Menu should close and currency should change
    await expect(menu).not.toBeVisible();
  });
});
