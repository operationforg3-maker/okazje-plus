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
  subSubCategorySlug: z.string().nullable().optional().describe('Sub-sub-category slug (e.g., "flagship")'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  reasoning: z.string().describe('Explanation of why this category was chosen'),
});

type CategoryAssignment = z.infer<typeof CategoryAssignmentSchema>;

const normalizeKey = (value?: string | null) => (value || '').trim().toLowerCase();

const getFallbackCategory = (available: Array<{ mainSlug: string; subSlug: string; subSubSlug?: string }>) =>
  available.find(cat => cat.mainSlug === 'uncategorized' && cat.subSlug === 'uncategorized') || available[0];

const resolveCategoryAssignment = (
  assignment: CategoryAssignment,
  available: Array<{
    mainSlug: string;
    mainName: string;
    subSlug: string;
    subName: string;
    subSubSlug?: string;
    subSubName?: string;
  }>
) => {
  const main = normalizeKey(assignment.mainCategorySlug);
  const sub = normalizeKey(assignment.subCategorySlug);
  const subSub = normalizeKey(assignment.subSubCategorySlug || undefined);

  // 1) Exact slug match
  let candidates = available.filter(
    (cat) =>
      normalizeKey(cat.mainSlug) === main &&
      normalizeKey(cat.subSlug) === sub
  );

  if (subSub) {
    candidates = candidates.filter(cat => normalizeKey(cat.subSubSlug) === subSub);
  }

  if (candidates.length > 0) {
    const preferred = subSub ? candidates[0] : (candidates.find(cat => !cat.subSubSlug) || candidates[0]);
    return {
      mainCategorySlug: preferred.mainSlug,
      subCategorySlug: preferred.subSlug,
      subSubCategorySlug: preferred.subSubSlug,
    };
  }

  // 2) Name match (AI sometimes returns names instead of slugs)
  candidates = available.filter(
    (cat) =>
      normalizeKey(cat.mainName) === main &&
      normalizeKey(cat.subName) === sub
  );

  if (subSub) {
    candidates = candidates.filter(cat => normalizeKey(cat.subSubName) === subSub);
  }

  if (candidates.length > 0) {
    const preferred = subSub ? candidates[0] : (candidates.find(cat => !cat.subSubSlug) || candidates[0]);
    return {
      mainCategorySlug: preferred.mainSlug,
      subCategorySlug: preferred.subSlug,
      subSubCategorySlug: preferred.subSubSlug,
    };
  }

  return null;
};

const getSlugOnlyList = (available: Array<{ mainSlug: string; subSlug: string; subSubSlug?: string }>) =>
  available
    .map((cat) => `${cat.mainSlug}/${cat.subSlug}${cat.subSubSlug ? '/' + cat.subSubSlug : ''}`)
    .join('\n');

const reassignWithStrictSlugs = async (
  input: {
    productTitle: string;
    productDescription?: string;
  },
  available: Array<{
    mainSlug: string;
    mainName: string;
    subSlug: string;
    subName: string;
    subSubSlug?: string;
    subSubName?: string;
  }>
) => {
  const slugList = getSlugOnlyList(available);
  const prompt = `Choose EXACTLY ONE category from the list below.

Product:
- Title: "${input.productTitle}"
${input.productDescription ? `- Description: "${input.productDescription.substring(0, 400)}"` : ''}

Allowed category slugs (pick one line exactly as-is):
${slugList}

Return JSON ONLY in this format:
{
  "mainCategorySlug": "string",
  "subCategorySlug": "string",
  "subSubCategorySlug": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "short"
}`;

  const response = await ai.generate({
    model: gemini20Flash,
    prompt,
    config: { temperature: 0.0, topK: 1 },
  });

  const parsed = parseJsonFromResponse(response.text ?? '');
  return CategoryAssignmentSchema.parse(parsed || {});
};

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

      let resolved = resolveCategoryAssignment(result, input.availableCategories);

      if (!resolved) {
        try {
          logger.warn('AI assigned invalid category, retrying with strict slugs', {
            assignedCategory: result,
          });
          const strictResult = await reassignWithStrictSlugs(
            {
              productTitle: input.productTitle,
              productDescription: input.productDescription,
            },
            input.availableCategories
          );
          resolved = resolveCategoryAssignment(strictResult, input.availableCategories);
          if (resolved) {
            return {
              ...strictResult,
              ...resolved,
            };
          }
        } catch (strictErr) {
          logger.warn('Strict slug retry failed', {
            error: strictErr instanceof Error ? strictErr.message : String(strictErr),
          });
        }

        const fallback = getFallbackCategory(input.availableCategories);
        logger.warn('AI assigned non-existent category, falling back to safe category', {
          assignedCategory: result,
          fallback: fallback ? `${fallback.mainSlug}/${fallback.subSlug}` : 'none',
        });

        return {
          mainCategorySlug: fallback.mainSlug,
          subCategorySlug: fallback.subSlug,
          subSubCategorySlug: fallback.subSubSlug,
          confidence: 0.5,
          reasoning: 'AI assigned invalid category, using fallback',
        };
      }

      logger.info('Category assignment successful', {
        assignedCategory: `${resolved.mainCategorySlug}/${resolved.subCategorySlug}`,
        confidence: result.confidence,
      });

      return {
        ...result,
        ...resolved,
      };
    } catch (error) {
      logger.error('Category assignment failed', {
        error: error instanceof Error ? error.message : String(error),
        productTitle: input.productTitle,
      });

      // Return first category as fallback
      if (input.availableCategories.length > 0) {
        const fallback = getFallbackCategory(input.availableCategories);
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
        const fallback = getFallbackCategory(input.availableCategories);
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
