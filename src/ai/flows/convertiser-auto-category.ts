/**
 * Convertiser Auto-Category Flow
 * 
 * Uses Gemini AI to automatically assign the correct category (main/sub/sub-sub)
 * to Convertiser products based on title, description, and available categories.
 */

'use server';

import { gemini20Flash } from '@genkit-ai/vertexai';
import { ai } from '../genkit';
import { z } from 'zod';
import { logger } from '@/lib/logging';
import { parseJsonFromResponse } from '@/lib/vertex';

/**
 * Schema for category mapping result
 */
const CategoryAssignmentSchema = z.object({
  mainCategorySlug: z.string().describe('Main category slug (e.g., "elektronika")'),
  subCategorySlug: z.string().describe('Sub-category slug (e.g., "telefony")'),
  subSubCategorySlug: z.string().optional().describe('Sub-sub-category slug (e.g., "flagship")'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().describe('Explanation of why this category was chosen'),
});

type CategoryAssignment = z.infer<typeof CategoryAssignmentSchema>;

/**
 * Auto-assign category for a product
 */
export const assignProductCategory = ai.defineFlow(
  {
    name: 'assignProductCategory',
    inputSchema: z.object({
      productTitle: z.string().describe('Product title'),
      productDescription: z.string().optional().describe('Product description'),
      availableCategories: z.array(
        z.object({
          mainSlug: z.string(),
          mainName: z.string(),
          subSlug: z.string(),
          subName: z.string(),
          subSubSlug: z.string().optional(),
          subSubName: z.string().optional(),
        })
      ).describe('List of available platform categories'),
    }),
    outputSchema: CategoryAssignmentSchema,
  },
  async (input) => {
    try {
      logger.info('Starting auto-category assignment', {
        productTitle: input.productTitle,
        availableCategoriesCount: input.availableCategories.length,
      });

      // Format categories for prompt
      const categoryList = input.availableCategories
        .map((cat) => {
          const path = cat.subSubName
            ? `${cat.mainName} → ${cat.subName} → ${cat.subSubName}`
            : `${cat.mainName} → ${cat.subName}`;
          return `- ${path} (${cat.mainSlug}/${cat.subSlug}${cat.subSubSlug ? '/' + cat.subSubSlug : ''})`;
        })
        .join('\n');

      const prompt = `You are an expert product categorization system. Analyze the product and assign it to the MOST APPROPRIATE category.

Product Information:
- Title: "${input.productTitle}"
${input.productDescription ? `- Description: "${input.productDescription.substring(0, 500)}"` : ''}

Available Categories (Polish marketplace structure):
${categoryList}

Instructions:
1. Analyze the product title and description
2. Find the BEST matching category from the list above
3. Return the category slugs (mainSlug/subSlug/subSubSlug)
4. Provide confidence score (0.0-1.0) based on match quality
5. Explain your reasoning

IMPORTANT: You MUST return a valid JSON response with the structure:
{
  "mainCategorySlug": "string",
  "subCategorySlug": "string", 
  "subSubCategorySlug": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "explanation"
}`;

      const response = await ai.generate({
        model: gemini20Flash,
        prompt,
        config: {
          temperature: 0.3,
          topK: 1,
        },
      });

      const responseText = response.text ?? '';
      logger.info('AI categorization response', { responseText });

      const parsed = parseJsonFromResponse(responseText);
      const result = CategoryAssignmentSchema.parse(parsed || {});

      // Validate that the assigned category exists in availableCategories
      const categoryExists = input.availableCategories.some((cat) => {
        const matches =
          cat.mainSlug === result.mainCategorySlug &&
          cat.subSlug === result.subCategorySlug &&
          (result.subSubCategorySlug === undefined ||
            result.subSubCategorySlug === null ||
            cat.subSubSlug === result.subSubCategorySlug);
        return matches;
      });

      if (!categoryExists) {
        logger.warn('AI assigned non-existent category, falling back to first category', {
          assignedCategory: result,
        });
        // Fallback to first category
        const fallback = input.availableCategories[0];
        return {
          mainCategorySlug: fallback.mainSlug,
          subCategorySlug: fallback.subSlug,
          subSubCategorySlug: fallback.subSubSlug,
          confidence: 0.5,
          reasoning: 'AI assigned invalid category, using fallback',
        };
      }

      logger.info('Category assignment successful', {
        assignedCategory: result.mainCategorySlug + '/' + result.subCategorySlug,
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      logger.error('Category assignment failed', {
        error: error instanceof Error ? error.message : String(error),
        productTitle: input.productTitle,
      });

      // Return first category as fallback
      if (input.availableCategories.length > 0) {
        const fallback = input.availableCategories[0];
        return {
          mainCategorySlug: fallback.mainSlug,
          subCategorySlug: fallback.subSlug,
          subSubCategorySlug: fallback.subSubSlug,
          confidence: 0.3,
          reasoning: 'Error in AI categorization, using fallback category',
        };
      }

      throw error;
    }
  }
);

/**
 * Batch assign categories for multiple products
 */
export const batchAssignCategories = ai.defineFlow(
  {
    name: 'batchAssignCategories',
    inputSchema: z.object({
      products: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string().optional(),
        })
      ),
      availableCategories: z.array(
        z.object({
          mainSlug: z.string(),
          mainName: z.string(),
          subSlug: z.string(),
          subName: z.string(),
          subSubSlug: z.string().optional(),
          subSubName: z.string().optional(),
        })
      ),
    }),
    outputSchema: z.array(
      z.object({
        productId: z.string(),
        assignment: CategoryAssignmentSchema,
      })
    ),
  },
  async (input) => {
    const results = [];

    for (const product of input.products) {
      try {
        const assignment = await assignProductCategory({
          productTitle: product.title,
          productDescription: product.description,
          availableCategories: input.availableCategories,
        });

        results.push({
          productId: product.id,
          assignment,
        });
      } catch (error) {
        logger.error('Batch categorization failed for product', {
          productId: product.id,
          error: error instanceof Error ? error.message : String(error),
        });

        // Add fallback for failed product
        const fallback = input.availableCategories[0];
        results.push({
          productId: product.id,
          assignment: {
            mainCategorySlug: fallback.mainSlug,
            subCategorySlug: fallback.subSlug,
            subSubCategorySlug: fallback.subSubSlug,
            confidence: 0.1,
            reasoning: 'Error during batch processing, using fallback',
          },
        });
      }
    }

    return results;
  }
);
