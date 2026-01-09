"use client";
import Link from 'next/link';
import {useParams} from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AutocompleteSearch } from '@/components/autocomplete-search';
import { TrendingUp, Zap, Flame } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { LogoSVGWrapper } from '@/components/layout/logo-svg-wrapper';

export default function HeroSection() {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  return (
    <section className="relative w-full overflow-hidden bg-gradient-to-br from-primary/8 via-accent/6 to-background py-20 md:py-28 lg:py-36">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      <div className="page-container relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-10 animate-fade">
                    {/* Logo */}
                    <div className="relative flex justify-center mb-6">
                      <LogoSVGWrapper className="h-16 md:h-20 lg:h-24" />
                      <span className="absolute -top-2 -right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg md:-right-6 md:-top-3 md:h-7 md:w-7">
                        +
                      </span>
                    </div>
          
          {/* Główny nagłówek */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium transition-all duration-200 hover:bg-primary/15">
              <Flame className="h-4 w-4 md:h-5 md:w-5 animate-pulse-glow text-orange-500" />
              Najlepsze okazje w jednym miejscu
            </div>
            <h1 className="font-headline text-4xl md:text-5xl lg:text-7xl font-bold tracking-tight leading-tight">
              Znajdź swoją <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">idealną okazję</span>
            </h1>
            <p className="text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Społecznościowa platforma do odkrywania najlepszych promocji i produktów
            </p>
          </div>

          {/* Główny pasek wyszukiwania */}
          <div className="relative max-w-2xl mx-auto">
            <div className="p-2.5 rounded-2xl bg-card shadow-2xl border-2 border-primary/20 transition-all duration-200 hover:border-primary/30 hover:shadow-primary/10">
              <AutocompleteSearch />
            </div>
            <p className="mt-4 text-sm md:text-base text-muted-foreground">
              Szukaj wśród tysięcy produktów i okazji z pełnotekstowym wyszukiwaniem AI
            </p>
          </div>

          {/* Statystyki / Trust Indicators */}
          <div className="grid grid-cols-3 gap-6 md:gap-10 max-w-3xl mx-auto pt-10">
            <div className="text-center group">
              <div className="flex items-center justify-center gap-2 text-3xl md:text-4xl lg:text-5xl font-bold text-primary transition-transform duration-200 group-hover:scale-110">
                <TrendingUp className="h-6 w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                <span>1000+</span>
              </div>
              <p className="text-xs md:text-sm lg:text-base text-muted-foreground mt-2">Aktywnych okazji</p>
            </div>
            <div className="text-center group">
              <div className="flex items-center justify-center gap-2 text-3xl md:text-4xl lg:text-5xl font-bold text-primary transition-transform duration-200 group-hover:scale-110">
                <Zap className="h-6 w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                <span>50k+</span>
              </div>
              <p className="text-xs md:text-sm lg:text-base text-muted-foreground mt-2">Produktów</p>
            </div>
            <div className="text-center group">
              <div className="flex items-center justify-center gap-2 text-3xl md:text-4xl lg:text-5xl font-bold text-primary transition-transform duration-200 group-hover:scale-110">
                <Flame className="h-6 w-6 md:h-7 md:w-7 lg:h-8 lg:w-8" />
                <span>AI</span>
              </div>
              <p className="text-xs md:text-sm lg:text-base text-muted-foreground mt-2">Trending prognoza</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-6">
            <Button asChild size="lg" className="min-w-[200px] text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105">
              <Link href={`${prefix}/deals`}>Przeglądaj okazje</Link>
            </Button>
            <AuthCta prefix={prefix} />
          </div>
        </div>
      </div>
    </section>
  );
}

function AuthCta({prefix}:{prefix:string}) {
  const { user } = useAuth();
  if (user) {
    return (
      <Button asChild size="lg" variant="outline" className="min-w-[200px] text-base font-semibold border-2 hover:border-primary transition-all duration-200 hover:scale-105">
        <Link href={`${prefix}/add-deal`}>Dodaj okazję</Link>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" variant="outline" className="min-w-[200px] text-base font-semibold border-2 hover:border-primary transition-all duration-200 hover:scale-105">
      <Link href={`${prefix}/login`}>Dołącz za darmo</Link>
    </Button>
  );
}
