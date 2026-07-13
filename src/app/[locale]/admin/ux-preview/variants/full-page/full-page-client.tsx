'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { 
  Flame, 
  ShoppingBag, 
  Sparkles, 
  ArrowRight, 
  Search, 
  Star, 
  MessageSquare, 
  SlidersHorizontal, 
  ChevronRight, 
  ChevronDown,
  RotateCcw, 
  Sliders, 
  Folder,
  FolderOpen,
  Send,
  Facebook,
  Instagram,
  Twitter,
  Github,
  Zap,
  Check,
  Share2,
  Copy,
  ThumbsUp,
  CornerDownRight,
  ExternalLink,
  MessageCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CardVariantUniversal } from '@/components/admin/ux-variants-playground';

// Import real production components
import { AutocompleteSearch } from '@/components/autocomplete-search';
import { LogoSVGWrapper } from '@/components/layout/logo-svg-wrapper';
import { ThemeToggle } from '@/components/theme-toggle';
import { UserNav } from '@/components/auth/user-nav';
import { MiniCartBadge } from '@/components/smart-cart-widget';

// Import Dropdown components for UX switcher (puzzle button)
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

interface Props {
  realDeals: any[];
  realProducts: any[];
  realCategories: any[];
  realCounts: { products: number; deals: number; users: number };
}

