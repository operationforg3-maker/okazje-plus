import { adminDb } from '@/lib/firebase-admin';
import { ProductCore, RefinerJob, LocalizedText } from '@/lib/types';

/**
 * AI Refiner - Enriches draft ProductCores with AI-generated content
 * - Cleans up specs from raw data
 * - Generates multilingual descriptions (PL/EN/DE)
 * - Creates review summaries based on ratings
 * - Updates status to pending_approval
 */
export class AIRefiner {
  private jobId: string;
  private logs: RefinerJob['logs'] = [];

  constructor(jobId: string) {
    this.jobId = jobId;
  }

  /**
   * Refine all existing products in database by status
   * Iterates through entire collection and enriches each product individually
   * 
   * @param status - Filter products by status (e.g., 'draft', 'pending_approval')
   * @param limit - Maximum products to refine in one job
   * @param refinationType - Type of refinement to apply
   */
  async refineExistingProducts(
    status?: string,
    limit: number = 100,
    refinationType: 'full_enrichment' | 'specs_cleanup' = 'full_enrichment'
  ): Promise<RefinerJob> {
    const jobStartTime = new Date().toISOString();
    let productsSuccessful = 0;
    let productsFailed = 0;
    const processedIds: string[] = [];

    try {
      this.addLog('info', `Starting DB refinement job: status=${status || 'all'}, limit=${limit}, type=${refinationType}`);

      // Build query to fetch products from database
      const productsRef = adminDb.collection('product_cores');
      const q = status
        ? productsRef.where('status', '==', status)
        : productsRef;

      const snapshot = await q.get();
      const totalProducts = snapshot.docs.length;
      this.addLog('info', `Found ${totalProducts} products to refine (limit: ${limit})`);

      let processCount = 0;

      // Iterate through each product document
      for (const doc of snapshot.docs) {
        if (processCount >= limit) {
          this.addLog('info', `Reached limit of ${limit} products. Stopping.`);
          break;
        }

        const productId = doc.id;
        const product = doc.data() as ProductCore;
        processedIds.push(productId);

        try {
          this.addLog('info', `Refining product ${processCount + 1}/${Math.min(limit, totalProducts)}: ${product.title.pl || 'Unknown'}`);

          // Perform refinement based on type
          const refined = await this.performRefinement(product, refinationType);

          // Update product in Firestore
          await this.updateProduct(productId, refined);

          this.addLog(
            'success',
            `Refined ${product.title.pl || 'Unknown'}`,
            { productId, refinationType }
          );
          productsSuccessful++;
        } catch (err) {
          this.addLog(
            'failed',
            `Failed to refine ${product.title.pl || 'Unknown'}`,
          );
          productsFailed++;
        }

        processCount++;
      }

      const job: RefinerJob = {
        id: this.jobId,
        status: 'completed',
        productIds: processedIds,
        refinationType,
        productsProcessed: processedIds.length,
        productsSuccessful,
        productsFailed,
        startedAt: jobStartTime,
        completedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        logs: this.logs,
      };

      await this.updateJobRecord(job);
      this.addLog('success', `DB refinement completed: ${productsSuccessful} successful, ${productsFailed} failed`);
      return job;
    } catch (err) {
      this.addLog('failed', 'DB refinement job failed');
      throw err;
    }
  }

  /**
   * Main entry point: Refine specific products by ID
   */
  async refineProducts(
    productIds: string[],
    refinationType: 'full_enrichment' | 'specs_cleanup' = 'full_enrichment'
  ): Promise<RefinerJob> {
    const jobStartTime = new Date().toISOString();
    let productsSuccessful = 0;
    let productsFailed = 0;

    try {
      console.log(`Starting AI refinement job for ${productIds.length} products`);

      for (const productId of productIds) {
        try {
          const product = await this.getProduct(productId);
          if (!product) {
            this.addLog(
              productId,
              'failed',
              'Product not found'
            );
            productsFailed++;
            continue;
          }

          // Perform refinement based on type
          const refined = await this.performRefinement(product, refinationType);

          // Update product in Firestore
          await this.updateProduct(productId, refined);

          this.addLog(
            productId,
            'success',
            `Refined with ${refinationType}`
          );
          productsSuccessful++;
        } catch (err) {
          this.addLog(
            productId,
            'failed',
            (err as Error).message
          );
          productsFailed++;
        }
      }

      const job: RefinerJob = {
        id: this.jobId,
        status: 'completed',
        productIds,
        refinationType,
        productsProcessed: productIds.length,
        productsSuccessful,
        productsFailed,
        startedAt: jobStartTime,
        completedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        logs: this.logs,
      };

      await this.updateJobRecord(job);
      return job;
    } catch (err) {
      console.error('Refiner job failed:', err);
      throw err;
    }
  }

