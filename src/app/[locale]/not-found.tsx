'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FileQuestion, Home, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const locale = useLocale();
  const t = useTranslations('common');

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-4 py-16 bg-gradient-to-b from-background via-background to-muted/20">
      <div className="max-w-md w-full text-center space-y-8 p-8 rounded-2xl bg-card/50 border border-muted shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-6 duration-500">
        
        {/* Animated Icon Container */}
        <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary animate-bounce duration-1000">
          <FileQuestion className="w-12 h-12" />
        </div>

        {/* Text Headers */}
        <div className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-primary-foreground bg-clip-text text-transparent">
            {t('errors.notFoundTitle')}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('errors.notFoundDescription')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
          <Button asChild variant="default" className="gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform">
            <Link href={`/${locale}/deals`}>
              <Flame className="w-4 h-4" />
              {t('actions.browseDeals')}
            </Link>
          </Button>
          
          <Button asChild variant="outline" className="gap-2 hover:bg-muted/50 hover:scale-[1.02] transition-transform">
            <Link href={`/${locale}`}>
              <Home className="w-4 h-4" />
              {t('breadcrumb.home')}
            </Link>
          </Button>
        </div>

      </div>
    </div>
  );
}
