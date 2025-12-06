/**
 * Enhanced Translation Service
 * - Integrates with Vertex AI for high-quality translations
 * - Supports batch translation
 * - Handles context-aware product translations
 * - Fallback to simple dictionary translations
 */

import { generateText } from './vertex';
import { logger } from './logger';
import type { LocalizedText } from './types';

export type SupportedLanguage = 'pl' | 'en' | 'de' | 'fr' | 'es';

export interface TranslationInput {
  text: string;
  from: SupportedLanguage;
  to: SupportedLanguage;
  context?: 'product_title' | 'product_description' | 'deal_title' | 'deal_description' | 'category' | 'general';
  category?: string;
  subcategory?: string;
}

export interface TranslationResult {
  translatedText: string;
  confidence: number;
  method: 'ai' | 'dictionary' | 'passthrough';
  warnings?: string[];
}

// Dictionary for common e-commerce terms (fallback)
const TRANSLATION_DICTIONARY: Record<SupportedLanguage, Record<string, string>> = {
  pl: {}, // Not needed, PL is base language
  en: {
    'smartfon': 'smartphone',
    'słuchawki': 'headphones',
    'ładowarka': 'charger',
    'klawiatura': 'keyboard',
    'mysz': 'mouse',
    'monitor': 'monitor',
    'laptop': 'laptop',
    'tablet': 'tablet',
    'zegarek': 'watch',
    'aparat': 'camera',
    'darmowa wysyłka': 'free shipping',
    'szybka dostawa': 'fast delivery',
    'gwarancja': 'warranty',
    'nowy': 'new',
    'używany': 'used',
  },
  de: {
    'smartfon': 'Smartphone',
    'słuchawki': 'Kopfhörer',
    'ładowarka': 'Ladegerät',
    'klawiatura': 'Tastatur',
    'mysz': 'Maus',
    'monitor': 'Monitor',
    'laptop': 'Laptop',
    'tablet': 'Tablet',
    'zegarek': 'Uhr',
    'aparat': 'Kamera',
    'darmowa wysyłka': 'kostenloser Versand',
    'szybka dostawa': 'schnelle Lieferung',
    'gwarancja': 'Garantie',
    'nowy': 'neu',
    'używany': 'gebraucht',
  },
  fr: {},
  es: {},
};

/**
 * Translate text using AI (Vertex AI)
 */
async function translateWithAI(input: TranslationInput): Promise<TranslationResult> {
  const { text, from, to, context = 'general', category, subcategory } = input;
  
  // Build context-aware prompt
  const contextInfo = context === 'product_title' || context === 'product_description'
    ? `\nProduct Category: ${category || 'general'}\nSubcategory: ${subcategory || 'N/A'}`
    : '';
  
  const prompt = `Translate the following ${context.replace('_', ' ')} from ${from.toUpperCase()} to ${to.toUpperCase()}.

Context: ${context}${contextInfo}

Source text (${from.toUpperCase()}):
${text}

IMPORTANT RULES:
1. Maintain the original meaning and tone
2. Keep brand names, model numbers, and technical specifications unchanged
3. For product titles: Keep it concise and SEO-friendly
4. For descriptions: Be natural and compelling
5. Preserve special characters, emojis, and formatting
6. ${to === 'de' ? 'Use formal German (Sie)' : to === 'en' ? 'Use international English' : 'Use standard Polish'}

Translated text (${to.toUpperCase()}):`;

  try {
    const translated = await generateText(prompt, {
      temperature: 0.3, // Lower temperature for more consistent translations
      maxTokens: 1024,
      model: 'gemini-1.5-flash',
    });
    
    const cleanedText = translated.trim();
    
    // Calculate confidence based on text similarity and length
    const confidence = calculateTranslationConfidence(text, cleanedText);
    
    logger.info('AI translation completed', {
      from,
      to,
      context,
      confidence,
      originalLength: text.length,
      translatedLength: cleanedText.length,
    });
    
    return {
      translatedText: cleanedText,
      confidence,
      method: 'ai',
    };
  } catch (error) {
    logger.error('AI translation failed', { error, input });
    throw error;
  }
}

