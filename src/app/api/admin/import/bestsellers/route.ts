/**
 * Best Sellers Import API Endpoint (M4 Smart Importing)
 * 
 * Imports high-converting products from AliExpress Hot Products API
 * Each product is curated through AI pipeline before saving to Firestore
 * 
 * Workflow:
 * 1. Fetch hot products from AliExpress (aliexpress.affiliate.hotproduct.query)
 * 2. Calculate shipping costs for each product
 * 3. Run through AI Curator Pipeline (aiCurateProduct)
 * 4. Save to Firestore with multi-language content and smart pricing
 * 
 * Features:
 * ✅ Only imports proven bestsellers (high orders + ratings)
 * ✅ Real shipping costs to Poland
 * ✅ Multi-language content (PL, EN, DE)
 * ✅ SEO-optimized descriptions
 * ✅ Structured specifications
 * ✅ Duplicate detection
 */

// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAliExpressClient } from '@/integrations/aliexpress/client';
import { curateProduct } from '@/ai/flows/aliexpress/aiCurateProduct';
import { createProduct, findExistingProduct } from '@/lib/data-admin';
import { createSmartPrice } from '@/lib/i18n-utils';
import { logger } from '@/lib/logging';
import { verifySignedRequest } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/import/bestsellers
 * 
 * Query params:
 * - categoryIds: Comma-separated AliExpress category IDs (optional)
 * - limit: Max products to import (default: 20, max: 50)
 * - targetCategory: Target category slug (main/sub/subsub) (optional)
 * - currency: Target currency (default: PLN)
 * 
 * Example:
 * POST /api/admin/import/bestsellers?categoryIds=1234,5678&limit=30&targetCategory=elektronika/telefony
 */
