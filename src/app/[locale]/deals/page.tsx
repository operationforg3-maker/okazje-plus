// @ts-nocheck
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, useRef } from 'react';
import { getHotDeals, getCategories, getNavigationShowcase, getProductById, getDealsByCategory } from '@/lib/data';
import { searchDealsTypesense } from '@/lib/search';
import { Deal, Category, Product } from '@/lib/types';
import DealCard from '@/components/deal-card';
import DealListCard from '@/components/deal-list-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Search, ChevronRight, Flame, Sparkles, ArrowRight, Filter, Menu, LayoutGrid, List, TrendingUp, Clock, Star, DollarSign, Package, Truck, Tag, Calendar, Save, Bookmark, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { FEATURES } from '@/lib/config';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getLocalizedCategoryName, type SupportedLanguage } from '@/lib/i18n-utils';
// Umożliwiamy nawigację przez query params z mega‑menu (mainCategory, subCategory, sort, q)

type ViewMode = 'list' | 'grid';
type SortOption = 'hottest' | 'newest' | 'price_asc' | 'price_desc' | 'discount';
type DealTypeFilter = 'all' | 'sale' | 'coupon' | 'freebie' | 'pricing-error' | 'cashback' | 'bundle';

interface SavedFilter {
  name: string;
  sortBy: SortOption;
  priceRange: [number, number];
  quickFilters: {
    freeShipping: boolean;
    bigDiscount: boolean;
    today: boolean;
    verified: boolean;
  };
  categoryId?: string;
  subcategorySlug?: string;
}

