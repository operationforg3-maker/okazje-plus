import { adminDb } from '@/lib/firebase-admin';
import {
  ProductCore,
  DealM6,
  HarvesterJob,
  IdentityMatch,
  LocalizedText,
} from '@/lib/types';
import {
  calculateIdentityHash,
  calculateTitleHash,
  calculateImageHash,
  extractDimensionsFromTitle,
  normalizeProductIdentifier,
} from './identity-matcher';
import { AIRefiner } from './refiner';
import { startDealRefinerJob } from './deal-refiner';
import { convertToPLN } from '@/lib/currency-exchange';
import { addToModerationQueue } from '@/lib/moderation';
import { batchAssignCategories } from '@/ai/flows/convertiser-auto-category';
import { PlaceHolderImages } from '@/lib/placeholder-images';
// deep-mapper consolidated into mappers.ts; migrate when harvester uses Universal Product Schema
// import { mapAliExpressToProductCoreDeepData } from '@/integrations/aliexpress/deep-mapper';

/**
 * Raw product data from external APIs (before transformation)
 */
interface RawProduct {
  title: string;
  description?: string;
  imageUrl: string;
  price: number;
  originalPrice?: number; // Price before discount (for strikethrough display)
  currency: string;
  shippingCost: number;
  shippingDays: number;
  sourceProductId: string;
  sourceUrl: string;
  videoUrl?: string; // Product video URL from source (e.g., AliExpress)
  merchantName?: string;
  merchantRating?: number;
  specs?: Record<string, string>;
  discountPercent?: number; // Procentowa obniżka ceny
  couponCode?: string;
  expiryDate?: string;
  conditions?: string[];
  freeShipping?: boolean;
  minOrderValue?: number;
  limitPerUser?: number;
  requiresMembership?: string;
  rating?: number;
  ratingCount?: number; // Number of reviews/ratings
  evaluateCount?: number; // AliExpress: Liczba opinii (alternatywa dla ratingCount)
  soldCount?: number; // AliExpress: Liczba sprzedanych/ocenionych (dla popularity metric)
  images?: string[]; // All product images (gallery)
  variants?: Array<{ // Product variants (colors, sizes, etc.)
    id: string;
    name: string; // e.g., "Color", "Size"
    values: string[]; // e.g., ["Black", "White"], ["S", "M", "L"]
    sku?: string;
  }>;
  // Product identifiers (for deduplication & SEO)
  sku?: string;
  ean?: string;
  gtin?: string;
  upc?: string;
  mpn?: string;
  offerMeta?: {
    promotionType?: 'offer';
    terms?: string;
    previewUrl?: string;
    hasCoupons?: boolean;
  };
}

/**
 * Smart Harvester - Fetches products from sources (AliExpress, Amazon, etc.)
 * and intelligently creates Products + Deals with deduplication
 */
export class SmartHarvester {
  private jobId: string;
  private logs: HarvesterJob['logs'] = [];

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  private getFallbackImageUrl(): string {
    return PlaceHolderImages?.[0]?.imageUrl || '/placeholder.png';
  }

