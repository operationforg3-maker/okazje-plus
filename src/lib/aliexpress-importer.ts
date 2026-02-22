/**
 * AliExpress Real Data Importer
 * 
 * Handles real AliExpress API calls for seeding and ongoing imports with:
 * - Real API credentials from env/Secret Manager
 * - Deduplication on originalId+source
 * - Auto-approve configuration
 * - Price tracking and currency conversion
 * - Detailed logging to importRuns and import_logs
 */

import { getAliExpressClient } from './integrations/aliexpress-client';
import { adminDb } from './firebase-admin';
import { Product, Deal, ImportRun, ImportItemLog, ImportError, ImportProfile } from './types';
import { sanitizeProductPayload, sanitizeDealPayload } from './sanitizers';
import { logger } from './logger';
import { convertPrice } from './fx';

export interface AliExpressImportConfig {
  profileId: string;
  searchQuery?: string;
  categoryFilter?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  minOrders?: number;
  minDiscount?: number;
  maxItems?: number;
  dryRun?: boolean;
  autoApprove?: boolean;
  enableAI?: boolean;
  triggeredBy?: 'manual' | 'scheduled' | 'cron';
  triggeredByUid?: string;
}

export interface AliExpressImportResult {
  success: boolean;
  importRunId: string;
  stats: {
    fetched: number;
    created: number;
    updated: number;
    skipped: number;
    duplicates: number;
    errors: number;
    autoApproved: number;
    aiEnriched: number;
  };
  errors: ImportError[];
}

/**
 * Check if product/deal already exists (deduplication)
 * 
 * Note: This performs individual Firestore queries per item (N+1 pattern).
 * For large imports (>100 items), consider:
 * - Batch querying all originalIds upfront and caching results
 * - Using Firestore composite index on (source, originalId)
 * - Pre-loading existing IDs into memory for the import session
 * 
 * Current implementation prioritizes simplicity and works well for typical
 * batch sizes (50-100 items). Firestore queries are fast (~50-100ms each).
 */
async function checkDuplicate(
  originalId: string,
  source: string,
  collection: 'products' | 'deals'
): Promise<string | null> {
  try {
    const snapshot = await adminDb
      .collection(collection)
      .where('metadata.originalId', '==', originalId)
      .where('metadata.source', '==', source)
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
    return null;
  } catch (error) {
    logger.error('Duplicate check failed', { error, originalId, source, collection });
    return null;
  }
}

/**
 * Log individual item import action
 */
async function logImportItem(
  importRunId: string,
  log: Omit<ImportItemLog, 'id' | 'importRunId'>
): Promise<void> {
  try {
    await adminDb
      .collection('importRuns')
      .doc(importRunId)
      .collection('import_logs')
      .add({
        ...log,
        importRunId,
      });
  } catch (error) {
    logger.error('Failed to log import item', { error, importRunId });
  }
}

/**
 * Main import function
 */
