'use server';

/**
 * AI Title Normalization Flow
 * 
 * Normalizes AliExpress product titles to Polish language and format using Genkit AI.
 * Removes excessive capitalization, special characters, and vendor spam.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { logger } from '@/lib/logging';

/**
 * Input schema for title normalization
 */
const TitleNormalizationInputSchema = z.object({
  title: z.string().describe('Original product title (may be in English/Chinese)'),
  language: z.string().optional().describe('Original language code (en, zh, pl, etc.)'),
});

export type TitleNormalizationInput = z.infer<typeof TitleNormalizationInputSchema>;

/**
 * Output schema from title normalization
 */
const TitleNormalizationOutputSchema = z.object({
  normalizedTitle: z
    .string()
    .describe('Normalized Polish product title (clear, professional, no spam)'),
  translated: z
    .boolean()
    .describe('Whether translation from foreign language was performed'),
  changes: z
    .array(z.string())
    .describe('List of changes made (e.g., "Removed excessive caps", "Translated from English")'),
});

export type TitleNormalizationOutput = z.infer<typeof TitleNormalizationOutputSchema>;

/**
 * AI prompt for title normalization
 */
const normalizationPrompt = ai.definePrompt({
  name: 'titleNormalizationPrompt',
  input: { schema: TitleNormalizationInputSchema },
  output: { schema: TitleNormalizationOutputSchema },
  prompt: `You are an expert e-commerce content editor for a Polish marketplace.

Your task: Normalize the product title to clean, professional Polish.

**Original Title:** {{{title}}}
{{#if language}}**Detected Language:** {{{language}}}{{/if}}

**Normalization Rules:**

1. **Translation**: If not in Polish, translate to natural Polish
2. **Remove Spam**: Remove excessive caps, emojis, symbols (!!!, 🔥, ★★★)
3. **Clean Format**: 
   - Title case (first letter uppercase, rest lowercase unless proper noun)
   - No excessive spaces
   - Remove vendor-specific jargon ("Hot Sale", "Free Shipping", "2024 NEW")
4. **Preserve Key Info**:
   - Product name and model
   - Key specifications (size, color, capacity if part of name)
   - Brand name (if present)
5. **Length**: Keep title concise (50-80 characters ideal)
6. **Polish Grammar**: Use proper Polish grammar and spelling

**Examples:**
- "XIAOMI MI BAND 8 Smart Watch FREE SHIPPING!!!" → "Xiaomi Mi Band 8 – Smartwatch"
- "2024 NEW iPhone Case Silicon TPU 🔥" → "Etui silikonowe TPU do iPhone"
- "Gaming Mouse RGB LED 6400DPI Optical" → "Mysz gamingowa optyczna RGB LED 6400 DPI"

Provide the normalized title and list all changes made.`,
});

/**
 * Genkit flow for title normalization
 */
const normalizationFlow = ai.defineFlow(
  {
    name: 'titleNormalizationFlow',
    inputSchema: TitleNormalizationInputSchema,
    outputSchema: TitleNormalizationOutputSchema,
  },
  async (input) => {
    const { output } = await normalizationPrompt(input);
    return output!;
  }
);

/**
 * Normalize and translate product title to Polish
 * 
 * @param input Original title and metadata
 * @returns Normalized Polish title
 */
export async function aiNormalizeTitlePL(
  input: TitleNormalizationInput
): Promise<TitleNormalizationOutput> {
  logger.debug('AI title normalization', { title: input.title });
  
  try {
    const result = await normalizationFlow(input);
    
    logger.info('Title normalization completed', {
      original: input.title,
      normalized: result.normalizedTitle,
      translated: result.translated,
    });
    
    return result;
  } catch (error) {
    logger.error('AI title normalization failed', { error, input });
    
    // Fallback: basic cleanup without AI
    const basicClean = input.title
      .replace(/\s+/g, ' ')
      .replace(/[!🔥★]+/g, '')
      .trim()
      .slice(0, 100);
    
    return {
      normalizedTitle: basicClean,
      translated: false,
      changes: ['AI failed - basic cleanup applied'],
    };
  }
}
