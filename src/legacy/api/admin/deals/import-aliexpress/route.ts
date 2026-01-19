/**
 * POST /api/admin/deals/import-aliexpress
 * 
 * Import hot deals from AliExpress API
 * - Fetches products with high discount (>= 30%)
 * - Converts to deals with temperature scoring
 * - Auto-links to existing products
 * - Saves to Firestore deals collection
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { fetchHotDealsFromAliexpress, validateDealQuality } from '@/ai/flows/importerFlow/stageDeals';
import { deduplicateProducts } from '@/ai/flows/importerFlow/stageDedupe';
import { translateProducts } from '@/ai/flows/importerFlow/stageTranslate';
import { aiSuggestCategory } from '@/ai/flows/aliexpress/aiSuggestCategory';

export async function POST(req: NextRequest) {
  try {
    // 1. Auth check - must be admin
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized - missing token' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check if user is admin
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 });
    }
    
    // 2. Parse request body
    const body = await req.json();
    const {
      categoryIds = [],
      minDiscount = 30,
      maxDeals = 100,
      sortBy = 'discount',
      autoApprove = false,
      translateToPolish = true,
    } = body;
    
    console.log(`[DealsImport:AliExpress] Starting import...`);
    console.log(`[DealsImport:AliExpress] Params:`, { categoryIds, minDiscount, maxDeals, sortBy, autoApprove });
    
    // 3. Fetch hot deals from AliExpress
    console.log(`[DealsImport:AliExpress] Step 1: Fetching deals from AliExpress...`);
    const deals = await fetchHotDealsFromAliexpress(categoryIds, {
      name: 'deals-fetch',
      batchSize: 10,
      delayBetweenItems: 100,
      delayBetweenBatches: 500,
      maxRetries: 3,
      minDiscount,
      maxDeals,
      sortBy,
      maxItemsPerSubcategory: maxDeals,
    });
    
    if (deals.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No deals found matching criteria',
        imported: 0,
        failed: 0,
      });
    }
    
    console.log(`[DealsImport:AliExpress] ✅ Fetched ${deals.length} deals`);
    
    // 4. Quality validation
    console.log(`[DealsImport:AliExpress] Step 2: Quality validation...`);
    const validDeals = deals.filter(deal => {
      const validation = validateDealQuality(deal);
      if (!validation.valid) {
        console.log(`[DealsImport:AliExpress] ❌ Filtered: ${deal.title.substring(0, 50)} - ${validation.reason}`);
        return false;
      }
      return true;
    });
    
    console.log(`[DealsImport:AliExpress] ✅ ${validDeals.length}/${deals.length} passed quality checks`);
    
    if (validDeals.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No deals passed quality validation',
        imported: 0,
        failed: 0,
      });
    }
    
    // 5. Deduplicate against existing deals
    console.log(`[DealsImport:AliExpress] Step 3: Deduplication...`);
    const dedupedDeals = await deduplicateProducts(validDeals as any, {
      name: 'deals-dedupe',
      batchSize: 20,
      delayBetweenItems: 0,
      delayBetweenBatches: 0,
      maxRetries: 1,
      maxItemsPerSubcategory: validDeals.length,
    });
    
    console.log(`[DealsImport:AliExpress] ✅ ${dedupedDeals.length}/${validDeals.length} are unique`);
    
    if (dedupedDeals.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All deals already exist in database',
        imported: 0,
        failed: 0,
      });
    }
    
    // 6. Translate to Polish (if enabled)
    let translatedDeals = dedupedDeals;
    if (translateToPolish) {
      console.log(`[DealsImport:AliExpress] Step 4: Translation...`);
      translatedDeals = (await translateProducts(dedupedDeals as any, {
        name: 'deals-translate',
        batchSize: 10,
        delayBetweenItems: 200,
        delayBetweenBatches: 1000,
        maxRetries: 3,
        maxItemsPerSubcategory: dedupedDeals.length,
      })) as any;
      console.log(`[DealsImport:AliExpress] ✅ Translated ${translatedDeals.length} deals`);
    }
    
    // 7. AI categorization + save to Firestore
    console.log(`[DealsImport:AliExpress] Step 5: Categorization + Save...`);
    const results: any[] = [];
    const batch = adminDb.batch();
    let batchCount = 0;
    
    for (const deal of translatedDeals) {
      try {
        // AI category suggestion (returns English slugs - keep as-is)
        let mainCategorySlug = 'other';
        let subCategorySlug = undefined;
        let subSubCategorySlug = undefined;
        
        try {
          const categoryResult = await aiSuggestCategory(deal.titlePL || deal.title);
          if (categoryResult && categoryResult.mainCategorySlug) {
            mainCategorySlug = categoryResult.mainCategorySlug;
            subCategorySlug = categoryResult.subCategorySlug;
            subSubCategorySlug = categoryResult.subSubCategorySlug;
          }
        } catch (catErr: any) {
          console.warn(`[DealsImport:AliExpress] Category AI failed for "${deal.title}":`, catErr.message);
        }
        
        // Create deal document
        const dealRef = adminDb.collection('deals').doc();
        const dealData = {
          // Basic info
          title: deal.titlePL || deal.title,
          description: deal.descriptionPL || deal.description || '',
          
          // Pricing
          price: deal.price,
          originalPrice: deal.originalPrice,
          discount: deal.discount,
          dealType: deal.dealType || 'sale',
          
          // Links
          dealUrl: deal.link,
          link: deal.link, // Legacy field
          image: deal.image,
          gallery: deal.images || [deal.image],
          
          // Deal metadata
          temperature: deal.temperature || 0,
          voteCount: 0,
          commentsCount: 0,
          expiryDate: deal.expiryDate,
          
          // Category
          mainCategorySlug,
          subCategorySlug,
          subSubCategorySlug,
          
          // Source
          source: 'aliexpress',
          merchant: deal.merchant || 'AliExpress',
          
          // Engagement metrics
          rating: deal.rating || 0,
          ratingCount: deal.orders || 0,
          
          // Status
          status: autoApprove ? 'approved' : 'pending',
          
          // Metadata
          postedBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        
        batch.set(dealRef, dealData);
        batchCount++;
        
        // Commit batch every 500 writes
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`[DealsImport:AliExpress] ✅ Batch committed (${batchCount} deals)`);
          batchCount = 0;
        }
        
        results.push({
          success: true,
          id: dealRef.id,
          title: dealData.title,
          discount: dealData.discount,
          temperature: dealData.temperature,
        });
        
        console.log(`[DealsImport:AliExpress] ✅ ${dealRef.id}: ${dealData.title.substring(0, 60)}... (${dealData.discount}% OFF, temp: ${dealData.temperature})`);
        
      } catch (err: any) {
        console.error(`[DealsImport:AliExpress] ❌ Failed to save "${deal.title}":`, err.message);
        results.push({
          success: false,
          title: deal.title,
          error: err.message,
        });
      }
    }
    
    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`[DealsImport:AliExpress] ✅ Final batch committed (${batchCount} deals)`);
    }
    
    // 8. Return results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`[DealsImport:AliExpress] ===== IMPORT COMPLETE =====`);
    console.log(`[DealsImport:AliExpress] ✅ Success: ${successCount}`);
    console.log(`[DealsImport:AliExpress] ❌ Failed: ${failureCount}`);
    
    return NextResponse.json({
      success: true,
      message: `Imported ${successCount}/${translatedDeals.length} deals`,
      imported: successCount,
      failed: failureCount,
      results: results.slice(0, 20), // Return first 20 for preview
    });
    
  } catch (error: any) {
    console.error('[DealsImport:AliExpress] ❌ Error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