  private mapConvertiserOfferToRawProduct(offer: any): RawProduct | null {
    try {
      const title = offer.title || offer.product_title || offer.name || offer.product_name || '';
      if (!title) return null;

      const imageUrl = offer.logo_thumbnail || offer.logo || offer.image || offer.image_url || offer.product_image || this.getFallbackImageUrl();
      const previewUrl =
        offer.tracking_link ||
        offer.tracking_url ||
        offer.affiliate_url ||
        offer.aff_link ||
        offer.preview_url ||
        offer.offer_display_url ||
        offer.url ||
        '';

      const parsePrice = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        const str = String(value);
        const match = str.match(/[\d.,]+/);
        return match ? parseFloat(match[0].replace(',', '.')) : 0;
      };

      const price = parsePrice(offer.sale_price || offer.price || offer.current_price || offer.offer_price);
      const originalPrice = parsePrice(offer.original_price || offer.regular_price || offer.list_price || offer.old_price);
      const discountPercent = originalPrice > price && price > 0
        ? Math.round(100 - (price / originalPrice) * 100)
        : undefined;

      const couponCodeRaw =
        offer.coupon_code ||
        offer.couponCode ||
        offer.code ||
        offer.promo_code ||
        offer.voucher_code ||
        offer.discount_code ||
        '';
      const couponCode = String(couponCodeRaw || '').trim() || undefined;

      const toIsoDate = (value: any): string | undefined => {
        if (!value) return undefined;
        if (value instanceof Date) return value.toISOString();
        if (typeof value === 'number') return new Date(value).toISOString();
        const parsed = Date.parse(String(value));
        return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
      };

      const expiryDate = toIsoDate(
        offer.expiry_date ||
        offer.expiration_date ||
        offer.valid_until ||
        offer.valid_to ||
        offer.ends_at ||
        offer.end_date
      );

      const rawConditions = offer.terms || offer.conditions || offer.condition || offer.rules;
      const conditions = Array.isArray(rawConditions)
        ? rawConditions.map((c: any) => String(c).trim()).filter(Boolean)
        : String(rawConditions || '')
            .split(/\n|\r|•|;|\|/g)
            .map((c) => c.trim())
            .filter(Boolean);
      const freeShipping = Boolean(offer.free_shipping || offer.freeShipping || offer.shipping_free || offer.shipping_cost === 0);
      const minOrderValue = parsePrice(offer.min_order_value || offer.minimum_order_value || offer.minimum_purchase);
      const limitPerUser = parsePrice(offer.limit_per_user || offer.max_per_user || offer.user_limit);
      const requiresMembership = offer.requires_membership || offer.membership || offer.membership_required;

      const description = offer.description || offer.product_description || offer.excerpt || offer.short_description || '';
      const specsFromTitle = extractDimensionsFromTitle(title);
      const specsFromDesc = description ? extractDimensionsFromTitle(description) : {};
      const mergedSpecs = { ...specsFromTitle, ...specsFromDesc };

      return {
        title,
        description,
        imageUrl,
        price,
        originalPrice: originalPrice > price ? originalPrice : undefined,
        currency: 'PLN',
        shippingCost: 0,
        shippingDays: 0,
        sourceProductId: String(
          offer.uuid ||
          offer.offer_uuid ||
          offer.offer_id ||
          offer.id ||
          ''
        ),
        sourceUrl: previewUrl,
        merchantName: offer.title || offer.advertiser_name || 'Convertiser',
        merchantRating: 0,
        specs: mergedSpecs,
        discountPercent,
        couponCode,
        expiryDate,
        conditions: conditions.length > 0 ? conditions : undefined,
        freeShipping,
        minOrderValue: minOrderValue > 0 ? minOrderValue : undefined,
        limitPerUser: limitPerUser > 0 ? limitPerUser : undefined,
        requiresMembership: requiresMembership ? String(requiresMembership) : undefined,
        rating: 0,
        ratingCount: 0,
        images: [imageUrl],
        offerMeta: {
          promotionType: 'offer',
          terms: offer.terms || undefined,
          previewUrl: previewUrl || undefined,
          hasCoupons: Boolean(offer.has_coupons || couponCode),
        },
      } as RawProduct;
    } catch {
      return null;
    }
  }

  /**
   * Build a list of category query strings by walking the 3-level tree in Firestore.
   * Each entry is formatted as `main/sub/subsub` (falls back to `main/sub` when no sub-sub exists).
   */
  static async buildCategoryQueries(rootCategorySlug?: string): Promise<string[]> {
    const queries: string[] = [];

    try {
      const mainCategories = [] as Array<{ id: string; slug: string }>;

      if (rootCategorySlug) {
        const mainDoc = await adminDb.collection('categories').doc(rootCategorySlug).get();
        if (mainDoc.exists) {
          const data = mainDoc.data() as any;
          mainCategories.push({ id: mainDoc.id, slug: data?.slug || mainDoc.id });
        }
      } else {
        const mainSnapshot = await adminDb.collection('categories').get();
        mainSnapshot.forEach((docSnap) => {
          const data = docSnap.data() as any;
          mainCategories.push({ id: docSnap.id, slug: data?.slug || docSnap.id });
        });
      }

      for (const main of mainCategories) {
        const subSnapshot = await adminDb.collection(`categories/${main.id}/subcategories`).get();
        for (const subDoc of subSnapshot.docs) {
          const subData = subDoc.data() as any;
          const subSlug = subData?.slug || subDoc.id;

          const subSubSnapshot = await adminDb.collection(`categories/${main.id}/subcategories/${subDoc.id}/subcategories`).get();

          if (subSubSnapshot.empty) {
            // Base path for subcategory
            queries.push(`${main.slug}/${subSlug}`);
            // Expand with sub-level import keywords to iterate more targets
            const subKeywords: string[] = Array.isArray(subData?.importKeywords) ? subData.importKeywords : [];
            for (const kw of subKeywords) {
              const normKw = (kw || '').trim();
              if (normKw) queries.push(`${main.slug}/${subSlug}/${normKw}`);
            }
            continue;
          }

          subSubSnapshot.forEach((subSubDoc) => {
            const subSubData = subSubDoc.data() as any;
            const subSubSlug = subSubData?.slug || subSubDoc.id;
            // Base path for sub-subcategory
            queries.push(`${main.slug}/${subSlug}/${subSubSlug}`);
            // Also iterate per import keyword to widen coverage
            const keywords: string[] = Array.isArray(subSubData?.importKeywords) ? subSubData.importKeywords : [];
            for (const kw of keywords) {
              const normKw = (kw || '').trim();
              if (normKw) queries.push(`${main.slug}/${subSlug}/${subSubSlug}/${normKw}`);
            }
          });
        }
      }

      return Array.from(new Set(queries));
    } catch (error) {
      console.error('[Harvester] Failed to build category queries', error);
      return [];
    }
  }

  /**
   * Log an entry to the job
   */
  private addLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    details?: any
  ) {
    // Serialize details to plain object (avoid Error instances, etc.)
    let serializedDetails: any = undefined;
    if (details !== undefined) {
      if (details instanceof Error) {
        serializedDetails = { message: details.message, stack: details.stack };
      } else if (typeof details === 'object' && details !== null) {
        try {
          serializedDetails = JSON.parse(JSON.stringify(details));
        } catch {
          serializedDetails = String(details);
        }
      } else {
        serializedDetails = details;
      }
    }

    this.logs.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      details: serializedDetails,
    });
    console.log(`[${level.toUpperCase()}] ${message}`, details || '');
  }

  /**
   * Main entry point: Harvest products from a source
   * Returns the harvester job with results
   * 
   * @param source - API source (aliexpress, amazon, allegro)
   * @param query - Search query or category slug (e.g., 'phones', 'phones/flagship' for sub-categories)
   * @param maxResults - Maximum products to fetch
   * @param categories - Optional: Iterate through multiple categories/sub-categories
   * @param autoBrowse - Auto-browse entire catalog (Convertiser only)
   */
  async harvestProducts(
    source: 'aliexpress' | 'amazon' | 'allegro' | 'convertiser',
    query: string,
    maxResults: number = 50,
    categories?: string[], // e.g., ['phones/flagship', 'phones/budget', 'tablets/android']
    isTreeMode: boolean = false, // True when harvesting from category tree
    convertiserMode?: 'products' | 'offers', // Convertiser: fetch products or offers
    autoBrowse: boolean = false // Convertiser: fetch entire catalog without keywords
  ): Promise<HarvesterJob> {
    const jobStartTime = new Date().toISOString();
    
    // For Convertiser: NEVER use category tree mode - use simple query only
    // Moderator will manually categorize products in admin UI
    let queries: string[];
    if (autoBrowse && source === 'convertiser') {
      queries = ['__AUTO_BROWSE__'];
    } else {
      const useSimpleQuery = source === 'convertiser' || !isTreeMode;
      queries = (useSimpleQuery || !categories || categories.length === 0) ? [query] : categories;
    }
    const processedCategoriesLog: HarvesterJob['processedCategories'] = [];
    
    const modeDesc = source === 'convertiser' 
      ? 'simple-query (moderator categorizes)' 
      : (isTreeMode ? 'category-tree' : 'single');
    this.addLog('info', `Starting harvest job: source=${source}, mode=${modeDesc}, queries=${queries.join(', ')}, maxResults=${maxResults}`);

    // Initialize job record immediately (so UI can poll for status)
    const initialJob: HarvesterJob = {
      id: this.jobId,
      status: 'running',
      source,
      query: queries.join(', '),
      maxResults,
      productsFound: 0,
      productsCreated: 0,
      dealsCreated: 0,
      duplicatesSkipped: 0,
      errors: [],
      currentCategory: queries[0] || '',
      totalCategories: queries.length,
      processedCategories: [],
      startedAt: jobStartTime,
      lastUpdatedAt: jobStartTime,
      logs: this.logs,
    };
    await this.updateJobRecord(initialJob);

    let productsFound = 0;
    let productsCreated = 0;
    let dealsCreated = 0;
    let duplicatesSkipped = 0;
    const errors: HarvesterJob['errors'] = [];
    let processedCount = 0; // Counter for periodic updates
    const dealsToRefine: string[] = [];
    const productsToRefine: string[] = [];

    try {
      // Iterate through all provided queries/categories
      for (const currentQuery of queries) {
        // Check if we should stop
        if (!(await this.isJobActive())) {
           this.addLog('warn', 'Job stopped externally (paused/cancelled)');
           return {
             id: this.jobId,
             status: 'paused',
             source,
             query: queries.join(', '),
             maxResults,
             productsFound,
             productsCreated,
             dealsCreated,
             duplicatesSkipped,
             errors,
             currentCategory: currentQuery,
             totalCategories: queries.length,
             processedCategories: processedCategoriesLog,
             startedAt: jobStartTime,
             lastUpdatedAt: new Date().toISOString(),
             logs: this.logs,
           };
        }

        this.addLog('info', `Processing query/category: ${currentQuery}`);
        let categoryProductsCreated = 0; // Local counter for this category

        // Update current category in status
        await this.updateJobRecord({
           id: this.jobId,
           status: 'running',
           source,
           query: queries.join(', '),
           maxResults,
           productsFound,
           productsCreated,
           dealsCreated,
           duplicatesSkipped,
           errors,
           currentCategory: currentQuery,
           totalCategories: queries.length,
           processedCategories: processedCategoriesLog,
           startedAt: jobStartTime,
           lastUpdatedAt: new Date().toISOString(),
           logs: this.logs,
        });
        
        try {
          // Step 1: Fetch products from source API
          // For tree mode: extract category name from path (e.g., 'electronics/phones/flagship' -> 'flagship')
          const searchTerm = isTreeMode 
            ? currentQuery.split('/').pop() || currentQuery 
            : currentQuery;
            
          const sourceProducts = await this.fetchFromSource(source, searchTerm, maxResults, isTreeMode, convertiserMode);
          
          // For category-tree mode: Filter by rating/quality (top products only)
          let filteredProducts = sourceProducts;
          if (isTreeMode && !autoBrowse && sourceProducts.length > 0) {
            filteredProducts = this.filterTopQualityProducts(sourceProducts, Math.ceil(maxResults * 0.6));
          }
          
          productsFound += sourceProducts.length;
          this.addLog('info', `Fetched ${sourceProducts.length} products from ${source} for "${currentQuery}", using ${filteredProducts.length} after quality filter`);

          // Step 1.5: Batch AI categorization for Convertiser (optimize token costs)
          if (source === 'convertiser' && filteredProducts.length > 0) {
            try {
              this.addLog('info', `Running batch AI categorization for ${filteredProducts.length} Convertiser products...`);
              
              // Get all available categories once
              const { getAllCategories, getSubcategories, getSubSubcategories } = await import('@/lib/data-admin');
              const mainCats = await getAllCategories();
              const availableCategories: any[] = [];
              
              for (const main of mainCats) {
                const subs = await getSubcategories(main.id);
                for (const sub of subs) {
                  const subSubs = await getSubSubcategories(main.id, sub.id);
                  if (subSubs.length === 0) {
                    availableCategories.push({
                      mainSlug: main.slug,
                      mainName: main.name,
                      subSlug: sub.slug,
                      subName: sub.name,
                    });
                  } else {
                    for (const subSub of subSubs) {
                      availableCategories.push({
                        mainSlug: main.slug,
                        mainName: main.name,
                        subSlug: sub.slug,
                        subName: sub.name,
                        subSubSlug: subSub.slug,
                        subSubName: subSub.name,
                      });
                    }
                  }
                }
              }
              
              // Batch assign categories
              const { batchAssignCategories } = await import('@/ai/flows/convertiser-auto-category');
              const batchResults = await batchAssignCategories({
                products: filteredProducts.map((p, idx) => ({
                  id: String(idx),
                  title: p.title,
                  description: p.description,
                })),
                availableCategories,
              });
              
              // Cache results in filteredProducts for later use
              batchResults.forEach((result, idx) => {
                (filteredProducts[idx] as any).__categoryAssignment = result.assignment;
              });
              
              this.addLog('info', `✅ Batch categorization complete for ${batchResults.length} products`);
            } catch (batchErr) {
              this.addLog('warn', `Batch categorization failed: ${batchErr instanceof Error ? batchErr.message : 'Unknown error'}`);
              // Continue without categories - will use uncategorized fallback
            }
          }

          // Step 2: Process each product (create or link)
          for (const sourceProduct of filteredProducts) {
            try {
              // PRIORITY 1: Check for existing product by standard identifiers (EAN/GTIN/UPC/MPN)
              let existingProduct = null;
              let identityHash = '';
              
              // Type-safe access to identifiers
              const productEan = sourceProduct.ean;
              const productGtin = sourceProduct.gtin;
              const productUpc = sourceProduct.upc;
              const productMpn = sourceProduct.mpn;
              
              if (productEan || productGtin || productUpc || productMpn) {
                existingProduct = await this.findProductByIdentifiers({
                  ean: productEan,
                  gtin: productGtin,
                  upc: productUpc,
                  mpn: productMpn,
                });
                
                if (existingProduct) {
                  this.addLog('info', `Found existing product by identifier (EAN/GTIN): ${existingProduct.id}`);
                }
              }
              
              // PRIORITY 2: Fallback to identity hash (title + image)
              if (!existingProduct) {
                identityHash = calculateIdentityHash(
                  sourceProduct.title,
                  sourceProduct.imageUrl
                );
                existingProduct = await this.findProductByIdentity(identityHash);
                
                if (existingProduct) {
                  this.addLog('info', `Found existing product by identity hash: ${existingProduct.id}`);
                }
              }

              if (existingProduct) {
                // Existing product: Create new Deal
                this.addLog(
                  'info',
                  `Found existing product ${existingProduct.id}, creating new deal`
                );

                if (!existingProduct.id || typeof existingProduct.id !== 'string') {
                  throw new Error('Existing product missing valid id');
                }

                const dealId = await this.createDeal(existingProduct.id, sourceProduct, source);
                dealsCreated++;
                dealsToRefine.push(dealId);

                // Add deal to moderation queue for admin review
                try {
                  await addToModerationQueue(dealId, 'deal', 'import', 'harvester', 'high');
                  this.addLog('info', `Deal ${dealId} added to moderation queue`);
                } catch (err) {
                  this.addLog('warn', `Failed to add deal ${dealId} to moderation queue`, err);
                }

                // Update product's best price
                await this.updateProductBestPrice(existingProduct.id);
                duplicatesSkipped++;
              } else {
                // New product: Create ProductCore + Deal
                this.addLog('info', `Creating new product for: ${sourceProduct.title}`);

                // Parse category hierarchy from query (e.g., 'electronics/phones/flagship')
                // CONVERTISER: AI auto-maps category from title (no moderator needed!)
                // OTHER SOURCES: Parse category from query path
                let categoryInfo: any;
                
                if (source === 'convertiser') {
                  // Batch AI categorization is done before the loop - use cached result
                  const cachedAssignment = (sourceProduct as any).__categoryAssignment;
                  if (cachedAssignment) {
                    categoryInfo = {
                      mainCategorySlug: cachedAssignment.mainCategorySlug,
                      subCategorySlug: cachedAssignment.subCategorySlug,
                      subSubCategorySlug: cachedAssignment.subSubCategorySlug,
                    };
                    this.addLog('info', `✅ Using batch-assigned category: ${categoryInfo.mainCategorySlug}/${categoryInfo.subCategorySlug}`);
                  } else {
                    // Fallback: uncategorized if batch failed
                    this.addLog('warn', 'Batch categorization result missing, using uncategorized');
                    categoryInfo = {
                      mainCategorySlug: 'uncategorized',
                      subCategorySlug: 'uncategorized',
                    };
                  }
                } else {
                  // Other sources: parse from query path only when path-like
                  if (currentQuery.includes('/')) {
                    const categoryParts = currentQuery.split('/');
                    categoryInfo = {
                      mainCategorySlug: categoryParts[0] || 'uncategorized',
                      subCategorySlug: categoryParts[1] || 'uncategorized',
                      subSubCategorySlug: categoryParts[2],
                    };
                  } else {
                    // Free-text query: let category mapper decide
                    categoryInfo = {
                      mainCategorySlug: 'uncategorized',
                      subCategorySlug: 'uncategorized',
                    };
                  }
                }

                const productId = await this.createProductCore(
                  sourceProduct,
                  identityHash,
                  source,
                  categoryInfo
                );
                productsCreated++;
                categoryProductsCreated++;
                productsToRefine.push(productId);

                // Create associated deal
                const dealId = await this.createDeal(
                  productId,
                  sourceProduct,
                  source
                );
                dealsCreated++;
                dealsToRefine.push(dealId);

                // Add deal to moderation queue for admin review
                try {
                  await addToModerationQueue(dealId, 'deal', 'import', 'harvester', 'high');
                  this.addLog('info', `Deal ${dealId} added to moderation queue`);
                } catch (err) {
                  this.addLog('warn', `Failed to add deal ${dealId} to moderation queue`, err);
                }

                // Update product's best price (M6: CRITICAL - was missing for new products!)
                await this.updateProductBestPrice(productId);

                // Record identity match for future lookups
                await this.recordIdentityMatch(
                  identityHash,
                  productId,
                  source,
                  sourceProduct.sourceProductId
                );
              }

              // Periodic update: Update job status co 5 produktów
              processedCount++;
              if (processedCount % 5 === 0) {
                // Check if we should stop
                if (!(await this.isJobActive())) {
                  this.addLog('warn', 'Job stopped externally (paused/cancelled)');
                  return {
                    id: this.jobId,
                    status: 'paused',
                    source,
                    query: queries.join(', '),
                    maxResults,
                    productsFound,
                    productsCreated,
                    dealsCreated,
                    duplicatesSkipped,
                    errors,
                    currentCategory: currentQuery,
                    totalCategories: queries.length,
                    processedCategories: processedCategoriesLog,
                    startedAt: jobStartTime,
                    lastUpdatedAt: new Date().toISOString(),
                    logs: this.logs,
                  };
                }

                await this.updateJobRecord({
                  id: this.jobId,
                  status: 'running',
                  source,
                  query: queries.join(', '),
                  maxResults,
                  productsFound,
                  productsCreated,
                  dealsCreated,
                  duplicatesSkipped,
                  errors,
                  currentCategory: currentQuery,
                  totalCategories: queries.length,
                  processedCategories: processedCategoriesLog,
                  startedAt: jobStartTime,
                  lastUpdatedAt: new Date().toISOString(),
                  logs: this.logs,
                });
              }
            } catch (err) {
              this.addLog(
                'error',
                `Failed to process product: ${sourceProduct.title}`,
                err
              );
              errors.push({
                productId: sourceProduct.sourceProductId,
                message: (err as Error).message,
                timestamp: new Date().toISOString(),
              });
            }
          }
        } catch (queryErr) {
          this.addLog(
            'error',
            `Failed to harvest from query "${currentQuery}"`,
            queryErr
          );
          errors.push({
            productId: `query_${currentQuery}`,
            message: (queryErr as Error).message,
            timestamp: new Date().toISOString(),
          });
        }
        
        // Log finished category
        processedCategoriesLog.push({
          category: currentQuery,
          count: categoryProductsCreated,
          status: 'ok' // If we caught an error above, we could set 'error', but generally we continued
        });
        
        // Force update after category finish
        await this.updateJobRecord({
           id: this.jobId,
           status: 'running',
           source,
           query: queries.join(', '),
           maxResults,
           productsFound,
           productsCreated,
           dealsCreated,
           duplicatesSkipped,
           errors,
           currentCategory: currentQuery,
           totalCategories: queries.length,
           processedCategories: processedCategoriesLog,
           startedAt: jobStartTime,
           lastUpdatedAt: new Date().toISOString(),
           logs: this.logs,
        });
      }

      // Step 3: Update job record
      const jobEndTime = new Date().toISOString();
      const job: HarvesterJob = {
        id: this.jobId,
        status: 'completed',
        source,
        query: queries.join(', '),
        maxResults,
        productsFound,
        productsCreated,
        dealsCreated,
        duplicatesSkipped,
        errors,
        currentCategory: queries[queries.length - 1] || '',
        totalCategories: queries.length,
        processedCategories: processedCategoriesLog,
        startedAt: jobStartTime,
        completedAt: jobEndTime,
        lastUpdatedAt: jobEndTime,
        logs: this.logs,
      };

      await this.updateJobRecord(job);

      this.addLog(
        'info',
        `Harvest completed: Created ${productsCreated} products, ${dealsCreated} deals, Skipped ${duplicatesSkipped} duplicates`
      );

      // Trigger asynchronous Deal Refiner for freshly created deals
      if (dealsToRefine.length > 0) {
        this.addLog('info', `Uruchamiam Deal Refiner dla ${dealsToRefine.length} ofert (async)`);
        startDealRefinerJob(dealsToRefine)
          .then((result) => {
            this.addLog('info', `Deal Refiner zakończony (async): ${result.productsSuccessful} OK, ${result.productsFailed} błędów`);
          })
          .catch((err) => {
            this.addLog('error', 'Deal Refiner nie powiódł się w tle', err);
          });
      }

      if (productsToRefine.length > 0) {
        const refinerJobId = `refiner_${this.jobId}`;
        this.addLog('info', `Uruchamiam AI Refiner dla ${productsToRefine.length} produktów (async)`);
        const productRefiner = new AIRefiner(refinerJobId);
        productRefiner.refineProducts(productsToRefine, 'full_enrichment')
          .then((result) => {
            this.addLog('info', `AI Refiner zakończony (async): ${result.productsSuccessful} OK, ${result.productsFailed} błędów`);
          })
          .catch((err) => {
            this.addLog('error', 'AI Refiner nie powiódł się w tle', err);
          });
      }

      return job;
    } catch (err) {
      this.addLog('error', 'Harvest job failed', err);
      const jobEndTime = new Date().toISOString();

      const job: HarvesterJob = {
        id: this.jobId,
        status: 'failed',
        source,
        query,
        maxResults,
        productsFound,
        productsCreated,
        dealsCreated,
        duplicatesSkipped,
        errors,
        startedAt: jobStartTime,
        completedAt: jobEndTime,
        lastUpdatedAt: jobEndTime,
        logs: this.logs,
      };

      await this.updateJobRecord(job);
      throw err;
    }
  }

  /**
   * Fetch products from source API
   * This is a placeholder - integrate with actual AliExpress/Amazon/Allegro APIs
   */
  private async fetchFromSource(
    source: 'aliexpress' | 'amazon' | 'allegro' | 'convertiser',
    searchQuery: string,
    maxResults: number,
    isTreeMode: boolean = false,
    convertiserMode?: 'products' | 'offers'
  ): Promise<
    Array<{
      title: string;
      description?: string;
      imageUrl: string;
      price: number;
      currency: string;
      shippingCost: number;
      shippingDays: number;
      sourceProductId: string;
      sourceUrl: string;
      merchantName?: string;
      merchantRating?: number;
      specs?: Record<string, string>;
      rating?: number;
      ratingCount?: number;
      ean?: string;
      gtin?: string;
      upc?: string;
      mpn?: string;
    }>
  > {
    switch (source) {
      case 'aliexpress':
        return await this.fetchFromAliExpress(searchQuery, maxResults, isTreeMode);
      case 'amazon':
        return await this.fetchFromAmazon(searchQuery, maxResults);
      case 'allegro':
        return await this.fetchFromAllegro(searchQuery, maxResults);
      case 'convertiser':
        const mode = convertiserMode || 'products';
        if (searchQuery === '__AUTO_BROWSE__') {
          return await this.fetchFromConvertiserAutoBrowse(maxResults, mode);
        } else if (mode === 'offers') {
          return await this.fetchFromConvertiserOffers(searchQuery, maxResults);
        } else {
          return await this.fetchFromConvertiser(searchQuery, maxResults);
        }
      default:
        throw new Error(`Unknown source: ${source}`);
    }
  }

  /**
   * Filter products to keep only top quality ones by rating/ratingCount
   */
  private filterTopQualityProducts(
    products: any[],
    limit: number
  ): any[] {
    return products
      .filter(p => p.rating && p.rating >= 4.0) // Min 4-star rating
      .sort((a, b) => {
        // Sort by: ratingCount (descending) then rating (descending)
        if (b.ratingCount !== a.ratingCount) {
          return (b.ratingCount || 0) - (a.ratingCount || 0);
        }
        return (b.rating || 0) - (a.rating || 0);
      })
      .slice(0, limit);
  }

  /**
   * Fetch products from AliExpress using real API
   * Integrated with production AliExpress client
   * M6 FIX: Converts USD prices to PLN using NBP exchange rates
   */
  private async fetchFromAliExpress(searchQuery: string, maxResults: number, isTreeMode: boolean = false) {
    try {
      const { createAliExpressClient } = await import('@/integrations/aliexpress/client');
      const client = createAliExpressClient();
      
      this.addLog('info', `Fetching from AliExpress: "${searchQuery}" (treeMode=${isTreeMode})`);
      
      // For tree mode: use higher maxResults to fetch more, then filter by rating
      const fetchSize = isTreeMode ? Math.min(maxResults * 2, 100) : Math.min(maxResults, 50);
      
      const response = await client.searchProducts({
        q: searchQuery,
        limit: fetchSize,
        sort: isTreeMode ? 'rating' : 'price_asc', // For tree mode, sort by rating; otherwise by price
        targetLanguage: 'EN', // Fetch in English for better AI translation
        targetCurrency: 'PLN', // Ensure prices are in PLN
        shipToCountry: 'PL'    // Ensure shipping to Poland
      });
      
      if (!response.success || !response.products) {
        this.addLog('error', `AliExpress search failed: ${response.error?.message || 'Unknown error'}`);
        return [];
      }
      
      this.addLog('info', `Found ${response.products.length} products from AliExpress. Fetching deep details for top items...`);
      
      // DEEP FETCH: Get detailed info (HTML descriptions) for top 10 items
      // We can't do all 50 due to rate limits/performance, but top 10 is good for quality
      const productsToEnrich = response.products.slice(0, 50); // M6: Try more? No, stick to batch to avoid timeout
      
      const detailedProducts = await Promise.all(
        productsToEnrich.map(async (p: any) => {
          try {
            // Only fetch details if we have an ID
            const pid = String(p.item_id || p.product_id || '');
            if (!pid) return p;

            // Fetch details (includes HTML description now)
            const details = await client.getProductDetails({
              productId: pid,
              targetCurrency: 'PLN',
              targetLanguage: 'EN',
              shipToCountry: 'PL'
            });

            if (details) {
              return { ...p, ...details }; // Merge details into product
            }
            return p;
          } catch (e) {
            // Fail silently on detail fetch, keep basic info
            return p;
          }
        })
      );
      
      // Transform to RawProduct format (already in PLN from API)
      return detailedProducts.map((p: any) => ({
        title: p.title || p.product_title || '',
        description: p.product_description || '', // RAW HTML from Deep Fetch
        imageUrl: Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls[0] : (p.product_main_image_url || ''),
        price: p.price?.current || p.target_sale_price || 0,
        originalPrice: p.price?.original || p.original_price || undefined, // Price before discount
        currency: p.price?.currency || p.target_sale_price_currency || 'PLN', // Should be PLN from API
        shippingCost: p.shipping?.free ? 0 : (p.shipping?.cost || 0),
        shippingDays: p.ship_to_days || 7, // Default estimate
        sourceProductId: String(p.item_id || p.product_id || ''),
        sourceUrl: p.product_url || p.promotion_link || '',
        videoUrl: p.product_video_url || p.video_url || undefined,
        merchantName: p.store_info?.store_name || 'AliExpress',
        merchantRating: p.store_info?.score || 4.0,
        specs: extractDimensionsFromTitle(p.title || p.product_title || ''), // TODO: Parse p.product_props if available
        rating: (() => {
          // Robust rating parser handling 0-5 and 0-100 scales
          if (p.rating?.score) return Number(p.rating.score);
          if (p.evaluate_rate) {
            const parsed = parseFloat(String(p.evaluate_rate).replace('%', ''));
            // If likely 0-100 scale (e.g. "95", "4.8/5" parsed as 4.8)
            // Heuristic: If > 5, assumes 0-100 scale -> divide by 20.
            if (!isNaN(parsed)) return parsed > 5 ? parsed / 20 : parsed;
          }
          return 0;
        })(),
        ratingCount: p.rating?.count || p.volume || 0,
        images: Array.isArray(p.image_urls) ? p.image_urls : (p.all_images || []), // Full gallery
        variants: Array.isArray(p.variants) ? p.variants : (p.sku_list || undefined), // Product variants (colors, sizes)
        // Product identifiers (for robust deduplication & SEO)
        sku: p.sku || undefined,
        ean: p.ean || p.barcode || undefined,
        gtin: p.gtin || undefined,
        upc: p.upc || undefined,
        mpn: p.mpn || p.manufacturer_part_number || undefined,
      }));
    } catch (error) {
      this.addLog('error', `AliExpress API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Fetch products from Amazon
   * NOTE: Amazon PA API requires separate account setup
   */
  private async fetchFromAmazon(searchQuery: string, maxResults: number) {
    this.addLog('warn', 'Amazon API not configured - requires PA API credentials');
    // Amazon Product Advertising API integration pending
    return [];
  }

  /**
   * Fetch products from Allegro
   * NOTE: Allegro REST API requires Polish marketplace setup
   */
  private async fetchFromAllegro(searchQuery: string, maxResults: number) {
    this.addLog('warn', 'Allegro API not configured - requires OAuth setup');
    // Allegro REST API integration pending
    return [];
  }

  /**
   * Fetch products from Convertiser
   * Convertiser is an affiliate network with multi-marketplace product discovery
   */
  private async fetchFromConvertiser(searchQuery: string, maxResults: number) {
    try {
      // Check if token is available before importing client
      if (!process.env.CONVERTISER_API_TOKEN) {
        this.addLog('warn', 'Convertiser API token not configured (CONVERTISER_API_TOKEN env var missing)');
        return [];
      }

      const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
      const client = getConvertiserClient();

      this.addLog('info', `Fetching from Convertiser: "${searchQuery}"`);

      // Convertiser has "Search Products" endpoint for product discovery
      // Try v2 first (better data), fallback to v1 if not available
      let response: any;
      try {
        response = await client.searchProductsV2(
          {
            query: searchQuery,
            country: 'PL', // Polish marketplace
          },
          {
            page: 1,
            page_size: Math.min(maxResults, 50),
          }
        );
      } catch (v2Error) {
        this.addLog('warn', `Convertiser v2 API failed: ${v2Error instanceof Error ? v2Error.message : 'Unknown'} - Trying v1`);
        // Fallback to v1
        response = await client.searchProducts(
          {
            query: searchQuery,
            country: 'PL',
          },
          {
            page: 1,
            page_size: Math.min(maxResults, 50),
          }
        );
      }

      // Convertiser v2 returns products in 'data' field, not 'results'
      const products = (response as any).data || response.results || [];

      if (!products || products.length === 0) {
        this.addLog('warn', `Convertiser: No products found for "${searchQuery}"`);
        return [];
      }

      this.addLog('info', `Found ${products.length} products from Convertiser`);

      // Transform Convertiser products to RawProduct format
      // Use Promise.all for async currency conversion
      const rawProducts = await Promise.all(
        products.map(async (product: any) => {
          try {
            const title = product.title || product.name || '';
            if (!title) return null;

            // Convertiser images are in 'images.default' or 'image_link'
            const imageUrl = product.images?.default || product.image_link || product.image_url || '';
            // Skip products without valid image URL (required for identity hash)
            if (!imageUrl || imageUrl.trim() === '') {
              return null;
            }

            // Parse price and currency from "PLN 199.99" or "USD 199.99" format
            const parsePriceWithCurrency = (priceStr: string): { amount: number, currency: string } => {
              if (!priceStr) return { amount: 0, currency: 'PLN' };
              const str = String(priceStr);
              // Try to extract currency code (3 letters at start)
              const currencyMatch = str.match(/^([A-Z]{3})\s*([\d.,]+)/);
              if (currencyMatch) {
                return {
                  currency: currencyMatch[1],
                  amount: parseFloat(currencyMatch[2].replace(',', '.'))
                };
              }
              // Fallback: just extract number, assume PLN
              const match = str.match(/[\d.,]+/);
              return {
                amount: match ? parseFloat(match[0].replace(',', '.')) : 0,
                currency: 'PLN'
              };
            };

            const salePriceParsed = parsePriceWithCurrency(product.sale_price || product.price);
            const regularPriceParsed = parsePriceWithCurrency(product.price);
            
            // Convert to PLN if needed (async)
            const price = salePriceParsed.currency !== 'PLN' 
              ? await convertToPLN(salePriceParsed.amount, salePriceParsed.currency)
              : salePriceParsed.amount;
            
            const originalPrice = regularPriceParsed.amount > salePriceParsed.amount 
              ? (regularPriceParsed.currency !== 'PLN' 
                  ? await convertToPLN(regularPriceParsed.amount, regularPriceParsed.currency)
                  : regularPriceParsed.amount)
              : 0;

            return {
              title,
              description: product.description || product.desc || product.short_description || '',
              imageUrl,
              price,
              originalPrice: originalPrice > price ? originalPrice : undefined,
              currency: 'PLN', // Always PLN after conversion
              shippingCost: product.shipping_cost ? parseFloat(product.shipping_cost) : 0,
              shippingDays: product.shipping_days || 7,
              sourceProductId: String(
                product.id ||
                product.uuid ||
                product.product_id ||
                product.offer_id ||
                product.sku ||
                ''
              ),
              sourceUrl:
                product.tracking_link ||
                product.tracking_url ||
                product.affiliate_url ||
                product.aff_link ||
                product.direct_link ||
                product.link ||
                product.url ||
                '',
              merchantName: product.offer || product.merchant || product.store_name || 'Convertiser',
              merchantRating: product.merchant_rating ? parseFloat(product.merchant_rating) : 0,
              specs: extractDimensionsFromTitle(title),
              rating: product.rating ? parseFloat(product.rating) : 0,
              ratingCount: product.review_count || product.reviews || 0,
              images: [imageUrl], // Use main image
              sku: product.sku || undefined,
              ean: product.ean || product.barcode || product.gtin || undefined,
              gtin: product.gtin || undefined,
              upc: product.upc || undefined,
              mpn: product.mpn || undefined,
            };
          } catch (e) {
            this.addLog('warn', `Failed to map Convertiser product: ${e instanceof Error ? e.message : 'Unknown error'}`);
            return null;
          }
        })
      );
      
      // Filter out null results
      return rawProducts.filter((p: any): p is RawProduct => p !== null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      // Log different error types with context
      if (errorMsg.includes('token') || errorMsg.includes('Token') || errorMsg.includes('CONVERTISER_API_TOKEN')) {
        this.addLog('error', `Convertiser API authentication error: ${errorMsg} - Check CONVERTISER_API_TOKEN environment variable`);
      } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        this.addLog('error', `Convertiser API endpoint not found (404): ${errorMsg} - API endpoint may have changed`);
      } else if (errorMsg.includes('timeout') || errorMsg.includes('ECONNRESET')) {
        this.addLog('error', `Convertiser API connection error: ${errorMsg} - API server may be unreachable`);
      } else {
        this.addLog('error', `Convertiser API error: ${errorMsg}`);
      }
      
      return [];
    }
  }

  /**
   * Fetch offers from Convertiser
   * Convertiser Offers API provides direct merchant offers with tracking links
   * Use this mode for direct affiliate monetization
   */
  private async fetchFromConvertiserOffers(searchQuery: string, maxResults: number) {
    try {
      // Check if token is available before importing client
      if (!process.env.CONVERTISER_API_TOKEN) {
        this.addLog('warn', 'Convertiser API token not configured (CONVERTISER_API_TOKEN env var missing)');
        return [];
      }

      const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
      const client = getConvertiserClient();

      this.addLog('info', `Fetching offers from Convertiser: "${searchQuery || 'all'}"`);

      let offers: any[] = [];
      if (searchQuery && searchQuery.trim()) {
        const response = await client.findOffers({
          q: searchQuery,
          country: 'PL',
          status: 'active',
          page: 1,
          page_size: Math.min(maxResults, 50),
        });

        const minimal = response.results || [];
        offers = await Promise.all(
          minimal.map(async (offer: any) => {
            try {
              return await client.getOfferDetail(offer.id || offer.uuid || offer.offer_id);
            } catch {
              return offer;
            }
          })
        );
      } else {
        const response = await client.listOffers(
          {
            page: 1,
            page_size: Math.min(maxResults, 50),
          },
          {
            status: 'active',
            country: 'PL',
          }
        );
        offers = response.results || [];
      }

      if (!offers || offers.length === 0) {
        this.addLog('warn', `Convertiser Offers: No offers found for "${searchQuery}"`);
        return [];
      }

      this.addLog('info', `Found ${offers.length} offers from Convertiser`);

      const rawProducts = offers
        .map((offer: any) => this.mapConvertiserOfferToRawProduct(offer))
        .filter((p: any): p is RawProduct => p !== null);

      return rawProducts;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMsg.includes('token') || errorMsg.includes('Token')) {
        this.addLog('error', `Convertiser API authentication error: ${errorMsg} - Check CONVERTISER_API_TOKEN`);
      } else if (errorMsg.includes('404')) {
        this.addLog('error', `Convertiser API endpoint not found: ${errorMsg}`);
      } else if (errorMsg.includes('timeout') || errorMsg.includes('ECONNRESET')) {
        this.addLog('error', `Convertiser API connection error: ${errorMsg}`);
      } else {
        this.addLog('error', `Convertiser Offers API error: ${errorMsg}`);
      }
      
      return [];
    }
  }

  /**
   * AUTO-BROWSE: Pobierz cały katalog Convertiser bez keywords.
   * products -> products v2, offers -> listOffers, z paginacją.
   */
  private async fetchFromConvertiserAutoBrowse(
    maxResults: number = 10000,
    mode: 'products' | 'offers' = 'offers'
  ): Promise<RawProduct[]> {
    try {
      if (!process.env.CONVERTISER_API_TOKEN) {
        this.addLog('error', 'Convertiser API token not configured (CONVERTISER_API_TOKEN env var missing)');
        throw new Error('CONVERTISER_API_TOKEN missing');
      }

      const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
      const client = getConvertiserClient();

      const effectiveMode: 'products' | 'offers' = mode;
      this.addLog('info', `AUTO-BROWSE: Fetching ALL ${effectiveMode} (target: ${maxResults})`);

      let allProducts: RawProduct[] = [];
      let currentPage = 1;
      const pageSize = 100;
      let hasMore = true;

      while (hasMore && allProducts.length < maxResults) {
        try {
          if (effectiveMode === 'offers') {
            const response: any = await client.listOffers(
              {
                page: currentPage,
                page_size: Math.min(pageSize, maxResults - allProducts.length),
              },
              {
                status: 'active',
                country: 'PL',
              }
            );

            const offers = response.results || [];
            if (offers.length === 0) {
              hasMore = false;
              break;
            }

            const rawProducts = offers
              .map((offer: any) => this.mapConvertiserOfferToRawProduct(offer))
              .filter((p: any): p is RawProduct => p !== null);

            allProducts = allProducts.concat(rawProducts);

            if (!response.next || offers.length < pageSize) {
              hasMore = false;
            } else {
              currentPage++;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          } else {
            const response: any = await client.searchProductsV2(
              {
                country: 'PL',
              },
              {
                page: currentPage,
                page_size: Math.min(pageSize, maxResults - allProducts.length),
              }
            );

            const products = response.data || response.results || [];
            if (products.length === 0) {
              hasMore = false;
              break;
            }

            const rawProducts = await Promise.all(
              products.map(async (product: any) => {
                try {
                  const title = product.title || product.name || '';
                  if (!title) return null;

                  const imageUrl = product.images?.default || product.image_link || product.image_url || '';
                  if (!imageUrl || imageUrl.trim() === '') return null;

                  const parsePriceWithCurrency = (priceStr: string): { amount: number; currency: string } => {
                    if (!priceStr) return { amount: 0, currency: 'PLN' };
                    const str = String(priceStr);
                    const currencyMatch = str.match(/^([A-Z]{3})\s*([\d.,]+)/);
                    if (currencyMatch) {
                      return {
                        amount: parseFloat(currencyMatch[2].replace(',', '.')),
                        currency: currencyMatch[1],
                      };
                    }
                    const match = str.match(/[\d.,]+/);
                    return {
                      amount: match ? parseFloat(match[0].replace(',', '.')) : 0,
                      currency: 'PLN',
                    };
                  };

                  const salePriceParsed = parsePriceWithCurrency(product.sale_price || product.price);
                  const regularPriceParsed = parsePriceWithCurrency(product.price);

                  const price = salePriceParsed.currency !== 'PLN'
                    ? await convertToPLN(salePriceParsed.amount, salePriceParsed.currency as any)
                    : salePriceParsed.amount;

                  const originalPrice = regularPriceParsed.amount > salePriceParsed.amount
                    ? (regularPriceParsed.currency !== 'PLN'
                        ? await convertToPLN(regularPriceParsed.amount, regularPriceParsed.currency as any)
                        : regularPriceParsed.amount)
                    : 0;

                  return {
                    title,
                    description: product.description || product.desc || product.short_description || '',
                    imageUrl,
                    price,
                    originalPrice: originalPrice > price ? originalPrice : undefined,
                    currency: 'PLN',
                    shippingCost: product.shipping_cost ? parseFloat(product.shipping_cost) : 0,
                    shippingDays: product.shipping_days || 7,
                    sourceProductId: String(product.id || product.sku || ''),
                    sourceUrl: product.direct_link || product.link || product.url || '',
                    merchantName: product.offer || product.merchant || product.store_name || 'Convertiser',
                    merchantRating: product.merchant_rating ? parseFloat(product.merchant_rating) : 0,
                    specs: extractDimensionsFromTitle(title),
                    rating: product.rating ? parseFloat(product.rating) : 0,
                    ratingCount: product.review_count || product.reviews || 0,
                    images: [imageUrl],
                    sku: product.sku || undefined,
                    ean: product.ean || product.barcode || product.gtin || undefined,
                    gtin: product.gtin || undefined,
                    upc: product.upc || undefined,
                    mpn: product.mpn || undefined,
                  } as RawProduct;
                } catch {
                  return null;
                }
              })
            );

            allProducts = allProducts.concat(rawProducts.filter((p: any): p is RawProduct => p !== null));

            const nextPage = response.pagination?.next_page;
            if (!nextPage || products.length < pageSize) {
              hasMore = false;
            } else {
              currentPage = nextPage;
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } catch (pageError) {
          this.addLog('error', `Auto-browse page ${currentPage} failed`, pageError);
          hasMore = false;
        }
      }

      this.addLog('info', `AUTO-BROWSE COMPLETE: ${allProducts.length} items`);
      return allProducts;
    } catch (error) {
      this.addLog('error', 'Convertiser auto-browse error', error);
      return [];
    }
  }

  /**
   * Extract specs from product title using pattern matching
   */
  private extractSpecsFromTitle(title: string): Record<string, string> {
    const { extractDimensionsFromTitle } = require('@/lib/automation/identity-matcher');
    return extractDimensionsFromTitle(title);
  }

  /**
   * Find product by identity hash
   */
  private async findProductByIdentity(
    identityHash: string
  ): Promise<ProductCore | null> {
    try {
      const snapshot = await adminDb
        .collection('product_cores')
        .where('identityHash', '==', identityHash)
        .limit(1)
        .get();

      if (snapshot.empty) return null;
      return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as ProductCore;
    } catch (err) {
      this.addLog('error', 'Error finding product by identity', err);
      return null;
    }
  }

  /**
   * Find product by standard identifiers (EAN/GTIN/UPC/MPN)
   * PRIORITY MATCHING: Checks identifiers in order: EAN -> GTIN -> UPC -> MPN
   * Returns first match found
   */
  private async findProductByIdentifiers(
    identifiers: { ean?: string; gtin?: string; upc?: string; mpn?: string }
  ): Promise<ProductCore | null> {
    try {
      const { normalizeProductIdentifier } = await import('./identity-matcher');
      
      // Check EAN (most common in Europe)
      if (identifiers.ean) {
        const normalizedEan = normalizeProductIdentifier(identifiers.ean);
        const snapshot = await adminDb
          .collection('product_cores')
          .where('metadata.ean', '==', normalizedEan)
          .limit(1)
          .get();
        if (!snapshot.empty) {
          this.addLog('info', `Found product by EAN: ${normalizedEan}`);
          return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as ProductCore;
        }
      }
      
      // Check GTIN (global standard)
      if (identifiers.gtin) {
        const normalizedGtin = normalizeProductIdentifier(identifiers.gtin);
        const snapshot = await adminDb
          .collection('product_cores')
          .where('metadata.gtin', '==', normalizedGtin)
          .limit(1)
          .get();
        if (!snapshot.empty) {
          this.addLog('info', `Found product by GTIN: ${normalizedGtin}`);
          return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as ProductCore;
        }
      }
      
      // Check UPC (North America)
      if (identifiers.upc) {
        const normalizedUpc = normalizeProductIdentifier(identifiers.upc);
        const snapshot = await adminDb
          .collection('product_cores')
          .where('metadata.upc', '==', normalizedUpc)
          .limit(1)
          .get();
        if (!snapshot.empty) {
          this.addLog('info', `Found product by UPC: ${normalizedUpc}`);
          return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as ProductCore;
        }
      }
      
      // Check MPN (Manufacturer Part Number)
      if (identifiers.mpn) {
        const normalizedMpn = normalizeProductIdentifier(identifiers.mpn);
        const snapshot = await adminDb
          .collection('product_cores')
          .where('metadata.mpn', '==', normalizedMpn)
          .limit(1)
          .get();
        if (!snapshot.empty) {
          this.addLog('info', `Found product by MPN: ${normalizedMpn}`);
          return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as ProductCore;
        }
      }
      
      return null;
    } catch (err) {
      this.addLog('error', 'Error finding product by identifiers', err);
      return null;
    }
  }

  /**
   * Create a new ProductCore document with Deep Data enrichment
   */
  private async createProductCore(
    sourceProduct: any,
    identityHash: string,
    source: string,
    categoryInfo?: { mainCategorySlug: string; subCategorySlug: string; subSubCategorySlug?: string }
  ): Promise<string> {
    const now = new Date().toISOString();

    // Normalize identifiers for consistent matching
    const normalizedIdentifiers = {
      sku: sourceProduct.sku ? normalizeProductIdentifier(sourceProduct.sku) : undefined,
      ean: sourceProduct.ean ? normalizeProductIdentifier(sourceProduct.ean) : undefined,
      gtin: sourceProduct.gtin ? normalizeProductIdentifier(sourceProduct.gtin) : undefined,
      upc: sourceProduct.upc ? normalizeProductIdentifier(sourceProduct.upc) : undefined,
      mpn: sourceProduct.mpn ? normalizeProductIdentifier(sourceProduct.mpn) : undefined,
    };

    // Extract specs from title/description (fallback if not provided by source)
    const extractedSpecsFromTitle = extractDimensionsFromTitle(sourceProduct.title);
    const extractedSpecsFromDesc = sourceProduct.description
      ? extractDimensionsFromTitle(sourceProduct.description)
      : {};
    const extractedSpecs = { ...extractedSpecsFromTitle, ...extractedSpecsFromDesc };
    const specs = (sourceProduct.specs && Object.keys(sourceProduct.specs).length > 0)
      ? sourceProduct.specs
      : extractedSpecs;
    if (!specs || Object.keys(specs).length === 0) {
      specs.info = 'Brak danych specyfikacji';
    }

    // Add variants to specs if available (temporary solution until schema supports variants)
    if (sourceProduct.variants && Array.isArray(sourceProduct.variants) && sourceProduct.variants.length > 0) {
      sourceProduct.variants.forEach((variant: any, idx: number) => {
        const variantKey = `variant_${idx}_${variant.name?.toLowerCase() || 'option'}`;
        specs[variantKey] = Array.isArray(variant.values) ? variant.values.join(', ') : '';
        if (variant.sku) {
          specs[`${variantKey}_sku`] = variant.sku;
        }
      });
    }

    // Try to auto-map category from product text when categoryInfo is missing/uncategorized
    let mappedCategory = categoryInfo;
    let categoryMetadata: any = {}; // Store aliexpressCategoryIds & searchKeywords
    const stripHtml = (value: string) => (value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const specsText = specs && typeof specs === 'object'
      ? Object.entries(specs)
          .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(' ') : String(value ?? '')}`)
          .join(' ')
      : '';
    const categoryText = [sourceProduct.title, stripHtml(sourceProduct.description || ''), specsText]
      .filter(Boolean)
      .join(' ');

    try {
      const { matchCategoryByText, validateCategoryPath } = await import('@/lib/category-mapper');
      const hasCategory = mappedCategory?.mainCategorySlug && mappedCategory.mainCategorySlug !== 'uncategorized';
      if (hasCategory) {
        const isValid = await validateCategoryPath(
          mappedCategory?.mainCategorySlug,
          mappedCategory?.subCategorySlug,
          mappedCategory?.subSubCategorySlug
        );
        if (!isValid) {
          this.addLog('warn', `Invalid category path detected: ${mappedCategory?.mainCategorySlug}/${mappedCategory?.subCategorySlug}/${mappedCategory?.subSubCategorySlug || ''}`);
          mappedCategory = {
            mainCategorySlug: 'uncategorized',
            subCategorySlug: 'uncategorized',
          };
        }
      }

      const needsMapping = !mappedCategory || !mappedCategory.mainCategorySlug || mappedCategory.mainCategorySlug === 'uncategorized';
      if (needsMapping) {
        const match = await matchCategoryByText(categoryText);
        if (match) {
          mappedCategory = {
            mainCategorySlug: match.mainCategorySlug,
            subCategorySlug: match.subCategorySlug || 'uncategorized',
            subSubCategorySlug: match.subSubCategorySlug,
          };
          this.addLog('info', `Auto-mapped category: ${mappedCategory.mainCategorySlug}/${mappedCategory.subCategorySlug}/${mappedCategory.subSubCategorySlug || ''}`);
        }
      }

      // Fetch category metadata (aliexpressCategoryIds, searchKeywords) from Firestore
      if (mappedCategory?.mainCategorySlug && mappedCategory.mainCategorySlug !== 'uncategorized') {
        try {
          const mainCatRef = adminDb.collection('categories').doc(mappedCategory.mainCategorySlug);
          const subCatRef = mainCatRef.collection('subcategories').doc(mappedCategory.subCategorySlug);
          
          // Try to get sub-subcategory metadata if available
          if (mappedCategory.subSubCategorySlug) {
            const subSubRef = subCatRef.collection('subcategories').doc(mappedCategory.subSubCategorySlug);
            const subSubDoc = await subSubRef.get();
            if (subSubDoc.exists) {
              const subSubData = subSubDoc.data();
              categoryMetadata.aliexpressCategoryIds = subSubData?.aliexpressCategoryIds || [];
              categoryMetadata.searchKeywords = subSubData?.searchKeywords || [];
            }
          } else {
            // Fallback to sub-category level
            const subDoc = await subCatRef.get();
            if (subDoc.exists) {
              const subData = subDoc.data();
              categoryMetadata.aliexpressCategoryIds = subData?.aliexpressCategoryIds || [];
              categoryMetadata.searchKeywords = subData?.searchKeywords || [];
            }
          }
          
          if (categoryMetadata.aliexpressCategoryIds?.length > 0) {
            this.addLog('info', `Category enriched with AliExpress IDs: ${categoryMetadata.aliexpressCategoryIds.join(', ')}`);
          }
        } catch (e) {
          this.addLog('warn', 'Failed to fetch category metadata from Firestore', e);
        }
      }
    } catch (e) {
      this.addLog('warn', 'Category auto-mapping failed', e);
    }

    // ========================================================================
    // DEEP DATA ENRICHMENT - Extract structured data from AliExpress
    // ========================================================================
    let deepData: Partial<ProductCore> = {};
    
    if (source === 'aliexpress' && sourceProduct.sourceProductId) {
      try {
        // Deep Data mapper deprecated (consolidated). Skipping AliExpress deep extraction here.
        this.addLog('info', 'Deep Data mapper deprecated for AliExpress in harvester – skipping.');
      } catch (err) {
        this.addLog('warn', 'Deep Data mapper error', err);
      }
    }

    const baseDescription = (sourceProduct.description || '').trim() || `Produkt z ${source}`;
    const product: ProductCore = {
      id: '', // Will be set by Firestore
      identityHash,
      title: {
        pl: sourceProduct.title,
        en: sourceProduct.title, // TODO: Translate via AI
        de: sourceProduct.title, // TODO: Translate via AI
      },
      shortDescription: {
        pl: baseDescription,
        en: baseDescription,
        de: baseDescription,
      },
      fullDescription: {
        pl: baseDescription,
        en: baseDescription,
        de: baseDescription,
      },
      description: {
        pl: baseDescription,
        en: baseDescription,
        de: baseDescription,
      },
      specs,
      
      // Deep Data fields (if extracted)
      ...deepData,
      
      mainCategorySlug: mappedCategory?.mainCategorySlug || 'uncategorized',
      subCategorySlug: mappedCategory?.subCategorySlug || 'uncategorized',
      subSubCategorySlug: mappedCategory?.subSubCategorySlug,
      images: sourceProduct.images && sourceProduct.images.length > 0 ? sourceProduct.images : [sourceProduct.imageUrl],
      primaryImageHash: calculateImageHash(sourceProduct.imageUrl),
      videoUrl: sourceProduct.videoUrl,
      reviewsSummary: {
        pl: 'No reviews yet',
        en: 'No reviews yet',
        de: 'No reviews yet',
      },
      rating: {
        score: sourceProduct.rating || 0,
        // Polepszenie: użyj evaluateCount jeśli ratingCount nie dostępny (AliExpress API)
        count: sourceProduct.ratingCount || sourceProduct.evaluateCount || 0,
        provider: 'mixed' as any, // Harvester sources are external
      },
      ratingSources: (sourceProduct.rating || sourceProduct.ratingCount || sourceProduct.evaluateCount) ? {
        external: {
          average: sourceProduct.rating || 0,
          count: sourceProduct.ratingCount || sourceProduct.evaluateCount || 0,
          source: source,
          updatedAt: now,
        },
      } : undefined,
      ratingCard: {
        average: sourceProduct.rating || 0,
        count: sourceProduct.ratingCount || sourceProduct.evaluateCount || 0,
        durability: 0,
        easeOfUse: 0,
        valueForMoney: 0,
        versatility: 0,
      },
      bestPrice: {
        amount: sourceProduct.price,
        currency: sourceProduct.currency || 'PLN', // M6: sourceProduct.currency is now PLN after conversion
      },
      linkedDealIds: [],
      searchTags: categoryMetadata.searchKeywords || [],
      status: 'draft', // Harvested products require moderation before approval
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: source as any,
        originalId: sourceProduct.sourceProductId,
        importedAt: now,
        harvesterJobId: this.jobId,
        // Save original raw data for moderation/comparison
        originalTitle: sourceProduct.title,
        originalDescription: sourceProduct.description || '',
        originalUrl: sourceProduct.sourceUrl,
        // NEW: AliExpress category IDs for hot-products mode
        aliexpressCategoryIds: categoryMetadata.aliexpressCategoryIds || [],
        // Product identifiers (critical for deduplication & SEO)
        ...normalizedIdentifiers,
        // Spójne metadane dla kart Product/Deal
        store: {
          name: sourceProduct.merchantName || source,
          rating: sourceProduct.merchantRating,
          url: sourceProduct.sourceUrl,
        },
        shipping: {
          cost: sourceProduct.shippingCost ?? 0,
          days: sourceProduct.shippingDays ?? 7,
          shipsFrom: (sourceProduct as any).shipsFrom,
        },
        specifications: specs,
      } as any,
    };

    const docRef = await adminDb.collection('product_cores').add(product);
    const productId = docRef.id;

    // ========================================================================
    // NO AI REFINEMENT FOR DRAFT PRODUCTS
    // ========================================================================
    // Draft products require moderation (admin approval) before AI enrichment.
    // Refinement will be triggered AFTER admin approval via separate endpoint.
    // This allows admins to review raw product data before AI transformation.
    
    this.addLog('info', `Created draft product ${productId} - awaiting moderation before AI refinement`);

    return productId;
  }

  /**
   * Create a new Deal document using M6 Deal schema
   */
  private async createDeal(
    productId: string,
    sourceProduct: RawProduct,
    source: 'aliexpress' | 'amazon' | 'allegro' | 'convertiser'
  ): Promise<string> {
    if (!productId || typeof productId !== 'string') {
      throw new Error('Invalid productId for deal creation');
    }

    // Pobierz ProductCore aby uzupełnić pola legacy wymagane przez UI
    const productSnap = await adminDb.collection('product_cores').doc(productId).get();
    const product = productSnap.exists ? (productSnap.data() as ProductCore) : null;
    const primaryImage = sourceProduct.imageUrl || product?.images?.[0];

    if (!primaryImage) {
      throw new Error('Cannot create deal without image');
    }

    const now = new Date().toISOString();
    let mainCategorySlug = product?.mainCategorySlug || 'uncategorized';
    let subCategorySlug = product?.subCategorySlug || 'uncategorized';
    let subSubCategorySlug = product?.subSubCategorySlug;
    const isOfferPromotion = sourceProduct.offerMeta?.promotionType === 'offer';
    let affiliateLink = sourceProduct.sourceUrl;

    if (source === 'convertiser' && sourceProduct.sourceProductId) {
      try {
        const { getConvertiserClient } = await import('@/lib/integrations/convertiser-client');
        const client = getConvertiserClient();
        const tracking = isOfferPromotion
          ? await client.generateOfferTrackingLink(sourceProduct.sourceProductId)
          : await client.generateProductTrackingLink(sourceProduct.sourceProductId);
        const resolved = (tracking as any)?.tracking_link
          || (tracking as any)?.url
          || (tracking as any)?.link;
        if (resolved) {
          affiliateLink = resolved;
        }
      } catch (err) {
        this.addLog('warn', `Nie udało się wygenerować linku afiliacyjnego Convertiser dla ${sourceProduct.sourceProductId}`, err);
      }
    }

    // If product has no category, attempt to map and persist
    if (!product || !product.mainCategorySlug || product.mainCategorySlug === 'uncategorized') {
      try {
        const { ensureProductCategory } = await import('@/lib/category-mapper');
        const dealSpecsText = sourceProduct?.specs && typeof sourceProduct.specs === 'object'
          ? Object.entries(sourceProduct.specs)
              .map(([key, value]) => `${key} ${Array.isArray(value) ? value.join(' ') : String(value ?? '')}`)
              .join(' ')
          : '';
        const mapped = await ensureProductCategory(productId, [sourceProduct.title, sourceProduct.description || '', dealSpecsText]);
        if (mapped) {
          mainCategorySlug = mapped.mainCategorySlug;
          subCategorySlug = mapped.subCategorySlug || subCategorySlug;
          subSubCategorySlug = mapped.subSubCategorySlug || subSubCategorySlug;
          this.addLog('info', `Deal category mapped: ${mainCategorySlug}/${subCategorySlug}/${subSubCategorySlug || ''}`);
        }
      } catch (e) {
        this.addLog('warn', 'Deal category mapping failed', e);
      }
    }

    // Przechowujemy pola M6 oraz legacy, aby UI nie dostawał pustych/mocked rekordów
    const dealDescriptionText = (sourceProduct.description || '').trim()
      || (typeof product?.shortDescription === 'object'
        ? (product.shortDescription.pl || product.shortDescription.en || product.shortDescription.de || '')
        : (product?.shortDescription || ''))
      || sourceProduct.title;
    const deal: any = {
      // M6 fields
      productCoreId: productId,  // M6: Link to ProductCore
      price: {
        amount: sourceProduct.price,
        currency: sourceProduct.currency || 'PLN',
      },
      // Legacy fields for compatibility
      priceV2: {
        amount: sourceProduct.price,
        currency: sourceProduct.currency || 'PLN',
      },
      legacyPrice: sourceProduct.price, // for old code
      originalPrice: sourceProduct.originalPrice ?? sourceProduct.price,
      shipping: {
        cost: sourceProduct.shippingCost || 0,
        timeDays: sourceProduct.shippingDays || 7,
      },
      shippingCost: sourceProduct.shippingCost || 0,
      source: source as any,
      affiliateLink,
      link: affiliateLink,
      merchantName: sourceProduct.merchantName || source,
      merchant: sourceProduct.merchantName || source,
      merchantRating: sourceProduct.merchantRating,
      seller: {
        name: sourceProduct.merchantName || source,
        url: sourceProduct.sourceUrl,
        rating: sourceProduct.merchantRating,
      },
      salesMetrics: {
        // Polepszenie: użyj soldCount z AliExpress (dla popularity sorting)
        soldCount: sourceProduct.soldCount || sourceProduct.evaluateCount || 0,
        // Polepszenie: użyj evaluateCount jeśli ratingCount nie dostępny
        reviewCount: sourceProduct.ratingCount || sourceProduct.evaluateCount || 0,
        avgRating: sourceProduct.rating || 0,
      },
      // M6: Use sourceProduct title if available, otherwise fallback to ProductCore title (NEVER empty)
      title: sourceProduct.title && sourceProduct.title.trim() ? {
        pl: sourceProduct.title,
        en: sourceProduct.title,
        de: sourceProduct.title,
      } : {
        pl: product.title.pl,
        en: product.title.en,
        de: product.title.de,
      } as LocalizedText,
      description: {
        pl: dealDescriptionText,
        en: dealDescriptionText,
        de: dealDescriptionText,
      } as LocalizedText,
      discountPercent: sourceProduct.discountPercent,
      couponCode: sourceProduct.couponCode,
      expiryDate: sourceProduct.expiryDate,
      conditions: sourceProduct.conditions,
      freeShipping: sourceProduct.freeShipping,
      minOrderValue: typeof sourceProduct.minOrderValue === 'number' && sourceProduct.minOrderValue > 0
        ? sourceProduct.minOrderValue
        : undefined,
      limitPerUser: typeof sourceProduct.limitPerUser === 'number' && sourceProduct.limitPerUser > 0
        ? sourceProduct.limitPerUser
        : undefined,
      requiresMembership: sourceProduct.requiresMembership,
      stockStatus: 'in_stock',
      isActive: true,
      priceHistory: [
        {
          date: new Date().toISOString().split('T')[0],
          price: sourceProduct.price,
          currency: sourceProduct.currency || 'PLN',
          lowestPrice: sourceProduct.price,
        },
      ],
      voteCount: 0,
      temperature: 0,
      commentsCount: 0,
      status: 'draft', // Harvested deals require moderation before approval
      sourceProductId: sourceProduct.sourceProductId,
      sourceUrl: affiliateLink,
      createdAt: now,
      updatedAt: now,
      postedAt: now,
      postedBy: 'harvester',
      category: `${mainCategorySlug}${subCategorySlug ? '/' + subCategorySlug : ''}${subSubCategorySlug ? '/' + subSubCategorySlug : ''}`,
      mainCategorySlug,
      subCategorySlug,
      subSubCategorySlug,
      image: primaryImage,
      imageHint: sourceProduct.imageUrl || primaryImage,
      gallery: product?.images || [primaryImage],
      linkedProductIds: [productId],
      dealType: isOfferPromotion ? 'coupon' : 'sale',
      tags: product?.searchTags || [],
      // M6 ADDITION: Store original currency and price for auto-price-updates (Cloud Function)
      metadata: {
        promotionType: isOfferPromotion ? 'offer' : undefined,
        offerTerms: sourceProduct.offerMeta?.terms,
        offerPreviewUrl: sourceProduct.offerMeta?.previewUrl,
        hasCoupons: sourceProduct.offerMeta?.hasCoupons,
        harvesterJobId: this.jobId,
        originalPriceUSD: sourceProduct.currency === 'USD' ? sourceProduct.price : undefined,
        originalPriceCurrency: sourceProduct.currency,
        exchangeRateAtImport: sourceProduct.currency === 'USD' 
          ? (sourceProduct.price > 0 ? sourceProduct.price / sourceProduct.price : 1.0)
          : undefined,
        lastPriceUpdate: now,
        importedAt: now,
        source: source,
        originalUrl: sourceProduct.sourceUrl,
        // Spójne metadane z ProductCore
        store: {
          name: sourceProduct.merchantName || source,
          rating: sourceProduct.merchantRating,
          url: sourceProduct.sourceUrl,
        },
        shipping: {
          cost: sourceProduct.shippingCost,
          days: sourceProduct.shippingDays,
          shipsFrom: (sourceProduct as any).shipsFrom,
        },
        specifications: (product as any)?.specs || sourceProduct.specs,
      },
    };

    const docRef = await adminDb.collection('deals').add(deal);
    return docRef.id;
  }

  /**
   * Update ProductCore with new deal reference and recalculate best price
   */
  private async updateProductBestPrice(productId: string): Promise<void> {
    if (!productId || typeof productId !== 'string') return;
    // Fetch all deals for this product (don't filter by isActive - might not exist)
    const dealsSnapshot = await adminDb
      .collection('deals')
      .where('productCoreId', '==', productId)
      .get();

    if (dealsSnapshot.empty) {
      this.addLog('warn', `No deals found for product ${productId}, setting bestPrice to 0`);
      return;
    }

    // Find the best (lowest) total price (product price + shipping)
    let bestPrice = Infinity;
    let bestCurrency = 'PLN';
    let bestDealId: string | null = null;
    let validDealsCount = 0;

    for (const dealDoc of dealsSnapshot.docs) {
      const deal = dealDoc.data() as DealM6;
      
      // Support both M6 format {amount, currency} and legacy format (number)
      let priceAmount = 0;
      let priceCurrency = 'PLN';
      
      if (deal.price?.amount !== undefined) {
        // M6 format: {amount, currency}
        priceAmount = deal.price.amount;
        priceCurrency = deal.price.currency || 'PLN';
      } else if (typeof deal.price === 'number') {
        // Legacy format: number
        priceAmount = deal.price;
      }
      
      const shippingCost = (deal.shipping?.cost as any) || 0;
      const totalPrice = priceAmount + shippingCost;
      
      // Skip deals with 0 price
      if (totalPrice <= 0) continue;
      
      validDealsCount++;
      
      // TODO: Normalize currency to PLN for comparison
      if (totalPrice < bestPrice) {
        bestPrice = totalPrice;
        bestCurrency = priceCurrency;
        bestDealId = dealDoc.id;
      }
    }

    this.addLog('info', `Product ${productId}: ${dealsSnapshot.size} deals total, ${validDealsCount} valid, best price: ${bestPrice !== Infinity ? bestPrice : 0}`);

    // Update product with new best price (M6: bestPrice is {amount, currency})
    const productRef = adminDb.collection('product_cores').doc(productId);
    await productRef.update({
      bestPrice: {
        amount: bestPrice !== Infinity ? bestPrice : 0,
        currency: bestCurrency, // should be PLN
      },
      bestTotalPrice: bestPrice !== Infinity ? bestPrice : 0,
      bestDealId: bestDealId || null,
      linkedDealIds: dealsSnapshot.docs.map(d => d.id),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Record identity match for future lookups
   */
  private async recordIdentityMatch(
    identityHash: string,
    productId: string,
    source: string,
    sourceProductId?: string
  ): Promise<void> {
    const match: IdentityMatch = {
      id: '', // Will be set by Firestore
      titleHash: identityHash.slice(0, 32), // First 32 chars
      primaryImageHash: identityHash.slice(32, 64), // Next 32 chars (simulated)
      combinedHash: identityHash,
      productId,
      source,
      sourceProductId,
      confidence: 1.0,
      createdAt: new Date().toISOString(),
    };

    await adminDb.collection('identity_matches').add(match);
  }

  /**
   * Check if job is still active (not paused/cancelled)
   */
  private async isJobActive(): Promise<boolean> {
    try {
      const doc = await adminDb.collection('harvester_jobs').doc(this.jobId).get();
      if (!doc.exists) return false;
      const status = doc.data()?.status;
      return status === 'running';
    } catch (e) {
      console.error('Failed to check job status', e);
      return true; // Keep running on temporary DB error
    }
  }

  /**
   * Update the harvester job record in Firestore
   */
  private async updateJobRecord(job: HarvesterJob): Promise<void> {
    const jobRef = adminDb.collection('harvester_jobs').doc(this.jobId);
    await jobRef.set({
      id: job.id,
      source: job.source,
      query: job.query,
      maxResults: job.maxResults,
      status: job.status,
      productsFound: job.productsFound,
      productsCreated: job.productsCreated,
      dealsCreated: job.dealsCreated,
      duplicatesSkipped: job.duplicatesSkipped,
      errors: job.errors || [],
      processedCategories: job.processedCategories || [],
      currentCategory: job.currentCategory || null,
      totalCategories: job.totalCategories || 0,
      startedAt: job.startedAt,
      completedAt: job.completedAt || null,
      lastUpdatedAt: job.lastUpdatedAt,
      logs: job.logs || [],
    }, { merge: true });
  }
}

/**
 * Helper: Start a new harvest job
 */
export async function startHarvesterJob(
  source: 'aliexpress' | 'amazon' | 'allegro',
  query: string,
  maxResults: number = 50
): Promise<HarvesterJob> {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // Create job record
  const jobRecord: HarvesterJob = {
    id: jobId,
    status: 'running',
    source,
    query,
    maxResults,
    productsFound: 0,
    productsCreated: 0,
    dealsCreated: 0,
    duplicatesSkipped: 0,
    errors: [],
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    logs: [],
  };

  await adminDb.collection('harvester_jobs').add(jobRecord);

  // Run harvester
  const harvester = new SmartHarvester(jobId);
  return await harvester.harvestProducts(source, query, maxResults);
}
