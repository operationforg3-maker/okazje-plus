import { z } from 'zod';

/**
 * Translation utilities for deals
 * Supports translating deal titles between languages
 */

export const translationInputSchema = z.object({
  text: z.string().describe('Text to translate'),
  fromLang: z.enum(['pl', 'en', 'de', 'fr', 'es', 'uk']).describe('Source language'),
  toLangs: z.array(z.enum(['pl', 'en', 'de', 'fr', 'es', 'uk'])).describe('Target languages'),
});

export const translationOutputSchema = z.object({
  pl: z.string().optional(),
  en: z.string().optional(),
  de: z.string().optional(),
  fr: z.string().optional(),
  es: z.string().optional(),
  uk: z.string().optional(),
});

export type TranslationInput = z.infer<typeof translationInputSchema>;
export type TranslationOutput = z.infer<typeof translationOutputSchema>;

/**
 * Simple rule-based translator for deal titles
 * For production, integrate with Gemini via Genkit
 */
export function translateDealTitle(
  text: string,
  fromLang: 'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk',
  toLangs: Array<'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk'>
): TranslationOutput {
  const result: TranslationOutput = {};

  // For now: If source is EN and we need PL, try basic heuristics
  // In production: Call Gemini
  const translations: Partial<TranslationOutput> = {};

  for (const toLang of toLangs) {
    if (toLang === fromLang) {
      // Same language, no translation needed
      if (toLang === 'pl') translations.pl = text;
      if (toLang === 'en') translations.en = text;
      if (toLang === 'de') translations.de = text;
        if (toLang === 'fr') translations.fr = text;
        if (toLang === 'es') translations.es = text;
        if (toLang === 'uk') translations.uk = text;
    } else {
      // Different language — use placeholder for now
      // In production, call Gemini for actual translation
      if (toLang === 'pl') translations.pl = text; // TODO: Translate to Polish
      if (toLang === 'en') translations.en = text; // TODO: Translate to English
      if (toLang === 'de') translations.de = text; // TODO: Translate to German
        if (toLang === 'fr') translations.fr = text; // TODO: Translate to French
        if (toLang === 'es') translations.es = text; // TODO: Translate to Spanish
        if (toLang === 'uk') translations.uk = text; // TODO: Translate to Ukrainian
    }
  }

  return translations;
}

/**
 * Ensure deal title has all three languages
 * If missing, use fallback (duplicate the available language)
 */
export function ensureLocalizedTitle(
  partialTitle: string | { pl?: string; en?: string; de?: string; fr?: string; es?: string; uk?: string }
): { pl: string; en: string; de: string; fr: string; es: string; uk: string } {
  if (typeof partialTitle === 'string') {
    // Plain string — use as fallback for all languages
    return {
      pl: partialTitle,
      en: partialTitle,
      de: partialTitle,
      fr: partialTitle,
      es: partialTitle,
      uk: partialTitle,
    };
  }

  // Partial LocalizedText — fill gaps with available language or fallback
  const available = partialTitle.pl || partialTitle.en || partialTitle.de || 'Produkt';

  return {
    pl: partialTitle.pl || available,
    en: partialTitle.en || available,
    de: partialTitle.de || available,
    fr: partialTitle.fr || available,
    es: partialTitle.es || available,
    uk: partialTitle.uk || available,
  };
}
