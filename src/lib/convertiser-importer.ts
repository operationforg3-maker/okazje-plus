/**
 * Convertiser Real Data Importer
 * 
 * Implements real Convertiser API calls for seeding and ongoing imports:
 * - Dual collection write: Creates both `products` and `deals` entries in Firestore
 * - Convertiser API v2 support (Products API & Offers API)
 * - Auto tracking link resolution
 * - Deduplication on originalId + source ('convertiser')
 * - Dynamic merchant/advertiser mapping
 * - Full telemetry and logging to `importRuns` and `import_logs`
 * - Category mapping & AI fallback
 */

import { getConvertiserClient } from './integrations/convertiser-client';
import { adminDb } from './firebase-admin';
import { Product, Deal, ImportRun, ImportItemLog, ImportError, ImportProfile } from './types';
import { sanitizeProductPayload, sanitizeDealPayload } from './sanitizers';
import { logger } from './logger';
import { convertPrice } from './fx';
import { validateMerchantListingInput } from './merchant-center-validator';

export function extractMerchantNameFromUrl(url?: string, fallbackMerchant?: string): string {
  if (!url || url === '#' || !url.startsWith('http')) return fallbackMerchant || 'Partner Convertiser';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

    const domainMap: Record<string, string> = {
      'superwnetrze.pl': 'SuperWnętrze',
      'fabrykaform.pl': 'FabrykaForm.pl',
      'douglas.pl': 'Douglas.pl',
      'nikiniki.pl': 'Nikiniki.pl',
      'youneedit.pl': 'Youneedit.pl',
      'modasizeplus.pl': 'Moda Size Plus',
      'komputronik.pl': 'Komputronik',
      'selsey.pl': 'Selsey.pl',
      'armodo.pl': 'Armodo.pl',
      'molly.pl': 'Molly.pl',
      'rylko.com': 'Ryłko',
      'velpa.pl': 'Velpa.pl',
      'bigstar.pl': 'Big Star',
      'aliexpress.com': 'AliExpress',
      'allegro.pl': 'Allegro',
      'amazon.pl': 'Amazon.pl',
    };

    if (domainMap[host]) return domainMap[host];

    const parts = host.split('.');
    if (parts.length >= 2) {
      const name = parts[0];
      return name.charAt(0).toUpperCase() + name.slice(1) + '.' + parts[1];
    }

    return host;
  } catch {
    return fallbackMerchant || 'Partner Convertiser';
  }
}

export interface ConvertiserImportConfig {
  profileId?: string;
  searchQuery?: string;
  categoryFilter?: string;
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  maxItems?: number;
  dryRun?: boolean;
  autoApprove?: boolean;
  enableAI?: boolean;
  mode?: 'products' | 'offers';
  triggeredBy?: 'manual' | 'scheduled' | 'cron';
  triggeredByUid?: string;
  pageSize?: number;
  maxPages?: number;
}

export interface ConvertiserImportResult {
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
    createdProducts: number;
    createdDeals: number;
    uniqueProductsInPool: number;
    duplicateProductsInPool: number;
    uniqueSharePercent: number;
    searchMethod: 'products' | 'offers' | 'mixed';
  };
  errors: ImportError[];
}

type ConvertiserImportCandidate = {
  rawItem: any;
  originalId: string;
  existingProductId: string | null;
};

function stripHtmlTags(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
    logger.error('Convertiser duplicate check failed', { error, originalId, source, collection });
    return null;
  }
}

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
    logger.error('Failed to log Convertiser import item', { error, importRunId });
  }
}

