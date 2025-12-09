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
        try {
          products = await fetchAllegroProducts(searchKeywords, config.itemsPerCategory);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          importErrors.push({
            item: 'Allegro',
            error: errorMsg,
          });
          logger.warn('Allegro fetch failed', { error: errorMsg });
        }
        break;

      case 'amazon':
        try {
          products = await fetchAmazonProducts(searchKeywords, config.itemsPerCategory);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          importErrors.push({
            item: 'Amazon',
            error: errorMsg,
          });
          logger.warn('Amazon fetch failed', { error: errorMsg });
        }
        break;

      case 'ebay':
        try {
          products = await fetchEbayProducts(searchKeywords, config.itemsPerCategory);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          importErrors.push({
            item: 'eBay',
            error: errorMsg,
          });
          logger.warn('eBay fetch failed', { error: errorMsg });
        }
        break;

      case 'convertiser':
        // TODO: Implement Convertiser API integration
        logger.warn('Convertiser import not yet implemented');
        importErrors.push({
          item: 'Convertiser',
          error: 'Not implemented',
        });
        break;
    }

    // ===== DEDUPLICATE & STORE =====
    let created = 0;
    let skipped = 0;

    // Skip dedup check if no products
    if (products.length > 0) {
      // Batch check for duplicates
      const externalIds = products.map(p => `${config.source}_${p.externalId || p.id}`);
      const existingDocs = await adminDb
        .collection('products')
        .where('externalId', 'in', externalIds.slice(0, 30)) // Firestore IN limit is 30
        .get();
      const existingIds = new Set(existingDocs.docs.map(d => (d.data() as any).externalId));

      // Batch write for performance
      const batch = adminDb.batch();
      let batchCount = 0;
      const MAX_BATCH_SIZE = 500; // Firestore batch write limit

      for (const product of products) {
        try {
          const externalId = `${config.source}_${product.externalId || product.id}`;

          // Check if already exists
          if (existingIds.has(externalId)) {
            skipped++;
            continue;
          }

          // Map to Product schema
          const newProduct = {
            id: uuidv4(),
            name: product.name || product.title,
            description: product.description || '',
            externalId: externalId,
            source: config.source,
            mainCategorySlug: config.mainCategory,
            subCategorySlug: config.subCategory,
            subSubCategorySlug: config.subSubCategory,
            price: product.price || 0,
            currency: product.currency || 'USD',
            affiliateUrl: product.url || '',
            imageUrls: product.images || [],
            status: config.draftStatus,
            rating: product.rating || 0,
            reviewCount: product.reviewCount || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            metadata: {
              source: config.source,
              importedAt: new Date().toISOString(),
              importKeyword: searchKeywords[0],
            },
          };

          // Add to batch
          const docRef = adminDb.collection('products').doc(newProduct.id);
          batch.set(docRef, newProduct);
          batchCount++;
          created++;

          // Commit batch if size reached
          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batchCount = 0;
          }
        } catch (error) {
          importErrors.push({
            item: product.name || product.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Commit remaining batch
      if (batchCount > 0) {
        await batch.commit();
      }
    }

    const durationMs = Date.now() - startTime;
    const result: ImportResult = {
      totalProcessed: products.length,
      created,
      skipped,
      errors: importErrors.length,
      durationMs,
    };

    logger.info('Product import completed', result);

    return NextResponse.json({
      stats: result,
      errors: importErrors.length > 0 ? importErrors : undefined,
    });
  } catch (error) {
    logger.error('Product import error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: 'Failed to import products',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Fetch products from AliExpress API
 * Uses importKeywords from category definition
 * Uses smartMatch method to search for products matching keywords
 */
async function fetchAliExpressProducts(
  keywords: string[],
  limit: number
): Promise<any[]> {
  try {
    const client = getAliExpressClient();
    const allProducts: any[] = [];

    for (const keyword of keywords.slice(0, 3)) {
      // Limit keywords to prevent excessive API calls
      try {
        const results = await client.smartMatch(keyword);

        if (results?.products?.items) {
          allProducts.push(...results.products.items);
        }
      } catch (error) {
        logger.warn('AliExpress search failed for keyword', {
          keyword,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next keyword instead of failing
      }
    }

    // Map to normalized schema
    return allProducts.map(p => ({
      id: p.product_id,
      externalId: `${p.product_id}`,
      name: p.product_title,
      title: p.product_title,
      description: p.product_description || '',
      price: parseFloat(p.sale_price || p.promotion_price || '0'),
      currency: p.currency || 'USD',
      url: p.product_detail_url,
      images: (p.product_image_list || []).map((img: any) => 
        typeof img === 'string' ? img : img.image_url
      ),
      rating: p.star_rating || 0,
      reviewCount: p.review_count || 0,
      source: 'aliexpress',
    })).slice(0, limit);
  } catch (error) {
    logger.error('AliExpress fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Fetch products from Allegro API
 */
async function fetchAllegroProducts(
  keywords: string[],
  limit: number
): Promise<any[]> {
  try {
    const { createAllegroClient } = await import('@/integrations/allegro/client');
    
    const client = createAllegroClient({
      clientId: process.env.ALLEGRO_APP_KEY || '',
      clientSecret: process.env.ALLEGRO_APP_SECRET || '',
      sandbox: process.env.ALLEGRO_SANDBOX === 'true',
    });

    const allProducts: any[] = [];

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const response = await client.searchOffers({
          phrase: keyword,
          limit: Math.min(limit / Math.max(keywords.length, 1), 100),
        });

        if (response?.items?.promoted) {
          allProducts.push(...response.items.promoted);
        }
        if (response?.items?.regular) {
          allProducts.push(...response.items.regular);
        }
      } catch (error) {
        logger.warn('Allegro search failed for keyword', {
          keyword,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Map to normalized schema
    return allProducts.map(item => ({
      id: item.id,
      externalId: `${item.id}`,
      name: item.name,
      title: item.name,
      description: '',
      price: item.sellingMode?.price?.amount || 0,
      currency: item.sellingMode?.price?.currency || 'PLN',
      url: item.webUrl || '',
      images: (item.images || []).map((img: any) => img.url).filter((url: any) => url),
      rating: 0,
      reviewCount: 0,
      source: 'allegro',
    })).slice(0, limit);
  } catch (error) {
    logger.error('Allegro fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Fetch products from Amazon API
 */
async function fetchAmazonProducts(
  keywords: string[],
  limit: number
): Promise<any[]> {
  try {
    const { createAmazonClient } = await import('@/integrations/amazon/client');
    
    const client = createAmazonClient({
      accessKey: process.env.AMAZON_ACCESS_KEY || '',
      secretKey: process.env.AMAZON_SECRET_KEY || '',
      partnerTag: process.env.AMAZON_PARTNER_TAG || '',
      region: 'eu-west-1',
      marketplace: 'www.amazon.pl',
    });

    const allProducts: any[] = [];

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const response = await client.searchProducts({
          keywords: keyword,
          limit: Math.min(limit / Math.max(keywords.length, 1), 100),
        });

        if (response?.products) {
          allProducts.push(...response.products);
        }
      } catch (error) {
        logger.warn('Amazon search failed for keyword', {
          keyword,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Map to normalized schema
    return allProducts.map((product: any) => ({
      id: product.asin,
      externalId: `${product.asin}`,
      name: product.title,
      title: product.title,
      description: product.description || '',
      price: product.price || 0,
      currency: 'PLN',
      url: product.productUrl || '',
      images: product.images || [],
      rating: product.rating || 0,
      reviewCount: product.reviewCount || 0,
      source: 'amazon',
    })).slice(0, limit);
  } catch (error) {
    logger.error('Amazon fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Fetch products from eBay API
 */
async function fetchEbayProducts(
  keywords: string[],
  limit: number
): Promise<any[]> {
  try {
    const { createEbayClient } = await import('@/integrations/ebay/client');
    
    const client = createEbayClient({
      clientId: process.env.EBAY_CLIENT_ID || '',
      clientSecret: process.env.EBAY_CLIENT_SECRET || '',
      sandbox: process.env.EBAY_SANDBOX === 'true',
      marketplaceId: 'EBAY_PL',
    });

    const allProducts: any[] = [];

    for (const keyword of keywords.slice(0, 3)) {
      try {
        const filters: string[] = [];
        filters.push(`priceCurrency:PLN`);

        const response = await client.searchItems({
          q: keyword,
          filter: filters.join('|'),
          limit: Math.min(limit / Math.max(keywords.length, 1), 200),
        });

        if (response?.itemSummaries) {
          allProducts.push(...response.itemSummaries);
        }
      } catch (error) {
        logger.warn('eBay search failed for keyword', {
          keyword,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Map to normalized schema
    return allProducts.map((item: any) => ({
      id: item.itemId,
      externalId: `${item.itemId}`,
      name: item.title,
      title: item.title,
      description: '',
      price: item.price?.value || 0,
      currency: item.price?.currency || 'PLN',
      url: item.itemWebUrl || '',
      images: item.image ? [item.image] : [],
      rating: 0,
      reviewCount: 0,
      source: 'ebay',
    })).slice(0, limit);
  } catch (error) {
    logger.error('eBay fetch failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