  /**
   * Perform AI enrichment on a single product
   */
  private async performRefinement(
    product: ProductCore,
    refinationType: string
  ): Promise<Partial<ProductCore>> {
    const refined: Partial<ProductCore> = {};

    // Ensure ProductCore has deepest possible category (prefer sub-sub) before content enrichment
    try {
      const needsCategory = !product.mainCategorySlug || product.mainCategorySlug === 'uncategorized' || !product.subSubCategorySlug;
      if (needsCategory) {
        const { matchCategoryByText } = await import('@/lib/category-mapper');
        const baseText = `${product.title?.pl || ''} ${Object.keys(product.specs || {}).join(' ')}`;
        const match = await matchCategoryByText(baseText);
        if (match) {
          refined.mainCategorySlug = match.mainCategorySlug;
          refined.subCategorySlug = match.subCategorySlug || product.subCategorySlug || 'general';
          refined.subSubCategorySlug = match.subSubCategorySlug || product.subSubCategorySlug;
        }
      }
    } catch (_) {}

    if (refinationType === 'full_enrichment' || refinationType === 'specs_cleanup') {
      // Clean up specs using AI
      refined.specs = await this.cleanupSpecs(product.specs);
    }

    if (refinationType === 'full_enrichment' || refinationType === 'description_generation') {
      // Generate multilingual descriptions
      refined.fullDescription = await this.generateDescriptions(
        product.title,
        product.specs
      );

      // Generate SEO metadata
      refined.seoTitle = await this.generateSeoTitle(product.title);
      refined.seoDescription = await this.generateSeoDescription(product.title, product.specs);
    }

    if (refinationType === 'full_enrichment' || refinationType === 'review_summary') {
      // Generate review summary based on rating
      refined.reviewsSummary = await this.generateReviewSummary(product.rating.score);
    }

    if (refinationType === 'full_enrichment') {
      // Extract search tags
      refined.searchTags = await this.extractSearchTags(product.title, product.specs);

      // Calculate quality score
      refined.aiQualityScore = this.calculateQualityScore(product);

      // Update status
      refined.status = 'pending_approval';
    }

    refined.updatedAt = new Date().toISOString();
    return refined;
  }

  /**
   * Clean up specs: normalize keys, handle missing values, etc.
   */
  private async cleanupSpecs(rawSpecs: Record<string, string>): Promise<Record<string, string>> {
    const cleaned: Record<string, string> = {};

    // Standard spec keys (canonical names)
    const specMapping: Record<string, string[]> = {
      'RAM': ['ram', 'memory', 'sdram', 'dram'],
      'Storage': ['storage', 'disk', 'ssd', 'hdd', 'capacity'],
      'Screen': ['screen', 'display', 'resolution', 'inch', 'size'],
      'Processor': ['processor', 'cpu', 'chip', 'processor type'],
      'Battery': ['battery', 'battery capacity', 'mah', 'wh'],
      'Weight': ['weight', 'kg', 'grams'],
      'Color': ['color', 'colour'],
      'Material': ['material', 'construction'],
    };

    for (const [key, value] of Object.entries(rawSpecs)) {
      const lowerKey = key.toLowerCase().trim();

      // Find canonical key
      let canonicalKey = key;
      for (const [canonical, aliases] of Object.entries(specMapping)) {
        if (aliases.includes(lowerKey)) {
          canonicalKey = canonical;
          break;
        }
      }

      // Normalize value
      const normalizedValue = this.normalizeSpecValue(canonicalKey, String(value));
      if (normalizedValue) {
        cleaned[canonicalKey] = normalizedValue;
      }
    }

    return cleaned;
  }

