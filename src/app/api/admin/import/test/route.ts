import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * SIMPLE TEST ENDPOINT - debug import pipeline
 * POST /api/admin/import/test
 * Body: { keyword: 'smartphone', maxProducts: 5 }
 * 
 * Returns: { fetched: [...], saved: [...], errors: [...] }
 */
export async function POST(req: NextRequest) {
  console.log('[TEST IMPORT] ===== START =====');
  
  try {
    // Auth check
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

    const { keyword = 'smartphone', maxProducts = 5 } = await req.json();
    console.log(`[TEST IMPORT] Fetching "${keyword}" (max ${maxProducts})`);

    // STEP 1: Fetch from AliExpress
    console.log(`[TEST IMPORT] Step 1: Fetching from AliExpress...`);
    const fetchResponse = await fetch('https://okazjeplus.pl/api/admin/aliexpress/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: keyword, limit: maxProducts }),
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error(`[TEST IMPORT] Fetch failed: ${fetchResponse.status} - ${errorText.slice(0, 200)}`);
      return NextResponse.json({
        error: `Fetch failed: ${fetchResponse.status}`,
        details: errorText.slice(0, 500),
        success: false,
      }, { status: fetchResponse.status });
    }

    const fetchData = await fetchResponse.json();
    const products = fetchData.products || [];
    console.log(`[TEST IMPORT] ✅ Fetched ${products.length} products`);
    console.log(`[TEST IMPORT] Products:`, products.slice(0, 2).map((p: any) => ({ 
      id: p.id, 
      title: p.title?.slice(0, 50) 
    })));

    if (products.length === 0) {
      console.error(`[TEST IMPORT] ❌ NO PRODUCTS RETURNED! Possible reasons:`);
      console.error(`  1. AliExpress API not configured`);
      console.error(`  2. Keyword "${keyword}" has no results`);
      console.error(`  3. API rate limiting`);
      
      return NextResponse.json({
        fetched: [],
        saved: [],
        errors: [`No products found for keyword: ${keyword}`],
        success: false,
      });
    }

    // STEP 2: Save to Firestore (minimal)
    console.log(`[TEST IMPORT] Step 2: Saving to Firestore...`);
    const saved: string[] = [];
    const errors: string[] = [];

    for (const product of products.slice(0, maxProducts)) {
      try {
        const docId = `ali_${product.id}`;
        const cleanProduct = {
          id: docId,
          source: 'aliexpress',
          sourceId: product.id,
          title: product.title || 'Untitled',
          description: product.description || '',
          price: product.price || 0,
          currency: 'USD',
          image: product.image || '',
          link: product.link || '',
          rating: product.rating || 0,
          orders: product.orders || 0,
          shop: product.shop || {},
          importedAt: new Date().toISOString(),
          status: 'approved',
          mainCategorySlug: 'elektronika',
          subCategorySlug: 'telefony',
          subSubCategorySlug: 'smartfony',
        };

        await adminDb.collection('products').doc(docId).set(cleanProduct);
        saved.push(docId);
        console.log(`[TEST IMPORT] ✅ Saved: ${docId}`);
      } catch (e: any) {
        const msg = e.message || String(e);
        errors.push(msg);
        console.error(`[TEST IMPORT] ❌ Save error:`, msg);
      }
    }

    console.log(`[TEST IMPORT] ===== COMPLETE =====`);
    console.log(`[TEST IMPORT] Fetched: ${products.length}, Saved: ${saved.length}, Errors: ${errors.length}`);

    return NextResponse.json({
      success: saved.length > 0,
      fetched: products.slice(0, maxProducts),
      saved,
      errors,
      summary: {
        fetched: products.length,
        saved: saved.length,
        failed: errors.length,
      },
    }, { status: 200 });

  } catch (error: any) {
    console.error(`[TEST IMPORT] Fatal error:`, error.message);
    return NextResponse.json({
      error: error.message,
      success: false,
    }, { status: 500 });
  }
}