export function FullPagePreviewClient({ realDeals, realProducts, realCategories, realCounts }: Props) {
  const params = useParams();
  const locale = (params?.locale as string) || 'pl';

  // Playground state controls
  const [styleFamily, setStyleFamily] = useState<'neo-brutalist' | 'classic' | 'playful' | 'minimalist'>('classic');
  const [pageType, setPageType] = useState<'deal' | 'product'>('deal');
  const [layoutMode, setLayoutMode] = useState<'grid' | 'masonry' | 'list'>('grid');
  const [cardDensity, setCardDensity] = useState<'compact' | 'expanded'>('expanded');
  
  // Navigation State: 'list' (List of offers) vs 'details' (Details Page)
  const [viewState, setViewState] = useState<'list' | 'details'>('list');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Interactive category tree states
  const [expandedMain, setExpandedMain] = useState<string | null>(null);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  const [activeMainCat, setActiveMainCat] = useState<string | null>(null);
  const [activeSubCat, setActiveSubCat] = useState<string | null>(null);
  const [activeSubSubCat, setActiveSubSubCat] = useState<string | null>(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [priceRange, setPriceRange] = useState(5000);
  const [sortBy, setSortBy] = useState<'hot' | 'newest' | 'price_asc'>('hot');

  // Coupon copy animation state
  const [copiedCode, setCopiedCode] = useState(false);

  // Active details item
  const itemsSource = pageType === 'deal' ? realDeals : realProducts;
  const activeItem = itemsSource.find(item => item.id === selectedItemId) || itemsSource[0] || null;

  // Safe title/description resolution
  const getTitleString = (t: any): string => {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (typeof t === 'object') {
      return t.pl || t.en || t.de || '';
    }
    return String(t);
  };

  const getSafePrice = (priceVal: any): number => {
    if (typeof priceVal === 'number') return priceVal;
    if (typeof priceVal === 'string') return parseFloat(priceVal) || 0;
    if (priceVal && typeof priceVal === 'object') {
      return priceVal.amount || priceVal.pln || parseFloat(priceVal.value) || 0;
    }
    return 0;
  };

  // Filter items based on category tree, search query, and price range
  const filteredItems = itemsSource.filter(item => {
    // 1. Search Query
    const titleVal = getTitleString(item.title || item.name);
    if (searchQuery && !titleVal.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // 2. Price Range
    const priceNum = getSafePrice(item.price);
    if (priceNum > priceRange) {
      return false;
    }

    // 3. Category Tree Filtering
    if (activeSubSubCat) {
      const matchSubSub = item.subsubcategoryId === activeSubSubCat || 
                          item.subsubcategory === activeSubSubCat ||
                          titleVal.toLowerCase().includes(activeSubSubCat.toLowerCase());
      if (!matchSubSub) return false;
    } else if (activeSubCat) {
      const matchSub = item.subcategoryId === activeSubCat || 
                       item.subcategory === activeSubCat ||
                       titleVal.toLowerCase().includes(activeSubCat.toLowerCase());
      if (!matchSub) return false;
    } else if (activeMainCat) {
      const matchMain = item.categoryId === activeMainCat || 
                        item.category === activeMainCat ||
                        titleVal.toLowerCase().includes(activeMainCat.toLowerCase()) ||
                        (item.storeName || '').toLowerCase().includes(activeMainCat.toLowerCase());
      if (!matchMain) return false;
    }
    
    return true;
  });

  // Sort items
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    }
    if (sortBy === 'price_asc') {
      return getSafePrice(a.price) - getSafePrice(b.price);
    }
    // Default 'hot' temperature sorting
    const tempA = typeof a.temperature === 'number' ? a.temperature : 0;
    const tempB = typeof b.temperature === 'number' ? b.temperature : 0;
    return tempB - tempA;
  });

  const resetCategoryFilter = () => {
    setActiveMainCat(null);
    setActiveSubCat(null);
    setActiveSubSubCat(null);
    setExpandedMain(null);
    setExpandedSub(null);
  };

  const handleCopyCode = () => {
    setCopiedCode(true);
    navigator.clipboard.writeText('OKAZJA2026');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Fake comments list styled dynamically per theme
  const mockComments = [
    {
      id: 'c1',
      author: 'ŁowcaCen88',
      avatar: '🦊',
      time: '12 min temu',
      text: 'Świetna oferta! Sam kupiłem ten model w zeszłym tygodniu za 200 zł więcej. Szczerze polecam za tę cenę.',
      likes: 24,
      replies: [
        {
          id: 'c1-1',
          author: 'Janusz_Biznesu',
          avatar: '🐗',
          time: '5 min temu',
          text: 'Czy wysyłka była darmowa? Na stronie sklepu widzę opłatę 15 zł.'
        }
      ]
    },
    {
      id: 'c2',
      author: 'Ola_Promocje',
      avatar: '🐱',
      time: '1 godz. temu',
      text: 'Kod rabatowy OKAZJA2026 działa bez problemu! W koszyku odejmuje dodatkowe 10%.',
      likes: 12,
      replies: []
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground space-y-4">
      {/* ==========================================================================
          1. STICKY PLAYGROUND CONTROL PANEL
          ========================================================================== */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b-2 border-border/80 p-4 shadow-md">
        <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl text-primary shrink-0">
              <Sliders className="h-5 w-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-tight">Kreator UX (Pełna Witryna)</h2>
              <p className="text-[10px] text-muted-foreground">Testuj widok listy i stronę szczegółów (Details) w 4 motywach</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* View State Switcher (List vs Details) */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">Widok strony</span>
              <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border/40">
                <button
                  onClick={() => setViewState('list')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                    viewState === 'list' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  Lista Ofert
                </button>
                <button
                  onClick={() => {
                    if (!selectedItemId && itemsSource[0]) {
                      setSelectedItemId(itemsSource[0].id);
                    }
                    setViewState('details');
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                    viewState === 'details' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  Strona Szczegółów (Details)
                </button>
              </div>
            </div>

            {/* Style Switcher */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">Motyw UX</span>
              <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border/40">
                {(['neo-brutalist', 'classic', 'playful', 'minimalist'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setStyleFamily(style)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all capitalize",
                      styleFamily === style 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {style === 'neo-brutalist' ? 'Neo-Brutalist (V1)' : 
                     style === 'classic' ? 'Classic (V2)' : 
                     style === 'playful' ? 'Playful (V3)' : 'Minimalist (V4)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Page Type Switcher */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">Typ strony</span>
              <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border/40">
                <button
                  onClick={() => setPageType('deal')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                    pageType === 'deal' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  Okazje
                </button>
                <button
                  onClick={() => setPageType('product')}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-black transition-all",
                    pageType === 'product' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                  )}
                >
                  Produkty
                </button>
              </div>
            </div>

            {/* Layout Mode Switcher (Grid, Masonry, List) - Only visible when List Page is active */}
            {viewState === 'list' && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">Układ siatki</span>
                <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border/40">
                  <button
                    onClick={() => setLayoutMode('grid')}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black transition-all",
                      layoutMode === 'grid' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    Siatka
                  </button>
                  <button
                    onClick={() => setLayoutMode('masonry')}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black transition-all",
                      layoutMode === 'masonry' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    Masonry
                  </button>
                  <button
                    onClick={() => setLayoutMode('list')}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black transition-all",
                      layoutMode === 'list' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    Lista
                  </button>
                </div>
              </div>
            )}

            {/* Density Switcher */}
            {viewState === 'list' && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-black">Zagęszczenie</span>
                <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border/40">
                  <button
                    onClick={() => setCardDensity('compact')}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black transition-all",
                      cardDensity === 'compact' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    Kompaktowe
                  </button>
                  <button
                    onClick={() => setCardDensity('expanded')}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-black transition-all",
                      cardDensity === 'expanded' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                    )}
                  >
                    Rozbudowane
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==========================================================================
          2. THEMED PAGE CONTAINER (Injects styleFamily dynamically)
          ========================================================================== */}
      <div 
        data-ux-style={styleFamily} 
        className={cn(
          "w-full transition-all duration-300",
          styleFamily === 'neo-brutalist' && "bg-[#f4f2ed] min-h-screen text-black dark:text-zinc-100 pb-2",
          styleFamily === 'classic' && "bg-background min-h-screen pb-2",
          styleFamily === 'playful' && "bg-gradient-to-br from-indigo-50/20 via-orange-50/20 to-purple-50/20 dark:from-zinc-950 dark:to-zinc-900 min-h-screen pb-2",
          styleFamily === 'minimalist' && "bg-background min-h-screen pb-2 font-mono text-zinc-900 dark:text-zinc-100"
        )}
      >
        <div className="container mx-auto px-4 space-y-8 pt-4">
          
          {/* ==========================================================================
              A. THEMED NAVBAR (NAGŁÓWEK) WITH REAL FUNCTIONALITY
              ========================================================================== */}
          <header className={cn(
            "w-full transition-all duration-300 flex items-center justify-between gap-4",
            styleFamily === 'neo-brutalist' && "border-4 border-black bg-yellow-400 p-4 shadow-[4px_4px_0px_0px_#000] rounded-xl",
            styleFamily === 'classic' && "border-b border-border/40 bg-card/70 backdrop-blur-md px-6 py-4 rounded-2xl shadow-sm",
            styleFamily === 'playful' && "bg-violet-600/90 text-white px-8 py-5 rounded-[28px] shadow-lg shadow-violet-500/20 hover:scale-[1.01] transition-transform",
            styleFamily === 'minimalist' && "border-b border-zinc-200 dark:border-zinc-800 py-3 text-xs tracking-wider"
          )}>
            
            {/* Logo Wrapper */}
            <div className="flex items-center gap-4 shrink-0">
              {styleFamily === 'minimalist' ? (
                <span className="text-sm uppercase font-mono tracking-widest font-black text-zinc-900 dark:text-white cursor-pointer" onClick={() => setViewState('list')}>
                  okazjeplus.pl
                </span>
              ) : (
                <div onClick={() => setViewState('list')} className="cursor-pointer">
                  <LogoSVGWrapper className="h-8 md:h-9 flex-shrink-0" />
                </div>
              )}
            </div>

            {/* Desktop AutocompleteSearch Input (REAL component wrapper styled according to active theme) */}
            <div className={cn(
              "hidden md:block flex-grow max-w-xl transition-all",
              styleFamily === 'neo-brutalist' && "[&_input]:border-2 [&_input]:border-black [&_input]:rounded-lg [&_input]:shadow-[2px_2px_0_0_#000] [&_input]:bg-white [&_input]:text-black",
              styleFamily === 'playful' && "[&_input]:rounded-full [&_input]:border-violet-300 [&_input]:bg-white/10 [&_input]:text-white [&_input]:placeholder:text-violet-200",
              styleFamily === 'minimalist' && "[&_input]:rounded-none [&_input]:border-zinc-300 dark:[&_input]:border-zinc-700 [&_input]:bg-transparent"
            )}>
              <AutocompleteSearch />
            </div>

            {/* Right Buttons: MiniCart, UserNav, ThemeToggle, and themed UxMenu Dropdown */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              
              {/* Theme Toggle (REAL theme switch button) */}
              <div className={cn(
                "transition-all",
                styleFamily === 'neo-brutalist' && "border-2 border-black rounded-lg bg-white text-black shadow-[2px_2px_0_0_#000]",
                styleFamily === 'playful' && "rounded-full bg-white/10 text-white",
                styleFamily === 'minimalist' && "border border-zinc-300 dark:border-zinc-700 rounded-none bg-transparent"
              )}>
                <ThemeToggle />
              </div>

              {/* Shopping Cart MiniCartBadge Widget */}
              <div className={cn(
                "relative transition-all flex items-center justify-center p-2 rounded-full",
                styleFamily === 'neo-brutalist' && "border-2 border-black bg-white text-black shadow-[2px_2px_0_0_#000]",
                styleFamily === 'classic' && "bg-muted hover:bg-muted/80 text-foreground",
                styleFamily === 'playful' && "bg-white/10 text-white hover:bg-white/20",
                styleFamily === 'minimalist' && "border border-zinc-300 dark:border-zinc-700 rounded-none bg-transparent"
              )}>
                <ShoppingBag className="h-4 w-4" />
                <MiniCartBadge />
              </div>

              {/* User Account Navigation */}
              <div className={cn(
                "transition-all shrink-0",
                styleFamily === 'neo-brutalist' && "[&_button]:border-2 [&_button]:border-black [&_button]:rounded-lg [&_button]:shadow-[2px_2px_0_0_#000]",
                styleFamily === 'playful' && "[&_button]:rounded-full",
                styleFamily === 'minimalist' && "[&_button]:rounded-none [&_button]:border [&_button]:border-zinc-300 dark:[&_button]:border-zinc-700"
              )}>
                <UserNav />
              </div>

              {/* Themed Switcher Trigger Button (puzzle button) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className={cn(
                      "transition-all shrink-0 font-extrabold",
                      styleFamily === 'neo-brutalist' && "border-2 border-black rounded-lg bg-orange-400 hover:bg-orange-500 text-black shadow-[2px_2px_0_0_#000]",
                      styleFamily === 'classic' && "rounded-xl border-border/40 hover:bg-muted text-foreground",
                      styleFamily === 'playful' && "rounded-full bg-yellow-400 hover:bg-yellow-500 text-violet-950 border-0 shadow-md",
                      styleFamily === 'minimalist' && "border border-zinc-300 dark:border-zinc-700 rounded-none bg-transparent text-foreground"
                    )}
                    aria-label="Warianty UX"
                  >
                    🧩
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>Szybki Wybór Motywu</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={() => setStyleFamily('classic')} 
                    className={cn("flex justify-between items-center", styleFamily === 'classic' && "font-bold text-primary")}
                  >
                    <span>Classic (V2)</span>
                    {styleFamily === 'classic' && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => setStyleFamily('neo-brutalist')} 
                    className={cn("flex justify-between items-center", styleFamily === 'neo-brutalist' && "font-bold text-primary")}
                  >
                    <span>Neo-Brutalist (V1)</span>
                    {styleFamily === 'neo-brutalist' && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => setStyleFamily('playful')} 
                    className={cn("flex justify-between items-center", styleFamily === 'playful' && "font-bold text-primary")}
                  >
                    <span>Playful (V3)</span>
                    {styleFamily === 'playful' && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => setStyleFamily('minimalist')} 
                    className={cn("flex justify-between items-center", styleFamily === 'minimalist' && "font-bold text-primary")}
                  >
                    <span>Minimalist (V4)</span>
                    {styleFamily === 'minimalist' && <Check className="h-3.5 w-3.5 text-primary" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

            </div>
          </header>

          {/* Mobile search bar (only visible on mobile screens) */}
          <div className="md:hidden w-full px-1">
            <AutocompleteSearch />
          </div>

          {/* ==========================================================================
              B. RENDERING BASED ON ACTIVE PAGE VIEW (LIST vs DETAILS)
              ========================================================================== */}
          {viewState === 'list' ? (
            /* ==========================================================================
                VIEW MODE 1: LIST PAGE OF OFFERS
                ========================================================================== */
            <>
              {/* Hero Banner */}
              <section className={cn(
                "w-full transition-all duration-300 text-left p-6 sm:p-10",
                styleFamily === 'neo-brutalist' && "border-4 border-black bg-white shadow-[6px_6px_0px_0px_#000] rounded-2xl space-y-4",
                styleFamily === 'classic' && "bg-gradient-to-r from-orange-500/10 via-red-500/5 to-transparent border border-border/40 p-8 rounded-3xl space-y-4 relative overflow-hidden",
                styleFamily === 'playful' && "bg-gradient-to-tr from-amber-400 to-orange-500 text-white rounded-[36px] shadow-xl p-8 sm:p-12 space-y-4 relative",
                styleFamily === 'minimalist' && "border border-zinc-200 dark:border-zinc-800 p-8 space-y-4 rounded-none"
              )}>
                {styleFamily === 'playful' && (
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-20 text-white pointer-events-none hidden md:block">
                    <Sparkles className="h-40 w-40 animate-pulse" />
                  </div>
                )}
                {styleFamily === 'classic' && (
                  <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-orange-500/10 via-transparent to-transparent pointer-events-none" />
                )}

                <div className="max-w-2xl space-y-3">
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1 font-bold text-xs uppercase tracking-wider",
                    styleFamily === 'neo-brutalist' && "border-2 border-black bg-yellow-300",
                    styleFamily === 'classic' && "bg-orange-500/10 text-orange-500 rounded-full",
                    styleFamily === 'playful' && "bg-white/20 text-white rounded-full",
                    styleFamily === 'minimalist' && "border border-zinc-400 text-zinc-500"
                  )}>
                    <Flame className="h-4 w-4 shrink-0" />
                    <span>Rzeczywiste Dane ({sortedItems.length} Wyniki)</span>
                  </div>

                  <h1 className={cn(
                    "font-headline tracking-tight leading-[1.1]",
                    styleFamily === 'neo-brutalist' && "text-3xl sm:text-5xl font-black uppercase text-black",
                    styleFamily === 'classic' && "text-3xl sm:text-4xl font-extrabold text-foreground",
                    styleFamily === 'playful' && "text-4xl sm:text-6xl font-black text-white drop-shadow-sm",
                    styleFamily === 'minimalist' && "text-2xl sm:text-3xl uppercase font-bold text-foreground font-mono"
                  )}>
                    {pageType === 'deal' ? 'Gorące Okazje' : 'Katalog Produktów'}
                  </h1>

                  <p className={cn(
                    "text-sm font-medium leading-relaxed max-w-xl",
                    styleFamily === 'neo-brutalist' && "text-zinc-700",
                    styleFamily === 'classic' && "text-muted-foreground",
                    styleFamily === 'playful' && "text-orange-50",
                    styleFamily === 'minimalist' && "text-zinc-500"
                  )}>
                    {pageType === 'deal' 
                      ? 'Przeglądaj najnowsze i najbardziej polecane okazje cenowe w internecie. Głosuj i komentuj razem ze społecznością.' 
                      : 'Porównuj specyfikacje oraz oferty cenowe z wielu sklepów. Znajduj najniższą cenę w 30 dni.'}
                  </p>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                
                {/* Categories & Filters Sidebar */}
                <aside className={cn(
                  "lg:col-span-3 space-y-6 lg:sticky lg:top-28 z-10 w-full transition-all duration-300",
                  styleFamily === 'neo-brutalist' && "border-4 border-black bg-white p-5 shadow-[4px_4px_0px_0px_#000] rounded-2xl",
                  styleFamily === 'classic' && "bg-card/40 border border-border/40 p-5 rounded-2xl shadow-sm",
                  styleFamily === 'playful' && "bg-white dark:bg-zinc-900 border-2 border-violet-100 dark:border-zinc-800 p-6 rounded-[28px] shadow-md",
                  styleFamily === 'minimalist' && "border border-zinc-200 dark:border-zinc-800 p-4 rounded-none text-xs"
                )}>
                  <div className="border-b border-border/40 pb-3 flex items-center justify-between">
                    <h3 className={cn(
                      "font-bold",
                      styleFamily === 'neo-brutalist' && "text-sm uppercase font-black tracking-wider",
                      styleFamily === 'classic' && "text-sm font-black",
                      styleFamily === 'playful' && "text-base font-black text-violet-700 dark:text-violet-400",
                      styleFamily === 'minimalist' && "text-[11px] uppercase tracking-wider text-zinc-500 font-bold"
                    )}>
                      Kategorie
                    </h3>
                    {(activeMainCat || activeSubCat || activeSubSubCat) && (
                      <button onClick={resetCategoryFilter} className="text-[10px] text-primary hover:underline font-bold">
                        Resetuj
                      </button>
                    )}
                  </div>

                  {/* Accordion Categories Tree */}
                  <div className="space-y-2">
                    {realCategories.map((cat) => {
                      const isMainExpanded = expandedMain === cat.id;
                      const isMainActive = activeMainCat === cat.id;

                      return (
                        <div key={cat.id} className="space-y-1">
                          <button
                            onClick={() => {
                              setExpandedMain(isMainExpanded ? null : cat.id);
                              setActiveMainCat(isMainActive ? null : cat.id);
                              setActiveSubCat(null);
                              setActiveSubSubCat(null);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition-all font-semibold",
                              styleFamily === 'neo-brutalist' && isMainActive && "bg-yellow-300 text-black border-2 border-black",
                              styleFamily === 'neo-brutalist' && !isMainActive && "hover:bg-zinc-100 text-black border-2 border-transparent",
                              styleFamily === 'classic' && isMainActive && "bg-primary/10 text-primary border border-primary/20",
                              styleFamily === 'classic' && !isMainActive && "hover:bg-muted text-muted-foreground hover:text-foreground",
                              styleFamily === 'playful' && isMainActive && "bg-violet-500 text-white rounded-full shadow-sm scale-102",
                              styleFamily === 'playful' && !isMainActive && "hover:bg-violet-50 text-muted-foreground hover:text-violet-700 dark:hover:bg-zinc-800 rounded-full",
                              styleFamily === 'minimalist' && isMainActive && "underline font-bold text-zinc-950 dark:text-white",
                              styleFamily === 'minimalist' && !isMainActive && "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 uppercase"
                            )}
                          >
                            <span className="flex items-center gap-2">
                              <span className="opacity-70">{cat.icon}</span>
                              <span>{cat.name}</span>
                            </span>
                            <span className="text-[10px] opacity-75 font-semibold flex items-center gap-1.5">
                              {cat.subcategories && cat.subcategories.length > 0 && (
                                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isMainExpanded ? "rotate-180" : "rotate-0")} />
                              )}
                            </span>
                          </button>

                          {/* Subcategories (2nd level) */}
                          {isMainExpanded && cat.subcategories && cat.subcategories.length > 0 && (
                            <div className="pl-4 pr-1 py-1 space-y-1 border-l border-border/60 ml-3">
                              {cat.subcategories.map((sub: any) => {
                                const isSubExpanded = expandedSub === sub.id;
                                const isSubActive = activeSubCat === sub.id;

                                return (
                                  <div key={sub.id} className="space-y-1">
                                    <button
                                      onClick={() => {
                                        setExpandedSub(isSubExpanded ? null : sub.id);
                                        setActiveSubCat(isSubActive ? null : sub.id);
                                        setActiveSubSubCat(null);
                                      }}
                                      className={cn(
                                        "w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[11px] text-left transition-colors font-medium",
                                        isSubActive 
                                          ? "text-primary bg-primary/5 font-bold" 
                                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                      )}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        {isSubExpanded ? <FolderOpen className="h-3 w-3 shrink-0" /> : <Folder className="h-3 w-3 shrink-0" />}
                                        <span>{sub.name}</span>
                                      </span>
                                      {sub.subcategories && sub.subcategories.length > 0 && (
                                        <ChevronDown className={cn("h-3 w-3 transition-transform", isSubExpanded ? "rotate-180" : "rotate-0")} />
                                      )}
                                    </button>

                                    {/* Sub-subcategories (3rd level) */}
                                    {isSubExpanded && sub.subcategories && sub.subcategories.length > 0 && (
                                      <div className="pl-4 py-1 space-y-1 border-l border-border/40 ml-2">
                                        {sub.subcategories.map((subsub: any) => {
                                          const isSubSubActive = activeSubSubCat === subsub.id;

                                          return (
                                            <button
                                              key={subsub.id}
                                              onClick={() => {
                                                setActiveSubSubCat(isSubSubActive ? null : subsub.id);
                                              }}
                                              className={cn(
                                                "w-full text-left px-2 py-1 rounded text-[10px] transition-colors",
                                                isSubSubActive
                                                  ? "text-primary font-black bg-primary/5"
                                                  : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/30"
                                              )}
                                            >
                                              • {subsub.name}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Price Slider */}
                  <div className="space-y-3 pt-4 border-t border-border/40">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-muted-foreground">Maks. Cena:</span>
                      <span className="text-primary">{priceRange} zł</span>
                    </div>
                    <input 
                      type="range" 
                      min="10" 
                      max="5000"
                      value={priceRange} 
                      onChange={(e) => setPriceRange(Number(e.target.value))}
                      className={cn(
                        "w-full cursor-pointer transition-all",
                        styleFamily === 'neo-brutalist' && "accent-black",
                        styleFamily === 'playful' && "accent-violet-500",
                        styleFamily === 'minimalist' && "accent-zinc-900"
                      )}
                    />
                  </div>
                </aside>

                {/* Right grid container */}
                <main className="lg:col-span-9 space-y-6 w-full">
                  {/* Sorting Bar */}
                  <div className={cn(
                    "flex flex-wrap items-center justify-between gap-4 p-4 transition-all duration-300",
                    styleFamily === 'neo-brutalist' && "border-4 border-black bg-white shadow-[3px_3px_0px_0px_#000] rounded-xl",
                    styleFamily === 'classic' && "bg-card border border-border/40 rounded-2xl shadow-sm",
                    styleFamily === 'playful' && "bg-violet-50 dark:bg-zinc-900/50 rounded-2xl border-2 border-violet-100/30 p-3",
                    styleFamily === 'minimalist' && "border border-zinc-200 dark:border-zinc-800 rounded-none text-xs"
                  )}>
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                      <span className="font-bold text-xs">Sortuj:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {['hot', 'newest', 'price_asc'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setSortBy(s as any)}
                          className={cn(
                            "px-2.5 py-1 text-xs font-bold transition-all rounded-lg",
                            sortBy === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {s === 'hot' ? 'Najgorętsze' : s === 'newest' ? 'Najnowsze' : 'Cena'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grid/List/Masonry Cards Showcase */}
                  {sortedItems.length > 0 ? (
                    <div className="w-full">
                      {layoutMode === 'masonry' ? (
                        <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-6 space-y-6 w-full">
                          {sortedItems.map((item, idx) => (
                            <div 
                              key={`${item.id}-${idx}`} 
                              className="break-inside-avoid mb-6 flex justify-center cursor-pointer"
                              onClick={() => { setSelectedItemId(item.id); setViewState('details'); }}
                            >
                              <CardVariantUniversal
                                type={pageType}
                                details={cardDensity}
                                layout="masonry"
                                hoverReveal={true}
                                styleFamily={styleFamily}
                                cardIndex={idx}
                                data={item}
                              />
                            </div>
                          ))}
                        </div>
                      ) : layoutMode === 'list' ? (
                        <div className="flex flex-col gap-4 w-full">
                          {sortedItems.map((item, idx) => (
                            <div 
                              key={`${item.id}-${idx}`}
                              className="cursor-pointer"
                              onClick={() => { setSelectedItemId(item.id); setViewState('details'); }}
                            >
                              <CardVariantUniversal
                                type={pageType}
                                details={cardDensity}
                                layout="list"
                                hoverReveal={true}
                                styleFamily={styleFamily}
                                cardIndex={idx}
                                data={item}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 justify-items-center w-full">
                          {sortedItems.map((item, idx) => (
                            <div 
                              key={`${item.id}-${idx}`}
                              className="cursor-pointer"
                              onClick={() => { setSelectedItemId(item.id); setViewState('details'); }}
                            >
                              <CardVariantUniversal
                                type={pageType}
                                details={cardDensity}
                                layout="grid"
                                hoverReveal={true}
                                styleFamily={styleFamily}
                                cardIndex={idx}
                                data={item}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-20 border border-dashed rounded-3xl">
                      Brak ofert spełniających kryteria
                    </div>
                  )}

                  {/* Load More */}
                  <div className="flex justify-center pt-8">
                    <button className={cn(
                      "font-black text-sm px-6 py-3 transition-all flex items-center gap-2",
                      styleFamily === 'neo-brutalist' && "border-4 border-black bg-yellow-400 shadow-[4px_4px_0_0_#000]",
                      styleFamily === 'classic' && "bg-primary text-primary-foreground rounded-2xl shadow-md",
                      styleFamily === 'playful' && "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full",
                      styleFamily === 'minimalist' && "border border-zinc-950 rounded-none uppercase"
                    )}>
                      Wczytaj kolejne
                    </button>
                  </div>
                </main>
              </div>
            </>
          ) : (
            /* ==========================================================================
                VIEW MODE 2: DETAILS PAGE OF SELECTED OFFER (ZERO MOCKUPS)
                ========================================================================== */
            <div className="space-y-8 animate-fade-in text-left">
              
              {/* Back to List breadcrumb button */}
              <div className="flex items-center justify-between">
                <nav className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <span className="cursor-pointer hover:underline" onClick={() => setViewState('list')}>Główna</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="cursor-pointer hover:underline" onClick={() => setViewState('list')}>
                    {pageType === 'deal' ? 'Gorące Okazje' : 'Produkty'}
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="text-foreground truncate max-w-[200px]">
                    {getTitleString(activeItem?.title || activeItem?.name)}
                  </span>
                </nav>
                <button 
                  onClick={() => setViewState('list')}
                  className={cn(
                    "text-xs font-bold px-4 py-1.5 transition-all flex items-center gap-1.5",
                    styleFamily === 'neo-brutalist' && "border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-yellow-300",
                    styleFamily === 'classic' && "bg-muted rounded-xl hover:bg-muted/80",
                    styleFamily === 'playful' && "bg-violet-100 text-violet-700 rounded-full hover:scale-105 active:scale-95",
                    styleFamily === 'minimalist' && "underline uppercase"
                  )}
                >
                  ← Powrót do listy
                </button>
              </div>

              {activeItem ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* Left Column: Image & Media Gallery */}
                  <div className={cn(
                    "lg:col-span-5 p-6 space-y-6 transition-all",
                    styleFamily === 'neo-brutalist' && "border-4 border-black bg-white shadow-[6px_6px_0_0_#000] rounded-2xl",
                    styleFamily === 'classic' && "bg-card border border-border/40 rounded-3xl shadow-sm",
                    styleFamily === 'playful' && "bg-white dark:bg-zinc-900 border-2 border-violet-100 dark:border-zinc-800 rounded-[32px] shadow-md",
                    styleFamily === 'minimalist' && "border border-zinc-200 dark:border-zinc-800 rounded-none"
                  )}>
                    <div className="relative aspect-square w-full bg-muted/10 flex items-center justify-center overflow-hidden rounded-xl">
                      <img 
                        src={activeItem.imageUrl || activeItem.image} 
                        alt={getTitleString(activeItem.title || activeItem.name)} 
                        className="object-contain w-full h-full max-h-[350px] p-4 transition-transform hover:scale-105 duration-300"
                      />
                    </div>
                    {/* Thumbs Gallery */}
                    <div className="flex gap-3 justify-center">
                      {[1, 2, 3].map((num) => (
                        <div 
                          key={num} 
                          className={cn(
                            "w-16 h-16 bg-muted/20 rounded-lg flex items-center justify-center p-1 cursor-pointer border hover:border-primary transition-all",
                            styleFamily === 'neo-brutalist' && "border-2 border-black rounded-md",
                            styleFamily === 'minimalist' && "rounded-none"
                          )}
                        >
                          <img 
                            src={activeItem.imageUrl || activeItem.image} 
                            alt="thumb" 
                            className="object-contain w-full h-full opacity-60 hover:opacity-100"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Transaction Details, Coupon, Specs */}
                  <div className={cn(
                    "lg:col-span-7 p-6 sm:p-8 space-y-6 transition-all text-left",
                    styleFamily === 'neo-brutalist' && "border-4 border-black bg-white shadow-[6px_6px_0_0_#000] rounded-2xl",
                    styleFamily === 'classic' && "bg-card border border-border/40 rounded-3xl shadow-sm",
                    styleFamily === 'playful' && "bg-white dark:bg-zinc-900 border-2 border-violet-100 dark:border-zinc-800 rounded-[32px] shadow-md",
                    styleFamily === 'minimalist' && "border border-zinc-200 dark:border-zinc-800 rounded-none"
                  )}>
                    {/* Author & Store details */}
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/20 pb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                          👨‍💻
                        </div>
                        <div>
                          <span className="font-bold text-xs block text-foreground">
                            {activeItem.storeName || activeItem.merchant || 'ŁowcaOkazji'}
                          </span>
                          <span className="text-[10px] text-muted-foreground block">
                            Wrzucano: 2 godziny temu
                          </span>
                        </div>
                      </div>

                      {/* Giant Temperature Widget */}
                      <div className={cn(
                        "flex items-center",
                        styleFamily === 'neo-brutalist' && "border-2 border-black bg-yellow-300 shadow-[2px_2px_0_0_#000] rounded-lg p-1.5 text-black font-black",
                        styleFamily === 'classic' && "bg-orange-500/10 text-orange-500 border border-orange-500/20 px-3 py-1.5 rounded-2xl font-black text-sm",
                        styleFamily === 'playful' && "bg-violet-100 text-violet-700 px-4 py-2 rounded-full font-black text-base shadow-sm",
                        styleFamily === 'minimalist' && "border border-zinc-900 px-2.5 py-1 text-xs"
                      )}>
                        <Flame className="h-4 w-4 shrink-0 mr-1 animate-pulse text-orange-500" />
                        <span>+{activeItem.temperature || 120}°</span>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className={cn(
                      "font-headline tracking-tight leading-tight",
                      styleFamily === 'neo-brutalist' && "text-xl sm:text-2xl font-black text-black",
                      styleFamily === 'classic' && "text-xl sm:text-2xl font-extrabold text-foreground",
                      styleFamily === 'playful' && "text-2xl sm:text-3xl font-black text-violet-950 dark:text-white",
                      styleFamily === 'minimalist' && "text-lg sm:text-xl uppercase font-bold text-foreground font-mono"
                    )}>
                      {getTitleString(activeItem.title || activeItem.name)}
                    </h2>

                    {/* Pricing details */}
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="text-3xl font-black text-foreground">
                        {getSafePrice(activeItem.price).toFixed(2)} zł
                      </span>
                      {activeItem.originalPrice && (
                        <>
                          <span className="text-sm text-muted-foreground line-through font-bold">
                            {getSafePrice(activeItem.originalPrice).toFixed(2)} zł
                          </span>
                          <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs px-2.5 py-1 rounded-lg">
                            Zaoszczędź {(getSafePrice(activeItem.originalPrice) - getSafePrice(activeItem.price)).toFixed(2)} zł (
                            {activeItem.discount || Math.round(((getSafePrice(activeItem.originalPrice) - getSafePrice(activeItem.price)) / getSafePrice(activeItem.originalPrice)) * 100)}%)
                          </span>
                        </>
                      )}
                    </div>

                    {/* Description Text */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Opis okazji</h4>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {getTitleString(activeItem.description || 'Ten model posiada fantastyczną relację ceny do jakości. Urządzenie oferuje świetne parametry techniczne w tym budżecie, idealnie dopasowane do codziennych zadań oraz rozrywki.')}
                      </p>
                    </div>

                    {/* Interactive Coupon Code Widget (Copy with Animation) */}
                    <div className={cn(
                      "p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border",
                      styleFamily === 'neo-brutalist' && "border-2 border-black bg-orange-100 rounded-lg shadow-[2px_2px_0_0_#000]",
                      styleFamily === 'classic' && "bg-card border-border/40 rounded-2xl shadow-sm",
                      styleFamily === 'playful' && "bg-violet-50 dark:bg-violet-950/20 border-violet-100/50 rounded-2xl",
                      styleFamily === 'minimalist' && "border-zinc-200 dark:border-zinc-800 rounded-none"
                    )}>
                      <div>
                        <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground block">Kupon rabatowy</span>
                        <span className="font-mono text-sm font-bold text-foreground block tracking-wider">OKAZJA2026</span>
                      </div>
                      <button 
                        onClick={handleCopyCode}
                        className={cn(
                          "w-full sm:w-auto font-black text-xs px-4 py-2 transition-all flex items-center justify-center gap-1.5",
                          copiedCode 
                            ? "bg-emerald-500 text-white border-transparent shadow-none" 
                            : (
                              styleFamily === 'neo-brutalist' ? "border-2 border-black bg-white shadow-[2px_2px_0_0_#000] hover:bg-yellow-300" :
                              styleFamily === 'classic' ? "bg-primary text-primary-foreground rounded-xl" :
                              styleFamily === 'playful' ? "bg-violet-600 text-white rounded-full hover:scale-105 active:scale-95" :
                              "border border-zinc-950 rounded-none uppercase"
                            )
                        )}
                      >
                        {copiedCode ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Skopiowano!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Skopiuj kod</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Tech Specifications (Only for Products/Specs) */}
                    {activeItem.specs && (
                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-black uppercase text-muted-foreground tracking-wider">Specyfikacja techniczna</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {Object.entries(activeItem.specs).map(([key, val]) => (
                            <div key={key} className="flex justify-between p-2 bg-muted/10 rounded-lg border border-border/10">
                              <span className="text-muted-foreground">{key}</span>
                              <span className="font-bold text-foreground">{String(val)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Primary CTA Action Button */}
                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                      <button className={cn(
                        "w-full font-black text-sm py-4 px-6 transition-all flex items-center justify-center gap-2",
                        styleFamily === 'neo-brutalist' && "border-4 border-black bg-yellow-400 shadow-[4px_4px_0_0_#000] hover:bg-yellow-500 active:translate-y-1 active:shadow-[1px_1px_0_0_#000]",
                        styleFamily === 'classic' && "bg-primary text-primary-foreground rounded-2xl shadow-lg hover:opacity-90 hover:scale-101",
                        styleFamily === 'playful' && "bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full shadow-lg shadow-violet-500/20 hover:scale-105 active:scale-95",
                        styleFamily === 'minimalist' && "border border-zinc-950 rounded-none bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-100 uppercase"
                      )}>
                        <span>Idź do sklepu</span>
                        <ExternalLink className="h-4 w-4 shrink-0" />
                      </button>
                      <button className={cn(
                        "w-full sm:w-auto font-black text-sm p-4 transition-all flex items-center justify-center gap-2",
                        styleFamily === 'neo-brutalist' && "border-4 border-black bg-white shadow-[4px_4px_0_0_#000] hover:bg-zinc-100 active:translate-y-1 active:shadow-[1px_1px_0_0_#000]",
                        styleFamily === 'classic' && "bg-muted rounded-2xl hover:bg-muted/80",
                        styleFamily === 'playful' && "bg-violet-100 text-violet-700 rounded-full hover:scale-105 active:scale-95",
                        styleFamily === 'minimalist' && "border border-zinc-200 dark:border-zinc-800 rounded-none uppercase"
                      )}>
                        <Share2 className="h-4 w-4 shrink-0" />
                        <span className="sm:hidden lg:inline">Udostępnij</span>
                      </button>
                    </div>

                  </div>

                  {/* ==========================================================================
                      C. COMMENTS SECTION (STYLOWANA DEDYKOWANIE POD MOTYW)
                      ========================================================================== */}
                  <div className="col-span-1 lg:col-span-12 space-y-6 pt-6">
                    <div className="border-b border-border/20 pb-2 flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-primary" />
                      <h3 className={cn(
                        "font-headline font-black",
                        styleFamily === 'neo-brutalist' && "text-xl text-black uppercase",
                        styleFamily === 'classic' && "text-xl text-foreground font-extrabold",
                        styleFamily === 'playful' && "text-2xl text-violet-950 dark:text-white",
                        styleFamily === 'minimalist' && "text-sm uppercase tracking-widest font-mono text-foreground"
                      )}>
                        Komentarze ({mockComments.length + 1})
                      </h3>
                    </div>

                    {/* Comments Feed list */}
                    <div className="space-y-4 text-left">
                      {mockComments.map((com) => (
                        <div key={com.id} className="space-y-3">
                          {/* Main Comment */}
                          <div className={cn(
                            "p-4 transition-all",
                            styleFamily === 'neo-brutalist' && "border-4 border-black bg-white shadow-[3px_3px_0_0_#000] rounded-xl",
                            styleFamily === 'classic' && "bg-card border border-border/40 rounded-2xl shadow-sm",
                            styleFamily === 'playful' && "bg-violet-50/50 dark:bg-zinc-900 border-2 border-violet-100/50 rounded-[24px]",
                            styleFamily === 'minimalist' && "border-b border-zinc-100 dark:border-zinc-800 py-3 rounded-none"
                          )}>
                            <div className="flex items-center justify-between mb-2 text-xs">
                              <span className="font-bold flex items-center gap-1.5">
                                <span>{com.avatar}</span>
                                <span>{com.author}</span>
                              </span>
                              <span className="text-muted-foreground">{com.time}</span>
                            </div>
                            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                              {com.text}
                            </p>
                            <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/10 text-xs">
                              <button className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors font-bold">
                                <ThumbsUp className="h-3.5 w-3.5" />
                                <span>{com.likes}</span>
                              </button>
                              <button className="text-muted-foreground hover:text-foreground font-bold">
                                Odpowiedz
                              </button>
                            </div>
                          </div>

                          {/* Reply Nesting */}
                          {com.replies.map((rep) => (
                            <div key={rep.id} className="pl-6 sm:pl-10 flex gap-2">
                              <CornerDownRight className="h-4 w-4 text-muted-foreground shrink-0 mt-2" />
                              <div className={cn(
                                "p-3 w-full transition-all",
                                styleFamily === 'neo-brutalist' && "border-2 border-black bg-[#faf8f5] shadow-[2px_2px_0_0_#000] rounded-lg",
                                styleFamily === 'classic' && "bg-card/60 border border-border/20 rounded-xl shadow-xs",
                                styleFamily === 'playful' && "bg-violet-50/20 dark:bg-zinc-900/60 border-2 border-violet-100/30 rounded-[20px]",
                                styleFamily === 'minimalist' && "border-b border-zinc-100/50 dark:border-zinc-800/50 py-2 rounded-none"
                              )}>
                                <div className="flex items-center justify-between mb-1.5 text-[11px]">
                                  <span className="font-bold flex items-center gap-1">
                                    <span>{rep.avatar}</span>
                                    <span>{rep.author}</span>
                                  </span>
                                  <span className="text-muted-foreground">{rep.time}</span>
                                </div>
                                <p className="text-xs text-foreground/90 leading-relaxed">
                                  {rep.text}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center py-20 border border-dashed rounded-3xl">
                  Brak wybranej oferty
                </div>
              )}
            </div>
          )}

          {/* ==========================================================================
              D. THEMED FOOTER (ROZBUDOWANA STOPKA)
              ========================================================================== */}
          <footer className={cn(
            "w-full transition-all duration-300 mt-12",
            styleFamily === 'neo-brutalist' && "border-4 border-black bg-orange-400 p-8 sm:p-12 text-black shadow-[4px_-4px_0px_0px_#000] rounded-2xl space-y-8",
            styleFamily === 'classic' && "border-t border-border/40 bg-card/60 backdrop-blur-md p-10 sm:p-12 rounded-3xl shadow-inner space-y-8",
            styleFamily === 'playful' && "bg-violet-950 text-violet-100 p-10 sm:p-14 rounded-[36px] shadow-2xl relative overflow-hidden space-y-8",
            styleFamily === 'minimalist' && "border-t border-zinc-200 dark:border-zinc-800 py-12 px-4 rounded-none space-y-8 text-xs tracking-wider font-mono text-zinc-500"
          )}>
            {/* Playful background decorative bubbles */}
            {styleFamily === 'playful' && (
              <div className="absolute right-0 bottom-0 top-0 w-1/4 opacity-5 bg-gradient-to-tr from-amber-400 to-violet-500 rounded-l-full pointer-events-none" />
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              
              {/* Logo + Newsletter */}
              <div className="md:col-span-5 space-y-4 text-left">
                {styleFamily === 'minimalist' ? (
                  <span className="text-xs uppercase font-mono tracking-widest font-bold text-zinc-950 dark:text-white">
                    okazjeplus.pl
                  </span>
                ) : (
                  <LogoSVGWrapper className="h-8 md:h-9 flex-shrink-0" />
                )}
                
                <p className="text-xs max-w-sm leading-relaxed">
                  Zapisz się na nasz newsletter, aby otrzymywać powiadomienia o najgorętszych promocjach bezpośrednio na skrzynkę e-mail. Zero spamu!
                </p>

                {/* Newsletter Form */}
                <div className="flex max-w-xs gap-2">
                  <input 
                    type="email" 
                    placeholder={styleFamily === 'minimalist' ? "TWÓJ E-MAIL..." : "Twój e-mail..."}
                    className={cn(
                      "px-3 py-2 text-xs w-full bg-background border outline-none",
                      styleFamily === 'neo-brutalist' && "border-2 border-black rounded-lg",
                      styleFamily === 'classic' && "border-border/60 rounded-xl",
                      styleFamily === 'playful' && "border-violet-700 bg-violet-900/50 text-white rounded-full",
                      styleFamily === 'minimalist' && "border-zinc-300 dark:border-zinc-700 rounded-none bg-transparent"
                    )}
                  />
                  <button className={cn(
                    "p-2 text-xs font-black shrink-0 transition-all flex items-center justify-center",
                    styleFamily === 'neo-brutalist' && "border-2 border-black bg-yellow-300 shadow-[2px_2px_0_0_#000] hover:bg-yellow-400 active:translate-y-0.5",
                    styleFamily === 'classic' && "bg-primary text-primary-foreground rounded-xl px-3",
                    styleFamily === 'playful' && "bg-yellow-400 text-violet-950 rounded-full hover:scale-105 active:scale-95 px-3.5",
                    styleFamily === 'minimalist' && "border border-zinc-900 dark:border-zinc-100 uppercase px-3"
                  )}>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Sitemap Links */}
              <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-6 text-left">
                {[
                  {
                    title: 'O nas',
                    links: ['Kim jesteśmy', 'Nasz audyt UX', 'Kontakt', 'Kariera']
                  },
                  {
                    title: 'Wsparcie',
                    links: ['Centrum pomocy', 'Zgłoś błąd', 'FAQ', 'Polityka prywatności']
                  },
                  {
                    title: 'Społeczność',
                    links: ['Dodaj okazję', 'Grupy dyskusyjne', 'Regulamin forum', 'Ranking łowców']
                  }
                ].map((col, idx) => (
                  <div key={idx} className="space-y-3">
                    <h4 className={cn(
                      "font-black uppercase tracking-wider text-xs",
                      styleFamily === 'neo-brutalist' && "border-b-2 border-black pb-1 mb-2",
                      styleFamily === 'classic' && "text-foreground",
                      styleFamily === 'playful' && "text-yellow-300",
                      styleFamily === 'minimalist' && "text-zinc-950 dark:text-white"
                    )}>
                      {col.title}
                    </h4>
                    <ul className="space-y-1.5">
                      {col.links.map((link) => (
                        <li key={link}>
                          <span className={cn(
                            "cursor-pointer text-xs font-semibold block transition-colors",
                            styleFamily === 'neo-brutalist' && "text-black hover:underline",
                            styleFamily === 'classic' && "text-muted-foreground hover:text-primary",
                            styleFamily === 'playful' && "text-violet-200 hover:text-white hover:translate-x-0.5 transform transition-transform duration-150",
                            styleFamily === 'minimalist' && "text-zinc-500 hover:text-zinc-950 dark:hover:text-white"
                          )}>
                            {link}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

            </div>

            {/* Sub-footer social + copyright */}
            <div className={cn(
              "flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t",
              styleFamily === 'neo-brutalist' && "border-black",
              styleFamily === 'classic' && "border-border/20",
              styleFamily === 'playful' && "border-violet-900/50",
              styleFamily === 'minimalist' && "border-zinc-200 dark:border-zinc-800 text-[10px]"
            )}>
              <p className="text-xs">
                © {new Date().getFullYear()} Okazje+ (Wersja UX Playground). Wszystkie prawa zastrzeżone.
              </p>

              {/* Social icons */}
              <div className="flex items-center gap-3">
                {[Facebook, Instagram, Twitter, Github].map((Icon, idx) => (
                  <span 
                    key={idx}
                    className={cn(
                      "cursor-pointer p-1.5 transition-all flex items-center justify-center",
                      styleFamily === 'neo-brutalist' && "border-2 border-black bg-white rounded-lg shadow-[1px_1px_0_0_#000] hover:bg-yellow-300",
                      styleFamily === 'classic' && "bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl",
                      styleFamily === 'playful' && "bg-violet-900 text-white rounded-full hover:scale-110 active:scale-90",
                      styleFamily === 'minimalist' && "text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                  </span>
                ))}
              </div>
            </div>
          </footer>

        </div>
      </div>
    </div>
  );
}
