/**
 * i18n Utilities for Product and Category Content
 * 
 * Helper functions to retrieve translated content based on user's language preference
 */

import { Product, Category, Subcategory, SubSubcategory } from './types';

export type SupportedLanguage = 'pl' | 'en' | 'de';

/**
 * Get translated product name
 */
export function getProductName(product: Product, lang: SupportedLanguage = 'pl'): string {
  if (lang === 'pl' || !product.translations) {
    return product.name;
  }
  
  const translation = product.translations[lang];
  return translation?.name || product.name;
}

/**
 * Get translated product description
 */
export function getProductDescription(product: Product, lang: SupportedLanguage = 'pl'): string {
  if (lang === 'pl' || !product.translations) {
    return product.description;
  }
  
  const translation = product.translations[lang];
  return translation?.description || product.description;
}

/**
 * Get translated product long description
 */
export function getProductLongDescription(product: Product, lang: SupportedLanguage = 'pl'): string {
  if (lang === 'pl' || !product.translations) {
    return product.longDescription;
  }
  
  const translation = product.translations[lang];
  return translation?.longDescription || product.longDescription;
}

/**
 * Get translated SEO meta title
 */
export function getProductMetaTitle(product: Product, lang: SupportedLanguage = 'pl'): string | undefined {
  if (lang === 'pl' || !product.translations) {
    return product.metaTitle;
  }
  
  const translation = product.translations[lang];
  return translation?.metaTitle || product.metaTitle;
}

/**
 * Get translated SEO meta description
 */
export function getProductMetaDescription(product: Product, lang: SupportedLanguage = 'pl'): string | undefined {
  if (lang === 'pl' || !product.translations) {
    return product.metaDescription;
  }
  
  const translation = product.translations[lang];
  return translation?.metaDescription || product.metaDescription;
}

/**
 * Get translated SEO keywords
 */
export function getProductSeoKeywords(product: Product, lang: SupportedLanguage = 'pl'): string[] {
  if (lang === 'pl' || !product.translations) {
    return product.seoKeywords || [];
  }
  
  const translation = product.translations[lang];
  return translation?.seoKeywords || product.seoKeywords || [];
}

/**
 * Get translated category name
 */
export function getCategoryName(
  category: Category | Subcategory | SubSubcategory,
  lang: SupportedLanguage = 'pl'
): string {
  if (lang === 'pl' || !category.translations) {
    return category.name;
  }
  
  const translation = category.translations[lang];
  return translation?.name || category.name;
}

/**
 * Get translated category description
 */
export function getCategoryDescription(
  category: Category | Subcategory | SubSubcategory,
  lang: SupportedLanguage = 'pl'
): string | undefined {
  if (lang === 'pl' || !category.translations) {
    return category.description;
  }
  
  const translation = category.translations[lang];
  return translation?.description || category.description;
}

/**
 * Get all translations for a product (useful for JSON-LD/structured data)
 */
export function getAllProductTranslations(product: Product) {
  return {
    pl: {
      name: product.name,
      description: product.description,
      longDescription: product.longDescription,
      seoKeywords: product.seoKeywords,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
    },
    en: product.translations?.en,
    de: product.translations?.de,
  };
}

/**
 * Check if product has translation for given language
 */
export function hasProductTranslation(product: Product, lang: SupportedLanguage): boolean {
  if (lang === 'pl') return true;
  return !!product.translations?.[lang];
}

/**
 * Check if category has translation for given language
 */
export function hasCategoryTranslation(
  category: Category | Subcategory | SubSubcategory,
  lang: SupportedLanguage
): boolean {
  if (lang === 'pl') return true;
  return !!category.translations?.[lang];
}

/**
 * Get supported languages for a product
 */
export function getProductSupportedLanguages(product: Product): SupportedLanguage[] {
  const languages: SupportedLanguage[] = ['pl']; // Polish is always supported (primary)
  
  if (product.translations?.en) languages.push('en');
  if (product.translations?.de) languages.push('de');
  
  return languages;
}

/**
 * Get language-specific product URL slug
 * Format: /pl/products/... or /en/products/... or /de/products/...
 */
export function getProductUrl(productId: string, lang: SupportedLanguage = 'pl'): string {
  return `/${lang}/products/${productId}`;
}

/**
 * Get language-specific category URL slug
 */
export function getCategoryUrl(categorySlug: string, lang: SupportedLanguage = 'pl'): string {
  return `/${lang}/kategorie/${categorySlug}`;
}
