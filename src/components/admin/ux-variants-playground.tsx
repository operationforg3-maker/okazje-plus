'use client';

import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  ShoppingBag, 
  Sparkles, 
  ArrowRight, 
  TrendingUp, 
  Users, 
  Percent, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Star, 
  Share2, 
  ExternalLink,
  Heart,
  Eye,
  Layers,
  Award,
  Terminal,
  Grid,
  Zap,
  Info,
  Clock,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Sparkle,
  Menu
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Mock data representing a typical product/deal to ensure self-contained rendering
const MOCK_DEAL = {
  id: 'mock-deal-123',
  title: 'Xiaomi Smart Band 8 – Ekran AMOLED 60Hz, Pomiar natlenienia krwi, Bateria do 16 dni',
  price: 139.99,
  originalPrice: 199.99,
  temperature: 342,
  commentsCount: 24,
  votesCount: 89,
  imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/S7df64be8deee4deea5d28cb48b0a9446B.jpg',
  storeName: 'Aliexpress Super Store',
  postedAt: '2026-07-09T18:00:00Z',
  discount: 30,
};

const MOCK_PRODUCT = {
  id: 'mock-product-123',
  title: 'Xiaomi Smart Band 8 (Produkt)',
  price: 139.99,
  originalPrice: 199.99,
  rating: 4.8,
  reviewsCount: 154,
  imageUrl: 'https://ae-pic-a1.aliexpress-media.com/kf/S7df64be8deee4deea5d28cb48b0a9446B.jpg',
  storeName: 'Aliexpress Official Store',
  specs: {
    'Ekran': '1.62" AMOLED 60Hz',
    'Bateria': 'Do 16 dni (190 mAh)',
    'Waga': '27g'
  },
  lowestPriceIn30Days: 129.99,
  freeShipping: true,
  discount: 30,
  temperature: 342,
  commentsCount: 24,
};

const MOCK_CATEGORIES = [
  { name: 'Elektronika', slug: 'elektronika', count: 142, icon: '📱', subcats: ['Smartfony', 'Komputery', 'Akcesoria'] },
  { name: 'Dom i Ogród', slug: 'dom-i-ogrod', count: 98, icon: '🏡', subcats: ['Meble', 'Kuchnia', 'Narzędzia'] },
  { name: 'Moda i Uroda', slug: 'moda-i-uroda', count: 120, icon: '💄', subcats: ['Odzież', 'Obuwie', 'Kosmetyki'] },
  { name: 'Sport i Hobby', slug: 'sport-i-hobby', count: 75, icon: '🚴', subcats: ['Rowery', 'Siłownia', 'Turystyka'] },
  { name: 'Dla Dzieci', slug: 'dla-dzieci', count: 54, icon: '🧸', subcats: ['Zabawki', 'Wózki', 'Ubranka'] },
];

