'use client';

/**
 * Language Switcher Component
 * 
 * Allows users to switch between supported languages (PL/EN/DE)
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

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['pl']; // Only PL active - EN/DE coming soon

export function LanguageSwitcherMenu() {
  const locale = useLocale() as SupportedLanguage;
  const pathname = usePathname();

  // Hide language switcher when only one language available
  if (SUPPORTED_LANGUAGES.length === 1) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Languages className="h-4 w-4 md:h-5 md:w-5" />
          <span className="sr-only">Wybierz język</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem key={lang} asChild>
            <Link
              href={pathname}
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
