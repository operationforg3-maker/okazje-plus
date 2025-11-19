'use server';

/**
 * AI SEO Description Generator Flow
 * 
 * Generates unique, SEO-optimized product descriptions in Polish
 * with natural keyword placement and engaging copy.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

/**
 * Input schema for SEO description generation
 */
const SEODescriptionInputSchema = z.object({
  normalizedTitle: z
    .string()
    .describe('Normalized Polish product title'),
  mainCategorySlug: z
    .string()
    .describe('Main category (level 1)'),
  subCategorySlug: z
    .string()
    .describe('Sub-category (level 2)'),
  subSubCategorySlug: z
    .string()
    .optional()
    .describe('Sub-sub-category (level 3, optional)'),
  price: z
    .number()
    .optional()
    .describe('Product price in PLN'),
  rating: z
    .number()
    .optional()
    .describe('Average rating (0-5)'),
  reviewCount: z
    .number()
    .optional()
    .describe('Number of reviews'),
  attributes: z
    .record(z.string())
    .optional()
    .describe('Product attributes (key-value pairs, e.g., color, size, material)'),
});

export type SEODescriptionInput = z.infer<typeof SEODescriptionInputSchema>;

/**
 * Output schema from SEO description generation
 */
const SEODescriptionOutputSchema = z.object({
  description: z
    .string()
    .describe('Unique SEO-optimized Polish description (300-500 words)'),
  keywords: z
    .array(z.string())
    .describe('Extracted main keywords used in the description'),
  metaTitle: z
    .string()
    .optional()
    .describe('Suggested meta title for SEO (50-60 characters)'),
  metaDescription: z
    .string()
    .optional()
    .describe('Suggested meta description (150-160 characters)'),
});

export type SEODescriptionOutput = z.infer<typeof SEODescriptionOutputSchema>;

/**
 * AI prompt for SEO description generation
 */
const seoPrompt = ai.definePrompt({
  name: 'seoDescriptionPrompt',
  input: { schema: SEODescriptionInputSchema },
  output: { schema: SEODescriptionOutputSchema },
  prompt: `You are an expert Polish e-commerce copywriter and SEO specialist.

Generate a unique, engaging, and SEO-optimized product description in Polish.

**Product Information:**
- Title: {{{normalizedTitle}}}
- Category: {{{mainCategorySlug}}} > {{{subCategorySlug}}}{{#if subSubCategorySlug}} > {{{subSubCategorySlug}}}{{/if}}
{{#if price}}- Price: {{{price}}} PLN{{/if}}
{{#if rating}}- Rating: {{{rating}}}/5 ({{reviewCount}} reviews){{/if}}
{{#if attributes}}- Attributes: {{#each attributes}}{{@key}}: {{this}}; {{/each}}{{/if}}

**Requirements:**

1. **Length**: 300-500 words (2-3 paragraphs)
2. **Language**: Natural, fluent Polish (not translated text)
3. **Tone**: Professional yet friendly, engaging
4. **Structure**:
   - Opening: Hook + main product benefit
   - Middle: Features, specifications, use cases
   - Closing: Call to action or value proposition
5. **SEO Keywords**: 
   - Include product name/type naturally 3-5 times
   - Include category-related keywords
   - NO keyword stuffing
   - Natural word order and grammar
6. **Uniqueness**: Write original content (DO NOT copy generic descriptions)
7. **Avoid**:
   - Superlatives without evidence ("najlepszy na świecie")
   - Generic phrases ("ten produkt jest idealny dla...")
   - Repetition of the same phrases
   - Fake urgency ("tylko teraz!", "ostatnie sztuki!")

**Additional Outputs:**
- **keywords**: List 5-8 main keywords used
- **metaTitle**: Short title for SEO (50-60 chars, include main keyword)
- **metaDescription**: Summary for search results (150-160 chars, compelling, include CTA)

**Example Style (DO NOT COPY):**
"Xiaomi Mi Band 8 to inteligentna opaska fitness, która łączy zaawansowane funkcje monitorowania zdrowia z eleganckim designem. Dzięki jasnemu wyświetlaczowi AMOLED i długiemu czasowi pracy baterii (do 16 dni) możesz śledzić swoją aktywność bez przerwy..."

Write the description now:`,
});

/**
 * Genkit flow for SEO description generation
 */
const seoFlow = ai.defineFlow(
  {
    name: 'seoDescriptionFlow',
    inputSchema: SEODescriptionInputSchema,
    outputSchema: SEODescriptionOutputSchema,
  },
  async (input) => {
    const { output } = await seoPrompt(input);
    return output!;
  }
);

/**
 * Generate SEO-optimized product description using AI
 * 
 * @param input Product information and normalized data
 * @returns Unique Polish SEO description with keywords and meta tags
 */
export async function aiGenerateSEODescription(
  input: SEODescriptionInput
): Promise<SEODescriptionOutput> {
  logger.debug('AI SEO description generation', {
    title: input.normalizedTitle,
  });
  
  try {
    const result = await seoFlow(input);
    
    logger.info('SEO description generated', {
      title: input.normalizedTitle,
      descriptionLength: result.description.length,
      keywordCount: result.keywords.length,
    });
    
    return result;
  } catch (error) {
    logger.error('AI SEO description generation failed', { error, input });
    
    // Fallback: generate basic description from title + category
    const categoryName = input.subCategorySlug || input.mainCategorySlug;
    const basicDescription = `${input.normalizedTitle} dostępny w kategorii ${categoryName}. Produkt o wysokiej jakości, idealny dla każdego użytkownika. Sprawdź szczegóły i zamów już dziś w najlepszej cenie.`;
    
    return {
      description: basicDescription,
      keywords: [
        input.normalizedTitle,
        categoryName,
        'zakup online',
      ],
      metaTitle: input.normalizedTitle.slice(0, 60),
      metaDescription: basicDescription.slice(0, 160),
    };
  }
}
