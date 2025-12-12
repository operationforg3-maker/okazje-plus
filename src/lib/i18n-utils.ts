/**
 * i18n Utilities for LocalizedText handling
 * 
 * Provides helper functions for working with multi-language content
 * with intelligent fallback chain: requested language -> English -> Polish
 */

import type { LocalizedText, SmartPrice } from './types';

export type { LocalizedText, SmartPrice };
export type SupportedLanguage = 'pl' | 'en' | 'de' | 'fr' | 'es';

/**
 * Get localized text with fallback chain
 * Priority: requested language -> English -> Polish
 * 
 * @param text LocalizedText object
 * @param lang Requested language
 * @returns Localized string
 */
export function getLocalizedText(
  text: LocalizedText | string | undefined,
  lang: SupportedLanguage = 'pl'
): string {
  // Handle legacy string format
  if (typeof text === 'string') {
    return text;
  }
  
  // Handle undefined/null
  if (!text) {
    return '';
  }
  
  // Try requested language
  if (text[lang]) {
    return text[lang]!;
  }
  
  // Fallback to English
  if (text.en) {
    return text.en;
  }
  
  // Final fallback to Polish
  return text.pl || '';
}

/**
 * Create LocalizedText from a single string (Polish as base)
 * 
 * @param text Source text (assumed to be Polish)
 * @returns LocalizedText object
 */
export function createLocalizedText(text: string): LocalizedText {
  return {
    pl: text,
    en: text, // Initially same as PL, will be translated by AI
  };
}

/**
 * Check if LocalizedText has translation for specific language
 * 
 * @param text LocalizedText object
 * @param lang Language to check
 * @returns True if translation exists and is non-empty
 */
export function hasTranslation(
  text: LocalizedText | undefined,
  lang: SupportedLanguage
): boolean {
  if (!text) return false;
  return !!text[lang] && text[lang]!.trim().length > 0;
}

/**
 * Get available languages for LocalizedText
 * 
 * @param text LocalizedText object
 * @returns Array of available language codes
 */
export function getAvailableLanguages(text: LocalizedText | undefined): SupportedLanguage[] {
  if (!text) return [];
  
  const languages: SupportedLanguage[] = [];
  const supportedLangs: SupportedLanguage[] = ['pl', 'en', 'de', 'fr', 'es'];
  
  for (const lang of supportedLangs) {
    if (hasTranslation(text, lang)) {
      languages.push(lang);
    }
  }
  
  return languages;
}

/**
 * Merge LocalizedText objects (useful for updates)
 * Second argument takes precedence
 * 
 * @param base Base LocalizedText
 * @param update Update LocalizedText (overrides base)
 * @returns Merged LocalizedText
 */
export function mergeLocalizedText(
  base: LocalizedText,
  update: Partial<LocalizedText>
): LocalizedText {
  return {
    ...base,
    ...update,
  };
}

/**
 * Convert legacy Product fields to LocalizedText
 * Used for backward compatibility during migration
 * 
 * @param name Legacy name field
 * @param description Legacy description field
 * @returns LocalizedText object
 */
export function legacyToLocalizedText(
  name: string,
  description?: string
): { title: LocalizedText; shortDescription: LocalizedText } {
  return {
    title: createLocalizedText(name),
    shortDescription: createLocalizedText(description || name),
  };
}

/**
 * Get language label for UI display
 */
export function getLanguageLabel(lang: SupportedLanguage): string {
  const labels: Record<SupportedLanguage, string> = {
    pl: 'Polski',
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
  };
  
  return labels[lang];
}

/**
 * Get language flag emoji
 */
export function getLanguageFlag(lang: SupportedLanguage): string {
  const flags: Record<SupportedLanguage, string> = {
    pl: '🇵🇱',
    en: '🇬🇧',
    de: '🇩🇪',
    fr: '🇫🇷',
    es: '🇪🇸',
  };
  
  return flags[lang];
}

/**
 * Validate LocalizedText has required languages (pl, en)
 * 
 * @param text LocalizedText to validate
 * @returns True if valid
 */
export function isValidLocalizedText(text: LocalizedText | undefined): boolean {
  if (!text) return false;
  return hasTranslation(text, 'pl') && hasTranslation(text, 'en');
}

// ============================================
// SmartPrice Utilities
// ============================================