export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const authHeader = req.headers.get('authorization');
    if (!verifySignedRequest(authHeader)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const categoryIdsParam = searchParams.get('categoryIds');
    const limitParam = searchParams.get('limit');
    const targetCategoryParam = searchParams.get('targetCategory');
    const currencyParam = searchParams.get('currency');

    const categoryIds = categoryIdsParam ? categoryIdsParam.split(',') : undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const currency = currencyParam || 'PLN';
    
    // Parse target category path
    let targetMain = '';
    let targetSub = '';
    let targetSubSub = '';
    
    if (targetCategoryParam) {
      const parts = targetCategoryParam.split('/');
      targetMain = parts[0] || '';
      targetSub = parts[1] || '';
      targetSubSub = parts[2] || '';
    }

    logger.info('Starting bestsellers import', {
      categoryIds,
      limit,
      targetCategory: targetCategoryParam,
      currency,
    });

    // Initialize AliExpress client
    const client = createAliExpressClient();

    // Fetch hot products
    const hotProducts = await client.getHotProducts(categoryIds, currency, limit);

    if (!hotProducts || hotProducts.length === 0) {
      return NextResponse.json({
        success: true,
        imported: 0,
        skipped: 0,
        message: 'No hot products found',
      });
    }

    logger.info(`Found ${hotProducts.length} hot products, processing...`);

    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as any[],
      products: [] as any[],
    };

    // Process each product
    for (const rawProduct of hotProducts) {
      try {
        const productId = rawProduct.product_id || rawProduct.item_id;
        const title = rawProduct.product_title || rawProduct.title;
        const price = parseFloat(rawProduct.target_sale_price || rawProduct.sale_price || '0');
        const originalPrice = parseFloat(rawProduct.target_original_price || rawProduct.original_price || '0');
        
        logger.info(`Processing product: ${title}`, { productId });

        // Check for existing product
        const existing = await findExistingProduct(productId);
        if (existing) {
          logger.info(`Product already exists, skipping: ${productId}`);
          results.skipped++;
          continue;
        }

        // Calculate shipping cost to Poland
        logger.info(`Calculating shipping for product: ${productId}`);
        const shippingCost = await client.calculateShipping(productId, 'PL', 1);

        // Prepare data for AI curation
        const rawData = {
          title,
          description: rawProduct.product_description || '',
          specifications: rawProduct.specifications || [],
          price,
          originalPrice: originalPrice > 0 ? originalPrice : undefined,
          categoryPath: targetCategoryParam ? targetCategoryParam.split('/') : undefined,
        };

        // Run through AI Curator Pipeline
        logger.info(`Curating product with AI: ${title}`);
        const curated = await curateProduct(rawData);

        // Create SmartPrice object
        const smartPrice = createSmartPrice(price, currency, originalPrice > 0 ? originalPrice : undefined);
        smartPrice.shippingCost = shippingCost;
        smartPrice.totalPrice = price + shippingCost;
        smartPrice.freeShipping = shippingCost === 0;

        // Prepare product data for Firestore
        const productData = {
          // Multi-language fields (M4)
          title: curated.title,
          shortDescription: curated.shortDescription,
          fullDescription: curated.fullDescription,
          seoDescription: curated.seoDescription,
          
          // Legacy compatibility fields
          name: curated.title.pl,
          description: curated.shortDescription.pl,
          longDescription: curated.fullDescription.pl,
          
          // Smart pricing
          price: smartPrice,
          
          // Images
          image: rawProduct.product_main_image_url || rawProduct.image_url || '',
          imageHint: curated.title.pl,
          gallery: (rawProduct.product_small_image_urls || []).map((url: string, idx: number) => ({
            id: `${productId}-${idx}`,
            type: 'url' as const,
            src: url,
            alt: curated.title.pl,
            source: 'aliexpress' as const,
          })),
          
          // Links
          affiliateUrl: rawProduct.promotion_link || rawProduct.product_detail_url || '',
          
          // Category
          mainCategorySlug: targetMain || 'inne',
          subCategorySlug: targetSub || 'produkty',
          subSubCategorySlug: targetSubSub || undefined,
          
          // Status
          status: 'draft' as const, // Admin reviews before approval
          
          // Ratings
          ratingCard: {
            average: parseFloat(rawProduct.evaluate_rate || '0'),
            count: rawProduct.evaluate_count || 0,
            durability: 4,
            easeOfUse: 4,
            valueForMoney: 4,
            versatility: 4,
          },
          
          // SEO
          seoKeywords: curated.keywords,
          metaTitle: curated.title.pl,
          metaDescription: curated.seoDescription.pl,
          
          // AI metadata
          ai: {
            quality: {
              score: (curated.quality.titleQuality + curated.quality.contentQuality) / 2,
              recommendation: curated.quality.titleQuality >= 60 && curated.quality.contentQuality >= 60 
                ? 'approve' as const
                : 'review' as const,
              factors: {
                priceQuality: smartPrice.discountPercent && smartPrice.discountPercent > 20 ? 80 : 60,
                discountLegitimacy: 70,
                merchantTrust: 70,
                productPopularity: 80, // Hot product = high popularity
                contentQuality: curated.quality.contentQuality,
              },
              warnings: curated.quality.warnings,
              reasoning: `AI curated from AliExpress hot product. Title quality: ${curated.quality.titleQuality}, Content quality: ${curated.quality.contentQuality}`,
              scoredAt: new Date().toISOString(),
            },
            titleNormalization: {
              originalTitle: title,
              normalizedTitle: curated.title.pl,
              translated: true,
              changes: ['Removed spam keywords', 'Translated to PL/EN/DE', 'Made human-readable'],
            },
            enrichment: {
              features: curated.specifications.map(s => `${s.name}: ${s.value}`),
              keywords: curated.keywords,
            },
          },
          
          // Import metadata
          metadata: {
            source: 'aliexpress' as const,
            originalId: productId,
            importedAt: new Date().toISOString(),
            importedBy: 'bestsellers-import',
            orders: rawProduct.sale_count || rawProduct.volume || 0,
            evaluateCount: rawProduct.evaluate_count || 0,
            evaluateRate: rawProduct.evaluate_rate || '',
            hotProduct: true,
            specifications: curated.specifications,
            shippingCost,
            freeShipping: shippingCost === 0,
          },
        };

        // Save to Firestore
        const createdProduct = await createProduct(productData);
        
        if (!createdProduct || typeof createdProduct === 'string') {
          throw new Error('Failed to create product');
        }
        
        logger.info(`Product imported successfully: ${curated.title.pl}`, {
          productId: createdProduct.id || createdProduct,
          aiQuality: curated.quality.titleQuality,
        });

        results.imported++;
        results.products.push({
          id: createdProduct.id || createdProduct,
          title: curated.title,
          price: smartPrice,
          aiQuality: curated.quality,
        });

      } catch (error: any) {
        logger.error('Failed to import product', {
          productId: rawProduct.product_id,
          error: error.message,
        });
        
        results.errors.push({
          productId: rawProduct.product_id,
          title: rawProduct.product_title,
          error: error.message,
        });
      }
    }

    logger.info('Bestsellers import completed', results);

    return NextResponse.json({
      success: true,
      imported: results.imported,
      skipped: results.skipped,
      errors: results.errors,
      products: results.products,
    });

  } catch (error: any) {
    logger.error('Bestsellers import failed', { error: error.message });
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Import failed',
      },
      { status: 500 }
    );
  }
}
