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
import { convertToPLN } from '@/lib/currency-exchange';

/**
 * Raw product data from external APIs (before transformation)
 */
interface RawProduct {
  title: string;
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
   */
  async harvestProducts(
    source: 'aliexpress' | 'amazon' | 'allegro',
    query: string,
    maxResults: number = 50,
    categories?: string[], // e.g., ['phones/flagship', 'phones/budget', 'tablets/android']
    isTreeMode: boolean = false // True when harvesting from category tree
  ): Promise<HarvesterJob> {
    const jobStartTime = new Date().toISOString();
    
    // For tree mode, use categories; otherwise use the query parameter
    const queries = (isTreeMode && categories && categories.length > 0) ? categories : [query];
    
    this.addLog('info', `Starting harvest job: source=${source}, mode=${isTreeMode ? 'category-tree' : 'single'}, queries=${queries.join(', ')}, maxResults=${maxResults}`);

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

    try {
      // Iterate through all provided queries/categories
      for (const currentQuery of queries) {
        this.addLog('info', `Processing query/category: ${currentQuery}`);
        
        try {
          // Step 1: Fetch products from source API
          // For tree mode: extract category name from path (e.g., 'electronics/phones/flagship' -> 'flagship')
          const searchTerm = isTreeMode 
            ? currentQuery.split('/').pop() || currentQuery 
            : currentQuery;
            
          const sourceProducts = await this.fetchFromSource(source, searchTerm, maxResults, isTreeMode);
          
          // For category-tree mode: Filter by rating/quality (top products only)
          let filteredProducts = sourceProducts;
          if (isTreeMode && sourceProducts.length > 0) {
            filteredProducts = this.filterTopQualityProducts(sourceProducts, Math.ceil(maxResults * 0.6));
          }
          
          productsFound += sourceProducts.length;
          this.addLog('info', `Fetched ${sourceProducts.length} products from ${source} for "${currentQuery}", using ${filteredProducts.length} after quality filter`);

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

                // Update product's best price
                await this.updateProductBestPrice(existingProduct.id);
                duplicatesSkipped++;
              } else {
                // New product: Create ProductCore + Deal
                this.addLog('info', `Creating new product for: ${sourceProduct.title}`);

                // Parse category hierarchy from query (e.g., 'electronics/phones/flagship')
                const categoryParts = currentQuery.split('/');
                const categoryInfo = {
                  mainCategorySlug: categoryParts[0] || 'uncategorized',
                  subCategorySlug: categoryParts[1] || 'uncategorized',
                  subSubCategorySlug: categoryParts[2] || undefined,
                };

                const productId = await this.createProductCore(
                  sourceProduct,
                  identityHash,
                  source,
                  categoryInfo
                );
                productsCreated++;

                // Create associated deal
                const dealId = await this.createDeal(
                  productId,
                  sourceProduct,
                  source
                );
                dealsCreated++;

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
    source: 'aliexpress' | 'amazon' | 'allegro',
    searchQuery: string,
    maxResults: number,
    isTreeMode: boolean = false
  ): Promise<
    Array<{
      title: string;
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
    }>
  > {
    switch (source) {
      case 'aliexpress':
        return await this.fetchFromAliExpress(searchQuery, maxResults, isTreeMode);
      case 'amazon':
        return await this.fetchFromAmazon(searchQuery, maxResults);
      case 'allegro':
        return await this.fetchFromAllegro(searchQuery, maxResults);
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
      });
      
      if (!response.success || !response.products) {
        this.addLog('error', `AliExpress search failed: ${response.error?.message || 'Unknown error'}`);
        return [];
      }
      
      this.addLog('info', `Found ${response.products.length} products from AliExpress`);
      
      // Transform to RawProduct format with USD→PLN conversion
      return Promise.all(response.products.map(async (p: any) => {
        const sourcePrice = p.price?.current || 0;
        const sourceCurrency = p.price?.currency || 'USD';
        
        // M6 FIX: Convert to PLN if in USD
        let priceInPLN = sourcePrice;
        if (sourceCurrency === 'USD') {
          try {
            priceInPLN = await convertToPLN(sourcePrice, 'USD');
            this.addLog('info', `Price conversion: ${sourcePrice} USD → ${priceInPLN} PLN`);
          } catch (error) {
            this.addLog('warn', `Price conversion failed for ${sourcePrice} ${sourceCurrency}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Fallback: use 4.0 exchange rate
            priceInPLN = Math.round(sourcePrice * 4.0 * 100) / 100;
            this.addLog('warn', `Using fallback rate: ${sourcePrice} USD → ${priceInPLN} PLN`);
          }
        }
        
        // Same for original price
        const sourceOriginalPrice = p.price?.original || undefined;
        let originalPriceInPLN = sourceOriginalPrice;
        if (sourceOriginalPrice && sourceCurrency === 'USD') {
          try {
            originalPriceInPLN = await convertToPLN(sourceOriginalPrice, 'USD');
          } catch {
            originalPriceInPLN = Math.round(sourceOriginalPrice * 4.0 * 100) / 100;
          }
        }
        
        return {
          title: p.title || p.product_title || '',
          imageUrl: Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls[0] : '',
          price: priceInPLN,
          originalPrice: originalPriceInPLN, // Price before discount
          currency: 'PLN', // Always PLN after conversion
          shippingCost: p.shipping?.free ? 0 : (p.shipping?.cost || 0),
          shippingDays: 7, // Default estimate
          sourceProductId: String(p.item_id || p.product_id || ''),
          sourceUrl: p.product_url || '',
          videoUrl: p.product_video_url || p.video_url || undefined,
          merchantName: 'AliExpress',
          merchantRating: 4.0,
          specs: extractDimensionsFromTitle(p.title || ''),
          rating: p.rating?.score || 0,
          ratingCount: p.rating?.count || 0,
          images: Array.isArray(p.image_urls) ? p.image_urls : [], // Full gallery
          variants: Array.isArray(p.variants) ? p.variants : undefined, // Product variants (colors, sizes)
          // Product identifiers (for robust deduplication & SEO)
          sku: p.sku || undefined,
          ean: p.ean || p.barcode || undefined,
          gtin: p.gtin || undefined,
          upc: p.upc || undefined,
          mpn: p.mpn || p.manufacturer_part_number || undefined,
        };
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
   * Create a new ProductCore document
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

    // Extract specs from title (fallback if not provided by source)
    const extractedSpecs = extractDimensionsFromTitle(sourceProduct.title);
    const specs = sourceProduct.specs || extractedSpecs;

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

    // Try to auto-map category from product title when categoryInfo is missing/uncategorized
    let mappedCategory = categoryInfo;
    let categoryMetadata: any = {}; // NEW: Store aliexpressCategoryIds & searchKeywords
    try {
      const needsMapping = !mappedCategory || !mappedCategory.mainCategorySlug || mappedCategory.mainCategorySlug === 'uncategorized';
      if (needsMapping) {
        const { matchCategoryByText } = await import('@/lib/category-mapper');
        const match = await matchCategoryByText(sourceProduct.title || '');
        if (match) {
          mappedCategory = {
            mainCategorySlug: match.mainCategorySlug,
            subCategorySlug: match.subCategorySlug || 'general',
            subSubCategorySlug: match.subSubCategorySlug,
          };
          this.addLog('info', `Auto-mapped category: ${mappedCategory.mainCategorySlug}/${mappedCategory.subCategorySlug}/${mappedCategory.subSubCategorySlug || ''}`);
        }
      }

      // NEW: Fetch category metadata (aliexpressCategoryIds, searchKeywords) from Firestore
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

    const product: ProductCore = {
      id: '', // Will be set by Firestore
      identityHash,
      title: {
        pl: sourceProduct.title,
        en: sourceProduct.title, // TODO: Translate via AI
        de: sourceProduct.title, // TODO: Translate via AI
      },
      shortDescription: {
        pl: `Product from ${source}`,
        en: `Product from ${source}`,
        de: `Product from ${source}`,
      },
      fullDescription: {
        pl: '',
        en: '',
      },
      specs,
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
      bestPrice: {
        amount: sourceProduct.price,
        currency: sourceProduct.currency || 'PLN', // M6: sourceProduct.currency is now PLN after conversion
      },
      linkedDealIds: [],
      searchTags: categoryMetadata.searchKeywords || [],
      status: 'pending_approval', // Requires AI enrichment before approval
      createdAt: now,
      updatedAt: now,
      metadata: {
        source: source as any,
        originalId: sourceProduct.sourceProductId,
        importedAt: now,
        // NEW: AliExpress category IDs for hot-products mode
        aliexpressCategoryIds: categoryMetadata.aliexpressCategoryIds || [],
        // Product identifiers (critical for deduplication & SEO)
        ...normalizedIdentifiers,
      } as any,
    };

    const docRef = await adminDb.collection('product_cores').add(product);
    return docRef.id;
  }

  /**
   * Create a new Deal document using M6 Deal schema
   */
  private async createDeal(
    productId: string,
    sourceProduct: RawProduct,
    source: 'aliexpress' | 'amazon' | 'allegro'
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

    // If product has no category, attempt to map and persist
    if (!product || !product.mainCategorySlug || product.mainCategorySlug === 'uncategorized') {
      try {
        const { ensureProductCategory } = await import('@/lib/category-mapper');
        const mapped = await ensureProductCategory(productId, sourceProduct.title);
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
    const deal: any = {
      // M6 fields
      productCoreId: productId,  // M6: Link to ProductCore
      priceV2: {
        amount: sourceProduct.price,
        currency: sourceProduct.currency || 'PLN',
      },
      price: sourceProduct.price, // legacy pole wymagane przez UI
      originalPrice: sourceProduct.originalPrice ?? sourceProduct.price,
      shipping: {
        cost: sourceProduct.shippingCost || 0,
        timeDays: sourceProduct.shippingDays || 7,
      },
      shippingCost: sourceProduct.shippingCost || 0,
      source: source as any,
      affiliateLink: sourceProduct.sourceUrl,
      link: sourceProduct.sourceUrl,
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
      title: sourceProduct.title || 'Produkt',
      description: typeof product?.shortDescription === 'object' 
        ? (product.shortDescription.pl || product.shortDescription.en || '') 
        : (product?.shortDescription || ''),
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
      status: 'approved',
      sourceProductId: sourceProduct.sourceProductId,
      sourceUrl: sourceProduct.sourceUrl,
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
      dealType: 'sale',
      tags: product?.searchTags || [],
    };

    const docRef = await adminDb.collection('deals').add(deal);
    return docRef.id;
  }

  /**
   * Update ProductCore with new deal reference and recalculate best price
   */
  private async updateProductBestPrice(productId: string): Promise<void> {
    if (!productId || typeof productId !== 'string') return;
    // Fetch all deals for this product
    const dealsSnapshot = await adminDb
      .collection('deals')
      .where('productCoreId', '==', productId)
      .where('isActive', '==', true)
      .get();

    if (dealsSnapshot.empty) return;

    // Find the best (lowest) total price (product price + shipping)
    let bestPrice = Infinity;
    let bestCurrency = 'PLN';
    let bestDealId: string | null = null;

    for (const dealDoc of dealsSnapshot.docs) {
      const deal = dealDoc.data() as DealM6;
      const totalPrice = (deal.price?.amount || 0) + ((deal.shipping?.cost as any) || 0);
      
      // TODO: Normalize currency to PLN for comparison
      if (totalPrice < bestPrice) {
        bestPrice = totalPrice;
        bestCurrency = deal.price.currency;
        bestDealId = dealDoc.id;
      }
    }

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