/**
 * Simple dictionary-based translation (fallback)
 */
function translateWithDictionary(
  text: string,
  from: SupportedLanguage,
  to: SupportedLanguage
): TranslationResult {
  if (from === 'pl' && TRANSLATION_DICTIONARY[to]) {
    const dict = TRANSLATION_DICTIONARY[to];
    let result = text;
    
    // Replace whole words only (case-insensitive)
    for (const [plWord, translatedWord] of Object.entries(dict)) {
      const regex = new RegExp(`\\b${plWord}\\b`, 'gi');
      result = result.replace(regex, translatedWord);
    }
    
    return {
      translatedText: result,
      confidence: 60, // Dictionary translations have medium confidence
      method: 'dictionary',
      warnings: result === text ? ['No dictionary matches found'] : undefined,
    };
  }
  
  // No dictionary available
  return {
    translatedText: text,
    confidence: 30,
    method: 'passthrough',
    warnings: ['No translation available, using original text'],
  };
}

/**
 * Main translation function with fallback chain
 */
export async function translateText(input: TranslationInput): Promise<TranslationResult> {
  const { text, from, to } = input;
  
  // No translation needed
  if (from === to) {
    return {
      translatedText: text,
      confidence: 100,
      method: 'passthrough',
    };
  }
  
  // Empty text
  if (!text || text.trim().length === 0) {
    return {
      translatedText: '',
      confidence: 100,
      method: 'passthrough',
    };
  }
  
  try {
    // Try AI translation first
    return await translateWithAI(input);
  } catch (error) {
    logger.warn('AI translation failed, falling back to dictionary', { error });
    
    // Fallback to dictionary
    return translateWithDictionary(text, from, to);
  }
}

/**
 * Batch translate multiple texts
 */
export async function translateBatch(
  texts: string[],
  from: SupportedLanguage,
  to: SupportedLanguage,
  context?: TranslationInput['context']
): Promise<TranslationResult[]> {
  const results: TranslationResult[] = [];
  
  for (const text of texts) {
    const result = await translateText({ text, from, to, context });
    results.push(result);
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

/**
 * Translate to LocalizedText object (all supported languages)
 */
export async function translateToAllLanguages(
  text: string,
  sourceLanguage: SupportedLanguage = 'pl',
  context?: TranslationInput['context']
): Promise<LocalizedText> {
  const result: Partial<LocalizedText> = {
    [sourceLanguage]: text,
  };
  
  const targetLanguages: SupportedLanguage[] = ['pl', 'en', 'de'];
  
  for (const targetLang of targetLanguages) {
    if (targetLang !== sourceLanguage) {
      try {
        const translation = await translateText({
          text,
          from: sourceLanguage,
          to: targetLang,
          context,
        });
        
        result[targetLang] = translation.translatedText;
        
        // Add delay
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        logger.error(`Failed to translate to ${targetLang}`, { error, text });
        result[targetLang] = text; // Fallback to source text
      }
    }
  }
  
  return result as LocalizedText;
}

/**
 * Calculate translation confidence based on various factors
 */
function calculateTranslationConfidence(original: string, translated: string): number {
  let confidence = 80; // Base confidence for AI translations
  
  // Check if translation is too similar (might be passthrough)
  if (original === translated) {
    confidence = 30;
  }
  
  // Check length ratio (translations should be within 50%-200% of original)
  const lengthRatio = translated.length / original.length;
  if (lengthRatio < 0.3 || lengthRatio > 3.0) {
    confidence -= 20;
  }
  
  // Check if contains obvious errors
  if (translated.includes('[') && translated.includes(']')) {
    confidence -= 10; // Might contain placeholder text
  }
  
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Update LocalizedText with new translation
 */
export function updateLocalizedText(
  current: Partial<LocalizedText>,
  language: SupportedLanguage,
  text: string
): LocalizedText {
  return {
    pl: current.pl || text,
    en: current.en || text,
    de: current.de,
    fr: current.fr,
    es: current.es,
    [language]: text,
  };
}
