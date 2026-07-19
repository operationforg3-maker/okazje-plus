"use client";
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { AutocompleteSearch } from '@/components/autocomplete-search';
import { Sparkles, Flame, ShoppingBag, Search } from 'lucide-react';
import { Deal } from '@/lib/types';
import { useTranslations } from 'next-intl';

interface HeroSectionProps {
  featuredDeal?: Deal;
}

export default function HeroSection({ featuredDeal }: HeroSectionProps) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  const t = useTranslations('home.hero');
  const tCommon = useTranslations('common');

  return (
    <section className="relative w-full overflow-hidden bg-background py-10 md:py-16">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background/40 to-transparent pointer-events-none" aria-hidden="true" />
      <div className="absolute top-1/4 -right-24 w-60 h-60 bg-primary/5 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left: Text + Search */}
          <div className="lg:col-span-6 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t('dealOfWeek')}
            </div>
            
            <h1 className="font-headline text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight text-foreground">
              {t('title.discover')} {t('title.best')} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-amber-500">
                {t('title.deals')}
              </span>
            </h1>
            
            <p className="text-base sm:text-lg text-muted-foreground font-medium max-w-lg leading-relaxed">
              {t('subtitle')}
            </p>
            
            {/* Search bar */}
            <div className="max-w-xl relative bg-card border border-border/40 rounded-2xl p-2 sm:p-2.5 shadow-lg transition-all duration-200 hover:border-primary/30 hover:shadow-primary/10">
              <AutocompleteSearch />
            </div>
            
            {/* Quick Nav Chips */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link 
                href={`${prefix}/deals`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-background hover:bg-muted text-sm font-semibold text-foreground transition-colors"
                aria-label={t('browseDeals')}
              >
                <Flame className="h-4 w-4 text-orange-500" aria-hidden="true" />
                {t('browseDeals')}
              </Link>
              <Link 
                href={`${prefix}/products`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-background hover:bg-muted text-sm font-semibold text-foreground transition-colors"
                aria-label={t('catalog')}
              >
                <ShoppingBag className="h-4 w-4 text-primary" aria-hidden="true" />
                {t('catalog')}
              </Link>
            </div>
          </div>

          {/* Right: Featured Deal Card */}
          <div className="lg:col-span-6 w-full max-w-lg mx-auto lg:mx-0 lg:ml-auto mt-8 lg:mt-0">
            {featuredDeal ? (
              <Link href={`${prefix}/deals/${featuredDeal.id}`} className="block group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-3xl">
                <div className="relative bg-background/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-xl overflow-hidden p-5 space-y-4 transition-transform duration-300 group-hover:scale-[1.02] group-hover:shadow-2xl">
                  <div className="flex items-center justify-between">
                    <span className="bg-orange-500/15 text-orange-500 border border-orange-500/25 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Flame className="h-3 w-3 animate-pulse" aria-hidden="true" />
                      {t('dealOfWeek')}
                    </span>
                    <span className="text-xs text-orange-500 font-black flex items-center gap-1" aria-label={`Temperatura: ${featuredDeal.temperature || 0} stopni`}>
                      <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                      +{featuredDeal.temperature || 0}°
                    </span>
                  </div>
                  
                  <div className="h-48 sm:h-56 bg-muted/10 dark:bg-zinc-800/20 rounded-2xl flex items-center justify-center relative overflow-hidden bg-sky-500/10 dark:bg-sky-500/5">
                     <Image 
                       src={featuredDeal.imageUrl || featuredDeal.image || '/placeholder-image.webp'} 
                       alt={featuredDeal.title}
                       fill
                       className="object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                       priority={true}
                       sizes="(max-width: 768px) 100vw, 500px"
                     />
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="font-bold text-base sm:text-lg text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {featuredDeal.title}
                    </h3>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-xl sm:text-2xl font-black text-foreground">{featuredDeal.price} zł</span>
                      {featuredDeal.oldPrice ? (
                        <span className="text-sm text-muted-foreground line-through">{featuredDeal.oldPrice} zł</span>
                      ) : null}
                      {featuredDeal.discount ? (
                        <span className="text-sm font-bold text-green-500 ml-auto">{featuredDeal.discount}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="relative bg-background/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-xl overflow-hidden p-5 space-y-4">
                 <div className="h-48 sm:h-56 bg-muted/20 rounded-2xl flex items-center justify-center">
                    <span className="text-muted-foreground font-medium">{tCommon('loading')}</span>
                 </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