/**
 * Create SmartPrice from simple price number (legacy compatibility)
 * 
 * @param amount Price amount
 * @param currency Currency code (default: PLN)
 * @param originalPrice Optional original price for discount calculation
 * @returns SmartPrice object
 */
export function createSmartPrice(
  amount: number,
  currency: string = 'PLN',
  originalPrice?: number
): SmartPrice {
  const shippingCost = 0; // Default to free shipping
  const totalPrice = amount + shippingCost;
  const discountPercent = originalPrice && originalPrice > amount
    ? Math.round(((originalPrice - amount) / originalPrice) * 100)
    : undefined;
  
  return {
    amount,
    currency,
    shippingCost,
    totalPrice,
    freeShipping: shippingCost === 0,
    originalPrice,
    discountPercent,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get price amount from SmartPrice or legacy number
 * 
 * @param price SmartPrice object or legacy number
 * @returns Price amount as number
 */
export function getPriceAmount(price: SmartPrice | number): number {
  return typeof price === 'number' ? price : price.amount;
}

/**
 * Get total price (including shipping) from SmartPrice or legacy number
 * 
 * @param price SmartPrice object or legacy number
 * @returns Total price as number
 */
export function getTotalPrice(price: SmartPrice | number): number {
  return typeof price === 'number' ? price : price.totalPrice;
}

/**
 * Get discount percentage from SmartPrice or calculate from legacy prices
 * 
 * @param price SmartPrice object or current price
 * @param originalPrice Optional original price (for legacy mode)
 * @returns Discount percentage or undefined
 */
export function getDiscountPercent(
  price: SmartPrice | number,
  originalPrice?: number
): number | undefined {
  if (typeof price === 'number') {
    if (originalPrice && originalPrice > price) {
      return Math.round(((originalPrice - price) / originalPrice) * 100);
    }
    return undefined;
  }
  
  return price.discountPercent;
}

/**
 * Format price for display with currency
 * 
 * @param price SmartPrice object or number
 * @param currency Currency code (optional, used only for legacy number)
 * @returns Formatted price string (e.g., "99,99 PLN")
 */
export function formatPrice(price: SmartPrice | number, currency: string = 'PLN'): string {
  const amount = getPriceAmount(price);
  const currencyCode = typeof price === 'number' ? currency : price.currency;
  
  if (typeof amount !== 'number' || isNaN(amount)) {
    return `— ${currencyCode}`;
  }
  return `${amount.toFixed(2).replace('.', ',')} ${currencyCode}`;
}

/**
 * Check if shipping is free
 * 
 * @param price SmartPrice object or number (number assumed free shipping)
 * @returns True if shipping is free
 */
export function isFreeShipping(price: SmartPrice | number): boolean {
  if (typeof price === 'number') return true; // Legacy assumes free shipping
  return price.freeShipping || price.shippingCost === 0;
}

/**
 * Get localized field from Deal or Product object
 * Handles both new LocalizedText fields and legacy string fields
 * 
 * @param obj Deal or Product object
 * @param field Field name (e.g., 'title', 'description')
 * @param lang Requested language
 * @returns Localized string with fallback to legacy field
 */
export function getLocalizedField<T extends Record<string, any>>(
  obj: T | undefined,
  field: string,
  lang: SupportedLanguage = 'pl'
): string {
  if (!obj) return '';
  
  // Try new localized field first (e.g., localizedTitle, localizedDescription)
  const localizedFieldName = `localized${field.charAt(0).toUpperCase()}${field.slice(1)}`;
  if (obj[localizedFieldName]) {
    return getLocalizedText(obj[localizedFieldName] as LocalizedText, lang);
  }
  
  // Fallback to legacy string field
  if (typeof obj[field] === 'string') {
    return obj[field] as string;
  }
  
  return '';
}

/**
 * Get localized category name with fallback
 * 
 * @param category Category object
 * @param lang Requested language
 * @returns Localized category name
 */
export function getLocalizedCategoryName(
  category: { name: string; translations?: Record<string, { name: string; description?: string }> } | undefined,
  lang: SupportedLanguage = 'pl'
): string {
  if (!category) return '';
  
  // Try translations first
  if (category.translations && category.translations[lang]) {
    return category.translations[lang].name;
  }
  
  // Fallback to base name (assumed Polish)
  return category.name;
}

