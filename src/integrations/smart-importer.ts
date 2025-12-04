'use server';

/**
 * Smart Import Pipeline with 3 AI Agents
 * 
 * Orchestrates intelligent product importing using 3 specialized AI agents:
 * 1. The Ruthless Auditor (aiDealQualityScore) - Quality validation & scoring
 * 2. The Sales Copywriter (aiGenerateDealDescriptionPL) - Marketing copy generation
 * 3. The Librarian (aiSuggestCategory) - Intelligent categorization
 * 
 * Usage:
 * const result = await smartImportProduct({
 *   title: "Samsung Galaxy S24",
 *   price: 3999,
 *   originalPrice: 5499,
 *   shippingCost: 50,
 *   rating: 4.8,
 *   soldCount: 1200,
 *   merchantRating: 98,
 *   description: "Latest flagship smartphone..."
 * });
 */

import { logger } from '@/lib/logging';
import { aiDealQualityScore } from '@/ai/flows/aliexpress/aiDealQualityScore';
import { aiGenerateDealDescriptionPL } from '@/ai/flows/aliexpress/aiDealDescriptionPL';
import { aiSuggestCategory } from '@/ai/flows/aliexpress/aiSuggestCategory';

/**
 * Input for smart import
 */
export interface SmartImportInput {
  title: string;
  description?: string;
  price: number;
  originalPrice?: number;
  shippingCost?: number;
  rating?: number; // 0-5 stars
  soldCount?: number;
  merchantRating?: number; // 0-100%
  merchant?: string;
  imageUrl?: string;
  externalUrl?: string;
  source: 'aliexpress' | 'allegro' | 'amazon' | 'ebay' | 'other';
  externalId?: string; // Original product ID from merchant
  importedBy: string; // UID of user importing
  dryRun?: boolean;
}

/**
 * Output from smart import
 */
export interface SmartImportResult {
  success: boolean;
  productId?: string;
  dealId?: string;
  reason?: string;
  qualityScore: number;
  qualityRecommendation: 'publish' | 'reject' | 'manual_review';
  category?: {
    main: string;
    sub: string;
    subsub: string;
    confidence: number;
  };
  generatedContent?: {
    normalizedTitle: string;
    shortDescription: string;
    htmlContent: string;
    marketingTitle: string;
  };
  processingTimeMs: number;
}

/**
 * Smart Import Pipeline
 * Runs all 3 AI agents on a product and generates enriched content
 */
