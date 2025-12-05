'use client';

/**
 * Translation Status Badge Component
 * 
 * Shows translation coverage for a product/deal across supported locales
 * Icons: ✅ (available), ⏳ (processing), ❌ (missing)
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Deal, Product } from '@/lib/types';

interface TranslationStatusBadgeProps {
  item: Deal | Product;
  locale: string;
}

const SUPPORTED_LOCALES = ['pl', 'en', 'de', 'fr', 'es'] as const;
type Locale = typeof SUPPORTED_LOCALES[number];

const LOCALE_DISPLAY: Record<Locale, { flag: string; name: string }> = {
  'pl': { flag: '🇵🇱', name: 'Polski' },
  'en': { flag: '🇬🇧', name: 'English' },
  'de': { flag: '🇩🇪', name: 'Deutsch' },
  'fr': { flag: '🇫🇷', name: 'Français' },
  'es': { flag: '🇪🇸', name: 'Español' },
};

const getTranslationStatus = (item: Deal | Product, locale: Locale): 'available' | 'processing' | 'missing' => {
  // Check if translations map has this locale
  if ('translations' in item && item.translations && item.translations[locale]) {
    return 'available';
  }
  
  // Check if it's currently being processed (metadata flag)
  if ('metadata' in item && item.metadata?.translationInProgress?.includes(locale)) {
    return 'processing';
  }
  
  return 'missing';
};

const getStatusIcon = (status: 'available' | 'processing' | 'missing'): string => {
  switch (status) {
    case 'available':
      return '✅';
    case 'processing':
      return '⏳';
    case 'missing':
      return '❌';
  }
};

const getStatusColor = (status: 'available' | 'processing' | 'missing'): string => {
  switch (status) {
    case 'available':
      return 'bg-green-100 text-green-800';
    case 'processing':
      return 'bg-yellow-100 text-yellow-800';
    case 'missing':
      return 'bg-gray-100 text-gray-800';
  }
};

export function TranslationStatusBadge({ item }: TranslationStatusBadgeProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-1 flex-wrap">
        {SUPPORTED_LOCALES.map((locale) => {
          const status = getTranslationStatus(item, locale);
          const display = LOCALE_DISPLAY[locale];
          
          return (
            <Tooltip key={locale}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className={`text-xs gap-0.5 cursor-help ${getStatusColor(status)}`}
                >
                  <span>{display.flag}</span>
                  <span>{getStatusIcon(status)}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {display.name}: {
                    status === 'available' ? 'Przetłumaczone' :
                    status === 'processing' ? 'Tłumaczenie w toku...' :
                    'Brak tłumaczenia'
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
