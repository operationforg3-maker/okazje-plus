/**
 * Stage: Smart Content Generation Wrapper
 * 
 * Integrates smartContentFlow.ts with the importer pipeline
 * Generates multilingual AI content for enriched products
 */

import { EnrichedProduct, ImportStageConfig } from './types';
import { 
  generateSmartContent, 
  batchGenerateSmartContent,
  SmartContentInput 
} from '../../smartContentFlow';
import { logger } from '@/lib/logging';

export interface SmartContentConfig extends ImportStageConfig {
  // Inherited: batchSize, delayBetweenItems, delayBetweenBatches, maxRetries
}

/**
 * Generate AI content for all products in the pipeline
 */
export async function generateSmartContentForProducts(
  products: EnrichedProduct[],
  config: Partial<SmartContentConfig> = {}
): Promise<EnrichedProduct[]> {
  logger.info('Starting smart content generation', {
    productCount: products.length,
    config,
  });
  
  // Convert enriched products to smart content inputs
  const inputs: SmartContentInput[] = products.map(p => ({
    originalTitle: p.titleNormalizedEN || p.titleOriginal,
    originalDescription: p.descriptionEN,
    specifications: extractSpecifications(p),
    category: p.subcategorySlugEN || p.categorySlugEN || 'general',
    price: p.priceUSD || p.price,
    discount: p.discount,
  }));
  
  // Batch generate AI content
  const results = await batchGenerateSmartContent(inputs, {
    batchSize: config.batchSize || 10,
    delayMs: config.delayBetweenBatches || 1000,
    maxRetries: config.maxRetries || 2,
  });
  
  // Merge AI content back into products
  const enrichedWithAI: EnrichedProduct[] = products.map((product, idx) => {
    const aiContent = results[idx];
    
    return {
      ...product,
      aiContent: {
        titlePL: aiContent.titlePL,
        titleEN: aiContent.titleEN,
        titleDE: aiContent.titleDE,
        description: aiContent.description,
        bullets: aiContent.bullets,
        score: aiContent.score,
        seoTitle: aiContent.seoTitle,
        seoDescription: aiContent.seoDescription,
        jsonLd: aiContent.jsonLd,
        generatedAt: aiContent.generatedAt,
        modelVersion: aiContent.modelVersion,
        warnings: aiContent.warnings,
      },
      // Override titles with AI-generated versions (fallback to original)
      titlePL: aiContent.titlePL || product.titlePL,
      descriptionPL: aiContent.description.pl || product.descriptionPL,
    };
  });
  
  logger.info('Smart content generation completed', {
    total: enrichedWithAI.length,
    avgScore: Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length),
  });
  
  return enrichedWithAI;
}

/**
 * Extract specifications from product data
 */
function extractSpecifications(product: EnrichedProduct): string[] {
  const specs: string[] = [];
  
  // Extract from description
  if (product.descriptionEN) {
    // Simple extraction: look for bullet points or numbered lists
    const lines = product.descriptionEN.split(/[•\n]/).filter(l => l.trim().length > 10);
    specs.push(...lines.slice(0, 5));
  }
  
  // Add price info
  if (product.originalPrice && product.price) {
    const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    specs.push(`${discount}% discount`);
  }
  
  // Add rating info
  if (product.rating) {
    specs.push(`${product.rating} star rating`);
  }
  
  // Add orders info
  if (product.orders) {
    specs.push(`${product.orders}+ orders`);
  }
  
  return specs.filter(Boolean);
}
