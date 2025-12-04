/**
 * Deal Enricher - Consolidated AI Pipeline for Deal Enhancement
 * 
 * Centralized module that orchestrates all AI-powered deal enrichment flows:
 * - Title normalization (spam removal, formatting)
 * - Description generation (short, medium, keywords)
 * - SEO optimization (meta tags, keywords, unique descriptions)
 * - Quality scoring (recommendation for approval/review/rejection)
 * 
 * This module consolidates distributed AI flows previously scattered across:
 * - src/ai/flows/aliexpress/aiNormalizeTitlePL.ts
 * - src/ai/flows/aliexpress/aiDealDescriptionPL.ts
 * - src/ai/flows/aliexpress/aiGenerateSEODescription.ts
 * - src/ai/flows/aliexpress/aiDealQualityScore.ts
 * 
 * Usage:
 * const enriched = await dealEnricher.enrich({
 *   title: "Samsung Galaxy S24 Ultra 256GB",
 *   price: 3999,
 *   originalPrice: 5499,
 *   category: "elektronika/smartfony",
 *   merchant: "AliExpress"
 * });
 */

'use server';

import { logger } from '@/lib/logging';
import { aiNormalizeTitlePL } from '@/ai/flows/aliexpress/aiNormalizeTitlePL';
import { aiGenerateDealDescriptionPL } from '@/ai/flows/aliexpress/aiDealDescriptionPL';
import { aiGenerateSEODescription } from '@/ai/flows/aliexpress/aiGenerateSEODescription';
import { aiDealQualityScore } from '@/ai/flows/aliexpress/aiDealQualityScore';

/**
 * Comprehensive input for deal enrichment
 */
export interface DealEnricherInput {
  title: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  merchant?: string;
  category?: string;
  mainCategorySlug?: string;
  subCategorySlug?: string;
  subSubCategorySlug?: string;
  rating?: number;
  reviewCount?: number;
  salesCount?: number;
  description?: string;
  attributes?: Record<string, string>;
}

/**
 * Enriched deal output with all AI-generated content
 */
export interface EnrichedDeal {
  normalizedTitle: string;
  shortDescription: string;
  mediumDescription: string;
  keywords: string[];
  seoDescription: string;
  seoKeywords: string[];
  metaTitle?: string;
  metaDescription?: string;
  qualityScore: number;
  qualityRecommendation: 'approve' | 'review' | 'reject';
  qualityFactors: {
    priceQuality: number;
    discountLegitimacy: number;
    merchantTrust: number;
    productPopularity: number;
    contentQuality: number;
  };
  qualityWarnings: string[];
  qualityReasoning: string;
  enrichedAt: string;
  processingTimeMs: number;
}

/**
 * Main enricher function - orchestrates all AI flows
 * 
 * @param input Deal information to enrich
 * @returns Fully enriched deal with normalized content, descriptions, SEO tags, and quality score
 */
