/**
 * Multilingual Content Utilities
 * - Get localized text with fallback chain
 * - Handle legacy string content
 * - Support language switching
 */

'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import type { LocalizedText } from './types';
import { getLocalizedText as getLocalizedTextUtil, type SupportedLanguage } from './i18n-utils';

/**
 * Hook to get content in current language with fallback
 */
export function useLocalizedText(
  text: LocalizedText | string | undefined,
  fallback: string = ''
): string {
  const locale = useLocale() as SupportedLanguage;
  
  if (!text) return fallback;
  if (typeof text === 'string') return text;
  
  return getLocalizedTextUtil(text, locale) || fallback;
}

/**
 * Get localized text (non-hook version for use in components)
 */
export function getDisplayText(
  text: LocalizedText | string | undefined,
  language: SupportedLanguage = 'pl',
  fallback: string = ''
): string {
  if (!text) return fallback;
  if (typeof text === 'string') return text;
  
  return getLocalizedTextUtil(text, language) || fallback;
}

/**
 * Check if content has translation for specific language
 */
export function hasLanguage(
  text: LocalizedText | string | undefined,
  language: SupportedLanguage
): boolean {
  if (!text) return false;
  if (typeof text === 'string') return true; // Legacy strings available in all languages

  const entry = text[language];
  return !!entry && entry.trim().length > 0;
}

/**
 * Get available languages for content
 */
export function getAvailableLanguages(
  text: LocalizedText | string | undefined
): SupportedLanguage[] {
  if (!text) return [];
  if (typeof text === 'string') return ['pl', 'en', 'de', 'fr', 'es', 'uk']; // Legacy strings available in all
  
  const languages: SupportedLanguage[] = [];
  const supportedLangs: SupportedLanguage[] = ['pl', 'en', 'de', 'fr', 'es', 'uk'];
  
  for (const lang of supportedLangs) {
    if (hasLanguage(text, lang)) {
      languages.push(lang);
    }
  }
  
  return languages;
}

/**
 * Create LocalizedText from a single string (utility for migration)
 */
export function createLocalizedText(
  text: string,
  language: SupportedLanguage = 'pl'
): LocalizedText {
  return {
    pl: language === 'pl' ? text : '',
    en: language === 'en' ? text : '',
    de: language === 'de' ? text : '',
    fr: language === 'fr' ? text : '',
    es: language === 'es' ? text : '',
    uk: language === 'uk' ? text : '',
  };
}

/**
 * Check if LocalizedText is complete (has all required languages)
 */
export function isTranslationComplete(
  text: LocalizedText | undefined,
  requiredLanguages: SupportedLanguage[] = ['pl', 'en']
): boolean {
  if (!text) return false;
  
  return requiredLanguages.every(lang => hasLanguage(text, lang));
}

/**
 * Get missing languages for a LocalizedText
 */
export function getMissingLanguages(
  text: LocalizedText | undefined,
  requiredLanguages: SupportedLanguage[] = ['pl', 'en', 'de']
): SupportedLanguage[] {
  if (!text) return requiredLanguages;
  
  return requiredLanguages.filter(lang => !hasLanguage(text, lang));
}

/**
 * Format language name for display
 */
export function getLanguageName(language: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    pl: 'Polski',
    en: 'English',
    de: 'Deutsch',
    fr: 'Français',
    es: 'Español',
    uk: 'Українська',
    it: 'Italiano',
  };
  return names[language] || language.toUpperCase();
}

/**
 * Get language flag emoji
 */
export function getLanguageFlag(language: SupportedLanguage): string {
  const flags: Record<SupportedLanguage, string> = {
    pl: '🇵🇱',
    en: '🇬🇧',
    de: '🇩🇪',
    fr: '🇫🇷',
    es: '🇪🇸',
    uk: '🇺🇦',
    it: '🇮🇹',
  };
  return flags[language] || '🌐';
}

/**
 * Hook to detect content language (for SEO and analytics)
 */
export function useContentLanguage(): SupportedLanguage {
  const locale = useLocale();
  const [contentLang, setContentLang] = useState<SupportedLanguage>('pl');
  
  useEffect(() => {
    // Map Next.js locale to supported language
    const lang = locale as SupportedLanguage;
    if (['pl', 'en', 'de', 'fr', 'es', 'uk'].includes(lang)) {
      setContentLang(lang);
    }
  }, [locale]);
  
  return contentLang;
}

/**
 * Format text preview with ellipsis
 */
export function truncateText(
  text: string | undefined,
  maxLength: number = 100
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Get localized text with truncation
 */
export function getLocalizedPreview(
  text: LocalizedText | string | undefined,
  language: SupportedLanguage = 'pl',
  maxLength: number = 100
): string {
  const fullText = getDisplayText(text, language);
  return truncateText(fullText, maxLength);
}
