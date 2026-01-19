// @ts-nocheck
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getRecommendedProductCores, getProductCoresByCategory, getCategories, getCategoriesWithContent, getDealById, getNavigationShowcase, getProductCoresByFilters } from '@/lib/data';
import { searchProductsTypesense } from '@/lib/search';
import { ProductCardBoundary } from '@/components/product-card-boundary';
import ProductListCard from '@/components/product-list-card';
import ProductCard from '@/components/product-card';
import { UnifiedFilterSidebar } from '@/components/unified-filter-sidebar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ChevronRight, Flame, Sparkles, ArrowRight, Filter, Loader2, Package, LayoutGrid, List, TrendingUp, Clock, Star, DollarSign, Truck, Tag, Calendar, Save, Bookmark } from 'lucide-react';
import { Category, ProductCore, Deal } from '@/lib/types';
import { useCurrency } from '@/lib/unified-currency';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { useTranslations, useLocale } from 'next-intl';
import { getLocalizedCategoryName, type SupportedLanguage } from '@/lib/i18n-utils';
import { useAuth } from '@/lib/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { UnifiedFilters, SortBy } from '@/lib/filter-config';

const toSearchableText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
};

type SortOption = 'recommended' | 'newest' | 'rating' | 'price_asc' | 'price_desc' | 'hot' | 'discount_desc';

