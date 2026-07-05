// @ts-nocheck
'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState, useRef, useCallback, Suspense } from 'react';
import { getCategories, getCategoriesWithContent, getNavigationShowcase, getProductById, getDealsByCategory, getDealsCount, getDealsByFilters } from '@/lib/data';
import { searchDealsTypesense } from '@/lib/search';
import { retryWithBackoff, isOnline, waitForOnline, isOfflineError } from '@/lib/offline-utils';
import { Deal, Category, Product } from '@/lib/types';
import { UnifiedFilterSidebar } from '@/components/unified-filter-sidebar';
import { UnifiedFilters, SortBy } from '@/lib/filter-config';
import DealCard from '@/components/deal-card';
import DealListCard from '@/components/deal-list-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Search, ChevronRight, ChevronDown, Flame, Sparkles, ArrowRight, Filter, Menu, LayoutGrid, List as ListIcon, Columns, TrendingUp, Clock, Star, DollarSign, Package, Truck, Tag, Calendar, Save, Bookmark, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { List as VirtualizedList } from 'react-window';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SortSelect } from '@/components/sort-select';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { FEATURES } from '@/lib/config';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { getLocalizedCategoryName, type SupportedLanguage } from '@/lib/i18n-utils';
import { getCategoryStyle } from '@/lib/category-theme';
import { extractDealPriceAmount } from '@/lib/price-utils';
import { useUX } from '@/context/UXContext';
// Umożliwiamy nawigację przez query params z mega‑menu (mainCategory, subCategory, sort, q)

type ViewMode = 'list' | 'grid';
type SortOption = 'hottest' | 'newest' | 'price_asc' | 'price_desc' | 'discount';
type DealTypeFilter = 'all' | 'sale' | 'coupon' | 'freebie' | 'pricing-error' | 'cashback' | 'bundle';
type DealStatusView = 'approved' | 'waiting_room';

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
  return (
    <Suspense fallback={
      <div className="page-container py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-12 bg-muted rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="h-96 bg-muted rounded md:col-span-1"></div>
            <div className="space-y-4 md:col-span-3">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    }>
      <DealsPageContent />
    </Suspense>
  );
}

function DealsPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const t = useTranslations('deals');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const lang = (locale as SupportedLanguage) || 'pl';
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedSubSubcategory, setSelectedSubSubcategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [productOfTheDay, setProductOfTheDay] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [totalDealsCount, setTotalDealsCount] = useState<number | null>(null);
  const { viewMode, setViewMode } = useUX();
  
  // Server-side infinite scroll states
  const [limit, setLimit] = useState(24);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Dynamic Category UX styling: override global theme when browsing a themed category
  useEffect(() => {
    if (!selectedCategory) return;
    const catTheme = (selectedCategory as any).uxTheme || (selectedCategory as any).layoutType;
    if (catTheme) {
      const root = document.documentElement;
      root.setAttribute('data-theme', catTheme);
      root.classList.forEach((cls) => {
        if (cls.startsWith('theme-')) root.classList.remove(cls);
      });
      root.classList.add(`theme-${catTheme}`);

      return () => {
        // Restore previous global theme
        try {
          const stored = localStorage.getItem('uxSettings');
          const originalTheme = stored ? JSON.parse(stored).themeFamily : 'classic';
          const effectiveTheme = originalTheme === 'classic' ? 'default' : originalTheme;
          root.setAttribute('data-theme', effectiveTheme);
          root.classList.forEach((cls) => {
            if (cls.startsWith('theme-')) root.classList.remove(cls);
          });
          if (effectiveTheme !== 'default') {
            root.classList.add(`theme-${effectiveTheme}`);
          }
        } catch {}
      };
    }
  }, [selectedCategory]);

  const [cardDensity, setCardDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [unifiedFilters, setUnifiedFilters] = useState<UnifiedFilters>({
    priceRange: { min: 0, max: 15000 },
    priceLimitMin: 0,
    priceLimitMax: 50000,
    rating: undefined,
    availability: 'all',
  });
  
  // Sort from URL
  const sortBy = (searchParams.get('sort') as SortBy) || 'hot';
  const router = useRouter();
  
  const setSortBy = useCallback((val: SortBy) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('sort', val);
      router.push(`${window.location.pathname}?${params.toString()}`);
  }, [router, searchParams]);
  
  const [typeFilter, setTypeFilter] = useState<DealTypeFilter>('all');
  const [dealStatusView, setDealStatusView] = useState<DealStatusView>('approved');
  const [quickFilters, setQuickFilters] = useState({
    freeShipping: false,
    bigDiscount: false,
    today: false,
    verified: false,
  });
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileListHeight, setMobileListHeight] = useState(520);
  const categoryInitialized = useRef(false);
  const autoResetPerformed = useRef(false);
  const selectedMainCategorySlug = selectedCategory?.slug || selectedCategory?.id;

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
      const savedDensity = localStorage.getItem('deals_density');
      if (savedDensity === 'compact' || savedDensity === 'comfortable') {
        setCardDensity(savedDensity);
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
    if (categories.length === 0 || categoryInitialized.current) return;
    categoryInitialized.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const mainParam = params.get('mainCategory') || params.get('category');
      const subParam = params.get('subCategory') || params.get('subcategory');
      const subSubParam = params.get('subSubCategory') || params.get('subsubcategory');
      const sortParam = params.get('sort');
      const statusParam = params.get('status');
      const qParam = params.get('q');
      const typeParam = params.get('type');
      const freeShippingParam = params.get('freeShipping');

      if (qParam) setSearchTerm(qParam);
      if (sortParam === 'newest' || sortParam === 'hottest' || sortParam === 'price_asc' || sortParam === 'price_desc' || sortParam === 'discount') {
        setSortBy(sortParam as any);
      }
      if (statusParam === 'waiting_room') {
        setDealStatusView('waiting_room');
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
            const matchedSub = byId.subcategories?.find(s => s.slug === subParam || s.id === subParam);
            if (matchedSub) {
              setSelectedSubcategory(matchedSub.slug || matchedSub.id);
              setSelectedSubSubcategory(null);
            }
          }
          return; // Query params mają pierwszeństwo przed localStorage
        }
      }
      // Jeśli brak query params – fallback do localStorage
      const savedCatId = localStorage.getItem('deals_selected_category');
      if (savedCatId) {
        const found = categories.find(c => c.id === savedCatId || c.slug === savedCatId);
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
            const matchedSub = found.subcategories?.find(s => s.slug === savedSub || s.id === savedSub);
            setSelectedSubcategory((matchedSub?.slug || matchedSub?.id || savedSub) as string);
            setSelectedSubSubcategory(null);
          }
        }
      }
    } catch {}
  }, [categories, setSortBy]);




  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewportFlags = () => {
      const mobile = window.innerWidth < 768;
      setIsMobileViewport(mobile);
      setMobileListHeight(Math.max(380, Math.min(window.innerHeight - 190, 760)));
    };

    updateViewportFlags();
    window.addEventListener('resize', updateViewportFlags);
    return () => window.removeEventListener('resize', updateViewportFlags);
  }, []);

  useEffect(() => {
    try { localStorage.setItem('deals_density', cardDensity); } catch {}
  }, [cardDensity]);

  // Persistuj kategorię
  useEffect(() => {
    try {
      if (selectedCategory) {
        localStorage.setItem('deals_selected_category', selectedCategory.slug || selectedCategory.id);
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
        // Wait for online if needed
        if (!isOnline()) {
          console.warn('[DealsPage] App appears offline, waiting for connection...');
          const online = await waitForOnline(5000);
          if (!online) {
            console.error('[DealsPage] Still offline after 5s, proceeding with fallback data');
            setCategories([]);
            setDeals([]);
            setIsLoading(false);
            return;
          }
        }
        
        const [fetchedCategories, showcaseConfig, hotDealsResult] = await Promise.all([
          retryWithBackoff(() => getCategoriesWithContent('deals'), 2, 500),
          retryWithBackoff(() => getNavigationShowcase(), 1, 500),
          retryWithBackoff(() => searchDealsTypesense('*', {
            limit: 100,
            sortBy: 'hot',
            statusFilter: 'approved',
          }), 2, 500), // Pobierz gorące okazje na start przez Typesense
        ]);
        
        let hotDeals = hotDealsResult || [];
        if (hotDeals.length === 0) {
          console.log('[DealsPage] Hot deals empty or Typesense offline, falling back to Firestore');
          hotDeals = await getDealsByFilters({
            statusFilter: 'approved',
          }, 'hot', 100);
        }

        setCategories(fetchedCategories || []);
        setDeals(hotDeals); // Ustaw deals od razu
        // NIE ustawiamy selectedCategory - pozostaw null aby pokazać wszystkie

        // Pobierz product of the day
        if (showcaseConfig?.productOfTheDayId) {
          try {
            const product = await retryWithBackoff(() => getProductById(showcaseConfig.productOfTheDayId), 1, 500);
            setProductOfTheDay(product);
          } catch (err) {
            console.warn('[DealsPage] Failed to load product of the day:', err);
          }
        }
      } catch (error) {
        console.error('[DealsPage] Error fetching data:', error);
        const msg = error instanceof Error ? error.message : String(error);
        if (isOfflineError(error)) {
          console.warn('[DealsPage] Offline error detected, showing empty state');
        }
        // Set empty fallback to avoid loading forever
        setCategories([]);
        setDeals([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Reset limit when parameters change
  useEffect(() => {
    setLimit(24);
    setHasMore(true);
  }, [selectedMainCategorySlug, selectedSubcategory, selectedSubSubcategory, searchTerm, sortBy, dealStatusView]);

  // Pobierz deals przy zmianie kategorii / subkategorii / wyszukiwaniu / filtrów / limitu
  useEffect(() => {
    let cancelled = false;
    async function fetchDeals() {
      if (limit === 24) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      try {
        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('size', String(limit));
        params.set('sort', sortBy);
        params.set('status', dealStatusView);
        if (searchTerm.trim().length > 0) params.set('q', searchTerm.trim());
        if (selectedMainCategorySlug) params.set('mainCategorySlug', selectedMainCategorySlug);
        if (selectedSubcategory) params.set('subCategorySlug', selectedSubcategory);
        if (selectedSubSubcategory) params.set('subSubCategorySlug', selectedSubSubcategory);
        const response = await fetch(`/api/deals?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to fetch deals');
        const data = await response.json();
        if (cancelled) return;
        setDeals(data.deals || []);
        setTotalDealsCount(data.pagination?.total ?? null);
        setHasMore((data.deals?.length || 0) >= limit && (data.pagination?.total ? limit < data.pagination.total : true));
      } catch (error) {
        console.error('[DealsPage] Error fetching deals:', error);
        if (!cancelled) {
          setDeals([]);
          setTotalDealsCount(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    }
    fetchDeals();
    return () => { cancelled = true; };
  }, [selectedMainCategorySlug, selectedCategory, selectedSubcategory, selectedSubSubcategory, searchTerm, sortBy, dealStatusView, limit]);

  useEffect(() => {
    let cancelled = false;

    async function fetchDealsCount() {
      if (searchTerm.trim().length > 1) {
        if (!cancelled) setTotalDealsCount(null);
        return;
      }

      try {
        if (!isOnline()) {
          const online = await waitForOnline(2000);
          if (!online) {
            if (!cancelled) setTotalDealsCount(null);
            return;
          }
        }

        const count = await retryWithBackoff(() => getDealsCount({
          categoryId: selectedMainCategorySlug,
          subCategorySlug: selectedSubcategory || undefined,
          subSubCategorySlug: selectedSubSubcategory || undefined,
          status: dealStatusView === 'waiting_room' ? 'poczekalnia' : 'approved',
        }), 2, 500);

        if (!cancelled) setTotalDealsCount(count);
      } catch (error) {
        console.warn('[DealsPage] Error fetching deals count:', error);
        if (!cancelled) setTotalDealsCount(null);
      }
    }

    fetchDealsCount();
    return () => { cancelled = true; };
  }, [selectedMainCategorySlug, selectedCategory, selectedSubcategory, selectedSubSubcategory, searchTerm, dealStatusView]);

  // Sortowanie i filtrowanie lokalne (po pobraniu z API)
  const filteredAndSortedDeals = useMemo(() => {
    return deals
      .filter((deal) => {
        if (FEATURES.DEALS_TYPE_FILTER && typeFilter !== 'all') {
          if ((deal.dealType || 'sale') !== typeFilter) return false;
        }
        if (quickFilters.freeShipping && deal.shippingCost !== 0) return false;
        if (quickFilters.bigDiscount && deal.originalPrice) {
          const discount = ((deal.originalPrice - (typeof deal.price === 'object' ? deal.price.amount : deal.price)) / deal.originalPrice) * 100;
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

        // M6 compatible: extract price from both legacy and M6 formats
        const dealPrice = extractDealPriceAmount(deal);
        const minPrice = unifiedFilters.priceRange?.min ?? 0;
        const maxPrice = unifiedFilters.priceRange?.max ?? 15000;
        if (dealPrice < minPrice || dealPrice > maxPrice) return false;

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'hottest':
            return b.temperature - a.temperature;
          case 'newest':
            return toTimestamp((b as any).postedAt) - toTimestamp((a as any).postedAt);
          case 'price_asc': {
            const priceA = extractDealPriceAmount(a);
            const priceB = extractDealPriceAmount(b);
            return priceA - priceB;
          }
          case 'price_desc': {
            const priceA = extractDealPriceAmount(a);
            const priceB = extractDealPriceAmount(b);
            return priceB - priceA;
          }
          case 'discount': {
            const priceA = extractDealPriceAmount(a);
            const priceB = extractDealPriceAmount(b);
            const discountA = a.originalPrice ? ((a.originalPrice - priceA) / a.originalPrice) * 100 : 0;
            const discountB = b.originalPrice ? ((b.originalPrice - priceB) / b.originalPrice) * 100 : 0;
            return discountB - discountA;
          }
          default:
            return 0;
        }
      });
  }, [deals, typeFilter, quickFilters, unifiedFilters, sortBy]);

  // Obserwator do infinite scroll (serwerowego)
  useEffect(() => {
    if (isLoading || !hasMore || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setLimit((prev) => prev + 24);
        }
      },
      { rootMargin: '400px' }
    );
    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      observer.disconnect();
    };
  }, [isLoading, hasMore, isLoadingMore]);

  const displayedDeals = filteredAndSortedDeals;

  const shouldUseVirtualizedWaitingRoom =
    isMobileViewport && dealStatusView === 'waiting_room' && viewMode === 'list';
  const waitingRoomItemSize = cardDensity === 'compact' ? 300 : 340;

  // Statystyki
  const discountStats = filteredAndSortedDeals.reduce(
    (acc, deal) => {
      if (!deal.originalPrice) return acc;
      const currentPrice = extractDealPriceAmount(deal);
      const discount = ((deal.originalPrice - currentPrice) / deal.originalPrice) * 100;
      return { sum: acc.sum + discount, count: acc.count + 1 };
    },
    { sum: 0, count: 0 }
  );

  const stats = {
    total: totalDealsCount !== null ? (totalDealsCount || filteredAndSortedDeals.length) : filteredAndSortedDeals.length,
    avgDiscount: discountStats.count ? discountStats.sum / discountStats.count : 0,
    bestDeal: filteredAndSortedDeals.reduce((best, deal) => {
      if (!deal.originalPrice) return best;
      const currentPrice = extractDealPriceAmount(deal);
      const discount = ((deal.originalPrice - currentPrice) / deal.originalPrice) * 100;
      
      const bestPrice = best ? extractDealPriceAmount(best) : 0;
      const bestDiscount = best?.originalPrice && bestPrice ? ((best.originalPrice - bestPrice) / best.originalPrice) * 100 : 0;
      return discount > bestDiscount ? deal : best;
    }, filteredAndSortedDeals[0]),
  };

  const bestDealDiscount = (() => {
    if (!stats.bestDeal?.originalPrice) return null;
    const currentPrice = extractDealPriceAmount(stats.bestDeal);
    const originalPrice = stats.bestDeal.originalPrice;
    if (!originalPrice || originalPrice <= 0) return null;
    const discount = ((originalPrice - currentPrice) / originalPrice) * 100;
    return Number.isFinite(discount) ? discount : null;
  })();

  const priceFormatter = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
  });

  const gridWrapperClass = cardDensity === 'compact'
    ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4';

  const masonryWrapperClass = cardDensity === 'compact'
    ? 'columns-2 sm:columns-2 lg:columns-3 xl:columns-4 gap-3'
    : 'columns-2 sm:columns-2 lg:columns-3 xl:columns-4 gap-4';

  const listWrapperClass = cardDensity === 'compact' ? 'space-y-3' : 'space-y-4';
  const cardWrapperClass = cardDensity === 'compact' ? 'scale-[0.99] text-sm' : '';

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
      priceRange: [
        unifiedFilters.priceRange?.min ?? 0,
        unifiedFilters.priceRange?.max ?? 15000,
      ],
      quickFilters,
      categoryId: selectedMainCategorySlug,
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
    setUnifiedFilters((prev) => ({
      ...prev,
      priceRange: {
        min: filter.priceRange?.[0] ?? prev.priceRange.min,
        max: filter.priceRange?.[1] ?? prev.priceRange.max,
      },
    }));
    setQuickFilters(filter.quickFilters);
    
    if (filter.categoryId) {
      const cat = categories.find(c => c.id === filter.categoryId || c.slug === filter.categoryId);
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
  const swipeStartXRef = useRef<Record<string, number>>({});

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

  const selectedSubcategoryName = useMemo(() => {
    if (!selectedCategory || !selectedSubcategory) return null;
    const sub = selectedCategory.subcategories?.find((s) => (s.slug || s.id) === selectedSubcategory);
    return sub ? getLocalizedCategoryName(sub as any, lang) : selectedSubcategory;
  }, [selectedCategory, selectedSubcategory, lang]);

  const selectedSubSubcategoryName = useMemo(() => {
    if (!selectedSubcategory || !selectedSubSubcategory) return null;
    const currentSub = sortedSubcategories.find((s) => (s.slug || s.id) === selectedSubcategory);
    const subSub = currentSub?.subcategories?.find((ss) => (ss.slug || ss.id) === selectedSubSubcategory);
    return subSub ? getLocalizedCategoryName(subSub as any, lang) : selectedSubSubcategory;
  }, [sortedSubcategories, selectedSubcategory, selectedSubSubcategory, lang]);

  const handleSwipeStart = (dealId: string, touchX: number) => {
    swipeStartXRef.current[dealId] = touchX;
  };

  const handleSwipeEnd = (dealId: string, touchX: number) => {
    const startX = swipeStartXRef.current[dealId];
    delete swipeStartXRef.current[dealId];

    if (typeof startX !== 'number') return;
    const deltaX = touchX - startX;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const isWaitingRoomList = dealStatusView === 'waiting_room' && viewMode === 'list';

    if (!isMobile || !isWaitingRoomList) return;

    // Swipe right to upvote and left to downvote (M6 touch-first waiting room behavior).
    if (deltaX >= 90 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('deal-swipe-upvote', { detail: { dealId } })
      );
      toast.success('Przesunięto w prawo: oddano głos za');
      return;
    }

    if (deltaX <= -90 && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('deal-swipe-downvote', { detail: { dealId } })
      );
      toast.success('Przesunięto w lewo: oddano głos przeciw');
    }
  };

  const WaitingRoomVirtualRow = ({
    index,
    style,
    dealsList,
    cardClass,
  }: {
    index: number;
    style: React.CSSProperties;
    dealsList: Deal[];
    cardClass: string;
  }) => {
    const deal = dealsList[index];
    if (!deal) return null;

    return (
      <div
        style={style}
        className="px-1 pb-3"
        onTouchStart={(event) => handleSwipeStart(deal.id, event.changedTouches[0]?.clientX ?? 0)}
        onTouchEnd={(event) => handleSwipeEnd(deal.id, event.changedTouches[0]?.clientX ?? 0)}
      >
        <div className={cardClass}>
          <DealListCard deal={deal} priority={index === 0} />
        </div>
      </div>
    );
  };

  // Sidebar Content (reusable for desktop and mobile) – na wzór strony produktów
  const SidebarContent = () => (
    <div className="space-y-2">
      <div className="mb-4">
        <h2 className="font-headline text-lg font-semibold">{t('sidebar.categories')}</h2>
      </div>
      <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-200px)] lg:h-[600px] pr-1">{/* All categories */}
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

        {sortedCategories.map((category) => {
          const isActive = selectedCategory?.id === category.id;
          const style = getCategoryStyle(category);
          const IconComponent = style.icon;
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
                  "w-full text-left px-3 py-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 group text-sm font-semibold",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center transition-all",
                  isActive
                    ? "bg-white/20 text-white"
                    : cn("bg-gradient-to-br", style.bg, style.accent)
                )}>
                  {typeof IconComponent === 'function' ? (
                    <IconComponent className="h-4 w-4" />
                  ) : (
                    <span className="text-sm">{IconComponent}</span>
                  )}
                </div>
                <span className="font-semibold flex-1 truncate">{getLocalizedCategoryName(category, locale as SupportedLanguage)}</span>
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform opacity-50",
                  isActive ? "rotate-90 opacity-100" : "group-hover:translate-x-1 group-hover:opacity-100"
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
        <div className="page-container py-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              {tCommon('breadcrumb.home')}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span className="font-medium text-foreground">{tCommon('breadcrumb.deals')}</span>
            {selectedCategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{getLocalizedCategoryName(selectedCategory as any, lang)}</span>
              </>
            )}
            {selectedSubcategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{selectedSubcategoryName || selectedSubcategory}</span>
              </>
            )}
            {selectedSubSubcategory && (
              <>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-foreground">{selectedSubSubcategoryName || selectedSubSubcategory}</span>
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
                    {t('filters.filterButtonText')}
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

            {/* Left Sidebar - Categories (Desktop only) */}
            <div className="hidden lg:block lg:col-span-3">
              <div className="space-y-4">
                {/* Categories */}
                <div suppressHydrationWarning>
                  <SidebarContent />
                </div>

                {/* Separator */}
                <div className="border-t pt-4" />

                {/* Unified Filters (Desktop) */}
                <UnifiedFilterSidebar
                  filters={unifiedFilters}
                  onFiltersChange={setUnifiedFilters}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  categoryId={selectedCategory?.id}
                  isMobile={false}
                />
              </div>
            </div>

            {/* Center Content - Subcategories & Deals */}
            <div className="col-span-1 lg:col-span-9">
              {/* Search Bar */}
              <div className="mb-4 lg:mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('filters.search')}
                    aria-label={t('filters.search')}
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* Statystyki */}
              {stats.total > 0 && (
                <div className="mb-3 lg:mb-4 grid grid-cols-3 gap-1.5">
                  <Card className="p-2">
                    <div className="flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-primary" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t('title')}</p>
                        <p className="text-base font-bold">{stats.total}</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-2">
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-green-500" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t('stats.avgDiscount')}</p>
                        <p className="text-base font-bold">
                          {Number.isFinite(stats.avgDiscount) ? `${stats.avgDiscount.toFixed(0)}%` : '-'}
                        </p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-2">
                    <div className="flex items-center gap-1.5">
                      <Flame className="h-3.5 w-3.5 text-orange-500" />
                      <div>
                        <p className="text-[10px] text-muted-foreground">{t('stats.bestDeal')}</p>
                        <p className="text-base font-bold">
                          {bestDealDiscount !== null ? `${bestDealDiscount.toFixed(0)}%` : '-'}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Filtry i sortowanie */}
              <Card className="mb-4 shadow-sm border-dashed">
                <CardContent className="p-4 pt-3 space-y-2">
                  <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{t('filtersTitle')}</p>
                        <span className="text-xs text-muted-foreground">{t('filtersSubtitle')}</span>
                      </div>
                      <ChevronDown
                        className={cn('h-4 w-4 text-muted-foreground transition-transform', isFiltersOpen && 'rotate-180')}
                      />
                    </CollapsibleTrigger>

                    <CollapsibleContent className="space-y-2 pt-2">
                      {/* Sortowanie */}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <SortSelect />
                        <Select value={dealStatusView} onValueChange={(value: DealStatusView) => {
                          setDealStatusView(value);
                          const params = new URLSearchParams(searchParams.toString());
                          params.set('status', value);
                          router.push(`${window.location.pathname}?${params.toString()}`);
                        }}>
                          <SelectTrigger className="w-full sm:w-[260px]" aria-label="Widoczność">
                            <SelectValue placeholder="Widoczność" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">Widok: Zatwierdzone</SelectItem>
                            <SelectItem value="waiting_room">Widok: Poczekalnia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Quick filters - chipy */}
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant={quickFilters.freeShipping ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/10 transition-colors text-[11px] px-2 py-0.5"
                          onClick={() => setQuickFilters(prev => ({ ...prev, freeShipping: !prev.freeShipping }))}
                        >
                          <Truck className="h-3 w-3 mr-1" />
                          {t('filters.quickFilters.freeShipping')}
                        </Badge>
                        {FEATURES.DEALS_TYPE_FILTER && (
                          <Badge
                            variant={typeFilter === 'coupon' ? 'default' : 'outline'}
                            className="cursor-pointer hover:bg-primary/10 transition-colors text-[11px] px-2 py-0.5"
                            onClick={() => setTypeFilter(prev => prev === 'coupon' ? 'all' as DealTypeFilter : 'coupon')}
                          >
                            🎟️ {t('filters.quickFilters.couponOnly')}
                          </Badge>
                        )}
                        {FEATURES.DEALS_TYPE_FILTER && (
                          <Badge
                            variant={typeFilter === 'freebie' ? 'default' : 'outline'}
                            className="cursor-pointer hover:bg-primary/10 transition-colors text-[11px] px-2 py-0.5"
                            onClick={() => setTypeFilter(prev => prev === 'freebie' ? 'all' as DealTypeFilter : 'freebie')}
                          >
                            🆓 {t('filters.quickFilters.freebies')}
                          </Badge>
                        )}
                        <Badge
                          variant={quickFilters.bigDiscount ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/10 transition-colors text-[11px] px-2 py-0.5"
                          onClick={() => setQuickFilters(prev => ({ ...prev, bigDiscount: !prev.bigDiscount }))}
                        >
                          <Tag className="h-3 w-3 mr-1" />
                          {t('filters.quickFilters.bigDiscount')}
                        </Badge>
                        <Badge
                          variant={quickFilters.today ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/10 transition-colors text-[11px] px-2 py-0.5"
                          onClick={() => setQuickFilters(prev => ({ ...prev, today: !prev.today }))}
                        >
                          <Calendar className="h-3 w-3 mr-1" />
                          {t('filters.quickFilters.todayOnly')}
                        </Badge>
                        <Badge
                          variant={quickFilters.verified ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/10 transition-colors text-[11px] px-2 py-0.5"
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
                                aria-label={`Usuń filtr ${filter.name}`}
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
                          className="w-full sm:w-auto h-8 px-3 text-xs"
                        >
                          <Save className="h-4 w-4 mr-2" />
                          {t('filters.saveFilterCurrent')}
                        </Button>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>

              {/* Deals List */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <h3 className="font-headline text-base font-semibold">
                    🔥 {t('heading')} ({filteredAndSortedDeals.length})
                  </h3>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="xl:hidden"
                      onClick={() => setInsightsOpen(true)}
                    >
                      <Sparkles className="mr-2 h-4 w-4" />
                      {t('recommendations')}
                    </Button>

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-1 border rounded-lg p-1">
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="h-8 px-3"
                        aria-label={t('viewMode.list')}
                      >
                        <ListIcon className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">{t('viewMode.list')}</span>
                      </Button>
                      <Button
                        variant={viewMode === 'masonry' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('masonry')}
                        className="h-8 px-3"
                        aria-label="Kafelki"
                      >
                        <Columns className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Kafelki</span>
                      </Button>
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="h-8 px-3"
                        aria-label={t('viewMode.grid')}
                      >
                        <LayoutGrid className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">{t('viewMode.grid')}</span>
                      </Button>
                    </div>
                  </div>
                </div>
                {isLoading ? (
                  <div className={cn(
                    viewMode === 'list' ? listWrapperClass : (viewMode === 'masonry' ? masonryWrapperClass : gridWrapperClass)
                  )}>
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={cn(
                        "bg-muted animate-pulse rounded-lg",
                        viewMode === 'list'
                          ? 'h-48'
                          : cardDensity === 'compact' ? 'h-80' : 'h-96'
                      )} />
                    ))}
                  </div>
                ) : filteredAndSortedDeals.length > 0 ? (
                  <>
                    {viewMode === 'list' ? (
                      shouldUseVirtualizedWaitingRoom ? (
                        <div className="rounded-lg border border-border/60 bg-background/30">
                          <VirtualizedList
                            style={{ height: mobileListHeight, width: '100%' }}
                            rowCount={filteredAndSortedDeals.length}
                            rowHeight={waitingRoomItemSize}
                            overscanCount={4}
                            rowComponent={WaitingRoomVirtualRow as any}
                            rowProps={{ dealsList: filteredAndSortedDeals, cardClass: cardWrapperClass }}
                          />
                        </div>
                      ) : (
                        <div className={listWrapperClass}>
                          {displayedDeals.map((deal, index) => (
                            <div
                              key={deal.id}
                              className={cardWrapperClass}
                              onTouchStart={(event) => handleSwipeStart(deal.id, event.changedTouches[0]?.clientX ?? 0)}
                              onTouchEnd={(event) => handleSwipeEnd(deal.id, event.changedTouches[0]?.clientX ?? 0)}
                            >
                              <DealListCard deal={deal} priority={index === 0} />
                            </div>
                          ))}
                        </div>
                      )
                    ) : viewMode === 'masonry' ? (
                      <div className={masonryWrapperClass}>
                        {displayedDeals.map((deal) => (
                          <div key={deal.id} className={cn("break-inside-avoid mb-4", cardWrapperClass)}>
                            <DealCard deal={deal} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={gridWrapperClass}>
                        {displayedDeals.map((deal) => (
                          <div key={deal.id} className={cardWrapperClass}>
                            <DealCard deal={deal} />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Infinite scroll loader */}
                    {hasMore && !shouldUseVirtualizedWaitingRoom && (
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
                        <p>
                          Pokazano wszystkie {filteredAndSortedDeals.length} okazji
                          {dealStatusView === 'waiting_room' ? ' (poczekalnia)' : ''}
                        </p>
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

          </div>
        </div>
      </div>

      {(productOfTheDay || selectedCategory?.promo) && (
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
                          {tCommon('labels.viewProduct')}
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
                      <Flame className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Gorące okazje</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sprawdź produkty z najwyższymi ocenami i opiniami
                    </p>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/${locale}/products`}>
                        Zobacz produkty
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

