'use server';

/**
 * AI Category Translation Flow
 * 
 * Translates category names and descriptions from Polish to English and German
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

/**
 * Input schema for category translation
 */
const CategoryTranslationInputSchema = z.object({
  name: z.string().describe('Category name in Polish'),
  description: z.string().optional().describe('Category description in Polish'),
  targetLanguages: z.array(z.enum(['en', 'de'])).default(['en', 'de']).describe('Target languages'),
});

export type CategoryTranslationInput = z.infer<typeof CategoryTranslationInputSchema>;

/**
 * Output schema for category translation
 */
const CategoryTranslationOutputSchema = z.object({
  en: z.object({
    name: z.string().describe('Category name in English'),
    description: z.string().optional().describe('Description in English'),
  }).optional(),
  de: z.object({
    name: z.string().describe('Category name in German'),
    description: z.string().optional().describe('Description in German'),
  }).optional(),
});

export type CategoryTranslationOutput = z.infer<typeof CategoryTranslationOutputSchema>;

/**
 * AI prompt for category translation
 */
const categoryTranslationPrompt = ai.definePrompt({
  name: 'categoryTranslationPrompt',
  input: { schema: CategoryTranslationInputSchema },
  output: { schema: CategoryTranslationOutputSchema },
  prompt: `You are an expert e-commerce translator specializing in category and navigation localization.

Translate the following category content from Polish to the target languages: {{{targetLanguages}}}.

**Source Content (Polish):**
- Name: {{{name}}}
{{#if description}}- Description: {{{description}}}{{/if}}

**Translation Guidelines:**

1. **Category Names**: Keep them short, clear, and SEO-friendly
   - Use common e-commerce terminology
   - Consider search behavior in target markets
   
2. **Consistency**: Match standard category naming in target markets
   - Electronics → Electronics (EN), Elektronik (DE)
   - Fashion → Fashion (EN), Mode (DE)
   - Home & Garden → Home & Garden (EN), Haus & Garten (DE)

3. **Descriptions**: 
   - Keep concise and compelling
   - Focus on what users will find in this category
   - Use natural, marketing-friendly language

4. **Cultural Adaptation**:
   - English (EN): Direct, benefit-focused, international terminology
   - German (DE): Precise, compound words where appropriate, formal tone

**Examples:**

Polish: "Elektronika"
- EN: "Electronics"
- DE: "Elektronik"

Polish: "Dom i Ogród"
- EN: "Home & Garden"
- DE: "Haus & Garten"

Polish: "Smartfony i Akcesoria"
- EN: "Smartphones & Accessories"
- DE: "Smartphones & Zubehör"

Provide natural, market-appropriate translations that users will recognize and search for.`,
});

/**
 * Genkit flow for category translation
 */
const categoryTranslationFlow = ai.defineFlow(
  {
    name: 'categoryTranslationFlow',
    inputSchema: CategoryTranslationInputSchema,
    outputSchema: CategoryTranslationOutputSchema,
  },
  async (input) => {
    const { output } = await categoryTranslationPrompt(input);
    return output!;
  }
);

/**
 * Translate category content to multiple languages
 * 
 * @param input Category content in Polish
 * @returns Translations in English and German
 */
export async function aiTranslateCategory(
  input: CategoryTranslationInput
): Promise<CategoryTranslationOutput> {
  logger.debug('AI category translation started', { name: input.name, languages: input.targetLanguages });
  
  try {
    const result = await categoryTranslationFlow(input);
    
    logger.info('Category translation completed', {
      name: input.name,
      languages: Object.keys(result),
    });
    
    return result;
  } catch (error) {
    logger.error('AI category translation failed', { error, input });
    
    // Fallback: basic placeholder
    const fallback: CategoryTranslationOutput = {};
    
    if (input.targetLanguages.includes('en')) {
      fallback.en = {
        name: `[EN] ${input.name}`,
        description: input.description ? `[EN] ${input.description}` : undefined,
      };
    }
    
    if (input.targetLanguages.includes('de')) {
      fallback.de = {
        name: `[DE] ${input.name}`,
        description: input.description ? `[DE] ${input.description}` : undefined,
      };
    }
    
    return fallback;
  }
}
