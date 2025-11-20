'use server';

/**
 * AI Product Translation Flow
 * 
 * Translates product content from Polish to English and German
 * Used during bulk import and product updates
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

/**
 * Input schema for product translation
 */
const ProductTranslationInputSchema = z.object({
  name: z.string().describe('Product name in Polish'),
  description: z.string().describe('Product description in Polish'),
  longDescription: z.string().optional().describe('Long product description in Polish'),
  seoKeywords: z.array(z.string()).optional().describe('SEO keywords in Polish'),
  metaTitle: z.string().optional().describe('Meta title in Polish'),
  metaDescription: z.string().optional().describe('Meta description in Polish'),
  targetLanguages: z.array(z.enum(['en', 'de'])).default(['en', 'de']).describe('Target languages'),
});

export type ProductTranslationInput = z.infer<typeof ProductTranslationInputSchema>;

/**
 * Output schema for product translation
 */
const ProductTranslationOutputSchema = z.object({
  en: z.object({
    name: z.string().describe('Product name in English'),
    description: z.string().describe('Description in English'),
    longDescription: z.string().optional().describe('Long description in English'),
    seoKeywords: z.array(z.string()).optional().describe('SEO keywords in English'),
    metaTitle: z.string().optional().describe('Meta title in English'),
    metaDescription: z.string().optional().describe('Meta description in English'),
  }).optional(),
  de: z.object({
    name: z.string().describe('Product name in German'),
    description: z.string().describe('Description in German'),
    longDescription: z.string().optional().describe('Long description in German'),
    seoKeywords: z.array(z.string()).optional().describe('SEO keywords in German'),
    metaTitle: z.string().optional().describe('Meta title in German'),
    metaDescription: z.string().optional().describe('Meta description in German'),
  }).optional(),
});

export type ProductTranslationOutput = z.infer<typeof ProductTranslationOutputSchema>;

/**
 * AI prompt for product translation
 */
const translationPrompt = ai.definePrompt({
  name: 'productTranslationPrompt',
  input: { schema: ProductTranslationInputSchema },
  output: { schema: ProductTranslationOutputSchema },
  prompt: `You are an expert e-commerce translator specializing in product content localization.

Translate the following product content from Polish to the target languages: {{{targetLanguages}}}.

**Source Content (Polish):**
- Name: {{{name}}}
- Description: {{{description}}}
{{#if longDescription}}- Long Description: {{{longDescription}}}{{/if}}
{{#if seoKeywords}}- SEO Keywords: {{#each seoKeywords}}{{this}}, {{/each}}{{/if}}
{{#if metaTitle}}- Meta Title: {{{metaTitle}}}{{/if}}
{{#if metaDescription}}- Meta Description: {{{metaDescription}}}{{/if}}

**Translation Guidelines:**

1. **Natural Localization**: Translate naturally, not word-for-word. Adapt to target culture and market.

2. **E-commerce Best Practices**:
   - Product names: Keep brand names, model numbers unchanged
   - Measurements: Convert to local units if needed (e.g., inches for EN, cm for DE)
   - Currency: Keep PLN or mention "approx €X" for DE market
   
3. **SEO Optimization**:
   - Keywords: Translate to commonly searched terms in target language
   - Meta titles/descriptions: Follow length limits (title ~60 chars, description ~160 chars)
   - Use natural, compelling language that drives clicks

4. **Tone and Style**:
   - English (EN): Clear, friendly, benefit-focused
   - German (DE): Precise, detailed, quality-focused
   
5. **Technical Terms**:
   - Keep technical specifications in English if commonly used (e.g., "5G", "USB-C", "LED")
   - Translate features and benefits fully

**Output Format:**

Provide translations in the specified target languages. For each language, include all available fields.

Example structure:
{
  "en": {
    "name": "Wireless Bluetooth Headphones",
    "description": "Premium sound quality with 30-hour battery life...",
    ...
  },
  "de": {
    "name": "Kabellose Bluetooth-Kopfhörer",
    "description": "Premium-Klangqualität mit 30 Stunden Akkulaufzeit...",
    ...
  }
}

Ensure all translations are accurate, natural, and optimized for e-commerce conversion.`,
});

/**
 * Genkit flow for product translation
 */
const translationFlow = ai.defineFlow(
  {
    name: 'productTranslationFlow',
    inputSchema: ProductTranslationInputSchema,
    outputSchema: ProductTranslationOutputSchema,
  },
  async (input) => {
    const { output } = await translationPrompt(input);
    return output!;
  }
);

/**
 * Translate product content to multiple languages
 * 
 * @param input Product content in Polish
 * @returns Translations in English and German
 */
export async function aiTranslateProduct(
  input: ProductTranslationInput
): Promise<ProductTranslationOutput> {
  logger.debug('AI product translation started', { name: input.name, languages: input.targetLanguages });
  
  try {
    const result = await translationFlow(input);
    
    logger.info('Product translation completed', {
      name: input.name,
      languages: Object.keys(result),
    });
    
    return result;
  } catch (error) {
    logger.error('AI product translation failed', { error, input });
    
    // Fallback: basic machine translation placeholder
    // In production, consider using Google Translate API as fallback
    const fallback: ProductTranslationOutput = {};
    
    if (input.targetLanguages.includes('en')) {
      fallback.en = {
        name: `[EN] ${input.name}`,
        description: `[EN] ${input.description}`,
        longDescription: input.longDescription ? `[EN] ${input.longDescription}` : undefined,
        seoKeywords: input.seoKeywords?.map(k => `[EN] ${k}`),
        metaTitle: input.metaTitle ? `[EN] ${input.metaTitle}` : undefined,
        metaDescription: input.metaDescription ? `[EN] ${input.metaDescription}` : undefined,
      };
    }
    
    if (input.targetLanguages.includes('de')) {
      fallback.de = {
        name: `[DE] ${input.name}`,
        description: `[DE] ${input.description}`,
        longDescription: input.longDescription ? `[DE] ${input.longDescription}` : undefined,
        seoKeywords: input.seoKeywords?.map(k => `[DE] ${k}`),
        metaTitle: input.metaTitle ? `[DE] ${input.metaTitle}` : undefined,
        metaDescription: input.metaDescription ? `[DE] ${input.metaDescription}` : undefined,
      };
    }
    
    return fallback;
  }
}
