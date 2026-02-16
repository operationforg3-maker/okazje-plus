import { adminDb } from '@/lib/firebase-admin';
import { ProductCore, RefinerJob, LocalizedText } from '@/lib/types';
import { formatProductDescription, formatSpecs, specsToFeatures } from '@/ai/flows/product-formatting';
import { extractDimensionsFromTitle } from '@/lib/automation/identity-matcher';

/**
 * AI Refiner - Enriches draft ProductCores with AI-generated content
 * - Cleans up specs from raw data
 * - Generates multilingual descriptions (PL/EN/DE/FR/ES/UK)
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
   */
  async refineExistingProducts(
    status?: string,
    limit: number = 100,
    refinationType: 'full_enrichment' | 'specs_cleanup' = 'full_enrichment',
    dryRun: boolean = false
  ): Promise<RefinerJob> {
    const jobStartTime = new Date().toISOString();
    let productsSuccessful = 0;
    let productsFailed = 0;
    const processedIds: string[] = [];

    try {
      this.addLog('info', `Starting DB refinement job: status=${status || 'all'}, limit=${limit}, type=${refinationType}, dryRun=${dryRun}`);

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
        // Check for stop signal
        if (!(await this.isJobActive())) {
           this.addLog('warn', 'Refiner job stopped externally');
           const jobStopped: RefinerJob = {
              id: this.jobId,
              status: 'paused',
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
            await this.updateJobRecord(jobStopped);
            return jobStopped;
        }

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

          if (!dryRun) {
            // Update product in Firestore
            await this.updateProduct(productId, refined);
            this.addLog('success', `Refined & Saved ${product.title.pl || 'Unknown'}`, { productId, refinationType });
          } else {
             this.addLog('info', `[DRY-RUN] Would save changes for ${product.title.pl}`, { refined });
          }
          
          productsSuccessful++;
        } catch (err) {
          this.addLog(
            'failed',
            `Failed to refine ${product.title.pl || 'Unknown'}`,
            { error: (err as Error).message }
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
    refinationType: 'full_enrichment' | 'specs_cleanup' = 'full_enrichment',
    dryRun: boolean = false
  ): Promise<RefinerJob> {
    const jobStartTime = new Date().toISOString();
    let productsSuccessful = 0;
    let productsFailed = 0;

    try {
      console.log(`Starting AI refinement job for ${productIds.length} products (dryRun=${dryRun})`);

      for (const productId of productIds) {
        // Check for stop signal
        if (!(await this.isJobActive())) {
             this.addLog('warn', 'Refinement stopped externally');
             const jobStopped: RefinerJob = {
                id: this.jobId,
                status: 'paused',
                productIds,
                refinationType,
                productsProcessed: productsSuccessful + productsFailed,
                productsSuccessful,
                productsFailed,
                startedAt: jobStartTime,
                completedAt: new Date().toISOString(),
                lastUpdatedAt: new Date().toISOString(),
                logs: this.logs,
              };
              await this.updateJobRecord(jobStopped);
              return jobStopped;
        }

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

          if (!dryRun) {
            // Update product in Firestore
            await this.updateProduct(productId, refined);
            this.addLog(
              productId,
              'success',
              `Refined with ${refinationType}`
            );
          } else {
            console.log(`[DRY-RUN] Refined data for ${productId}:`, JSON.stringify(refined, null, 2));
             this.addLog(
              productId,
              'success',
              `[DRY-RUN] Would refine with ${refinationType}`
            );
          }

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
   * Perform AI enrichment on a single product (Public Wrapper)
   */
  public async enrichSingleProduct(
    product: ProductCore,
    refinationType: string = 'full_enrichment'
  ): Promise<Partial<ProductCore>> {
    return this.performRefinement(product, refinationType);
  }

  /**
   * Perform AI enrichment on a single product
   */
  private async performRefinement(
    product: ProductCore,
    refinationType: string
  ): Promise<Partial<ProductCore>> {
    const refined: Partial<ProductCore> = {};

    // Build best-effort specs seed
    let specsSeed: Record<string, string> = {};
    const rawSpecs = product.specs || {};
    if (Object.keys(rawSpecs).length > 0) {
      specsSeed = { ...rawSpecs };
    } else if (product.metadata?.specifications && Object.keys(product.metadata.specifications).length > 0) {
      specsSeed = Object.fromEntries(
        Object.entries(product.metadata.specifications).map(([key, value]) => [key, String(value ?? '').trim()])
      );
    }

    if (Object.keys(specsSeed).length === 0) {
      const titleText = typeof product.title === 'object'
        ? (product.title.pl || product.title.en || product.title.de || '')
        : (product.title || '');
      const descriptionText = typeof product.fullDescription === 'object'
        ? (product.fullDescription.pl || product.fullDescription.en || product.fullDescription.de || '')
        : (product.fullDescription || '');
      const fallbackText = `${titleText} ${descriptionText}`.trim();
      const extracted = fallbackText ? extractDimensionsFromTitle(fallbackText) : {};
      if (Object.keys(extracted).length > 0) {
        specsSeed = extracted;
      }
    }

    if (Object.keys(specsSeed).length === 0) {
      specsSeed = { info: 'Brak danych specyfikacji' };
      this.addLog('warn', `Missing specs for product ${product.id} - using placeholder specs`);
    }

    // Clean up specs using AI
    refined.specs = await this.cleanupSpecs(specsSeed);
    
    // M6 UPGRADE: Use intelligent generator instead of iterative translation
    // This addresses "AI should improve, not just translate"
    if (refinationType === 'full_enrichment') {
      try {
        const { generateMarketingContent } = await import('@/ai/flows/enrichment');
        
        // Determine original title
        const isEnSource = product.metadata?.source === 'aliexpress' || product.metadata?.source === 'amazon';
        const originalTitle = isEnSource && product.title.en ? product.title.en : (product.title.pl || product.title.en || 'Unknown');

        this.addLog('info', `Generating creative content for: ${originalTitle} (Source: ${product.metadata?.source})`);

        const refinedContent = await generateMarketingContent({
          originalTitle,
          specs: refined.specs || product.specs || {},
          category: product.mainCategorySlug,
          source: product.metadata?.source as string
        });

        // Map AI output to ProductCore fields
        refined.title = refinedContent.title as LocalizedText;
        
        // Use HTML descriptions
        refined.description = refinedContent.fullDescription as LocalizedText;
        refined.fullDescription = refinedContent.fullDescription as LocalizedText;
        refined.shortDescription = refinedContent.shortDescription as LocalizedText;
        
        // Use SEO output
        refined.seoTitle = refinedContent.seo.title;
        refined.seoDescription = refinedContent.seo.description;
        refined.searchTags = [
          ...(refinedContent.seo.keywords || []),
          ...(await this.extractSearchTags(refined.title, refined.specs))
        ];

        // Ensure we extract specs even when creative flow runs
        if (!refined.specs || Object.keys(refined.specs).length === 0) {
          try {
            const { cleanProductTitle } = await import('@/ai/flows/enrichment');
            const titleResult = await cleanProductTitle({
              originalTitle,
              specs: refined.specs || product.specs || {}
            });
            if (titleResult?.specsExtracted && Object.keys(titleResult.specsExtracted).length > 0) {
              refined.specs = {
                ...(refined.specs || product.specs || {}),
                ...titleResult.specsExtracted
              };
            }
          } catch (specErr) {
            this.addLog('warn', 'Specyfikacje nie zostały wyekstrahowane z tytułu', specErr);
          }
        }

        // M6+ Market Price Estimation
        if (refinedContent.averageMarketPrice && refinedContent.averageMarketPrice.amount && refinedContent.averageMarketPrice.currency) {
          refined.averageMarketPrice = refinedContent.averageMarketPrice as { amount: number; currency: string; range?: { min: number; max: number; } };
        }
        
        // Note: We skip 'cleanProductTitle' and 'generateDescriptions' calls below because 
        // generateMarketingContent handles ALL of this in one powerful prompt.
        
      } catch (e) {
        console.error('[Refiner] Creative generation failed, falling back to legacy pipeline:', e);
        // If creative fail, let the legacy blocks below run (logic unchanged)
      }
    }

    // LEGACY BLOCKS - Only run if we didn't do full enrichment or if full enrichment failed (creative flow)
    // We check if 'refined.title' is set to know if we need to run legacy title cleanup
    
    // 1. Title Cleanup (Legacy) - Skip if creative flow already populated title
    if ((!refined.title && refinationType === 'full_enrichment') || refinationType === 'title_cleanup') {
      try {
        const { cleanProductTitle, translateContent } = await import('@/ai/flows/enrichment');
        
        // Clean title & extract missing specs
        let titleResult = await cleanProductTitle({
          originalTitle: product.title.pl || product.title.en || 'Unknown Product',
          specs: refined.specs || product.specs || {}
        });

        // FAILSAFE: If AI returned identical titles for PL/EN (common when it fails/hallucinates),
        // FORCE translation from English to Polish/German.
        if (titleResult.titlePL === titleResult.titleEN && titleResult.titlePL.length > 0) {
           try {
             const tr = await translateContent({
               text: titleResult.titleEN,
               sourceLocale: 'en',
               targetLocales: ['pl', 'de', 'fr', 'es', 'uk']
             });
             // Only override if translation produced something different
             if (tr.translations['pl'] && tr.translations['pl'] !== titleResult.titlePL) {
               titleResult.titlePL = tr.translations['pl'];
             }
             if (tr.translations['de']) {
               titleResult.titleDE = tr.translations['de'];
             }
             if (tr.translations['fr']) {
               (titleResult as any).titleFR = tr.translations['fr'];
             }
             if (tr.translations['es']) {
               (titleResult as any).titleES = tr.translations['es'];
             }
             if (tr.translations['uk']) {
               (titleResult as any).titleUK = tr.translations['uk'];
             }
           } catch(err) {
             console.error('[Refiner] Failsafe translation failed', err);
           }
        }

        // Update titles
        refined.title = {
          pl: titleResult.titlePL,
          en: titleResult.titleEN,
          de: titleResult.titleDE,
          fr: (titleResult as any).titleFR || titleResult.titleEN,
          es: (titleResult as any).titleES || titleResult.titleEN,
          uk: (titleResult as any).titleUK || titleResult.titleEN,
        };

        // Merge extracted specs
        if (titleResult.specsExtracted) {
          refined.specs = {
            ...(refined.specs || product.specs || {}),
            ...titleResult.specsExtracted
          };
        }
      } catch (e) {
        console.error('[Refiner] Title cleanup failed:', e);
      }
    }

    // 2. Description Generation (Legacy) - Skip if creative flow already populated descriptions
    if ((!refined.fullDescription && refinationType === 'full_enrichment') || refinationType === 'description_generation') {
      // Generate multilingual descriptions
      refined.fullDescription = await this.generateDescriptions(
        refined.title || product.title,
        refined.specs || product.specs || {},
        product.metadata
      );

      // Generate SEO metadata
      refined.seoTitle = await this.generateSeoTitle(product.title);
      refined.seoDescription = await this.generateSeoDescription(product.title, product.specs);

      // M6 Update: Generate richly formatted HTML descriptions with structure
      // Include specs table, features list, and proper formatting
      const title = typeof refined.title === 'object' ? refined.title.pl : (refined.title || product.title);
      const features = refined.specs ? specsToFeatures(refined.specs) : [];
      
      refined.description = {
        pl: formatProductDescription({
          title: title,
          plainDescription: refined.fullDescription?.pl || '',
          specs: refined.specs || {},
          features: features,
        }),
        en: formatProductDescription({
          title: typeof refined.title === 'object' ? refined.title.en : title,
          plainDescription: refined.fullDescription?.en || '',
          specs: refined.specs || {},
          features: features,
        }),
        de: formatProductDescription({
          title: typeof refined.title === 'object' ? refined.title.de : title,
          plainDescription: refined.fullDescription?.de || '',
          specs: refined.specs || {},
          features: features,
        }),
        fr: formatProductDescription({
          title: typeof refined.title === 'object' ? refined.title.fr || refined.title.en : title,
          plainDescription: refined.fullDescription?.fr || '',
          specs: refined.specs || {},
          features: features,
        }),
        es: formatProductDescription({
          title: typeof refined.title === 'object' ? refined.title.es || refined.title.en : title,
          plainDescription: refined.fullDescription?.es || '',
          specs: refined.specs || {},
          features: features,
        }),
        uk: formatProductDescription({
          title: typeof refined.title === 'object' ? refined.title.uk || refined.title.en : title,
          plainDescription: refined.fullDescription?.uk || '',
          specs: refined.specs || {},
          features: features,
        }),
      };

      // M6 Update: Sync shortDescription with SEO description for Cards/Deals
      if (refined.seoDescription) {
        refined.shortDescription = {
          pl: refined.seoDescription,
          en: product.shortDescription?.en || product.shortDescription?.pl || '',
          de: product.shortDescription?.de || product.shortDescription?.pl || '',
          fr: product.shortDescription?.fr || product.shortDescription?.pl || '',
          es: product.shortDescription?.es || product.shortDescription?.pl || '',
          uk: product.shortDescription?.uk || product.shortDescription?.pl || '',
        };
      }
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
   * Uses translateContent flow to generate real EN/DE descriptions
   */
  private async generateDescriptions(
    title: LocalizedText,
    specs: Record<string, string>,
    metadata?: ProductCore['metadata']
  ): Promise<LocalizedText> {
    try {
      const { translateContent } = await import('@/ai/flows/enrichment');
      
      // M6 FIX: Determine source language from metadata
      // AliExpress fetches are now in English (for better AI translation context)
      // but Harvester puts the same title in PL/EN/DE.
      // We must detect if we should treat the "PL" input as actually English.
      const isEnSource = metadata?.source === 'aliexpress' || metadata?.source === 'amazon';
      const sourceLocale = isEnSource ? 'en' : 'pl';
      const targetLocales = isEnSource
        ? ['pl', 'de', 'fr', 'es', 'uk']
        : ['en', 'de', 'fr', 'es', 'uk'];

      // Use the appropriate title base
      const baseTitle = isEnSource ? (title.en || title.pl || '') : (title.pl || '');
      if (!baseTitle) return title; // Cant generate without base

      const specsText = Object.entries(specs)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');

      const baseDescription = `${baseTitle}. Specyfikacja: ${specsText}.`;

      // Use AI to translate/generate descriptions
      const translationResult = await translateContent({
        text: baseDescription,
        sourceLocale: sourceLocale,
        targetLocales: targetLocales
      });
      
      // Map translations to result
      const result: LocalizedText = {
        pl: '',
        en: '',
        de: '',
        fr: '',
        es: '',
        uk: ''
      };

      if (sourceLocale === 'en') {
        result.en = baseDescription;
        result.pl = translationResult.translations['pl'] || `[AI] ${baseTitle}`;
        result.de = translationResult.translations['de'] || `[AI] ${baseTitle}`;
        result.fr = translationResult.translations['fr'] || `[AI] ${baseTitle}`;
        result.es = translationResult.translations['es'] || `[AI] ${baseTitle}`;
        result.uk = translationResult.translations['uk'] || `[AI] ${baseTitle}`;
      } else {
        result.pl = baseDescription;
        result.en = translationResult.translations['en'] || `[AI] ${baseTitle}`;
        result.de = translationResult.translations['de'] || `[AI] ${baseTitle}`;
        result.fr = translationResult.translations['fr'] || `[AI] ${baseTitle}`;
        result.es = translationResult.translations['es'] || `[AI] ${baseTitle}`;
        result.uk = translationResult.translations['uk'] || `[AI] ${baseTitle}`;
      }

      return result;
    } catch (e) {
      console.error('Error generating descriptions:', e);
      // Fallback
      const specsText = Object.entries(specs)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

      return {
        pl: `${title.pl}. Specyfikacja: ${specsText}`,
        en: `${title.en}. Specifications: ${specsText}`,
        de: `${title.de}. Spezifikation: ${specsText}`,
        fr: `${title.fr || title.en || title.pl}. Spécifications: ${specsText}`,
        es: `${title.es || title.en || title.pl}. Especificaciones: ${specsText}`,
        uk: `${title.uk || title.en || title.pl}. Характеристики: ${specsText}`,
      };
    }
  }

  /**
   * Translates missing or incorrect title languages
   * e.g. if EN title is copy of PL title
   */
  private async fixTitleTranslations(title: LocalizedText): Promise<LocalizedText> {
    try {
      if (title.pl && (!title.en || title.en === title.pl)) {
        const { translateContent } = await import('@/ai/flows/enrichment');
        const res = await translateContent({
          text: title.pl,
          sourceLocale: 'pl',
          targetLocales: ['en', 'de', 'fr', 'es', 'uk']
        });
        
        return {
          pl: title.pl,
          en: res.translations['en'] || title.en,
          de: res.translations['de'] || title.de || '',
          fr: res.translations['fr'] || title.fr || '',
          es: res.translations['es'] || title.es || '',
          uk: res.translations['uk'] || title.uk || ''
        };
      }
      return title;
    } catch (e) {
      console.error('Error fixing title translations:', e);
      return title;
    }
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

    try {
      const { translateContent } = await import('@/ai/flows/enrichment');
      const res = await translateContent({
        text: sentiment,
        sourceLocale: 'en',
        targetLocales: ['pl', 'de', 'fr', 'es', 'uk']
      });

      return {
        pl: res.translations['pl'] || sentiment,
        en: sentiment,
        de: res.translations['de'] || sentiment,
        fr: res.translations['fr'] || sentiment,
        es: res.translations['es'] || sentiment,
        uk: res.translations['uk'] || sentiment,
      };
    } catch (err) {
      console.error('[Refiner] Review summary translation failed:', err);
      return {
        pl: sentiment,
        en: sentiment,
        de: sentiment,
        fr: sentiment,
        es: sentiment,
        uk: sentiment,
      };
    }
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
   * Check if job is still active (not paused/cancelled)
   */
  private async isJobActive(): Promise<boolean> {
    try {
      const doc = await adminDb.collection('refiner_jobs').doc(this.jobId).get();
      if (!doc.exists) return true;
      const status = doc.data()?.status;
      return status === 'running';
    } catch (e) {
      console.error('Failed to check job status', e);
      return true; // Keep running on temporary DB error
    }
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
    statusOrLevel?: 'success' | 'failed' | 'info' | 'error' | 'warn' | string,
    messageOrDetails?: any
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
