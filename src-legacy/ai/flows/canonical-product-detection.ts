'use server';

/**
 * Canonical Product Detection AI Helper
 * 
 * Uses AI to detect if products from different marketplaces are the same product.
 * Note: Simplified implementation without genkit flows for now.
 */

import { logger } from '@/lib/logging';

/**
 * Product data for comparison
 */
export interface ProductComparisonInput {
  product1: {
    id: string;
    name: string;
    description: string;
    attributes?: Record<string, string>;
    marketplace: string;
  };
  product2: {
    id: string;
    name: string;
    description: string;
    attributes?: Record<string, string>;
    marketplace: string;
  };
}

/**
 * Result of product comparison
 */
export interface CanonicalProductResult {
  isSameProduct: boolean;
  confidence: number; // 0-1
  reasoning: string;
  canonicalName: string;
  differences: string[];
  similarities: string[];
  recommendedMergeStrategy: 'keep_first' | 'keep_second' | 'merge_attributes';
}

/**
 * Detect if two products are the same canonical product
 * 
 * @param input - Products to compare
 * @returns Comparison result with confidence
 */
export async function detectCanonicalProduct(
  input: ProductComparisonInput
): Promise<CanonicalProductResult> {
  logger.info('Starting canonical product detection', {
    product1: input.product1.id,
    product2: input.product2.id,
  });

  // Simple heuristic matching for now
  // TODO: Implement AI-based detection using Genkit when needed
  
  const name1 = input.product1.name.toLowerCase();
  const name2 = input.product2.name.toLowerCase();
  
  // Calculate similarity score based on name overlap
  const words1 = new Set(name1.split(/\s+/));
  const words2 = new Set(name2.split(/\s+/));
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  const similarity = intersection.size / union.size;
  
  const isSameProduct = similarity > 0.6;
  const confidence = similarity;
  
  const result: CanonicalProductResult = {
    isSameProduct,
    confidence,
    reasoning: `Name similarity: ${(similarity * 100).toFixed(1)}% - ${isSameProduct ? 'Products match' : 'Products differ'}`,
    canonicalName: input.product1.name,
    differences: isSameProduct ? [] : ['Product names differ significantly'],
    similarities: isSameProduct ? ['Product names are similar'] : [],
    recommendedMergeStrategy: 'merge_attributes',
  };

  logger.info('Canonical product detection completed', {
    product1: input.product1.id,
    product2: input.product2.id,
    isSameProduct: result.isSameProduct,
    confidence: result.confidence,
  });

  return result;
}

/**
 * Batch detect canonical products
 */
export interface BatchCanonicalDetectionInput {
  candidateProduct: {
    id: string;
    name: string;
    description: string;
    attributes?: Record<string, string>;
    marketplace: string;
  };
  existingProducts: Array<{
    id: string;
    name: string;
    description: string;
    attributes?: Record<string, string>;
    marketplace: string;
  }>;
  confidenceThreshold?: number; // Default 0.7
}

export interface BatchCanonicalDetectionResult {
  matches: Array<{
    productId: string;
    confidence: number;
    reasoning: string;
  }>;
  bestMatch: {
    productId: string;
    confidence: number;
  } | null;
  noMatchFound: boolean;
}

/**
 * Find canonical product matches in a batch
 */
export async function batchDetectCanonicalProduct(
  input: BatchCanonicalDetectionInput
): Promise<BatchCanonicalDetectionResult> {
  logger.info('Starting batch canonical product detection', {
    candidateId: input.candidateProduct.id,
    existingProductsCount: input.existingProducts.length,
  });

  const threshold = input.confidenceThreshold || 0.7;
  const matches: Array<{ productId: string; confidence: number; reasoning: string }> = [];

  // Compare candidate with each existing product
  for (const existingProduct of input.existingProducts) {
    try {
      const result = await detectCanonicalProduct({
        product1: input.candidateProduct,
        product2: existingProduct,
      });

      if (result.isSameProduct && result.confidence >= threshold) {
        matches.push({
          productId: existingProduct.id,
          confidence: result.confidence,
          reasoning: result.reasoning,
        });
      }
    } catch (error) {
      logger.error('Failed to compare products', {
        candidate: input.candidateProduct.id,
        existing: existingProduct.id,
        error,
      });
    }
  }

  // Sort matches by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  const bestMatch =
    matches.length > 0
      ? { productId: matches[0].productId, confidence: matches[0].confidence }
      : null;

  logger.info('Batch canonical product detection completed', {
    candidateId: input.candidateProduct.id,
    matchesFound: matches.length,
    bestMatchId: bestMatch?.productId,
    bestMatchConfidence: bestMatch?.confidence,
  });

  return {
    matches,
    bestMatch,
    noMatchFound: matches.length === 0,
  };
}
