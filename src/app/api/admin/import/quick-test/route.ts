/**
 * QUICK TEST ENDPOINT - Diagnostyka importu w < 5 sekund
 * POST /api/admin/import/quick-test
 * 
 * Testuje TYLKO stage 1 (fetch) - najczęstszy problem
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  console.log('[QUICK TEST] ===== START =====');
  
  try {
    // Auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    try {
      await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { keyword = 'smartphone', importerType = 'aliexpress' } = await req.json();

    console.log(`[QUICK TEST] Testing ${importerType} with keyword: "${keyword}"`);

    // TEST: Import fetch functions directly
    let products: any[] = [];
    let method = '';

    if (importerType === 'aliexpress') {
      console.log('[QUICK TEST] Loading AliExpress client...');
      try {
        const { getAliExpressClient } = await import('@/lib/integrations/aliexpress-client');
        const client = getAliExpressClient();
        console.log('[QUICK TEST] ✅ Client loaded');

        console.log(`[QUICK TEST] Calling smartMatch("${keyword}")...`);
        const result = await client.smartMatch(keyword);
        products = result?.products?.items || [];
        method = 'direct-client';
        
        console.log(`[QUICK TEST] ✅ Got ${products.length} products via direct client`);
      } catch (error: any) {
        console.error('[QUICK TEST] Direct client failed:', error.message);
        console.log('[QUICK TEST] Trying HTTP API fallback...');

        try {
          const response = await fetch('https://okazjeplus.pl/api/admin/aliexpress/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: keyword, limit: 5 }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
          }

          const data = await response.json();
          products = data.products || [];
          method = 'http-api';
          
          console.log(`[QUICK TEST] ✅ Got ${products.length} products via HTTP API`);
        } catch (httpError: any) {
          console.error('[QUICK TEST] HTTP API also failed:', httpError.message);
          method = 'failed';
        }
      }
    } else if (importerType === 'convertiser') {
      console.log('[QUICK TEST] Loading Convertiser client...');
      try {
        const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
        const client = getConvertiserClient();
        console.log('[QUICK TEST] ✅ Client loaded');

        console.log(`[QUICK TEST] Calling searchProductsV2("${keyword}")...`);
        const result = await client.searchProductsV2(keyword, { page: 1, page_size: 5 });
        products = result?.results || [];
        method = 'direct-client';
        
        console.log(`[QUICK TEST] ✅ Got ${products.length} products via direct client`);
      } catch (error: any) {
        console.error('[QUICK TEST] Direct client failed:', error.message);
        method = 'failed';
      }
    }

    console.log('[QUICK TEST] ===== RESULTS =====');
    console.log(`[QUICK TEST] Method: ${method}`);
    console.log(`[QUICK TEST] Products found: ${products.length}`);

    if (products.length > 0) {
      console.log('[QUICK TEST] Sample products:');
      products.slice(0, 2).forEach((p, i) => {
        console.log(`  ${i + 1}. ${(p.product_title || p.name || 'N/A').slice(0, 50)}`);
        console.log(`     Price: ${p.sale_price || p.price || p.priceNum || 'N/A'}`);
      });
    }

    return NextResponse.json({
      success: products.length > 0,
      method,
      productsFound: products.length,
      keyword,
      importerType,
      samples: products.slice(0, 2).map((p: any) => ({
        id: p.product_id || p.id,
        title: (p.product_title || p.name || 'N/A').slice(0, 60),
        price: p.sale_price || p.price || p.priceNum || 'N/A',
        rating: p.evaluation_rate || p.rating || 'N/A',
      })),
      message: products.length > 0 
        ? `✅ SUCCESS: Found ${products.length} products via ${method}`
        : `❌ FAILED: No products found (check env vars and API config)`,
    });
  } catch (error: any) {
    console.error('[QUICK TEST] Fatal error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
      message: '❌ CRITICAL ERROR - check server logs',
    }, { status: 500 });
  }
}