interface SavedFilter {
  name: string;
  sortBy: SortOption;
  filters: UnifiedFilters;
  categoryId?: string;
  subcategorySlug?: string;
}

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const t = useTranslations('products');
  const locale = useLocale();
  const { user } = useAuth();
  const mainCategoryParam = searchParams.get('mainCategory');
  const subCategoryParam = searchParams.get('subCategory');
  const subSubCategoryParam = searchParams.get('subSubCategory');
  const [products, setProducts] = useState<ProductCore[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedSubSubcategory, setSelectedSubSubcategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dealOfTheDay, setDealOfTheDay] = useState<Deal | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [cardDensity, setCardDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [unifiedFilters, setUnifiedFilters] = useState<UnifiedFilters>({});
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [showEmptyCategories, setShowEmptyCategories] = useState(false);
  const { formatPrice } = useCurrency();
  const lang = (locale as SupportedLanguage) || 'pl';

  // Wczytaj kategorie i ustaw z URL
  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [fetchedCategories, showcaseConfig] = await Promise.all([
          showEmptyCategories ? getCategories() : getCategoriesWithContent('products'),
          getNavigationShowcase(),
        ]);
        
        setCategories(fetchedCategories);
        
        // Sprawdź parametry URL
        if (mainCategoryParam && fetchedCategories.length > 0) {
          const foundCategory = fetchedCategories.find(c => c.id === mainCategoryParam || c.slug === mainCategoryParam);
          if (foundCategory) {
            setSelectedCategory(foundCategory);
            if (subSubCategoryParam) {
              const parentSub = foundCategory.subcategories?.find((s) =>
                s.subcategories?.some((ss) => ss.slug === subSubCategoryParam || ss.id === subSubCategoryParam)
              );
              const matchingSubSub = parentSub?.subcategories?.find((ss) => ss.slug === subSubCategoryParam || ss.id === subSubCategoryParam);
              if (parentSub && matchingSubSub) {
                setSelectedSubcategory(parentSub.slug || parentSub.id);
                setSelectedSubSubcategory(matchingSubSub.slug || matchingSubSub.id || subSubCategoryParam);
              }
            } else if (subCategoryParam) {
              setSelectedSubcategory(subCategoryParam);
              setSelectedSubSubcategory(null);
            }
          }
          // Jeśli nie znaleziono kategorii z URL, pozostaw null (wszystkie produkty)
        }
        // Jeśli brak parametrów URL, pozostaw null (wszystkie produkty)

        // Pobierz deal of the day
        if (showcaseConfig?.dealOfTheDayId) {
          const deal = await getDealById(showcaseConfig.dealOfTheDayId);
          setDealOfTheDay(deal);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [mainCategoryParam, subCategoryParam, showEmptyCategories]);

  useEffect(() => {
    try {
      const savedView = localStorage.getItem('products_view_mode');
      if (savedView === 'list' || savedView === 'grid') {
        setViewMode(savedView);
      }
      const savedDensity = localStorage.getItem('products_density');
      if (savedDensity === 'compact' || savedDensity === 'comfortable') {
        setCardDensity(savedDensity);
      }
    } catch {}
  }, []);

  // Pobierz ProductCore przy zmianie kategorii / subkategorii / wyszukiwaniu / filtrów
  useEffect(() => {
    let cancelled = false;
    async function fetchProducts() {
      setIsLoading(true);
      try {
        const q = searchTerm.trim();
        if (q.length > 1) {
          // Wyszukiwanie - szukaj w ProductCore via Typesense
          const results = await searchProductsTypesense(q, {
            mainCategorySlug: selectedCategory?.slug || selectedCategory?.id,
            subCategorySlug: selectedSubcategory || undefined,
            subSubCategorySlug: selectedSubSubcategory || undefined,
            limit: 100,
          });
          if (!cancelled) setProducts(results || []);
        } else {
          // Użyj zunifiowanych filtrów do pobierania ProductCore
          const filterConfig = {
            ...unifiedFilters,
            categoryId: selectedCategory?.id || selectedCategory?.slug || unifiedFilters.categoryId,
            subCategorySlug: selectedSubcategory || undefined,
            subSubCategorySlug: selectedSubSubcategory || undefined,
          };
          const filteredProducts = await getProductCoresByFilters(filterConfig, sortBy, 100);
          if (!cancelled) setProducts(filteredProducts);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    const t = setTimeout(fetchProducts, 250); // drobny debounce
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedCategory, selectedSubcategory, selectedSubSubcategory, searchTerm, unifiedFilters, sortBy]);

  useEffect(() => {
    try { localStorage.setItem('products_view_mode', viewMode); } catch {}
  }, [viewMode]);

  useEffect(() => {
    try { localStorage.setItem('products_density', cardDensity); } catch {}
  }, [cardDensity]);

  // Filtruj produkty na podstawie wyszukiwania (szukaj w title/shortDescription)
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const needle = searchTerm.toLowerCase();
    return products.filter((product) => {
      const title = typeof product.title === 'object'
        ? (product.title.pl || product.title.en || product.title.de || '').toLowerCase()
        : (product.title || '').toString().toLowerCase();
      const desc = typeof product.shortDescription === 'object'
        ? (product.shortDescription.pl || product.shortDescription.en || product.shortDescription.de || '').toLowerCase()
        : (product.shortDescription || '').toString().toLowerCase();
      return title.includes(needle) || desc.includes(needle);
    });
  }, [products, searchTerm]);

  // Helper function to extract price from ProductCore
  const getProductPrice = (product: ProductCore): number => {
    return product.bestPrice?.amount || 0;
  };

  // Infinite scroll hook - ładuje kolejne produkty przy scrollowaniu
  // Filtry i sortowanie są teraz obsługiwane przez getProductCoresByFilters w useEffect
  const {
    displayedItems: displayedProducts,
    hasMore,
    isLoading: isLoadingMore,
    observerTarget,
  } = useInfiniteScroll({
    items: products, // Bezpośrednio z products (już przefiltrowane i posortowane)
    initialItemsPerPage: 20,
    loadMoreThreshold: 500,
  });

  // Unified currency formatting handled via useCurrency()

  const gridWrapperClass = cardDensity === 'compact'
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

  const listWrapperClass = cardDensity === 'compact' ? 'space-y-3' : 'space-y-4';
  const cardWrapperClass = cardDensity === 'compact' ? 'scale-[0.99] text-sm' : '';

  // Derived quick filters for UI based on unifiedFilters
  const quickFilters = {
    freeShipping: !!unifiedFilters.promo?.freeShippingOnly,
    topRated: (unifiedFilters.rating?.minStars || 0) >= 4.5,
    bestsellers: sortBy === 'popularity',
  };

  // Load saved filters for logged-in users
  useEffect(() => {
    if (!user?.uid) return;
    async function loadSavedFilters() {
      try {
        const docRef = doc(db, 'users', user!.uid, 'preferences', 'productFilters');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSavedFilters(docSnap.data().filters || []);
        }
      } catch (error: any) {
        // Silent fallback - filters are optional
        if (process.env.NODE_ENV === 'development') {
          console.info('[savedFilters] Could not load product filters:', error?.message);
        }
      }
    }
    loadSavedFilters();
  }, [user]);

  // Functions for saved filters
  const saveCurrentFilter = async () => {
    if (!user?.uid) {
      toast.error('Zaloguj się, aby zapisać filtry');
      return;
    }

    const filterName = prompt('Podaj nazwę dla tego zestawu filtrów:');
    if (!filterName) return;

    const newFilter: SavedFilter = {
      name: filterName,
      sortBy,
      filters: unifiedFilters,
      categoryId: selectedCategory?.id,
      subcategorySlug: selectedSubcategory || undefined,
    };

    try {
      const updatedFilters = [...savedFilters, newFilter];
      const docRef = doc(db, 'users', user.uid, 'preferences', 'productFilters');
      await setDoc(docRef, { filters: updatedFilters });
      setSavedFilters(updatedFilters);
      toast.success(`Filtr "${filterName}" został zapisany!`);
    } catch (error) {
      console.error('Error saving filter:', error);
      toast.error('Nie udało się zapisać filtra');
    }
  };

  const loadSavedFilter = (filter: SavedFilter) => {
    setSortBy(filter.sortBy);
    setUnifiedFilters(filter.filters || {});
    
    if (filter.categoryId) {
      const cat = categories.find(c => c.id === filter.categoryId);
      if (cat) {
        setSelectedCategory(cat);
      }
    }
    if (filter.subcategorySlug) {
      setSelectedSubcategory(filter.subcategorySlug);
      setSelectedSubSubcategory(null);
    } else {
      setSelectedSubcategory(null);
      setSelectedSubSubcategory(null);
    }
    
    toast.success(`Załadowano filtr: ${filter.name}`);
  };

  const deleteSavedFilter = async (filterName: string) => {
    if (!user?.uid) return;

    try {
      const updatedFilters = savedFilters.filter(f => f.name !== filterName);
      const docRef = doc(db, 'users', user.uid, 'preferences', 'productFilters');
      await setDoc(docRef, { filters: updatedFilters });
      setSavedFilters(updatedFilters);
      toast.success('Filtr został usunięty');
    } catch (error) {
      console.error('Error deleting filter:', error);
      toast.error('Nie udało się usunąć filtra');
    }
  };

  // Sidebar Content (reusable for desktop and mobile)
  // Refs dla auto-scroll do wybranej kategorii
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const allCategoriesButtonRef = useRef<HTMLButtonElement>(null);
  const categoryButtonRefs = useRef<Record<string, HTMLButtonElement>>({});
  const subcategoryButtonRefs = useRef<Record<string, HTMLButtonElement>>({});
  const subSubcategoryButtonRefs = useRef<Record<string, HTMLButtonElement>>({});

  // Auto-scroll do wybranej kategorii/podkategorii gdy się zmienia
  useEffect(() => {
    // Upewnij się, że to wykonuje się tylko na kliencie i po hydration
    if (typeof window === 'undefined') return;
    
    const scrollTimer = requestAnimationFrame(() => {
      const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
      const scrollTo = (el?: HTMLElement | null) => {
        if (el && scrollContainer) {
          const buttonTop = el.offsetTop;
          scrollContainer.scrollTop = Math.max(0, buttonTop - 80);
        }
      };

      if (selectedSubSubcategory && subSubcategoryButtonRefs.current[selectedSubSubcategory]) {
        scrollTo(subSubcategoryButtonRefs.current[selectedSubSubcategory]);
        return;
      }

      if (selectedSubcategory && subcategoryButtonRefs.current[selectedSubcategory]) {
        scrollTo(subcategoryButtonRefs.current[selectedSubcategory]);
        return;
      }

      if (selectedCategory && categoryButtonRefs.current[selectedCategory.id]) {
        scrollTo(categoryButtonRefs.current[selectedCategory.id]);
        return;
      }

      if (!selectedCategory && allCategoriesButtonRef.current) {
        scrollTo(allCategoriesButtonRef.current);
      }
    });
    
    return () => cancelAnimationFrame(scrollTimer);
  }, [selectedCategory, selectedSubcategory, selectedSubSubcategory]);

  // Sortuj kategorie - wybrana kategoria na górze
  const sortedCategories = useMemo(() => {
    if (!selectedCategory) return categories;
    const selected = categories.find(c => c.id === selectedCategory.id);
    if (!selected) return categories;
    return [selected, ...categories.filter(c => c.id !== selectedCategory.id)];
  }, [categories, selectedCategory]);

  // Sortuj podkategorie - wybrana podkategoria na górze
  const sortedSubcategories = useMemo(() => {
    if (!selectedCategory?.subcategories) return [];
    if (!selectedSubcategory) return selectedCategory.subcategories;
    const selected = selectedCategory.subcategories.find(s => (s.slug || s.id) === selectedSubcategory);
    if (!selected) return selectedCategory.subcategories;
    return [selected, ...selectedCategory.subcategories.filter(s => (s.slug || s.id) !== selectedSubcategory)];
  }, [selectedCategory, selectedSubcategory]);

  // Sortuj pod-podkategorie - wybrana pod-podkategoria na górze
  const sortedSubSubcategories = useMemo(() => {
    const currentSub = sortedSubcategories.find(s => (s.slug || s.id) === selectedSubcategory);
    if (!currentSub?.subcategories) return [];
    if (!selectedSubSubcategory) return currentSub.subcategories;
    const selected = currentSub.subcategories.find(ss => (ss.slug || ss.id) === selectedSubSubcategory);
    if (!selected) return currentSub.subcategories;
    return [selected, ...currentSub.subcategories.filter(ss => (ss.slug || ss.id) !== selectedSubSubcategory)];
  }, [sortedSubcategories, selectedSubcategory, selectedSubSubcategory]);

  const SidebarContent = () => (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-headline text-lg font-semibold">{t('categories.title')}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowEmptyCategories(!showEmptyCategories)}
          className="text-xs"
        >
          {showEmptyCategories ? t('categories.hideEmpty') : t('categories.showAll')}
        </Button>
      </div>
      <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-200px)] lg:h-[600px] pr-1">
        {/* Przycisk "Wszystkie" */}
        <div className="mb-1">
          <button
            ref={allCategoriesButtonRef}
            onClick={() => {
              setSelectedCategory(null);
              setSelectedSubcategory(null);
              setSelectedSubSubcategory(null);
              setIsMobileSidebarOpen(false);
            }}
            className={cn(
              "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group",
              !selectedCategory
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted"
            )}
          >
            <Package className="h-5 w-5" />
            <span className="font-medium flex-1">{t('categories.allProducts')}</span>
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform",
              !selectedCategory ? "rotate-90" : "group-hover:translate-x-1"
            )} />
          </button>
        </div>

        {sortedCategories.map((category) => {
          const isActive = selectedCategory?.id === category.id;
          return (
            <div key={category.id} className="mb-1">
              <button
                ref={(el) => {
                  if (el) categoryButtonRefs.current[category.id] = el;
                }}
                onClick={() => {
                  setSelectedCategory(category);
                  setSelectedSubcategory(null);
                  setSelectedSubSubcategory(null);
                  setIsMobileSidebarOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                )}
              >
                {category.icon && <span className="text-xl">{category.icon}</span>}
                <span className="font-medium flex-1">{getLocalizedCategoryName(category, lang)}</span>
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  isActive ? "rotate-90" : "group-hover:translate-x-1"
                )} />
              </button>
              {isActive && sortedSubcategories && sortedSubcategories.length > 0 && (
                <div className="mt-1 ml-2 space-y-1 border-l pl-3">
                  {sortedSubcategories.map((sub) => {
                    const subSlug = sub.slug || sub.id;
                    const subActive =
                      selectedSubcategory === subSlug ||
                      (!!selectedSubSubcategory && sub.subcategories?.some((ss) => (ss.slug || ss.id) === selectedSubSubcategory));
                    return (
                      <div key={sub.slug || sub.id} className="space-y-1">
                        <button
                          ref={(el) => {
                            if (el) subcategoryButtonRefs.current[subSlug] = el;
                          }}
                          onClick={() => {
                            const willSelect = selectedSubcategory !== subSlug;
                            setSelectedSubcategory(willSelect ? subSlug : null);
                            setSelectedSubSubcategory(null);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                            subActive
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted"
                          )}
                        >
                          {sub.icon && <span className="text-base">{sub.icon}</span>}
                          <span className="flex-1 truncate">{getLocalizedCategoryName(sub as any, lang)}</span>
                          {(sub.subcategories && sub.subcategories.length > 0) && (
                            <ChevronRight className={cn(
                              "h-3 w-3 transition-transform flex-shrink-0",
                              subActive ? "rotate-90" : ""
                            )} />
                          )}
                          {sub.highlight && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">Nowość</Badge>
                          )}
                        </button>

                        {/* Pod-podkategorie (trzeci poziom) */}
                        {subActive && sub.subcategories && sub.subcategories.length > 0 && selectedSubcategory === subSlug && (
                          <div className="ml-2 space-y-1 border-l border-muted-foreground/30 pl-3">
                            {sub.subcategories.map((subsub) => {
                              const subSubSlug = subsub.slug || subsub.id;
                              return (
                                <button
                                  key={subSubSlug}
                                  ref={(el) => {
                                    if (el) subSubcategoryButtonRefs.current[subSubSlug] = el;
                                  }}
                                  onClick={() => {
                                    setSelectedCategory(category);
                                    setSelectedSubcategory(subSlug);
                                    setSelectedSubSubcategory(subSubSlug);
                                    setIsMobileSidebarOpen(false);
                                  }}
                                  className={cn(
                                    "w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors",
                                    selectedSubSubcategory === subSubSlug
                                      ? "bg-primary/5 text-primary font-medium"
                                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                  )}
                                >
                                  {subsub.icon && <span className="text-sm">{subsub.icon}</span>}
                                  <span className="flex-1 truncate">{getLocalizedCategoryName(subsub as any, lang)}</span>
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
      </ScrollArea>
    </div>
  );

  return (
    <div className="w-full">
      {/* Breadcrumb */}
      <div className="border-b bg-muted/30">
        <div className="page-container py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              {t('breadcrumbs.home')}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{t('breadcrumbs.catalog')}</span>
            {selectedCategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{getLocalizedCategoryName(selectedCategory, lang)}</span>
              </>
            )}
            {selectedSubcategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{selectedSubcategory}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Mega Menu Style */}
      <div className="border-b bg-background">
        <div className="page-container">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 py-4 lg:py-6">
            {/* Mobile Filter Button */}
            <div className="lg:hidden col-span-1 mb-2">
              <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Filter className="mr-2 h-4 w-4" />
                    {t('filters.title')}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[80vw] p-0 flex flex-col">
                  <ScrollArea className="h-full flex-1">
                    <div className="p-4 space-y-6">
                      {/* Categories */}
                      <div suppressHydrationWarning>
                        <SidebarContent />
                      </div>

                      {/* Separator */}
                      <div className="border-t pt-4" />

                      {/* Unified Filters (Mobile) */}
                      <UnifiedFilterSidebar
                        filters={unifiedFilters}
                        onFiltersChange={setUnifiedFilters}
                        sortBy={sortBy}
                        onSortChange={setSortBy}
                        categoryId={selectedCategory?.id}
                        isMobile={true}
                        onClose={() => setIsMobileSidebarOpen(false)}
                      />
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>
            </div>

            {/* Left Sidebar - Categories & Unified Filters (Desktop only) */}
            <div className="hidden lg:block lg:col-span-3 space-y-6">
              {/* Categories */}
              <div suppressHydrationWarning>
                <SidebarContent />
              </div>

              {/* Separator */}
              <div className="border-t pt-4" />

              {/* Unified Filters Sidebar */}
              <UnifiedFilterSidebar
                filters={unifiedFilters}
                onFiltersChange={setUnifiedFilters}
                sortBy={sortBy}
                onSortChange={setSortBy}
                categoryId={selectedCategory?.id}
                isMobile={false}
              />
            </div>

            {/* Center Content - Subcategories & Products */}
            <div className="col-span-1 lg:col-span-9">
              {/* Search Bar */}
              <div className="mb-4 lg:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('filters.search')}
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Subcategories przeniesione do lewego panelu */}

              {/* Filters Card */}
              <Card className="mb-4 lg:mb-6">
                <CardContent className="p-4 space-y-4">
                  {/* Sortowanie i Zakres ceny */}
                  <div className="flex flex-wrap gap-3">
                    {/* Sortowanie */}
                    <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                      <SelectTrigger className="w-[200px]">
                        <TrendingUp className="mr-2 h-4 w-4" />
                        <SelectValue placeholder={t('filters.sort')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="recommended">{t('filters.sortOptions.popular')}</SelectItem>
                        <SelectItem value="newest">{t('filters.sortOptions.newest')}</SelectItem>
                        <SelectItem value="rating">{t('filters.sortOptions.rating')}</SelectItem>
                        <SelectItem value="price_asc">{t('filters.sortOptions.price_asc')}</SelectItem>
                        <SelectItem value="price_desc">{t('filters.sortOptions.price_desc')}</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Zakres ceny */}
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg bg-muted/40">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">{t('filters.priceRange')}</span>
                      <Input
                        type="number"
                        placeholder={t('filters.min')}
                        value={unifiedFilters.priceRange?.min ?? 0}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setUnifiedFilters(prev => ({
                            ...prev,
                            priceRange: {
                              min: val,
                              max: prev.priceRange?.max ?? 10000,
                              step: prev.priceRange?.step ?? 100,
                            },
                          }));
                        }}
                        className="h-8 w-20 text-xs"
                      />
                      <span className="text-muted-foreground">-</span>
                      <Input
                        type="number"
                        placeholder={t('filters.max')}
                        value={unifiedFilters.priceRange?.max ?? 10000}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 10000;
                          setUnifiedFilters(prev => ({
                            ...prev,
                            priceRange: {
                              min: prev.priceRange?.min ?? 0,
                              max: val,
                              step: prev.priceRange?.step ?? 100,
                            },
                          }));
                        }}
                        className="h-8 w-20 text-xs"
                      />
                      <span className="text-sm">PLN</span>
                    </div>
                  </div>

                  {/* Quick filters - chipy */}
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant={quickFilters.freeShipping ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => setUnifiedFilters(prev => ({
                        ...prev,
                        promo: { ...prev.promo, freeShippingOnly: !prev.promo?.freeShippingOnly },
                      }))}
                    >
                      <Truck className="h-3 w-3 mr-1" />
                      {t('filters.quickFilters.freeShipping')}
                    </Badge>
                    <Badge
                      variant={quickFilters.topRated ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => setUnifiedFilters(prev => ({
                        ...prev,
                        rating: quickFilters.topRated ? undefined : { ...(prev.rating || {}), minStars: 4.5 },
                      }))}
                    >
                      <Star className="h-3 w-3 mr-1" />
                      {t('filters.quickFilters.topRated')}
                    </Badge>
                    <Badge
                      variant={quickFilters.bestsellers ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => setSortBy(quickFilters.bestsellers ? 'relevance' : 'popularity')}
                    >
                      <Flame className="h-3 w-3 mr-1" />
                      {t('filters.quickFilters.bestsellers')}
                    </Badge>
                  </div>

                  {/* Zapisane filtry */}
                  {user && savedFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Bookmark className="h-3 w-3" />
                        {t('filters.savedLabel')}
                      </span>
                      {savedFilters.map((filter) => (
                        <Badge
                          key={filter.name}
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80 transition-colors group"
                        >
                          <span onClick={() => loadSavedFilter(filter)}>{filter.name}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteSavedFilter(filter.name);
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Przycisk zapisywania filtra */}
                  {user && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={saveCurrentFilter}
                      className="w-full sm:w-auto"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {t('filters.saveFilter')}
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Products Grid */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="font-headline text-base font-semibold">
                    {t('list.titleWithCount', { count: products.length })}
                  </h3>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="xl:hidden"
                      onClick={() => setInsightsOpen(true)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      Panel rekomendacji
                    </Button>
                    <div className="flex items-center gap-1 border rounded-lg p-1">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setViewMode('grid')}
                      >
                        <LayoutGrid className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">{t('viewMode.grid')}</span>
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setViewMode('list')}
                      >
                        <List className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">{t('viewMode.list')}</span>
                      </Button>
                    </div>

                    {/* Density Toggle */}
                    <div className="flex items-center gap-1 border rounded-lg p-1">
                      <Button
                        variant={cardDensity === 'comfortable' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setCardDensity('comfortable')}
                      >
                        {t('density.standard')}
                      </Button>
                      <Button
                        variant={cardDensity === 'compact' ? 'default' : 'ghost'}
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => setCardDensity('compact')}
                      >
                        {t('density.compact')}
                      </Button>
                    </div>
                  </div>
                </div>
                {isLoading ? (
                  <div className={cn(
                    viewMode === 'list' ? listWrapperClass : gridWrapperClass
                  )}>
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className={cn(
                        "bg-muted animate-pulse rounded-lg",
                        viewMode === 'list'
                          ? 'h-48'
                          : cardDensity === 'compact' ? 'h-80' : 'h-96'
                      )} />
                    ))}
                  </div>
                ) : products.length > 0 ? (
                  <>
                    {viewMode === 'list' ? (
                      <div className={listWrapperClass}>
                        {displayedProducts.map((product) => (
                          <div key={product.id} className={cardWrapperClass}>
                            <ProductCard product={product as any} viewMode="list" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={gridWrapperClass}>
                        {displayedProducts.map((product) => (
                          <div key={product.id} className={cardWrapperClass}>
                            <ProductCard product={product as any} viewMode="grid" />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Infinite scroll loader */}
                    {hasMore && (
                      <div ref={observerTarget} className="mt-6 flex justify-center items-center py-4">
                        {isLoadingMore && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>{t('loadingMore')}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Status info */}
                    {!hasMore && displayedProducts.length > 0 && (
                      <div className="mt-6 text-center text-sm text-muted-foreground">
                        <p>{t('showing', { count: filteredProducts.length })}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">{t('empty.inCategory')}</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>

      {(dealOfTheDay || selectedCategory?.promo) && (
        <Sheet open={insightsOpen} onOpenChange={setInsightsOpen}>
          <SheetTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="hidden xl:inline-flex fixed right-3 top-1/2 -translate-y-1/2 rounded-l-full shadow-lg"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Panel rekomendacji
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[340px] sm:w-[420px] overflow-y-auto">
            <div className="space-y-6">
              {dealOfTheDay && (
                <Card className="overflow-hidden border-2 border-primary/20">
                  <CardContent className="p-0">
                    <div className="relative">
                      {dealOfTheDay.image && (
                        <Image
                          src={dealOfTheDay.image}
                          alt={dealOfTheDay.title}
                          width={300}
                          height={200}
                          className="w-full aspect-video object-cover"
                        />
                      )}
                      <Badge className="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-orange-500 text-white">
                        <Flame className="mr-1 h-3 w-3" />
                        Deal Dnia
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <h4 className="font-headline font-semibold line-clamp-2">
                        {dealOfTheDay.title}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">
                          {formatPrice(typeof (dealOfTheDay as any).price === 'number'
                            ? (dealOfTheDay as any).price
                            : ((dealOfTheDay as any).price?.amount || 0))}
                        </span>
                        <Badge variant="secondary">
                          <Flame className="mr-1 h-3 w-3" />
                          {dealOfTheDay.temperature} pkt
                        </Badge>
                      </div>
                      <Button asChild className="w-full" size="sm">
                        <Link href={`/deals/${dealOfTheDay.id}`}>
                          Zobacz ofertę
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {selectedCategory?.promo && (
                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    {selectedCategory.promo.image && (
                      <div className="relative">
                        <Image
                          src={selectedCategory.promo.image}
                          alt={selectedCategory.promo.title}
                          width={300}
                          height={150}
                          className="w-full aspect-[2/1] object-cover"
                        />
                        {selectedCategory.promo.badge && (
                          <Badge className="absolute top-2 right-2">
                            {selectedCategory.promo.badge}
                          </Badge>
                        )}
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <h4 className="font-headline font-semibold">
                        {selectedCategory.promo.title}
                      </h4>
                      {selectedCategory.promo.description && (
                        <p className="text-sm text-muted-foreground">
                          {selectedCategory.promo.description}
                        </p>
                      )}
                      {selectedCategory.promo.link && (
                        <Button asChild variant="outline" size="sm" className="w-full">
                          <Link href={selectedCategory.promo.link}>
                            {selectedCategory.promo.cta || 'Zobacz więcej'}
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Najlepsze oferty</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sprawdź nasze polecane produkty z najwyższymi ocenami
                    </p>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href="/deals">
                        Zobacz okazje
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

export default function ProductsPage() {
  return <ProductsPageContent />;
}
