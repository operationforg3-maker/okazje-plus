/**
 * Server-only helpers for AI-driven deduplication flows.
 */
import 'server-only';

import { ai } from '@/ai/genkit';
import { findSimilarProducts } from '@/lib/embeddings';
import { logger } from '@/lib/logging';
import { DuplicateGroup, Product } from '@/lib/types';

/**
 * Similarity threshold for considering products as duplicates.
 */
const DUPLICATE_THRESHOLD = 0.85; // 85% similarity

/**
 * Detect whether a product is a duplicate of an existing one.
 * Returns the most similar product and similarity score when found.
 */
export async function detectDuplicate(
  product: Product,
  threshold: number = DUPLICATE_THRESHOLD
): Promise<{ isDuplicate: boolean; similarProduct?: Product; similarity?: number }> {
  try {
    logger.info('Detecting duplicates for product', { productId: product.id });

    const similarProducts = await findSimilarProducts(product, threshold, 1);

    if (similarProducts.length === 0) {
      logger.info('No duplicates found', { productId: product.id });
      return { isDuplicate: false };
    }

    const mostSimilar = similarProducts[0];

    logger.info('Duplicate detected', {
      productId: product.id,
      duplicateOf: mostSimilar.product.id,
      similarity: mostSimilar.similarity,
    });

    return {
      isDuplicate: true,
      similarProduct: mostSimilar.product,
      similarity: mostSimilar.similarity,
    };
  } catch (error) {
    logger.error('Duplicate detection failed', { productId: product.id, error });
    throw error;
  }
}

/**
 * Get AI suggestion for canonical product.
 * Analyzes products and suggests which should be the main one.
 */
export async function getCanonicalSuggestion(
  products: Product[]
): Promise<DuplicateGroup['aiSuggestion']> {
  try {
    logger.info('Getting AI canonical suggestion', {
      productCount: products.length,
    });

    const productSummaries = products.map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      rating: p.ratingCard.average,
      reviewCount: p.ratingCard.count,
      description: p.description.substring(0, 200),
    }));

    const prompt = `
Analyze these similar products and suggest which should be the canonical (main) product.
Consider factors like:
- Product name quality (clear, descriptive)
- Price (more competitive)
- Rating and review count (higher is better)
- Description quality

Products:
${JSON.stringify(productSummaries, null, 2)}

Return a JSON object with:
{
  "recommendedCanonical": "product_id",
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}
`;

    const result = await ai.generate({ prompt });
    const suggestion = JSON.parse(result.text);

    logger.info('AI canonical suggestion received', {
      recommended: suggestion.recommendedCanonical,
      confidence: suggestion.confidence,
    });

    return suggestion;
  } catch (error) {
    logger.error('Failed to get AI canonical suggestion', { error });

    const sorted = [...products].sort((a, b) => {
      const scoreA = a.ratingCard.average * Math.log(a.ratingCard.count + 1);
      const scoreB = b.ratingCard.average * Math.log(b.ratingCard.count + 1);
      return scoreB - scoreA;
    });

    return {
      recommendedCanonical: sorted[0].id,
      confidence: 0.5,
      reasoning: 'Fallback: Selected product with highest rating * log(review count)',
    };
  }
}
