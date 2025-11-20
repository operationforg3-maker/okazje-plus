import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { AliExpressClient } from '@/integrations/aliexpress/client';
import { aiDealQualityScore } from '@/ai/flows/aliexpress/aiDealQualityScore';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
import { aiSuggestCategory } from '@/ai/flows/aliexpress/aiSuggestCategory';
import { aiGenerateSEODescription } from '@/ai/flows/aliexpress/aiGenerateSEODescription';

/**
 * POST /api/admin/bulk-import/preview
 * 
 * Generates AI-enriched product preview WITHOUT saving to database
 * Used by bulk import wizard to show results before commit
 */

interface CategoryConfig {
  mainSlug: string;
  mainName: string;
  subSlug: string;
  subName: string;
  subSubSlug?: string;
  subSubName?: string;
  searchQuery: string;
  productsCount: number;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // TODO: Re-enable admin check after fixing Firestore Rules for Admin SDK
    // Check admin role
    // const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    // const userData = userDoc.data();
    // if (userData?.role !== 'admin') {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }
    console.log('[Bulk Preview] User:', decodedToken.uid, '- Admin check temporarily disabled');

    const body = await request.json();
    const { configs } = body as { configs: CategoryConfig[] };

    if (!configs || configs.length === 0) {
      return NextResponse.json({ error: 'No configs provided' }, { status: 400 });
    }

    console.log(`[Bulk Preview] Processing ${configs.length} categories for ${decodedToken.email}`);

    // Initialize AliExpress client
    const aliexpressClient = new AliExpressClient(
      {
        appKey: process.env.ALIEXPRESS_APP_KEY || '',
        appSecret: process.env.ALIEXPRESS_APP_SECRET || '',
      },
      'aliexpress',
      'default'
    );

    const allProducts: any[] = [];
    let totalFetched = 0;
    let totalPassed = 0;

    // Process each category
    for (const config of configs) {
      try {
        console.log(`[Bulk Preview] Fetching ${config.productsCount} products for: ${config.searchQuery}`);

        // Fetch products from AliExpress
        const searchResult = await aliexpressClient.searchProducts({
          q: config.searchQuery,
          limit: config.productsCount,
          minPrice: 10, // Filter cheap spam
        });

        totalFetched += searchResult.products?.length || 0;

        if (!searchResult.products || searchResult.products.length === 0) {
          console.log(`[Bulk Preview] No products found for: ${config.searchQuery}`);
          continue;
        }

        // AI enrichment pipeline for each product
        console.log(`[Bulk Preview] Starting AI enrichment for ${searchResult.products.length} products from: ${config.searchQuery}`);
        
        for (const rawProduct of searchResult.products) {
          try {
            // Stage 1: Quality Score
            const qualityResult = await aiDealQualityScore({
              title: rawProduct.title || '',
              description: rawProduct.description || '',
              price: rawProduct.price?.current || 0,
              originalPrice: rawProduct.price?.original,
              discountPercent: rawProduct.discount_percent,
              rating: rawProduct.rating?.score,
              reviewCount: rawProduct.rating?.count,
              salesCount: rawProduct.sales,
              merchantName: rawProduct.merchant?.name || 'Unknown',
            });

            console.log(`[Bulk Preview] Quality score: ${qualityResult.score} for "${rawProduct.title?.slice(0, 40)}..."`);

            // Skip low quality (threshold lowered to 40 for testing)
            if (qualityResult.score < 40) {
              console.log(`[Bulk Preview] ❌ Skipped (score ${qualityResult.score} < 40): ${rawProduct.title?.slice(0, 50)}`);
              continue;
            }
            
            console.log(`[Bulk Preview] ✅ Passed quality check (score ${qualityResult.score})`);

            // Stage 2: Title Normalization
            const titleResult = await aiNormalizeTitlePL({
              title: rawProduct.title || '',
              language: 'en',
            });

            // Stage 3: Category Mapping (use AI suggestion if high confidence)
            const categoryResult = await aiSuggestCategory({
              title: titleResult.normalizedTitle,
              description: rawProduct.description || '',
              aliexpressCategory: rawProduct.category_path?.join(' > '),
              price: rawProduct.price?.current,
            });

            // Use AI category if confidence >= 0.6, otherwise use config category
            const finalCategoryPath = categoryResult.confidence >= 0.6
              ? [
                  categoryResult.mainCategorySlug,
                  categoryResult.subCategorySlug,
                  categoryResult.subSubCategorySlug,
                ].filter(Boolean)
              : [
                  config.mainSlug,
                  config.subSlug,
                  config.subSubSlug,
                ].filter(Boolean);

            // Stage 4: SEO Description
            const seoResult = await aiGenerateSEODescription({
              normalizedTitle: titleResult.normalizedTitle,
              mainCategorySlug: finalCategoryPath[0] || config.mainSlug,
              subCategorySlug: finalCategoryPath[1] || config.subSlug,
              subSubCategorySlug: finalCategoryPath[2],
              price: rawProduct.price?.current,
              rating: rawProduct.rating?.score,
              reviewCount: rawProduct.rating?.count,
            });

            console.log(`[Bulk Preview] 📦 Adding product to results: ${titleResult.normalizedTitle.slice(0, 60)}`);

            // Build preview product object
            allProducts.push({
              id: `preview-${rawProduct.item_id}-${Date.now()}`,
              sourceId: rawProduct.item_id,
              title: rawProduct.title,
              normalizedTitle: titleResult.normalizedTitle,
              price: rawProduct.price?.current || 0,
              image: rawProduct.image_urls?.[0] || '/placeholder.png',
              categoryPath: finalCategoryPath.map((slug, idx) => {
                if (idx === 0) return config.mainName;
                if (idx === 1) return config.subName;
                if (idx === 2) return config.subSubName;
                return slug;
              }),
              aiQuality: {
                score: qualityResult.score,
                recommendation: qualityResult.recommendation,
                reasoning: qualityResult.reasoning,
              },
              seoDescription: seoResult.description,
              // Store full AI metadata for commit phase
              _aiMetadata: {
                quality: qualityResult,
                titleNormalization: titleResult,
                categoryMapping: categoryResult,
                seo: seoResult,
              },
              // Store raw product for commit
              _rawProduct: rawProduct,
              _finalCategory: {
                mainSlug: finalCategoryPath[0],
                subSlug: finalCategoryPath[1],
                subSubSlug: finalCategoryPath[2],
              },
            });

            totalPassed++;
            console.log(`[Bulk Preview] ✅ Total products passed so far: ${totalPassed}`);
          } catch (productError) {
            console.error(`[Bulk Preview] Error processing product:`, productError);
            // Continue with next product
          }
        }
      } catch (categoryError) {
        console.error(`[Bulk Preview] Error processing category ${config.searchQuery}:`, categoryError);
        // Continue with next category
      }
    }

    console.log(`[Bulk Preview] Complete: ${totalPassed}/${totalFetched} products passed quality filter`);

    return NextResponse.json({
      ok: true,
      products: allProducts,
      stats: {
        totalFetched,
        totalPassed,
        categoriesProcessed: configs.length,
      },
    });
  } catch (error) {
    console.error('[Bulk Preview Error]', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