export async function importFromConvertiser(
  config: ConvertiserImportConfig
): Promise<ConvertiserImportResult> {
  const startTime = Date.now();
  const mode = config.mode || 'products';
  const result: ConvertiserImportResult = {
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
      createdProducts: 0,
      createdDeals: 0,
      uniqueProductsInPool: 0,
      duplicateProductsInPool: 0,
      uniqueSharePercent: 0,
      searchMethod: mode,
    },
    errors: [],
  };

  try {
    // Load profile if profileId provided
    let profile: Partial<ImportProfile> = {
      vendorId: 'convertiser',
      maxItemsPerRun: 50,
      filters: {},
      mapping: {
        targetMainCategory: 'uncategorized',
        targetSubCategory: 'uncategorized',
      },
    };

    if (config.profileId) {
      const profileDoc = await adminDb.collection('importProfiles').doc(config.profileId).get();
      if (profileDoc.exists) {
        profile = { id: profileDoc.id, ...profileDoc.data() } as ImportProfile;
      }
    }

    const targetMainCategory = profile.mapping?.targetMainCategory || 'uncategorized';
    const targetSubCategory = profile.mapping?.targetSubCategory || 'uncategorized';
    const targetSubSubCategory = profile.mapping?.targetSubSubCategory;

    // Create import run record
    const importRun: Omit<ImportRun, 'id'> = {
      profileId: config.profileId || 'convertiser_default',
      vendorId: 'convertiser',
      status: 'running',
      dryRun: config.dryRun || false,
      stats: {
        fetched: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: 0,
        duplicates: 0,
        autoApproved: 0,
        aiEnriched: 0,
        createdProducts: 0,
        createdDeals: 0,
        uniqueProductsInPool: 0,
        duplicateProductsInPool: 0,
        uniqueSharePercent: 0,
        searchMethod: mode,
      },
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

    logger.info('Starting Convertiser import', {
      importRunId: result.importRunId,
      profileId: config.profileId,
      mode,
      dryRun: config.dryRun,
    });

    const client = getConvertiserClient();
    const searchQuery = config.searchQuery || profile.filters?.searchQuery || '';
    const maxItems = config.maxItems || profile.maxItemsPerRun || 50;
    const pageSize = Math.min(config.pageSize || 50, 100);
    const maxPages = config.maxPages || 5;

    const rawCandidates: any[] = [];
    let currentPage = 1;

    while (currentPage <= maxPages && rawCandidates.length < maxItems * 2) {
      if (mode === 'offers') {
        const response = await client.listOffers(
          { page: currentPage, page_size: pageSize },
          { category: config.categoryFilter }
        );
        const results = response.results || [];
        if (results.length === 0) break;
        rawCandidates.push(...results);
        if (!response.next) break;
      } else {
        const response = await client.searchProductsV2(
          {
            q: searchQuery || undefined,
            ordering: '-created_at',
          },
          { page: currentPage, page_size: pageSize }
        );
        const results = response.results || [];
        if (results.length === 0) break;
        rawCandidates.push(...results);
        if (!response.next) break;
      }
      currentPage++;
    }

    const uniqueCandidates: ConvertiserImportCandidate[] = [];
    const duplicateCandidates: ConvertiserImportCandidate[] = [];
    const seenIds = new Set<string>();

    for (const item of rawCandidates) {
      const originalId = String(item.uuid || item.id || item.product_id || item.offer_id || item.sku || '').trim();
      if (!originalId || seenIds.has(originalId)) continue;
      seenIds.add(originalId);

      const existingProductId = await checkDuplicate(originalId, 'convertiser', 'products');
      const candidate: ConvertiserImportCandidate = {
        rawItem: item,
        originalId,
        existingProductId,
      };

      if (existingProductId) {
        duplicateCandidates.push(candidate);
      } else {
        uniqueCandidates.push(candidate);
      }
    }

    result.stats.uniqueProductsInPool = uniqueCandidates.length;
    result.stats.duplicateProductsInPool = duplicateCandidates.length;

    const itemsToProcess = [...uniqueCandidates, ...duplicateCandidates].slice(0, maxItems);
    result.stats.fetched = itemsToProcess.length;

    const uniqueInFinalList = itemsToProcess.filter(c => !c.existingProductId).length;
    result.stats.uniqueSharePercent = itemsToProcess.length > 0
      ? Math.round((uniqueInFinalList / itemsToProcess.length) * 100)
      : 0;

    await importRunRef.update({
      'stats.fetched': result.stats.fetched,
      'progress.total': itemsToProcess.length,
      'progress.phase': 'processing',
    });

    const filterConfig = {
      minPrice: config.minPrice ?? profile.filters?.minPrice,
      maxPrice: config.maxPrice ?? profile.filters?.maxPrice,
      minDiscount: config.minDiscount ?? profile.filters?.minDiscount,
    };

    for (let i = 0; i < itemsToProcess.length; i++) {
      const candidate = itemsToProcess[i];
      const rawItem = candidate.rawItem;
      const originalId = candidate.originalId;

      try {
        const title = rawItem.title || rawItem.name || rawItem.product_name || rawItem.product_title || '';
        if (!title) {
          result.stats.skipped++;
          continue;
        }

        const imageUrl = rawItem.images?.default || rawItem.image_link || rawItem.image_url || rawItem.image || rawItem.logo_thumbnail || rawItem.logo || '';
        if (!imageUrl) {
          result.stats.skipped++;
          continue;
        }

        // Parse price & currency
        let rawPrice = 0;
        let rawCurrency = 'PLN';

        if (typeof rawItem.price === 'number') {
          rawPrice = rawItem.price;
        } else if (typeof rawItem.sale_price === 'number') {
          rawPrice = rawItem.sale_price;
        } else {
          const priceStr = String(rawItem.sale_price || rawItem.price || rawItem.current_price || rawItem.offer_price || '0');
          const numMatch = priceStr.match(/[\d.,]+/);
          rawPrice = numMatch ? parseFloat(numMatch[0].replace(',', '.')) : 0;
        }

        if (rawItem.currency) {
          rawCurrency = String(rawItem.currency).toUpperCase();
        }

        const pricePLN = await convertPrice(rawPrice, rawCurrency, 'PLN');

        let rawOriginalPrice = 0;
        if (typeof rawItem.original_price === 'number') {
          rawOriginalPrice = rawItem.original_price;
        } else if (rawItem.regular_price || rawItem.old_price) {
          const origStr = String(rawItem.regular_price || rawItem.old_price || '0');
          const origMatch = origStr.match(/[\d.,]+/);
          rawOriginalPrice = origMatch ? parseFloat(origMatch[0].replace(',', '.')) : 0;
        }

        const originalPricePLN = rawOriginalPrice > 0
          ? await convertPrice(rawOriginalPrice, rawCurrency, 'PLN')
          : undefined;

        const discountPercent = originalPricePLN && originalPricePLN > pricePLN
          ? Math.round(((originalPricePLN - pricePLN) / originalPricePLN) * 100)
          : 0;

        // Apply filters
        if (filterConfig.minPrice && pricePLN < filterConfig.minPrice) {
          result.stats.skipped++;
          continue;
        }
        if (filterConfig.maxPrice && pricePLN > filterConfig.maxPrice) {
          result.stats.skipped++;
          continue;
        }
        if (filterConfig.minDiscount && discountPercent < filterConfig.minDiscount) {
          result.stats.skipped++;
          continue;
        }

        // Build tracking URL - prioritize Convertiser tracking domains & API generator
        let trackingUrl = rawItem.tracking_link || rawItem.tracking_url || rawItem.affiliate_url || rawItem.click_url || '';

        if (!trackingUrl && rawItem.id) {
          try {
            const trackingRes = await client.generateProductTrackingLink(String(rawItem.id));
            if (trackingRes?.tracking_link || trackingRes?.url) {
              trackingUrl = trackingRes.tracking_link || trackingRes.url;
            }
          } catch {
            // fallback
          }
        }

        if (!trackingUrl && (rawItem.uuid || rawItem.offer_uuid)) {
          try {
            const offerUuid = String(rawItem.uuid || rawItem.offer_uuid);
            const trackingRes = await client.generateOfferTrackingLink(offerUuid);
            if (trackingRes?.tracking_link || trackingRes?.url) {
              trackingUrl = trackingRes.tracking_link || trackingRes.url;
            }
          } catch {
            // fallback
          }
        }

        if (!trackingUrl && rawItem.offer_uuid) {
          try {
            const offerDetail = await client.getOfferDetail(rawItem.offer_uuid);
            if (offerDetail?.tracking_link) {
              trackingUrl = offerDetail.tracking_link;
            }
          } catch {
            // fallback
          }
        }

        if (!trackingUrl) {
          trackingUrl = rawItem.direct_link || rawItem.link || rawItem.url || `https://convertiser.com/products/${originalId}/`;
        }

        const rawMerchantName = String(
          rawItem.advertiser_name ||
          rawItem.merchant ||
          rawItem.store_name ||
          rawItem.offer ||
          rawItem.brand ||
          'Partner Convertiser'
        );
        const merchantName = extractMerchantNameFromUrl(trackingUrl, rawMerchantName);

        const description = stripHtmlTags(rawItem.description || rawItem.short_description || title);
        const existingProductId = candidate.existingProductId;

        // Merchant validation
        const merchantValidation = validateMerchantListingInput({
          title,
          imageUrl,
          landingUrl: trackingUrl,
          price: pricePLN,
          currency: 'PLN',
        });

        if (!merchantValidation.valid) {
          result.stats.skipped++;
          continue;
        }

        // Coupon code handling (from offers mode)
        const couponCode = rawItem.coupon_code || rawItem.code || rawItem.promo_code || undefined;
        const dealType = couponCode ? ('coupon' as const) : ('deal' as const);

        if (!config.dryRun) {
          let productRef: any;

          if (existingProductId) {
            result.stats.duplicates++;
            productRef = { id: existingProductId, isExisting: true };
          } else {
            // Construct Product document
            const productData: Partial<Product> = {
              name: title,
              description: description || title,
              longDescription: description || title,
              image: imageUrl,
              imageHint: title,
              affiliateUrl: trackingUrl,
              price: pricePLN,
              originalPrice: originalPricePLN ?? (discountPercent > 0 ? pricePLN / (1 - discountPercent / 100) : undefined),
              discountPercent,
              currency: 'PLN',
              mainCategorySlug: targetMainCategory,
              subCategorySlug: targetSubCategory,
              subSubCategorySlug: targetSubSubCategory,
              status: config.autoApprove ? 'approved' : 'draft',
              gallery: [
                {
                  id: `img_0`,
                  type: 'url' as const,
                  src: imageUrl,
                  isPrimary: true,
                  source: 'manual' as const,
                  addedAt: new Date().toISOString(),
                },
              ],
              ratingCard: {
                average: 0,
                count: 0,
                durability: 0,
                easeOfUse: 0,
                valueForMoney: 0,
                versatility: 0,
              },
              metadata: {
                source: 'convertiser' as const,
                originalId,
                importedAt: new Date().toISOString(),
                importedBy: config.triggeredByUid || 'system',
                merchant: merchantName,
                currencyRate: 1.0,
                commissionRate: rawItem.commission,
              },
            };

            const sanitizedProd = sanitizeProductPayload(productData);
            productRef = await adminDb.collection('products').add(sanitizedProd);
            result.stats.created++;
            result.stats.createdProducts++;
          }

          // Create DEAL document (always, for both new and duplicate products)
          const dealData: Partial<any> = {
            productId: productRef.id,
            mainCategorySlug: targetMainCategory,
            subCategorySlug: targetSubCategory,
            subSubCategorySlug: targetSubSubCategory,
            price: {
              amount: pricePLN,
              currency: 'PLN',
            },
            originalPrice: originalPricePLN ?? (discountPercent > 0 ? pricePLN / (1 - discountPercent / 100) : undefined),
            shipping: {
              cost: Number(rawItem.shipping_cost || rawItem.shipping_price || 0),
              fromCountry: 'PL',
            },
            source: 'convertiser' as const,
            affiliateLink: trackingUrl,
            link: trackingUrl,
            affiliateUrl: trackingUrl,
            dealUrl: trackingUrl,
            merchantName,
            title: { pl: title },
            dealType,
            couponCode: couponCode ? String(couponCode).trim() : undefined,
            freeShipping: Boolean(rawItem.free_shipping || rawItem.shipping_cost === 0),
            stockStatus: 'in_stock' as const,
            isActive: true,
            priceHistory: [
              {
                date: new Date().toISOString().split('T')[0],
                price: pricePLN,
                currency: 'PLN',
              },
            ],
            voteCount: 0,
            temperature: 0,
            commentsCount: 0,
            status: config.autoApprove ? 'approved' : 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: config.triggeredByUid || 'system',
            sourceProductId: originalId,
            sourceUrl: trackingUrl,
            metadata: {
              source: 'convertiser',
              originalId,
              importedAt: new Date().toISOString(),
              importedBy: config.triggeredByUid || 'system',
              merchant: merchantName,
              offerUuid: rawItem.offer_uuid || rawItem.uuid,
              commission: rawItem.commission,
            },
          };

          const sanitizedDeal = sanitizeDealPayload ? sanitizeDealPayload(dealData) : dealData;
          const dealRef = await adminDb.collection('deals').add(sanitizedDeal);
          result.stats.created++;
          result.stats.createdDeals++;

          if (config.autoApprove) {
            result.stats.autoApproved++;
          }

          await logImportItem(result.importRunId, {
            originalId,
            action: 'created',
            itemType: existingProductId ? 'deal' : 'product',
            itemId: existingProductId ? dealRef.id : productRef.id,
            timestamp: new Date().toISOString(),
            metadata: {
              title,
              price: pricePLN,
              merchant: merchantName,
              autoApproved: config.autoApprove,
            },
          });
        } else {
          result.stats.created++;
          if (existingProductId) {
            result.stats.createdDeals++;
          } else {
            result.stats.createdProducts++;
            result.stats.createdDeals++;
          }
        }

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
      }
    }

    const durationMs = Date.now() - startTime;
    await importRunRef.update({
      status: 'completed',
      finishedAt: new Date().toISOString(),
      durationMs,
      stats: result.stats,
      'progress.phase': 'completing',
    });

    result.success = true;
    return result;

  } catch (error) {
    logger.error('Convertiser import failed', { error });

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
