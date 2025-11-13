/**
 * AI Title Normalization Flow (Stub for M1)
 * 
 * Normalizes AliExpress product titles to Polish language and format.
 * Removes excessive capitalization, special characters, and vendor spam.
 * 
 * TODO M2:
 * - Implement actual Genkit AI flow with Gemini
 * - Add translation from English/Chinese to Polish
 * - Remove spammy keywords and emojis
 * - Standardize product names
 * - Maintain key product specifications
 */

import { logger } from '@/lib/logging';

/**
 * Input for title normalization
 */
export interface TitleNormalizationInput {
  title: string;
  language?: string; // Original language code
}

/**
 * Output from title normalization
 */
export interface TitleNormalizationOutput {
  normalizedTitle: string;
  translated: boolean;
  changes: string[]; // List of changes made
}

/**
 * Normalize and translate product title to Polish
 * 
 * @param input Original title and metadata
 * @returns Normalized Polish title
 * 
 * TODO M2: Implement actual AI flow
 */
export async function aiNormalizeTitlePL(
  input: TitleNormalizationInput
): Promise<TitleNormalizationOutput> {
  logger.debug('AI title normalization (stub)', { title: input.title });
  
  // TODO M2: Implement Genkit flow
  // - Detect language
  // - Translate to Polish if needed
  // - Remove excessive capitalization
  // - Remove spam keywords
  // - Standardize format
  // - Keep product specs
  
  // For now, just do basic cleanup
  const changes: string[] = [];
  let normalizedTitle = input.title;
  
  // Remove excessive spaces
  if (/\s{2,}/.test(normalizedTitle)) {
    normalizedTitle = normalizedTitle.replace(/\s+/g, ' ');
    changes.push('Removed extra spaces');
  }
  
  // Trim
  normalizedTitle = normalizedTitle.trim();
  
  // Remove common spam keywords (basic)
  const spamKeywords = ['HOT SALE', 'FREE SHIPPING', 'DISCOUNT'];
  spamKeywords.forEach(keyword => {
    if (normalizedTitle.includes(keyword)) {
      normalizedTitle = normalizedTitle.replace(keyword, '');
      changes.push(`Removed spam keyword: ${keyword}`);
    }
  });
  
  // Clean up again after removals
  normalizedTitle = normalizedTitle.replace(/\s+/g, ' ').trim();
  
  return {
    normalizedTitle,
    translated: false, // Stub doesn't translate
    changes: changes.length > 0 ? changes : ['No changes needed (stub)']
  };
}
