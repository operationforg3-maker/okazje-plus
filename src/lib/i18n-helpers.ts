/**
 * I18n Helper Functions
 * Centralized utilities for multi-language content selection
 */

import { LocalizedText } from './types';

export type SupportedLocale = 'pl' | 'en' | 'de';

/**
 * Get localized text with fallback chain: requested locale → Polish → English → first available
 * @param localizedText - Object with translations in different languages
 * @param locale - Requested locale
 * @returns Translated text or fallback
 */
export function getLocalizedText(
  localizedText: LocalizedText | string | undefined | null,
  locale: SupportedLocale = 'pl'
): string {
  // Handle null/undefined
  if (!localizedText) return '';
  
  // If it's already a string (legacy format), return as-is
  if (typeof localizedText === 'string') return localizedText;
  
  // Try requested locale
  if (localizedText[locale]) return localizedText[locale];
  
  // Fallback chain: pl → en → first available
  if (localizedText.pl) return localizedText.pl;
  if (localizedText.en) return localizedText.en;
  
  // Return first available translation
  const firstAvailable = Object.values(localizedText).find(v => typeof v === 'string' && v.length > 0);
  return firstAvailable || '';
}

/**
 * Get localized title for Product (handles both new and legacy formats)
 * @param product - Product with title or name field
 * @param locale - Requested locale
 * @returns Product title
 */
export function getProductTitle(product: any, locale: SupportedLocale = 'pl'): string {
  // New format: title is LocalizedText
  if (product.title && typeof product.title === 'object') {
    return getLocalizedText(product.title, locale);
  }
  
  // Legacy: title might be string
  if (typeof product.title === 'string') return product.title;
  
  // Fallback to old 'name' field
  return product.name || '';
}

/**
 * Get localized description for Product (handles both new and legacy formats)
 * @param product - Product with fullDescription or description field
 * @param locale - Requested locale
 * @param short - Whether to return short description (default: false)
 * @returns Product description
 */
export function getProductDescription(product: any, locale: SupportedLocale = 'pl', short: boolean = false): string {
  // Short description
  if (short && product.shortDescription) {
    if (typeof product.shortDescription === 'object') {
      return getLocalizedText(product.shortDescription, locale);
    }
    if (typeof product.shortDescription === 'string') return product.shortDescription;
  }
  
  // Full description (new format)
  if (product.fullDescription && typeof product.fullDescription === 'object') {
    return getLocalizedText(product.fullDescription, locale);
  }
  
  // Legacy: fullDescription as string
  if (typeof product.fullDescription === 'string') return product.fullDescription;
  
  // Fallback to old 'description' or 'longDescription' fields
  if (typeof product.description === 'object') {
    return getLocalizedText(product.description, locale);
  }
  
  return product.description || product.longDescription || '';
}

/**
 * Get localized title for Deal (handles both new and legacy formats)
 * @param deal - Deal with localizedTitle or title field
 * @param locale - Requested locale
 * @returns Deal title
 */
export function getDealTitle(deal: any, locale: SupportedLocale = 'pl'): string {
  // New format: localizedTitle is LocalizedText
  if (deal.localizedTitle && typeof deal.localizedTitle === 'object') {
    return getLocalizedText(deal.localizedTitle, locale);
  }
  
  // Check if title is LocalizedText (some deals might use 'title' as localized)
  if (deal.title && typeof deal.title === 'object') {
    return getLocalizedText(deal.title, locale);
  }
  
  // Legacy: title as string
  return deal.title || '';
}

/**
 * Get localized description for Deal (handles both new and legacy formats)
 * @param deal - Deal with localizedDescription or description field
 * @param locale - Requested locale
 * @returns Deal description
 */
export function getDealDescription(deal: any, locale: SupportedLocale = 'pl'): string {
  // New format: localizedDescription is LocalizedText
  if (deal.localizedDescription && typeof deal.localizedDescription === 'object') {
    return getLocalizedText(deal.localizedDescription, locale);
  }
  
  // Check if description is LocalizedText
  if (deal.description && typeof deal.description === 'object') {
    return getLocalizedText(deal.description, locale);
  }
  
  // Legacy: description as string
  return deal.description || '';
}

/**
 * Get localized category name with fallback to slug
 * @param categoryName - Category name (might be LocalizedText or string)
 * @param slug - Category slug (fallback)
 * @param locale - Requested locale
 * @returns Category name
 */
export function getCategoryName(
  categoryName: LocalizedText | string | undefined,
  slug: string,
  locale: SupportedLocale = 'pl'
): string {
  if (!categoryName) return slug;
  
  if (typeof categoryName === 'object') {
    return getLocalizedText(categoryName, locale) || slug;
  }
  
  return categoryName;
}

/**
 * Create LocalizedText object from a single string (sets all locales to same value)
 * Useful for imports when we only have one language
 * @param text - Source text
 * @param sourceLocale - Which locale is the source (default: 'pl')
 * @returns LocalizedText object
 */
export function createLocalizedText(text: string, sourceLocale: SupportedLocale = 'pl'): LocalizedText {
  const localized: LocalizedText = {
    pl: '',
    en: '',
  };
  
  // Set source locale
  localized[sourceLocale] = text;
  
  // For now, use same text for all locales (will be translated later by AI)
  // This ensures we don't have empty strings breaking the UI
  if (sourceLocale !== 'pl') localized.pl = text;
  if (sourceLocale !== 'en') localized.en = text;
  
  return localized;
}

/**
 * Merge translations into existing LocalizedText
 * @param existing - Existing LocalizedText (or string for legacy)
 * @param translations - New translations to merge
 * @returns Updated LocalizedText
 */
export function mergeLocalizedText(
  existing: LocalizedText | string | undefined,
  translations: Partial<LocalizedText>
): LocalizedText {
  // If existing is string, convert to LocalizedText first
  if (typeof existing === 'string') {
    existing = createLocalizedText(existing, 'pl');
  }
  
  // If nothing exists, create from translations
  if (!existing) {
    return {
      pl: translations.pl || translations.en || '',
      en: translations.en || translations.pl || '',
      ...translations,
    };
  }
  
  // Merge new translations
  return {
    ...existing,
    ...translations,
  };
}