  /**
   * Normalize a spec value (e.g., "16 GB" -> "16GB")
   */
  private normalizeSpecValue(key: string, value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';

    switch (key) {
      case 'RAM':
      case 'Storage':
        // Remove spaces: "16 GB" -> "16GB"
        return trimmed.replace(/\s+/g, '');
      case 'Screen':
        // Ensure format like "15.6\""
        if (!trimmed.includes('"') && !trimmed.includes('inch')) {
          return `${trimmed}"`;
        }
        return trimmed;
      case 'Weight':
        // Ensure units: "2.5 kg" -> "2.5kg"
        return trimmed.replace(/\s+/g, '');
      default:
        return trimmed;
    }
  }

  /**
   * Generate multilingual product descriptions using AI
   * TODO: Integrate with Vertex AI / Genkit
   */
  private async generateDescriptions(
    title: LocalizedText,
    specs: Record<string, string>
  ): Promise<LocalizedText> {
    // TODO: Call Vertex AI API to generate descriptions
    // For now, return placeholder

    const specsText = Object.entries(specs)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    return {
      pl: `${title.pl}. Specyfikacja: ${specsText}`,
      en: `${title.en}. Specifications: ${specsText}`,
      de: `${title.de}. Spezifikation: ${specsText}`,
    };
  }

  /**
   * Generate SEO-optimized title using Vertex AI
   */
  private async generateSeoTitle(title: LocalizedText): Promise<string> {
    try {
      const { generateProductDescription } = await import('@/ai/flows/enrichment');
      const titleText = title.pl || title.en || '';
      
      const result = await generateProductDescription({
        productTitle: titleText,
        productCategory: 'Electronics',
        targetLocale: 'pl',
      });
      
      return result.seoTitle;
    } catch (error) {
      console.error('[Refiner] SEO title generation failed:', error);
      return `${title.pl} - Best Price & Reviews`;
    }
  }

  /**
   * Generate SEO meta description using Vertex AI
   */
  private async generateSeoDescription(
    title: LocalizedText,
    specs: Record<string, string>
  ): Promise<string> {
    try {
      const { generateProductDescription } = await import('@/ai/flows/enrichment');
      const titleText = title.pl || title.en || '';
      
      const result = await generateProductDescription({
        productTitle: titleText,
        productCategory: 'Electronics',
        targetLocale: 'pl',
      });
      
      return result.seoDescription;
    } catch (error) {
      console.error('[Refiner] SEO description generation failed:', error);
      const specsText = Object.keys(specs).join(', ');
      return `Compare ${title.pl} prices. ${specsText}. Best deals available now.`;
    }
  }

  /**
   * Generate review summary based on star rating
   * Simulates user sentiment from rating
   */
  private async generateReviewSummary(rating: number): Promise<LocalizedText> {
    let sentiment = '';

    if (rating >= 4.5) {
      sentiment = 'Users highly praise the quality, durability, and value for money. Excellent build quality and fast delivery.';
    } else if (rating >= 4.0) {
      sentiment = 'Generally positive reviews. Users appreciate the performance and value. Some minor quality concerns reported.';
    } else if (rating >= 3.5) {
      sentiment = 'Mixed reviews. Works well but has some limitations. Quality varies between units.';
    } else if (rating >= 3.0) {
      sentiment = 'Below average rating. Consider alternatives for better quality.';
    } else {
      sentiment = 'Poor reviews. Quality and durability issues reported.';
    }

    return {
      pl: sentiment, // TODO: Translate
      en: sentiment,
      de: sentiment, // TODO: Translate
    };
  }

  /**
   * Extract search tags using Vertex AI
   */
  private async extractSearchTags(
    title: LocalizedText,
    specsOrDescription: Record<string, string> | LocalizedText
  ): Promise<string[]> {
    try {
      const { extractProductTags } = await import('@/ai/flows/enrichment');
      const titleText = title.pl || title.en || '';
      
      // Handle both specs (Record) and description (LocalizedText)
      let descText = '';
      if (typeof specsOrDescription === 'object' && 'pl' in specsOrDescription) {
        // It's LocalizedText
        descText = specsOrDescription.pl || specsOrDescription.en || '';
      } else {
        // It's specs Record<string, string>
        descText = Object.entries(specsOrDescription as Record<string, string>)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ');
      }
      
      const result = await extractProductTags({
        title: titleText,
        description: descText,
        category: 'Electronics',
      });
      
      // Combine tags and keywords
      return [...new Set([...result.tags, ...result.keywords])];
    } catch (error) {
      console.error('[Refiner] Search tag extraction failed:', error);
      // Fallback: extract from title
      const titleText = title.pl || title.en || '';
      const words = titleText.toLowerCase().split(/\s+/);
      return words.filter(w => w.length > 3);
    }
  }

