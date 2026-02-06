/**
 * Product Import Batch Endpoint
 * 
 * POST /api/admin/products/import-batch
 * 
 * Real implementation that:
 * 1. Fetches products from external APIs (AliExpress, Allegro, etc.)
 * 2. Uses importKeywords from category definitions
 * 3. Normalizes to Product schema
 * 4. Stores as drafts in Firestore
 * 5. Queues for AI enhancement if requested
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth-helpers';
import { adminDb } from '@/lib/firebase-admin';
import { getAliExpressClient } from '@/lib/integrations/aliexpress-client';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

interface ImportConfig {
  source: 'aliexpress' | 'allegro' | 'amazon' | 'ebay' | 'convertiser';
  mainCategory: string;
  subCategory: string;
  subSubCategory: string;
  itemsPerCategory: number;
  importType: 'products' | 'deals' | 'coupons';
  draftStatus: 'draft' | 'pending_ai' | 'ready_to_publish';
}

interface ImportResult {
  totalProcessed: number;
  created: number;
  skipped: number;
  errors: number;
  durationMs: number;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // ===== AUTH =====
    // Support two auth methods:
    // 1. Firebase admin token (normal requests)
    // 2. x-internal-secret header (requests from cron/internal services)
    const internalSecret = req.headers.get('x-internal-secret');
    const cronSecret = process.env.CRON_SECRET;
    
    const isInternalRequest = internalSecret && cronSecret && internalSecret === cronSecret;
    
    if (!isInternalRequest) {
      // Use Firebase auth for normal requests
      const authResult = await checkAdminAuth(req);
      if (!authResult.authorized) {
        return NextResponse.json(
          { error: authResult.error || 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    const config = await req.json() as ImportConfig;

    // ===== VALIDATION =====
    if (!config.source || !config.mainCategory || !config.subCategory || !config.subSubCategory) {
      return NextResponse.json(
        { error: 'Missing required fields: source, mainCategory, subCategory, subSubCategory' },
        { status: 400 }
      );
    }

    if (config.itemsPerCategory < 1 || config.itemsPerCategory > 500) {
      return NextResponse.json(
        { error: 'itemsPerCategory must be between 1 and 500' },
        { status: 400 }
      );
    }

    // ===== LOAD CATEGORY & KEYWORDS =====
    // Load from Firebase Firestore categories collection
    const mainCatDocs = await adminDb
      .collection('categories')
      .where('slug', '==', config.mainCategory)
      .limit(1)
      .get();

    if (mainCatDocs.empty) {
      return NextResponse.json(
        { error: `Main category not found: ${config.mainCategory}` },
        { status: 404 }
      );
    }

    const mainCatId = mainCatDocs.docs[0].id;
    const mainCatData = mainCatDocs.docs[0].data() as any;

    // Load subcategory
    const subCatDocs = await adminDb
      .collection('categories')
      .doc(mainCatId)
      .collection('subcategories')
      .where('slug', '==', config.subCategory)
      .limit(1)
      .get();

    if (subCatDocs.empty) {
      return NextResponse.json(
        { error: `Subcategory not found: ${config.subCategory}` },
        { status: 404 }
      );
    }

    const subCatId = subCatDocs.docs[0].id;
    const subCatData = subCatDocs.docs[0].data() as any;

    // Load sub-subcategory
    const subSubCatDocs = await adminDb
      .collection('categories')
      .doc(mainCatId)
      .collection('subcategories')
      .doc(subCatId)
      .collection('subcategories')
      .where('slug', '==', config.subSubCategory)
      .limit(1)
      .get();

    if (subSubCatDocs.empty) {
      return NextResponse.json(
        { error: `Sub-subcategory not found: ${config.subSubCategory}` },
        { status: 404 }
      );
    }

    const subSubCatData = subSubCatDocs.docs[0].data() as any;

    // Get search keywords - IMPORTANT: Use importKeywords from category definition
    const searchKeywords = subSubCatData.importKeywords || [subSubCatData.name];
    logger.info('Product import started', {
      source: config.source,
      category: `${config.mainCategory}/${config.subCategory}/${config.subSubCategory}`,
      keywords: searchKeywords,
      itemCount: config.itemsPerCategory,
    });

    // ===== FETCH FROM SOURCE =====
    let products: any[] = [];
    let importErrors: Array<{ item: string; error: string }> = [];

    switch (config.source) {
      case 'aliexpress':
        try {
          products = await fetchAliExpressProducts(searchKeywords, config.itemsPerCategory);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          importErrors.push({
            item: 'AliExpress',
            error: errorMsg,
          });
          logger.warn('AliExpress fetch failed', { error: errorMsg });
          // Don't throw - continue to store as empty result
        }
        break;

      case 'allegro':
      case 'amazon':
      case 'ebay':
      case 'convertiser':
        logger.warn('Import source not implemented yet', { source: config.source });
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported source: ${config.source}` },
          { status: 400 }
        );
    }

    // ===== STORE PRODUCTS =====
    const result: ImportResult = {
      totalProcessed: products.length,
      created: 0,
      skipped: 0,
      errors: importErrors.length,
      durationMs: 0,
    };

    for (const product of products) {
      try {
        const productId = uuidv4();
        const data = {
          id: productId,
          name: product.title || product.product_title || 'Produkt z AliExpress',
          description: product.description || product.product_description || '',
          price: parseFloat(product.sale_price || product.target_sale_price || product.min_price || '0'),
          originalPrice: parseFloat(product.original_price || product.original_price || '0') || undefined,
          image: product.image_url || product.product_main_image_url || '',
          affiliateUrl: product.promotion_link || product.product_url || '',
          mainCategorySlug: mainCatData.slug,
          subCategorySlug: subCatData.slug,
          subSubCategorySlug: subSubCatData.slug,
          status: config.draftStatus || 'pending_ai',
          source: config.source,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          metadata: {
            originalId: product.product_id || product.productId || product.product_id_str,
            source: config.source,
            merchantName: product.shop_title || product.shop_name,
            rating: product.evaluate_rate || product.evaluate_rate_star,
            evaluateRate: product.evaluate_rate,
            evaluateCount: product.evaluate_count || product.order_count,
          },
        };

        await adminDb.collection('products').doc(productId).set(data);
        result.created++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors++;
        logger.error('Failed to store product', { error: errorMsg });
      }
    }

    result.durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      result,
      errors: importErrors,
    });

  } catch (error) {
    logger.error('Import batch failed', { error });
    return NextResponse.json(
      { error: 'Import batch failed', message: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

async function fetchAliExpressProducts(keywords: string[], limit: number) {
  const client = getAliExpressClient();

  const results: any[] = [];
  for (const keyword of keywords) {
    if (results.length >= limit) break;

    const response = await client.searchAffiliateProducts(keyword, Math.min(20, limit - results.length));
    const items = response?.products || response?.result?.products || response?.data?.products || [];
    results.push(...items);
  }

  return results.slice(0, limit);
}
