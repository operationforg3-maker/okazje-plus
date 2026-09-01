'use client';

/**
 * Language Switcher Component
 * 
 * Allows users to switch between supported languages (PL/EN/DE/FR/ES/UK)
 * Uses next-intl routing for language switching
 */

import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { getLanguageLabel, getLanguageFlag } from '@/hooks/use-content-language';
import { SupportedLanguage } from '@/lib/i18n-content';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Languages, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['pl', 'en', 'de', 'fr', 'es', 'uk', 'it'];

export function LanguageSwitcherMenu() {
  const [isMounted, setIsMounted] = useState(false);
  const locale = useLocale() as SupportedLanguage;
  const pathname = usePathname();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Strip existing locale prefix to avoid duplicated segments (e.g. /en/pl)
  const pathnameWithoutLocale = pathname.replace(/^\/(pl|en|de|fr|es|uk|it)(\/|$)/, '/');
  const basePath = pathnameWithoutLocale || '/';

  // Don't render Check icon until mounted to avoid hydration mismatch
  // (locale from useLocale might differ between SSR and client in edge cases)
  if (!isMounted) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Languages className="h-5 w-5" />
            <span className="sr-only">Wybierz język</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <DropdownMenuItem key={lang} asChild>
              <Link
                href={basePath}
                locale={lang}
                className="cursor-pointer gap-2 w-full flex items-center"
              >
                <span className="text-xl">{getLanguageFlag(lang)}</span>
                <span className="flex-1">{getLanguageLabel(lang)}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Languages className="h-5 w-5" />
          <span className="sr-only">Wybierz język</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang} asChild>
            <Link
              href={basePath}
              locale={lang}
              className="cursor-pointer gap-2 w-full flex items-center"
            >
              <span className="text-xl">{getLanguageFlag(lang)}</span>
              <span className="flex-1">{getLanguageLabel(lang)}</span>
              {locale === lang && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
