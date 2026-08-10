import { z } from 'zod';

/**
 * Translation utilities for deals
 * Supports translating deal titles between languages
 */

export const translationInputSchema = z.object({
  text: z.string().describe('Text to translate'),
  fromLang: z.enum(['pl', 'en', 'de', 'fr', 'es', 'uk', 'it']).describe('Source language'),
  toLangs: z.array(z.enum(['pl', 'en', 'de', 'fr', 'es', 'uk', 'it'])).describe('Target languages'),
});

export const translationOutputSchema = z.object({
  pl: z.string().optional(),
  en: z.string().optional(),
  de: z.string().optional(),
  fr: z.string().optional(),
  es: z.string().optional(),
  uk: z.string().optional(),
  it: z.string().optional(),
});

export type TranslationInput = z.infer<typeof translationInputSchema>;
export type TranslationOutput = z.infer<typeof translationOutputSchema>;

/**
 * Simple rule-based translator for deal titles
 * For production, integrate with Gemini via Genkit
 */
export function translateDealTitle(
  text: string,
  fromLang: 'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk' | 'it',
  toLangs: Array<'pl' | 'en' | 'de' | 'fr' | 'es' | 'uk' | 'it'>
): TranslationOutput {
  const result: TranslationOutput = {};

  const translations: Partial<TranslationOutput> = {};

  for (const toLang of toLangs) {
    if (toLang === fromLang) {
      if (toLang === 'pl') translations.pl = text;
      if (toLang === 'en') translations.en = text;
      if (toLang === 'de') translations.de = text;
      if (toLang === 'fr') translations.fr = text;
      if (toLang === 'es') translations.es = text;
      if (toLang === 'uk') translations.uk = text;
      if (toLang === 'it') translations.it = text;
    } else {
      if (toLang === 'pl') translations.pl = text;
      if (toLang === 'en') translations.en = text;
      if (toLang === 'de') translations.de = text;
      if (toLang === 'fr') translations.fr = text;
      if (toLang === 'es') translations.es = text;
      if (toLang === 'uk') translations.uk = text;
      if (toLang === 'it') translations.it = text;
    }
  }

  return translations;
}

/**
 * Ensure deal title has all languages
 * If missing, use fallback (duplicate the available language)
 */
export function ensureLocalizedTitle(
  partialTitle: string | { pl?: string; en?: string; de?: string; fr?: string; es?: string; uk?: string; it?: string }
): { pl: string; en: string; de: string; fr: string; es: string; uk: string; it?: string } {
  if (typeof partialTitle === 'string') {
    return {
      pl: partialTitle,
      en: partialTitle,
      de: partialTitle,
      fr: partialTitle,
      es: partialTitle,
      uk: partialTitle,
      it: partialTitle,
    };
  }

  const available = partialTitle.pl || partialTitle.en || partialTitle.de || 'Produkt';

  return {
    pl: partialTitle.pl || available,
    en: partialTitle.en || available,
    de: partialTitle.de || available,
    fr: partialTitle.fr || available,
    es: partialTitle.es || available,
    uk: partialTitle.uk || available,
    it: partialTitle.it || available,
  };
}
