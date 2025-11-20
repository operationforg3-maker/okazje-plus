'use client';

/**
 * Language Switcher Component
 * 
 * Allows users to switch between supported languages (PL/EN/DE)
 * Uses next-intl routing for language switching
 */

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { getLanguageLabel, getLanguageFlag } from '@/hooks/use-content-language';
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
  const locale = useLocale() as SupportedLanguage;
  const pathname = usePathname();
  const router = useRouter();

  const switchLanguage = (newLocale: SupportedLanguage) => {
    // Remove current locale prefix from pathname
    const pathnameWithoutLocale = pathname.replace(/^\/(pl|en|de)(\/|$)/, '/');
    
    // Build new path with locale prefix
    const newPath = newLocale === 'pl' 
      ? pathnameWithoutLocale || '/'  // Polish is default, no prefix needed
      : `/${newLocale}${pathnameWithoutLocale || '/'}`;
    
    router.push(newPath);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{getLanguageLabel(locale)}</span>
          <span className="sm:hidden">{locale.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => switchLanguage(lang)}
            className="cursor-pointer gap-2"
          >
            <span className="text-xl">{getLanguageFlag(lang)}</span>
            <span>{getLanguageLabel(lang)}</span>
            {locale === lang && (
              <span className="ml-auto text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