export function UXVariantsPlayground() {
  const [activeModule, setActiveModule] = useState<'hero' | 'card' | 'category' | 'stats' | 'nav'>('hero');
  const [selectedVariants, setSelectedVariants] = useState<Record<string, number>>({
    hero: 1,
    card: 1,
    category: 1,
    stats: 1,
    nav: 1,
  });
  const [cardType, setCardType] = useState<'deal' | 'product'>('deal');
  const [cardDetails, setCardDetails] = useState<'compact' | 'expanded'>('expanded');
  const [cardLayout, setCardLayout] = useState<'grid' | 'masonry' | 'list'>('grid');
  const [hoverReveal, setHoverReveal] = useState<boolean>(true);

  const updateVariant = (module: string, num: number) => {
    setSelectedVariants(prev => ({ ...prev, [module]: num }));
  };

  return (
    <div className="space-y-8">
      {/* 1. UX AUDIT HEADER PANEL */}
      <Card className="border-border/40 bg-background/50 backdrop-blur-md overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-accent/5 pointer-events-none" />
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold uppercase tracking-wider mb-2">
                <Sparkles className="h-3.5 w-3.5" />
                Audyt UX i Warianty Projektowe
              </div>
              <CardTitle className="font-headline text-2xl md:text-3xl font-black">Raport z Audytu & Alternatywne Layouty</CardTitle>
              <CardDescription className="max-w-3xl mt-1 text-muted-foreground">
                Zestawienie obecnego stanu portalu względem prototypów oraz 4 eksperymentalne warianty językowe interfejsu dla kluczowych podzespołów witryny.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm" asChild className="bg-primary hover:bg-primary/90 text-white font-bold">
                <a href="/pl/new-ux" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Uruchom Prototypy Nowego UX</span>
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/pl/admin/ux-preview" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                  <span>Otwórz stary Preview UX</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="border-t border-border/10 pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm text-red-500 flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0" /> Problemy z Freshness w obecnym UX
              </h4>
              <ul className="text-xs space-y-2 text-muted-foreground list-disc list-inside">
                <li>Brak głębi wizualnej – płaskie kolory i standardowe cienie bez efektu &quot;wow&quot;.</li>
                <li>Tradycyjne karty – standardowe obramowania, brak mikro-interakcji i animacji przy najechaniu.</li>
                <li>Niewykorzystane tła – brak nowoczesnych gradientów typu Aurora czy szklanych rozmyć.</li>
                <li>Sztywny układ mobilny – statyczne kafelki zamiast zoptymalizowanych dotykowych list karuzelowych.</li>
              </ul>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm text-primary flex items-center gap-2">
                <Sparkle className="h-4 w-4 shrink-0" /> Co wprowadzają Nowe Warianty
              </h4>
              <ul className="text-xs space-y-2 text-muted-foreground list-disc list-inside">
                <li><strong>Neo-Brutalist</strong> – odważne, czarne obramowania, jaskrawe akcenty i wysoki kontrast retro.</li>
                <li><strong>Glassmorphism</strong> – elegancka estetyka Apple, rozmycia teł (frosted glass) oraz cienie świetlne.</li>
                <li><strong>Gamified / Bouncy</strong> – zaokrąglone krawędzie, miękka gra kolorów, wysoka responsywność mikro-akcji.</li>
                <li><strong>Immersive Minimalist</strong> – ultra-cienkie obramowania, elegancki kontrast bieli/czerni, skupienie na zdjęciu.</li>
              </ul>
            </div>

            <div className="bg-accent/10 border border-accent/20 rounded-2xl p-5 space-y-3">
              <h4 className="font-bold text-sm text-amber-500 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 shrink-0" /> Cele Optymalizacyjne (FCP/CLS)
              </h4>
              <ul className="text-xs space-y-2 text-muted-foreground list-disc list-inside">
                <li>Wszystkie warianty zaprojektowano z myślą o stałych wysokościach (redukcja CLS do zera).</li>
                <li>Użycie wyłącznie natywnych stylów Tailwind zamiast bibliotek animacji zewnętrznych.</li>
                <li>Wydajne renderowanie CSS-only z płynnymi przejściami sprzętowymi GPU transition.</li>
                <li>Pełna spójność kolorystyczna z motywami ciemnymi oraz jasnymi systemu.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. THE PLAYGROUND CONTROLLER */}
      <div className="flex flex-wrap gap-2 border-b border-border/40 pb-4">
        {[
          { id: 'hero', name: '1. Sekcja Hero', icon: Sparkles },
          { id: 'card', name: '2. Karta Produktu / Dealu', icon: ShoppingBag },
          { id: 'category', name: '3. Kategorie i Menu', icon: Layers },
          { id: 'stats', name: '4. Statystyki & Ticker', icon: Users },
          { id: 'nav', name: '5. Nawigacja (Navbar)', icon: Menu },
        ].map(mod => (
          <Button
            key={mod.id}
            variant={activeModule === mod.id ? 'default' : 'outline'}
            onClick={() => setActiveModule(mod.id as any)}
            className="rounded-xl font-bold gap-2 text-xs md:text-sm"
          >
            <mod.icon className="h-4 w-4" />
            {mod.name}
          </Button>
        ))}
      </div>

      {/* 3. SHOWCASE ZONE */}
      <div className="space-y-6">
        {/* HERO SECTION PLAYGROUND */}
        {activeModule === 'hero' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold">Wybierz lub porównaj warianty Hero</h3>
              <div className="flex gap-1.5 bg-muted p-1 rounded-xl">
                {[1, 2, 3, 4].map(v => (
                  <button
                    key={v}
                    onClick={() => updateVariant('hero', v)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      selectedVariants.hero === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v === 2 ? "Wariant 2 (Obecny)" : `Wariant ${v}`}
                  </button>
                ))}
              </div>
            </div>

            {/* RENDER ACTIVE HERO VARIANT */}
            <div className="border border-border/20 rounded-3xl overflow-hidden bg-muted/10 p-2 sm:p-4">
              {selectedVariants.hero === 1 && <HeroVariantNeoBrutalist />}
              {selectedVariants.hero === 2 && <HeroVariantCurrent />}
              {selectedVariants.hero === 3 && <HeroVariantGamified />}
              {selectedVariants.hero === 4 && <HeroVariantMinimalist />}
            </div>

            {/* COMPARE SIDE-BY-SIDE INFO */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <VariantCardInfo title="V1: Neo-Brutalist" desc="Zdecydowane, surowe linie retro. Skupienie na brutalistycznych ramkach i mocnym kontraście." active={selectedVariants.hero === 1} onClick={() => updateVariant('hero', 1)} />
              <VariantCardInfo title="V2: Obecny Styl" desc="Klasyczny układ z wyszukiwarką po lewej oraz karuzelą Okazji Tygodnia po prawej." active={selectedVariants.hero === 2} onClick={() => updateVariant('hero', 2)} />
              <VariantCardInfo title="V3: Playful/Bouncy" desc="Zaokrąglone krawędzie, radosne bąbelki, bąbelkowy pasek wyszukiwania i płynna animacja." active={selectedVariants.hero === 3} onClick={() => updateVariant('hero', 3)} />
              <VariantCardInfo title="V4: Immersive Minimalist" desc="Szlachetny minimalizm. Skupienie na geometrii linii, drobnej typografii i cieniach." active={selectedVariants.hero === 4} onClick={() => updateVariant('hero', 4)} />
            </div>
          </div>
        )}

        {/* CARD PLAYGROUND */}
        {activeModule === 'card' && (
          <div className="space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-muted/20 dark:bg-zinc-900/30 p-5 rounded-3xl border border-border/20">
              <div>
                <h3 className="font-headline text-lg font-bold">Uniwersalny Podgląd Karty</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Konfiguruj parametry uniwersalnej karty i porównuj zachowanie 4 wariantów stylistycznych.</p>
              </div>
              <div className="flex flex-wrap gap-4 items-center">
                {/* Typ obiektu */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">Typ danych</span>
                  <div className="flex gap-1 bg-muted dark:bg-zinc-800 p-1 rounded-xl">
                    <button onClick={() => setCardType('deal')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", cardType === 'deal' ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Okazja (Deal)</button>
                    <button onClick={() => setCardType('product')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", cardType === 'product' ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Produkt</button>
                  </div>
                </div>

                {/* Rozmiar / Szczegóły */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">Poziom szczegółów</span>
                  <div className="flex gap-1 bg-muted dark:bg-zinc-800 p-1 rounded-xl">
                    <button onClick={() => setCardDetails('compact')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", cardDetails === 'compact' ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Kompaktowy</button>
                    <button onClick={() => setCardDetails('expanded')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", cardDetails === 'expanded' ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Rozbudowany</button>
                  </div>
                </div>

                {/* Układ / Forma */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">Forma layoutu</span>
                  <div className="flex gap-1 bg-muted dark:bg-zinc-800 p-1 rounded-xl">
                    <button onClick={() => setCardLayout('grid')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", cardLayout === 'grid' ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Grid</button>
                    <button onClick={() => setCardLayout('masonry')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", cardLayout === 'masonry' ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Masonry</button>
                    <button onClick={() => setCardLayout('list')} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", cardLayout === 'list' ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Lista</button>
                  </div>
                </div>

                {/* Tryb interakcji / Hover */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">Tryb interakcji</span>
                  <div className="flex gap-1 bg-muted dark:bg-zinc-800 p-1 rounded-xl">
                    <button onClick={() => setHoverReveal(false)} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", !hoverReveal ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Zawsze widoczne</button>
                    <button onClick={() => setHoverReveal(true)} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", hoverReveal ? "bg-background dark:bg-zinc-700 text-foreground shadow-sm" : "text-muted-foreground")}>Hover Reveal</button>
                  </div>
                </div>
              </div>
            </div>

            <div className={cn(
              "grid gap-6",
              cardLayout === 'list' 
                ? "grid-cols-1 max-w-4xl mx-auto" 
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            )}>
              {/* Card 1: Neo-Brutalist */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider block text-center">V1: Neo-Brutalist</span>
                <div className="h-full flex items-start justify-center p-2 w-full" data-ux-style="neo-brutalist">
                  <CardVariantUniversal 
                    type={cardType}
                    details={cardDetails}
                    layout={cardLayout}
                    hoverReveal={hoverReveal}
                    data={cardType === 'deal' ? MOCK_DEAL : MOCK_PRODUCT} 
                  />
                </div>
              </div>

              {/* Card 2: Obecny Styl (Classic) */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider block text-center">V2: Obecny Styl (Classic)</span>
                <div className="h-full flex items-start justify-center p-2 w-full" data-ux-style="classic">
                  <CardVariantUniversal 
                    type={cardType}
                    details={cardDetails}
                    layout={cardLayout}
                    hoverReveal={hoverReveal}
                    data={cardType === 'deal' ? MOCK_DEAL : MOCK_PRODUCT} 
                  />
                </div>
              </div>

              {/* Card 3: Playful / Bouncy */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider block text-center">V3: Playful / Bouncy</span>
                <div className="h-full flex items-start justify-center p-2 w-full" data-ux-style="playful">
                  <CardVariantUniversal 
                    type={cardType}
                    details={cardDetails}
                    layout={cardLayout}
                    hoverReveal={hoverReveal}
                    data={cardType === 'deal' ? MOCK_DEAL : MOCK_PRODUCT} 
                  />
                </div>
              </div>

              {/* Card 4: Immersive Minimalist */}
              <div className="space-y-3">
                <span className="text-xs font-extrabold text-primary uppercase tracking-wider block text-center">V4: Immersive Minimalist</span>
                <div className="h-full flex items-start justify-center p-2 w-full" data-ux-style="minimalist">
                  <CardVariantUniversal 
                    type={cardType}
                    details={cardDetails}
                    layout={cardLayout}
                    hoverReveal={hoverReveal}
                    data={cardType === 'deal' ? MOCK_DEAL : MOCK_PRODUCT} 
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY PLAYGROUND */}
        {activeModule === 'category' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold">Warianty panelu wyboru Kategorii</h3>
              <div className="flex gap-1.5 bg-muted p-1 rounded-xl">
                {[1, 2, 3, 4].map(v => (
                  <button
                    key={v}
                    onClick={() => updateVariant('category', v)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      selectedVariants.category === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Wariant {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-border/20 rounded-3xl overflow-hidden bg-muted/10 p-4">
              {selectedVariants.category === 1 && <CategoryVariantNeoBrutalist />}
              {selectedVariants.category === 2 && <CategoryVariantGlassmorphism />}
              {selectedVariants.category === 3 && <CategoryVariantGamified />}
              {selectedVariants.category === 4 && <CategoryVariantMinimalist />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <VariantCardInfo title="V1: Retro Ledger" desc="Wyrazisty, tabelaryczny spis z grubym obramowaniem i ikonami monospace." active={selectedVariants.category === 1} onClick={() => updateVariant('category', 1)} />
              <VariantCardInfo title="V2: Frosted Floating Pills" desc="Horyzontalna lista z półprzezroczystym rozmyciem tła i podświetlanymi pigułkami." active={selectedVariants.category === 2} onClick={() => updateVariant('category', 2)} />
              <VariantCardInfo title="V3: Bouncy Bubble Tiles" desc="Kolorowe, okrągłe dymki z bouncy animacją przy najechaniu i licznikami." active={selectedVariants.category === 3} onClick={() => updateVariant('category', 3)} />
              <VariantCardInfo title="V4: Minimal Columns Browser" desc="Szlachetny, minimalistyczny układ kolumnowy o zerowym CLS." active={selectedVariants.category === 4} onClick={() => updateVariant('category', 4)} />
            </div>
          </div>
        )}

        {/* STATS PLAYGROUND */}
        {activeModule === 'stats' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold">Warianty Ticking Stats & Social Proof</h3>
              <div className="flex gap-1.5 bg-muted p-1 rounded-xl">
                {[1, 2, 3, 4].map(v => (
                  <button
                    key={v}
                    onClick={() => updateVariant('stats', v)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      selectedVariants.stats === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Wariant {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-border/20 rounded-3xl overflow-hidden bg-muted/10 p-4">
              {selectedVariants.stats === 1 && <StatsVariantNeoBrutalist />}
              {selectedVariants.stats === 2 && <StatsVariantGlassmorphism />}
              {selectedVariants.stats === 3 && <StatsVariantGamified />}
              {selectedVariants.stats === 4 && <StatsVariantMinimalist />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <VariantCardInfo title="V1: Retro Terminal" desc="Konsola z zielonym oświetleniem CRT, monospaced czcionką i wskaźnikami online." active={selectedVariants.stats === 1} onClick={() => updateVariant('stats', 1)} />
              <VariantCardInfo title="V2: Glass Aurora Cards" desc="Szklane panele z dynamiczną poświatą neonową i delikatnymi cyprysami." active={selectedVariants.stats === 2} onClick={() => updateVariant('stats', 2)} />
              <VariantCardInfo title="V3: Gamified Podium" desc="Kolorowe bloki, ikony trofeum oraz podbicie bąbelkowe wskazujące liczebność." active={selectedVariants.stats === 3} onClick={() => updateVariant('stats', 3)} />
              <VariantCardInfo title="V4: Clean Data Strip" desc="Płaskie linie, potężne cyfry bez zbędnych ozdobników, minimalizm." active={selectedVariants.stats === 4} onClick={() => updateVariant('stats', 4)} />
            </div>
          </div>
        )}

        {/* NAVBAR PLAYGROUND */}
        {activeModule === 'nav' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg font-bold">Warianty Nawigacji & Nagłówka (Navbar)</h3>
              <div className="flex gap-1.5 bg-muted p-1 rounded-xl">
                {[1, 2, 3, 4].map(v => (
                  <button
                    key={v}
                    onClick={() => updateVariant('nav', v)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      selectedVariants.nav === v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {v === 2 ? "Wariant 2 (Obecny)" : `Wariant ${v}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="border border-border/20 rounded-3xl overflow-hidden bg-muted/10 p-4">
              {selectedVariants.nav === 1 && <NavbarVariantNeoBrutalist />}
              {selectedVariants.nav === 2 && <NavbarVariantCurrent />}
              {selectedVariants.nav === 3 && <NavbarVariantGamified />}
              {selectedVariants.nav === 4 && <NavbarVariantMinimalist />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <VariantCardInfo title="V1: Neo-Brutalist Navbar" desc="Wyrazisty czarny border, jaskrawy akcent tła logo, gruba typografia retro." active={selectedVariants.nav === 1} onClick={() => updateVariant('nav', 1)} />
              <VariantCardInfo title="V2: Obecny Styl Navbar" desc="Standardowy, szklany panel (blur) z łagodnym pomarańczowym przyciskiem CTA." active={selectedVariants.nav === 2} onClick={() => updateVariant('nav', 2)} />
              <VariantCardInfo title="V3: Playful/Bouncy Navbar" desc="Niezwykle zaokrąglona linia (bubble), ciepłe, radosne barwy i podświetlenia." active={selectedVariants.nav === 3} onClick={() => updateVariant('nav', 3)} />
              <VariantCardInfo title="V4: Immersive Minimalist Navbar" desc="Subtelne, cienkie linie poziome, brak widocznych ramek wyszukiwarki, minimalistyczny design." active={selectedVariants.nav === 4} onClick={() => updateVariant('nav', 4)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper card to choose variants in the list
function VariantCardInfo({ title, desc, active, onClick }: { title: string; desc: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left p-4 rounded-2xl border transition-all duration-200 group flex flex-col justify-between h-32 w-full",
        active 
          ? "bg-primary/10 border-primary shadow-lg shadow-primary/5" 
          : "bg-background/60 hover:bg-background border-border/40 hover:border-primary/40 hover:shadow-md"
      )}
    >
      <div>
        <h5 className={cn("font-extrabold text-sm transition-colors", active ? "text-primary" : "text-foreground group-hover:text-primary")}>
          {title}
        </h5>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">{desc}</p>
      </div>
      {active && (
        <span className="text-[10px] bg-primary text-primary-foreground font-black px-2 py-0.5 rounded-md uppercase tracking-wider self-end">
          Aktywny
        </span>
      )}
    </button>
  );
}

/* ==========================================================================
   MODULE 1: HERO SECTION VARIANTS
   ========================================================================== */

function HeroVariantNeoBrutalist() {
  return (
    <div className="bg-[#FAF7F0] dark:bg-[#1E1E1E] text-black dark:text-white border-4 border-black p-6 sm:p-10 rounded-none relative overflow-hidden">
      <div className="absolute top-2 right-2 bg-yellow-400 text-black border-2 border-black font-mono text-[10px] font-black px-2 py-0.5 rotate-3">
        NEO-BRUTALIST V1
      </div>
      <div className="space-y-6 max-w-2xl">
        <h2 className="font-mono text-3xl sm:text-5xl font-black uppercase tracking-tight leading-none text-black dark:text-white">
          KUPUJ TANIEJ.<br/>
          <span className="bg-red-400 text-black border-2 border-black px-2 inline-block my-1 -rotate-1">
            BEZ SCAMU.
          </span>
        </h2>
        <p className="font-mono text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          Raw & direct. Najlepsza społeczność łowców promocji. Płaskie kolory, zerowe zaokrąglenia, maksymalna przejrzystość.
        </p>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="WPISZ PRODUKT..." 
            className="font-mono text-xs sm:text-sm bg-white text-black border-4 border-black rounded-none px-4 py-3 flex-grow outline-none focus:bg-yellow-100"
          />
          <button className="bg-blue-400 text-black font-mono text-xs sm:text-sm font-black border-4 border-black px-6 py-3 rounded-none hover:translate-x-1 hover:translate-y-1 active:translate-x-0 active:translate-y-0 transition-transform shadow-[4px_4px_0_0_#000]">
            SZUKAJ
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroVariantCurrent() {
  return (
    <div className="relative pt-6 pb-4 bg-background border border-border/20 rounded-3xl p-6 sm:p-10 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/8 via-background/40 to-transparent pointer-events-none" />
      <div className="absolute top-1/4 -right-24 w-60 h-60 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
        {/* Left: Text + Search */}
        <div className="lg:col-span-6 space-y-5 text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            Okazja Tygodnia
          </div>
          
          <h2 className="font-headline text-3xl sm:text-4xl font-black tracking-tight leading-tight text-foreground">
            Znajduj najlepsze <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-red-500 to-amber-500">
              Okazje i Promocje
            </span>
          </h2>
          
          <p className="text-sm text-muted-foreground font-medium max-w-md leading-relaxed">
            Społeczność łowców okazji dzieląca się sprawdzonymi ofertami, kodami rabatowymi i wyprzedażami. Kupuj mądrzej!
          </p>
          
          {/* Search bar mockup */}
          <div className="max-w-md relative bg-background border border-border/40 rounded-2xl p-1 shadow-md flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground ml-3" />
            <input 
              type="text" 
              placeholder="Szukaj produktów lub okazji..." 
              className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 px-1 py-2 flex-grow outline-none border-none"
              disabled
            />
            <button className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl px-4 py-2 transition-all">
              Szukaj
            </button>
          </div>
          
          {/* Quick Nav Chips */}
          <div className="flex flex-wrap gap-2 pt-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-semibold text-foreground">
              <Flame className="h-3.5 w-3.5 text-orange-500" />
              Przeglądaj okazje
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-semibold text-foreground">
              <ShoppingBag className="h-3.5 w-3.5 text-primary" />
              Katalog produktów
            </div>
          </div>
        </div>

        {/* Right: Carousel mockup */}
        <div className="lg:col-span-6 w-full max-w-md mx-auto">
          <div className="relative bg-background/60 backdrop-blur-xl border border-border/40 rounded-3xl shadow-xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="bg-orange-500/15 text-orange-500 border border-orange-500/25 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                <Flame className="h-3 w-3 animate-pulse" />
                Okazja Tygodnia
              </span>
              <span className="text-xs text-orange-500 font-black flex items-center gap-1">
                <Flame className="h-3.5 w-3.5" />
                +342°
              </span>
            </div>
            
            <div className="h-36 bg-muted/20 rounded-2xl flex items-center justify-center relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40 font-bold text-sm bg-gradient-to-tr from-muted/50 to-muted/20">
                [ Podgląd Okazji ]
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-bold text-sm text-foreground line-clamp-2">
                Xiaomi Smart Band 8 – Ekran AMOLED 60Hz, Pomiar natlenienia krwi, Bateria do 16 dni
              </h4>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-foreground">139,99 zł</span>
                <span className="text-xs text-muted-foreground line-through">199,99 zł</span>
                <span className="text-xs font-bold text-green-500 ml-auto">-30%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroVariantGamified() {
  return (
    <div className="bg-gradient-to-tr from-amber-400/90 to-orange-500/90 dark:from-amber-600 dark:to-orange-700 text-white p-6 sm:p-10 rounded-[32px] relative overflow-hidden shadow-xl">
      <div className="absolute bottom-0 right-0 w-48 h-48 opacity-10 bg-white rounded-full blur-2xl translate-x-12 translate-y-12" />
      <div className="space-y-6 max-w-xl">
        <span className="bg-black/25 font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 w-fit text-white">
          <Flame className="h-3.5 w-3.5 text-amber-300 animate-bounce" /> Hot Deal Hunter Level Max
        </span>
        <h2 className="font-headline text-3xl sm:text-5xl font-black tracking-tight leading-none text-white drop-shadow-md">
          Upoluj Najlepsze <br/> promocje już dziś!
        </h2>
        <p className="text-xs sm:text-sm font-semibold text-white/95 leading-relaxed">
          Przyjazne, kolorowe elementy, bąbelkowy styl wyszukiwarki i radosne, bouncy przyciski. Najlepsza rozrywka łowiecka.
        </p>
        <div className="bg-white text-slate-800 rounded-3xl p-1 shadow-2xl flex gap-1 hover:scale-102 active:scale-98 transition-transform duration-200">
          <input 
            type="text" 
            placeholder="Co chcesz dzisiaj upolować?..." 
            className="bg-transparent text-sm px-4 py-3 flex-grow outline-none font-bold text-slate-800 border-none"
          />
          <button className="bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-2xl px-6 py-3.5 shadow-md transition-all flex items-center gap-1">
            <span>Łów!</span>
            <Flame className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroVariantMinimalist() {
  return (
    <div className="bg-background border border-border/40 p-6 sm:p-10 rounded-2xl relative overflow-hidden">
      <div className="max-w-xl space-y-6">
        <span className="text-[10px] text-muted-foreground font-semibold tracking-widest uppercase">
          04 // Minimalist Design System
        </span>
        <h2 className="font-light text-3xl sm:text-4xl leading-tight tracking-tight text-foreground">
          Czyste i przejrzyste <br/>
          <span className="font-bold text-primary">doświadczenie zakupów.</span>
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Bez zbędnych cieni, banerów i ozdobników. Czysta informacja, maksymalnie uproszczona typografia i lekka linia podziału.
        </p>
        <div className="flex gap-2 max-w-md pt-2">
          <div className="flex items-center gap-2 border-b border-foreground/30 flex-grow px-2 py-1.5 focus-within:border-primary">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Wyszukaj okazję..." 
              className="bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none flex-grow border-none"
            />
          </div>
          <Button variant="ghost" size="sm" className="font-bold text-xs uppercase tracking-wider text-primary">
            Szukaj <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   MODULE 2: DEAL/PRODUCT CARD VARIANTS
   ========================================================================== */

function CardVariantUniversal({ type, details, layout, hoverReveal, data }: {
  type: 'deal' | 'product';
  details: 'compact' | 'expanded';
  layout: 'grid' | 'masonry' | 'list';
  hoverReveal: boolean;
  data: any;
}) {
  const isList = layout === 'list';
  const isMasonry = layout === 'masonry';
  
  return (
    <div className={cn(
      "ux-card-container p-4 w-full relative min-w-0 text-left group",
      isList ? "flex flex-row items-center gap-6" : "flex flex-col max-w-[280px]"
    )}>
      {type === 'deal' && typeof data.discount === 'number' && (
        <div className="absolute top-3 left-3 z-10">
          <span className="ux-badge text-white text-[9px] font-black px-2.5 py-1 shadow-md">
            -{data.discount}%
          </span>
        </div>
      )}

      <div className={cn(
        "ux-image-wrapper relative bg-muted/10 dark:bg-zinc-800/20 p-3 shrink-0 flex items-center justify-center overflow-hidden",
        isList ? "w-28 h-28" : "w-full mb-3",
        !isList && !isMasonry ? "aspect-square" : "",
        isMasonry ? "min-h-[140px] max-h-[220px]" : ""
      )}>
        <img src={data.imageUrl} alt={data.title} className="w-full h-full object-contain" />
      </div>

      <div className="flex-grow space-y-2 min-w-0">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{data.storeName}</span>
          {type === 'product' && data.freeShipping && (
            <span className="text-emerald-600 font-bold">Darmowa dostawa</span>
          )}
        </div>

        <h4 className="text-xs font-bold line-clamp-2 leading-tight transition-colors group-hover:text-primary">
          {data.title}
        </h4>

        {/* Specs, price trend - collapses on hoverReveal unless hovered */}
        {details === 'expanded' && (
          <div className={cn(
            "space-y-1.5 pt-1 transition-all duration-300 ease-out origin-top",
            hoverReveal ? "max-h-0 opacity-0 overflow-hidden group-hover:max-h-[80px] group-hover:opacity-100 group-hover:pt-1" : ""
          )}>
            {type === 'product' && data.specs && (
              <div className="flex flex-wrap gap-x-2 gap-y-1 border-t border-border/10 pt-1.5">
                {Object.entries(data.specs).slice(0, 2).map(([key, val]) => (
                  <span key={key} className="ux-spec-pill px-1.5 py-0.5 text-[9px] font-bold">{key}: {String(val)}</span>
                ))}
              </div>
            )}
            {data.priceHistory && (
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>Trend ceny:</span>
                <span className="inline-block w-8 h-2 bg-gradient-to-r from-emerald-500 to-transparent rounded" />
              </div>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-lg font-black text-foreground">{data.price.toFixed(2)} zł</span>
          {data.originalPrice && (
            <span className="text-xs text-muted-foreground line-through">{data.originalPrice.toFixed(2)} zł</span>
          )}
        </div>

        {/* Static stats footer */}
        <div className={cn(
          "flex items-center justify-between pt-2 border-t border-border/10 text-xs text-muted-foreground transition-all duration-200",
          hoverReveal ? "opacity-100 group-hover:opacity-0 group-hover:h-0 group-hover:py-0 group-hover:border-none overflow-hidden" : ""
        )}>
          {type === 'deal' ? (
            <>
              <span className="text-orange-500 font-extrabold flex items-center gap-0.5">
                <Flame className="h-3.5 w-3.5 animate-pulse" /> +{data.temperature}°
              </span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" /> {data.commentsCount}</span>
            </>
          ) : (
            <>
              <span className="text-amber-500 font-extrabold flex items-center gap-0.5">
                ★ {data.rating}
              </span>
              <span>{data.reviewsCount} opinii</span>
            </>
          )}
        </div>

        {/* Interactive Action Bar - Voting, Share */}
        <div className={cn(
          "flex items-center justify-between pt-2 border-t border-border/10 transition-all duration-300 ease-out origin-top",
          hoverReveal ? "max-h-0 opacity-0 overflow-hidden group-hover:max-h-[50px] group-hover:opacity-100" : ""
        )}>
          <div className="flex items-center bg-muted dark:bg-zinc-800 rounded-full p-0.5 text-[10px] font-bold">
            <button className="px-1.5 py-0.5 hover:bg-background dark:hover:bg-zinc-700 rounded-full transition text-muted-foreground hover:text-foreground font-bold">+</button>
            <span className="px-2 font-black text-foreground">+{data.temperature}°</span>
            <button className="px-1.5 py-0.5 hover:bg-background dark:hover:bg-zinc-700 rounded-full transition text-muted-foreground hover:text-foreground font-bold">-</button>
          </div>
          <button className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition bg-muted/50 dark:bg-zinc-800/50 hover:bg-muted dark:hover:bg-zinc-800 px-3 py-1 rounded-full">
            <Share2 className="h-3 w-3" />
            <span>Udostępnij</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   MODULE 3: CATEGORY PANEL VARIANTS
   ========================================================================== */

function CategoryVariantNeoBrutalist() {
  return (
    <div className="space-y-4">
      <div className="bg-black text-white font-mono text-xs font-black px-4 py-2 uppercase w-fit border-2 border-black rotate-1">
        RETRO DIRECTORY
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {MOCK_CATEGORIES.map(cat => (
          <div key={cat.slug} className="bg-[#FAF7F0] dark:bg-[#1E1E1E] border-4 border-black p-4 rounded-none shadow-[4px_4px_0_0_#000] cursor-pointer hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-0 active:translate-y-0 transition-transform text-black dark:text-white">
            <div className="font-mono text-2xl mb-1">{cat.icon}</div>
            <div className="font-mono text-sm font-black uppercase">{cat.name}</div>
            <div className="font-mono text-[10px] text-slate-500 mt-1">ITEMS: {cat.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CategoryVariantGlassmorphism() {
  return (
    <div className="space-y-4">
      <div className="flex overflow-x-auto gap-2.5 pb-2 scrollbar-thin">
        {MOCK_CATEGORIES.map(cat => (
          <button
            key={cat.slug}
            className="flex-shrink-0 flex items-center gap-2 bg-white/5 dark:bg-black/25 border border-white/10 rounded-full px-4 py-2 text-xs font-bold text-foreground hover:bg-white/15 hover:border-cyan-500/30 transition-all backdrop-blur-md"
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
            <span className="bg-white/10 text-muted-foreground text-[10px] px-2 py-0.5 rounded-full">
              {cat.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryVariantGamified() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {MOCK_CATEGORIES.map(cat => (
        <div 
          key={cat.slug} 
          className="bg-background border-2 border-orange-500/10 hover:border-orange-500/50 rounded-[28px] p-4 text-center cursor-pointer hover:scale-105 active:scale-95 transition-all duration-300 group shadow-sm hover:shadow-md"
        >
          <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center text-xl mx-auto mb-2 group-hover:scale-110 transition-transform">
            {cat.icon}
          </div>
          <h4 className="font-headline text-xs font-black text-slate-800 dark:text-slate-200">
            {cat.name}
          </h4>
          <span className="inline-block bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full mt-2">
            {cat.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function CategoryVariantMinimalist() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 border-r border-border/20 pr-4 space-y-1">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block mb-2 px-2">Kategorie Główne</span>
        {MOCK_CATEGORIES.map((cat, idx) => (
          <button
            key={cat.slug}
            className={cn(
              "w-full text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between",
              idx === 0 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <span>{cat.name}</span>
            <ChevronRight className="h-3.5 w-3.5 opacity-65" />
          </button>
        ))}
      </div>

      <div className="md:col-span-2 space-y-4">
        <span className="text-[10px] uppercase font-bold text-muted-foreground block">Podkategorie ({MOCK_CATEGORIES[0].name})</span>
        <div className="grid grid-cols-2 gap-2">
          {MOCK_CATEGORIES[0].subcats.map(sub => (
            <div key={sub} className="p-3 bg-muted/20 border border-border/10 rounded-xl hover:border-primary/40 cursor-pointer transition-colors flex items-center justify-between group">
              <span className="text-xs font-medium text-foreground">{sub}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground opacity-50 group-hover:opacity-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   MODULE 4: STATISTICS & TICKER VARIANTS
   ========================================================================== */

function StatsVariantNeoBrutalist() {
  return (
    <div className="bg-[#FAF7F0] dark:bg-[#1E1E1E] text-black dark:text-white border-4 border-black p-4 rounded-none font-mono">
      <div className="flex items-center gap-2 border-b-2 border-black pb-2 mb-3">
        <Terminal className="h-4 w-4 animate-pulse text-red-500" />
        <span className="text-xs font-black">CRT STATS LEDGER // READY</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'ONLINE_USERS', val: '1,421' },
          { label: 'ACTIVE_DEALS', val: '8,924' },
          { label: 'VOTES_24H', val: '+45,392' },
          { label: 'COMMENTS_24H', val: '12,981' },
        ].map(item => (
          <div key={item.label} className="border-2 border-black p-3 bg-white text-black">
            <div className="text-[9px] text-slate-500 font-extrabold">{item.label}</div>
            <div className="text-lg font-black mt-1 text-green-600">{item.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsVariantGlassmorphism() {
  return (
    <div className="relative rounded-2xl border border-white/10 bg-slate-950/20 p-5 overflow-hidden">
      {/* Background neon light blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-12 bg-cyan-500/10 rounded-full blur-2xl" />
      
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
        {[
          { label: 'Użytkownicy online', val: '1 421', desc: '12m temu', icon: Users },
          { label: 'Aktywne okazje', val: '8 924', desc: '+12 dziś', icon: Flame },
          { label: 'Oddane głosy', val: '45 392', desc: '+4.2k dziś', icon: ThumbsUp },
          { label: 'Dyskusje (24h)', val: '12 981', desc: '+2.1k postów', icon: MessageSquare },
        ].map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-2">
              <item.icon className="h-4 w-4" />
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">{item.label}</div>
            <div className="text-xl font-black text-foreground">{item.val}</div>
            <div className="text-[9px] text-cyan-400/80 font-bold">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsVariantGamified() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Hunterów Online', val: '1 421', bg: 'from-orange-500/10 to-red-500/10 border-orange-500/20 text-orange-500', icon: Users },
        { label: 'Gorących Okazji', val: '8 924', bg: 'from-amber-500/10 to-yellow-500/10 border-amber-500/20 text-amber-500', icon: Flame },
        { label: 'Punktów Reputacji', val: '45 392', bg: 'from-green-500/10 to-emerald-500/10 border-green-500/20 text-emerald-500', icon: Award },
        { label: 'Komentarzy Społeczności', val: '12 981', bg: 'from-blue-500/10 to-cyan-500/10 border-blue-500/20 text-blue-500', icon: MessageSquare },
      ].map((item, idx) => (
        <div 
          key={idx} 
          className={cn(
            "bg-gradient-to-r border-2 rounded-[22px] p-4 flex items-center gap-4 transition-transform hover:scale-103 cursor-pointer",
            item.bg
          )}
        >
          <div className="w-10 h-10 rounded-full bg-white/40 dark:bg-black/20 flex items-center justify-center text-lg shrink-0">
            <item.icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-wide opacity-80">{item.label}</div>
            <div className="text-xl font-black">{item.val}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsVariantMinimalist() {
  return (
    <div className="border border-border/40 rounded-xl p-6 bg-background">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 divide-y sm:divide-y-0 sm:divide-x divide-border/20">
        {[
          { label: 'online users', val: '1.4K' },
          { label: 'active deals', val: '8.9K' },
          { label: 'reputation score', val: '45.3K' },
          { label: 'discussions', val: '12.9K' },
        ].map((item, idx) => (
          <div key={idx} className={cn("space-y-1", idx > 0 && "sm:pl-8 pt-4 sm:pt-0")}>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
              {item.label}
            </span>
            <div className="text-2xl font-bold text-foreground">
              {item.val}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ==========================================================================
   MODULE 5: NAVBAR / HEADER VARIANTS
   ========================================================================== */

function NavbarVariantNeoBrutalist() {
  return (
    <div className="border-4 border-black bg-white text-black p-4 rounded-none shadow-[6px_6px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Brand logo */}
      <div className="flex items-center gap-2 font-mono tracking-tight font-black text-xl border-2 border-black px-3 py-1 bg-yellow-300 w-fit">
        OKAZJE+
      </div>
      
      {/* Search mockup */}
      <div className="flex-grow max-w-md border-2 border-black bg-white p-1 flex gap-2">
        <input 
          type="text" 
          placeholder="SZUKAJ PROMOCJI..." 
          className="bg-transparent text-xs font-mono placeholder:text-black/50 px-2 py-1.5 flex-grow outline-none border-none text-black"
          disabled
        />
        <button className="bg-cyan-300 border-2 border-black font-black text-xs px-4 py-1.5 shadow-[2px_2px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#000]">
          SZUKAJ
        </button>
      </div>
      
      {/* Menu links */}
      <div className="flex items-center gap-4 font-mono text-xs font-black">
        <span className="hover:underline cursor-pointer">OKAZJE</span>
        <span className="hover:underline cursor-pointer">PRODUKTY</span>
        <span className="hover:underline cursor-pointer">FORUM</span>
        <button className="bg-[#ff5a1f] border-2 border-black px-4 py-1.5 shadow-[2px_2px_0px_#000] text-black hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[1px_1px_0px_#000] transition-all">
          + DODAJ
        </button>
      </div>
    </div>
  );
}

function NavbarVariantCurrent() {
  return (
    <div className="border border-border/20 bg-background/95 backdrop-blur-md p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
      {/* Brand logo */}
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-full bg-gradient-to-tr from-orange-500 to-red-500 flex items-center justify-center text-white font-bold text-xs">
          O+
        </div>
        <span className="font-bold text-lg text-foreground">Okazje+</span>
      </div>
      
      {/* Search mockup */}
      <div className="flex-grow max-w-md bg-muted/50 border border-border/40 rounded-xl p-1 flex gap-2">
        <input 
          type="text" 
          placeholder="Szukaj okazji..." 
          className="bg-transparent text-xs placeholder:text-muted-foreground/60 px-3 py-1.5 flex-grow outline-none border-none text-foreground"
          disabled
        />
        <button className="bg-primary text-primary-foreground font-semibold text-xs rounded-lg px-4 py-1.5">
          Szukaj
        </button>
      </div>
      
      {/* Menu links */}
      <div className="flex items-center gap-6 text-xs font-semibold text-muted-foreground">
        <span className="hover:text-foreground cursor-pointer">Okazje</span>
        <span className="hover:text-foreground cursor-pointer">Produkty</span>
        <span className="hover:text-foreground cursor-pointer">Forum</span>
        <button className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full px-5 py-1.5 shadow-md shadow-orange-500/10 hover:shadow-lg transition-all font-bold">
          + Dodaj ofertę
        </button>
      </div>
    </div>
  );
}

function NavbarVariantGamified() {
  return (
    <div className="border border-orange-200/50 bg-orange-50/50 dark:bg-orange-950/10 p-4 rounded-[28px] flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Brand logo */}
      <div className="flex items-center gap-2 bg-orange-100 dark:bg-orange-900/30 px-3 py-1.5 rounded-2xl">
        <span className="text-xl">🔥</span>
        <span className="font-black text-orange-600 dark:text-orange-400 text-base">OkazjePlus</span>
      </div>
      
      {/* Search mockup */}
      <div className="flex-grow max-w-md bg-white dark:bg-background border-2 border-orange-200 dark:border-orange-900 rounded-2xl p-1 flex gap-2 focus-within:border-orange-500 transition-all">
        <input 
          type="text" 
          placeholder="Wpisz słowo kluczowe..." 
          className="bg-transparent text-xs placeholder:text-muted-foreground px-3 py-1.5 flex-grow outline-none border-none"
          disabled
        />
        <button className="bg-amber-400 hover:bg-amber-500 text-black font-black text-xs rounded-xl px-4 py-1.5 transition-all">
          Lupka 🔍
        </button>
      </div>
      
      {/* Menu links */}
      <div className="flex items-center gap-5 text-xs font-extrabold text-muted-foreground">
        <span className="hover:text-orange-500 cursor-pointer bg-orange-100/50 dark:bg-orange-950/20 px-3 py-1 rounded-full">Okazje</span>
        <span className="hover:text-orange-500 cursor-pointer">Produkty</span>
        <span className="hover:text-orange-500 cursor-pointer">Forum</span>
        <button className="bg-amber-400 hover:bg-amber-500 text-black rounded-full px-5 py-2 hover:scale-105 transition-all font-black shadow-md">
          Dodaj okazję!
        </button>
      </div>
    </div>
  );
}

function NavbarVariantMinimalist() {
  return (
    <div className="border-b border-border/10 bg-background p-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Brand logo */}
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-xs uppercase tracking-[0.25em] text-foreground">okazje.plus</span>
      </div>
      
      {/* Search mockup */}
      <div className="flex-grow max-w-xs border-b border-border/40 pb-0.5 flex gap-2">
        <input 
          type="text" 
          placeholder="szukaj" 
          className="bg-transparent text-[11px] placeholder:text-muted-foreground/40 py-1 flex-grow outline-none border-none uppercase tracking-wider"
          disabled
        />
      </div>
      
      {/* Menu links */}
      <div className="flex items-center gap-8 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="hover:text-foreground cursor-pointer transition-colors">okazje</span>
        <span className="hover:text-foreground cursor-pointer transition-colors">produkty</span>
        <span className="hover:text-foreground cursor-pointer transition-colors">forum</span>
        <button className="border border-foreground/60 hover:bg-foreground hover:text-background text-[10px] uppercase tracking-widest px-4 py-1.5 transition-all duration-200">
          dodaj
        </button>
      </div>
    </div>
  );
}