export default function DealsPage() {
  const { user } = useAuth();
  const t = useTranslations('deals');
  const locale = useLocale();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedSubSubcategory, setSelectedSubSubcategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [productOfTheDay, setProductOfTheDay] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('hottest');
  const [typeFilter, setTypeFilter] = useState<DealTypeFilter>('all');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [quickFilters, setQuickFilters] = useState({
    freeShipping: false,
    bigDiscount: false,
    today: false,
    verified: false,
  });
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Helper: unify postedAt to timestamp (ms)
  const toTimestamp = (value: any): number => {
    if (!value) return 0;
    // Firestore Timestamp
    if (typeof value === 'object') {
      if (typeof (value as any).toDate === 'function') {
        try { return (value as any).toDate().getTime(); } catch {}
      }
      if (typeof (value as any).seconds === 'number') {
        return ((value as any).seconds * 1000) + Math.floor(((value as any).nanoseconds || 0) / 1e6);
      }
    }
    // ISO string or number
    const num = Date.parse(value);
    return isNaN(num) ? 0 : num;
  };

  // Wczytaj zapisany tryb widoku przy pierwszym renderze
  useEffect(() => {
    try {
      const savedView = localStorage.getItem('deals_view_mode');
      if (savedView === 'list' || savedView === 'grid') {
        setViewMode(savedView);
      }
    } catch {}
  }, []);

  // Załaduj zapisane filtry użytkownika
  useEffect(() => {
    if (!user?.uid) return;
    async function loadSavedFilters() {
      try {
        const docRef = doc(db, 'users', user!.uid, 'preferences', 'dealFilters');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSavedFilters(docSnap.data().filters || []);
        } else {
          // Brak dokumentu – nie loguj głośno
          if (process.env.NODE_ENV === 'development') {
            console.info('[savedFilters] brak dokumentu dealFilters – pomijam');
          }
        }
      } catch (error: any) {
        const msg = error?.message || String(error);
        // Permission / brak indeksu – tylko jednorazowo
        // Dodaj symbol na window z bezpiecznym rzutowaniem
        const w: any = window as any;
        if (!w.__filtersWarned) w.__filtersWarned = new Set();
        if (!w.__filtersWarned.has('loadSavedFilters')) {
          console.warn('[savedFilters] nie udało się wczytać filtrów (cichy fallback):', msg);
          w.__filtersWarned.add('loadSavedFilters');
        }
      }
    }
    loadSavedFilters();
  }, [user]);

  // Wczytaj zapisaną kategorię / podkategorię gdy tylko będą dostępne kategorie
  // Najpierw sprawdź query params, potem dopiero localStorage (jeśli brak query)
  useEffect(() => {
    if (categories.length === 0) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const mainParam = params.get('mainCategory');
      const subParam = params.get('subCategory');
      const subSubParam = params.get('subSubCategory');
      const sortParam = params.get('sort');
      const qParam = params.get('q');
      const typeParam = params.get('type');
      const freeShippingParam = params.get('freeShipping');

      if (qParam) setSearchTerm(qParam);
      if (sortParam === 'newest' || sortParam === 'hottest' || sortParam === 'price_asc' || sortParam === 'price_desc' || sortParam === 'discount') {
        setSortBy(sortParam as any);
      }
      // Ustawienie filtra typu okazji z URL (np. type=coupon|freebie|cashback)
      if (FEATURES.DEALS_TYPE_FILTER && typeParam) {
        const allowed = new Set<DealTypeFilter>(['all','sale','coupon','freebie','pricing-error','cashback','bundle']);
        if (allowed.has(typeParam as DealTypeFilter)) {
          setTypeFilter(typeParam as DealTypeFilter);
        }
      }
      // Ustawienie darmowej dostawy z URL (freeShipping=1)
      if (FEATURES.DEALS_FREE_SHIPPING_FILTER && freeShippingParam === '1') {
        setQuickFilters(prev => ({ ...prev, freeShipping: true }));
      }

      if (mainParam) {
        const byId = categories.find(c => c.id === mainParam || c.slug === mainParam);
        if (byId) {
          setSelectedCategory(byId);
          if (subSubParam) {
            const parentSub = byId.subcategories?.find((s) =>
              s.subcategories?.some((ss) => ss.slug === subSubParam || ss.id === subSubParam)
            );
            const matchingSubSub = parentSub?.subcategories?.find((ss) => ss.slug === subSubParam || ss.id === subSubParam);
            if (parentSub && matchingSubSub) {
              setSelectedSubcategory(parentSub.slug || parentSub.id);
              setSelectedSubSubcategory(matchingSubSub.slug || matchingSubSub.id || subSubParam);
            }
          } else if (subParam) {
            const hasSub = byId.subcategories?.some(s => s.slug === subParam || s.id === subParam);
            if (hasSub) {
              setSelectedSubcategory(subParam);
              setSelectedSubSubcategory(null);
            }
          }
          return; // Query params mają pierwszeństwo przed localStorage
        }
      }
      // Jeśli brak query params – fallback do localStorage
      const savedCatId = localStorage.getItem('deals_selected_category');
      if (savedCatId) {
        const found = categories.find(c => c.id === savedCatId);
        if (found) {
          setSelectedCategory(found);
          const savedSub = localStorage.getItem('deals_selected_subcategory');
          const savedSubSub = localStorage.getItem('deals_selected_subsubcategory');
          if (savedSubSub && found.subcategories?.length) {
            const parentSub = found.subcategories.find((s) =>
              s.subcategories?.some((ss) => ss.slug === savedSubSub || ss.id === savedSubSub)
            );
            const matchingSubSub = parentSub?.subcategories?.find((ss) => ss.slug === savedSubSub || ss.id === savedSubSub);
            if (parentSub && matchingSubSub) {
              setSelectedSubcategory(parentSub.slug || parentSub.id);
              setSelectedSubSubcategory(matchingSubSub.slug || matchingSubSub.id || savedSubSub);
              return;
            }
          }
          if (savedSub) {
            setSelectedSubcategory(savedSub);
            setSelectedSubSubcategory(null);
          }
        }
      }
    } catch {}
  }, [categories]);

  // Persistuj view mode
  useEffect(() => {
    try { localStorage.setItem('deals_view_mode', viewMode); } catch {}
  }, [viewMode]);

  // Persistuj kategorię
  useEffect(() => {
    try {
      if (selectedCategory) {
        localStorage.setItem('deals_selected_category', selectedCategory.id);
      } else {
        localStorage.removeItem('deals_selected_category');
      }
    } catch {}
  }, [selectedCategory]);

  // Persistuj podkategorię
  useEffect(() => {
    try {
      if (selectedSubcategory) {
        localStorage.setItem('deals_selected_subcategory', selectedSubcategory);
      } else {
        localStorage.removeItem('deals_selected_subcategory');
      }
    } catch {}
  }, [selectedSubcategory]);

  useEffect(() => {
    try {
      if (selectedSubSubcategory) {
        localStorage.setItem('deals_selected_subsubcategory', selectedSubSubcategory);
      } else {
        localStorage.removeItem('deals_selected_subsubcategory');
      }
    } catch {}
  }, [selectedSubSubcategory]);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [fetchedCategories, showcaseConfig, hotDeals] = await Promise.all([
          getCategories(),
          getNavigationShowcase(),
          getHotDeals(100), // Pobierz gorące okazje na start
        ]);
        
        setCategories(fetchedCategories);
        setDeals(hotDeals); // Ustaw deals od razu
        // NIE ustawiamy selectedCategory - pozostaw null aby pokazać wszystkie

        // Pobierz product of the day
        if (showcaseConfig?.productOfTheDayId) {
          const product = await getProductById(showcaseConfig.productOfTheDayId);
          setProductOfTheDay(product);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Pobierz deals przy zmianie kategorii / subkategorii / wyszukiwaniu
  useEffect(() => {
    let cancelled = false;
    async function fetchDeals() {
      setIsLoading(true);
      try {
        const q = searchTerm.trim();
        if (q.length > 1) {
          // Wyszukiwanie
          const results = await searchDealsTypesense(q, {
            mainCategorySlug: selectedCategory?.id,
            subCategorySlug: selectedSubcategory || undefined,
            subSubCategorySlug: selectedSubSubcategory || undefined,
            limit: 100,
          });
          if (!cancelled) setDeals(results);
        } else if (selectedCategory) {
          // Filtrowanie według kategorii
          const categoryDeals = await getDealsByCategory(
            selectedCategory.id,
            selectedSubcategory || undefined,
            selectedSubSubcategory || undefined,
            100
          );
          if (!cancelled) setDeals(categoryDeals);
        } else {
          // Brak filtrów - pokaż gorące okazje
          const hotDeals = await getHotDeals(100);
          if (!cancelled) setDeals(hotDeals);
        }
      } catch (error) {
        console.error('Error fetching deals:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    const t = setTimeout(fetchDeals, 250); // debounce
    return () => { cancelled = true; clearTimeout(t); };
  }, [selectedCategory, selectedSubcategory, selectedSubSubcategory, searchTerm]);

  // Sortowanie i filtrowanie lokalne (po pobraniu z API)
  const filteredAndSortedDeals = useMemo(() => {
    return deals
      .filter((deal) => {
        if (FEATURES.DEALS_TYPE_FILTER && typeFilter !== 'all') {
          if ((deal.dealType || 'sale') !== typeFilter) return false;
        }
        if (quickFilters.freeShipping && deal.shippingCost !== 0) return false;
        if (quickFilters.bigDiscount && deal.originalPrice) {
          const discount = ((deal.originalPrice - deal.price) / deal.originalPrice) * 100;
          if (discount < 50) return false;
        }
        if (quickFilters.today) {
          const ts = toTimestamp((deal as any).postedAt);
          if (!ts) return false;
          const today = new Date();
          const d = new Date(ts);
          if (
            today.getFullYear() !== d.getFullYear() ||
            today.getMonth() !== d.getMonth() ||
            today.getDate() !== d.getDate()
          ) {
            return false;
          }
        }
        if (quickFilters.verified && !deal.merchant) return false;

        if (deal.price < priceRange[0] || deal.price > priceRange[1]) return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'hottest':
            return b.temperature - a.temperature;
          case 'newest':
            return toTimestamp((b as any).postedAt) - toTimestamp((a as any).postedAt);
          case 'price_asc':
            return a.price - b.price;
          case 'price_desc':
            return b.price - a.price;
          case 'discount':
            const discountA = a.originalPrice ? ((a.originalPrice - a.price) / a.originalPrice) * 100 : 0;
            const discountB = b.originalPrice ? ((b.originalPrice - b.price) / b.originalPrice) * 100 : 0;
            return discountB - discountA;
          default:
            return 0;
        }
      });
  }, [deals, typeFilter, quickFilters, priceRange, sortBy]);

  // Infinite scroll hook - ładuje kolejne deale przy scrollowaniu
  const {
    displayedItems: displayedDeals,
    hasMore,
    isLoading: isLoadingMore,
    observerTarget,
  } = useInfiniteScroll({
    items: filteredAndSortedDeals,
    initialItemsPerPage: 20,
    loadMoreThreshold: 500,
  });

  // Statystyki
  const stats = {
    total: filteredAndSortedDeals.length,
    avgDiscount: filteredAndSortedDeals.reduce((acc, deal) => {
      if (!deal.originalPrice) return acc;
      const discount = ((deal.originalPrice - deal.price) / deal.originalPrice) * 100;
      return acc + discount;
    }, 0) / filteredAndSortedDeals.length || 0,
    bestDeal: filteredAndSortedDeals.reduce((best, deal) => {
      if (!deal.originalPrice) return best;
      const discount = ((deal.originalPrice - deal.price) / deal.originalPrice) * 100;
      const bestDiscount = best?.originalPrice ? ((best.originalPrice - best.price) / best.originalPrice) * 100 : 0;
      return discount > bestDiscount ? deal : best;
    }, filteredAndSortedDeals[0]),
  };

  const priceFormatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  });

  // Funkcja zapisywania filtrów
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
      priceRange,
      quickFilters,
      categoryId: selectedCategory?.id,
      subcategorySlug: selectedSubcategory || undefined,
    };

    try {
      const updatedFilters = [...savedFilters, newFilter];
      const docRef = doc(db, 'users', user.uid, 'preferences', 'dealFilters');
      await setDoc(docRef, { filters: updatedFilters });
      setSavedFilters(updatedFilters);
      toast.success(`Filtr "${filterName}" został zapisany!`);
    } catch (error) {
      console.error('Error saving filter:', error);
      toast.error('Nie udało się zapisać filtra');
    }
  };

  // Funkcja wczytywania zapisanego filtra
  const loadSavedFilter = (filter: SavedFilter) => {
    setSortBy(filter.sortBy);
    setPriceRange(filter.priceRange);
    setQuickFilters(filter.quickFilters);
    
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

  // Funkcja usuwania zapisanego filtra
  const deleteSavedFilter = async (filterName: string) => {
    if (!user?.uid) return;

    try {
      const updatedFilters = savedFilters.filter(f => f.name !== filterName);
      const docRef = doc(db, 'users', user.uid, 'preferences', 'dealFilters');
      await setDoc(docRef, { filters: updatedFilters });
      setSavedFilters(updatedFilters);
      toast.success('Filtr został usunięty');
    } catch (error) {
      console.error('Error deleting filter:', error);
      toast.error('Nie udało się usunąć filtra');
    }
  };

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
          const top = el.offsetTop;
          scrollContainer.scrollTop = Math.max(0, top - 80);
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

  // Sidebar Content (reusable for desktop and mobile) – na wzór strony produktów
  const SidebarContent = () => (
    <div className="space-y-2">
      <h2 className="font-headline text-lg font-semibold mb-4">Kategorie</h2>
      <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-200px)] lg:h-[600px] pr-1">
        {/* All categories */}
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
            <Flame className="h-5 w-5" />
            <span className="font-medium flex-1">{t('sidebar.allDeals')}</span>
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform",
              !selectedCategory ? "rotate-90" : "group-hover:translate-x-1"
            )} />
          </button>
        </div>

        {categories.map((category) => {
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
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {category.icon && <span className="text-xl">{category.icon}</span>}
                <span className="font-medium flex-1">{getLocalizedCategoryName(category, locale as SupportedLanguage)}</span>
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  isActive ? "rotate-90" : "group-hover:translate-x-1"
                )} />
              </button>

              {isActive && category.subcategories && category.subcategories.length > 0 && (
                <div className="mt-1 ml-2 space-y-1 border-l pl-3">
                  {category.subcategories.map((sub) => {
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
                          <span className="flex-1 truncate">{getLocalizedCategoryName(sub as any, locale as SupportedLanguage)}</span>
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
                        {subActive && sub.subcategories && sub.subcategories.length > 0 && (
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
                                  <span className="flex-1 truncate">{getLocalizedCategoryName(subsub as any, locale as SupportedLanguage)}</span>
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
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Strona główna
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">Okazje</span>
            {selectedCategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{selectedCategory.name}</span>
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
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 py-4 lg:py-6">
            {/* Mobile Filter Button */}
            <div className="lg:hidden col-span-1 mb-2">
              <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Filter className="mr-2 h-4 w-4" />
                    Kategorie i filtry
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[300px] p-6">
                  <SidebarContent />
                </SheetContent>
              </Sheet>
            </div>

            {/* Left Sidebar - Categories (Desktop only) */}
            <div className="hidden lg:block lg:col-span-3">
              <SidebarContent />
            </div>

            {/* Center Content - Subcategories & Deals */}
            <div className="col-span-1 lg:col-span-6">
              {/* Search Bar */}
              <div className="mb-4 lg:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Szukaj w okazjach..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Statystyki */}
              {stats.total > 0 && (
                <div className="mb-4 lg:mb-6 grid grid-cols-3 gap-2">
                  <Card className="p-3">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Okazje</p>
                        <p className="text-lg font-bold">{stats.total}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Śr. zniżka</p>
                        <p className="text-lg font-bold">{stats.avgDiscount.toFixed(0)}%</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Najlepszy</p>
                        <p className="text-lg font-bold">
                          {stats.bestDeal?.originalPrice ? 
                            `${(((stats.bestDeal.originalPrice - stats.bestDeal.price) / stats.bestDeal.originalPrice) * 100).toFixed(0)}%` 
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Filtry i sortowanie */}
              <div className="mb-4 space-y-3">
                {/* Sortowanie */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Sortuj według" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hottest">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Najgorętsze
                        </div>
                      </SelectItem>
                      <SelectItem value="newest">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Najnowsze
                        </div>
                      </SelectItem>
                      <SelectItem value="price_asc">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Cena: rosnąco
                        </div>
                      </SelectItem>
                      <SelectItem value="price_desc">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Cena: malejąco
                        </div>
                      </SelectItem>
                      <SelectItem value="discount">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Największa zniżka
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Zakres ceny */}
                  <div className="flex-1 flex items-center gap-2 px-3 py-2 border rounded-lg">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">Cena:</span>
                    <Input
                      type="number"
                      placeholder="Min"
                      value={priceRange[0]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPriceRange([val, priceRange[1]]);
                      }}
                      className="h-8 w-20 text-xs"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      value={priceRange[1]}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 10000;
                        setPriceRange([priceRange[0], val]);
                      }}
                      className="h-8 w-20 text-xs"
                    />
                    <span className="text-sm">zł</span>
                  </div>
                </div>

                {/* Quick filters - chipy */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={quickFilters.freeShipping ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setQuickFilters(prev => ({ ...prev, freeShipping: !prev.freeShipping }))}
                  >
                    <Truck className="h-3 w-3 mr-1" />
                    {t('filters.quickFilters.freeShipping')}
                  </Badge>
                  {FEATURES.DEALS_TYPE_FILTER && (
                    <Badge
                      variant={typeFilter === 'coupon' ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => setTypeFilter(prev => prev === 'coupon' ? 'all' as DealTypeFilter : 'coupon')}
                    >
                      🎟️ {t('filters.quickFilters.couponOnly')}
                    </Badge>
                  )}
                  {FEATURES.DEALS_TYPE_FILTER && (
                    <Badge
                      variant={typeFilter === 'freebie' ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => setTypeFilter(prev => prev === 'freebie' ? 'all' as DealTypeFilter : 'freebie')}
                    >
                      🆓 {t('filters.quickFilters.freebies')}
                    </Badge>
                  )}
                  <Badge
                    variant={quickFilters.bigDiscount ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setQuickFilters(prev => ({ ...prev, bigDiscount: !prev.bigDiscount }))}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {t('filters.quickFilters.bigDiscount')}
                  </Badge>
                  <Badge
                    variant={quickFilters.today ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setQuickFilters(prev => ({ ...prev, today: !prev.today }))}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    {t('filters.quickFilters.todayOnly')}
                  </Badge>
                  <Badge
                    variant={quickFilters.verified ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setQuickFilters(prev => ({ ...prev, verified: !prev.verified }))}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    {t('filters.quickFilters.verifiedStores')}
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
                    Zapisz obecne filtry
                  </Button>
                )}
              </div>

              {/* Deals List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-headline text-base font-semibold">
                    🔥 Okazje ({filteredAndSortedDeals.length})
                  </h3>
                  
                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 border rounded-lg p-1">
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-8 px-3"
                    >
                      <List className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Lista</span>
                    </Button>
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="h-8 px-3"
                    >
                      <LayoutGrid className="h-4 w-4 mr-1" />
                      <span className="hidden sm:inline">Kafelki</span>
                    </Button>
                  </div>
                </div>
                {isLoading ? (
                  <div className={cn(
                    viewMode === 'list' ? "space-y-4" : "grid grid-cols-1 sm:grid-cols-2 gap-4"
                  )}>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={cn(
                        "bg-muted animate-pulse rounded-lg",
                        viewMode === 'list' ? "h-48" : "h-96"
                      )} />
                    ))}
                  </div>
                ) : filteredAndSortedDeals.length > 0 ? (
                  <>
                    {viewMode === 'list' ? (
                      <div className="space-y-4">
                        {displayedDeals.map((deal) => (
                          <DealListCard key={deal.id} deal={deal} />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {displayedDeals.map((deal) => (
                          <DealCard key={deal.id} deal={deal} />
                        ))}
                      </div>
                    )}
                    
                    {/* Infinite scroll loader */}
                    {hasMore && (
                      <div ref={observerTarget} className="mt-6 flex justify-center items-center py-4">
                        {isLoadingMore && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Ładowanie kolejnych okazji...</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Status info */}
                    {!hasMore && displayedDeals.length > 0 && (
                      <div className="mt-6 text-center text-sm text-muted-foreground">
                        <p>Pokazano wszystkie {filteredAndSortedDeals.length} okazji</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Brak okazji w tej kategorii</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar - Product of the Day & Promo (Hidden on mobile/tablet) */}
            <div className="hidden xl:block xl:col-span-3 space-y-6">
              {/* Product of the Day */}
              {productOfTheDay && (
                <Card className="overflow-hidden border-2 border-primary/20">
                  <CardContent className="p-0">
                    <div className="relative">
                      {productOfTheDay.image && (
                        <Image
                          src={productOfTheDay.image}
                          alt={productOfTheDay.name}
                          width={300}
                          height={200}
                          className="w-full aspect-video object-cover"
                        />
                      )}
                      <Badge className="absolute top-2 left-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Produkt Dnia
                      </Badge>
                    </div>
                    <div className="p-4 space-y-3">
                      <h4 className="font-headline font-semibold line-clamp-2">
                        {productOfTheDay.name}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-primary">
                          {priceFormatter.format(productOfTheDay.price)}
                        </span>
                        {productOfTheDay.ratingCard && (
                          <Badge variant="secondary">
                            ⭐ {productOfTheDay.ratingCard.average.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                      <Button asChild className="w-full" size="sm">
                        <Link href={`/products/${productOfTheDay.id}`}>
                          Zobacz produkt
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Promoted Category */}
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

              {/* Quick Stats */}
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Gorące okazje</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sprawdź produkty z najwyższymi ocenami i opiniami
                    </p>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href="/products">
                        Zobacz produkty
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

