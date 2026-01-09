#!/usr/bin/env node

/**
 * Test script dla fillCategoriesWithProducts
 * Wykonuje request do lokalnego endpointa API aby złapać prawdziwy błąd
 */

const SITE_URL = 'https://okazjeplus.pl';

async function testFillProducts() {
  console.log('[TEST] Starting fillCategoriesWithProducts test...');
  console.log('[TEST] Target URL:', `${SITE_URL}/api/admin/ai/command`);
  
  try {
    const response = await fetch(`${SITE_URL}/api/admin/ai/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: 'wypełnij katalog produktami z AliExpress',
      }),
    });
    
    console.log('[TEST] Response status:', response.status);
    console.log('[TEST] Response headers:', Object.fromEntries(response.headers.entries()));
    
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      console.log('[TEST] Response data:', JSON.stringify(data, null, 2));
      
      if (response.ok) {
        console.log('[TEST] ✅ SUCCESS!');
      } else {
        console.log('[TEST] ❌ ERROR:', data.error || data.result);
        if (data.stack) {
          console.log('[TEST] Stack trace:');
          console.log(data.stack);
        }
      }
    } else {
      const text = await response.text();
      console.log('[TEST] Response text:', text);
    }
    
  } catch (error) {
    console.error('[TEST] Exception:', error.message);
    console.error('[TEST] Stack:', error.stack);
  }
}

testFillProducts();
