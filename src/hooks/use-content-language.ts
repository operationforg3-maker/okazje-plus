'use client';

/**
 * React Hook for Content Language Detection and Management
 * 
 * Detects user's preferred language and provides utilities for i18n content
 */

import { useState, useEffect } from 'react';
import { SupportedLanguage } from '@/lib/i18n-content';

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
  
  // Default to Polish for unsupported languages
  return DEFAULT_LANGUAGE;
}

/**
 * Get stored language preference
 */
function getStoredLanguage(): SupportedLanguage | null {
  if (typeof window === 'undefined') return null;
  
  const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (stored && ['pl', 'en', 'de'].includes(stored)) {
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
 * Hook for managing content language
 */
export function useContentLanguage() {
  const [language, setLanguageState] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Priority: 1. Stored preference, 2. Browser language, 3. Default
    const stored = getStoredLanguage();
    const detected = detectBrowserLanguage();
    
    const initialLang = stored || detected;
    setLanguageState(initialLang);
    setIsLoading(false);
  }, []);

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
  };

  return {
    language,
    setLanguage,
    isLoading,
    isPolish: language === 'pl',
    isEnglish: language === 'en',
    isGerman: language === 'de',
  };
}

/**
 * Hook to get language from URL path
 * Format: /pl/... or /en/... or /de/...
 */
export function useLanguageFromPath(): SupportedLanguage {
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANGUAGE);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const path = window.location.pathname;
    const langMatch = path.match(/^\/(pl|en|de)\//);
    
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
  };
  
  return flags[lang];
}
