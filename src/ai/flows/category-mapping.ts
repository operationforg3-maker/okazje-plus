/**
 * Category Mapping Flow
 * 
 * Uses AI to automatically map marketplace categories to platform categories.
 * Analyzes category names, paths, and typical products to find best matches.
 */

import { ai } from '@genkit-ai/ai';
import { gemini15Flash } from '@genkit-ai/google-genai';
import { logger } from '@/lib/logging';

/**
 * Input for category mapping
 */
export interface CategoryMappingInput {
  marketplaceName: string;
  marketplaceCategory: {
    id: string;
    name: string;
    path?: string[]; // Full category hierarchy
    description?: string;
    exampleProducts?: string[]; // Example product names in this category
  };
  platformCategories: Array<{
    mainSlug: string;
    subSlug?: string;
    subSubSlug?: string;
    name: string;
    description?: string;
  }>;
}

/**
 * Result of category mapping
 */
export interface CategoryMappingResult {
  suggestedMapping: {
    mainSlug: string;
    subSlug?: string;
    subSubSlug?: string;
    name: string;
  };
  confidence: number; // 0-1
  reasoning: string;
  alternativeMappings: Array<{
    mainSlug: string;
    subSlug?: string;
    subSubSlug?: string;
    name: string;
    confidence: number;
  }>;
  requiresManualReview: boolean;
}

/**
 * Define the category mapping flow
 */
export const mapMarketplaceCategory = ai.defineFlow(
  {
    name: 'mapMarketplaceCategory',
    inputSchema: ai.schema<CategoryMappingInput>(),
    outputSchema: ai.schema<CategoryMappingResult>(),
  },
  async (input) => {
    logger.info('Starting category mapping', {
      marketplace: input.marketplaceName,
      categoryId: input.marketplaceCategory.id,
      categoryName: input.marketplaceCategory.name,
    });

    const platformCategoriesList = input.platformCategories
      .map((cat) => {
        const path = [cat.mainSlug, cat.subSlug, cat.subSubSlug]
          .filter(Boolean)
          .join(' → ');
        return `- ${path} (${cat.name})${cat.description ? `: ${cat.description}` : ''}`;
      })
      .join('\n');

    const prompt = `
Jesteś ekspertem w mapowaniu kategorii produktów między różnymi marketplace.
Przeanalizuj kategorię z marketplace "${input.marketplaceName}" i znajdź najbardziej odpowiadającą kategorię na naszej platformie.

KATEGORIA DO ZMAPOWANIA:
Nazwa: ${input.marketplaceCategory.name}
${input.marketplaceCategory.path ? `Pełna ścieżka: ${input.marketplaceCategory.path.join(' → ')}` : ''}
${input.marketplaceCategory.description ? `Opis: ${input.marketplaceCategory.description}` : ''}
${input.marketplaceCategory.exampleProducts ? `Przykładowe produkty:\n${input.marketplaceCategory.exampleProducts.map(p => `- ${p}`).join('\n')}` : ''}

DOSTĘPNE KATEGORIE PLATFORMY:
${platformCategoriesList}

Zwróć odpowiedź w formacie JSON z następującymi polami:
{
  "suggestedMapping": {
    "mainSlug": "slug-kategorii-glownej",
    "subSlug": "slug-podkategorii (opcjonalnie)",
    "subSubSlug": "slug-pod-podkategorii (opcjonalnie)",
    "name": "pełna nazwa kategorii"
  },
  "confidence": number (0-1),
  "reasoning": "szczegółowe uzasadnienie wyboru",
  "alternativeMappings": [
    {
      "mainSlug": "slug",
      "subSlug": "slug",
      "subSubSlug": "slug",
      "name": "nazwa",
      "confidence": number (0-1)
    }
  ],
  "requiresManualReview": boolean
}

Kryteria mapowania:
1. Hierarchia kategorii (najważniejsze)
2. Semantyczne znaczenie nazw
3. Typowe produkty w kategorii
4. Poziom szczegółowości
5. Zwyczaje branżowe

Uwagi:
- Jeśli confidence < 0.7, ustaw requiresManualReview na true
- Podaj maksymalnie 3 alternatywne mapowania
- Jeśli kategoria marketplace jest ogólna, zmapuj na kategorię główną bez podkategorii
- Jeśli kategoria marketplace jest bardzo specyficzna, użyj pełnej hierarchii (main → sub → subSub)
`;

    try {
      const response = await ai.generate({
        model: gemini15Flash,
        prompt,
        config: {
          temperature: 0.2, // Low temperature for consistent results
        },
      });

      const result = JSON.parse(response.text) as CategoryMappingResult;
      
      logger.info('Category mapping completed', {
        marketplace: input.marketplaceName,
        categoryId: input.marketplaceCategory.id,
        suggestedMapping: result.suggestedMapping,
        confidence: result.confidence,
        requiresReview: result.requiresManualReview,
      });

      return result;
    } catch (error) {
      logger.error('Category mapping failed', { error });
      throw error;
    }
  }
);

/**
 * Batch map multiple categories
 */
export interface BatchCategoryMappingInput {
  marketplaceName: string;
  categories: Array<{
    id: string;
    name: string;
    path?: string[];
    description?: string;
  }>;
  platformCategories: Array<{
    mainSlug: string;
    subSlug?: string;
    subSubSlug?: string;
    name: string;
    description?: string;
  }>;
}

export interface BatchCategoryMappingResult {
  mappings: Array<{
    marketplaceCategoryId: string;
    marketplaceCategoryName: string;
    suggestedMapping: CategoryMappingResult['suggestedMapping'];
    confidence: number;
    requiresManualReview: boolean;
  }>;
  successCount: number;
  failedCount: number;
  averageConfidence: number;
}

/**
 * Batch map marketplace categories
 */
export const batchMapCategories = ai.defineFlow(
  {
    name: 'batchMapCategories',
    inputSchema: ai.schema<BatchCategoryMappingInput>(),
    outputSchema: ai.schema<BatchCategoryMappingResult>(),
  },
  async (input) => {
    logger.info('Starting batch category mapping', {
      marketplace: input.marketplaceName,
      categoriesCount: input.categories.length,
    });

    const mappings: BatchCategoryMappingResult['mappings'] = [];
    let successCount = 0;
    let failedCount = 0;
    let totalConfidence = 0;

    for (const category of input.categories) {
      try {
        const result = await mapMarketplaceCategory({
          marketplaceName: input.marketplaceName,
          marketplaceCategory: category,
          platformCategories: input.platformCategories,
        });

        mappings.push({
          marketplaceCategoryId: category.id,
          marketplaceCategoryName: category.name,
          suggestedMapping: result.suggestedMapping,
          confidence: result.confidence,
          requiresManualReview: result.requiresManualReview,
        });

        successCount++;
        totalConfidence += result.confidence;
      } catch (error) {
        logger.error('Failed to map category', {
          marketplace: input.marketplaceName,
          categoryId: category.id,
          error,
        });
        failedCount++;
      }
    }

    const averageConfidence = successCount > 0 ? totalConfidence / successCount : 0;

    logger.info('Batch category mapping completed', {
      marketplace: input.marketplaceName,
      successCount,
      failedCount,
      averageConfidence,
    });

    return {
      mappings,
      successCount,
      failedCount,
      averageConfidence,
    };
  }
);