  /**
   * Calculate AI quality score (0-100)
   */
  private calculateQualityScore(product: ProductCore): number {
    let score = 50; // Base score

    // Boost for specs
    score += Math.min(Object.keys(product.specs).length * 5, 20);

    // Boost for images
    score += Math.min(product.images.length * 5, 15);

    // Boost for rating data
    if (product.rating.count > 100) score += 10;

    // Cap at 100
    return Math.min(score, 100);
  }

  /**
   * Get product from Firestore
   */
  private async getProduct(productId: string): Promise<ProductCore | null> {
    try {
      const docRef = adminDb.collection('product_cores').doc(productId);
      const docSnap = await docRef.get();
      return docSnap.exists ? (docSnap.data() as ProductCore) : null;
    } catch (err) {
      console.error('Error fetching product:', err);
      return null;
    }
  }

  /**
   * Update product in Firestore
   */
  private async updateProduct(
    productId: string,
    updates: Partial<ProductCore>
  ): Promise<void> {
    const docRef = adminDb.collection('product_cores').doc(productId);
    await docRef.update(updates as any);
  }

  /**
   * Update job record
   */
  private async updateJobRecord(job: RefinerJob): Promise<void> {
    const jobRef = adminDb.collection('refiner_jobs').doc(this.jobId);
    try {
      await jobRef.set({
        status: job.status,
        productsProcessed: job.productsProcessed,
        productsSuccessful: job.productsSuccessful,
        productsFailed: job.productsFailed,
        completedAt: job.completedAt,
        lastUpdatedAt: job.lastUpdatedAt,
        logs: job.logs,
      }, { merge: true });
    } catch {
      // If doc doesn't exist, create it
      await adminDb.collection('refiner_jobs').add(job);
    }
  }

  /**
   * Add log entry
   */
  private addLog(
    productIdOrMessage: string,
    statusOrLevel?: 'success' | 'failed' | 'info' | 'error' | 'warn',
    messageOrDetails?: string | Record<string, any>
  ): void {
    // Support two signatures:
    // Old: addLog(productId, status, message)
    // New: addLog(message, level) or addLog(message, level, details)
    
    const isOldSignature = statusOrLevel === 'success' || statusOrLevel === 'failed';
    
    if (isOldSignature) {
      // Old signature: (productId, status, message)
      this.logs.push({
        productId: productIdOrMessage,
        status: statusOrLevel as 'success' | 'failed',
        message: messageOrDetails as string,
        timestamp: new Date().toISOString(),
      });
    } else {
      // New signature: (message, level, details?)
      const level = statusOrLevel || 'info';
      console.log(`[${level.toUpperCase()}] ${productIdOrMessage}`, messageOrDetails || '');
      this.logs.push({
        productId: 'system',
        status: 'success', // Fallback to maintain type compatibility
        message: productIdOrMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

/**
 * Helper: Start AI refinement job
 */
export async function startRefinerJob(
  productIds: string[],
  refinationType: 'full_enrichment' | 'specs_cleanup' = 'full_enrichment'
): Promise<RefinerJob> {
  const jobId = `refiner_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const refiner = new AIRefiner(jobId);
  return await refiner.refineProducts(productIds, refinationType);
}

/**
 * Helper: Refine all pending_approval products
 */
export async function refinePendingProducts(): Promise<RefinerJob> {
  const snapshot = await adminDb
    .collection('product_cores')
    .where('status', '==', 'pending_approval')
    .get();
  const productIds = snapshot.docs.map(doc => doc.id);

  if (productIds.length === 0) {
    throw new Error('No pending products to refine');
  }

  return await startRefinerJob(productIds, 'full_enrichment');
}