export async function importFromAliExpress(
  config: AliExpressImportConfig
): Promise<AliExpressImportResult> {
  const startTime = Date.now();
  const result: AliExpressImportResult = {
    success: false,
    importRunId: '',
    stats: {
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      duplicates: 0,
      errors: 0,
      autoApproved: 0,
      aiEnriched: 0,
    },
    errors: [],
  };

  try {
    // Load import profile
    const profileDoc = await adminDb.collection('importProfiles').doc(config.profileId).get();
    if (!profileDoc.exists) {
      throw new Error(`Import profile ${config.profileId} not found`);
    }
    const profile = { id: profileDoc.id, ...profileDoc.data() } as ImportProfile;

    // Create import run record
    const importRun: Omit<ImportRun, 'id'> = {
      profileId: config.profileId,
      vendorId: profile.vendorId || 'aliexpress',
      status: 'running',
      dryRun: config.dryRun || false,
      stats: { fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0, duplicates: 0, autoApproved: 0, aiEnriched: 0 },
      startedAt: new Date().toISOString(),
      triggeredBy: config.triggeredBy || 'manual',
      triggeredByUid: config.triggeredByUid,
      config: {
        maxItems: config.maxItems,
        autoApprove: config.autoApprove,
        enableAI: config.enableAI,
        dryRun: config.dryRun,
      },
      progress: {
        current: 0,
        total: 0,
        phase: 'fetching',
      },
    };

    const importRunRef = await adminDb.collection('importRuns').add(importRun);
    result.importRunId = importRunRef.id;

    logger.info('Starting AliExpress import', {
      importRunId: result.importRunId,
      profileId: config.profileId,
      dryRun: config.dryRun,
    });

    // Initialize AliExpress client
    const client = getAliExpressClient();

    // Set tokens if available
    // In production, these should be loaded from Secret Manager and stored in ImportProfile
    // For now, check environment variables as fallback
    if (process.env.ALIEXPRESS_ACCESS_TOKEN) {
      logger.info('Loading AliExpress tokens from environment');
      client.setTokens(
        process.env.ALIEXPRESS_ACCESS_TOKEN,
        process.env.ALIEXPRESS_REFRESH_TOKEN || '',
        parseInt(process.env.ALIEXPRESS_TOKEN_EXPIRES_IN || '3600')
      );
    } else {
      logger.warn('No AliExpress access token found - API calls may fail without OAuth');
    }

    // Search products
    const searchQuery = config.searchQuery || profile.filters.searchQuery || '';
    logger.info('Searching AliExpress products', { query: searchQuery });

    // Use affiliate hot products API for better quality
    const maxItems = config.maxItems || profile.maxItemsPerRun || 50;
    const searchResponse = await client.getAffiliateHotProducts(
      config.categoryFilter ? [config.categoryFilter] : undefined,
      maxItems
    );

    // Parse response
    // Affiliate API response: { aliexpress_affiliate_hotproduct_query_response: { resp_result: { result: { products: [] } } } }
    // products is a direct array (not XML-style .product wrapper)
    let products: any[] = [];
    const rawResult =
      searchResponse?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result ??
      searchResponse?.resp_result?.result;
    if (Array.isArray(rawResult?.products)) {
      products = rawResult.products;
    }

    result.stats.fetched = products.length;
    logger.info(`Fetched ${products.length} products from AliExpress`);

    // Update progress
    await importRunRef.update({
      'stats.fetched': result.stats.fetched,
      'progress.total': Math.min(products.length, maxItems),
      'progress.phase': 'processing',
    });

    const filterConfig = {
      minPrice: config.minPrice ?? profile.filters?.minPrice,
      maxPrice: config.maxPrice ?? profile.filters?.maxPrice,
      minRating: config.minRating ?? profile.filters?.minRating,
      minOrders: config.minOrders ?? profile.filters?.minOrders,
      minDiscount: config.minDiscount ?? profile.filters?.minDiscount,
    };

    // Apply maxItems slicing to guard against API overfetch
    const productsToProcess = products.slice(0, maxItems);

    // Process each product
    for (let i = 0; i < productsToProcess.length; i++) {
      const rawProduct = productsToProcess[i];
      const originalId = String(rawProduct.product_id || rawProduct.productId || rawProduct.item_id || '');
      
      if (!originalId) {
        result.stats.skipped++;
        result.errors.push({
          code: 'VALIDATION',
          message: 'Missing product ID',
          timestamp: new Date().toISOString(),
          retryable: false,
        });
        continue;
      }

      try {
        // Extract and normalize product data
        const title = rawProduct.product_title || rawProduct.title || rawProduct.item_title || '';
        const price = Number(rawProduct.target_sale_price || rawProduct.sale_price || 0);
        const originalPrice = Number(rawProduct.target_original_price || rawProduct.original_price || null);
        const currency = rawProduct.target_sale_price_currency || 'USD';
        // Convert AliExpress rating (0-100 scale) to standard 0-5 scale
        const rating = rawProduct.evaluate_rate ? parseFloat(rawProduct.evaluate_rate) / 20 : 0;
        const orders = rawProduct.lastest_volume || rawProduct.volume || rawProduct.orders || 0;
        
        // Convert price to PLN using live FX
        const pricePLN = await convertPrice(price, currency, 'PLN');
        const originalPricePLN = originalPrice ? await convertPrice(originalPrice, currency, 'PLN') : undefined;

        // Calculate discount
        const discountPercent = originalPrice && price < originalPrice
          ? Math.round(((originalPrice - price) / originalPrice) * 100)
          : 0;

        // Apply filters early to avoid unnecessary writes
        const filterFailures: string[] = [];
        if (filterConfig.minPrice && pricePLN < filterConfig.minPrice) {
          filterFailures.push(`minPrice:${filterConfig.minPrice}`);
        }
        if (filterConfig.maxPrice && pricePLN > filterConfig.maxPrice) {
          filterFailures.push(`maxPrice:${filterConfig.maxPrice}`);
        }
        if (filterConfig.minRating && rating < filterConfig.minRating) {
          filterFailures.push(`minRating:${filterConfig.minRating}`);
        }
        if (filterConfig.minOrders && orders < filterConfig.minOrders) {
          filterFailures.push(`minOrders:${filterConfig.minOrders}`);
        }
        if (filterConfig.minDiscount && discountPercent < filterConfig.minDiscount) {
          filterFailures.push(`minDiscount:${filterConfig.minDiscount}`);
        }

        if (filterFailures.length > 0) {
          result.stats.skipped++;
          await logImportItem(result.importRunId, {
            originalId,
            action: 'skipped',
            itemType: 'product',
            reason: `Filtered: ${filterFailures.join(',')}`,
            timestamp: new Date().toISOString(),
            metadata: {
              title,
              price: pricePLN,
              category: profile.mapping.targetMainCategory,
            },
          });
          continue;
        }

        // Check for duplicates
        const existingId = await checkDuplicate(originalId, 'aliexpress', 'products');
        if (existingId) {
          result.stats.duplicates++;
          result.stats.skipped++;
          await logImportItem(result.importRunId, {
            originalId,
            action: 'skipped',
            itemType: 'product',
            itemId: existingId,
            reason: 'Duplicate',
            timestamp: new Date().toISOString(),
            metadata: {
              duplicateOf: existingId,
            },
          });
          continue;
        }

        // Extract images
        // product_small_image_urls is string[] per AliExpress Affiliate API types
        const mainImage = rawProduct.product_main_image_url || rawProduct.image_url || '';
        const images: string[] = [mainImage];
        if (Array.isArray(rawProduct.product_small_image_urls)) {
          images.push(...rawProduct.product_small_image_urls.filter((url: string) => url && !images.includes(url)));
        }

        // Build product data
        const productData: Partial<Product> = {
          name: title,
          description: rawProduct.product_description || rawProduct.short_description || title,
          longDescription: rawProduct.product_description || title,
          image: mainImage,
          imageHint: title,
          affiliateUrl: rawProduct.promotion_link || rawProduct.product_detail_url || '',
          price: pricePLN,
          originalPrice: originalPricePLN,
          discountPercent,
          currency: 'PLN',
          ratingCard: {
            average: rating,
            count: orders,
            durability: rating,
            easeOfUse: rating,
            valueForMoney: rating,
            versatility: rating,
          },
          ratingSources: {
            external: {
              average: rating,
              count: orders,
              source: 'aliexpress',
              updatedAt: new Date().toISOString(),
            },
            users: {
              average: 0,
              count: 0,
              updatedAt: new Date().toISOString(),
            },
          },
          mainCategorySlug: profile.mapping.targetMainCategory,
          subCategorySlug: profile.mapping.targetSubCategory,
          subSubCategorySlug: profile.mapping.targetSubSubCategory,
          status: config.autoApprove ? 'approved' : 'draft',
          gallery: images.map((url, idx) => ({
            id: `img_${idx}`,
            type: 'url' as const,
            src: url,
            isPrimary: idx === 0,
            source: 'aliexpress' as const,
            addedAt: new Date().toISOString(),
          })),
          metadata: {
            source: 'aliexpress' as const,
            originalId,
            importedAt: new Date().toISOString(),
            importedBy: config.triggeredByUid || 'system',
            locale: 'pl',
            orders,
            merchant: rawProduct.shop_title || rawProduct.shop_name,
            merchantId: rawProduct.shop_id,
            currencyRate: pricePLN && price ? pricePLN / price : 1.0,
            priceHistory: [
              {
                price: pricePLN,
                currency: 'PLN',
                timestamp: new Date().toISOString(),
                source: 'import' as const,
              },
            ],
            promotionId: rawProduct.promotion_id,
            commissionRate: rawProduct.commission_rate,
            evaluateCount: rawProduct.evaluate_count,
            evaluateRate: rawProduct.evaluate_rate,
            warehouse: rawProduct.ship_from_country || rawProduct.warehouse_location,
            deliveryTime: rawProduct.delivery_time || rawProduct.estimated_delivery_time,
            freeShipping: rawProduct.free_shipping || rawProduct.is_free_shipping || false,
            productVideoUrl: rawProduct.product_video_url,
          },
        };

        // Sanitize and validate
        const sanitized = sanitizeProductPayload(productData);

        if (!config.dryRun) {
          // Create product in Firestore
          const productRef = await adminDb.collection('products').add(sanitized);
          result.stats.created++;
          
          if (config.autoApprove) {
            result.stats.autoApproved++;
          }

          await logImportItem(result.importRunId, {
            originalId,
            action: 'created',
            itemType: 'product',
            itemId: productRef.id,
            timestamp: new Date().toISOString(),
            metadata: {
              title,
              price: pricePLN,
              category: profile.mapping.targetMainCategory,
              autoApproved: config.autoApprove,
              aiEnriched: false, // AI enrichment happens asynchronously
            },
          });

          logger.info('Product imported', {
            productId: productRef.id,
            originalId,
            title: title.substring(0, 50),
          });
        } else {
          result.stats.created++;
          logger.info('Product would be created (dry run)', {
            originalId,
            title: title.substring(0, 50),
          });
        }

        // Update progress
        await importRunRef.update({
          'progress.current': i + 1,
        });

      } catch (error) {
        result.stats.errors++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        result.errors.push({
          code: 'UNKNOWN',
          message: errorMsg,
          itemId: originalId,
          timestamp: new Date().toISOString(),
          retryable: true,
        });

        await logImportItem(result.importRunId, {
          originalId,
          action: 'error',
          itemType: 'product',
          reason: errorMsg,
          timestamp: new Date().toISOString(),
          error: {
            code: 'UNKNOWN',
            message: errorMsg,
            itemId: originalId,
            timestamp: new Date().toISOString(),
            retryable: true,
          },
        });

        logger.error('Product import failed', { error: errorMsg, originalId });
      }
    }

    // Finalize import run
    const durationMs = Date.now() - startTime;
    await importRunRef.update({
      status: 'completed',
      finishedAt: new Date().toISOString(),
      durationMs,
      stats: result.stats,
      'progress.phase': 'completing',
    });

    result.success = true;
    logger.info('AliExpress import completed', {
      importRunId: result.importRunId,
      stats: result.stats,
      durationMs,
    });

    return result;

  } catch (error) {
    logger.error('AliExpress import failed', { error });
    
    // Update import run status
    if (result.importRunId) {
      await adminDb.collection('importRuns').doc(result.importRunId).update({
        status: 'failed',
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        errorSummary: [{
          code: 'UNKNOWN',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }],
      });
    }

    throw error;
  }
}
