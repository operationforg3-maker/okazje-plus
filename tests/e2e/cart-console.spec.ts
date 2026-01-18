import { test, expect } from '@playwright/test';

// Captures browser console and page errors during full cart user journey:
// 1. Homepage → 2. Add item to cart → 3. Open navbar dropdown → 4. Navigate to /pl/cart
// Prints them to stdout so we can inspect in CI/dev output

test('capture console on full cart journey', async ({ page }) => {
  test.setTimeout(60000); // Increase timeout to 60s
  
  const consoleMessages: Array<{ type: string; text: string; url: string }> = [];
  const pageErrors: Array<{ message: string; url: string }> = [];

  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    const url = page.url();
    consoleMessages.push({ type, text, url });
  });

  page.on('pageerror', (error) => {
    pageErrors.push({ 
      message: error.message || String(error),
      url: page.url()
    });
  });

  console.log('\n=== STARTING CART JOURNEY TEST ===\n');

  // Step 1: Navigate to homepage
  console.log('Step 1: Navigating to /pl homepage...');
  await page.goto('/pl', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);

  // Step 2: Find and click "Add to cart" button on first available product
  console.log('Step 2: Looking for product card with "Add to cart" button...');
  
  // Try multiple selectors for add-to-cart buttons
  const addToCartSelectors = [
    'button:has-text("Do koszyka")',
    'button:has-text("Dodaj do koszyka")',
    'button[title*="koszyk"]',
    'button[title*="cart"]'
  ];

  let addedToCart = false;
  for (const selector of addToCartSelectors) {
    const buttons = await page.locator(selector).all();
    if (buttons.length > 0) {
      console.log(`Found ${buttons.length} cart buttons with selector: ${selector}`);
      // Try first enabled button
      for (const btn of buttons.slice(0, 3)) {
        const isDisabled = await btn.isDisabled().catch(() => true);
        if (!isDisabled) {
          console.log('Clicking add-to-cart button...');
          await btn.click();
          addedToCart = true;
          await page.waitForTimeout(1500); // Wait for cart update
          break;
        }
      }
      if (addedToCart) break;
    }
  }

  if (!addedToCart) {
    console.log('WARNING: Could not find enabled add-to-cart button, continuing to cart page...');
  }

  // Step 3: Click cart icon in navbar to open dropdown
  console.log('Step 3: Opening cart dropdown from navbar...');
  
  // Use data-testid for reliable selection
  const cartButton = page.locator('[data-testid="cart-button"]');
  
  console.log('Clicking cart button...');
  await cartButton.click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  
  // Verify dropdown is visible
  const dropdownVisible = await page.locator('div:has-text("Twoje zakupy")').isVisible().catch(() => false);
  console.log(`Cart dropdown visible: ${dropdownVisible}`);

  if (!dropdownVisible) {
    console.log('WARNING: Dropdown not visible after click, navigating directly to /pl/cart');
    await page.goto('/pl/cart', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  } else {
    // Step 4: Click "Przejdź do koszyka" link in dropdown
    console.log('Step 4: Clicking "Przejdź do koszyka" link...');
    const cartLink = page.locator('a:has-text("Przejdź do koszyka")').first();
    await cartLink.click();
    await page.waitForURL('**/pl/cart', { timeout: 5000 });
    await page.waitForTimeout(1500);
  }

  // Step 5: Verify we're on cart page
  console.log('Step 5: Verifying cart page loaded...');
  await page.waitForLoadState('domcontentloaded');
  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);
  
  // More flexible check - just verify we're on /cart or page has cart-related content
  const isCartPage = currentUrl.includes('/cart');
  const hasCartContent = await page.locator('h1, h2, h3').filter({ hasText: /koszyk|cart/i }).count() > 0;
  expect(isCartPage || hasCartContent).toBeTruthy();

  // Print all captured logs grouped by page
  console.log('\n=== CONSOLE MESSAGES BY PAGE ===');
  const messagesByUrl: Record<string, typeof consoleMessages> = {};
  for (const entry of consoleMessages) {
    if (!messagesByUrl[entry.url]) {
      messagesByUrl[entry.url] = [];
    }
    messagesByUrl[entry.url].push(entry);
  }
  
  for (const [url, messages] of Object.entries(messagesByUrl)) {
    console.log(`\n--- ${url} ---`);
    for (const msg of messages) {
      console.log(`[${msg.type}] ${msg.text}`);
    }
  }

  console.log('\n=== PAGE ERRORS ===');
  if (pageErrors.length === 0) {
    console.log('No page errors detected ✓');
  } else {
    for (const err of pageErrors) {
      console.log(`[pageerror @ ${err.url}] ${err.message}`);
    }
  }

  console.log('\n=== TEST COMPLETE ===\n');
});
