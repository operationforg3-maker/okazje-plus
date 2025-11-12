'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
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
import { Search, ChevronRight, Flame, Sparkles, ArrowRight, Filter, Menu, LayoutGrid, List, TrendingUp, Clock, Star, DollarSign, Package, Truck, Tag, Calendar, Save, Bookmark } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type ViewMode = 'list' | 'grid';
type SortOption = 'hottest' | 'newest' | 'price_asc' | 'price_desc' | 'discount';

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
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [productOfTheDay, setProductOfTheDay] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('hottest');
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [quickFilters, setQuickFilters] = useState({
    freeShipping: false,
    bigDiscount: false,
    today: false,
    verified: false,
  });
  const [displayLimit, setDisplayLimit] = useState(20);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

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
        }
      } catch (error) {
        console.error('Error loading saved filters:', error);
      }
    }
    loadSavedFilters();
  }, [user]);

  // Wczytaj zapisaną kategorię / podkategorię gdy tylko będą dostępne kategorie
  useEffect(() => {
    if (categories.length === 0) return;
    // Jeśli użytkownik już coś wybrał w tej sesji – nie nadpisuj
    if (selectedCategory) return;
    try {
      const savedCatId = localStorage.getItem('deals_selected_category');
      if (savedCatId) {
        const found = categories.find(c => c.id === savedCatId);
        if (found) {
          setSelectedCategory(found);
          const savedSub = localStorage.getItem('deals_selected_subcategory');
          if (savedSub) setSelectedSubcategory(savedSub);
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
            limit: 100,
          });
          if (!cancelled) setDeals(results);
        } else if (selectedCategory) {
          // Filtrowanie według kategorii
          const categoryDeals = await getDealsByCategory(
            selectedCategory.id,
            selectedSubcategory || undefined,
            undefined, // subSubCategorySlug - na razie nie używamy
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
  }, [selectedCategory, selectedSubcategory, searchTerm]);

  // Sortowanie i filtrowanie lokalne (po pobraniu z API)
  const filteredAndSortedDeals = deals
    .filter(deal => {
      // Quick filters
      if (quickFilters.freeShipping && deal.shippingCost !== 0) return false;
      if (quickFilters.bigDiscount && deal.originalPrice) {
        const discount = ((deal.originalPrice - deal.price) / deal.originalPrice) * 100;
        if (discount < 50) return false;
      }
      if (quickFilters.today) {
        const today = new Date().toDateString();
        const dealDate = new Date(deal.postedAt).toDateString();
        if (today !== dealDate) return false;
      }
      if (quickFilters.verified && !deal.merchant) return false;
      
      // Price range
      if (deal.price < priceRange[0] || deal.price > priceRange[1]) return false;
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'hottest':
          return b.temperature - a.temperature;
        case 'newest':
          return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
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
      if (cat) setSelectedCategory(cat);
    }
    if (filter.subcategorySlug) {
      setSelectedSubcategory(filter.subcategorySlug);
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

  // Sidebar Content (reusable for desktop and mobile) – na wzór strony produktów
  const SidebarContent = () => (
    <div className="space-y-2">
      <h2 className="font-headline text-lg font-semibold mb-4">Kategorie</h2>
      <ScrollArea className="h-[calc(100vh-200px)] lg:h-[600px] pr-1">
        {/* Przycisk "Wszystkie" */}
        <div className="mb-1">
          <button
            onClick={() => {
              setSelectedCategory(null);
              setSelectedSubcategory(null);
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
            <span className="font-medium flex-1">Wszystkie okazje</span>
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
                onClick={() => {
                  setSelectedCategory(category);
                  setSelectedSubcategory(null);
                  setIsMobileSidebarOpen(false);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 group",
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                )}
              >
                {category.icon && <span className="text-xl">{category.icon}</span>}
                <span className="font-medium flex-1">{category.name}</span>
                <ChevronRight className={cn(
                  "h-4 w-4 transition-transform",
                  isActive ? "rotate-90" : "group-hover:translate-x-1"
                )} />
              </button>

              {isActive && category.subcategories.length > 0 && (
                <div className="mt-1 ml-2 space-y-1 border-l pl-3">
                  {category.subcategories.map((sub) => {
                    const subActive = selectedSubcategory === sub.slug;
                    return (
                      <button
                        key={sub.slug}
                        onClick={() => setSelectedSubcategory(subActive ? null : sub.slug)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                          subActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted"
                        )}
                      >
                        {sub.icon && <span className="text-base">{sub.icon}</span>}
                        <span className="flex-1 truncate">{sub.name}</span>
                        {sub.highlight && (
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">Nowość</Badge>
                        )}
                      </button>
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
                    Darmowa dostawa
                  </Badge>
                  <Badge
                    variant={quickFilters.bigDiscount ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setQuickFilters(prev => ({ ...prev, bigDiscount: !prev.bigDiscount }))}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    Zniżka &gt;50%
                  </Badge>
                  <Badge
                    variant={quickFilters.today ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setQuickFilters(prev => ({ ...prev, today: !prev.today }))}
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Tylko dziś
                  </Badge>
                  <Badge
                    variant={quickFilters.verified ? 'default' : 'outline'}
                    className="cursor-pointer hover:bg-primary/10 transition-colors"
                    onClick={() => setQuickFilters(prev => ({ ...prev, verified: !prev.verified }))}
                  >
                    <Star className="h-3 w-3 mr-1" />
                    Sprawdzone sklepy
                  </Badge>
                </div>

                {/* Zapisane filtry */}
                {user && savedFilters.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Bookmark className="h-3 w-3" />
                      Zapisane:
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
                  viewMode === 'list' ? (
                    <div className="space-y-4">
                      {filteredAndSortedDeals.slice(0, displayLimit).map((deal) => (
                        <DealListCard key={deal.id} deal={deal} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredAndSortedDeals.slice(0, displayLimit).map((deal) => (
                        <DealCard key={deal.id} deal={deal} />
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Brak okazji w tej kategorii</p>
                  </div>
                )}

                {/* Load More Button */}
                {filteredAndSortedDeals.length > displayLimit && (
                  <div className="mt-6 text-center">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setDisplayLimit(prev => prev + 20)}
                      className="w-full sm:w-auto"
                    >
                      Załaduj więcej okazji
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Pokazujesz {Math.min(displayLimit, filteredAndSortedDeals.length)} z {filteredAndSortedDeals.length} okazji
                    </p>
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

