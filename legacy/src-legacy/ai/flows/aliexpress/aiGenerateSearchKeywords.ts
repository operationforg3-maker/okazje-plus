'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { logger } from '@/lib/logging';

/**
 * AI-powered search keyword generation for AliExpress import
 * 
 * Takes category/subcategory/sub-subcategory context and generates
 * diverse, relevant English search keywords for maximum product discovery.
 */

const KeywordGenerationInputSchema = z.object({
  categoryName: z.string().min(2).describe('Main category name (e.g., "Electronics")'),
  subcategoryName: z.string().min(2).describe('Subcategory name (e.g., "Smartphones")'),
  subsubcategoryName: z.string().min(2).describe('Sub-subcategory name (e.g., "Smartfony")'),
  categoryDescription: z.string().optional().describe('Optional category description for context'),
  fallbackKeywords: z.array(z.string()).optional().describe('Fallback keywords if AI fails'),
});

export type KeywordGenerationInput = z.infer<typeof KeywordGenerationInputSchema>;

const KeywordGenerationOutputSchema = z.object({
  keywords: z.array(z.string()).describe('Array of 8-15 relevant English search keywords for AliExpress'),
  reasoning: z.string().describe('Brief explanation of keyword strategy'),
});

export type KeywordGenerationOutput = z.infer<typeof KeywordGenerationOutputSchema>;

const keywordGenerationPrompt = ai.definePrompt({
  name: 'aiGenerateSearchKeywordsPrompt',
  input: { schema: KeywordGenerationInputSchema },
  output: { schema: KeywordGenerationOutputSchema },
  prompt: `You are an expert in e-commerce product search and AliExpress API optimization.

TASK: Generate 8-15 diverse, relevant English search keywords for AliExpress product discovery.

CONTEXT:
• Main Category: {{{categoryName}}}
• Subcategory: {{{subcategoryName}}}
• Sub-subcategory: {{{subsubcategoryName}}}
{{#if categoryDescription}}• Category Description: {{{categoryDescription}}}{{/if}}

REQUIREMENTS FOR KEYWORDS:
1. **Language**: All keywords must be in English (AliExpress API requirement)
2. **Diversity**: Mix of:
   - Specific product types (e.g., "xiaomi smartphone", "iphone 15")
   - Generic category terms (e.g., "smartphone", "mobile phone")
   - Popular brands in category
   - Common variations (e.g., "phone", "cell phone", "mobile")
   - Common modifiers ("best", "cheap", "new", "fast")
3. **Relevance**: Keywords should match the sub-subcategory context
4. **AliExpress-friendly**: Use terms that typically return good results on AliExpress
5. **No Chinese**: Avoid Chinese brand names or untranslated terms
6. **Practical**: Balance between specific and generic for broad discovery

GUIDELINES:
✓ Include product type keywords: "smartphone", "mobile phone", "cell phone"
✓ Include brand keywords if relevant: "samsung", "xiaomi", "apple", "oneplus"
✓ Include feature keywords: "5g", "waterproof", "fast charging", "large screen"
✓ Include modifier combinations: "best smartphone", "cheap phone", "gaming phone"
✓ Use lowercase and hyphens for multi-word terms
✗ Avoid Chinese/untranslated terms
✗ Don't include Polish words (despite Polish context - API is English-only)
✗ Don't include numbers or prices
✗ Don't include very generic terms like "product" or "item"

EXAMPLES:
- For "Smartfony" (Smartphones):
  ["smartphone", "mobile phone", "5g phone", "android phone", "iphone", "xiaomi phone", "samsung galaxy", "gaming phone", "waterproof phone", "cheap smartphone", "best phone", "new smartphone"]
  
- For "Słuchawki" (Headphones):
  ["headphones", "wireless headphones", "bluetooth headphones", "earbuds", "noise cancelling", "gaming headset", "sports headphones", "over ear headphones", "cheap headphones"]

- For "Powerbanki" (Power Banks):
  ["power bank", "portable charger", "battery bank", "fast charging", "solar charger", "wireless charger", "20000mah", "usb-c charger"]

OUTPUT:
Generate keywords array with 8-15 terms that would effectively search AliExpress for products in this category.
Include both specific and generic terms for maximum product discovery.`,
});

const keywordGenerationFlow = ai.defineFlow({
  name: 'keywordGenerationFlowAliExpress',
  inputSchema: KeywordGenerationInputSchema,
  outputSchema: KeywordGenerationOutputSchema,
}, async (input) => {
  const { output } = await keywordGenerationPrompt(input);
  return output!;
});

/**
 * Generate search keywords for AliExpress import using AI
 * Falls back to basic keyword list if AI fails
 */
export async function aiGenerateSearchKeywords(input: KeywordGenerationInput): Promise<KeywordGenerationOutput> {
  logger.debug('AI search keyword generation', {
    category: `${input.categoryName}/${input.subcategoryName}/${input.subsubcategoryName}`,
  });
  
  try {
    const result = await keywordGenerationFlow(input);
    logger.info('AI keyword generation succeeded', {
      count: result.keywords.length,
      keywords: result.keywords.slice(0, 5).join(', ') + '...',
    });
    return result;
  } catch (error) {
    logger.error('AI keyword generation failed', { error });
    
    // Fallback: Generate basic keywords from category names
    const fallback = input.fallbackKeywords?.length ? input.fallbackKeywords : [];
    
    // Add basic keywords from names
    const basicKeywords = [
      input.subsubcategoryName.toLowerCase(),
      input.subcategoryName.toLowerCase(),
      `${input.categoryName.toLowerCase()} ${input.subcategoryName.toLowerCase()}`,
    ].filter(Boolean);
    
    const allKeywords = [...new Set([...basicKeywords, ...fallback])].slice(0, 10);
    
    return {
      keywords: allKeywords,
      reasoning: 'Fallback keywords generated from category names (AI generation failed)',
    };
  }
}
