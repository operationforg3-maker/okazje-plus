'use client';

/**
 * React Hook for Content Language Detection and Management (M4 Enhanced + M6 URL sync)
 * 
 * Detects user's preferred language and provides utilities for i18n content
 * with intelligent fallback chain for LocalizedText objects
 * 
 * M6: Now syncs with next-intl locale from URL params
 */

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { SupportedLanguage } from '@/lib/i18n-content';
import { LocalizedText, getLocalizedText } from '@/lib/i18n-utils';

const DEFAULT_LANGUAGE: SupportedLanguage = 'pl';
const LANGUAGE_STORAGE_KEY = 'preferred_language';

/**
 * Detect browser language and map to supported language
 */
function detectBrowserLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE;
  
  const browserLang = navigator.language.toLowerCase().split('-')[0];
  
  if (browserLang === 'en') return 'en';
  if (browserLang === 'de') return 'de';
  if (browserLang === 'pl') return 'pl';
  if (browserLang === 'fr') return 'fr';
  if (browserLang === 'es') return 'es';
  if (browserLang === 'uk') return 'uk';
  
  // Default to Polish for unsupported languages
  return DEFAULT_LANGUAGE;
}

/**
 * Get stored language preference
 */
function getStoredLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && ['pl', 'en', 'de', 'fr', 'es', 'uk'].includes(stored)) {
    return stored as SupportedLanguage;
  }
  
  return null;
}

/**
 * Store language preference
 */
function setStoredLanguage(lang: SupportedLanguage): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
}

/**
 * Hook for managing content language (M6 Enhanced - URL sync)
 * 
 * Priority: 1. URL locale (/[locale]/...), 2. Stored preference, 3. Browser, 4. Default
 */
export function useContentLanguage() {
  const params = useParams();
  const urlLocale = params?.locale as SupportedLanguage | undefined;
  
  const [language, setLanguageState] = useState<SupportedLanguage>(
    urlLocale || DEFAULT_LANGUAGE
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Priority: 1. URL locale (highest), 2. Stored preference, 3. Browser language, 4. Default
    const stored = getStoredLanguage();
    const detected = detectBrowserLanguage();
    
    const finalLang = urlLocale || stored || detected;
    setLanguageState(finalLang);
    setIsLoading(false);
  }, [urlLocale]);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
  };

  /**
   * M4: Get localized text with automatic fallback
   */
  const getText = (text: LocalizedText | string | undefined): string => {
    return getLocalizedText(text, language);
  };

  return {
    language,
    setLanguage,
    getText, // M4: New helper for LocalizedText
    isLoading,
    isPolish: language === 'pl',
    isEnglish: language === 'en',
    isGerman: language === 'de',
    isFrench: language === 'fr',
    isSpanish: language === 'es',
    isUkrainian: language === 'uk',
  };
}

/**
 * Hook to get language from URL path
 * Format: /pl/... or /en/... or /de/... or /fr/... or /es/... or /uk/...
 */
export function useLanguageFromPath(): SupportedLanguage {
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const path = window.location.pathname;
    const langMatch = path.match(/^\/(pl|en|de|fr|es|uk)\//);
    
    if (langMatch && langMatch[1]) {
      setLanguage(langMatch[1] as SupportedLanguage);
    } else {
      // Fallback to stored or detected
      const stored = getStoredLanguage();
      const detected = detectBrowserLanguage();
      setLanguage(stored || detected);
    }
  }, []);

  return language;
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
    uk: 'Українська',
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
    uk: '🇺🇦',
  };
  
  return flags[lang];
}
