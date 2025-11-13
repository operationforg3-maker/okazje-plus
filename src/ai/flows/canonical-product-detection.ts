/**
 * Canonical Product Detection Flow
 * 
 * Uses AI to detect if products from different marketplaces are the same product.
 * Analyzes title, description, and attributes to determine similarity.
 */

import { ai } from '@genkit-ai/ai';
import { gemini15Flash } from '@genkit-ai/google-genai';
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
 * Define the canonical product detection flow
 */
export const detectCanonicalProduct = ai.defineFlow(
  {
    name: 'detectCanonicalProduct',
    inputSchema: ai.schema<ProductComparisonInput>(),
    outputSchema: ai.schema<CanonicalProductResult>(),
  },
  async (input) => {
    logger.info('Starting canonical product detection', {
      product1: input.product1.id,
      product2: input.product2.id,
    });

    const prompt = `
Jesteś ekspertem w porównywaniu produktów z różnych marketplace.
Przeanalizuj poniższe dwa produkty i określ, czy są to ten sam produkt.

PRODUKT 1 (z ${input.product1.marketplace}):
Nazwa: ${input.product1.name}
Opis: ${input.product1.description}
Atrybuty: ${JSON.stringify(input.product1.attributes || {})}

PRODUKT 2 (z ${input.product2.marketplace}):
Nazwa: ${input.product2.name}
Opis: ${input.product2.description}
Atrybuty: ${JSON.stringify(input.product2.attributes || {})}

Zwróć odpowiedź w formacie JSON z następującymi polami:
{
  "isSameProduct": boolean,
  "confidence": number (0-1),
  "reasoning": "szczegółowe uzasadnienie decyzji",
  "canonicalName": "zunifikowana nazwa produktu",
  "differences": ["lista różnic między produktami"],
  "similarities": ["lista podobieństw między produktami"],
  "recommendedMergeStrategy": "keep_first" | "keep_second" | "merge_attributes"
}

Kryteria porównania:
1. Marka i model (najważniejsze)
2. Kluczowe specyfikacje techniczne
3. Typ/kategoria produktu
4. Zignoruj różnice w:
   - Cenie
   - Kolorze/wariancie (jeśli to ten sam model)
   - Języku opisu
   - Promocyjnych dodatków
   - Długości opisu
`;

    try {
      const response = await ai.generate({
        model: gemini15Flash,
        prompt,
        config: {
          temperature: 0.1, // Low temperature for consistent results
        },
      });

      const result = JSON.parse(response.text) as CanonicalProductResult;
      
      logger.info('Canonical product detection completed', {
        product1: input.product1.id,
        product2: input.product2.id,
        isSameProduct: result.isSameProduct,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logger.error('Canonical product detection failed', { error });
      throw error;
    }
  }
);

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
export const batchDetectCanonicalProduct = ai.defineFlow(
  {
    name: 'batchDetectCanonicalProduct',
    inputSchema: ai.schema<BatchCanonicalDetectionInput>(),
    outputSchema: ai.schema<BatchCanonicalDetectionResult>(),
  },
  async (input) => {
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
);
