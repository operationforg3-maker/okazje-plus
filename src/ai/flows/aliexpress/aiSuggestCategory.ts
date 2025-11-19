'use server';

/**
 * AI Category Suggestion Flow
 * 
 * Suggests appropriate 3-level category mapping for AliExpress products
 * using Genkit AI analysis of product title, description, and metadata.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

/**
 * Input schema for category suggestion
 */
const CategorySuggestionInputSchema = z.object({
  title: z.string().describe('Product title'),
  description: z.string().optional().describe('Product description'),
  aliexpressCategory: z.string().optional().describe('Original AliExpress category'),
  price: z.number().optional().describe('Product price in PLN'),
});

export type CategorySuggestionInput = z.infer<typeof CategorySuggestionInputSchema>;

/**
 * Output schema from category suggestion
 */
const CategorySuggestionOutputSchema = z.object({
  mainCategorySlug: z
    .string()
    .describe('Main category slug (level 1)'),
  subCategorySlug: z
    .string()
    .describe('Sub-category slug (level 2)'),
  subSubCategorySlug: z
    .string()
    .optional()
    .describe('Sub-sub-category slug (level 3, optional)'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score (0-1) for the suggestion'),
  reasoning: z
    .string()
    .optional()
    .describe('Brief explanation of why this category was suggested'),
});

export type CategorySuggestionOutput = z.infer<typeof CategorySuggestionOutputSchema>;

/**
 * AI prompt for category suggestion
 */
const categoryPrompt = ai.definePrompt({
  name: 'categorySuggestionPrompt',
  input: { schema: CategorySuggestionInputSchema },
  output: { schema: CategorySuggestionOutputSchema },
  prompt: `You are an expert e-commerce product categorization specialist for a Polish deals platform.

Analyze the product and suggest the best 3-level category mapping:

**Product Details:**
- Title: {{{title}}}
{{#if description}}- Description: {{{description}}}{{/if}}
{{#if aliexpressCategory}}- AliExpress Category: {{{aliexpressCategory}}}{{/if}}
{{#if price}}- Price: {{{price}}} PLN{{/if}}

**Available Category Tree (Polish marketplace):**

1. **elektronika** (Electronics)
   - smartfony (Smartphones)
   - tablety (Tablets)
   - laptopy (Laptops)
   - audio (Audio)
   - fotografia (Photography)
   - akcesoria (Accessories)
   - inne (Other)

2. **moda** (Fashion)
   - odziez-damska (Women's Clothing)
   - odziez-meska (Men's Clothing)
   - obuwie (Footwear)
   - akcesoria-modowe (Fashion Accessories)
   - bizuteria (Jewelry)
   - inne (Other)

3. **dom-i-ogrod** (Home & Garden)
   - meble (Furniture)
   - dekoracje (Decorations)
   - ogrod (Garden)
   - narzedzia (Tools)
   - agd (Appliances)
   - inne (Other)

4. **sport-i-turystyka** (Sports & Tourism)
   - fitness (Fitness)
   - odziez-sportowa (Sportswear)
   - turystyka (Tourism)
   - akcesoria-sportowe (Sports Accessories)
   - inne (Other)

5. **zdrowie-i-uroda** (Health & Beauty)
   - kosmetyki (Cosmetics)
   - suplementy (Supplements)
   - pielegnacja (Skincare)
   - perfumy (Perfumes)
   - inne (Other)

6. **kultura-i-rozrywka** (Culture & Entertainment)
   - ksiazki (Books)
   - filmy (Movies)
   - gry (Games)
   - muzyka (Music)
   - zabawki (Toys)
   - inne (Other)

7. **inne** (Other)
   - pozostale (Miscellaneous)

**Instructions:**
1. Match the product to the most specific category path (3 levels if possible)
2. Use slug format (lowercase, hyphens instead of spaces)
3. Provide confidence score: 1.0 (exact match), 0.7-0.9 (good match), 0.4-0.6 (uncertain), <0.4 (fallback)
4. Explain your reasoning briefly in Polish

Output category slugs in Polish (e.g., mainCategorySlug: "elektronika", subCategorySlug: "smartfony").`,
});

/**
 * Genkit flow for category suggestion
 */
const categoryFlow = ai.defineFlow(
  {
    name: 'categorySuggestionFlow',
    inputSchema: CategorySuggestionInputSchema,
    outputSchema: CategorySuggestionOutputSchema,
  },
  async (input) => {
    const { output } = await categoryPrompt(input);
    return output!;
  }
);

/**
 * Suggest category for a product using AI
 * 
 * @param input Product information
 * @returns Suggested category mapping
 */
export async function aiSuggestCategory(
  input: CategorySuggestionInput
): Promise<CategorySuggestionOutput> {
  logger.debug('AI category suggestion', { title: input.title });
  
  try {
    const result = await categoryFlow(input);
    
    logger.info('Category suggestion completed', {
      title: input.title,
      mainCategory: result.mainCategorySlug,
      subCategory: result.subCategorySlug,
      confidence: result.confidence,
    });
    
    return result;
  } catch (error) {
    logger.error('AI category suggestion failed', { error, input });
    
    // Fallback: basic keyword matching
    const titleLower = input.title.toLowerCase();
    
    if (
      /phone|telefon|smartphone|smartfon/i.test(titleLower)
    ) {
      return {
        mainCategorySlug: 'elektronika',
        subCategorySlug: 'smartfony',
        confidence: 0.3,
        reasoning: 'AI failed - fallback keyword match (telefon)',
      };
    }
    
    // Default fallback
    return {
      mainCategorySlug: 'inne',
      subCategorySlug: 'pozostale',
      confidence: 0.2,
      reasoning: 'AI failed - fallback to uncategorized',
    };
  }
}
