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
  prompt: `Jesteś ekspertem od treści e-commerce dla polskiego marketplace.

Twoje zadanie: Znormalizuj tytuł produktu do czystego, przyjaznego języka polskiego.

**Oryginalny tytuł:** {{{title}}}
{{#if language}}**Wykryty język:** {{{language}}}{{/if}}

**Zasady normalizacji:**

1. **Tłumaczenie**: Jeśli nie po polsku, przetłumacz na naturalny, przyjazny polski
   - Używaj konwersacyjnego stylu (np. "smartwatch" zamiast "inteligentny zegarek")
   - DOKŁADNOŚĆ I PRECYZJA - zachowaj dokładne znaczenie i wszystkie specyfikacje
2. **Usuń spam**: Usuń wielkie litery, emoji, symbole (!!!, 🔥, ★★★)
3. **Czysty format**: 
   - Pierwsza litera wielka, reszta małe (chyba że nazwa własna lub model)
   - Brak nadmiarowych spacji
   - Usuń vendor-specific jargon ("Hot Sale", "Free Shipping", "2024 NEW")
4. **Zachowaj kluczowe info**:
   - Nazwa produktu i model
   - Kluczowe specyfikacje (rozmiar, kolor, pojemność jeśli część nazwy)
   - Nazwa marki (jeśli obecna)
5. **Długość**: Tytuł zwięzły (50-80 znaków idealnie)
6. **Przyjazny język polski**: Naturalna, przyjazna polszczyzna bez literalnych tłumaczeń

**Przykłady:**
- "XIAOMI MI BAND 8 Smart Watch FREE SHIPPING!!!" → "Smartwatch Xiaomi Mi Band 8"
- "2024 NEW iPhone Case Silicon TPU 🔥" → "Silikonowe etui do iPhone z TPU"
- "Gaming Mouse RGB LED 6400DPI Optical" → "Mysz gamingowa z podświetleniem RGB, 6400 DPI"

Podaj znormalizowany tytuł i wypisz wszystkie zmiany.`,
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