export async function enrichDeal(input: DealEnricherInput): Promise<EnrichedDeal> {
  const startTime = Date.now();
  
  logger.info('🤖 Starting deal enrichment', {
    title: input.title,
    price: input.price,
  });

  try {
    // Step 1: Normalize title
    logger.debug('Step 1: Normalizing title...');
    const normalizedTitle = await aiNormalizeTitlePL({
      rawTitle: input.title,
    });
    logger.debug('✅ Title normalized', { normalizedTitle });

    // Step 2: Generate descriptions (short, medium, keywords)
    logger.debug('Step 2: Generating deal descriptions...');
    const descriptionResult = await aiGenerateDealDescriptionPL({
      title: normalizedTitle || input.title,
      discount: input.discount || (input.originalPrice ? Math.round(((input.originalPrice - input.price) / input.originalPrice) * 100) : undefined),
      price: input.price,
      originalPrice: input.originalPrice,
      merchant: input.merchant,
    });
    logger.debug('✅ Descriptions generated', {
      shortLength: descriptionResult.shortDescription.length,
      mediumLength: descriptionResult.mediumDescription.length,
      keywordCount: descriptionResult.keywords.length,
    });

    // Step 3: Generate SEO content (full description, meta tags)
    logger.debug('Step 3: Generating SEO content...');
    const seoResult = await aiGenerateSEODescription({
      normalizedTitle: normalizedTitle || input.title,
      mainCategorySlug: input.mainCategorySlug || input.category || 'other',
      subCategorySlug: input.subCategorySlug || 'general',
      subSubCategorySlug: input.subSubCategorySlug,
      price: input.price,
      rating: input.rating,
      reviewCount: input.reviewCount,
      attributes: input.attributes,
    });
    logger.debug('✅ SEO content generated', {
      descriptionLength: seoResult.description.length,
      keywordCount: seoResult.keywords.length,
    });

    // Step 4: Calculate quality score
    logger.debug('Step 4: Calculating quality score...');
    const qualityResult = await aiDealQualityScore({
      title: normalizedTitle || input.title,
      description: descriptionResult.shortDescription,
      price: input.price,
      originalPrice: input.originalPrice,
      discountPercent: input.discount || (input.originalPrice ? Math.round(((input.originalPrice - input.price) / input.originalPrice) * 100) : undefined),
      rating: input.rating,
      reviewCount: input.reviewCount,
      salesCount: input.salesCount,
      merchantName: input.merchant,
      category: input.mainCategorySlug || input.category,
    });
    logger.debug('✅ Quality score calculated', {
      score: qualityResult.score,
      recommendation: qualityResult.recommendation,
    });

    // Assemble enriched deal
    const enrichedDeal: EnrichedDeal = {
      normalizedTitle: normalizedTitle || input.title,
      shortDescription: descriptionResult.shortDescription,
      mediumDescription: descriptionResult.mediumDescription,
      keywords: descriptionResult.keywords,
      seoDescription: seoResult.description,
      seoKeywords: seoResult.keywords,
      metaTitle: seoResult.metaTitle,
      metaDescription: seoResult.metaDescription,
      qualityScore: qualityResult.score,
      qualityRecommendation: qualityResult.recommendation,
      qualityFactors: qualityResult.factors,
      qualityWarnings: qualityResult.warnings,
      qualityReasoning: qualityResult.reasoning,
      enrichedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - startTime,
    };

    logger.info('✨ Deal enrichment complete', {
      title: enrichedDeal.normalizedTitle,
      qualityScore: enrichedDeal.qualityScore,
      processingTimeMs: enrichedDeal.processingTimeMs,
    });

    return enrichedDeal;
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    logger.error('❌ Deal enrichment failed', {
      error,
      title: input.title,
      processingTimeMs,
    });

    // Return graceful fallback on error
    return {
      normalizedTitle: input.title,
      shortDescription: input.title,
      mediumDescription: input.title,
      keywords: [],
      seoDescription: input.title,
      seoKeywords: [],
      metaTitle: input.title.slice(0, 60),
      metaDescription: input.title.slice(0, 160),
      qualityScore: 50, // neutral score on error
      qualityRecommendation: 'review',
      qualityFactors: {
        priceQuality: 0,
        discountLegitimacy: 0,
        merchantTrust: 0,
        productPopularity: 0,
        contentQuality: 0,
      },
      qualityWarnings: [`Enrichment error: ${(error as any)?.message || 'Unknown error'}`],
      qualityReasoning: 'AI enrichment failed, fallback content used',
      enrichedAt: new Date().toISOString(),
      processingTimeMs,
    };
  }
}

/**
 * Batch enrich multiple deals with rate limiting
 * 
 * @param deals Array of deals to enrich
 * @param delayMs Delay between enrichments (default: 100ms to avoid API throttling)
 * @returns Array of enriched deals
 */
export async function enrichDealsBatch(
  deals: DealEnricherInput[],
  delayMs: number = 100
): Promise<EnrichedDeal[]> {
  logger.info(`🚀 Starting batch enrichment of ${deals.length} deals...`);
  
  const enriched: EnrichedDeal[] = [];
  
  for (let i = 0; i < deals.length; i++) {
    logger.debug(`Enriching deal ${i + 1}/${deals.length}...`);
    
    const result = await enrichDeal(deals[i]);
    enriched.push(result);
    
    // Rate limiting between requests
    if (i < deals.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  logger.info(`✨ Batch enrichment complete - ${enriched.length} deals processed`);
  return enriched;
}

/**
 * Helper: Create enricher input from deal data
 */
export function createEnricherInput(
  deal: any
): DealEnricherInput {
  return {
    title: deal.title || '',
    price: deal.price || 0,
    originalPrice: deal.originalPrice,
    discount: deal.discount || deal.discountPercent,
    merchant: deal.merchant,
    category: deal.category,
    mainCategorySlug: deal.mainCategorySlug,
    subCategorySlug: deal.subCategorySlug,
    subSubCategorySlug: deal.subSubCategorySlug,
    rating: deal.rating,
    reviewCount: deal.reviewCount,
    salesCount: deal.salesCount,
    description: deal.description,
    attributes: deal.attributes,
  };
}

export default {
  enrichDeal,
  enrichDealsBatch,
  createEnricherInput,
};
