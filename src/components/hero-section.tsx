"use client";
import Link from 'next/link';
import {useParams} from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AutocompleteSearch } from '@/components/autocomplete-search';
import { TrendingUp, Zap, Flame } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function HeroSection() {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';
  const prefix = `/${locale}`;
  return (
    <section className="relative w-full bg-gradient-to-br from-primary/5 via-accent/5 to-background py-16 md:py-24 lg:py-32">
      <div className="page-container z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
                    {/* Logo */}
                    <div className="relative flex justify-center mb-6">
                      <img 
                        src="/Logotyp_okazjeplus.svg" 
                        alt="Okazje+" 
                        className="h-16 md:h-20 lg:h-24"
                      />
                      <span className="absolute -top-2 -right-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow-lg md:-right-6 md:-top-3 md:h-7 md:w-7">
                        +
                      </span>
                    </div>
          
          {/* Główny nagłówek */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Flame className="h-4 w-4 md:h-5 md:w-5" />
              Najlepsze okazje w jednym miejscu
            </div>
            <h1 className="font-headline text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Znajdź swoją <span className="text-primary">idealną okazję</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              Społecznościowa platforma do odkrywania najlepszych promocji i produktów
            </p>
          </div>

          {/* Główny pasek wyszukiwania */}
          <div className="relative max-w-2xl mx-auto">
            <div className="p-2 rounded-2xl bg-card shadow-2xl border-2 border-primary/20">
              <AutocompleteSearch />
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Szukaj wśród tysięcy produktów i okazji z pełnotekstowym wyszukiwaniem AI
            </p>
          </div>

          {/* Statystyki / Trust Indicators */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-2xl mx-auto pt-8">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-2xl md:text-3xl font-bold text-primary">
                <TrendingUp className="h-5 w-5 md:h-6 md:w-6" />
                <span>1000+</span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Aktywnych okazji</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-2xl md:text-3xl font-bold text-primary">
                <Zap className="h-5 w-5 md:h-6 md:w-6" />
                <span>50k+</span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Produktów</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 text-2xl md:text-3xl font-bold text-primary">
                <Flame className="h-5 w-5 md:h-6 md:w-6" />
                <span>AI</span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground mt-1">Trending prognoza</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button asChild size="lg" className="min-w-[200px]">
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
      <Button asChild size="lg" variant="outline" className="min-w-[200px]">
        <Link href={`${prefix}/add-deal`}>Dodaj okazję</Link>
      </Button>
    );
  }
  return (
    <Button asChild size="lg" variant="outline" className="min-w-[200px]">
      <Link href={`${prefix}/login`}>Dołącz za darmo</Link>
    </Button>
  );
}