export async function smartImportProduct(input: SmartImportInput): Promise<SmartImportResult> {
  const startTime = Date.now();
  
  logger.info('🚀 Starting smart import', {
    title: input.title,
    source: input.source,
    dryRun: input.dryRun,
  });

  try {
    // ========================================
    // AGENT 1: The Ruthless Auditor
    // ========================================
    logger.debug('📋 Agent 1: Quality Scoring');
    const qualityResult = await aiDealQualityScore({
      price: input.price,
      originalPrice: input.originalPrice,
      shippingCost: input.shippingCost || 0,
      rating: input.rating,
      soldCount: input.soldCount,
      merchantRating: input.merchantRating,
    });

    logger.info('✅ Quality score complete', {
      score: qualityResult.score,
      recommendation: qualityResult.recommendation,
    });

    // Reject low-quality products automatically
    if (qualityResult.recommendation === 'reject') {
      logger.warn('⚠️ Product rejected by quality audit', {
        title: input.title,
        score: qualityResult.score,
        reasoning: qualityResult.reasoning,
      });

      return {
        success: false,
        reason: `Quality audit rejected: ${qualityResult.reasoning}`,
        qualityScore: qualityResult.score,
        qualityRecommendation: 'reject',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // ========================================
    // AGENT 2: The Sales Copywriter
    // ========================================
    logger.debug('📝 Agent 2: Description Generation');
    const descriptionResult = await aiGenerateDealDescriptionPL({
      title: input.title,
      rawSpecifications: input.description ? JSON.stringify({ description: input.description }) : undefined,
    });

    logger.info('✅ Content generation complete', {
      shortDescLength: descriptionResult.shortDescription.length,
      htmlContentLength: descriptionResult.htmlContent.length,
    });

    // ========================================
    // AGENT 3: The Librarian
    // ========================================
    logger.debug('📚 Agent 3: Category Suggestion');
    const categoryResult = await aiSuggestCategory({
      productTitle: input.title,
      description: input.description,
    });

    logger.info('✅ Category mapping complete', {
      main: categoryResult.mainCategorySlug,
      sub: categoryResult.subCategorySlug,
      subsub: categoryResult.subSubCategorySlug,
      confidence: categoryResult.confidence,
    });

    // ========================================
    // Result Assembly
    // ========================================
    const result: SmartImportResult = {
      success: true,
      qualityScore: qualityResult.score,
      qualityRecommendation: qualityResult.recommendation as 'publish' | 'reject' | 'manual_review',
      category: {
        main: categoryResult.mainCategorySlug,
        sub: categoryResult.subCategorySlug,
        subsub: categoryResult.subSubCategorySlug,
        confidence: categoryResult.confidence,
      },
      generatedContent: {
        normalizedTitle: input.title, // TODO: Add title normalization agent
        shortDescription: descriptionResult.shortDescription,
        htmlContent: descriptionResult.htmlContent,
        marketingTitle: descriptionResult.marketingTitle,
      },
      processingTimeMs: Date.now() - startTime,
    };

    logger.info('✨ Smart import complete', {
      success: true,
      processingTimeMs: result.processingTimeMs,
      qualityScore: result.qualityScore,
    });

    return result;
  } catch (error) {
    logger.error('❌ Smart import failed', {
      error: error instanceof Error ? error.message : String(error),
      title: input.title,
    });

    return {
      success: false,
      reason: error instanceof Error ? error.message : 'Unknown error',
      qualityScore: 0,
      qualityRecommendation: 'reject',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Batch smart import for multiple products
 */
export async function smartImportBatch(inputs: SmartImportInput[]): Promise<SmartImportResult[]> {
  logger.info('📦 Starting batch smart import', { count: inputs.length });

  const results = await Promise.allSettled(
    inputs.map(input => smartImportProduct(input))
  );

  const completed = results.map((r, i) => ({
    input: inputs[i],
    result: r.status === 'fulfilled' ? r.value : {
      success: false,
      reason: r.reason?.message || 'Promise rejected',
      qualityScore: 0,
      qualityRecommendation: 'reject' as const,
      processingTimeMs: 0,
    }
  }));

  const stats = {
    total: completed.length,
    successful: completed.filter(c => c.result.success).length,
    rejected: completed.filter(c => !c.result.success).length,
    avgProcessingTimeMs: Math.round(
      completed.reduce((sum, c) => sum + c.result.processingTimeMs, 0) / completed.length
    ),
  };

  logger.info('✅ Batch import complete', stats);

  return completed.map(c => c.result);
}

/**
 * DEPRECATED: buildProductFromSmartImport and buildDealFromSmartImport
 * 
 * These helper functions are not used because they conflict with the complex
 * Product and Deal type schemas (SmartPrice, LocalizedText, detailed AI metadata, etc.).
 * 
 * Instead, importers (AliExpress, Allegro) directly build Product/Deal objects
 * from their own mappers and apply SmartImportResult data to enrich them.
 * This approach keeps integration simpler and avoids type mismatches.
 * 
 * Examples:
 * - src/integrations/aliexpress/ingest.ts: Uses mapToProduct() then applies smartResult
 * - src/integrations/allegro/ingest.ts: Uses mapAllegroListingItemToProduct() then applies smartResult
 * 
 * Future enhancement: Implement proper Product/Deal builders after Product schema stabilization.
 */
