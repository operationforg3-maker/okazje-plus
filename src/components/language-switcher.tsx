'use client';

/**
 * Language Switcher Component
 * 
 * Allows users to switch between supported languages (PL/EN/DE)
 */

import { useContentLanguage, getLanguageLabel, getLanguageFlag } from '@/hooks/use-content-language';
import { SupportedLanguage } from '@/lib/i18n-content';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Globe } from 'lucide-react';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['pl', 'en', 'de'];

export function LanguageSwitcher() {
  const { language, setLanguage } = useContentLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{getLanguageLabel(language)}</span>
          <span className="sm:hidden">{language.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang)}
            className="cursor-pointer gap-2"
          >
            <span className="text-xl">{getLanguageFlag(lang)}</span>
            <span>{getLanguageLabel(lang)}</span>
            {language === lang && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
