import {
  collection,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
} from './identity-matcher';

/**
 * Raw product data from external APIs (before transformation)
 */
interface RawProduct {
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
  images?: string[];
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
   * Log an entry to the job
   */
  private addLog(
    level: 'info' | 'warn' | 'error',
    message: string,
    details?: any
  ) {
    this.logs.push({
      level,
      message,
      timestamp: new Date().toISOString(),
      details,
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
    categories?: string[] // e.g., ['phones/flagship', 'phones/budget', 'tablets/android']
  ): Promise<HarvesterJob> {
    const jobStartTime = new Date().toISOString();
    const queries = categories && categories.length > 0 ? categories : [query];
    
    this.addLog('info', `Starting harvest job: source=${source}, queries=${queries.join(', ')}, maxResults=${maxResults}`);

    let productsFound = 0;
    let productsCreated = 0;
    let dealsCreated = 0;
    let duplicatesSkipped = 0;
    const errors: HarvesterJob['errors'] = [];

    try {
      // Iterate through all provided queries/categories
      for (const currentQuery of queries) {
        this.addLog('info', `Processing query/category: ${currentQuery}`);
        
        try {
          // Step 1: Fetch products from source API
          const sourceProducts = await this.fetchFromSource(source, currentQuery, maxResults);
          productsFound += sourceProducts.length;
          this.addLog('info', `Fetched ${sourceProducts.length} products from ${source} for query "${currentQuery}"`);

          // Step 2: Process each product (create or link)
          for (const sourceProduct of sourceProducts) {
            try {
              const identityHash = calculateIdentityHash(
                sourceProduct.title,
                sourceProduct.imageUrl
              );

              // Check if this product already exists
              const existingProduct = await this.findProductByIdentity(identityHash);

              if (existingProduct) {
                // Existing product: Create new Deal
                this.addLog(
                  'info',
                  `Found existing product ${existingProduct.id}, creating new deal`
                );

                const dealId = await this.createDeal(
                  existingProduct.id,
                  sourceProduct,
                  source
                );
                dealsCreated++;

                // Update product's best price
                await this.updateProductBestPrice(existingProduct.id);
                duplicatesSkipped++;
              } else {
                // New product: Create ProductCore + Deal
                this.addLog('info', `Creating new product for: ${sourceProduct.title}`);

                const productId = await this.createProductCore(
                  sourceProduct,
                  identityHash,
                  source
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
    maxResults: number
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
        return await this.fetchFromAliExpress(searchQuery, maxResults);
      case 'amazon':
        return await this.fetchFromAmazon(searchQuery, maxResults);
      case 'allegro':
        return await this.fetchFromAllegro(searchQuery, maxResults);
      default:
        throw new Error(`Unknown source: ${source}`);
    }
  }

  /**
   * Fetch products from AliExpress using real API
   * Integrated with production AliExpress client
   */
  private async fetchFromAliExpress(searchQuery: string, maxResults: number) {
    try {
      const { createAliExpressClient } = await import('@/integrations/aliexpress/client');
      const client = createAliExpressClient();
      
      this.addLog('info', `Fetching from AliExpress: "${searchQuery}"`);
      
      const response = await client.searchProducts({
        q: searchQuery,
        pageSize: Math.min(maxResults, 50),
        targetCurrency: 'PLN',
        targetLanguage: 'PL',
        sort: 'price_asc', // Fixed: use proper sort value
      });
      
      if (!response.success || !response.products) {
        this.addLog('error', `AliExpress search failed: ${response.error?.message || 'Unknown error'}`);
        return [];
      }
      
      this.addLog('info', `Found ${response.products.length} products from AliExpress`);
      
      // Transform to RawProduct format
      return response.products.map((p: any) => ({
        title: p.title || p.product_title || '',
        imageUrl: Array.isArray(p.image_urls) && p.image_urls.length > 0 ? p.image_urls[0] : '',
        price: p.price?.current || 0,
        currency: p.price?.currency || 'PLN',
        shippingCost: p.shipping?.free ? 0 : (p.shipping?.cost || 0),
        shippingDays: 7, // Default estimate
        sourceProductId: String(p.item_id || p.product_id || ''),
        sourceUrl: p.product_url || '',
        merchantName: 'AliExpress',
        merchantRating: 4.0,
        specs: extractDimensionsFromTitle(p.title || ''),
        rating: p.rating?.score || 0,
        ratingCount: p.rating?.count || 0,
        images: Array.isArray(p.image_urls) ? p.image_urls : [],
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
      const q = query(
        collection(db, 'product_cores'),
        where('identityHash', '==', identityHash)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) return null;
      return snapshot.docs[0].data() as ProductCore;
    } catch (err) {
      this.addLog('error', 'Error finding product by identity', err);
      return null;
    }
  }

  /**
   * Create a new ProductCore document
   */
  private async createProductCore(
    sourceProduct: any,
    identityHash: string,
    source: string
  ): Promise<string> {
    const now = new Date().toISOString();

    // Extract specs from title (fallback if not provided by source)
    const extractedSpecs = extractDimensionsFromTitle(sourceProduct.title);
    const specs = sourceProduct.specs || extractedSpecs;

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
      mainCategorySlug: 'uncategorized',
      subCategorySlug: 'uncategorized',
      images: [sourceProduct.imageUrl],
      primaryImageHash: calculateImageHash(sourceProduct.imageUrl),
      reviewsSummary: {
        pl: 'No reviews yet',
        en: 'No reviews yet',
        de: 'No reviews yet',
      },
      rating: {
        score: sourceProduct.rating || 0,
        count: sourceProduct.ratingCount || 0,
        provider: 'mixed' as any, // Harvester sources are external
      },
      bestPrice: {
        amount: sourceProduct.price,
        currency: 'USD', // M6: Store in USD for consistency
      },
      bestPriceCurrency: sourceProduct.currency || 'PLN',
      linkedDealIds: [],
      searchTags: [],
      status: 'pending_approval', // Requires AI enrichment before approval
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, 'product_cores'), product);
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
    const now = new Date().toISOString();

    const deal: Partial<DealM6> = {
      productId,
      price: {
        amount: sourceProduct.price,
        currency: sourceProduct.currency || 'PLN',
      },
      originalPrice: sourceProduct.price, // TODO: Extract discount price if available
      shipping: {
        cost: sourceProduct.shippingCost || 0,
        timeDays: sourceProduct.shippingDays || 7,
      },
      source: source as any, // External sources (aliexpress/amazon/allegro)
      affiliateLink: sourceProduct.sourceUrl,
      merchantName: sourceProduct.merchantName || source,
      merchantRating: sourceProduct.merchantRating,
      title: {
        pl: sourceProduct.title,
        en: sourceProduct.title,
        de: sourceProduct.title,
      },
      stockStatus: 'in_stock',
      isActive: true,
      priceHistory: [
        {
          date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
          price: sourceProduct.price,
          currency: sourceProduct.currency || 'PLN',
          lowestPrice: sourceProduct.price,
        },
      ],
      voteCount: 0,
      temperature: 0,
      commentsCount: 0,
      status: 'approved', // Auto-approve harvested deals
      sourceProductId: sourceProduct.sourceProductId,
      sourceUrl: sourceProduct.sourceUrl,
      createdAt: now,
      updatedAt: now,
    };

    const docRef = await addDoc(collection(db, 'deals'), deal);
    return docRef.id;
  }

  /**
   * Update ProductCore with new deal reference and recalculate best price
   */
  private async updateProductBestPrice(productId: string): Promise<void> {
    // Fetch all deals for this product
    const dealsQuery = query(
      collection(db, 'deals'),
      where('productId', '==', productId),
      where('isActive', '==', true)
    );
    const dealsSnapshot = await getDocs(dealsQuery);

    if (dealsSnapshot.empty) return;

    // Find the best (lowest) total price (product price + shipping)
    let bestPrice = Infinity;
    let bestCurrency = 'PLN';

    for (const dealDoc of dealsSnapshot.docs) {
      const deal = dealDoc.data() as DealM6;
      const totalPrice = deal.price.amount + (deal.shipping.cost || 0);
      
      // TODO: Normalize currency to PLN for comparison
      if (totalPrice < bestPrice) {
        bestPrice = totalPrice;
        bestCurrency = deal.price.currency;
      }
    }

    // Update product with new best price (M6: bestPrice is {amount, currency})
    const productRef = doc(db, 'product_cores', productId);
    await updateDoc(productRef, {
      bestPrice: {
        amount: bestPrice !== Infinity ? bestPrice : 0,
        currency: 'USD', // Store in USD for consistency per M6
      },
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

    await addDoc(collection(db, 'identity_matches'), match);
  }

  /**
   * Update the harvester job record in Firestore
   */
  private async updateJobRecord(job: HarvesterJob): Promise<void> {
    const jobRef = doc(db, 'harvester_jobs', this.jobId);
    await updateDoc(jobRef, {
      status: job.status,
      productsFound: job.productsFound,
      productsCreated: job.productsCreated,
      dealsCreated: job.dealsCreated,
      duplicatesSkipped: job.duplicatesSkipped,
      errors: job.errors,
      completedAt: job.completedAt,
      lastUpdatedAt: job.lastUpdatedAt,
      logs: job.logs,
    });
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

  await addDoc(collection(db, 'harvester_jobs'), jobRecord);

  // Run harvester
  const harvester = new SmartHarvester(jobId);
  return await harvester.harvestProducts(source, query, maxResults);
}
